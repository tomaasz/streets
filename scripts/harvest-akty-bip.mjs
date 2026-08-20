#!/usr/bin/env node
/**
 * Zbiera z BIP Gminy Wyszków uchwały Rady Miejskiej dotyczące dróg i ulic.
 *
 * BIP nie ma API, ale ma wyszukiwarkę (POST index.php, cmd=szukaj&opt=wykaz)
 * i przewidywalny układ stron sesji: każda pozycja to zdanie postaci
 *   „Uchwała nr XLV/7/2006 Rady Miejskiej w Wyszkowie z dn. 16 lutego 2006 r.
 *    w sprawie ...”
 * plus odnośnik do PDF-a o treści „Uchwała nr XLV/7/2006”.
 *
 * Szukamy po frazach tematycznych, a nie po całym archiwum — wyszukiwarka
 * indeksuje treść stron sesji, więc to wystarcza, żeby trafić w uchwały
 * drogowe bez ściągania kilku tysięcy stron.
 *
 * Wynik: data/raw/akty-bip.json
 */
import { writeFile, mkdir } from 'node:fs/promises';

const BAZA = 'https://bip.wyszkow.pl/';
const OUT = new URL('../data/raw/akty-bip.json', import.meta.url);

// Punkty startowe pełnego przejścia archiwum: strony kadencji Rady Miejskiej
// i wykaz sesji. Wyszukiwarka BIP indeksuje głównie starsze kadencje, więc
// samo szukanie po frazach zostawia dziurę od 2010 r. wzwyż.
const KORZENIE = [
  { id: '180', opis: 'kadencja 2002-2006' },
  { id: '181', opis: 'kadencja 2006-2010' },
  { id: '1434', opis: 'kadencja 2010-2014' },
  { id: '8000', opis: 'kadencja 2014-2018' },
  { id: '17150', opis: 'kadencja 2018-2024' },
  { id: '29849', opis: 'kadencja 2024-2029' },
  { id: '19444', opis: 'sesje Rady' },
];
const MAX_STRON = Number(process.env.MAX_STRON ?? 1200);

const FRAZY = [
  'zaliczenia do kategorii dróg gminnych',
  'pozbawienia kategorii drogi gminnej',
  'przebiegu dróg gminnych',
  'nadania nazwy ulicy',
  'zmiany nazwy ulicy',
  'nadania nazwy rondu',
  'nadania nazwy skwerowi',
  'zaliczenia drogi do kategorii',
];

// tytuł uchwały musi dotyczyć dróg albo nazewnictwa, inaczej odpada
const TEMAT = /(drog|ulic|rond|skwer|plac\b|kategori)/i;

const MIESIACE = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, wrzesnia: 9, października: 10,
  pazdziernika: 10, listopada: 11, grudnia: 12,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pobierz(url, opcje = {}) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, {
        ...opcje,
        headers: {
          'User-Agent': 'gmina-wyszkow-drogi/1.0 (import aktów prawnych)',
          ...(opcje.headers ?? {}),
        },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === 3) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
}

const bezZnacznikow = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Treść merytoryczna strony BIP siedzi w kolumnie col-md-8. */
const trescStrony = (html) => {
  const i = html.indexOf('col-md-8');
  return i < 0 ? html : html.slice(i);
};

async function szukaj(fraza) {
  const body = new URLSearchParams({ cmd: 'szukaj', opt: 'wykaz', search: fraza });
  const html = await pobierz(BAZA + 'index.php', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    redirect: 'follow',
  });
  const tresc = trescStrony(html);
  const strony = new Map();
  for (const m of tresc.matchAll(
    /<a[^>]+href="([^"]*cmd=zawartosc[^"]*id=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  )) {
    strony.set(m[2], { url: m[1].replace(/&amp;/g, '&'), tytul: bezZnacznikow(m[3]) });
  }
  return strony;
}

/** Nagłówek strony sesji: „Uchwały ... podjęte w dn. 16 lutego 2006 r. nr 1-15.” */
function dataSesji(tekst) {
  const m = /podjęte\s+w\s+dn\.?[a-z]*\s+([^.]{5,40}?)\s*r\./i.exec(tekst);
  return m ? dataZTekstu(m[1]) : null;
}

