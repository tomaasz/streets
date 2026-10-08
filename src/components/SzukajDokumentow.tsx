'use client';

import { useActionState, useEffect, useState } from 'react';
import { szukajDokumentow, dolaczDokumenty, odczytajOrganyDokumentow } from '@/app/akty/actions';
import { GMINY_DOKUMENTOW, DZIENNIKI_WOJEWODZKIE, TEMATY_DOKUMENTOW, type KatalogOrganow, type WynikSzukaniaDokumentow } from '@/lib/dokumenty-typy';

export function SzukajDokumentow({rok}:{rok:number}) {
  const [wynik,szukaj,szukanie]=useActionState(szukajDokumentow,{wyniki:[],zrodla:[]} as WynikSzukaniaDokumentow);
  const [dolaczenie,dolacz,pobieranie]=useActionState(dolaczDokumenty,{ok:false,komunikat:''});
  const [wybrane,setWybrane]=useState(new Set<string>());
  const [filtry,setFiltry]=useState({od:String(rok),do:String(rok),temat:'drogi',q:''});
  const [woj,setWoj]=useState('14');
  const [gmina,setGmina]=useState('143505');
  const [katalog,setKatalog]=useState<KatalogOrganow>({organy:[],komunikat:''});
  const [odczytOrganow,setOdczytOrganow]=useState(true);
  const [ponowienie,setPonowienie]=useState(0);
  const [wydawcy,setWydawcy]=useState(new Set<number>());
  useEffect(()=>{
    let aktywne=true;setOdczytOrganow(true);setKatalog({organy:[],komunikat:''});setWydawcy(new Set());
    odczytajOrganyDokumentow(gmina).then(k=>{
      if(!aktywne)return;setKatalog(k);setWydawcy(new Set(k.organy.map(o=>o.id)));setOdczytOrganow(false);
    }).catch(()=>{if(aktywne){setKatalog({organy:[],komunikat:'Nie udało się odczytać organów. Ponów próbę.',blad:true});setOdczytOrganow(false);}});
    return ()=>{aktywne=false;};
  },[gmina,ponowienie]);
  const gminyWojewodztwa=GMINY_DOKUMENTOW.filter(g=>g.woj===woj);
  const dziennik=DZIENNIKI_WOJEWODZKIE.find(d=>d.kod===woj)!;
  const gminaWynikow=GMINY_DOKUMENTOW.find(g=>g.kod===wynik.gmina);
  const [uklad,setUklad]=useState<'karty'|'lista'>('karty');
  useEffect(()=>{
    try {const v=localStorage.getItem('widok-wynikow-dokumentow');if(v==='karty'||v==='lista')setUklad(v);}catch{}
  },[]);
  const wybierzUklad=(v:'karty'|'lista')=>{
    setUklad(v);try{localStorage.setItem('widok-wynikow-dokumentow',v);}catch{}
  };
  useEffect(()=>{setWybrane(new Set());},[wynik.id]);
  const dolaczone=new Set(dolaczenie.dolaczone ?? []);
  const ile=wynik.wyniki.filter(a=>wybrane.has(a.klucz) && !a.w_kolejce && !dolaczone.has(a.klucz)).length;

  return <section className="mt-5" aria-labelledby="szukaj-dokumentow-tytul">
    <h2 id="szukaj-dokumentow-tytul" className="text-lg font-semibold">Znajdź dokumenty w internecie</h2>
    <p className="tekst-pomocniczy mt-1">Wybierz województwo i gminę. Przeszukamy jej oficjalny dziennik wojewódzki; dla Wyszkowa również archiwum BIP. Dopasowanie organów wymaga sprawdzenia, a dostępność dokumentów zależy od źródła.</p>
    <form action={szukaj} className="dokumenty-filtry mt-3" aria-busy={szukanie}>
      <label>Województwo<select value={woj} onChange={e=>{setWoj(e.target.value);setGmina(GMINY_DOKUMENTOW.find(g=>g.woj===e.target.value)!.kod);}} disabled={szukanie || pobieranie}>{DZIENNIKI_WOJEWODZKIE.map(d=><option key={d.kod} value={d.kod}>{d.nazwa}</option>)}</select></label>
      <label>Gmina<select name="gmina" value={gmina} onChange={e=>setGmina(e.target.value)} disabled={szukanie || pobieranie}>{gminyWojewodztwa.map(g=><option key={g.kod} value={g.kod}>{g.nazwa} · {g.rodzaj} · {g.powiat}</option>)}</select></label>
      <label>Od roku<input name="od" type="number" min={2002} max={rok} value={filtry.od} onChange={e=>setFiltry({...filtry,od:e.target.value})} required disabled={szukanie || pobieranie}/></label>
      <label>Do roku<input name="do" type="number" min={2002} max={rok} value={filtry.do} onChange={e=>setFiltry({...filtry,do:e.target.value})} required disabled={szukanie || pobieranie}/></label>
      <label>Temat<select name="temat" value={filtry.temat} onChange={e=>setFiltry({...filtry,temat:e.target.value})} disabled={szukanie || pobieranie}>{Object.entries(TEMATY_DOKUMENTOW).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="dokumenty-fraza">Tytuł lub numer (opcjonalnie)<input name="q" type="search" value={filtry.q} onChange={e=>setFiltry({...filtry,q:e.target.value})} maxLength={100} placeholder="np. nazwy ulicy lub numer uchwały" disabled={szukanie || pobieranie}/></label>
      <button className="przycisk primary" disabled={szukanie || pobieranie || odczytOrganow || (!wydawcy.size && gmina!=='143505')}>{szukanie?'Przeszukuję źródła…':'Znajdź dokumenty'}</button>
      <div className="dokumenty-organy">
        <p className="tekst-pomocniczy" role="status">{odczytOrganow?'Odczytuję organy wydające dokumenty…':katalog.komunikat}</p>
        {katalog.organy.length?<details className="mt-2"><summary>Organy wydające: {wydawcy.size} z {katalog.organy.length}</summary>
          <div className="dokumenty-organy-lista mt-2">{katalog.organy.map(o=><label key={o.id} className="flex items-start gap-2">
            <input type="checkbox" name="wydawca" value={o.id} checked={wydawcy.has(o.id)} disabled={szukanie || pobieranie}
              onChange={e=>setWydawcy(prev=>{const next=new Set(prev);if(e.target.checked)next.add(o.id);else next.delete(o.id);return next;})}/>
            <span>{o.nazwa}</span>
          </label>)}</div>
        </details>:null}
        {katalog.blad?<button type="button" className="przycisk mt-2" disabled={odczytOrganow || szukanie || pobieranie} onClick={()=>setPonowienie(v=>v+1)}>Ponów odczyt organów</button>:null}
        <a className="inline-block text-sm mt-2 ml-3" href={dziennik.baza} target="_blank" rel="noreferrer">Otwórz dziennik wojewódzki ↗</a>
      </div>
    </form>
    <p role="status" className="tekst-pomocniczy mt-2">{szukanie?'Przeglądam archiwum i strony wydawców. Może to potrwać do 45 sekund.':'Dla starszych dokumentów wybierz wcześniejsze lata. Wyszukiwanie nie gwarantuje kompletności publikacji.'}</p>
    {wynik.blad?<p role="alert" className="blad-formularza mt-3">{wynik.blad}</p>:null}
    {wynik.zrodla.length?<div className="dokumenty-zrodla mt-4">{wynik.zrodla.map(z=><div key={z.nazwa} className="karta p-3">
      <p className="font-semibold">{z.nazwa} · {z.status==='ok'?'Sprawdzono':z.status==='czesciowe'?'Wyniki częściowe':z.status==='nieobslugiwane'?'Odczyt nieobsługiwany':'Źródło niedostępne'}</p>
      <p className="tekst-pomocniczy mt-1">{z.komunikat}</p>
      {z.url?<a className="inline-block text-sm mt-2" href={z.url} target="_blank" rel="noreferrer">Otwórz rejestr źródłowy ↗</a>:null}
    </div>)}</div>:null}
    {wynik.id && !szukanie?<>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">Znalezione dokumenty: {wynik.wyniki.length}</p>
          {gminaWynikow?<p className="tekst-pomocniczy">Wyniki dla: {gminaWynikow.nazwa} · {gminaWynikow.rodzaj} · {gminaWynikow.powiat}</p>:null}
        </div>
        {wynik.wyniki.length?<div className="flex gap-2" role="group" aria-label="Układ wyników dokumentów">
          <button type="button" className={`przycisk${uklad==='karty'?' primary':''}`} aria-pressed={uklad==='karty'} onClick={()=>wybierzUklad('karty')}>Karty</button>
          <button type="button" className={`przycisk${uklad==='lista'?' primary':''}`} aria-pressed={uklad==='lista'} onClick={()=>wybierzUklad('lista')}>Kompaktowa lista</button>
        </div>:null}
      </div>
      {!wynik.wyniki.length?<p className="tekst-pomocniczy mt-2">Nie znaleziono dokumentów pasujących do filtrów w dostępnych źródłach. Sprawdź komunikaty źródeł lub zmień zakres lat i temat.</p>:<form action={dolacz} className="mt-3" aria-busy={pobieranie}>
        <input type="hidden" name="wyszukiwanie" value={wynik.id}/>
        <div className={`dokumenty-wyniki${uklad==='lista'?' dokumenty-wyniki-lista':''}`}>{wynik.wyniki.map(a=>{
          const juz=a.w_kolejce || dolaczone.has(a.klucz);
          return <article key={a.klucz} className="karta p-4">
            <label className="flex gap-3 items-start font-semibold">
              <input type="checkbox" name="dokument" value={a.klucz} checked={wybrane.has(a.klucz) && !juz}
                disabled={pobieranie || juz || (ile>=5 && !wybrane.has(a.klucz))}
                onChange={e=>setWybrane(prev=>{const next=new Set(prev);if(e.target.checked)next.add(a.klucz);else next.delete(a.klucz);return next;})}/>
              <span><span className="dokument-numer">{a.rodzaj} {a.numer} · {a.data_podjecia ?? a.rok}</span><span className="dokument-tytul block mt-1">{a.tytul}</span></span>
            </label>
            <p className="dokument-zrodlo tekst-pomocniczy mt-2">{a.organ} · {a.zrodlo}</p>
            {a.zalaczniki?.length?<p className="dokument-zalaczniki tekst-pomocniczy">Dodatkowe pliki na stronie dokumentu: {a.zalaczniki.length}</p>:null}
            <p className="dokument-status text-sm mt-2">{juz?'Już w kolejce przetwarzania':a.w_bazie?'Akt jest już w aplikacji; możesz pobrać jego plik do przetworzenia.':'Nowy dokument'}</p>
            <div className="dokument-linki flex flex-wrap gap-3 mt-2 text-sm">
              <a className="przycisk" href={a.url} target="_blank" rel="noreferrer">Publikacja źródłowa ↗</a>
              {a.url_pdf?<a className="przycisk" href={a.url_pdf} target="_blank" rel="noreferrer">Podgląd dokumentu ↗</a>:<span className="tekst-pomocniczy">Brak rozpoznanego odnośnika do pliku; zapiszemy stronę publikacji.</span>}
            </div>
          </article>;
        })}</div>
        <p className="tekst-pomocniczy mt-3">Zaznacz maksymalnie 5 dokumentów naraz. Pobierzemy pliki i zachowamy ich pochodzenie. Dołączenie nie zmienia kategorii ani zarządców dróg.</p>
        <button className="przycisk primary mt-2" disabled={!ile || pobieranie}>{pobieranie?'Pobieram dokumenty…':`Dołącz do przetworzenia (${ile})`}</button>
        <p role="status" className="mt-2 text-sm">{dolaczenie.komunikat}</p>
      </form>}
    </>:null}
  </section>;
}
