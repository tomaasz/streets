import pg from 'pg';

/**
 * Integracje na Vercelu wstrzykują connection string pod różnymi nazwami:
 * Neon daje DATABASE_URL, Supabase POSTGRES_URL, część providerów jedno
 * i drugie. Zamiast zmuszać do ręcznego aliasu, sprawdzamy po kolei.
 */
export const NAZWY_ZMIENNYCH = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
];

export function connectionString() {
  for (const n of NAZWY_ZMIENNYCH) {
    const v = process.env[n];
    if (v) return v;
  }
  return null;
}

/**
 * Schemat, w którym trzymamy tabele. Domyślnie `public`, ale gdy baza jest
 * współdzielona z inną aplikacją, wystarczy ustawić DB_SCHEMA=drogi i nic
 * się nie zderzy.
 */
export const schemat = () => process.env.DB_SCHEMA || 'public';

const BEZPIECZNA_NAZWA = /^[a-z_][a-z0-9_]*$/;

export function sprawdzSchemat(nazwa = schemat()) {
  if (!BEZPIECZNA_NAZWA.test(nazwa)) {
    throw new Error(
      `DB_SCHEMA="${nazwa}" — dozwolone są małe litery, cyfry i podkreślenie.`
    );
  }
  return nazwa;
}

export function polaczenie() {
  const cs = connectionString();
  if (!cs) {
    throw new Error(
      'Brak connection stringa. Ustaw DATABASE_URL (albo POSTGRES_URL) — ' +
        'skopiuj .env.example do .env i wpisz dane z panelu bazy.'
    );
  }
  return new pg.Client({
    connectionString: cs,
    ssl: cs.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  });
}

/** Klient z ustawionym search_path na docelowy schemat. */
export async function polaczenieZeSchematem() {
  const nazwa = sprawdzSchemat();
  const klient = polaczenie();
  await klient.connect();
  await klient.query(`SET search_path TO "${nazwa}", public`);
  return { klient, nazwa };
}

/** Minimalny parser CSV — obsługuje cudzysłowy i przecinki w polach. */
export function czytajCsv(tekst) {
  const wiersze = [];
  let pole = '';
  let wiersz = [];
  let wCudzyslowie = false;
  for (let i = 0; i < tekst.length; i++) {
    const z = tekst[i];
    if (wCudzyslowie) {
      if (z === '"' && tekst[i + 1] === '"') { pole += '"'; i++; }
      else if (z === '"') wCudzyslowie = false;
      else pole += z;
    } else if (z === '"') wCudzyslowie = true;
    else if (z === ',') { wiersz.push(pole); pole = ''; }
    else if (z === '\n') { wiersz.push(pole); wiersze.push(wiersz); wiersz = []; pole = ''; }
    else if (z !== '\r') pole += z;
  }
  if (pole || wiersz.length) { wiersz.push(pole); wiersze.push(wiersz); }
  const [naglowek, ...reszta] = wiersze.filter((w) => w.some((c) => c !== ''));
  return reszta.map((w) =>
    Object.fromEntries(naglowek.map((k, i) => [k, w[i] === '' ? null : w[i]]))
  );
}