function dataZTekstu(txt) {
  const m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(txt);
  if (!m) return null;
  const mies = MIESIACE[m[2].toLowerCase()];
  if (!mies) return null;
  return `${m[3]}-${String(mies).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

// Ogon strony i załączniki doklejają się do tytułu — ucinamy je.
const KONIEC_TYTULU =
  /\s*(Załącznik|Załaczniki|Informacje o stronie|Metryka strony|Wytworzył|Wprowadził|Data wytworzenia|Opublikował|Uchwała\s+nr|Zarządzenie\s+nr|Rejestr zmian)\b[\s\S]*$/i;

function aktyZeStrony(html, zrodloUrl) {
  const seg = trescStrony(html);
  const dataNaglowka = dataSesji(bezZnacznikow(seg).slice(0, 400));

  // odnośniki do plików, indeksowane numerem uchwały z treści odnośnika
  const pliki = new Map();
  for (const m of seg.matchAll(
    /<a[^>]+href="([^"]+\.(?:pdf|doc|docx))"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const nr = /nr\s+((?:[IVXLCDM]+\/)?\d+\/\d{2,4})/i.exec(bezZnacznikow(m[2]));
    if (nr && !pliki.has(nr[1])) {
      pliki.set(nr[1], new URL(m[1].replace(/&amp;/g, '&'), BAZA).href);
    }
  }

  const tekst = bezZnacznikow(seg);
  const akty = [];
  // Zapisy w BIP nie są jednolite: raz „z dn.”, raz „z dnia”, raz bez organu.
  // Wiążemy więc tylko numer uchwały z formułą „w sprawie”, a co pomiędzy —
  // przeszukujemy osobno w poszukiwaniu daty.
  // Rada podejmuje uchwały (numer rzymski/arabski/rok), Burmistrz wydaje
  // zarządzenia (numer arabski/rok). Oba bywają na tych samych stronach.
  const wzor =
    /(Uchwał[ay]|Zarządzeni[ae])\s+nr\s+((?:[IVXLCDM]+\/)?\d+\/\d{2,4})([\s\S]{0,200}?)w\s+sprawie\s+([\s\S]{5,600}?)(?=\s*(?:Uchwał[ay]\s+nr|Zarządzeni[ae]\s+nr|$))/gi;

  for (const m of tekst.matchAll(wzor)) {
    const zarzadzenie = /^Zarz/i.test(m[1]);
    const tytul = m[4].replace(KONIEC_TYTULU, '').replace(/\s*\.\s*$/, '').trim();
    if (!tytul || !TEMAT.test(tytul)) continue;
    akty.push({
      organ: zarzadzenie ? 'Burmistrz Wyszkowa' : 'Rada Miejska w Wyszkowie',
      rodzaj: zarzadzenie ? 'zarządzenie' : 'uchwała',
      numer: m[2],
      rok: Number(m[2].split('/').pop().padStart(4, '20').slice(-4)),
      data_podjecia: dataZTekstu(m[3]) ?? dataNaglowka,
      tytul: `w sprawie ${tytul}`,
      url_pdf: pliki.get(m[2]) ?? null,
      url_zrodla: zrodloUrl,
    });
  }
  return akty;
}

/** Wszystkie odnośniki do podstron BIP z treści danej strony. */
function podstrony(html) {
  const seg = trescStrony(html);
  const out = new Map();
  for (const m of seg.matchAll(
    /<a[^>]+href="([^"]*cmd=zawartosc[^"]*id=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  )) {
    out.set(m[2], { url: m[1].replace(/&amp;/g, '&'), tytul: bezZnacznikow(m[3]) });
  }
  return out;
}

/**
 * Czy warto wejść głębiej. Archiwum ma kilka pięter i różne układy zależnie
 * od kadencji: kadencja → rocznik → miesiąc albo kadencja → rocznik → sesja.
 */
const WARTO_WEJSC =
  /^(sesje|uchwał|kadencja|\d{4}$|[IVXLCDM]+\s+sesja|sesja\b|stycz|lut|marz|kwie|maj|czerw|lip|sierp|wrze|paździer|pazdzier|listopad|grudz)/i;

async function main() {
  const strony = new Map();
  for (const fraza of FRAZY) {
    const wynik = await szukaj(fraza);
    for (const [id, s] of wynik) {
      const rec = strony.get(id) ?? { ...s, frazy: [] };
      rec.frazy.push(fraza);
      strony.set(id, rec);
    }
    process.stderr.write(`"${fraza}" -> ${wynik.size} stron\n`);
    await sleep(300);
  }
  // Pełne przejście archiwum kadencji — domyka lata, których wyszukiwarka
  // nie indeksuje.
  const kolejka = KORZENIE.map((k) => ({ ...k, glebokosc: 0 }));
  const odwiedzone = new Set();
  while (kolejka.length && strony.size < MAX_STRON) {
    const { id, url, glebokosc } = kolejka.shift();
    if (odwiedzone.has(id)) continue;
    odwiedzone.add(id);
    const adres = url ?? `index.php?cmd=zawartosc&opt=pokaz&id=${id}`;
    let html;
    try {
      html = await pobierz(BAZA + adres);
    } catch {
      continue;
    }
    strony.set(id, { url: adres, tytul: '', frazy: ['archiwum kadencji'] });
    if (glebokosc >= 4) continue;
    for (const [pid, p] of podstrony(html)) {
      if (odwiedzone.has(pid) || !WARTO_WEJSC.test(p.tytul)) continue;
      kolejka.push({ id: pid, url: p.url, glebokosc: glebokosc + 1 });
    }
    await sleep(120);
  }

  process.stderr.write(`\nUnikalnych stron do sprawdzenia: ${strony.size}\n`);

  const akty = new Map();
  let i = 0;
  for (const [id, s] of strony) {
    i++;
    let html;
    try {
      html = await pobierz(BAZA + s.url);
    } catch (e) {
      process.stderr.write(`  ! ${id}: ${e.message}\n`);
      continue;
    }
    for (const a of aktyZeStrony(html, BAZA + s.url)) {
      akty.set(`${a.rodzaj}|${a.numer}`, a);
    }
    if (i % 25 === 0) {
      process.stderr.write(`  ${i}/${strony.size} stron, ${akty.size} aktów\n`);
    }
    await sleep(150);
  }

  const lista = [...akty.values()].sort((a, b) =>
    (a.data_podjecia ?? '').localeCompare(b.data_podjecia ?? '')
  );

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        zrodlo: 'BIP Gminy Wyszków — uchwały Rady Miejskiej',
        baza: BAZA,
        frazy: FRAZY,
        pobrano: new Date().toISOString().slice(0, 10),
        stron_przeszukanych: strony.size,
        liczba_aktow: lista.length,
        akty: lista,
      },
      null,
      1
    ) + '\n'
  );
  process.stderr.write(`\nZapisano ${lista.length} aktów -> ${OUT.pathname}\n`);
  if (!lista.length) {
    process.stderr.write(
      'UWAGA: zero aktów przy niepustej liście stron oznacza, że BIP zmienił ' +
        'układ strony i wzorzec przestał pasować — sprawdź scripts/harvest-akty-bip.mjs\n'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
