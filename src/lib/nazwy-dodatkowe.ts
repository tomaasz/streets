import nazwy from '../../db/seed/nazwy-dodatkowe.json';
import {normalizujOsm} from '../../scripts/lib/osm.mjs';
export type NazwaDodatkowa=typeof nazwy[number];
export function nazwyDodatkowe(q?:string,miejscowosc?:string,kategoria?:string,zarzadca?:string) {
 if(!q || q.trim().length<2 || q.length>100 || kategoria || zarzadca) return [];
 return nazwy.filter(n=>(!miejscowosc || n.miejscowosc===miejscowosc) && normalizujOsm(n.nazwa).includes(normalizujOsm(q)));
}
export function nazwaDodatkowa(id?:string) {return nazwy.find(n=>n.id===id);}
export function porownanieNazwy(n:NazwaDodatkowa) {
 return {pathname:'/mapa',query:{q:n.kandydat_nr_drogi,miejscowosc:n.miejscowosc,dodatkowa:n.id}};
}
