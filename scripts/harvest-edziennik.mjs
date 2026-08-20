#!/usr/bin/env node
/**
 * Pobiera akty prawa miejscowego gminy i powiatu z Dziennika Urzędowego
 * Województwa Mazowieckiego.
 *
 * UWAGA: edziennik.mazowieckie.pl blokuje adresy centrów danych — zwraca
 * 403 „Dostęp zablokowany”. Ten skrypt trzeba więc uruchomić z sieci,
 * która nie jest blokowana, czyli zwykle z komputera w urzędzie:
 *
 *     npm run data:edziennik -- --rozpoznanie     # co serwis w ogóle zwraca
 *     npm run data:edziennik                      # właściwe pobranie
 *
 * Tryb --rozpoznanie nie parsuje niczego. Odpytuje kilka spodziewanych
 * adresów i wypisuje, co dostał: kod odpowiedzi, typ treści i początek
 * odpowiedzi. To wystarczy, żeby dopisać parser pasujący do faktycznego
 * układu serwisu, zamiast zgadywać go na ślepo.
 *
 * Wynik właściwego przebiegu: data/raw/akty-edziennik.json
 */
import { writeFile, mkdir } from 'node:fs/promises';

const BAZA = process.env.EDZIENNIK ?? 'https://edziennik.mazowieckie.pl';
const OUT = new URL('../data/raw/akty-edziennik.json', import.meta.url);
const rozpoznanie = process.argv.includes('--rozpoznanie');

// Organy, których akty nas interesują.
const ORGANY = [
  'Rada Miejska w Wyszkowie',
  'Burmistrz Wyszkowa',
  'Rada Powiatu w Wyszkowie',
  'Zarząd Powiatu Wyszkowskiego',
];

const FRAZY = [
  'zaliczenia do kategorii dróg gminnych',
  'pozbawienia kategorii drogi gminnej',
  'ustalenia przebiegu dróg gminnych',
  'nadania nazwy ulicy',
  'zaliczenia do kategorii dróg powiatowych',
];

// Adresy, które w serwisach e-dziennika bywają punktem wejścia. Sprawdzamy
// je po kolei, bo różne województwa działają na różnych wersjach systemu.
const KANDYDACI = [
  '/',
  '/api/search',
  '/api/legalacts',
  '/api/acts',
  '/actbytype',
  '/WDU',
  '/robots.txt',
  '/sitemap.xml',
];

async function sprobuj(sciezka) {
  const url = BAZA + sciezka;
  try {
    const res = await fetch(url, {
      headers: {
        // Bez tego część serwisów odrzuca żądanie jako botowe. To nie jest
        // obejście blokady — jeśli serwis blokuje, i tak dostaniemy 403.
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'pl-PL,pl;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    const typ = res.headers.get('content-type') ?? '?';
    const tekst = (await res.text()).slice(0, 400).replace(/\s+/g, ' ');
    return { url, status: res.status, typ, poczatek: tekst };
  } catch (e) {
    return { url, status: 0, typ: '-', poczatek: `BŁĄD: ${e.message}` };
  }
}

async function main() {
  if (rozpoznanie) {
    process.stderr.write(`Rozpoznanie serwisu ${BAZA}\n\n`);
    for (const s of KANDYDACI) {
      const r = await sprobuj(s);
      console.log(`--- ${r.url}`);
      console.log(`    HTTP ${r.status}  ${r.typ}`);
      console.log(`    ${r.poczatek.slice(0, 300)}\n`);
    }
    console.log(
      'Wklej powyższe wyjście do rozmowy — na jego podstawie dopiszę parser\n' +
        'dopasowany do faktycznego układu serwisu.'
    );
    return;
  }

  const proba = await sprobuj('/');
  if (proba.status === 403 || proba.status === 0) {
    console.error(
      `Serwis odpowiedział ${proba.status || 'błędem sieci'} — najpewniej blokuje\n` +
        'ten adres IP. Uruchom skrypt z sieci urzędu albo domowej.\n' +
        `Odpowiedź: ${proba.poczatek.slice(0, 200)}`
    );
    process.exit(2);
  }

  console.error(
    'Parser właściwego pobierania nie jest jeszcze dopasowany do tego serwisu.\n' +
      'Uruchom najpierw: npm run data:edziennik -- --rozpoznanie\n' +
      'i przekaż wynik — dopiszę parsowanie wyników wyszukiwania.\n\n' +
      `Organy do objęcia: ${ORGANY.join(', ')}\n` +
      `Frazy: ${FRAZY.join('; ')}`
  );

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { zrodlo: BAZA, pobrano: new Date().toISOString().slice(0, 10),
        organy: ORGANY, frazy: FRAZY, akty: [] },
      null, 1
    ) + '\n'
  );
  process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
