'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {WynikEmapa} from '@/lib/emapa';
export function SprawdzEmape({slug,x,y,automatycznie=false}:{slug?:string;x?:number;y?:number;automatycznie?:boolean}) {
 const [wynik,setWynik]=useState<WynikEmapa>();
 const [proba,setProba]=useState(automatycznie?1:0);
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!proba)return;
  const c=new AbortController();setLoading(true);setWynik(undefined);
  const sp=new URLSearchParams(slug?{slug}:{x:String(x),y:String(y)});
  fetch('/api/emapa?'+sp,{signal:c.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(w=>{if(!c.signal.aborted)setWynik(w);}).catch(()=>{if(!c.signal.aborted)setWynik({status:'niedostepne',wyniki:[]});}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[slug,x,y,proba]);
 return <section className="karta p-3 mt-3" aria-label="Sprawdzenie w gminnej e-mapie">
  <h2 className="text-sm font-semibold">Gminna e-mapa · Adresy i ulice</h2>
  <button type="button" className="przycisk mt-2" disabled={loading} onClick={()=>setProba(p=>p+1)}>{loading?'Sprawdzam e-mapę…':proba?'Sprawdź ponownie w e-mapie':'Sprawdź w e-mapie'}</button>
  <p className="tekst-pomocniczy text-sm mt-1" role="status">{loading?'Pobieram dane z gminnej warstwy ulic…':!wynik?'Porównaj nazwę i identyfikatory z gminną ewidencją.':wynik.status==='niedostepne'?'Usługa e-mapy jest chwilowo niedostępna.':wynik.status==='brak'?'Warstwa nie zwróciła ulicy w sprawdzanym punkcie. To nie dowodzi braku wpisu w ewidencji.':wynik.zgodneId===true?(wynik.zgodnaNazwa?'SIMC, ULIC i nazwa zgodne z gminną e-mapą.':'SIMC i ULIC zgodne; nazwa różni się od naszej bazy — wymaga weryfikacji.'):wynik.zgodneId===false?'W tym punkcie zwrócono inne identyfikatory. Powiązanie z naszą ulicą wymaga sprawdzenia.':'Dane ulic w pobliżu wskazanego punktu z gminnej e-mapy.'}</p>
  {wynik?.wyniki.map(w=><div key={w.simc+':'+w.ulic} className="text-sm mt-2">
   <strong>{w.cecha} {w.nazwa} · {w.miejscowosc}</strong>
   <p>SIMC: {w.simc} · ULIC: {w.ulic}</p>
   <Link href={{pathname:'/',query:{q:w.nazwa,miejscowosc:w.miejscowosc}}}>Znajdź tę ulicę w naszej bazie →</Link>
   {w.numer_drogi?<p>Numer w e-mapie: {w.numer_drogi}</p>:null}
   {w.uchwala?<p>Opis uchwały w e-mapie: {w.uchwala}</p>:null}
   {w.opis?<p>{w.opis}</p>:null}
  </div>)}
  {wynik?.sprawdzono?<p className="tekst-pomocniczy text-xs mt-1">Sprawdzono: {new Date(wynik.sprawdzono).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'})}</p>:null}
  <p className="tekst-pomocniczy text-xs mt-2">Potwierdzenie wpisu w ewidencji ulic nie ustala kategorii ani zarządcy drogi. Pobranie dotyczy jednego punktu przebiegu.</p>
  <a href="https://wyszkow.e-mapa.net/" target="_blank" rel="noreferrer" className="text-sm">Otwórz gminną e-mapę ↗</a>
 </section>;
}
