import { sortowanie } from './sortowanie';
import { zapytaj } from './db';
import powiazania from '../../db/seed/powiazania-odcinkow.json';
import type { Odcinek, WierszUlicy, Zrodlo } from './typy';

export type FiltryUlic = {
  q?: string;
  kategoria?: string;
  miejscowosc?: string;
  zarzadca?: string;
  limit?: number;
  offset?: number;
  slug?: string;
  sort?:string;
  kierunek?:string;
};

// Miejscowość drogi bez nazwy pochodzi z jawnie sprawdzonego powiązania uchwały.
const rejestrDrog = JSON.stringify(powiazania);
const wspolnaLista = `WITH v AS MATERIALIZED (
 SELECT v.id,v.slug,v.simc,v.sym_ul,v.miejscowosc,v.cecha,v.nazwa,v.nazwa_pelna,
 v.dlugosc_m,v.kategorie,v.zarzadcy,v.zarzadcy_kody,v.numery_drog,v.zrodla,
 v.pewnosc_min,v.liczba_odcinkow,v.ma_luke,v.wielu_zarzadcow,u.x_2180,u.y_2180,
 NULL::integer AS odcinek_id,NULL::text AS opis_odcinka,
 (SELECT a.url_pdf FROM akt_ulica au JOIN akt_prawny a ON a.id=au.akt_id
 WHERE au.ulica_id=v.id AND a.url_pdf IS NOT NULL LIMIT 1) AS url_pdf
 FROM v_ulica_zarzadcy v JOIN ulica u ON u.id=v.id
 UNION ALL
 SELECT -o.id,NULL,NULL,NULL,m.miejscowosc,NULL,
 'Droga ' || o.kategoria::text || ' bez nazwy',
 'Droga ' || o.kategoria::text || ' bez nazwy',o.dlugosc_m,
 ARRAY[o.kategoria::text],CASE WHEN z.id IS NULL THEN ARRAY[]::text[] ELSE ARRAY[z.nazwa] END,
 CASE WHEN z.id IS NULL THEN ARRAY[]::text[] ELSE ARRAY[z.kod] END,
 CASE WHEN o.nr_drogi IS NULL THEN ARRAY[]::text[] ELSE ARRAY[o.nr_drogi] END,
 ARRAY[o.zrodlo,'uchwala']::text[],o.pewnosc,1,false,false,NULL,NULL,o.id,o.opis_odcinka,
 (SELECT a.url_pdf FROM akt_odcinek ao JOIN akt_prawny a ON a.id=ao.akt_id
 WHERE ao.odcinek_id=o.id AND a.url_pdf IS NOT NULL ORDER BY a.data_podjecia DESC LIMIT 1)
 FROM odcinek_drogi o LEFT JOIN zarzadca z ON z.id=o.zarzadca_id
 LEFT JOIN LATERAL (
 SELECT miejscowosc FROM (
 SELECT d.cel->>'miejscowosc' miejscowosc FROM powiazanie_zatwierdzone d
 WHERE d.rodzaj='uchwala' AND EXISTS (SELECT 1 FROM jsonb_array_elements(d.cel->'odcinki') c WHERE c->>'hash'=md5(o.geom::text))
 AND EXISTS (SELECT 1 FROM ulica u WHERE u.miejscowosc=d.cel->>'miejscowosc')
 UNION ALL
 SELECT r.miejscowosc FROM jsonb_to_recordset('${rejestrDrog.replaceAll("'", "''")}'::jsonb)
 AS r(numer_bdot text,miejscowosc text,akt text,zalacznik integer,lp integer)
 WHERE r.numer_bdot=o.nr_drogi AND EXISTS (
 SELECT 1 FROM akt_odcinek ao JOIN akt_prawny a ON a.id=ao.akt_id
 WHERE ao.odcinek_id=o.id AND a.numer=r.akt)
 AND EXISTS (SELECT 1 FROM ulica u WHERE u.miejscowosc=r.miejscowosc)
 ) przypisania LIMIT 1
 ) m ON true
 WHERE o.ulica_id IS NULL AND EXISTS (
 SELECT 1 FROM akt_odcinek ao WHERE ao.odcinek_id=o.id AND ao.rola='zaliczenie do kategorii')
)`;

