'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { zapytaj } from '@/lib/db';
import { znajdzDokumenty, organyGminy } from '@/lib/dokumenty-internet';
import { zapiszDokumentWKolejce } from '@/lib/dokumenty-kolejka';
import { GMINY_DOKUMENTOW, TEMATY_DOKUMENTOW, type KatalogOrganow, type ParametryDokumentow, type DokumentZnaleziony, type WynikSzukaniaDokumentow } from '@/lib/dokumenty-typy';

export async function odczytajOrganyDokumentow(gmina:string):Promise<KatalogOrganow> {
  if(!GMINY_DOKUMENTOW.some(g=>g.kod===gmina))return {organy:[],komunikat:'Wybierz gminę z katalogu.',blad:true};
  try {return {organy:await organyGminy(gmina),komunikat:'Sprawdź rozpoznane organy. Możesz zawęzić wyszukiwanie do wybranych wydawców.'};}
  catch(e){
    const komunikat=e instanceof Error && /wydawc|organ|jednoznacznie|HTTP/.test(e.message)?e.message
      :'Nie udało się odczytać listy organów z dziennika. Źródło jest chwilowo niedostępne lub ma problem z połączeniem HTTPS.';
    return {organy:[],komunikat,blad:true};
  }
}

export async function szukajDokumentow(_prev:WynikSzukaniaDokumentow,form:FormData):Promise<WynikSzukaniaDokumentow> {
  const gmina=String(form.get('gmina') ?? '');const od=Number(form.get('od'));const rokDo=Number(form.get('do'));
  const temat=String(form.get('temat') ?? '');const q=String(form.get('q') ?? '').trim();
  const wydawcy=[...new Set(form.getAll('wydawca').map(Number))];
  const rok=Number(new Intl.DateTimeFormat('pl',{year:'numeric',timeZone:'Europe/Warsaw'}).format(new Date()));
  if(!GMINY_DOKUMENTOW.some(g=>g.kod===gmina) || !Number.isInteger(od) || !Number.isInteger(rokDo) || od<2002 || rokDo>rok || od>rokDo || !Object.hasOwn(TEMATY_DOKUMENTOW,temat) || q.length>100 || wydawcy.length>30 || wydawcy.some(id=>!Number.isSafeInteger(id)||id<=0))
    return {wyniki:[],zrodla:[],blad:`Wybierz obsługiwaną gminę, temat i zakres lat od 2002 do ${rok}.`};
  try {
    const p:ParametryDokumentow={gmina,od,do:rokDo,temat:temat as ParametryDokumentow['temat'],q,wydawcy};
    const result=await znajdzDokumenty(p);
    const znane=await zapytaj<{organ:string;rodzaj:string;numer:string}>(`SELECT organ,rodzaj,numer FROM akt_prawny`);
    const kolejka=await zapytaj<{organ:string;rodzaj:string;numer:string}>(`SELECT organ,rodzaj,numer FROM dokument_do_przetworzenia WHERE gmina=$1 AND status IN ('do_przetworzenia','przetworzony')`,[gmina]);
    const klucz=(a:{organ:string;rodzaj:string;numer:string})=>`${a.rodzaj}|${a.organ}|${a.numer}`;
    const baza=new Set(znane.map(klucz)),dolaczone=new Set(kolejka.map(klucz));
    const wyniki=result.wyniki.map(a=>({...a,w_bazie:baza.has(klucz(a)),w_kolejce:dolaczone.has(klucz(a))}));
    const id=randomUUID();
    await zapytaj(`INSERT INTO wyszukiwanie_dokumentow(id,gmina,parametry,wyniki) VALUES($1,$2,$3,$4)`,[id,gmina,JSON.stringify(p),JSON.stringify(wyniki)]);
    await zapytaj(`DELETE FROM wyszukiwanie_dokumentow WHERE utworzono < now()-interval '7 days'`);
    return {...result,wyniki,id,gmina};
  }catch(e){console.error('Wyszukiwanie dokumentów',e);return {wyniki:[],zrodla:[],blad:'Nie udało się zapisać wyników wyszukiwania. Spróbuj ponownie.'};}
}

