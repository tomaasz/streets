import {zapytaj} from './db';
import {odczytajEmape} from '../../scripts/lib/emapa.mjs';
export const EMAPA_WMS='https://www.punktyadresowe.pl/cgi-bin/wms/143505';
export type UlicaEmapa={simc:string;ulic:string;nazwa:string;miejscowosc:string;cecha:string;numer_drogi:string;uchwala:string;opis:string};
export type WynikEmapa={status:'ok'|'brak'|'niedostepne';wyniki:UlicaEmapa[];sprawdzono?:string;zgodneId?:boolean;zgodnaNazwa?:boolean};
const cache=new Map<string,{expires:number;value:WynikEmapa}>();
const pending=new Map<string,Promise<WynikEmapa>>();
export async function sprawdzEmape(x:number,y:number,slug?:string):Promise<WynikEmapa> {
 let expected:{simc:string;sym_ul:string;nazwa:string}|undefined;
 if(slug) {
  const [u]=await zapytaj<{x:number;y:number;simc:string;sym_ul:string;nazwa:string}>(`SELECT ST_X(p) x,ST_Y(p) y,u.simc,u.sym_ul,u.nazwa FROM ulica u CROSS JOIN LATERAL (SELECT ST_LineInterpolatePoint(ST_Transform(d.geom,2180),.5) p FROM ST_Dump(u.geom_pg) d WHERE GeometryType(d.geom)='LINESTRING' ORDER BY ST_Length(d.geom::geography) DESC LIMIT 1) q WHERE u.slug=$1 AND terc_gmina='143505'`,[slug]);
  if(!u) return {status:'brak',wyniki:[]};
  x=u.x;y=u.y;expected=u;
 }
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<657700||x>676700||y<519800||y>535700) return {status:'brak',wyniki:[]};
 const key=JSON.stringify([Math.round(x),Math.round(y),slug]);
 const saved=cache.get(key);if(saved&&saved.expires>Date.now())return saved.value;
 const running=pending.get(key);if(running)return running;
 const request=(async():Promise<WynikEmapa>=>{
  try {
   const sp=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:'ulice',QUERY_LAYERS:'ulice',SRS:'EPSG:2180',BBOX:[x-50,y-50,x+50,y+50].join(','),WIDTH:'101',HEIGHT:'101',X:'50',Y:'50',INFO_FORMAT:'text/xml',FEATURE_COUNT:'20'});
   const res=await fetch(EMAPA_WMS+'?'+sp,{signal:AbortSignal.timeout(7000),cache:'no-store'});
   if(!res.ok)throw new Error('HTTP '+res.status);
   const wyniki:UlicaEmapa[]=odczytajEmape(await res.text());
   const match=expected ? wyniki.find(w=>w.simc===expected.simc.trim()&&w.ulic===expected.sym_ul.trim()) : undefined;
   const value:WynikEmapa={status:wyniki.length?'ok':'brak',wyniki,sprawdzono:new Date().toISOString(),...(expected ? {zgodneId:!!match,zgodnaNazwa:!!match&&match.nazwa.toLocaleLowerCase('pl')===expected.nazwa.toLocaleLowerCase('pl')} : {})};
   if(cache.size>=500)cache.delete(cache.keys().next().value!);
   cache.set(key,{expires:Date.now()+3600000,value});return value;
  }catch(e){console.error('Sprawdzenie e-mapy',e instanceof Error?e.message:e);return {status:'niedostepne',wyniki:[]};}
 })();pending.set(key,request);try{return await request;}finally{pending.delete(key);}
}
