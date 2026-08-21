#!/usr/bin/env node
/**
 * SAMODZIELNY IMPORTER AKTÓW PRAWNYCH — jeden plik, zero zależności.
 *
 * Po co: serwis edziennik.mazowieckie.pl odrzuca połączenia z centrów danych,
 * więc pobranie musi odbyć się z komputera o zwykłym łączu. Ten komputer nie
 * musi jednak mieć repozytorium, npm-a ani hasła do bazy — pobiera akty
 * i wysyła je do aplikacji, a ona zapisuje je u siebie.
 *
 * Wymaga tylko Node 18 lub nowszego.
 *
 *   node edziennik-samodzielny.mjs                    # tylko pobierz i pokaż
 *   node edziennik-samodzielny.mjs --plik akty.json   # zapisz do pliku
 *   node edziennik-samodzielny.mjs --wyslij           # wyślij do aplikacji
 *
 * Przy wysyłce potrzebne są dwie zmienne środowiskowe:
 *   APLIKACJA=https://streets-lyart.vercel.app
 *   IMPORT_TOKEN=<ten sam token, co w ustawieniach projektu na Vercelu>
 */

const BAZA = process.env.EDZIENNIK ?? 'https://edziennik.mazowieckie.pl';
const APLIKACJA = process.env.APLIKACJA ?? 'https://streets-lyart.vercel.app';
const TOKEN = process.env.IMPORT_TOKEN ?? '';

const argi = process.argv.slice(2);
const wyslij = argi.includes('--wyslij');
const plik = argi.includes('--plik') ? argi[argi.indexOf('--plik') + 1] : null;

/** Wydawcy dotyczący Wyszkowa — grupa „W” w /publisher-group. */
const WYDAWCY = [1453, 1222, 282, 163, 760, 448, 468, 246, 1018, 1121];

const TEMAT =
  /(drog|ulic|rond|skwer|\bplac\b|kategori\w+ dróg|nazw\w+ (ulic|rond|skwer|plac))/i;

const KANON = [
  [/burmistrz/i, 'Burmistrz Wyszkowa'],
  [/rada miejska/i, 'Rada Miejska w Wyszkowie'],
  [/rada powiatu/i, 'Rada Powiatu Wyszkowskiego'],
  [/zarząd powiatu/i, 'Zarząd Powiatu Wyszkowskiego'],
  [/starosta/i, 'Starosta Wyszkowski'],
  [/komisja bezpieczeństwa/i, 'Komisja Bezpieczeństwa i Porządku Publicznego w Wyszkowie'],
];
const organ = (n) => KANON.find(([w]) => w.test(n ?? ''))?.[1] ?? (n || 'nieustalony');

const RODZAJE = {
  uchwala: 'uchwała', uchwaly: 'uchwała',
  zarzadzenie: 'zarządzenie', zarzadzenia: 'zarządzenie',
  rozporzadzenie: 'rozporządzenie', obwieszczenie: 'obwieszczenie',
};
const bezOgonkow = (s) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').toLowerCase().trim();
const rodzajAktu = (s) => RODZAJE[bezOgonkow(s)] ?? RODZAJE[bezOgonkow(s).replace(/[ay]$/, 'a')] ?? 'uchwała';

const MIESIACE = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12,
};