function warunki(f: FiltryUlic) {
  const gdzie: string[] = [];
  const par: unknown[] = [];
  if (f.q) {
    par.push(`%${f.q}%`);
    gdzie.push(`(bez_ogonkow(v.nazwa_pelna) LIKE bez_ogonkow($${par.length})
      OR array_to_string(v.numery_drog,',') ILIKE $${par.length}
      OR bez_ogonkow(v.opis_odcinka) LIKE bez_ogonkow($${par.length})
      OR EXISTS (SELECT 1 FROM odcinek_drogi o WHERE o.ulica_id = v.id
        AND (o.nr_drogi ILIKE $${par.length} OR bez_ogonkow(o.opis_odcinka) LIKE bez_ogonkow($${par.length}))))`);
  }
  if (f.kategoria) {
    par.push(f.kategoria);
    gdzie.push(`$${par.length} = ANY(v.kategorie)`);
  }
  if (f.miejscowosc) {
    par.push(f.miejscowosc);
    gdzie.push(`v.miejscowosc = $${par.length}`);
  }
  if (f.zarzadca) {
    par.push(f.zarzadca);
    gdzie.push(`$${par.length} = ANY(v.zarzadcy_kody)`);
  }
  if (f.slug) { par.push(f.slug); gdzie.push(`v.slug = $${par.length}`); }
  return { sql: gdzie.length ? `WHERE ${gdzie.join(' AND ')}` : '', par };
}

export async function ulice(f: FiltryUlic) {
  const { sql, par } = warunki(f);
  const limit = Number.isFinite(f.limit) ? Math.max(1, Math.min(Math.trunc(f.limit!), 2000)) : 200;
  const offset = Number.isFinite(f.offset) ? Math.max(0, Math.trunc(f.offset!)) : 0;
  const sort=sortowanie(f.sort,f.kierunek);
  const kolumny={
    nazwa:'lower(v.nazwa_pelna)',miejscowosc:'lower(v.miejscowosc)',
    kategoria:"array_to_string(v.kategorie, ',')",zarzadca:"array_to_string(v.zarzadcy, ',')",
    numer:"substring(array_to_string(v.numery_drog, ',') from '[0-9]+')::numeric",
    zrodlo:"array_to_string(v.zrodla, ',')",dlugosc:'v.dlugosc_m',
  };
  return zapytaj<Omit<WierszUlicy, 'slug' | 'simc' | 'sym_ul' | 'cecha' | 'miejscowosc'> & { slug:string | null; simc:string | null; sym_ul:string | null; cecha:string | null; miejscowosc:string | null }>(
    `${wspolnaLista} SELECT v.* FROM v
       ${sql}
      ORDER BY ${kolumny[sort.sort]} ${sort.kierunek} NULLS LAST, v.miejscowosc, v.nazwa, v.id
      LIMIT ${limit} OFFSET ${offset}`,
    par
  );
}

export async function policzUlice(f: FiltryUlic) {
  const { sql, par } = warunki(f);
  const [r] = await zapytaj<{ ile: string }>(
    `${wspolnaLista} SELECT COUNT(*) AS ile FROM v ${sql}`,
    par
  );
  return Number(r?.ile ?? 0);
}

export async function opcjeFiltrow(f: FiltryUlic) {
  const facet = async (pole: 'miejscowosc' | 'kategoria' | 'zarzadca') => {
    const {sql,par} = warunki({...f,[pole]:undefined,slug:undefined});
    const wartosc = pole==='miejscowosc' ? 'v.miejscowosc' : `unnest(v.${pole==='kategoria' ? 'kategorie' : 'zarzadcy_kody'})`;
    return zapytaj<{wartosc:string;ile:string}>(`${wspolnaLista}, wybrane AS (
      SELECT ${wartosc} AS wartosc FROM v ${sql})
      SELECT wartosc,COUNT(*) AS ile FROM wybrane WHERE wartosc IS NOT NULL
      GROUP BY wartosc ORDER BY wartosc`,par);
  };
  const [miejscowosci,kategorie,kody] = await Promise.all([facet('miejscowosc'),facet('kategoria'),facet('zarzadca')]);
  const zarzadcy = await zapytaj<{kod:string;nazwa:string}>('SELECT kod,nazwa FROM zarzadca');
  return {miejscowosci,kategorie,zarzadcy:kody.map(k=>({...k,nazwa:zarzadcy.find(z=>z.kod===k.wartosc)?.nazwa ?? k.wartosc}))};
}

export async function ulica(slug: string) {
  const [u] = await zapytaj<WierszUlicy>(
    `SELECT * FROM v_ulica_zarzadcy WHERE slug = $1`,
    [slug]
  );
  return u ?? null;
}

