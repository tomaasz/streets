#!/usr/bin/env node
/**
 * Pobiera z uslug GUGiK szkielet bazy ulic gminy Wyszkow:
 *   1. ULDK  (uldk.gugik.gov.pl) -> lista obrebow ewidencyjnych = miejscowosci
 *   2. UUG   (services.gugik.gov.pl/uug) -> ulice z PRG: SIMC, SYM_UL, geometria
 *
 * UUG dopasowuje fragment nazwy (substring), minimum 2 znaki. Zeby uzyskac
 * komplet, przemiatamy dwuznaki postaci <dowolny znak><samogloska> - kazda
 * polska nazwa zawiera co najmniej jeden taki dwuznak. Zeby nie zalewac
 * uslugi, najpierw sondujemy miejscowosc krotka lista czestych dwuznakow
 * i pelny przemiat robimy tylko tam, gdzie w ogole sa ulice.
 *
 * Wynik: data/raw/prg-ulice.json
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { wktToGeoJson, wktLengthMeters } from './lib/pl1992.mjs';

const TERC_GMINA = process.env.TERC_GMINA ?? '143505';
const ULDK = 'https://uldk.gugik.gov.pl/';
const UUG = 'https://services.gugik.gov.pl/uug/';
const OUT = new URL('../data/raw/prg-ulice.json', import.meta.url);

const SAMOGLOSKI = [...'aeiouyąęó'];
const ZNAKI = [...'abcdefghijklmnopqrstuvwxyząćęłńóśźż'];
const SONDA = ['ow', 'ka', 'na', 'sk', 'ie', 'ic', 'an', 'ol', 'ar', 'ns', 'ki', 'sz', 'cz', 'rz', 'wa', 'le'];
const PELNY_PRZEMIAT = ZNAKI.flatMap((z) => SAMOGLOSKI.map((s) => z + s));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pobierz(url, { proby = 4 } = {}) {
  let ostatni;
  for (let i = 0; i < proby; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'gmina-wyszkow-drogi/1.0 (harvest PRG)' },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      ostatni = err;
      await sleep(1000 * 2 ** i);
    }
  }
  throw ostatni;
}

/** ULDK: obreby ewidencyjne gminy -> miejscowosci */
async function pobierzMiejscowosci() {
  const txt = await pobierz(
    `${ULDK}?request=GetRegionById&id=${TERC_GMINA}&result=teryt,region`
  );
  const linie = txt.split('\n').map((l) => l.trim()).filter(Boolean);
  if (linie[0] !== '0') throw new Error(`ULDK: ${linie[0]}`);
  return linie.slice(1).map((l) => {
    const [teryt, nazwa] = l.split('|');
    return { teryt_obrebu: teryt, nazwa };
  });
}

/** UUG: jedno zapytanie o ulice w miejscowosci */
async function szukajUlic(miejscowosc, fragment) {
  const q = new URLSearchParams({
    request: 'GetAddress',
    address: `${miejscowosc}, ${fragment}`,
  });
  const txt = await pobierz(`${UUG}?${q}`);
  let dane;
  try {
    dane = JSON.parse(txt);
  } catch {
    return [];
  }
  if (dane.type !== 'street' || !dane.results) return [];
  return Object.values(dane.results).filter(
    (r) => r.teryt === TERC_GMINA && r.ulic
  );
}

async function przemiat(miejscowosc, fragmenty, znalezione, etykieta) {
  let zapytania = 0;
  for (const f of fragmenty) {
    const wyniki = await szukajUlic(miejscowosc, f);
    zapytania++;
    for (const r of wyniki) {
      const klucz = `${r.simc}:${r.ulic}`;
      if (!znalezione.has(klucz)) {
        znalezione.set(klucz, {
          sym_ul: String(r.ulic).padStart(5, '0'),
          simc: String(r.simc).padStart(7, '0'),
          terc_gmina: r.teryt,
          miejscowosc: r.city,
          nazwa: r.street,
          x_2180: Number(r.x),
          y_2180: Number(r.y),
          dlugosc_m: wktLengthMeters(r.geometry_wkt),
          geom: wktToGeoJson(r.geometry_wkt),
        });
      }
    }
    await sleep(120);
  }
  process.stderr.write(
    `  ${etykieta}: ${zapytania} zapytan, lacznie ${znalezione.size} ulic\n`
  );
}

async function main() {
  process.stderr.write(`Gmina TERC ${TERC_GMINA}\n`);
  const miejscowosci = await pobierzMiejscowosci();
  process.stderr.write(`ULDK: ${miejscowosci.length} obrebow ewidencyjnych\n\n`);

  const znalezione = new Map();
  const raport = [];

  for (const m of miejscowosci) {
    process.stderr.write(`${m.nazwa} (${m.teryt_obrebu})\n`);
    const przed = znalezione.size;
    await przemiat(m.nazwa, SONDA, znalezione, 'sonda');
    const maUlice = znalezione.size > przed;
    if (maUlice) {
      await przemiat(m.nazwa, PELNY_PRZEMIAT, znalezione, 'pelny przemiat');
    }
    raport.push({
      ...m,
      ulic: znalezione.size - przed,
      przemiat: maUlice ? 'pelny' : 'sonda',
    });
  }

  const ulice = [...znalezione.values()].sort((a, b) =>
    a.miejscowosc === b.miejscowosc
      ? a.nazwa.localeCompare(b.nazwa, 'pl')
      : a.miejscowosc.localeCompare(b.miejscowosc, 'pl')
  );

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        zrodlo: 'GUGiK: ULDK + Usluga Uniwersalnego Wyszukiwania (PRG)',
        terc_gmina: TERC_GMINA,
        pobrano: new Date().toISOString().slice(0, 10),
        uklad_geom: 'EPSG:4326 (przeliczone z EPSG:2180)',
        liczba_ulic: ulice.length,
        obreby: raport,
        ulice,
      },
      null,
      0
    ) + '\n'
  );
  process.stderr.write(`\nZapisano ${ulice.length} ulic -> ${OUT.pathname}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
