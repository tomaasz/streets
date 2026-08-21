#!/usr/bin/env node
/**
 * Wczytuje pliki XLSX wyeksportowane z Dziennika Urzędowego Województwa
 * Mazowieckiego i zamienia je na wsad do bazy.
 *
 * Serwis blokuje maszyny w centrach danych, ale ma własny eksport listy
 * aktów — zielona ikona arkusza nad tabelą na stronie wydawcy. To jest
 * droga sankcjonowana przez sam serwis, a przy okazji odporniejsza od
 * scrapowania: zmiana układu strony jej nie psuje.
 *
 * Sposób użycia:
 *   1. Na stronie każdego wydawcy (edziennik.mazowieckie.pl/publisher/<id>)
 *      kliknij zieloną ikonę arkusza i zapisz plik.
 *   2. Wrzuć pliki do katalogu data/edziennik/
 *   3. npm run data:edziennik-xlsx
 *
 * Wynik: data/raw/akty-edziennik.json
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { czytajXlsx, dataZSeriala } from './lib/xlsx.mjs';

const KATALOG = new URL('../data/edziennik/', import.meta.url);
const OUT = new URL('../data/raw/akty-edziennik.json', import.meta.url);

// Interesują nas akty o drogach, ulicach i nazewnictwie. Odmiana musi być
// w tym wzorcu widoczna wprost: „drodze” nie zawiera „drog”, a „dróg” ma
// ogonek w środku. Uchwały „w sprawie nadania nazwy drodze wewnętrznej” to
// większość tego, co gmina publikuje w dzienniku, i wcześniej przepadały.
// Ten sam wzorzec siedzi w scripts/lib/akty.mjs i w edziennik-samodzielny.mjs.
const TEMAT = /(dr[oó]g|drodz|ulic|rond|skwer|\bplac\w*)/i;

// Tytuł w eksporcie e-dziennika nazywa organ w dopełniaczu („Uchwała …
// Rady Miejskiej w Wyszkowie”), a BIP w mianowniku („Rada Miejska”). Bez
// wzorców odpornych na odmianę ten sam akt wchodzi do bazy dwa razy —
// klucz to (rodzaj, numer, organ).
const KANON = [
  [/burmistrz\w*/i, 'Burmistrz Wyszkowa'],
  [/rad\w*\s+miejsk\w*/i, 'Rada Miejska w Wyszkowie'],
  [/rad\w*\s+powiatu/i, 'Rada Powiatu Wyszkowskiego'],
  [/zarząd\w*\s+powiatu/i, 'Zarząd Powiatu Wyszkowskiego'],
  [/starost\w*/i, 'Starosta Wyszkowski'],
  [/komisj\w*\s+bezpieczeństwa/i, 'Komisja Bezpieczeństwa i Porządku Publicznego w Wyszkowie'],
];
const kanonicznyOrgan = (n) => KANON.find(([w]) => w.test(n ?? ''))?.[1] ?? (n || null);

const RODZAJE = {
  uchwała: 'uchwała',
  uchwala: 'uchwała',
  zarządzenie: 'zarządzenie',
  zarzadzenie: 'zarządzenie',
  rozporządzenie: 'rozporządzenie',
  obwieszczenie: 'obwieszczenie',
};

const bezOgonkow = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim();

/** Data z komórki: serial Excela, 02.02.2026, 2026-02-02 albo słownie. */
const MIESIACE = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12,
};