export async function odcinkiUlicy(ulicaId: number) {
  return zapytaj<Odcinek>(
    `SELECT o.id, o.kategoria::text AS kategoria, o.nr_drogi, o.klasa,
            o.dlugosc_m, o.nawierzchnia, o.zrodlo, o.pewnosc, o.uwagi,
            o.opis_odcinka, o.geom,
            z.nazwa AS zarzadca, z.kod AS zarzadca_kod, z.typ AS zarzadca_typ,
            z.jednostka, z.telefon, z.email, z.www, o.podstawa_prawna,
            zr.skrot AS zrodlo_skrot, zr.nazwa AS zrodlo_nazwa, zr.url AS zrodlo_url,
            u.nazwa AS utrzymujacy,
            d.przebieg,
            akt.numer AS akt_numer, akt.url_pdf AS akt_url_pdf
       FROM odcinek_drogi o
       LEFT JOIN zarzadca z ON z.id = o.zarzadca_id
       LEFT JOIN zarzadca u ON u.id = o.utrzymujacy_id
       LEFT JOIN droga d    ON d.id = o.droga_id
       LEFT JOIN zrodlo_danych zr ON zr.kod = o.zrodlo
       -- podstawa prawna jako klucz obcy, nie jako dopasowanie tekstu:
       -- zobacz db/migrations/0006_akt_odcinek.sql
       LEFT JOIN LATERAL (
         SELECT a.numer, a.url_pdf
           FROM akt_odcinek ao
           JOIN akt_prawny a ON a.id = ao.akt_id
          WHERE ao.odcinek_id = o.id AND ao.rola = 'zaliczenie do kategorii'
          ORDER BY a.data_podjecia DESC NULLS LAST
          LIMIT 1
       ) akt ON true
      WHERE o.ulica_id = $1
      ORDER BY o.kategoria, o.dlugosc_m DESC NULLS LAST`,
    [ulicaId]
  );
}

export async function miejscowosci() {
  return zapytaj<{ miejscowosc: string; ile: string }>(
    `SELECT miejscowosc, COUNT(*) AS ile
       FROM ulica GROUP BY miejscowosc ORDER BY miejscowosc`
  );
}

export async function statystyki() {
  const [ogol] = await zapytaj<{
    ulic: string; odcinkow: string; drog: string; km: string; bez_kategorii: string;
  }>(
    `SELECT (SELECT COUNT(*) FROM ulica)                                    AS ulic,
            (SELECT COUNT(*) FROM odcinek_drogi)                            AS odcinkow,
            (SELECT COUNT(*) FROM droga)                                    AS drog,
            (SELECT COALESCE(SUM(dlugosc_m), 0) FROM odcinek_drogi)         AS km,
            (SELECT COUNT(*) FROM v_ulica_zarzadcy WHERE liczba_odcinkow = 0) AS bez_kategorii`
  );
  const wgKategorii = await zapytaj<{
    kategoria: string; ulic: string; odcinkow: string; dlugosc_m: string | null;
  }>(
    `SELECT o.kategoria::text AS kategoria,
            COUNT(DISTINCT o.ulica_id) AS ulic,
            COUNT(*) AS odcinkow,
            SUM(o.dlugosc_m) AS dlugosc_m
       FROM odcinek_drogi o
      GROUP BY o.kategoria
      ORDER BY SUM(o.dlugosc_m) DESC NULLS LAST`
  );
  return { ogol, wgKategorii };
}

export async function zarzadcy() {
  return zapytaj<{
    id: number; kod: string; nazwa: string; typ: string; jednostka: string | null;
    adres: string | null; telefon: string | null; email: string | null;
    www: string | null; podstawa_prawna: string | null; uwagi: string | null;
    odcinkow: string; ulic: string; dlugosc_m: string | null;
  }>(
    `SELECT z.*,
            COUNT(o.id)                        AS odcinkow,
            COUNT(DISTINCT o.ulica_id)         AS ulic,
            SUM(o.dlugosc_m)                   AS dlugosc_m
       FROM zarzadca z
       LEFT JOIN odcinek_drogi o ON o.zarzadca_id = z.id
      GROUP BY z.id
      ORDER BY SUM(o.dlugosc_m) DESC NULLS LAST, z.nazwa`
  );
}

export async function braki(limit = 10000) {
  return zapytaj<{
    id: number; slug: string; miejscowosc: string; nazwa_pelna: string;
    dlugosc_m: number | null; problem: string; waga: number;
  }>(
    `SELECT * FROM v_braki
      ORDER BY waga, dlugosc_m DESC NULLS LAST
      LIMIT ${limit}`
  );
}

export async function brakiPodsumowanie() {
  return zapytaj<{ problem: string; waga: number; ile: string; dlugosc_m: string | null }>(
    `SELECT problem, waga, COUNT(*) AS ile, SUM(dlugosc_m) AS dlugosc_m
       FROM v_braki GROUP BY problem, waga ORDER BY waga`
  );
}

