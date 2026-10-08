import { pobierzDokument } from '../../scripts/lib/pobieranie-dokumentow.mjs';
export { pobierzDokument, sprawdzAdresDokumentu } from '../../scripts/lib/pobieranie-dokumentow.mjs';
import { createHash } from 'node:crypto';
import { aktyZeStrony as aktyBip, podstrony, WARTO_WEJSC } from '../../scripts/lib/bip-akty.mjs';
import { aktyZeStrony as aktyDziennika } from '../../scripts/lib/edziennik-akty.mjs';
import { aktyZApiWydawcy } from '../../scripts/lib/edziennik-api.mjs';
import { pasujeTematDokumentu } from '../../scripts/lib/tematy-dokumentow.mjs';
import type { DokumentZnaleziony, ParametryDokumentow, RaportZrodla } from './dokumenty-typy';

const BIP = 'https://bip.wyszkow.pl/';
const DZIENNIK = 'https://edziennik.mazowieckie.pl';
const KADENCJE = [
  { id:180, od:2002, do:2006 }, { id:181, od:2006, do:2010 },
  { id:1434, od:2010, do:2014 }, { id:8000, od:2014, do:2018 },
  { id:17150, od:2018, do:2024 }, { id:29849, od:2024, do:2029 },
  { id:117, od:2002, do:2006 }, { id:118, od:2006, do:2010 },
  { id:1436, od:2010, do:2014 }, { id:8400, od:2014, do:2018 },
  { id:17000, od:2018, do:2024 },
];
const WYDAWCY = [1453,1222,282,163,760,448,468,246,1018,1121];
const normalizuj = (s:string) => s.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ł','l');
export const kluczDokumentu = (a:Pick<DokumentZnaleziony,'organ'|'rodzaj'|'numer'>) =>
  createHash('sha256').update(`${a.rodzaj}|${a.organ}|${a.numer}`).digest('hex');

const bladZrodla=(e:unknown) => e instanceof Error && /HTTP|limit|Adres|pust|przekier/.test(e.message)
  ? e.message : 'Nie udało się pobrać danych z tej sieci lub źródło nie odpowiedziało w terminie.';
function pasuje(a:DokumentZnaleziony,p:ParametryDokumentow) {
  return a.rok>=p.od && a.rok<=p.do && pasujeTematDokumentu(a.tytul,p.temat) &&
    (!p.q || normalizuj(`${a.tytul} ${a.numer}`).includes(normalizuj(p.q)));
}

async function szukajBip(p:ParametryDokumentow) {
  const signal=AbortSignal.timeout(40000);
  const kolejka=KADENCJE.filter(k=>k.od<=p.do && k.do>=p.od).map(k=>({url:`${BIP}index.php?cmd=zawartosc&opt=pokaz&id=${k.id}`,glebokosc:0}));
  const odwiedzone=new Set<string>();const wyniki=new Map<string,DokumentZnaleziony>();
  let stron=0,bledow=0,rozpoznano=0;let pierwszyBlad='';
  while(kolejka.length && odwiedzone.size<180 && !signal.aborted) {
    const partia=kolejka.splice(0,3).filter(s=>!odwiedzone.has(s.url));
    partia.forEach(s=>odwiedzone.add(s.url));
    await Promise.all(partia.map(async s=>{
      try {
        const plik=await pobierzDokument(s.url,signal,2*1024*1024);const html=plik.tresc.toString('utf8');stron++;
        if(!/col-md-8/.test(html))throw new Error('Nie rozpoznano układu archiwum BIP.');
        for(const a of aktyBip(html,s.url)) {
          rozpoznano++;
          const d:DokumentZnaleziony={...a,klucz:kluczDokumentu(a),url:a.url_zrodla,zrodlo:'BIP Gminy Wyszków'};
          if(pasuje(d,p))wyniki.set(d.klucz,d);
        }
        if(s.glebokosc>=5)return;
        for(const [,link] of podstrony(html)) {
          const t=link.tytul.trim();const rok=/^\d{4}$/.test(t)?Number(t):null;
          if(rok && (rok<p.od || rok>p.do))continue;
          // Archiwum prowadzi także do stron pojedynczych uchwał.
          if(!WARTO_WEJSC.test(t) && !/^(zarządzeni|uchwał)/i.test(t))continue;
          if(/^(zarządzeni|uchwał)\s+nr/i.test(t) && !pasujeTematDokumentu(t))continue;
          const url=new URL(link.url,BIP).href;
          if(!odwiedzone.has(url) && !kolejka.some(k=>k.url===url))kolejka.push({url,glebokosc:s.glebokosc+1});
        }
      } catch(e) {bledow++;pierwszyBlad ||= bladZrodla(e);}
    }));
  }
  const czesciowe=kolejka.length>0 || bledow>0;
  const zrodlo:RaportZrodla={nazwa:'BIP Gminy Wyszków',stron,status:stron===0?'blad':czesciowe?'czesciowe':'ok',
    komunikat:stron===0?pierwszyBlad:czesciowe
      ? `Wyniki częściowe: sprawdzono ${stron} stron${bledow?`, ${bledow} nie udało się odczytać`:''}. Zawęź zakres lat i ponów wyszukiwanie.`
      : `Sprawdzono ${stron} stron archiwum. Wyszukiwanie nie gwarantuje kompletności publikacji.${!rozpoznano?' Nie rozpoznano aktów drogowych w sprawdzonych stronach.':''}`};
  return {wyniki:[...wyniki.values()],zrodlo};
}