function data(kom) {
  const s = String(kom ?? '').trim();
  if (!s) return null;
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return dataZSeriala(s);
  let m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(s);
  if (m && MIESIACE[m[2].toLowerCase()]) {
    return `${m[3]}-${String(MIESIACE[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** Nagłówek to wiersz, w którym są jednocześnie „pozycja” i „tytuł”. */
function znajdzNaglowek(wiersze) {
  for (let i = 0; i < Math.min(wiersze.length, 20); i++) {
    const w = wiersze[i].map(bezOgonkow);
    if (w.some((c) => c.includes('pozycja')) && w.some((c) => c.includes('tytul'))) {
      return i;
    }
  }
  return -1;
}

/**
 * W eksporcie cała pozycja bywa w jednej komórce:
 *   „Uchwała nr XII/118/2019 Rada Miejska w Wyszkowie z dnia 26 września
 *    2019 r. w sprawie zaliczenia drogi do kategorii dróg gminnych”
 * Rozbijamy ją na części; gdy kolumny są osobne, ta funkcja po prostu
 * nic nie znajduje i zostają wartości z kolumn.
 */
function rozbijTytul(tekst) {
  const m =
    /^\s*(Uchwał[ay]|Zarządzeni[ae]|Rozporządzeni[ae]|Obwieszczeni[ae])\s*(?:nr\s*)?([\w/.-]+)\s+(.*?)\s*z\s+dnia?\s+[^.]{5,40}?\s*r\.?\s*(w\s+sprawie\s+[\s\S]+)$/i.exec(
      tekst
    );
  if (!m) return null;
  return { rodzaj: m[1], numer: m[2], organ: m[3].trim() || null, tytul: m[4].trim() };
}

const znajdzKolumne = (naglowek, ...frazy) =>
  naglowek.findIndex((c) => frazy.some((f) => bezOgonkow(c).includes(f)));

function zPliku(nazwa, wiersze) {
  const i = znajdzNaglowek(wiersze);
  if (i < 0) {
    process.stderr.write(
      `  ! ${nazwa}: nie znalazłem wiersza nagłówka. Pierwszy wiersz: ` +
        `${JSON.stringify(wiersze[0]?.slice(0, 8))}\n`
    );
    return { naglowek: null, akty: [], wszystkich: 0 };
  }
  const naglowek = wiersze[i];
  const kol = {
    pozycja: znajdzKolumne(naglowek, 'pozycja'),
    dataAktu: znajdzKolumne(naglowek, 'data aktu', 'data podjecia'),
    dataPubl: znajdzKolumne(naglowek, 'data publikacji', 'data ogloszenia'),
    tytul: znajdzKolumne(naglowek, 'tytul'),
    organ: znajdzKolumne(naglowek, 'organ', 'wydawca', 'podmiot'),
    rodzaj: znajdzKolumne(naglowek, 'rodzaj', 'typ'),
    numer: znajdzKolumne(naglowek, 'numer', 'nr aktu'),
  };

  const akty = [];
  let wszystkich = 0;
  for (const w of wiersze.slice(i + 1)) {
    const tytul = (w[kol.tytul] ?? '').replace(/\s+/g, ' ').trim();
    if (!tytul) continue;
    wszystkich++;
    if (!TEMAT.test(tytul)) continue;

    // Rodzaj, numer i organ bywają w osobnych kolumnach albo w jednej
    // komórce razem z tytułem.
    const rozbite = rozbijTytul(tytul);
    const zapas =
      /(Uchwał[ay]|Zarządzeni[ae]|Rozporządzeni[ae]|Obwieszczeni[ae])\s*(?:nr\s*)?([\w/.-]+)/i.exec(
        `${w[kol.rodzaj] ?? ''} ${w[kol.numer] ?? ''} ${tytul}`
      );
    const rodzajSurowy = (
      w[kol.rodzaj] || rozbite?.rodzaj || zapas?.[1] || 'uchwała'
    ).trim();
    const rodzaj =
      RODZAJE[bezOgonkow(rodzajSurowy).replace(/[ae]$/, 'e')] ??
      RODZAJE[bezOgonkow(rodzajSurowy)] ??
      'uchwała';
    const numer = (w[kol.numer] || rozbite?.numer || zapas?.[2] || '')
      .replace(/^nr\s*/i, '')
      .trim();
    if (!numer) continue;
    const organSurowy = w[kol.organ] || rozbite?.organ || null;
    const tytulCzysty = rozbite?.tytul ?? tytul;

    const dataPubl = data(w[kol.dataPubl]);
    akty.push({
      organ: kanonicznyOrgan(organSurowy) ?? 'nieustalony',
      organ_zrodlowy: organSurowy,
      rodzaj,
      numer,
      data_podjecia: data(w[kol.dataAktu]),
      tytul: /^w sprawie/i.test(tytulCzysty)
        ? tytulCzysty
        : `w sprawie ${tytulCzysty}`,
      dziennik_rok: dataPubl ? Number(dataPubl.slice(0, 4)) : null,
      dziennik_pozycja: Number(w[kol.pozycja]) || null,
      data_ogloszenia: dataPubl,
      plik: nazwa,
    });
  }
  return { naglowek, akty, wszystkich };
}

async function main() {
  let pliki;
  try {
    pliki = (await readdir(KATALOG)).filter((f) => /\.xlsx$/i.test(f)).sort();
  } catch {
    pliki = [];
  }
  if (!pliki.length) {
    console.error(
      `Brak plików .xlsx w ${KATALOG.pathname}\n\n` +
        'Wejdź na edziennik.mazowieckie.pl/publisher/<id> dla każdego wydawcy,\n' +
        'kliknij zieloną ikonę arkusza nad tabelą i zapisz plik do tego katalogu.\n' +
        'Identyfikatory wydawców dla Wyszkowa:\n' +
        '  1453, 1222, 282, 163, 760, 448, 468, 246, 1018, 1121'
    );
    process.exit(2);
  }

  const wszystkie = new Map();
  let przejrzanych = 0;
  for (const p of pliki) {
    const wiersze = czytajXlsx(await readFile(new URL(p, KATALOG)));
    const { naglowek, akty, wszystkich } = zPliku(p, wiersze);
    przejrzanych += wszystkich;
    for (const a of akty) wszystkie.set(`${a.rodzaj}|${a.numer}|${a.organ}`, a);
    process.stderr.write(
      `  ${p}: ${wszystkich} aktów, drogowych ${akty.length}` +
        (naglowek ? ` (kolumny: ${naglowek.filter(Boolean).join(' | ')})` : '') +
        '\n'
    );
  }

  const lista = [...wszystkie.values()].sort((a, b) =>
    (b.data_podjecia ?? '').localeCompare(a.data_podjecia ?? '')
  );

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        zrodlo: 'Dziennik Urzędowy Województwa Mazowieckiego — eksport XLSX',
        pobrano: new Date().toISOString().slice(0, 10),
        plikow: pliki.length,
        aktow_przejrzanych: przejrzanych,
        liczba_aktow: lista.length,
        akty: lista,
      },
      null,
      1
    ) + '\n'
  );
  process.stderr.write(
    `\nZ ${przejrzanych} aktów wybrano ${lista.length} drogowych -> ${OUT.pathname}\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
