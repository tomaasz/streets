'use client';

import { useActionState, useEffect, useState } from 'react';
import { szukajDokumentow, dolaczDokumenty } from '@/app/akty/actions';
import { GMINY_DOKUMENTOW, TEMATY_DOKUMENTOW, type WynikSzukaniaDokumentow } from '@/lib/dokumenty-typy';

export function SzukajDokumentow({rok}:{rok:number}) {
  const [wynik,szukaj,szukanie]=useActionState(szukajDokumentow,{wyniki:[],zrodla:[]} as WynikSzukaniaDokumentow);
  const [dolaczenie,dolacz,pobieranie]=useActionState(dolaczDokumenty,{ok:false,komunikat:''});
  const [wybrane,setWybrane]=useState(new Set<string>());
  const [filtry,setFiltry]=useState({od:String(rok),do:String(rok),temat:'drogi',q:''});
  useEffect(()=>{setWybrane(new Set());},[wynik.id]);
  const dolaczone=new Set(dolaczenie.dolaczone ?? []);
  const ile=wynik.wyniki.filter(a=>wybrane.has(a.klucz) && !a.w_kolejce && !dolaczone.has(a.klucz)).length;

  return <section className="mt-5" aria-labelledby="szukaj-dokumentow-tytul">
    <h2 id="szukaj-dokumentow-tytul" className="text-lg font-semibold">Znajdź dokumenty w internecie</h2>
    <p className="tekst-pomocniczy mt-1">Przeszukujemy oficjalne archiwum BIP gminy i wojewódzki dziennik urzędowy. Obecnie obsługiwany jest Wyszków; kolejne gminy wymagają skonfigurowania źródeł.</p>
    <form action={szukaj} className="dokumenty-filtry mt-3" aria-busy={szukanie}>
      <label>Gmina<select name="gmina" defaultValue="143505" disabled={szukanie || pobieranie}>{GMINY_DOKUMENTOW.map(g=><option key={g.kod} value={g.kod}>{g.nazwa} · {g.wojewodztwo}</option>)}</select></label>
      <label>Od roku<input name="od" type="number" min={2002} max={rok} value={filtry.od} onChange={e=>setFiltry({...filtry,od:e.target.value})} required disabled={szukanie || pobieranie}/></label>
      <label>Do roku<input name="do" type="number" min={2002} max={rok} value={filtry.do} onChange={e=>setFiltry({...filtry,do:e.target.value})} required disabled={szukanie || pobieranie}/></label>
      <label>Temat<select name="temat" value={filtry.temat} onChange={e=>setFiltry({...filtry,temat:e.target.value})} disabled={szukanie || pobieranie}>{Object.entries(TEMATY_DOKUMENTOW).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="dokumenty-fraza">Tytuł lub numer (opcjonalnie)<input name="q" type="search" value={filtry.q} onChange={e=>setFiltry({...filtry,q:e.target.value})} maxLength={100} placeholder="np. nazwy ulicy lub numer uchwały" disabled={szukanie || pobieranie}/></label>
      <button className="przycisk primary" disabled={szukanie || pobieranie}>{szukanie?'Przeszukuję źródła…':'Znajdź dokumenty'}</button>
    </form>
    <p role="status" className="tekst-pomocniczy mt-2">{szukanie?'Przeglądam archiwum i strony wydawców. Może to potrwać do 45 sekund.':'Dla starszych dokumentów wybierz wcześniejsze lata. Wyszukiwanie nie gwarantuje kompletności publikacji.'}</p>
    {wynik.blad?<p role="alert" className="blad-formularza mt-3">{wynik.blad}</p>:null}
    {wynik.zrodla.length?<div className="dokumenty-zrodla mt-4">{wynik.zrodla.map(z=><div key={z.nazwa} className="karta p-3">
      <p className="font-semibold">{z.nazwa} · {z.status==='ok'?'Sprawdzono':z.status==='czesciowe'?'Wyniki częściowe':z.status==='nieobslugiwane'?'Odczyt nieobsługiwany':'Źródło niedostępne'}</p>
      <p className="tekst-pomocniczy mt-1">{z.komunikat}</p>
      {z.url?<a className="inline-block text-sm mt-2" href={z.url} target="_blank" rel="noreferrer">Otwórz rejestr źródłowy ↗</a>:null}
    </div>)}</div>:null}
    {wynik.id && !szukanie?<>
      <p className="mt-4 font-semibold">Znalezione dokumenty: {wynik.wyniki.length}</p>
      {!wynik.wyniki.length?<p className="tekst-pomocniczy mt-2">Nie znaleziono dokumentów pasujących do filtrów w dostępnych źródłach. Sprawdź komunikaty źródeł lub zmień zakres lat i temat.</p>:<form action={dolacz} className="mt-3" aria-busy={pobieranie}>
        <input type="hidden" name="wyszukiwanie" value={wynik.id}/>
        <div className="dokumenty-wyniki">{wynik.wyniki.map(a=>{
          const juz=a.w_kolejce || dolaczone.has(a.klucz);
          return <article key={a.klucz} className="karta p-4">
            <label className="flex gap-3 items-start font-semibold">
              <input type="checkbox" name="dokument" value={a.klucz} checked={wybrane.has(a.klucz) && !juz}
                disabled={pobieranie || juz || (ile>=5 && !wybrane.has(a.klucz))}
                onChange={e=>setWybrane(prev=>{const next=new Set(prev);if(e.target.checked)next.add(a.klucz);else next.delete(a.klucz);return next;})}/>
              <span>{a.rodzaj} {a.numer} · {a.data_podjecia ?? a.rok}<span className="block mt-1">{a.tytul}</span></span>
            </label>
            <p className="tekst-pomocniczy mt-2">{a.organ} · {a.zrodlo}</p>
            {a.zalaczniki?.length?<p className="tekst-pomocniczy">Dodatkowe pliki na stronie dokumentu: {a.zalaczniki.length}</p>:null}
            <p className="text-sm mt-2">{juz?'Już w kolejce przetwarzania':a.w_bazie?'Akt jest już w aplikacji; możesz pobrać jego plik do przetworzenia.':'Nowy dokument'}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
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
