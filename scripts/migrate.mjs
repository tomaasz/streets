#!/usr/bin/env node
/**
 * Uruchamia migracje z db/migrations w kolejności nazw.
 * --reset      wyczyść schemat public przed migracją
 * --postgis    dołóż migrację 0003 (wymaga rozszerzenia PostGIS)
 */
import { readdir, readFile } from 'node:fs/promises';
import { polaczenie } from './lib/db.mjs';

const KATALOG = new URL('../db/migrations/', import.meta.url);
const reset = process.argv.includes('--reset');
const zPostgis = process.argv.includes('--postgis');

const klient = polaczenie();
await klient.connect();

if (reset) {
  process.stderr.write('DROP SCHEMA public CASCADE\n');
  await klient.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

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
