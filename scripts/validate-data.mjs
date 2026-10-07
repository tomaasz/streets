#!/usr/bin/env node
/**
 * Skrypt weryfikacji integralności i schematu plików JSON w katalogu data/.
 *
 * Użycie:
 *   node scripts/validate-data.mjs
 *   node scripts/validate-data.mjs --all
 */
import { readFile } from 'node:fs/promises';
import {
  walidujPlikOdcinki,
  walidujPlikPrgUlice,
  walidujPlikBdotDrogi,
  walidujPlikAktyBip,
} from './lib/data-validator.mjs';

const sprawdzWszystko = process.argv.includes('--all');
const ODCINKI_PATH = new URL('../data/odcinki.json', import.meta.url);
const PRG_PATH = new URL('../data/raw/prg-ulice.json', import.meta.url);
const BDOT_PATH = new URL('../data/raw/bdot-drogi.json', import.meta.url);
const BIP_PATH = new URL('../data/raw/akty-bip.json', import.meta.url);

let maBledy = false;

async function sprawdzPlik(nazwa, sciezka, funkcjaWalidujaca) {
  process.stdout.write(`Walidacja: ${nazwa}... `);
  try {
    const tekst = await readFile(sciezka, 'utf8');
    const json = JSON.parse(tekst);
    const wynik = funkcjaWalidujaca(json);
    if (!wynik.poprawny) {
      process.stdout.write('❌ BŁĄD\n');
      console.error(`\nZnaleziono błędy w ${nazwa}:`);
      for (const b of wynik.bledy) {
        console.error(`  - ${b}`);
      }
      maBledy = true;
    } else {
      process.stdout.write('✅ OK\n');
    }
  } catch (err) {
    process.stdout.write('❌ BŁĄD ODCZYTU/PARSOWANIA\n');
    console.error(`  - ${err.message}`);
    maBledy = true;
  }
}

async function main() {
  console.log('=== Walidacja schematu i integralności danych JSON (data/) ===\n');
  await sprawdzPlik('data/odcinki.json', ODCINKI_PATH, walidujPlikOdcinki);

  if (sprawdzWszystko) {
    await sprawdzPlik('data/raw/prg-ulice.json', PRG_PATH, walidujPlikPrgUlice);
    await sprawdzPlik('data/raw/bdot-drogi.json', BDOT_PATH, walidujPlikBdotDrogi);
    await sprawdzPlik('data/raw/akty-bip.json', BIP_PATH, walidujPlikAktyBip);
  }

  console.log('');
  if (maBledy) {
    console.error('Walidacja danych zakończona niepowodzeniem.');
    process.exit(1);
  } else {
    console.log('Wszystkie sprawdzone pliki są w 100% zgodne ze schematem.');
  }
}

main();
