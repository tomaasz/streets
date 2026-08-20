#!/usr/bin/env node
/**
 * Wypisuje stan bazy w Markdownie — do wklejenia w notatce służbowej
 * albo do szybkiego sprawdzenia po odświeżeniu danych.
 *   node scripts/raport.mjs > raport.md
 */
import { polaczenieZeSchematem } from './lib/db.mjs';

const { klient } = await polaczenieZeSchematem();

const q = async (sql, par = []) => (await klient.query(sql, par)).rows;
const km = (m) => (Number(m ?? 0) / 1000).toFixed(1).replace('.', ',');

const [ogol] = await q(`
  SELECT (SELECT COUNT(*) FROM ulica)                            AS ulic,
         (SELECT COUNT(DISTINCT miejscowosc) FROM ulica)         AS miejscowosci,
         (SELECT COUNT(*) FROM odcinek_drogi)                    AS odcinkow,
         (SELECT COUNT(*) FROM droga)                            AS drog,
         (SELECT COALESCE(SUM(dlugosc_m),0) FROM odcinek_drogi)  AS metrow`);

console.log('# Stan bazy dróg gminy Wyszków\n');
console.log(`Wygenerowano zapytaniem \`scripts/raport.mjs\`.\n`);
console.log(`- ulic: **${ogol.ulic}** w ${ogol.miejscowosci} miejscowościach`);
console.log(`- odcinków dróg: **${ogol.odcinkow}**`);
console.log(`- dróg numerowanych: **${ogol.drog}**`);
console.log(`- długość sieci: **${km(ogol.metrow)} km**\n`);

console.log('## Wg kategorii\n');
console.log('| Kategoria | Zarządca | Ulic | Odcinków | Długość [km] |');
console.log('|---|---|---:|---:|---:|');
for (const r of await q(`SELECT * FROM v_statystyki_kategorii`)) {
  console.log(
    `| ${r.kategoria} | ${r.zarzadca ?? '—'} | ${r.liczba_ulic} | ${r.liczba_odcinkow} | ${km(r.dlugosc_m)} |`
  );
}

console.log('\n## Drogi publiczne numerowane\n');
console.log('| Numer | Kategoria | Przebieg | Długość w gminie [km] | Pewność |');
console.log('|---|---|---|---:|---:|');
for (const r of await q(`
  SELECT numer, kategoria::text AS kategoria, przebieg, dlugosc_gmina_m, pewnosc
    FROM droga WHERE kategoria IN ('krajowa','wojewodzka','powiatowa')
   ORDER BY kategoria, numer`)) {
  console.log(
    `| ${r.numer} | ${r.kategoria} | ${r.przebieg ?? '—'} | ${km(r.dlugosc_gmina_m)} | ${r.pewnosc}/3 |`
  );
}

console.log('\n## Ulice o więcej niż jednym zarządcy\n');
const dzielone = await q(
  `SELECT nazwa_pelna, miejscowosc, zarzadcy, numery_drog, dlugosc_m
     FROM v_ulica_zarzadcy WHERE wielu_zarzadcow ORDER BY dlugosc_m DESC NULLS LAST`
);
console.log(`Takich ulic jest ${dzielone.length}.\n`);
console.log('| Ulica | Miejscowość | Zarządcy | Numery dróg |');
console.log('|---|---|---|---|');
for (const r of dzielone) {
  console.log(
    `| ${r.nazwa_pelna} | ${r.miejscowosc} | ${r.zarzadcy.join('; ')} | ${r.numery_drog.join(', ') || '—'} |`
  );
}

console.log('\n## Do domknięcia\n');
console.log('| Problem | Ulic |');
console.log('|---|---:|');
for (const r of await q(
  `SELECT problem, COUNT(*) AS ile FROM v_braki GROUP BY problem ORDER BY COUNT(*) DESC`
)) {
  console.log(`| ${r.problem} | ${r.ile} |`);
}

await klient.end();
