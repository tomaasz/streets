#!/usr/bin/env node
/**
 * Uruchamia migracje z db/migrations w kolejności nazw.
 *
 *   --reset     wyczyść schemat docelowy przed migracją
 *   --postgis   dołóż migrację 0003 (wymaga rozszerzenia PostGIS)
 *   --force     pozwól na --reset schematu `public`
 *
 * Schemat bierze się z DB_SCHEMA (domyślnie `public`). Gdy bazę dzielisz
 * z inną aplikacją, ustaw np. DB_SCHEMA=drogi — wtedy nic się nie zderzy,
 * a --reset kasuje wyłącznie nasze tabele.
 */
import { readdir, readFile } from 'node:fs/promises';
import { polaczenie, sprawdzSchemat } from './lib/db.mjs';

const KATALOG = new URL('../db/migrations/', import.meta.url);
const reset = process.argv.includes('--reset');
const zPostgis = process.argv.includes('--postgis');
const force = process.argv.includes('--force');

const nazwa = sprawdzSchemat();
const klient = polaczenie();
await klient.connect();

if (reset) {
  if (nazwa === 'public' && !force) {
    console.error(
      'Odmawiam skasowania schematu `public` — w bazie współdzielonej ' +
        'zabrałoby to cudze tabele.\n' +
        'Albo ustaw DB_SCHEMA na własny schemat, albo dopisz --force, ' +
        'jeśli baza na pewno jest tylko do tego projektu.'
    );
    await klient.end();
    process.exit(1);
  }
  process.stderr.write(`DROP SCHEMA "${nazwa}" CASCADE\n`);
  await klient.query(`DROP SCHEMA IF EXISTS "${nazwa}" CASCADE`);
}

await klient.query(`CREATE SCHEMA IF NOT EXISTS "${nazwa}"`);
await klient.query(`SET search_path TO "${nazwa}", public`);
process.stderr.write(`Schemat: ${nazwa}\n`);

const pliki = (await readdir(KATALOG))
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => zPostgis || !f.includes('postgis'))
  .sort();

for (const plik of pliki) {
  process.stderr.write(`-> ${plik}\n`);
  await klient.query(await readFile(new URL(plik, KATALOG), 'utf8'));
}

await klient.end();
process.stderr.write(`Gotowe: ${pliki.length} migracji.\n`);