export type WynikDolaczenia={ok:boolean;komunikat:string;dolaczone?:string[]};
export async function dolaczDokumenty(_prev:WynikDolaczenia,form:FormData):Promise<WynikDolaczenia> {
  const id=String(form.get('wyszukiwanie') ?? '');const klucze=[...new Set(form.getAll('dokument').map(String))];
  if(!/^[a-f\d-]{36}$/i.test(id) || !klucze.length || klucze.length>5 || klucze.some(k=>!/^[a-f\d]{64}$/.test(k)))
    return {ok:false,komunikat:'Zaznacz od 1 do 5 dokumentów do pobrania.'};
  try {
    const [szukanie]=await zapytaj<{gmina:string;wyniki:DokumentZnaleziony[]}>(`SELECT gmina,wyniki FROM wyszukiwanie_dokumentow WHERE id=$1 AND utworzono > now()-interval '7 days'`,[id]);
    if(!szukanie)return {ok:false,komunikat:'Wyniki wyszukiwania wygasły. Wyszukaj dokumenty ponownie.'};
    const dokumenty=klucze.map(k=>szukanie.wyniki.find(a=>a.klucz===k));
    if(dokumenty.some(a=>!a))return {ok:false,komunikat:'Wybrany dokument nie należy do tych wyników. Wyszukaj ponownie.'};
    const signal=AbortSignal.timeout(45000);let zapisano=0,bledow=0,bezPliku=0,juz=0;const dolaczone:string[]=[];
    for(const a of dokumenty) {
      const wynik=await zapiszDokumentWKolejce(a!,szukanie.gmina,signal);
      if(wynik==='blad_pobrania')bledow++;
      else if(wynik==='brak_pliku')bezPliku++;
      else {if(wynik==='juz_dolaczony')juz++;else zapisano++;dolaczone.push(a!.klucz);}
    }
    revalidatePath('/akty');
    return {ok:!bledow,komunikat:`Gotowe do przetworzenia: ${zapisano}. Już w kolejce: ${juz}.${bezPliku?` Zapisano publikację bez pliku: ${bezPliku}.`:''}${bledow?` Niepełne pobrania: ${bledow}. Szczegóły i ponowienie są dostępne w kolejce.`:''}`,dolaczone};
  }catch(e){console.error('Dołączanie dokumentów',e);revalidatePath('/akty');return {ok:false,komunikat:'Nie udało się dołączyć wszystkich dokumentów. Sprawdź kolejkę i ponów pobranie pozostałych.'};}
}

export async function ponowPobranieDokumentu(_prev:WynikDolaczenia,form:FormData):Promise<WynikDolaczenia> {
  const id=Number(form.get('id'));
  if(!Number.isSafeInteger(id)||id<=0)return {ok:false,komunikat:'Nieprawidłowy dokument.'};
  try {
    const [d]=await zapytaj<{gmina:string;metadane:DokumentZnaleziony}>(`SELECT gmina,metadane FROM dokument_do_przetworzenia WHERE id=$1 AND status IN ('blad_pobrania','brak_pliku')`,[id]);
    if(!d)return {ok:false,komunikat:'Dokument nie wymaga ponowienia pobrania.'};
    const status=await zapiszDokumentWKolejce(d.metadane,d.gmina,AbortSignal.timeout(20000));
    revalidatePath('/akty');return {ok:status==='do_przetworzenia',komunikat:status==='do_przetworzenia'?'Pobrano dokument. Jest gotowy do przetworzenia.':'Zapisano wynik ponowienia. Sprawdź komunikat w kolejce.'};
  }catch(e){console.error('Ponowienie pobrania dokumentu',e);return {ok:false,komunikat:'Nie udało się ponowić pobrania.'};}
}
