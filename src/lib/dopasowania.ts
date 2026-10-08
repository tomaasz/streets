import { hashPropozycji } from '../../scripts/lib/powiazania-zatwierdzone.mjs';
import { zapytaj } from './db';
import { normalizuj, rozbijNazwe } from '../../scripts/lib/nazwy-ulic.mjs';
import type { RekordKolejki } from './kolejka';
export type Kandydat = {
  id:number; hash:string; simc:string|null; sym_ul:string|null; nr_drogi:string|null;
  slug:string|null; miejscowosc:string|null; nazwa:string; kategoria:string; dlugosc_m:number|null;
  pewnosc:number;zarzadca_id:number|null;powod:string; roznica_m:number|null;
};
type Ulica = {id:number;simc:string;sym_ul:string;miejscowosc:string;cecha:string;nazwa:string;slug:string;hash:string};
const kolumny = `o.id,md5(o.geom::text) hash,trim(u.simc) simc,trim(u.sym_ul) sym_ul,o.nr_drogi,
 u.slug,u.miejscowosc,COALESCE(u.nazwa_pelna,o.nr_drogi,'Odcinek bez nazwy') nazwa,
 o.kategoria::text kategoria,o.dlugosc_m,o.pewnosc,o.zarzadca_id`;
function odleglosc(a:string,b:string) {
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++) {const next=[i];for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[b.length];
}
export async function dodajPropozycje(rekordy:RekordKolejki[],ulice:Ulica[]) {
 const brakujace=rekordy.filter(r=>r.problem==='brak odcinków' && r.grupa!=='obiekty');
 const bliskie=brakujace.length ? await zapytaj<Kandydat & {ulica_id:number;odleglosc:number;pokrycie:number}>(`
 SELECT a.id ulica_id,k.* FROM ulica a JOIN LATERAL (
 SELECT ${kolumny},ST_Distance(ST_Transform(a.geom_pg,2180),ST_Transform(o.geom_pg,2180)) odleglosc,
 ST_Length(ST_Intersection(ST_Transform(o.geom_pg,2180),ST_Buffer(ST_Transform(a.geom_pg,2180),30))) /
 NULLIF(ST_Length(ST_Transform(o.geom_pg,2180)),0) pokrycie
 FROM odcinek_drogi o LEFT JOIN ulica u ON u.id=o.ulica_id
 WHERE o.ulica_id IS NULL AND o.geom_pg && ST_Expand(a.geom_pg,0.001)
 AND ST_DWithin(ST_Transform(a.geom_pg,2180),ST_Transform(o.geom_pg,2180),30)
 ORDER BY pokrycie DESC,o.id LIMIT 5
 ) k ON k.pokrycie>=0.5 WHERE a.id=ANY($1::int[])`,[brakujace.map(r=>ulice.find(u=>u.slug===r.slug)!.id)]) : [];
 for(const r of rekordy) {
   r.kandydaci=[];
   if(r.problem==='brak odcinków' && r.grupa!=='obiekty') {
     const u=ulice.find(u=>u.slug===r.slug)!;r.zrodlo_hash=u.hash;
     r.kandydaci=bliskie.filter(k=>k.ulica_id===u.id).map(k=>({...k,powod:`${Math.round(k.pokrycie*100)}% długości odcinka leży do 30 m od przebiegu PRG; najbliższa odległość ${Math.round(k.odleglosc)} m.`,roznica_m:r.dlugosc_m==null||k.dlugosc_m==null?null:k.dlugosc_m-r.dlugosc_m}));
   } else if(r.akt && r.dane_pozycji) {
     const p=r.dane_pozycji;
     if(p.typ==='numer') {r.blokada='Uchwała wskazuje numer drogi powiatowej. Potrzebne jest porównanie zakresu dokumentu i aktualnej kategorii; nie zmieniaj automatycznie całej drogi.';continue;}
     if(p.typ==='ulica' && p.ulica && p.miejscowosc) {
       const {cecha,nazwa}=rozbijNazwe(p.ulica);const target=normalizuj(nazwa);
       const podobne=ulice.filter(u=>u.miejscowosc===p.miejscowosc && u.cecha===cecha)
         .map(u=>({u,d:odleglosc(target,normalizuj(u.nazwa))})).filter(v=>v.d<=2 && v.d/Math.max(target.length,1)<=0.2).sort((a,b)=>a.d-b.d).slice(0,3);
       if(podobne.length) {
         const rows=await zapytaj<Kandydat>(`SELECT ${kolumny} FROM odcinek_drogi o JOIN ulica u ON u.id=o.ulica_id
          WHERE u.id=ANY($1::int[]) AND o.geom IS NOT NULL AND o.kategoria IN ('gminna','wewnetrzna','nieustalona') ORDER BY o.id`,[podobne.map(v=>v.u.id)]);
         r.kandydaci=rows.map(k=>({...k,powod:`Podobna nazwa w tej samej miejscowości: „${p.ulica}” → „${k.nazwa}”. Sprawdź końce odcinka wskazane w uchwale.`,roznica_m:r.dlugosc_m==null||k.dlugosc_m==null?null:k.dlugosc_m-r.dlugosc_m}));
       }
     } else {
       const miejscowosci=p.miejscowosc ? [p.miejscowosc] : (p.przebieg ?? '').split(/[–—]/).map(s=>s.trim()).filter(Boolean);
       if(miejscowosci.length) {
         const rows=await zapytaj<Kandydat>(`WITH obszar AS (
           SELECT ST_Expand(ST_Extent(geom_pg)::geometry,0.003) geom FROM ulica WHERE miejscowosc=ANY($1::text[]))
           SELECT ${kolumny} FROM odcinek_drogi o LEFT JOIN ulica u ON u.id=o.ulica_id CROSS JOIN obszar b
           WHERE o.geom_pg && b.geom AND o.kategoria IN ('gminna','wewnetrzna','nieustalona')
           ORDER BY ABS(COALESCE(o.dlugosc_m,0)-$2),o.id LIMIT 8`,[miejscowosci,r.dlugosc_m ?? 0]);
         r.kandydaci=rows.map(k=>({...k,powod:`Odcinek w otoczeniu miejscowości: ${miejscowosci.join(', ')}. Kolejność według zbliżonej długości; opis przebiegu wymaga sprawdzenia.`,roznica_m:r.dlugosc_m==null||k.dlugosc_m==null?null:k.dlugosc_m-r.dlugosc_m}));
       }
     }
   }
 }
 for(const r of rekordy) r.propozycje_hash=hashPropozycji(r.kandydaci ?? []);
 return rekordy;
}
