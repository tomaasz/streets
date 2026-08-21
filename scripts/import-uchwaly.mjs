#!/usr/bin/env node
/**
 * Wgrywa do bazy uchwały o zaliczeniu dróg do kategorii dróg gminnych,
 * odczytane wcześniej z PDF-ów (scripts/pdf/czytaj-uchwaly.py).
 *
 * Po co: BDOT10k mówi, że ulica jest gminna. Uchwała mówi, kto tak
 * postanowił, kiedy i na jakim odcinku — a dla urzędu to jest właśnie ta
 * informacja, której się szuka.
 *
 * Co robi:
 *   1. zapisuje akty w `akt_prawny` (klucz: rodzaj + numer + organ);
 *   2. wiąże je z ulicami z PRG przez `akt_ulica`, a drogi numerowane
 *      przez `akt_droga` z rolą „zaliczenie do kategorii”;
 *   3. dla ulic, które uchwała wymienia, a które **nie mają w bazie ani
 *      jednego odcinka**, zakłada odcinek na podstawie uchwały:
 *      kategoria gminna, zarządca Burmistrz Wyszkowa, pewność 3.
 *
 * Czego NIE robi — świadomie:
 *   - nie rusza odcinków z BDOT10k. Gdy ulica ma już odcinki, uchwała
 *     dokłada tylko powiązanie i podstawę prawną, nie drugi odcinek —
 *     inaczej długość sieci liczyłaby się dwa razy;
 *   - nie poprawia literówek w nazwach z uchwały ani nie zgaduje przy
 *     rozbieżnościach z BDOT10k. Jedno i drugie ląduje w raporcie.
 *
 * Uruchomienie jest idempotentne: odcinki o źródle `uchwala` są przed
 * wsadem kasowane i zakładane od nowa, tak samo jak seed robi z BDOT10k.
 *
 *   npm run data:uchwaly
 *   npm run data:uchwaly -- --na-sucho     # tylko raport, bez zapisu
 */
import { readFile } from 'node:fs/promises';
import { polaczenieZeSchematem } from './lib/db.mjs';
import { kanonicznyOrgan } from './lib/akty.mjs';

const WEJSCIE = new URL('../data/raw/uchwaly-kategorie.json', import.meta.url);
const NA_SUCHO = process.argv.includes('--na-sucho');
const ZARZADCA_GMINNY = 'burmistrz-wyszkowa';

// Ten sam podział, co w scripts/seed.mjs — inaczej „Plac Jana Matejki”
// z uchwały nie trafiłby w „pl. Jana Matejki” z bazy. PRG ma w Wyszkowie
// jedno i drugie osobno: ulicę Jana Matejki i plac Jana Matejki, więc
// cecha musi wejść do klucza dopasowania, a nie zostać zdjęta.
const CECHY = [
  ['Aleja ', 'al.'], ['Al. ', 'al.'], ['Plac ', 'pl.'], ['Pl. ', 'pl.'],
  ['Rondo ', 'rondo'], ['Skwer ', 'skwer'], ['Bulwar ', 'bulwar'],
  ['Osiedle ', 'os.'], ['Os. ', 'os.'], ['Park ', 'park'],
];

function rozbijNazwe(pelna) {
  for (const [prefiks, cecha] of CECHY) {
    if (pelna.startsWith(prefiks)) return { cecha, nazwa: pelna.slice(prefiks.length) };
  }
  return { cecha: 'ul.', nazwa: pelna };
}

const bezOgonkow = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();

/**
 * Nazwy z uchwały i z bazy muszą sprowadzić się do jednego zapisu.
 * Różnią się ogonkami, wielkością liter i interpunkcją — ale nie cechą,
 * bo ta jest częścią tożsamości obiektu.
 */
function normalizuj(s) {
  return bezOgonkow(s)
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/\.+$/, ''))
    .filter(Boolean)
    .join(' ');
}

