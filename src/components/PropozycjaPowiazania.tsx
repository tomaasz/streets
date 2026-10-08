'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { zatwierdzPowiazanie } from '@/app/braki/actions';
import type { Kandydat } from '@/lib/dopasowania';
import { ETYKIETY_KATEGORII,metryNaKm } from '@/lib/typy';

export function PropozycjaPowiazania({klucz,hash,propozycjeHash,kandydaci,uchwala,dlugosc,prgSlug}: {
 klucz:string;hash:string;propozycjeHash:string;kandydaci:Kandydat[];uchwala:boolean;dlugosc:number|null;prgSlug?:string;
}) {
 const [state,action,pending]=useActionState(zatwierdzPowiazanie,{ok:false,komunikat:''});
 const [selected,setSelected]=useState<number[]>([]);
 const suma=kandydaci.filter(k=>selected.includes(k.id)).reduce((s,k)=>s+(k.dlugosc_m ?? 0),0);
 return <details className="propozycje-szczegoly mt-3"><summary>Sprawdź propozycje ({kandydaci.length})</summary><form action={action} className="propozycja-powiazania mt-3">
   <input type="hidden" name="klucz" value={klucz}/><input type="hidden" name="zrodlo_hash" value={hash}/><input type="hidden" name="propozycje_hash" value={propozycjeHash}/>
   <fieldset><legend className="font-semibold">{uchwala?'Proponowane odcinki do uchwały':'Proponowany przebieg z BDOT10k'}</legend>
   <p className="tekst-pomocniczy mt-1">{uchwala?'Wybierz odcinek lub kilka odcinków, które w całości obejmuje pozycja uchwały.':'Wybierz odcinki tworzące przebieg tej ulicy. Powiązanie geometrii nie ustala kategorii ani zarządcy.'}</p>
   {kandydaci.map(k=><div className="kandydat-powiazania" key={k.id}>
     <label className="wybor-kandydata"><input type="checkbox" name="odcinek" value={k.id} checked={selected.includes(k.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,k.id]:s.filter(id=>id!==k.id))}/><strong>{k.nazwa}{k.miejscowosc?` · ${k.miejscowosc}`:''}</strong></label>
     <p>{metryNaKm(k.dlugosc_m)} · kategoria w bazie: {ETYKIETY_KATEGORII[k.kategoria]}{k.nr_drogi?` · nr ${k.nr_drogi}`:''}</p>
     <p className="tekst-pomocniczy">{k.powod}</p>
     {k.roznica_m!==null ? <p className="tekst-pomocniczy">Różnica względem długości {uchwala?'z uchwały':'PRG'}: {k.roznica_m>0?'+':''}{k.roznica_m} m. Długość nie potwierdza tożsamości drogi.</p> : null}
     <Link className="przycisk" href={{pathname:'/mapa',query:{odcinki:String(k.id),odcinek:`odcinek-${k.id}`,bez_nazwy:'1',prg:prgSlug ?? k.slug ?? undefined}}} target="_blank">Porównaj odcinek na mapie ↗</Link>
   </div>)}
   </fieldset>
   {selected.length ? <p className="mt-2">Wybrano {selected.length} odcinków · łącznie {metryNaKm(suma)}{dlugosc!==null?` · ${uchwala?'uchwała':'PRG'}: ${metryNaKm(dlugosc)}`:''}.</p> : null}
   {selected.length>1 ? <Link className="przycisk mt-2" target="_blank" href={{pathname:'/mapa',query:{odcinki:selected.join(','),bez_nazwy:'1',prg:prgSlug}}}>Porównaj wybrane odcinki razem ↗</Link> : null}
   <label className="mt-3">Podstawa zatwierdzenia<textarea name="uzasadnienie" minLength={10} maxLength={2000} required rows={2} placeholder="Np. porównano załącznik mapowy, początek i koniec odcinka…"/></label>
   <label className="wybor-kandydata mt-2"><input type="checkbox" name="potwierdzam" value="tak" required/>{uchwala?'Sprawdziłem dokument i potwierdzam, że całość wybranych odcinków jest objęta tą pozycją uchwały.':'Porównałem przebieg i potwierdzam, że wybrane odcinki należą do tej ulicy.'}</label>
   <p className="tekst-pomocniczy mt-2">{uchwala?'Zatwierdzenie zapisze relację z uchwałą, kategorię gminną i zarządcę: Burmistrz Wyszkowa. Geometria BDOT pozostanie bez zmian.':'Zatwierdzenie przypisze geometrię BDOT do ulicy z PRG. Dane o kategorii i zarządcy pozostaną według dotychczasowych źródeł.'}</p>
   <button type="submit" className="przycisk primary mt-2" disabled={pending||!selected.length}>{pending?'Zapisuję powiązanie…':'Zatwierdź powiązanie'}</button>
   <p role="status" className={state.ok?'':'blad-formularza'}>{state.komunikat}</p>
 </form></details>;
}
