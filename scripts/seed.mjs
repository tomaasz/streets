#!/usr/bin/env node
/**
 * Wypełnia bazę danymi z data/ i db/seed/.
 * Skrypt jest idempotentny — można go puścić ponownie po odświeżeniu danych.
 */
import { readFile } from 'node:fs/promises';
import { polaczenieZeSchematem, czytajCsv } from './lib/db.mjs';
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

/**
 * Wysyła wiersze paczkami, jako jeden parametr JSON na zapytanie.
 * Wersja z osobnym INSERT-em na wiersz robiła ~4600 podróży do bazy —
 * lokalnie to sekunda, ale przez sieć do bazy w chmurze kwadrans.
 */
async function wsadem(klient, wiersze, sql, rozmiar = 500) {
  const zwrocone = [];
  for (let i = 0; i < wiersze.length; i += rozmiar) {
    const { rows } = await klient.query(sql, [
      JSON.stringify(wiersze.slice(i, i + rozmiar)),
    ]);
    zwrocone.push(...rows);
  }
  return zwrocone;
}

const bezOgonkow = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L');

const slugify = (s) =>
  bezOgonkow(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const { klient, nazwa } = await polaczenieZeSchematem();
  process.stderr.write(`Schemat: ${nazwa}\n`);
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
      `INSERT INTO zrodlo_danych (kod, skrot, nazwa, gestor, url, licencja, domyslna_pewnosc, opis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (kod) DO UPDATE SET
         skrot = EXCLUDED.skrot, nazwa = EXCLUDED.nazwa, gestor = EXCLUDED.gestor,
         url = EXCLUDED.url, licencja = EXCLUDED.licencja,
         domyslna_pewnosc = EXCLUDED.domyslna_pewnosc, opis = EXCLUDED.opis`,
      [z.kod, z.skrot ?? z.kod, z.nazwa, z.gestor, z.url, z.licencja,
       Number(z.domyslna_pewnosc), z.opis]
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
  const uzyteSlugi = new Set();
  const wierszeUlic = prg.ulice.map((u) => {
    const { cecha, nazwa } = rozbijNazwe(u.nazwa);
    let slug = `${slugify(u.miejscowosc)}-${slugify(nazwa)}`;
    if (uzyteSlugi.has(slug)) slug = `${slug}-${u.sym_ul}`;
    uzyteSlugi.add(slug);
    return {
      simc: u.simc, sym_ul: u.sym_ul, terc_gmina: u.terc_gmina,
      miejscowosc: u.miejscowosc, cecha, nazwa, slug,
      dlugosc_m: u.dlugosc_m, x_2180: u.x_2180, y_2180: u.y_2180,
      geom: doMultiLine(u.geom), aktualizacja: prg.pobrano,
    };
  });

  const zwroconeUlice = await wsadem(klient, wierszeUlic, `
    INSERT INTO ulica (simc, sym_ul, terc_gmina, miejscowosc, cecha, nazwa, slug,
                       dlugosc_m, x_2180, y_2180, geom, zrodlo, aktualizacja)
    SELECT simc, sym_ul, terc_gmina, miejscowosc, cecha, nazwa, slug,
           dlugosc_m, x_2180, y_2180, geom, 'prg', aktualizacja
      FROM json_to_recordset($1::json) AS x(
        simc char(7), sym_ul char(5), terc_gmina char(6), miejscowosc text,
        cecha text, nazwa text, slug text, dlugosc_m integer,
        x_2180 numeric, y_2180 numeric, geom jsonb, aktualizacja date)
    ON CONFLICT (simc, sym_ul) DO UPDATE SET
      miejscowosc = EXCLUDED.miejscowosc, cecha = EXCLUDED.cecha,
      nazwa = EXCLUDED.nazwa, slug = EXCLUDED.slug, dlugosc_m = EXCLUDED.dlugosc_m,
      x_2180 = EXCLUDED.x_2180, y_2180 = EXCLUDED.y_2180, geom = EXCLUDED.geom,
      aktualizacja = EXCLUDED.aktualizacja
    RETURNING id, simc, sym_ul`);

  const idUlicy = new Map(
    zwroconeUlice.map((r) => [`${r.simc}:${r.sym_ul}`, r.id])
  );
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

  const wierszeDrog = [...drogiZOdcinkow].map(([numer, rec]) => {
    const opis = opisWg.get(numer);
    return {
      numer,
      kategoria: rec.kategoria,
      klasa: rec.klasa,
      przebieg: opis?.przebieg ?? null,
      zarzadca_id: idZarzadcy.get(ZARZADCA_DLA[rec.kategoria]) ?? null,
      dlugosc_gmina_m: Math.round(rec.dlugosc),
      zrodlo: opis?.zrodlo ?? 'bdot10k',
      // pewność z pliku opisów; bez opisu zostaje surowy import z BDOT
      pewnosc: opis ? Number(opis.pewnosc ?? 2) : 1,
      uwagi: opis?.uwagi ?? null,
    };
  });

  const zwroconeDrogi = await wsadem(klient, wierszeDrog, `
    INSERT INTO droga (numer, kategoria, klasa, przebieg, zarzadca_id,
                       dlugosc_gmina_m, zrodlo, pewnosc, uwagi)
    SELECT numer, kategoria::kategoria_drogi, klasa, przebieg, zarzadca_id,
           dlugosc_gmina_m, zrodlo, pewnosc, uwagi
      FROM json_to_recordset($1::json) AS x(
        numer text, kategoria text, klasa text, przebieg text,
        zarzadca_id smallint, dlugosc_gmina_m integer, zrodlo text,
        pewnosc smallint, uwagi text)
    ON CONFLICT (numer) DO UPDATE SET
      kategoria = EXCLUDED.kategoria, klasa = EXCLUDED.klasa,
      przebieg = COALESCE(EXCLUDED.przebieg, droga.przebieg),
      zarzadca_id = EXCLUDED.zarzadca_id,
      dlugosc_gmina_m = EXCLUDED.dlugosc_gmina_m, uwagi = EXCLUDED.uwagi,
      -- bez tych dwóch kolumn ponowny wsad zostawiał starą pewność
      -- i rekord z opisem nadal wyglądał na surowy import
      zrodlo = EXCLUDED.zrodlo, pewnosc = EXCLUDED.pewnosc
    RETURNING id, numer`);

  const idDrogi = new Map(zwroconeDrogi.map((r) => [r.numer, r.id]));
  process.stderr.write(`Drogi numerowane: ${idDrogi.size}\n`);

  // --- odcinki ----------------------------------------------------------
  await klient.query('DELETE FROM odcinek_drogi WHERE zrodlo = $1', ['bdot10k']);

  const wierszeOdcinkow = odc.odcinki.map((o) => {
    const kat = KAT[o.kategoria_bdot] ?? 'nieustalona';
    return {
      ulica_id: o.ulica
        ? idUlicy.get(`${o.ulica.simc}:${o.ulica.sym_ul}`) ?? null
        : null,
      droga_id: o.numer ? idDrogi.get(o.numer) ?? null : null,
      kategoria: kat,
      nr_drogi: o.numer,
      klasa: o.klasa,
      zarzadca_id: idZarzadcy.get(ZARZADCA_DLA[kat]) ?? null,
      dlugosc_m: o.dlugosc_m,
      nawierzchnia: o.nawierzchnia,
      opis_odcinka: o.nazwa_drogi ?? (o.ulica ? null : 'odcinek bez nazwanej ulicy'),
      geom: doMultiLine(o.geom),
    };
  });

  // Geometria potrafi ważyć, więc paczki są mniejsze niż przy słownikach.
  await wsadem(klient, wierszeOdcinkow, `
    INSERT INTO odcinek_drogi
      (ulica_id, droga_id, kategoria, nr_drogi, klasa, zarzadca_id,
       dlugosc_m, nawierzchnia, zrodlo, pewnosc, opis_odcinka, geom)
    SELECT ulica_id, droga_id, kategoria::kategoria_drogi, nr_drogi, klasa,
           zarzadca_id, dlugosc_m, nawierzchnia, 'bdot10k', 1, opis_odcinka, geom
      FROM json_to_recordset($1::json) AS x(
        ulica_id integer, droga_id integer, kategoria text, nr_drogi text,
        klasa text, zarzadca_id smallint, dlugosc_m integer,
        nawierzchnia text, opis_odcinka text, geom jsonb)`, 250);
  const wstawione = wierszeOdcinkow.length;
  process.stderr.write(`Odcinki: ${wstawione}\n`);

  await klient.query('COMMIT');
  await klient.end();
  process.stderr.write('Gotowe.\n');
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