/** Klucz dopasowania: miejscowość + cecha + nazwa. */
const klucz = (miejscowosc, cecha, nazwa) =>
  `${normalizuj(miejscowosc)}|${cecha}|${normalizuj(nazwa)}`;

const podstawaPrawna = (akt) =>
  `Uchwała nr ${akt.numer} ${akt.organ} z dnia ${akt.data_podjecia}`;

async function main() {
  const dane = JSON.parse(await readFile(WEJSCIE, 'utf8'));
  const { klient, nazwa } = await polaczenieZeSchematem();
  process.stderr.write(`Schemat: ${nazwa}${NA_SUCHO ? ' (na sucho)' : ''}\n`);

  const q = async (sql, par = []) => (await klient.query(sql, par)).rows;

  // klucz: znormalizowana miejscowość + nazwa ulicy
  const ulice = new Map();
  for (const u of await q('SELECT id, miejscowosc, cecha, nazwa, nazwa_pelna FROM ulica')) {
    ulice.set(klucz(u.miejscowosc, u.cecha, u.nazwa), u);
  }
  const drogi = new Map(
    (await q('SELECT id, numer FROM droga')).map((d) => [d.numer, d.id])
  );
  const [{ id: idZarzadcy }] = await q(
    'SELECT id FROM zarzadca WHERE kod = $1',
    [ZARZADCA_GMINNY]
  );

  await klient.query('BEGIN');

  const bezDopasowania = [];
  const bezOdcinkow = [];
  let powiazanUlic = 0;
  let powiazanDrog = 0;

  for (const akt of dane.akty) {
    // „RADY MIEJSKIEJ W WYSZKOWIE” z nagłówka uchwały to ten sam organ,
    // co „Rada Miejska w Wyszkowie” z BIP-u — bez sprowadzenia do jednej
    // nazwy akt wszedłby do bazy drugi raz, bo klucz to (rodzaj, numer, organ).
    const organ = kanonicznyOrgan(akt.organ_zrodlowy) ?? 'nieustalony';
    const [zapisany] = await q(
      `INSERT INTO akt_prawny (organ, rodzaj, numer, data_podjecia, tytul, zrodlo, uwagi)
       VALUES ($1, 'uchwała', $2, $3, $4, 'uchwala', $5)
       ON CONFLICT (rodzaj, numer, organ) DO UPDATE SET
         data_podjecia = COALESCE(EXCLUDED.data_podjecia, akt_prawny.data_podjecia),
         tytul = EXCLUDED.tytul,
         zrodlo = EXCLUDED.zrodlo,
         uwagi = EXCLUDED.uwagi
       RETURNING id`,
      [organ, akt.numer, akt.data_podjecia, akt.tytul,
       `Odczytane z ${akt.plik}`]
    );

    // Powiązania budujemy od nowa. Gdy poprawi się dopasowanie nazw,
    // stare wiersze nie mogą zostać — inaczej ulica trzymałaby powiązanie
    // z uchwałą, która jej wcale nie wymienia.
    await klient.query('DELETE FROM akt_ulica WHERE akt_id = $1', [zapisany.id]);
    await klient.query('DELETE FROM akt_droga WHERE akt_id = $1', [zapisany.id]);

    for (const zal of akt.zalaczniki) {
      for (const poz of zal.pozycje) {
        if (poz.watpliwa) continue;

        if (poz.typ === 'numer' && poz.numer_drogi) {
          const drogaId = drogi.get(poz.numer_drogi);
          if (!drogaId) {
            bezDopasowania.push({ akt: akt.numer, ...poz, powod: 'nieznany numer drogi' });
            continue;
          }
          await klient.query(
            `INSERT INTO akt_droga (akt_id, droga_id, rola, uwagi)
             VALUES ($1, $2, 'zaliczenie do kategorii', $3)
             ON CONFLICT (akt_id, droga_id, rola) DO UPDATE SET uwagi = EXCLUDED.uwagi`,
            [zapisany.id, drogaId, poz.opis]
          );
          powiazanDrog++;
          continue;
        }

        if (poz.typ !== 'ulica' || !poz.ulica || !poz.miejscowosc) {
          // droga wiejska bez nazwy własnej albo przebieg między wsiami —
          // nie ma czego dopasować do warstwy ulic z PRG
          bezDopasowania.push({ akt: akt.numer, ...poz, powod: `bez nazwy ulicy (${poz.typ})` });
          continue;
        }

        const { cecha, nazwa } = rozbijNazwe(poz.ulica);
        const u = ulice.get(klucz(poz.miejscowosc, cecha, nazwa));
        if (!u) {
          bezDopasowania.push({ akt: akt.numer, ...poz, powod: 'nie ma takiej ulicy w PRG' });
          continue;
        }

        await klient.query(
          `INSERT INTO akt_ulica (akt_id, ulica_id, rola, uwagi)
           VALUES ($1, $2, 'dotyczy', $3)
           ON CONFLICT (akt_id, ulica_id, rola) DO UPDATE SET uwagi = EXCLUDED.uwagi`,
          [zapisany.id, u.id, poz.opis]
        );
        powiazanUlic++;

        const [{ ile }] = await q(
          'SELECT COUNT(*)::int ile FROM odcinek_drogi WHERE ulica_id = $1',
          [u.id]
        );
        if (ile === 0) {
          bezOdcinkow.push({
            ulica_id: u.id,
            miejscowosc: u.miejscowosc,
            nazwa: u.nazwa,
            dlugosc_km: poz.dlugosc_km,
            opis: poz.opis,
            podstawa: podstawaPrawna({ ...akt, organ }),
          });
        }
      }
    }
  }

  // Odcinki zakładane z uchwał — kasujemy i wstawiamy od nowa, żeby
  // powtórny przebieg nie mnożył wierszy.
  const [{ ile: doSkasowania }] = await q(
    "SELECT COUNT(*)::int ile FROM odcinek_drogi WHERE zrodlo = 'uchwala'"
  );
  await klient.query("DELETE FROM odcinek_drogi WHERE zrodlo = 'uchwala'");
  for (const o of bezOdcinkow) {
    await klient.query(
      `INSERT INTO odcinek_drogi
         (ulica_id, kategoria, zarzadca_id, opis_odcinka, dlugosc_m,
          podstawa_prawna, zrodlo, pewnosc, uwagi)
       VALUES ($1, 'gminna', $2, $3, $4, $5, 'uchwala', 3,
               'Odcinek założony na podstawie uchwały — BDOT10k go nie zna.')`,
      [o.ulica_id, idZarzadcy, o.opis,
       o.dlugosc_km == null ? null : Math.round(o.dlugosc_km * 1000), o.podstawa]
    );
  }

  if (NA_SUCHO) {
    await klient.query('ROLLBACK');
  } else {
    await klient.query('COMMIT');
  }

  process.stderr.write(
    `\nAkty: ${dane.akty.length}\n` +
      `Powiązań akt–ulica: ${powiazanUlic}\n` +
      `Powiązań akt–droga: ${powiazanDrog}\n` +
      `Odcinków z uchwał: skasowano ${doSkasowania}, założono ${bezOdcinkow.length}` +
      ` (${(bezOdcinkow.reduce((s, o) => s + (o.dlugosc_km ?? 0), 0)).toFixed(1)} km)\n`
  );
  if (bezDopasowania.length) {
    process.stderr.write(`\nNiedopasowane — do decyzji człowieka (${bezDopasowania.length}):\n`);
    for (const b of bezDopasowania) {
      process.stderr.write(
        `  ${b.akt} lp.${String(b.lp).padStart(3)} ` +
          `${b.miejscowosc ?? '—'} / ${b.ulica ?? b.numer_drogi ?? b.przebieg ?? '—'}` +
          `  [${b.powod}]\n`
      );
    }
  }
  process.stderr.write(NA_SUCHO ? '\nNa sucho — nic nie zapisano.\n' : '\nGotowe.\n');

  await klient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
