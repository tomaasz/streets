/**
 * Zapis aktów prawnych do bazy — używany zarówno przez pełny wsad, jak
 * i przez automatyczne pobieranie z e-dziennika uruchamiane z harmonogramu.
 */
import { polaczenieZeSchematem } from './db.mjs';

const SQL = `
  INSERT INTO akt_prawny (organ, rodzaj, numer, data_podjecia, tytul,
                          dziennik_rok, dziennik_pozycja, data_ogloszenia,
                          data_wejscia, status, url, url_pdf, zrodlo, uwagi)
  SELECT organ, rodzaj, numer, data_podjecia, tytul, dziennik_rok,
         dziennik_pozycja, data_ogloszenia, data_wejscia, status,
         url, url_pdf, zrodlo, uwagi
    FROM json_to_recordset($1::json) AS x(
      organ text, rodzaj text, numer text, data_podjecia date, tytul text,
      dziennik_rok integer, dziennik_pozycja integer, data_ogloszenia date,
      data_wejscia date, status text, url text, url_pdf text,
      zrodlo text, uwagi text)
  ON CONFLICT (rodzaj, numer, organ) DO UPDATE SET
    data_podjecia = COALESCE(EXCLUDED.data_podjecia, akt_prawny.data_podjecia),
    tytul = EXCLUDED.tytul,
    dziennik_rok = COALESCE(EXCLUDED.dziennik_rok, akt_prawny.dziennik_rok),
    dziennik_pozycja = COALESCE(EXCLUDED.dziennik_pozycja, akt_prawny.dziennik_pozycja),
    data_ogloszenia = COALESCE(EXCLUDED.data_ogloszenia, akt_prawny.data_ogloszenia),
    data_wejscia = COALESCE(EXCLUDED.data_wejscia, akt_prawny.data_wejscia),
    url = COALESCE(EXCLUDED.url, akt_prawny.url),
    url_pdf = COALESCE(EXCLUDED.url_pdf, akt_prawny.url_pdf),
    zrodlo = EXCLUDED.zrodlo,
    uwagi = COALESCE(EXCLUDED.uwagi, akt_prawny.uwagi)`;

/** Uzupełnia brakujące pola i wysyła paczkami. */
export async function zapiszAkty(klient, akty, rozmiar = 300) {
  const pelne = akty.map((a) => ({
    organ: a.organ ?? 'nieustalony',
    rodzaj: a.rodzaj ?? 'uchwała',
    numer: a.numer,
    data_podjecia: a.data_podjecia ?? null,
    tytul: a.tytul,
    dziennik_rok: a.dziennik_rok ?? null,
    dziennik_pozycja: a.dziennik_pozycja ?? null,
    data_ogloszenia: a.data_ogloszenia ?? null,
    data_wejscia: a.data_wejscia ?? null,
    status: a.status ?? 'nieustalony',
    url: a.url ?? null,
    url_pdf: a.url_pdf ?? null,
    zrodlo: a.zrodlo ?? 'uchwala',
    uwagi: a.uwagi ?? null,
  }));
  for (let i = 0; i < pelne.length; i += rozmiar) {
    await klient.query(SQL, [JSON.stringify(pelne.slice(i, i + rozmiar))]);
  }
  return pelne.length;
}

/** Wariant samodzielny: otwiera połączenie, zapisuje, zamyka. */
export async function seedAkty(akty) {
  const { klient } = await polaczenieZeSchematem();
  try {
    await klient.query('BEGIN');
    const ile = await zapiszAkty(klient, akty);
    await klient.query('COMMIT');
    return ile;
  } catch (e) {
    await klient.query('ROLLBACK');
    throw e;
  } finally {
    await klient.end();
  }
}