export async function drogi() {
  return zapytaj<{
    id: number; numer: string; kategoria: string; klasa: string | null;
    przebieg: string | null; dlugosc_gmina_m: number | null;
    zarzadca: string | null; pewnosc: number; uwagi: string | null; ulic: string;
    zrodlo_nazwa: string | null; zrodlo_url: string | null;
    podstawa_prawna: string | null; ma_geometrie: boolean;
    zrodla_odcinkow: { kod: string; nazwa: string; url: string | null }[];
    dokumenty: { id: number; numer: string; tytul: string; url: string | null; url_pdf: string | null; rola: string; zakres: string }[];
  }>(
    `SELECT d.id, d.numer, d.kategoria::text AS kategoria, d.klasa, d.przebieg,
            d.dlugosc_gmina_m, d.pewnosc, d.uwagi, z.nazwa AS zarzadca,
            COUNT(DISTINCT o.ulica_id) AS ulic,
            zr.nazwa AS zrodlo_nazwa, zr.url AS zrodlo_url, d.podstawa_prawna,
            COALESCE(BOOL_OR(o.geom_pg IS NOT NULL), false) AS ma_geometrie,
            (SELECT COALESCE(json_agg(s ORDER BY s.nazwa), '[]'::json) FROM (
              SELECT DISTINCT zo.kod, zo.nazwa, zo.url
                FROM odcinek_drogi oo JOIN zrodlo_danych zo ON zo.kod = oo.zrodlo
               WHERE oo.droga_id = d.id
            ) s) AS zrodla_odcinkow,
            (SELECT COALESCE(json_agg(a ORDER BY a.numer, a.zakres, a.rola), '[]'::json) FROM (
              SELECT ap.id, ap.numer, ap.tytul, ap.url, ap.url_pdf, ad.rola, 'droga' AS zakres
                FROM akt_droga ad JOIN akt_prawny ap ON ap.id = ad.akt_id
               WHERE ad.droga_id = d.id
              UNION
              SELECT ap.id, ap.numer, ap.tytul, ap.url, ap.url_pdf, ao.rola, 'odcinek drogi' AS zakres
                FROM akt_odcinek ao JOIN akt_prawny ap ON ap.id = ao.akt_id
                JOIN odcinek_drogi oo ON oo.id = ao.odcinek_id
               WHERE oo.droga_id = d.id
            ) a) AS dokumenty
       FROM droga d
       LEFT JOIN zarzadca z      ON z.id = d.zarzadca_id
       LEFT JOIN odcinek_drogi o ON o.droga_id = d.id
       LEFT JOIN zrodlo_danych zr ON zr.kod = d.zrodlo
      GROUP BY d.id, z.nazwa, zr.nazwa, zr.url
      ORDER BY d.kategoria, LENGTH(d.numer), d.numer`
  );
}

export type AktPrawny = {
  id: number;
  organ: string;
  rodzaj: string;
  numer: string;
  data_podjecia: string | null;
  tytul: string;
  dziennik_rok: number | null;
  dziennik_pozycja: number | null;
  status: string;
  url: string | null;
  url_pdf: string | null;
  uwagi: string | null;
  powiazanych_ulic: number;
  powiazanych_drog: number;
};

export async function akty(q?: string) {
  const par: unknown[] = [];
  let gdzie = '';
  if (q) {
    par.push(`%${q}%`);
    gdzie = `WHERE bez_ogonkow(tytul) LIKE bez_ogonkow($1)
                OR bez_ogonkow(numer) LIKE bez_ogonkow($1)`;
  }
  return zapytaj<AktPrawny>(
    `SELECT id, organ, rodzaj, numer,
            to_char(data_podjecia, 'YYYY-MM-DD')   AS data_podjecia,
            tytul, dziennik_rok, dziennik_pozycja,
            to_char(data_ogloszenia, 'YYYY-MM-DD') AS data_ogloszenia,
            to_char(data_wejscia, 'YYYY-MM-DD')    AS data_wejscia,
            status, url, url_pdf, uwagi,
            powiazanych_ulic, powiazanych_drog
       FROM v_akty ${gdzie}
      ORDER BY data_podjecia DESC NULLS LAST, numer DESC
      LIMIT 500`,
    par
  );
}

export async function aktyUlicy(ulicaId: number) {
  return zapytaj<AktPrawny & { rola: string }>(
    `SELECT a.id, organ, rodzaj, numer,
            to_char(a.data_podjecia, 'YYYY-MM-DD')   AS data_podjecia,
            tytul, dziennik_rok, dziennik_pozycja,
            to_char(data_ogloszenia, 'YYYY-MM-DD') AS data_ogloszenia,
            to_char(data_wejscia, 'YYYY-MM-DD')    AS data_wejscia,
            status, url, url_pdf, a.uwagi,
            powiazanych_ulic, powiazanych_drog, au.rola
       FROM akt_ulica au
       JOIN v_akty a ON a.id = au.akt_id
      WHERE au.ulica_id = $1
      ORDER BY a.data_podjecia DESC NULLS LAST`,
    [ulicaId]
  );
}

export async function zrodla() {
  return zapytaj<Zrodlo>(
    `SELECT kod, skrot, nazwa, gestor, url, licencja, domyslna_pewnosc, opis
       FROM zrodlo_danych ORDER BY domyslna_pewnosc DESC, nazwa`
  );
}
