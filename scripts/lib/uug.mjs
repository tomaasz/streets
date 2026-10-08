// UUG udostępnia aktualne dane PRG. Nie ustala kategorii ani zarządcy drogi.
export function odczytajUug(dane,simc) {
 if(dane?.type!=='street' || !dane.results || typeof dane.results!=='object') return [];
 const wynik=new Map();
 for(const r of Object.values(dane.results).slice(0,100)) {
  if(!r || r.teryt!=='143505' || !simc.includes(String(r.simc)) || !/^\d{5}$/.test(String(r.ulic)) || typeof r.street!=='string' || !r.street.trim() || typeof r.city!=='string' || !r.city.trim()) continue;
  const wkt=r.geometry_wkt;
  if(typeof wkt!=='string' || wkt.length>200000 || !/^(MULTILINESTRING|LINESTRING)\s*\([\d\s.,()+eE-]+\)$/i.test(wkt)) continue;
  const x=Number(r.x),y=Number(r.y);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<20||x>23||y<51||y>54) continue;
  const coords=wkt.replace(/^(MULTILINESTRING|LINESTRING)/i,'').replace(/[()]/g,'').split(',').map(p=>p.trim().split(/\s+/).map(Number));
  if(coords.length<2 || coords.some(p=>p.length!==2 || !p.every(Number.isFinite) || p[0]<20 || p[0]>23 || p[1]<51 || p[1]>54)) continue;
  wynik.set(`${r.simc}:${r.ulic}`,{id:`uug-${r.simc}-${r.ulic}`,nazwa:r.street,miejscowosc:r.city,simc:r.simc,sym_ul:r.ulic,wkt});
 }
 return [...wynik.values()];
}
