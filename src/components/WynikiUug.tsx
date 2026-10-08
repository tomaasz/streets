'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {OdpowiedzUug} from '@/lib/uug';
import type {OdpowiedzOsm} from '@/lib/osm';
import {StatusNazwyOsm} from './StatusNazwyOsm';
export function WynikiUug({q,miejscowosc,kategoria,zarzadca}:{q:string;miejscowosc?:string;kategoria?:string;zarzadca?:string}) {
 const [dane,setDane]=useState<(OdpowiedzUug & {osm?:OdpowiedzOsm})|null>(null);
 useEffect(()=>{
  setDane(null);if(!miejscowosc||kategoria||zarzadca) return;
  const c=new AbortController();fetch('/api/uug?'+new URLSearchParams({q,miejscowosc}),{signal:c.signal}).then(r=>{if(!r.ok) throw new Error();return r.json();}).then(d=>{if(!c.signal.aborted)setDane(d);}).catch(()=>{if(!c.signal.aborted)setDane({status:'niedostepne',wyniki:[]});});return()=>c.abort();
 },[q,miejscowosc,kategoria,zarzadca]);
 return <section className="karta p-3 mt-3" aria-label="Dodatkowe wyszukiwanie w UUG i OpenStreetMap">
 <h2 className="text-sm font-semibold">Aktualny rejestr ulic GUGiK · UUG</h2>
 <p role="status" className="tekst-pomocniczy mt-1">{!miejscowosc?'Wybierz miejscowość, aby sprawdzić aktualny PRG w UUG.':kategoria||zarzadca?'UUG nie ustala kategorii ani zarządcy. Wyczyść te filtry, aby sprawdzić nazwę w UUG.':!dane?'Brak wyników lokalnych — sprawdzam aktualny rejestr UUG…':dane.status==='niedostepne'?'Usługa UUG jest chwilowo niedostępna. Spróbuj ponownie później.':dane.status==='brak'?'UUG również nie znalazło tej ulicy. Nazwa widoczna na podkładzie mapy nie oznacza obecności w rejestrze PRG.':dane.status==='miejscowosc'?'Wybierz miejscowość gminy Wyszków.':`Znaleziono ${dane.wyniki.length} wyników w aktualnym PRG przez UUG. Kategoria i zarządca wymagają osobnego potwierdzenia.`}</p>
 {dane?.wyniki.map(w=><p className="mt-2" key={w.id}><Link href={{pathname:'/mapa',query:{q,miejscowosc,uug:'1',odcinek:w.id}}}>{w.nazwa} · {w.miejscowosc} — pokaż przebieg</Link><span className="tekst-pomocniczy"> · źródło: UUG/PRG</span></p>)}
 <a href="https://services.gugik.gov.pl/uug/" className="text-sm" target="_blank" rel="noreferrer">Otwórz usługę GUGiK ↗</a>
 {dane?.osm ? <div className="mt-3 border-t border-[var(--linia)] pt-3">
  <h2 className="text-sm font-semibold">Nazwy z OpenStreetMap — poza bazą urzędową</h2>
  <p className="tekst-pomocniczy mt-1" role="status">{dane.osm.status==='niedostepne' ? 'Nie udało się sprawdzić OSM. Spróbuj ponownie później.' : dane.osm.wyniki.length ? 'Nie mamy potwierdzenia tych nazw w dokumentach aplikacji. Nie oznacza to, że nazwy są nieoficjalne. Kategoria i zarządca są nieustalone; miejscowość określono przybliżeniem przestrzennym.' : 'W aktualnych obiektach OSM również brak pasującej nazwy. Sam napis na podkładzie mapy nie wystarcza do dodania ulicy.'}</p>
  {dane.osm.wyniki.map(w=><div key={w.id} className="mt-2">
   <Link href={{pathname:'/mapa',query:{q,miejscowosc,osm:'1',odcinek:w.id}}}>{w.nazwa} · okolice {w.miejscowosc} — pokaż przebieg</Link>{' '}<StatusNazwyOsm/>
   <a href={w.url} target="_blank" rel="noreferrer" className="block text-sm">Sprawdź obiekt w OSM ↗</a>
  </div>)}
  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-sm">© OpenStreetMap contributors · ODbL ↗</a>
 </div> : null}
 </section>;
}
