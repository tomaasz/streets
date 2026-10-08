import {zapytaj} from './db';
import {odczytajUug} from '../../scripts/lib/uug.mjs';
export type WynikUug={id:string;nazwa:string;miejscowosc:string;simc:string;sym_ul:string;geometry:{type:'MultiLineString'|'LineString';coordinates:number[][][]|number[][]}};
export type OdpowiedzUug={status:'ok'|'brak'|'niedostepne'|'miejscowosc';wyniki:WynikUug[]};
const cache=new Map<string,{expires:number;value:OdpowiedzUug}>();
const pending=new Map<string,Promise<OdpowiedzUug>>();
export function zapytanieUug(q?:string,miejscowosc?:string,kategoria?:string,zarzadca?:string) {
 return !!q && q.trim().length>=3 && q.length<=100 && /\p{L}/u.test(q) && !/^\d+\s*[a-z]?$/i.test(q.trim()) && !!miejscowosc && !kategoria && !zarzadca;
}
export async function szukajUug(q:string,miejscowosc:string):Promise<OdpowiedzUug> {
 const key=JSON.stringify([q.trim().toLocaleLowerCase('pl'),miejscowosc]);
 const saved=cache.get(key);if(saved && saved.expires>Date.now()) return saved.value;
 const running=pending.get(key);if(running) return running;
 const promise=(async():Promise<OdpowiedzUug>=>{
  const miasta=await zapytaj<{simc:string}>('SELECT DISTINCT trim(simc) simc FROM ulica WHERE miejscowosc=$1 AND terc_gmina=\'143505\'',[miejscowosc]);
  if(!miasta.length) return {status:'miejscowosc',wyniki:[]};
  try {
   const sp=new URLSearchParams({request:'GetAddress',address:`${miejscowosc}, ${q.trim()}`,srid:'4326'});
   const res=await fetch(`https://services.gugik.gov.pl/uug/?${sp}`,{signal:AbortSignal.timeout(5000),cache:'no-store'});
   if(!res.ok) throw new Error('UUG HTTP '+res.status);
   const raw=await res.text();if(raw.length>2000000) throw new Error('UUG za duża odpowiedź');
   const dane=JSON.parse(raw);if(!Object.hasOwn(dane,'results') || !Object.hasOwn(dane,'type')) throw new Error('Niepoprawna odpowiedź UUG');
   const matches=odczytajUug(dane,miasta.map(m=>m.simc));
   const wyniki:WynikUug[]=[];
   for(const m of matches) {
    const [geo]=await zapytaj<{geometry:WynikUug['geometry']}>(`SELECT ST_AsGeoJSON(ST_GeomFromText($1,4326))::json geometry`,[m.wkt]);
    const {wkt,...fields}=m;wyniki.push({...fields,geometry:geo.geometry});
   }
   const value:OdpowiedzUug={status:wyniki.length?'ok':'brak',wyniki};
   if(cache.size>=300) cache.delete(cache.keys().next().value!);
   cache.set(key,{value,expires:Date.now()+3600000});return value;
  }catch(e){console.error('Wyszukiwanie UUG',e instanceof Error?e.message:e);return {status:'niedostepne',wyniki:[]};}
 })();pending.set(key,promise);
 try{return await promise;}finally{pending.delete(key);}
}
