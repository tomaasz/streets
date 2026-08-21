#!/usr/bin/env node
/**
 * Pobiera akty prawa miejscowego wprost ze stron wydawcy w Dzienniku
 * Urzędowym Województwa Mazowieckiego i zapisuje je do bazy.
 *
 * Po to, żeby aktualizacja nie wymagała ręcznego pobierania arkuszy:
 * uruchamiane z harmonogramu robi wszystko samo.
 *
 *   node scripts/harvest-edziennik-auto.mjs            # do pliku JSON
 *   node scripts/harvest-edziennik-auto.mjs --do-bazy  # od razu do bazy
 *
 * WAŻNE: serwis odrzuca połączenia z centrów danych (Akamai Bot Manager).
 * Skrypt trzeba uruchamiać z sieci, którą serwis przyjmuje — z komputera
 * w urzędzie albo z serwera, dla którego Mazowiecki Urząd Wojewódzki
 * odblokuje adres IP. Przy blokadzie skrypt kończy się kodem 2 i mówi
 * o tym wprost, zamiast po cichu zapisać pustą listę.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import {
  TEMAT, data, kanonicznyOrgan, rodzajAktu, rozbijTytul, zTytulem,
} from './lib/akty.mjs';

const BAZA = process.env.EDZIENNIK ?? 'https://edziennik.mazowieckie.pl';
const OUT = new URL('../data/raw/akty-edziennik.json', import.meta.url);
const doBazy = process.argv.includes('--do-bazy');

/** Wydawcy dotyczący Wyszkowa — grupa „W” w /publisher-group. */
const WYDAWCY = [1453, 1222, 282, 163, 760, 448, 468, 246, 1018, 1121];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const czysty = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Tabela aktów to ta, której nagłówek ma jednocześnie „Pozycja” i „Tytuł”. */
function tabelaAktow(html) {
  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const naglowki = [...t[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
      czysty(m[1]).toLowerCase()
    );
    if (
      naglowki.some((n) => n.includes('pozycja')) &&
      naglowki.some((n) => n.includes('tytu'))
    ) {
      return { html: t[0], naglowki };
    }
  }
  return null;
}

function aktyZeStrony(html, id) {
  const tab = tabelaAktow(html);
  if (!tab) return { akty: [], wierszy: 0, naglowki: null };

  const kol = (...frazy) =>
    tab.naglowki.findIndex((n) => frazy.some((f) => n.includes(f)));
  const iPoz = kol('pozycja');
  const iAkt = kol('data aktu', 'data podj');
  const iPub = kol('data publikacji', 'data ogł', 'data ogl');
  const iTyt = kol('tytu');

  const akty = [];
  let wierszy = 0;
  for (const wm of tab.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const komorki = [...wm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (!komorki.length) continue;
    wierszy++;

    const tekstTytulu = czysty(komorki[iTyt] ?? '');
    if (!tekstTytulu || !TEMAT.test(tekstTytulu)) continue;

    const rozbite = rozbijTytul(tekstTytulu);
    if (!rozbite?.numer) continue;

    const pdf = /href="([^"]+\.pdf[^"]*)"/i.exec(wm[1])?.[1];
    const dataPubl = data(czysty(komorki[iPub] ?? ''));

    akty.push({
      organ: kanonicznyOrgan(rozbite.organ) ?? 'nieustalony',
      organ_zrodlowy: rozbite.organ,
      rodzaj: rodzajAktu(rozbite.rodzaj),
      numer: rozbite.numer,
      data_podjecia: data(czysty(komorki[iAkt] ?? '')),
      tytul: zTytulem(rozbite.tytul),
      dziennik_rok: dataPubl ? Number(dataPubl.slice(0, 4)) : null,
      dziennik_pozycja: Number(czysty(komorki[iPoz] ?? '')) || null,
      data_ogloszenia: dataPubl,
      url: `${BAZA}/publisher/${id}`,
      url_pdf: pdf ? new URL(pdf, BAZA).href : null,
    });
  }
  return { akty, wierszy, naglowki: tab.naglowki };
}

async function main() {
  const wszystkie = new Map();
  let wierszyRazem = 0;
  let bylaBlokada = false;

  for (const id of WYDAWCY) {
    let html;
    try {
      html = await pobierz(`/publisher/${id}`);
    } catch (e) {
      if (e.blokada) {
        bylaBlokada = true;
        process.stderr.write(`  wydawca ${id}: BLOKADA — ${e.message}\n`);
        break;
      }
      process.stderr.write(`  wydawca ${id}: ${e.message}\n`);
      continue;
    }
    const { akty, wierszy, naglowki } = aktyZeStrony(html, id);
    wierszyRazem += wierszy;
    if (!naglowki) {
      process.stderr.write(
        `  wydawca ${id}: nie znalazłem tabeli aktów — serwis zmienił układ strony\n`
      );
      continue;
    }
    for (const a of akty) wszystkie.set(`${a.rodzaj}|${a.numer}|${a.organ}`, a);
    process.stderr.write(
      `  wydawca ${id}: ${wierszy} wierszy, drogowych ${akty.length}\n`
    );
    await sleep(500);
  }

  if (bylaBlokada) {
    console.error(
      '\nSerwis odrzuca połączenia z tej sieci (Akamai Bot Manager).\n' +
        'Uruchom skrypt z komputera w urzędzie albo z serwera, dla którego\n' +
        'Mazowiecki Urząd Wojewódzki odblokował adres IP.\n' +
        'Nic nie zapisano — poprzednie dane w bazie zostają nietknięte.'
    );
    process.exit(2);
  }

  const lista = [...wszystkie.values()].sort((a, b) =>
    (b.data_podjecia ?? '').localeCompare(a.data_podjecia ?? '')
  );

  if (!lista.length && wierszyRazem > 0) {
    console.error(
      `\nPrzejrzałem ${wierszyRazem} wierszy i nie rozpoznałem ani jednego aktu.\n` +
        'To znaczy, że serwis zmienił układ tabeli — trzeba poprawić parser.\n' +
        'Nic nie zapisano.'
    );
    process.exit(3);
  }

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        zrodlo: 'Dziennik Urzędowy Województwa Mazowieckiego — strony wydawców',
        baza: BAZA,
        wydawcy: WYDAWCY,
        pobrano: new Date().toISOString().slice(0, 10),
        wierszy_przejrzanych: wierszyRazem,
        liczba_aktow: lista.length,
        akty: lista,
      },
      null,
      1
    ) + '\n'
  );
  process.stderr.write(
    `\nZ ${wierszyRazem} wierszy wybrano ${lista.length} aktów drogowych.\n`
  );

  if (doBazy) {
    const { seedAkty } = await import('./lib/seed-akty.mjs');
    const ile = await seedAkty(lista);
    process.stderr.write(`Zapisano do bazy: ${ile} aktów.\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
