import { zapytaj } from './db';
import type { Odcinek, WierszUlicy, Zrodlo } from './typy';

export type FiltryUlic = {
  q?: string;
  kategoria?: string;
  miejscowosc?: string;
  zarzadca?: string;
  limit?: number;
  offset?: number;
};

function warunki(f: FiltryUlic) {
  const gdzie: string[] = [];
  const par: unknown[] = [];
  if (f.q) {
    par.push(`%${f.q}%`);
    gdzie.push(`bez_ogonkow(v.nazwa_pelna) LIKE bez_ogonkow($${par.length})`);
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
  return { sql: gdzie.length ? `WHERE ${gdzie.join(' AND ')}` : '', par };
}

export async function ulice(f: FiltryUlic) {
  const { sql, par } = warunki(f);
  const limit = Math.min(f.limit ?? 200, 2000);
  return zapytaj<WierszUlicy & { url_pdf?: string }>(
    `SELECT v.id, v.slug, v.simc, v.sym_ul, v.miejscowosc, v.cecha, v.nazwa,
            v.nazwa_pelna, v.dlugosc_m, v.kategorie, v.zarzadcy, v.zarzadcy_kody,
            v.numery_drog, v.zrodla, v.pewnosc_min, v.liczba_odcinkow,
            v.ma_luke, v.wielu_zarzadcow, u.x_2180, u.y_2180,
            (SELECT a.url_pdf FROM akt_ulica au JOIN akt_prawny a ON a.id = au.akt_id WHERE au.ulica_id = v.id AND a.url_pdf IS NOT NULL LIMIT 1) AS url_pdf
       FROM v_ulica_zarzadcy v
       JOIN ulica u ON u.id = v.id
       ${sql}
      ORDER BY v.miejscowosc, v.nazwa
      LIMIT ${limit} OFFSET ${Math.max(0, f.offset ?? 0)}`,
    par
  );
}

export async function policzUlice(f: FiltryUlic) {
  const { sql, par } = warunki(f);
  const [r] = await zapytaj<{ ile: string }>(
    `SELECT COUNT(*) AS ile FROM v_ulica_zarzadcy v ${sql}`,
    par
  );
  return Number(r?.ile ?? 0);
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
            z.jednostka, z.telefon, z.email, z.www, z.podstawa_prawna,
            zr.skrot AS zrodlo_skrot, zr.nazwa AS zrodlo_nazwa, zr.url AS zrodlo_url,
            u.nazwa AS utrzymujacy,
            d.przebieg
       FROM odcinek_drogi o
       LEFT JOIN zarzadca z ON z.id = o.zarzadca_id
       LEFT JOIN zarzadca u ON u.id = o.utrzymujacy_id
       LEFT JOIN droga d    ON d.id = o.droga_id
       LEFT JOIN zrodlo_danych zr ON zr.kod = o.zrodlo
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

export async function braki(limit = 300) {
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
  }>(
    `SELECT d.id, d.numer, d.kategoria::text AS kategoria, d.klasa, d.przebieg,
            d.dlugosc_gmina_m, d.pewnosc, d.uwagi, z.nazwa AS zarzadca,
            COUNT(DISTINCT o.ulica_id) AS ulic
       FROM droga d
       LEFT JOIN zarzadca z      ON z.id = d.zarzadca_id
       LEFT JOIN odcinek_drogi o ON o.droga_id = d.id
      GROUP BY d.id, z.nazwa
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
