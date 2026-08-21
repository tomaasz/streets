import { pula } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Przyjmuje akty prawne zebrane przez skrypt uruchomiony poza chmurą.
 *
 * Serwis e-dziennika odrzuca połączenia z centrów danych, więc pobranie musi
 * się odbyć z maszyny w urzędzie. Ta maszyna nie powinna jednak znać hasła do
 * bazy ani mieć zainstalowanego sterownika — wystarczy, że wyśle tu JSON.
 *
 * Uwierzytelnienie: nagłówek Authorization: Bearer <IMPORT_TOKEN>.
 * Bez ustawionego IMPORT_TOKEN endpoint jest wyłączony, żeby świeży
 * deployment nie stał otworem.
 */

const MAX_AKTOW = 5000;

type Akt = {
  organ?: string;
  rodzaj?: string;
  numer?: string;
  data_podjecia?: string | null;
  tytul?: string;
  dziennik_rok?: number | null;
  dziennik_pozycja?: number | null;
  data_ogloszenia?: string | null;
  url?: string | null;
  url_pdf?: string | null;
};

const RODZAJE = new Set(['uchwała', 'zarządzenie', 'rozporządzenie', 'obwieszczenie']);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const tekst = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const dataAlbo = (v: unknown) =>
  typeof v === 'string' && DATA.test(v) ? v : null;
const liczbaAlbo = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1_000_000 ? v : null;
const adresAlbo = (v: unknown) =>
  typeof v === 'string' && /^https?:\/\//.test(v) ? v.slice(0, 500) : null;

export async function POST(req: Request) {
  const oczekiwany = process.env.IMPORT_TOKEN;
  if (!oczekiwany) {
    return Response.json(
      { blad: 'Import wyłączony — ustaw zmienną IMPORT_TOKEN w projekcie.' },
      { status: 503 }
    );
  }
  const podany = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!podany || podany !== oczekiwany) {
    return Response.json({ blad: 'Zły token.' }, { status: 401 });
  }

  let dane: { akty?: unknown };
  try {
    dane = await req.json();
  } catch {
    return Response.json({ blad: 'Ciało żądania nie jest JSON-em.' }, { status: 400 });
  }
  if (!Array.isArray(dane.akty)) {
    return Response.json({ blad: 'Brak tablicy "akty".' }, { status: 400 });
  }
  if (dane.akty.length > MAX_AKTOW) {
    return Response.json(
      { blad: `Za dużo pozycji naraz (limit ${MAX_AKTOW}).` },
      { status: 413 }
    );
  }

  // Każde pole przechodzi przez własny walidator — do bazy nie trafia nic,
  // czego kształtu nie sprawdziliśmy.
  const czyste = (dane.akty as Akt[])
    .map((a) => ({
      organ: tekst(a.organ, 200) ?? 'nieustalony',
      rodzaj: RODZAJE.has(a.rodzaj ?? '') ? a.rodzaj : 'uchwała',
      numer: tekst(a.numer, 60),
      data_podjecia: dataAlbo(a.data_podjecia),
      tytul: tekst(a.tytul, 2000),
      dziennik_rok: liczbaAlbo(a.dziennik_rok),
      dziennik_pozycja: liczbaAlbo(a.dziennik_pozycja),
      data_ogloszenia: dataAlbo(a.data_ogloszenia),
      url: adresAlbo(a.url),
      url_pdf: adresAlbo(a.url_pdf),
    }))
    .filter((a) => a.numer && a.tytul);

  if (!czyste.length) {
    return Response.json(
      { blad: 'Żadna pozycja nie miała jednocześnie numeru i tytułu.' },
      { status: 400 }
    );
  }

  const klient = await pula().connect();
  try {
    await klient.query('BEGIN');
    const { rows } = await klient.query(
      `INSERT INTO akt_prawny (organ, rodzaj, numer, data_podjecia, tytul,
                               dziennik_rok, dziennik_pozycja, data_ogloszenia,
                               status, url, url_pdf, zrodlo)
       SELECT organ, rodzaj, numer, data_podjecia, tytul, dziennik_rok,
              dziennik_pozycja, data_ogloszenia, 'nieustalony', url, url_pdf,
              'uchwala'
         FROM json_to_recordset($1::json) AS x(
           organ text, rodzaj text, numer text, data_podjecia date, tytul text,
           dziennik_rok integer, dziennik_pozycja integer,
           data_ogloszenia date, url text, url_pdf text)
       ON CONFLICT (rodzaj, numer, organ) DO UPDATE SET
         data_podjecia = COALESCE(EXCLUDED.data_podjecia, akt_prawny.data_podjecia),
         tytul = EXCLUDED.tytul,
         dziennik_rok = COALESCE(EXCLUDED.dziennik_rok, akt_prawny.dziennik_rok),
         dziennik_pozycja = COALESCE(EXCLUDED.dziennik_pozycja, akt_prawny.dziennik_pozycja),
         data_ogloszenia = COALESCE(EXCLUDED.data_ogloszenia, akt_prawny.data_ogloszenia),
         url = COALESCE(EXCLUDED.url, akt_prawny.url),
         url_pdf = COALESCE(EXCLUDED.url_pdf, akt_prawny.url_pdf)
       RETURNING (xmax = 0) AS nowy`,
      [JSON.stringify(czyste)]
    );
    await klient.query('COMMIT');
    const nowych = rows.filter((r) => r.nowy).length;
    return Response.json({
      przyjeto: czyste.length,
      nowych,
      zaktualizowanych: rows.length - nowych,
    });
  } catch (e) {
    await klient.query('ROLLBACK');
    return Response.json(
      { blad: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  } finally {
    klient.release();
  }
}
