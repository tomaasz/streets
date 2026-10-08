import dane from '../../data/raw/uchwaly-kategorie.json';
import powiazania from '../../db/seed/powiazania-odcinkow.json';
import { klucz, rozbijNazwe } from '../../scripts/lib/nazwy-ulic.mjs';
import { dodajPropozycje, type Kandydat } from './dopasowania';
import { hashZrodla, SQL_AKTYWNE_POWIAZANIA } from '../../scripts/lib/powiazania-zatwierdzone.mjs';
import { zapytaj } from './db';

import type { StatusPracy } from './kolejka-typy';
export { STATUSY } from './kolejka-typy';
export type RekordKolejki = {
  klucz: string; nazwa: string; miejscowosc: string; problem: string; dlugosc_m: number | null;
  slug?: string; akt?: string; pdf?: string; pozycja?: string; opis?: string;
  grupa: 'dopasowania' | 'geometria' | 'dokumenty' | 'zrodla' | 'obiekty';
  kandydaci?: Kandydat[]; propozycje_hash?:string; zrodlo_hash?:string; dane_pozycji?:Pozycja; blokada?:string;
  status: StatusPracy; notatka: string; zmodyfikowano?: string; waga: number;
};

export type Pozycja = {
  lp: number; ulica?: string | null; miejscowosc?: string | null; numer_drogi?: string | null;
  typ: string; watpliwa: boolean; nazwa_surowa?: string; przebieg?: string;
  dlugosc_km?: number | null; opis?: string;
};

export async function kolejkaWeryfikacji() {
  const [ulice, problemy, relacjeUlic, relacjeDrog, relacjeOdcinkow, praca, decyzje] = await Promise.all([
    zapytaj<{ id: number; simc: string; sym_ul: string; miejscowosc: string; cecha: string; nazwa: string; slug:string; hash:string }>('SELECT id,simc,sym_ul,miejscowosc,cecha,nazwa,slug,md5(geom::text) hash FROM ulica'),
    zapytaj<{ id: number; slug: string; nazwa_pelna: string; miejscowosc: string; problem: string; dlugosc_m: number | null; waga: number }>('SELECT * FROM v_braki ORDER BY waga,dlugosc_m DESC NULLS LAST,id'),
    zapytaj<{ numer: string; ulica_id: number }>('SELECT a.numer,au.ulica_id FROM akt_ulica au JOIN akt_prawny a ON a.id=au.akt_id'),
    zapytaj<{ akt: string; numer: string }>('SELECT a.numer akt,d.numer FROM akt_droga ad JOIN akt_prawny a ON a.id=ad.akt_id JOIN droga d ON d.id=ad.droga_id'),
    zapytaj<{ akt: string; numer: string }>("SELECT a.numer akt,o.nr_drogi numer FROM akt_odcinek ao JOIN akt_prawny a ON a.id=ao.akt_id JOIN odcinek_drogi o ON o.id=ao.odcinek_id WHERE ao.rola='zaliczenie do kategorii'"),
    zapytaj<{ klucz: string; status: StatusPracy; notatka: string; zmodyfikowano: string }>('SELECT klucz,status,notatka,to_char(zmodyfikowano,\'YYYY-MM-DD\') zmodyfikowano FROM weryfikacja_rekordu'),
    zapytaj<{klucz:string;zrodlo_hash:string;rodzaj:string}>(SQL_AKTYWNE_POWIAZANIA),
  ]);
  const poNazwie = new Map(ulice.map((u) => [klucz(u.miejscowosc,u.cecha,u.nazwa),u]));
  const poId = new Map(ulice.map((u) => [u.id,u]));
  const uRel = new Set(relacjeUlic.map((r) => `${r.numer}|${r.ulica_id}`));
  const dRel = new Set(relacjeDrog.map((r) => `${r.akt}|${r.numer}`));
  const oRel = new Set(relacjeOdcinkow.map((r) => `${r.akt}|${r.numer}`));
  const manual = new Map(powiazania.map((p) => [`${p.akt}|${p.zalacznik}|${p.lp}`,p.numer_bdot]));
  const historia = new Map(praca.map((p) => [p.klucz,p]));
  const wynik: RekordKolejki[] = problemy.map((p) => {
    const u = poId.get(p.id)!;
    return { klucz: `ulica:${u.simc.trim()}:${u.sym_ul.trim()}`, nazwa: p.nazwa_pelna,
      miejscowosc: p.miejscowosc, problem: p.problem, dlugosc_m: p.dlugosc_m,
      slug: p.slug, grupa:u.cecha==='skwer'||u.cecha==='rondo' ? 'obiekty' : p.problem==='brak zarządcy' ? 'dokumenty' : p.problem==='brak odcinków' ? 'geometria' : 'zrodla', status: 'do_weryfikacji', notatka: '', waga: p.waga };
  });
  for (const a of dane.akty) for (const z of a.zalaczniki) for (const p of z.pozycje as Pozycja[]) {
    const id = `${a.numer}|${z.zalacznik}|${p.lp}`;
    if(decyzje.some(d=>d.klucz===`uchwala:${id}` && d.zrodlo_hash===hashZrodla(p))) continue;
    const nr = manual.get(id);
    if (nr && oRel.has(`${a.numer}|${nr}`)) continue;
    let problem = 'brak powiązania pozycji uchwały';
    if (p.watpliwa) problem = 'wątpliwy odczyt dokumentu';
    else if (p.typ === 'numer' && p.numer_drogi && dRel.has(`${a.numer}|${p.numer_drogi}`)) continue;
    else if (p.typ === 'ulica' && p.ulica && p.miejscowosc) {
      const { cecha, nazwa } = rozbijNazwe(p.ulica);
      const u = poNazwie.get(klucz(p.miejscowosc,cecha,nazwa));
      if (u && uRel.has(`${a.numer}|${u.id}`)) continue;
      problem = u ? 'brak powiązania pozycji uchwały' : 'nazwa spoza aktualnego rejestru ulic';
    }
    wynik.push({ klucz: `uchwala:${id}`, nazwa: p.ulica || p.przebieg || p.numer_drogi || 'Droga bez nazwy',
      miejscowosc: p.miejscowosc || 'Przebieg między miejscowościami', problem,
      dlugosc_m: p.dlugosc_km == null ? null : Math.round(p.dlugosc_km * 1000),
      akt: a.numer, pdf: `/uchwaly/${a.plik}`, pozycja: z.zalacznik ? `Zał. ${z.zalacznik}, poz. ${p.lp}` : `§ 1, poz. ${p.lp}`,
      opis: p.opis, grupa:'dopasowania', dane_pozycji:p,zrodlo_hash:hashZrodla(p), status: 'do_weryfikacji', notatka: '', waga: 0 });
  }
  return dodajPropozycje(wynik.map((p) => ({ ...p, ...historia.get(p.klucz) })),ulice);
}
