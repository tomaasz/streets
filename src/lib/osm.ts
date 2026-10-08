import {zapytaj} from './db';
import {odczytajOsm,normalizujOsm} from '../../scripts/lib/osm.mjs';
export type WynikOsm={id:string;nazwa:string;miejscowosc:string;url:string;geometry:{type:'MultiLineString';coordinates:number[][][]}};
export type OdpowiedzOsm={status:'ok'|'brak'|'niedostepne'|'miejscowosc';wyniki:WynikOsm[]};
const cache=new Map<string,{expires:number;wyniki:WynikOsm[]}>();
const pending=new Map<string,Promise<OdpowiedzOsm>>();

async function pobierzOkolice(miejscowosc:string):Promise<OdpowiedzOsm> {
 try {
  const [box]=await zapytaj<{xmin:number;xmax:number;ymin:number;ymax:number}>(`SELECT ST_XMin(b) xmin,ST_XMax(b) xmax,ST_YMin(b) ymin,ST_YMax(b) ymax FROM (SELECT ST_Extent(geom_pg) b FROM ulica WHERE miejscowosc=$1 AND terc_gmina='143505') s`,[miejscowosc]);
  if(!box || box.xmin==null) return {status:'miejscowosc',wyniki:[]};
  const bbox=[box.xmin-.008,box.ymin-.005,box.xmax+.008,box.ymax+.005];
  // OSM ogranicza rozmiar obszaru /map. Zapytanie zawsze dotyczy znanej
  // miejscowości w bazie, nie dowolnego obszaru wskazanego przez klienta.
  if((bbox[2]-bbox[0])*(bbox[3]-bbox[1])>.24) throw new Error('Za duży obszar OSM');
  const res=await fetch('https://www.openstreetmap.org/api/0.6/map.json?'+new URLSearchParams({bbox:bbox.join(',')}),{signal:AbortSignal.timeout(10000),cache:'no-store',headers:{'User-Agent':'gmina-wyszkow-drogi/1.0'}});
  if(!res.ok) throw new Error('OSM HTTP '+res.status);
  const raw=await res.text();if(raw.length>30000000) throw new Error('Za duża odpowiedź OSM');
  const ways=odczytajOsm(JSON.parse(raw));
  // Miejscowość jest tylko przybliżeniem na podstawie najbliższej osi PRG.
  // Nie jest to granica administracyjna ani identyfikator TERYT tej drogi.
  const rows=await zapytaj<{way:number;nazwa:string;geometry:{type:'LineString';coordinates:number[][]}}>(`WITH osm AS (
    SELECT w.*,ST_GeomFromGeoJSON(w.geometry::text) geom FROM jsonb_to_recordset($1::jsonb) w(way bigint,nazwa text,geometry jsonb)
   ), points AS (SELECT *,ST_LineInterpolatePoint(geom,.5) pt FROM osm)
   SELECT o.way,o.nazwa,o.geometry FROM points o CROSS JOIN LATERAL (
    SELECT u.miejscowosc,u.geom_pg FROM ulica u WHERE u.geom_pg IS NOT NULL
    ORDER BY u.geom_pg <-> o.pt LIMIT 1
   ) near WHERE near.miejscowosc=$2 AND ST_DWithin(near.geom_pg::geography,o.pt::geography,1500)
   AND NOT EXISTS (SELECT 1 FROM ulica u WHERE u.miejscowosc=$2
     AND bez_ogonkow(u.nazwa)=bez_ogonkow(regexp_replace(o.nazwa,'^ul[.]? ','','i')))
   ORDER BY o.nazwa,o.way`,[JSON.stringify(ways),miejscowosc]);
  const groups=new Map<string,WynikOsm>();
  for(const r of rows) {
   const key=normalizujOsm(r.nazwa);
   const group=groups.get(key);
   if(group) group.geometry.coordinates.push(r.geometry.coordinates);
   else groups.set(key,{id:`osm-${r.way}`,nazwa:r.nazwa,miejscowosc,url:`https://www.openstreetmap.org/way/${r.way}`,geometry:{type:'MultiLineString',coordinates:[r.geometry.coordinates]}});
  }
  const wyniki=[...groups.values()];
  if(cache.size>=40) cache.delete(cache.keys().next().value!);
  cache.set(miejscowosc,{wyniki,expires:Date.now()+86400000});
  return {status:wyniki.length?'ok':'brak',wyniki};
 } catch(e) {
  console.error('Wyszukiwanie OSM',e instanceof Error?e.message:e);
  return {status:'niedostepne',wyniki:[]};
 }
}

export async function szukajOsm(q:string,miejscowosc:string):Promise<OdpowiedzOsm> {
 const saved=cache.get(miejscowosc);
 let data:OdpowiedzOsm;
 if(saved && saved.expires>Date.now()) data={status:'ok',wyniki:saved.wyniki};
 else {
  let request=pending.get(miejscowosc);
  if(!request) {request=pobierzOkolice(miejscowosc);pending.set(miejscowosc,request);}
  try {data=await request;} finally {pending.delete(miejscowosc);}
 }
 if(data.status==='miejscowosc' || data.status==='niedostepne') return data;
 const wyniki=data.wyniki.filter(w=>normalizujOsm(w.nazwa).includes(normalizujOsm(q))).slice(0,100);
 return {status:wyniki.length?'ok':'brak',wyniki};
}
