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

  // Odcinki założone przez poprzedni przebieg tego skryptu kasujemy na
  // starcie. Gdyby stały do końca, sprawdzenie „czy ulica ma już odcinki”
  // widziałoby wynik poprzedniego uruchomienia i skrypt oscylowałby:
  // raz zakłada odcinek, raz go kasuje.
  const [{ ile: doSkasowania }] = await q(
    "SELECT COUNT(*)::int ile FROM odcinek_drogi WHERE zrodlo = 'uchwala'"
  );
  await klient.query("DELETE FROM odcinek_drogi WHERE zrodlo = 'uchwala'");

  // Liczba odcinków każdej ulicy — jedno zapytanie zamiast pytania o COUNT(*)
  // osobno dla każdej pozycji każdego załącznika w pętli niżej (setki pozycji,
  // tyle samo podróży do bazy). Stan jest ustalony w tym miejscu na stałe: do
  // końca pętli nikt nic do odcinek_drogi nie wstawia — nowe odcinki z
  // bezOdcinkow trafiają do bazy dopiero po pętli.
  const liczbaOdcinkow = new Map(
    (
      await q(
        `SELECT ulica_id, COUNT(*)::int ile FROM odcinek_drogi
          WHERE ulica_id IS NOT NULL GROUP BY ulica_id`
      )
    ).map((r) => [r.ulica_id, r.ile])
  );
  // Ulice już zakwalifikowane do bezOdcinkow w tym przebiegu — bez tego ta
  // sama ulica wymieniona w dwóch pozycjach (różne akty albo różne pozycje
  // jednego aktu) dostałaby dwa nowe odcinki, bo liczbaOdcinkow się nie
  // zmienia aż do wsadu po pętli.
  const juzZaplanowane = new Set();

  const bezDopasowania = [];
  const bezOdcinkow = [];
  // ulica_id -> { podstawa, aktId }, na podstawie ktorej wchodzi regula pierwszenstwa
  // i przez ktora akt_odcinek wie, ktory akt jest zrodlem powiazania
  const nadpisania = new Map();
  let powiazanUlic = 0;
  let powiazanDrog = 0;

  for (const akt of dane.akty) {
    // „RADY MIEJSKIEJ W WYSZKOWIE” z nagłówka uchwały to ten sam organ,
    // co „Rada Miejska w Wyszkowie” z BIP-u — bez sprowadzenia do jednej
    // nazwy akt wszedłby do bazy drugi raz, bo klucz to (rodzaj, numer, organ).
    const organ = kanonicznyOrgan(akt.organ_zrodlowy) ?? 'nieustalony';
    const [zapisany] = await q(
      `INSERT INTO akt_prawny (organ, rodzaj, numer, data_podjecia, tytul, zrodlo, url_pdf, uwagi)
       VALUES ($1, 'uchwała', $2, $3, $4, 'uchwala', $5, $6)
       ON CONFLICT (rodzaj, numer, organ) DO UPDATE SET
         data_podjecia = COALESCE(EXCLUDED.data_podjecia, akt_prawny.data_podjecia),
         tytul = EXCLUDED.tytul,
         zrodlo = EXCLUDED.zrodlo,
         url_pdf = EXCLUDED.url_pdf,
         uwagi = EXCLUDED.uwagi
       RETURNING id`,
      [organ, akt.numer, akt.data_podjecia, akt.tytul,
       `/uchwaly/${akt.plik}`,
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
        nadpisania.set(u.id, {
          podstawa: podstawaPrawna({ ...akt, organ }),
          aktId: zapisany.id,
        });

        if (!liczbaOdcinkow.get(u.id) && !juzZaplanowane.has(u.id)) {
          juzZaplanowane.add(u.id);
          bezOdcinkow.push({
            ulica_id: u.id,
            miejscowosc: u.miejscowosc,
            nazwa: u.nazwa,
            dlugosc_km: poz.dlugosc_km,
            opis: poz.opis,
            podstawa: podstawaPrawna({ ...akt, organ }),
            aktId: zapisany.id,
          });
        }
      }
    }
  }

  for (const o of bezOdcinkow) {
    const [{ id: odcinekId }] = await q(
      `INSERT INTO odcinek_drogi
         (ulica_id, kategoria, zarzadca_id, opis_odcinka, dlugosc_m,
          podstawa_prawna, zrodlo, pewnosc, uwagi)
       VALUES ($1, 'gminna', $2, $3, $4, $5, 'uchwala', 3,
               'Odcinek założony na podstawie uchwały — BDOT10k go nie zna.')
       RETURNING id`,
      [o.ulica_id, idZarzadcy, o.opis,
       o.dlugosc_km == null ? null : Math.round(o.dlugosc_km * 1000), o.podstawa]
    );
    await klient.query(
      `INSERT INTO akt_odcinek (akt_id, odcinek_id, rola)
       VALUES ($1, $2, 'zaliczenie do kategorii')
       ON CONFLICT (akt_id, odcinek_id, rola) DO NOTHING`,
      [o.aktId, odcinekId]
    );
  }

  // ------------------------------------------------------------------
  // Reguła pierwszeństwa źródeł
  //
  // Uchwała rady jest aktem, który kategorię drogi *ustanawia*. BDOT10k to
  // odczyt z mapy — pomocny, ale wtórny. Gdy oba mówią co innego o drodze
  // wymienionej w uchwale, rozstrzyga uchwała.
  //
  // Dwa ograniczenia, oba celowe:
  //   - nie ruszamy odcinków krajowych, wojewódzkich i powiatowych. Uchwała
  //     rady gminy nie może przekwalifikować cudzej drogi; jeśli BDOT widzi
  //     tam wyższą kategorię, to znaczy, że ulica ma odcinki obu rodzajów
  //     i trzeba je rozdzielić w terenie, a nie zaklepać zapytaniem;
  //   - `zrodlo` zostaje przy `bdot10k`, bo stamtąd pochodzi sam odcinek
  //     i jego geometria. Uchwała odpowiada za kategorię i zarządcę —
  //     i to widać w `podstawa_prawna` oraz w `pewnosc`.
  //
  // Uchwała nie wskazuje odcinków tak, żeby dało się je dopasować do
  // geometrii, więc przypisanie jest na poziomie całej ulicy. Mówi o tym
  // wprost `uwagi`.
  //
  // WAŻNE: `db:seed` kasuje i odtwarza wszystkie odcinki o źródle
  // `bdot10k`, więc te nadpisania giną przy każdym odświeżeniu danych.
  // Dlatego `data:uchwaly` musi chodzić PO `db:seed` — reguła jest
  // wyliczana od nowa co tydzień, a nie zapisana raz na zawsze.
  // ------------------------------------------------------------------
  const idUlic = [...nadpisania.keys()];
  const podstawy = idUlic.map((id) => nadpisania.get(id).podstawa);
  const aktyDlaUlic = idUlic.map((id) => nadpisania.get(id).aktId);
  const NADRZEDNE = ['krajowa', 'wojewodzka', 'powiatowa'];

  const { rowCount: przekwalifikowanych } = await klient.query(
    `UPDATE odcinek_drogi o SET
       kategoria = 'gminna',
       zarzadca_id = $3,
       pewnosc = 3,
       zrodlo = 'uchwala',
       podstawa_prawna = p.podstawa,
       uwagi = COALESCE(o.uwagi || ' ', '') ||
               'Kategoria i zarządca z uchwały; BDOT10k widział tu drogę wewnętrzną. '
               || 'Przypisanie dotyczy całej ulicy — uchwała nie wskazuje odcinka '
               || 'w sposób pozwalający na dopasowanie do geometrii.',
       zmodyfikowano = now()
     FROM unnest($1::int[], $2::text[]) AS p(ulica_id, podstawa)
     WHERE o.ulica_id = p.ulica_id
       AND o.kategoria IN ('wewnetrzna', 'nieustalona')`,
    [idUlic, podstawy, idZarzadcy]
  );

  const { rowCount: potwierdzonych } = await klient.query(
    `UPDATE odcinek_drogi o SET
       zarzadca_id = COALESCE(o.zarzadca_id, $3),
       pewnosc = 3,
       zrodlo = 'uchwala',
       podstawa_prawna = p.podstawa,
       zmodyfikowano = now()
     FROM unnest($1::int[], $2::text[]) AS p(ulica_id, podstawa)
     WHERE o.ulica_id = p.ulica_id
       AND o.kategoria = 'gminna'
       AND (o.pewnosc < 3 OR o.podstawa_prawna IS DISTINCT FROM p.podstawa)`,
    [idUlic, podstawy, idZarzadcy]
  );

  // ------------------------------------------------------------------
  // akt_odcinek: klucz obcy, nie tylko tekst w podstawa_prawna.
  //
  // Oba UPDATE-y wyżej ustawiają zrodlo = 'uchwala' na dokładnie tych
  // odcinkach, które reguła pierwszeństwa właśnie przypisała do uchwały —
  // to ten sam znacznik, po którym rozpoznaje je scripts/seed.mjs. Stare
  // powiązania kasujemy przed odtworzeniem z tego samego powodu, co
  // akt_ulica/akt_droga wyżej: gdy zwycięski akt dla ulicy się zmienił
  // (poprawka w danych źródłowych), stare powiązanie nie może zostać.
  // ------------------------------------------------------------------
  await klient.query(
    `DELETE FROM akt_odcinek ao
       USING odcinek_drogi o
      WHERE ao.odcinek_id = o.id
        AND o.ulica_id = ANY($1::int[])
        AND ao.rola = 'zaliczenie do kategorii'`,
    [idUlic]
  );

  const { rowCount: powiazanOdcinkow } = await klient.query(
    `INSERT INTO akt_odcinek (akt_id, odcinek_id, rola)
     SELECT p.akt_id, o.id, 'zaliczenie do kategorii'
       FROM unnest($1::int[], $2::int[]) AS p(ulica_id, akt_id)
       JOIN odcinek_drogi o ON o.ulica_id = p.ulica_id
      WHERE o.zrodlo = 'uchwala'
     ON CONFLICT (akt_id, odcinek_id, rola) DO NOTHING`,
    [idUlic, aktyDlaUlic]
  );

  const nietkniete = (
    await q(
      `SELECT o.kategoria::text k, COUNT(*)::int n FROM odcinek_drogi o
        WHERE o.ulica_id = ANY($1) AND o.kategoria = ANY($2)
        GROUP BY 1 ORDER BY 2 DESC`,
      [idUlic, NADRZEDNE]
    )
  );

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
  process.stderr.write(
    `\nReguła pierwszeństwa (uchwała > BDOT10k):\n` +
      `  przekwalifikowanych z wewnętrznej na gminną: ${przekwalifikowanych}\n` +
      `  potwierdzonych jako gminne (podstawa prawna, pewność 3): ${potwierdzonych}\n` +
      `  powiązań akt–odcinek (akt_odcinek): ${powiazanOdcinkow}\n` +
      `  nietkniętych, bo kategoria nadrzędna: ` +
      (nietkniete.map((r) => `${r.k} ${r.n}`).join(', ') || 'brak') + '\n'
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
