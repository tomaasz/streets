import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const SQL_AKTYWNE_POWIAZANIA = `SELECT d.klucz,d.zrodlo_hash,d.rodzaj FROM powiazanie_zatwierdzone d
      WHERE d.rodzaj='uchwala' AND jsonb_array_length(d.cel->'odcinki')>0 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(d.cel->'odcinki') c WHERE NOT EXISTS (
      SELECT 1 FROM odcinek_drogi o JOIN akt_odcinek ao ON ao.odcinek_id=o.id JOIN akt_prawny a ON a.id=ao.akt_id
      WHERE md5(o.geom::text)=c->>'hash' AND o.kategoria='gminna' AND ao.rola='zaliczenie do kategorii'
      AND a.numer=split_part(substring(d.klucz from 9),'|',1)))`;

export const hashZrodla = (p) => createHash('sha256').update(JSON.stringify(p)).digest('hex');
export const hashPropozycji = (kandydaci) => hashZrodla(kandydaci.map(k=>({id:k.id,hash:k.hash,nr:k.nr_drogi,simc:k.simc,sym_ul:k.sym_ul,kategoria:k.kategoria,dlugosc:k.dlugosc_m,pewnosc:k.pewnosc,zarzadca:k.zarzadca_id})));
export async function zastosujPowiazanie(klient, decyzja, dane, {sprawdzStan=false}={}) {
  const cel=typeof decyzja.cel==='string' ? JSON.parse(decyzja.cel) : decyzja.cel;
  let akt,pozycja;
  if(decyzja.rodzaj==='uchwala') {
    for(const a of dane.akty) for(const z of a.zalaczniki) for(const p of z.pozycje)
      if(`uchwala:${a.numer}|${z.zalacznik}|${p.lp}`===decyzja.klucz) {akt=a;pozycja=p;}
    if(!pozycja || hashZrodla(pozycja)!==decyzja.zrodlo_hash) throw new Error('Treść pozycji uchwały zmieniła się. Wymagane ponowne porównanie.');
  }
  let ulica;
  if(decyzja.rodzaj==='geometria') {
    [ulica]=(await klient.query('SELECT id,md5(geom::text) hash FROM ulica WHERE simc=$1 AND sym_ul=$2',[cel.simc,cel.sym_ul])).rows;
    if(!ulica || ulica.hash!==decyzja.zrodlo_hash) throw new Error('Przebieg PRG zmienił się. Wymagane ponowne porównanie.');
  }
  const odcinki=[];
  for(const c of cel.odcinki) {
    const rows=(await klient.query(`SELECT o.*,u.simc,u.sym_ul FROM odcinek_drogi o LEFT JOIN ulica u ON u.id=o.ulica_id
      WHERE md5(o.geom::text)=$1 AND o.nr_drogi IS NOT DISTINCT FROM $2 FOR UPDATE OF o`,[c.hash,c.nr_drogi])).rows;
    if(rows.length!==1) throw new Error('Geometria odcinka zmieniła się lub jest niejednoznaczna. Odśwież propozycje.');
    const o=rows[0];
    if(sprawdzStan && (o.kategoria!==c.kategoria || o.zarzadca_id!==c.zarzadca_id || o.pewnosc!==c.pewnosc || o.dlugosc_m!==c.dlugosc_m)) throw new Error('Dane odcinka zmieniły się od wyświetlenia propozycji. Odśwież wyniki.');
    if((o.simc?.trim() ?? null)!==c.simc || (o.sym_ul?.trim() ?? null)!==c.sym_ul) {
      if(!(decyzja.rodzaj==='geometria' && o.ulica_id===ulica.id)) throw new Error('Odcinek przypisano już do innej ulicy.');
    }
    if(decyzja.rodzaj==='uchwala' && !['gminna','wewnetrzna','nieustalona'].includes(o.kategoria)) throw new Error('Odcinek ma kategorię nadrzędną. Nie można zmienić go uchwałą gminy.');
    odcinki.push(o);
  }
  if(!odcinki.length) throw new Error('Wybierz co najmniej jeden odcinek.');
  if(decyzja.rodzaj==='geometria') {
    await klient.query('UPDATE odcinek_drogi SET ulica_id=$1 WHERE id=ANY($2::int[])',[ulica.id,odcinki.map(o=>o.id)]);
  } else {
    const [a]=(await klient.query("SELECT id FROM akt_prawny WHERE numer=$1 AND rodzaj='uchwała' AND url_pdf=$2",[akt.numer,`/uchwaly/${akt.plik}`])).rows;
    if(!a) throw new Error('Brak jednoznacznego aktu prawnego w bazie.');
    const newer=(await klient.query(`SELECT 1 FROM akt_odcinek ao JOIN akt_prawny a ON a.id=ao.akt_id
      WHERE ao.odcinek_id=ANY($1::int[]) AND ao.rola='zaliczenie do kategorii' AND a.data_podjecia>$2::date LIMIT 1`,[odcinki.map(o=>o.id),akt.data_podjecia])).rows;
    if(newer.length) throw new Error('Odcinek ma nowszą podstawę prawną. Potrzebne porównanie dokumentów.');
    const [z]=(await klient.query("SELECT id FROM zarzadca WHERE kod='burmistrz-wyszkowa'")).rows;
    if(!z) throw new Error('Brak zarządcy gminnego w bazie.');
    for(const o of odcinki) {
      await klient.query(`UPDATE odcinek_drogi SET kategoria='gminna',zarzadca_id=$2,pewnosc=3,
        podstawa_prawna=$3,data_weryfikacji=CURRENT_DATE,
        opis_odcinka=CASE WHEN ulica_id IS NULL THEN $4 ELSE opis_odcinka END WHERE id=$1`,
        [o.id,z.id,`Uchwała nr ${akt.numer} z dnia ${akt.data_podjecia}`,`${cel.miejscowosc ? cel.miejscowosc+': ' : ''}${pozycja.przebieg || pozycja.ulica || pozycja.opis || 'Droga bez nazwy'}`]);
      await klient.query(`INSERT INTO akt_odcinek(akt_id,odcinek_id,rola,uwagi) VALUES($1,$2,'zaliczenie do kategorii',$3)
        ON CONFLICT(akt_id,odcinek_id,rola) DO UPDATE SET uwagi=EXCLUDED.uwagi`,[a.id,o.id,`${decyzja.klucz}; zatwierdzono w aplikacji. ${decyzja.uzasadnienie}`]);
      if(o.ulica_id) await klient.query(`INSERT INTO akt_ulica(akt_id,ulica_id,rola,uwagi) VALUES($1,$2,'dotyczy',$3)
        ON CONFLICT(akt_id,ulica_id,rola) DO UPDATE SET uwagi=EXCLUDED.uwagi`,[a.id,o.ulica_id,decyzja.klucz]);
    }
  }
  return odcinki.map(o=>o.id);
}

export async function odtworzPowiazania(klient, {tylkoGeometria=false}={}) {
  if(!(await klient.query("SELECT to_regclass('powiazanie_zatwierdzone') istnieje")).rows[0].istnieje) return;
  const dane=JSON.parse(await readFile(new URL('../../data/raw/uchwaly-kategorie.json',import.meta.url),'utf8'));
  const rows=(await klient.query(`SELECT * FROM powiazanie_zatwierdzone ${tylkoGeometria ? "WHERE rodzaj='geometria'" : ''} ORDER BY rodzaj,utworzono`)).rows;
  for(const r of rows) {
    await klient.query('SAVEPOINT powiazanie');
    try {await zastosujPowiazanie(klient,r,dane);await klient.query('RELEASE SAVEPOINT powiazanie');}
    catch(e) {await klient.query('ROLLBACK TO SAVEPOINT powiazanie');await klient.query('RELEASE SAVEPOINT powiazanie');process.stderr.write(`Powiązanie ${r.klucz} wymaga ponownego sprawdzenia: ${e.message}\n`);}
  }
}
