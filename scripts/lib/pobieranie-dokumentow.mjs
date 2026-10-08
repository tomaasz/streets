/** Tylko skonfigurowane oficjalne źródła; każdy redirect sprawdzany osobno. */
import { DZIENNIKI_WOJEWODZKIE } from './dzienniki-wojewodzkie.mjs';
import { CERTYFIKATY_DZIENNIKOW } from './certyfikaty-dziennikow.mjs';
import { rootCertificates } from 'node:tls';
import { Agent } from 'undici';
const HOSTY = new Set(['bip.wyszkow.pl','wyszkow.esesja.pl',...DZIENNIKI_WOJEWODZKIE.map(d=>d.host)]);
const agenci=new Map(Object.entries(CERTYFIKATY_DZIENNIKOW).map(([host,cert])=>
  [host,new Agent({connect:{ca:[...rootCertificates,cert]}})]));
/** @param {string} adres */
export function sprawdzAdresDokumentu(adres) {
  const u = new URL(adres);
  if (u.protocol !== 'https:' || u.port || u.username || u.password ||
    !HOSTY.has(u.hostname))
    throw new Error('Adres pliku nie należy do obsługiwanego źródła urzędowego.');
  return u;
}

/** @param {string} adres @param {AbortSignal} sygnal */
export async function pobierzDokument(adres, sygnal, limit=15*1024*1024) {
  let u=sprawdzAdresDokumentu(adres);
  const signal=AbortSignal.any([sygnal,AbortSignal.timeout(8000)]);
  for(let i=0;i<5;i++) {
    const opcje={signal,redirect:/** @type {const} */ ('manual'),cache:/** @type {const} */ ('no-store'),headers:{'User-Agent':'drogi-wyszkow/1.0 (wyszukiwanie dokumentow urzedowych)'},
      ...(agenci.has(u.hostname)?{dispatcher:agenci.get(u.hostname)}:{})};
    const res=await fetch(u,opcje);
    if([301,302,303,307,308].includes(res.status)) {
      const location=res.headers.get('location');
      await res.body?.cancel();
      if(!location) throw new Error('Źródło zwróciło przekierowanie bez adresu.');
      u=sprawdzAdresDokumentu(new URL(location,u).href);continue;
    }
    if(!res.ok) {await res.body?.cancel();throw new Error(`Źródło odpowiedziało HTTP ${res.status}.`);}
    if(Number(res.headers.get('content-length'))>limit) {await res.body?.cancel();throw new Error('Plik przekracza limit rozmiaru.');}
    const chunks=[];let size=0;
    if(!res.body) throw new Error('Źródło zwróciło pustą odpowiedź.');
    const reader=res.body.getReader();
    try {while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>limit)throw new Error('Plik przekracza limit rozmiaru.');chunks.push(value);
    }} finally {await reader.cancel();}
    const tresc=Buffer.concat(chunks);
    if(!tresc.length)throw new Error('Źródło zwróciło pusty plik.');
    return {tresc,typ:(res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0],url:u.href};
  }
  throw new Error('Źródło zwróciło zbyt wiele przekierowań.');
}