async function szukajDziennik(p:ParametryDokumentow) {
  const signal=AbortSignal.timeout(25000);const wyniki=new Map<string,DokumentZnaleziony>();
  let stron=0,bledow=0,pierwszyBlad='';
  let wydawcy=WYDAWCY;
  try {
    const lista=JSON.parse((await pobierzDokument(`${DZIENNIK}/api/publisher`,signal,2*1024*1024)).tresc.toString('utf8'));
    if(!Array.isArray(lista))throw new Error('Nie rozpoznano listy wydawców.');
    const ids=lista.filter(a=>typeof a.Name==='string' && /wyszk/i.test(a.Name) && Number.isSafeInteger(a.Oid)).map(a=>a.Oid as number);
    if(!ids.length || ids.length>30)throw new Error('Nie rozpoznano wydawców dotyczących Wyszkowa.');
    wydawcy=ids;
  }catch(e){bledow++;pierwszyBlad ||= bladZrodla(e);}
  for(let i=0;i<wydawcy.length && !signal.aborted;i+=3) {
    await Promise.all(wydawcy.slice(i,i+3).map(async id=>{
      try {
        let akty;
        try {
          const plik=await pobierzDokument(`${DZIENNIK}/api/publisher/${id}`,signal,5*1024*1024);
          akty=aktyZApiWydawcy(JSON.parse(plik.tresc.toString('utf8')));
        }catch(e) {
          // Starszy wariant serwisu publikował tabelę bezpośrednio w HTML.
          const plik=await pobierzDokument(`${DZIENNIK}/publisher/${id}`,signal,3*1024*1024);
          const result=aktyDziennika(plik.tresc.toString('utf8'),id);
          if(!result.naglowki)throw e;
          akty=result.akty.filter(a=>/wyszk/i.test(a.organ_zrodlowy ?? '')).map(a=>({...a,rok:Number((a.data_podjecia ?? '').slice(0,4)) || a.dziennik_rok || 0}));
        }
        stron++;
        for(const a of akty) {
          const d:DokumentZnaleziony={...a,klucz:kluczDokumentu(a),zrodlo:'Dziennik Urzędowy Województwa Mazowieckiego'};
          if(pasuje(d,p))wyniki.set(d.klucz,d);
        }
      } catch(e) {bledow++;pierwszyBlad ||= bladZrodla(e);}
    }));
    if(!stron && bledow>=3)break;
  }
  const zrodlo:RaportZrodla={nazwa:'Dziennik Urzędowy Województwa Mazowieckiego',stron,
    status:!stron?'blad':bledow || signal.aborted?'czesciowe':'ok',
    komunikat:!stron?pierwszyBlad:`Sprawdzono ${stron} z ${wydawcy.length} wydawców dotyczących gminy i powiatu Wyszkowskiego. Wyszukiwanie nie gwarantuje kompletności publikacji.${bledow || signal.aborted?' Część źródła była niedostępna.':''}`};
  return {wyniki:[...wyniki.values()],zrodlo};
}

export async function znajdzDokumenty(p:ParametryDokumentow) {
  const rezultaty=await Promise.all([szukajBip(p),szukajDziennik(p),sprawdzRejestrUchwal()]);
  const wyniki=new Map<string,DokumentZnaleziony>();
  for(const r of rezultaty)for(const a of r.wyniki) {
    const prev=wyniki.get(a.klucz);
    // Preferujemy publikację w dzienniku, zachowując adres pliku z BIP, jeśli brakuje go w dzienniku.
    wyniki.set(a.klucz,prev?{...a,url_pdf:a.url_pdf ?? prev.url_pdf,zalaczniki:[...new Set([...(prev.zalaczniki ?? []),...(a.zalaczniki ?? [])])]}:a);
  }
  return {wyniki:[...wyniki.values()].sort((a,b)=>(b.data_podjecia ?? String(b.rok)).localeCompare(a.data_podjecia ?? String(a.rok))),zrodla:rezultaty.map(r=>r.zrodlo)};
}

async function sprawdzRejestrUchwal():Promise<{wyniki:DokumentZnaleziony[];zrodlo:RaportZrodla}> {
  const url='https://wyszkow.esesja.pl/rejestr_uchwal?kid=2613';
  let status:RaportZrodla['status']='nieobslugiwane';
  let komunikat='BIP kieruje bieżący rejestr uchwał do eSesji. Automatyczny odczyt tego rejestru wymaga osobnej integracji; dokumenty z niego nie są uwzględnione w wynikach.';
  try {await pobierzDokument(url,AbortSignal.timeout(8000),2*1024*1024);}
  catch(e){status='blad';komunikat=`BIP kieruje bieżący rejestr uchwał do eSesji. ${bladZrodla(e)} Uchwały z tego rejestru nie są uwzględnione w wynikach.`;}
  return {wyniki:[],zrodlo:{nazwa:'Bieżący rejestr uchwał · eSesja Wyszków',status,stron:0,url,komunikat}};
}
