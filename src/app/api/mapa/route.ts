import {szukajUug,zapytanieUug} from '@/lib/uug';
import {szukajOsm} from '@/lib/osm';
import {nazwyDodatkowe} from '@/lib/nazwy-dodatkowe';
import { createHash } from 'node:crypto';
import { zapytaj } from '@/lib/db';
import { warunkiDrog } from '@/lib/warunki-drog';

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
  id: string;
  slug: string | null;
  nazwa_pelna: string;
  miejscowosc: string | null;
  opis_odcinka: string | null;
  uwagi: string | null;
  akty: { numer: string; url_pdf: string | null }[] | null;
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


export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const { sql, par } = warunkiDrog(sp);

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
    `SELECT CASE WHEN o.id IS NOT NULL THEN 'odcinek-' || o.id ELSE 'ulica-' || u.id END AS id, u.slug,
            COALESCE(u.nazwa_pelna, CASE WHEN o.kategoria = 'gminna'
              THEN 'Droga gminna bez nazwy' ELSE 'Droga bez nazwy' END) AS nazwa_pelna,
            u.miejscowosc, o.opis_odcinka,
            CASE WHEN u.id IS NULL THEN o.uwagi END AS uwagi,
            (SELECT json_agg(json_build_object('numer', a.numer, 'url_pdf', a.url_pdf)
                             ORDER BY a.data_podjecia, a.numer)
               FROM akt_odcinek ao JOIN akt_prawny a ON a.id = ao.akt_id
              WHERE ao.odcinek_id = o.id AND ao.rola = 'zaliczenie do kategorii') AS akty,
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
       FULL OUTER JOIN odcinek_drogi o ON o.ulica_id = u.id
       LEFT JOIN zarzadca z      ON z.id = o.zarzadca_id
       LEFT JOIN zrodlo_danych zr ON zr.kod = o.zrodlo
       ${sql}
      ORDER BY u.miejscowosc NULLS LAST, u.nazwa NULLS LAST, o.kategoria, o.id, u.id`,
    par
  );

  // Przy porównywaniu odcinka z ulicą dodajemy niezależny przebieg PRG.
  if(sp.get('prg')) {
    const referencje=await zapytaj<Wiersz>(`SELECT 'ulica-' || u.id id,u.slug,
      'Przebieg PRG: ' || u.nazwa_pelna nazwa_pelna,u.miejscowosc,
      'Linia odniesienia z rejestru nazw ulic; nie ustala kategorii ani zarządcy.' opis_odcinka,
      u.zrodlo,zr.nazwa zrodlo_nazwa,zr.url zrodlo_url,
      ST_AsGeoJSON(u.geom_pg,6) geom_json
      FROM ulica u LEFT JOIN zrodlo_danych zr ON zr.kod=u.zrodlo WHERE u.slug=$1`,[sp.get('prg')]);
    for(const r of referencje) if(!wiersze.some(w=>w.id===r.id)) wiersze.push(r);
  }

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
      nazwa: w.nazwa_pelna,
    };
    if (w.slug) wlasciwosci.slug = w.slug;
    if (w.miejscowosc) wlasciwosci.miejscowosc = w.miejscowosc;
    if (w.opis_odcinka) wlasciwosci.opis_odcinka = w.opis_odcinka;
    if (w.uwagi) wlasciwosci.uwagi = w.uwagi;
    if (w.akty?.length) wlasciwosci.akty = w.akty;
    if (w.kategoria) wlasciwosci.kategoria = w.kategoria;
    if (w.nr_drogi) wlasciwosci.nr_drogi = w.nr_drogi;
    if (w.odcinek_dlugosc_m != null) wlasciwosci.dlugosc_m = w.odcinek_dlugosc_m;
    if (w.pewnosc != null) wlasciwosci.pewnosc = w.pewnosc;
    const z = zarzadcy.indeks(w.zarzadca);
    if (z !== undefined) wlasciwosci.zarzadca = z;
    const p = podstawy.indeks(w.podstawa_prawna);
    if (p !== undefined) wlasciwosci.podstawa = p;
    if (zrodlo !== undefined) wlasciwosci.zrodlo = zrodlo;

    features.push({ type: 'Feature', id: w.id, properties: wlasciwosci, geometry: geom });
  }

  let uugStatus:string|undefined;
  let osmStatus:string|undefined;
  if(!wiersze.length && !sp.get('slug') && !sp.get('odcinki') && !sp.get('prg') && zapytanieUug(sp.get('q') ?? undefined,sp.get('miejscowosc') ?? undefined,sp.get('kategoria') ?? undefined,sp.get('zarzadca') ?? undefined)) {
    const dane=await szukajUug(sp.get('q')!,sp.get('miejscowosc')!);
    uugStatus=dane.status;
    for(const w of dane.wyniki) features.push({type:'Feature',id:w.id,geometry:w.geometry,properties:{
      nazwa:w.nazwa,miejscowosc:w.miejscowosc,pewnosc:2,zrodlo:zrodla.length,
      opis_odcinka:'Aktualny wynik UUG/PRG. Kategoria i zarządca nie są ustalone w tej usłudze.'}});
    if(dane.wyniki.length) zrodla.push({kod:'uug',nazwa:'Aktualny PRG przez Uniwersalną Usługę Geokodowania (UUG)',url:'https://services.gugik.gov.pl/uug/'});
    if(!dane.wyniki.length && dane.status!=='miejscowosc' && !nazwyDodatkowe(sp.get('q')!,sp.get('miejscowosc')!).length) {
      const osm=await szukajOsm(sp.get('q')!,sp.get('miejscowosc')!);
      osmStatus=osm.status;
      for(const w of osm.wyniki) {
        const source=zrodla.length;
        zrodla.push({kod:'osm',nazwa:'© OpenStreetMap contributors · ODbL',url:w.url});
        features.push({type:'Feature',id:w.id,geometry:w.geometry,properties:{nazwa:w.nazwa,miejscowosc:`Okolice ${w.miejscowosc}`,status_nazwy:'osm',zrodlo:source,
          opis_odcinka:'Nazwa i przebieg z OpenStreetMap. Brak potwierdzenia nazwy w dokumentach aplikacji; kategoria i zarządca nieustalone. Miejscowość określono przybliżeniem przestrzennym.'}});
      }
    }
  }

  const cialo = JSON.stringify({
    type: 'FeatureCollection',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    uproszczenie_m: tolerancja,
    uugStatus,
    osmStatus,
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
      uugStatus ? 'no-store' : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=604800',
    'x-odcinkow': String(features.length),
  };

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: naglowki });
  }
  return new Response(cialo, { headers: naglowki });
}
