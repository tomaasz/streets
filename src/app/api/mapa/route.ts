import { createHash } from 'node:crypto';
import { zapytaj } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Dane dla mapy — to samo, co `/api/eksport?format=geojson`, tylko odchudzone
 * i nadające się do trzymania w cache.
 *
 * Eksport jest do pobrania na dysk: ma komplet kolumn, bo ktoś wczyta go do
 * QGIS-a i będzie chciał tam mieć wszystko. Mapa potrzebuje tylko tego, co
 * naprawdę trafia na ekran albo do dymka, a odpytywana jest przy każdym
 * wejściu na stronę. Stąd trzy oszczędności:
 *
 *  1. Nazwy zarządców, źródeł i podstaw prawnych powtarzają się w setkach
 *     odcinków — idą raz, do `slowniki`, a przy odcinku zostaje indeks.
 *  2. Puste pola w ogóle nie trafiają do JSON-a zamiast lądować tam jako null.
 *  3. Geometria upraszcza się w bazie, na `geom_pg` (PostGIS, patrz
 *     db/migrations/0003_postgis.sql) — ST_SimplifyPreserveTopology w metrach
 *     PL-1992, nie Douglas–Peucker w Node.js na stopniach WGS84. Tolerancja
 *     metra jest wyraźnie poniżej błędu własnego BDOT10k (mapa 1:10 000).
 *     Przy widoku całej gminy ucina to ponad połowę wierzchołków — i tyleż
 *     samo pracy bazie zamiast serwerowej funkcji przy każdym cache-missie.
 *
 * Na koniec odpowiedź dostaje ETag i `s-maxage`, więc drugie wejście na mapę
 * nie rusza już bazy: obsługuje je CDN.
 */

type Wiersz = {
  slug: string;
  nazwa_pelna: string;
  miejscowosc: string;
  kategoria: string | null;
  nr_drogi: string | null;
  odcinek_dlugosc_m: number | null;
  pewnosc: number | null;
  zarzadca: string | null;
  podstawa_prawna: string | null;
  zrodlo: string | null;
  zrodlo_nazwa: string | null;
  zrodlo_url: string | null;
  /** GeoJSON jako tekst — wynik ST_AsGeoJSON, jeszcze nie sparsowany. */
  geom_json: string | null;
};

/** Zbiera powtarzalne teksty do słownika i oddaje indeks. */
function slownik() {
  const kolejnosc: string[] = [];
  const numery = new Map<string, number>();
  return {
    lista: kolejnosc,
    indeks(v: string | null | undefined): number | undefined {
      if (!v) return undefined;
      const znany = numery.get(v);
      if (znany !== undefined) return znany;
      const nowy = kolejnosc.push(v) - 1;
      numery.set(v, nowy);
      return nowy;
    },
  };
}

