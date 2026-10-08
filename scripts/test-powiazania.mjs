#!/usr/bin/env node
// Integracja na izolowanej kopii schematu; dane aplikacji są wyłącznie czytane.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {polaczenieZeSchematem,sprawdzSchemat} from './lib/db.mjs';
import {hashZrodla,zastosujPowiazanie,odtworzPowiazania} from './lib/powiazania-zatwierdzone.mjs';
const {klient,nazwa}=await polaczenieZeSchematem();
const test=sprawdzSchemat(`streets_test_${Date.now()}`);
const dane=JSON.parse(await readFile(new URL('../data/raw/uchwaly-kategorie.json',import.meta.url),'utf8'));
try {
 await klient.query(`CREATE SCHEMA "${test}"`);await klient.query(`SET search_path TO "${test}",public`);
 const migrations=new URL('../db/migrations/',import.meta.url);
 for(const f of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort()) await klient.query(await readFile(new URL(f,migrations),'utf8'));
 for(const table of ['zrodlo_danych','zarzadca','droga','ulica','odcinek_drogi','akt_prawny','akt_ulica','akt_droga','akt_odcinek','weryfikacja_rekordu']) {
  const columns=(await klient.query(`SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_generated='NEVER' ORDER BY ordinal_position`,[test,table])).rows;
  const cols=columns.map(c=>`"${c.column_name}"`).join(',');
  const source=columns.map(c=>c.udt_name==='kategoria_drogi'?`"${c.column_name}"::text::"${test}".kategoria_drogi`:`"${c.column_name}"`).join(',');
  await klient.query(`INSERT INTO "${test}"."${table}" (${cols}) SELECT ${source} FROM "${nazwa}"."${table}"`);
  if(columns.some(c=>c.column_name==='id')) await klient.query(`SELECT setval(pg_get_serial_sequence('"${test}"."${table}"','id'),GREATEST(COALESCE((SELECT max(id) FROM "${test}"."${table}"),1),1))`);
 }
 await klient.query('BEGIN');
 const a=dane.akty.find(a=>a.numer==='XXVII/264/16');const p=a.zalaczniki.find(z=>z.zalacznik===1).pozycje.find(p=>p.lp===85);
 const [o]=(await klient.query(`SELECT o.*,md5(o.geom::text) hash,trim(u.simc) simc,trim(u.sym_ul) sym_ul FROM odcinek_drogi o JOIN ulica u ON u.id=o.ulica_id WHERE u.slug='wyszkow-monte-cassino' ORDER BY o.id LIMIT 1`)).rows;
 assert.ok(o,'Wymagane dane testowe Monte Cassino');
 const decyzja={klucz:'uchwala:XXVII/264/16|1|85',rodzaj:'uchwala',zrodlo_hash:hashZrodla(p),uzasadnienie:'Test: porównano pozycję uchwały i cały odcinek.',cel:{nazwa:'Monte Casino',odcinki:[{hash:o.hash,nr_drogi:o.nr_drogi,simc:o.simc,sym_ul:o.sym_ul,kategoria:o.kategoria,zarzadca_id:o.zarzadca_id,pewnosc:o.pewnosc,dlugosc_m:o.dlugosc_m}]}};
 await assert.rejects(zastosujPowiazanie(klient,{...decyzja,zrodlo_hash:'nieaktualne'},dane),/Treść pozycji/);
 await zastosujPowiazanie(klient,decyzja,dane,{sprawdzStan:true});
 assert.equal((await klient.query('SELECT pewnosc FROM odcinek_drogi WHERE id=$1',[o.id])).rows[0].pewnosc,3);
 assert.ok((await klient.query(`SELECT 1 FROM akt_odcinek WHERE odcinek_id=$1 AND rola='zaliczenie do kategorii'`,[o.id])).rows.length);
 await klient.query('INSERT INTO powiazanie_zatwierdzone(klucz,rodzaj,zrodlo_hash,cel,uzasadnienie) VALUES($1,$2,$3,$4,$5)',[decyzja.klucz,decyzja.rodzaj,decyzja.zrodlo_hash,JSON.stringify(decyzja.cel),decyzja.uzasadnienie]);
 // Symulacja importu: zmieniają się ID, a geometria i klucz naturalny pozostają.
 await klient.query('DELETE FROM odcinek_drogi WHERE id=$1',[o.id]);
 const [nowy]=(await klient.query(`INSERT INTO odcinek_drogi(ulica_id,kategoria,nr_drogi,zrodlo,geom,dlugosc_m,pewnosc) VALUES($1,'gminna',$2,$3,$4,$5,1) RETURNING id`,[o.ulica_id,o.nr_drogi,o.zrodlo,o.geom,o.dlugosc_m])).rows;
 assert.notEqual(nowy.id,o.id);
 await odtworzPowiazania(klient);await odtworzPowiazania(klient);
 assert.equal((await klient.query('SELECT pewnosc FROM odcinek_drogi WHERE id=$1',[nowy.id])).rows[0].pewnosc,3);
 assert.equal((await klient.query(`SELECT count(*)::int n FROM akt_odcinek WHERE odcinek_id=$1 AND rola='zaliczenie do kategorii'`,[nowy.id])).rows[0].n,1);
 console.log('PASS: zatwierdzenie uchwały, zmiana ID po imporcie, odtworzenie oraz idempotencja.');
 const [u]=(await klient.query("SELECT id,trim(simc) simc,trim(sym_ul) sym_ul,md5(geom::text) hash FROM ulica WHERE cecha='ul.' LIMIT 1")).rows;
 const [bez]=(await klient.query('SELECT *,md5(geom::text) hash FROM odcinek_drogi WHERE ulica_id IS NULL AND geom IS NOT NULL LIMIT 1')).rows;
 const g={klucz:`ulica:${u.simc}:${u.sym_ul}`,rodzaj:'geometria',zrodlo_hash:u.hash,uzasadnienie:'Test: przebieg geometryczny porównany z PRG.',cel:{simc:u.simc,sym_ul:u.sym_ul,odcinki:[{hash:bez.hash,nr_drogi:bez.nr_drogi,simc:null,sym_ul:null}]}};
 await zastosujPowiazanie(klient,g,dane);await zastosujPowiazanie(klient,g,dane);
 const [po]=(await klient.query('SELECT * FROM odcinek_drogi WHERE id=$1',[bez.id])).rows;
 assert.equal(po.ulica_id,u.id);
 for(const field of ['kategoria','zarzadca_id','pewnosc','geom']) assert.deepEqual(po[field],bez[field]);
 await assert.rejects(zastosujPowiazanie(klient,{...g,zrodlo_hash:'nieaktualne'},dane),/Przebieg PRG/);
 await klient.query(`UPDATE odcinek_drogi SET kategoria='powiatowa' WHERE id=$1`,[nowy.id]);
 await assert.rejects(zastosujPowiazanie(klient,decyzja,dane),/nadrzędną/);
 console.log('PASS: geometria bez zmiany danych prawnych; blokada zmienionego PRG i kategorii nadrzędnej.');
 await klient.query('ROLLBACK');
} finally {
 await klient.query('ROLLBACK');
 await klient.query(`DROP SCHEMA IF EXISTS "${test}" CASCADE`);
 await klient.end();
}
