#!/usr/bin/env node
/**
 * Wypełnia bazę danymi z data/ i db/seed/.
 * Skrypt jest idempotentny — można go puścić ponownie po odświeżeniu danych.
 */
import { readFile } from 'node:fs/promises';
import { polaczenie, czytajCsv } from './lib/db.mjs';
import { doMultiLine } from './lib/pl1992.mjs';

const KAT = {
  krajowa: 'krajowa',
  'wojewódzka': 'wojewodzka',
  powiatowa: 'powiatowa',
  gminna: 'gminna',
  'wewnętrzna': 'wewnetrzna',
};
const ZARZADCA_DLA = {
  krajowa: 'gddkia-warszawa',
  wojewodzka: 'mzdw',
  powiatowa: 'zarzad-powiatu-wyszkowskiego',
  gminna: 'burmistrz-wyszkowa',
  wewnetrzna: null, // wymaga ustalenia właściciela w EGiB
};
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
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L');

const slugify = (s) =>
  bezOgonkow(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const klient = polaczenie();
  await klient.connect();
  await klient.query('BEGIN');

  const [zrodla, zarzadcy, opisy, prg, odc] = await Promise.all([
    readFile(new URL('../db/seed/zrodla.csv', import.meta.url), 'utf8').then(czytajCsv),
    readFile(new URL('../db/seed/zarzadcy.csv', import.meta.url), 'utf8').then(czytajCsv),
    readFile(new URL('../db/seed/drogi-opisy.csv', import.meta.url), 'utf8').then(czytajCsv),
    readFile(new URL('../data/raw/prg-ulice.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../data/odcinki.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  // --- słowniki --------------------------------------------------------
  for (const z of zrodla) {
    await klient.query(
      `INSERT INTO zrodlo_danych (kod, nazwa, gestor, url, licencja, domyslna_pewnosc, opis)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (kod) DO UPDATE SET
         nazwa = EXCLUDED.nazwa, gestor = EXCLUDED.gestor, url = EXCLUDED.url,
         licencja = EXCLUDED.licencja, domyslna_pewnosc = EXCLUDED.domyslna_pewnosc,
         opis = EXCLUDED.opis`,
      [z.kod, z.nazwa, z.gestor, z.url, z.licencja, Number(z.domyslna_pewnosc), z.opis]
    );
  }

  const idZarzadcy = new Map();
  for (const z of zarzadcy) {
    const { rows } = await klient.query(
      `INSERT INTO zarzadca (kod, nazwa, typ, podstawa_prawna, jednostka, adres, telefon, email, www, uwagi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (kod) DO UPDATE SET
         nazwa = EXCLUDED.nazwa, typ = EXCLUDED.typ,
         podstawa_prawna = EXCLUDED.podstawa_prawna, jednostka = EXCLUDED.jednostka,
         adres = EXCLUDED.adres, telefon = EXCLUDED.telefon, email = EXCLUDED.email,
         www = EXCLUDED.www, uwagi = EXCLUDED.uwagi
       RETURNING id`,
      [z.kod, z.nazwa, z.typ, z.podstawa_prawna, z.jednostka, z.adres,
       z.telefon, z.email, z.www, z.uwagi]
    );
    idZarzadcy.set(z.kod, rows[0].id);
  }
  process.stderr.write(`Słowniki: ${zrodla.length} źródeł, ${zarzadcy.length} zarządców\n`);

  // --- ulice z PRG ------------------------------------------------------
  const idUlicy = new Map();
  const uzyteSlugi = new Set();
  for (const u of prg.ulice) {
    const { cecha, nazwa } = rozbijNazwe(u.nazwa);
    let slug = `${slugify(u.miejscowosc)}-${slugify(nazwa)}`;
    if (uzyteSlugi.has(slug)) slug = `${slug}-${u.sym_ul}`;
    uzyteSlugi.add(slug);

    const { rows } = await klient.query(
      `INSERT INTO ulica (simc, sym_ul, terc_gmina, miejscowosc, cecha, nazwa, slug,
                          dlugosc_m, x_2180, y_2180, geom, zrodlo, aktualizacja)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'prg',$12)
       ON CONFLICT (simc, sym_ul) DO UPDATE SET
         miejscowosc = EXCLUDED.miejscowosc, cecha = EXCLUDED.cecha,
         nazwa = EXCLUDED.nazwa, slug = EXCLUDED.slug, dlugosc_m = EXCLUDED.dlugosc_m,
         x_2180 = EXCLUDED.x_2180, y_2180 = EXCLUDED.y_2180, geom = EXCLUDED.geom,
         aktualizacja = EXCLUDED.aktualizacja
       RETURNING id`,
      [u.simc, u.sym_ul, u.terc_gmina, u.miejscowosc, cecha, nazwa, slug,
       u.dlugosc_m, u.x_2180, u.y_2180, JSON.stringify(doMultiLine(u.geom)), prg.pobrano]
    );
    idUlicy.set(`${u.simc}:${u.sym_ul}`, rows[0].id);
  }
  process.stderr.write(`Ulice: ${idUlicy.size}\n`);

  // --- rejestr numerowanych dróg ---------------------------------------
  const opisWg = new Map(opisy.map((o) => [o.numer, o]));
  const drogiZOdcinkow = new Map();
  for (const o of odc.odcinki) {
    if (!o.numer) continue;
    const kat = KAT[o.kategoria_bdot] ?? 'nieustalona';
    const rec = drogiZOdcinkow.get(o.numer) ?? { kategoria: kat, klasa: o.klasa, dlugosc: 0 };
    rec.dlugosc += o.dlugosc_m;
    drogiZOdcinkow.set(o.numer, rec);
  }

  const idDrogi = new Map();
  for (const [numer, rec] of drogiZOdcinkow) {
    const opis = opisWg.get(numer);
    const { rows } = await klient.query(
      `INSERT INTO droga (numer, kategoria, klasa, przebieg, zarzadca_id,
                          dlugosc_gmina_m, zrodlo, pewnosc, uwagi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (numer) DO UPDATE SET
         kategoria = EXCLUDED.kategoria, klasa = EXCLUDED.klasa,
         przebieg = COALESCE(EXCLUDED.przebieg, droga.przebieg),
         zarzadca_id = EXCLUDED.zarzadca_id,
         dlugosc_gmina_m = EXCLUDED.dlugosc_gmina_m, uwagi = EXCLUDED.uwagi
       RETURNING id`,
      [numer, rec.kategoria, rec.klasa, opis?.przebieg ?? null,
       idZarzadcy.get(ZARZADCA_DLA[rec.kategoria]) ?? null,
       Math.round(rec.dlugosc), opis?.zrodlo ?? 'bdot10k',
       opis ? 2 : 1, opis?.uwagi ?? null]
    );
    idDrogi.set(numer, rows[0].id);
  }
  process.stderr.write(`Drogi numerowane: ${idDrogi.size}\n`);

  // --- odcinki ----------------------------------------------------------
  await klient.query('DELETE FROM odcinek_drogi WHERE zrodlo = $1', ['bdot10k']);
  let wstawione = 0;
  for (const o of odc.odcinki) {
    const kat = KAT[o.kategoria_bdot] ?? 'nieustalona';
    const ulicaId = o.ulica ? idUlicy.get(`${o.ulica.simc}:${o.ulica.sym_ul}`) ?? null : null;
    const drogaId = o.numer ? idDrogi.get(o.numer) ?? null : null;
    await klient.query(
      `INSERT INTO odcinek_drogi
         (ulica_id, droga_id, kategoria, nr_drogi, klasa, zarzadca_id,
          dlugosc_m, nawierzchnia, zrodlo, pewnosc, opis_odcinka, geom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'bdot10k',1,$9,$10)`,
      [ulicaId, drogaId, kat, o.numer, o.klasa,
       idZarzadcy.get(ZARZADCA_DLA[kat]) ?? null,
       o.dlugosc_m, o.nawierzchnia,
       o.nazwa_drogi ?? (o.ulica ? null : 'odcinek bez nazwanej ulicy'),
       JSON.stringify(doMultiLine(o.geom))]
    );
    wstawione++;
  }
  process.stderr.write(`Odcinki: ${wstawione}\n`);

  await klient.query('COMMIT');
  await klient.end();
  process.stderr.write('Gotowe.\n');
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
