import pg from 'pg';

export function polaczenie() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Brak DATABASE_URL. Skopiuj .env.example do .env i wpisz connection string z Neona.'
    );
  }
  return new pg.Client({
    connectionString,
    ssl: connectionString.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });
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