function warunki(sp: URLSearchParams) {
  const gdzie: string[] = [];
  const par: unknown[] = [];
  const dodaj = (wartosc: string | null, sql: (n: number) => string) => {
    if (!wartosc) return;
    par.push(wartosc);
    gdzie.push(sql(par.length));
  };

  dodaj(sp.get('slug'), (n) => `u.slug = $${n}`);
  dodaj(sp.get('kategoria'), (n) => `o.kategoria::text = $${n}`);
  dodaj(sp.get('miejscowosc'), (n) => `u.miejscowosc = $${n}`);
  dodaj(sp.get('zarzadca'), (n) => `z.kod = $${n}`);
  const q = sp.get('q');
  if (q) {
    par.push(`%${q}%`);
    gdzie.push(`bez_ogonkow(u.nazwa_pelna) LIKE bez_ogonkow($${par.length})`);
  }

  return { sql: gdzie.length ? `WHERE ${gdzie.join(' AND ')}` : '', par };
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const { sql, par } = warunki(sp);

  // Przy jednej ulicy mapa dojeżdża do metra na piksel i każde ścięcie łuku
  // byłoby wtedy widoczne, więc geometria idzie bez uproszczenia. Przy całej
  // gminie najbliższy sensowny zoom to kilkadziesiąt centymetrów na piksel
  // i metr tolerancji nie ma prawa się tam pokazać.
  const domyslnaTolerancja = sp.get('slug') ? 0 : 1;
  const zadana = Number(sp.get('uproszczenie') ?? domyslnaTolerancja);
  const tolerancja = Number.isFinite(zadana)
    ? Math.max(0, Math.min(25, zadana))
    : domyslnaTolerancja;
  par.push(tolerancja);
  const pTolerancja = par.length;

  // Identyfikatory na końcu ORDER BY nie są ozdobą: bez nich wiersze o tej
  // samej ulicy i kategorii (a takich grup jest kilkanaście) wracają
  // w dowolnej kolejności. Ciało odpowiedzi zmieniałoby się wtedy bajt
  // w bajt przy tych samych danych, a razem z nim ETag — i dwie instancje
  // serverless podawałyby CDN-owi dwa różne znaczniki tej samej treści.
  //
  // Uproszczenie idzie w PL-1992 (ST_Transform do 2180), nie na stopniach
  // WGS84 — tolerancja w metrach jest wtedy dokładna, a nie przybliżona
  // przez cos(szerokości), jak liczył poprzedni, wycofany kod w JS.
  const wiersze = await zapytaj<Wiersz>(
    `SELECT u.slug, u.nazwa_pelna, u.miejscowosc,
            o.kategoria::text AS kategoria, o.nr_drogi,
            o.dlugosc_m AS odcinek_dlugosc_m, o.pewnosc, o.podstawa_prawna,
            o.zrodlo, z.nazwa AS zarzadca,
            zr.nazwa AS zrodlo_nazwa, zr.url AS zrodlo_url,
            ST_AsGeoJSON(
              ST_Transform(
                ST_SimplifyPreserveTopology(
                  ST_Transform(COALESCE(o.geom_pg, u.geom_pg), 2180),
                  $${pTolerancja}
                ),
                4326
              ), 6
            ) AS geom_json
       FROM ulica u
       LEFT JOIN odcinek_drogi o ON o.ulica_id = u.id
       LEFT JOIN zarzadca z      ON z.id = o.zarzadca_id
       LEFT JOIN zrodlo_danych zr ON zr.kod = o.zrodlo
       ${sql}
      ORDER BY u.miejscowosc, u.nazwa, o.kategoria, o.id, u.id`,
    par
  );

  const zarzadcy = slownik();
  const podstawy = slownik();
  const zrodla: { kod: string; nazwa: string; url: string | null }[] = [];
  const numerZrodla = new Map<string, number>();

  const features: unknown[] = [];
  for (const w of wiersze) {
    if (!w.geom_json) continue;
    const geom = JSON.parse(w.geom_json);

    let zrodlo: number | undefined;
    if (w.zrodlo) {
      if (!numerZrodla.has(w.zrodlo)) {
        numerZrodla.set(
          w.zrodlo,
          zrodla.push({
            kod: w.zrodlo,
            nazwa: w.zrodlo_nazwa ?? w.zrodlo,
            url: w.zrodlo_url,
          }) - 1
        );
      }
      zrodlo = numerZrodla.get(w.zrodlo);
    }

    // pola puste w ogóle nie wchodzą do JSON-a — przy 700 odcinkach
    // same „null” potrafią zająć więcej niż niejedna geometria
    const wlasciwosci: Record<string, unknown> = {
      slug: w.slug,
      nazwa: w.nazwa_pelna,
      miejscowosc: w.miejscowosc,
    };
    if (w.kategoria) wlasciwosci.kategoria = w.kategoria;
    if (w.nr_drogi) wlasciwosci.nr_drogi = w.nr_drogi;
    if (w.odcinek_dlugosc_m != null) wlasciwosci.dlugosc_m = w.odcinek_dlugosc_m;
    if (w.pewnosc != null) wlasciwosci.pewnosc = w.pewnosc;
    const z = zarzadcy.indeks(w.zarzadca);
    if (z !== undefined) wlasciwosci.zarzadca = z;
    const p = podstawy.indeks(w.podstawa_prawna);
    if (p !== undefined) wlasciwosci.podstawa = p;
    if (zrodlo !== undefined) wlasciwosci.zrodlo = zrodlo;

    features.push({ type: 'Feature', properties: wlasciwosci, geometry: geom });
  }

  const cialo = JSON.stringify({
    type: 'FeatureCollection',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    uproszczenie_m: tolerancja,
    slowniki: { zarzadcy: zarzadcy.lista, podstawy: podstawy.lista, zrodla },
    features,
  });

  const etag = `W/"${createHash('sha1').update(cialo).digest('base64url')}"`;
  const naglowki = {
    'content-type': 'application/geo+json; charset=utf-8',
    etag,
    // Dane odświeżają się raz w tygodniu, więc godzina w CDN-ie jest
    // ostrożna, a `stale-while-revalidate` sprawia, że nawet po jej upływie
    // nikt nie czeka na bazę — dostaje wersję z półki, a odświeżenie idzie
    // w tle.
    'cache-control':
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=604800',
    'x-odcinkow': String(features.length),
  };

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: naglowki });
  }
  return new Response(cialo, { headers: naglowki });
}