function data(s) {
  s = String(s ?? '').trim();
  if (!s) return null;
  let m = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(s);
  if (m && MIESIACE[m[2].toLowerCase()]) {
    return `${m[3]}-${String(MIESIACE[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

const czysty = (s) =>
  s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();

function rozbijTytul(tekst) {
  const t = String(tekst ?? '').replace(/\s*[|·]\s*/g, ' ').replace(/\s+/g, ' ');
  const m =
    /(Uchwał[ay]|Zarządzeni[ae]|Rozporządzeni[ae]|Obwieszczeni[ae])\s*(?:nr\s*)?([\w/.-]+)\s+(.*?)\s*z\s+dnia?\s+[^.]{5,40}?\s*r\.?\s*(w\s+sprawie\s+[\s\S]+)/i.exec(t);
  if (!m) return null;
  return {
    rodzaj: rodzajAktu(m[1]),
    numer: m[2].replace(/^nr\s*/i, '').trim(),
    organ: m[3].trim() || null,
    tytul: m[4].replace(/\s+/g, ' ').trim(),
  };
}

async function pobierz(sciezka) {
  const res = await fetch(BAZA + sciezka, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'pl-PL,pl;q=0.9',
      'user-agent': 'gmina-wyszkow-drogi/1.0 (ewidencja dróg gminy Wyszków)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  const tekst = await res.text();
  if (res.status === 403 || /Dostęp zablokowany/i.test(tekst)) {
    const e = new Error('serwis odrzucił połączenie z tej sieci');
    e.blokada = true;
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return tekst;
}

function tabelaAktow(html) {
  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const naglowki = [...t[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
      czysty(m[1]).toLowerCase()
    );
    if (naglowki.some((n) => n.includes('pozycja')) && naglowki.some((n) => n.includes('tytu'))) {
      return { html: t[0], naglowki };
    }
  }
  return null;
}

function aktyZeStrony(html, id) {
  const tab = tabelaAktow(html);
  if (!tab) return { akty: [], wierszy: 0, brakTabeli: true };
  const kol = (...f) => tab.naglowki.findIndex((n) => f.some((x) => n.includes(x)));
  const iPoz = kol('pozycja'), iAkt = kol('data aktu', 'data podj');
  const iPub = kol('data publikacji', 'data ogł', 'data ogl'), iTyt = kol('tytu');

  const akty = [];
  let wierszy = 0;
  for (const wm of tab.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const k = [...wm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (!k.length) continue;
    wierszy++;
    const tekst = czysty(k[iTyt] ?? '');
    if (!tekst || !TEMAT.test(tekst)) continue;
    const r = rozbijTytul(tekst);
    if (!r?.numer) continue;
    const pdf = /href="([^"]+\.pdf[^"]*)"/i.exec(wm[1])?.[1];
    const dataPubl = data(czysty(k[iPub] ?? ''));
    akty.push({
      organ: organ(r.organ),
      rodzaj: r.rodzaj,
      numer: r.numer,
      data_podjecia: data(czysty(k[iAkt] ?? '')),
      tytul: /^w sprawie/i.test(r.tytul) ? r.tytul : `w sprawie ${r.tytul}`,
      dziennik_rok: dataPubl ? Number(dataPubl.slice(0, 4)) : null,
      dziennik_pozycja: Number(czysty(k[iPoz] ?? '')) || null,
      data_ogloszenia: dataPubl,
      url: `${BAZA}/publisher/${id}`,
      url_pdf: pdf ? new URL(pdf, BAZA).href : null,
    });
  }
  return { akty, wierszy, brakTabeli: false };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wszystkie = new Map();
let wierszyRazem = 0;

for (const id of WYDAWCY) {
  let html;
  try {
    html = await pobierz(`/publisher/${id}`);
  } catch (e) {
    if (e.blokada) {
      console.error(
        `\nBLOKADA — serwis odrzuca połączenia z tej sieci (Akamai Bot Manager).\n` +
          'Uruchom skrypt z komputera, na którym strona otwiera się w przeglądarce.\n' +
          'Nic nie zostało pobrane ani wysłane.'
      );
      process.exit(2);
    }
    console.error(`  wydawca ${id}: ${e.message}`);
    continue;
  }
  const { akty, wierszy, brakTabeli } = aktyZeStrony(html, id);
  wierszyRazem += wierszy;
  if (brakTabeli) {
    console.error(`  wydawca ${id}: nie znalazłem tabeli aktów`);
    continue;
  }
  for (const a of akty) wszystkie.set(`${a.rodzaj}|${a.numer}|${a.organ}`, a);
  console.error(`  wydawca ${id}: ${wierszy} wierszy, drogowych ${akty.length}`);
  await sleep(500);
}

const akty = [...wszystkie.values()].sort((a, b) =>
  (b.data_podjecia ?? '').localeCompare(a.data_podjecia ?? '')
);

console.error(`\nZ ${wierszyRazem} wierszy wybrano ${akty.length} aktów drogowych.`);

if (!akty.length && wierszyRazem > 0) {
  console.error(
    'Przejrzałem wiersze, ale nie rozpoznałem ani jednego aktu — serwis\n' +
      'zmienił układ tabeli. Przekaż ten komunikat, poprawię wzorzec.\n' +
      'Nic nie zostało wysłane.'
  );
  process.exit(3);
}

for (const a of akty.slice(0, 10)) {
  console.error(
    `  ${a.rodzaj} ${a.numer} | ${a.organ} | ${a.data_podjecia ?? '?'} | ${a.tytul.slice(0, 60)}`
  );
}
if (akty.length > 10) console.error(`  … i ${akty.length - 10} dalszych`);

if (plik) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(plik, JSON.stringify({ akty }, null, 1) + '\n');
  console.error(`\nZapisano do ${plik}`);
}

if (wyslij) {
  if (!TOKEN) {
    console.error('\nBrak zmiennej IMPORT_TOKEN — nie wysyłam.');
    process.exit(4);
  }
  const res = await fetch(`${APLIKACJA}/api/import/akty`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ akty }),
    signal: AbortSignal.timeout(60_000),
  });
  const odp = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`\nAplikacja odrzuciła wsad (HTTP ${res.status}): ${odp.blad ?? ''}`);
    process.exit(5);
  }
  console.error(
    `\nWysłano. Przyjęto ${odp.przyjeto}, nowych ${odp.nowych}, ` +
      `zaktualizowanych ${odp.zaktualizowanych}.`
  );
}
