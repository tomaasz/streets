'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {StatusNazwyOsm} from './StatusNazwyOsm';
type Wynik = { dodatkowa?:string; kandydat_nr_drogi?:string; osm?:boolean; uug?:boolean; id?:string; slug: string | null; odcinek_id?: number; numery_drog:string[]; nazwa_pelna: string; miejscowosc: string };

export function SzukajDrogi({ value = '', miejscowosc = '', kategoria = '', zarzadca = '', widok, powrot }: {
  value?: string; miejscowosc?: string; kategoria?: string; zarzadca?: string;
  widok: 'lista' | 'mapa'; powrot: string;
}) {
  const [q, setQ] = useState(value);
  const [ile, setIle] = useState(0);
  const [wyniki, setWyniki] = useState<Wynik[]>([]);
  const [otwarte, setOtwarte] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [blad, setBlad] = useState(false);
  const [uugStatus,setUugStatus]=useState<string>();
  const [osmStatus,setOsmStatus]=useState<string>();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (root.current?.querySelector("input") !== document.activeElement) setQ(value); }, [value]);
  useEffect(() => {
    setWyniki([]); setIle(0); setActive(-1); setBlad(false);
    setUugStatus(undefined);setOsmStatus(undefined);
    if (q.trim().length < 2) { setLoading(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const sp = new URLSearchParams({ q: q.trim(), limit: '6' });
        for (const [k, v] of Object.entries({ miejscowosc, kategoria, zarzadca })) if (v) sp.set(k, v);
        const response = await fetch(`/api/ulice?${sp}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Nie udało się pobrać podpowiedzi');
        const dane = await response.json();
        if(!controller.signal.aborted) {setUugStatus(dane.uug?.status);setOsmStatus(dane.osm?.status);}
        if (!controller.signal.aborted) { setWyniki([...dane.ulice,...(dane.dodatkowe ?? []).slice(0,6).map((w:{id:string;nazwa:string;miejscowosc:string;kandydat_nr_drogi:string})=>({id:w.id,dodatkowa:w.id,kandydat_nr_drogi:w.kandydat_nr_drogi,slug:null,nazwa_pelna:w.nazwa,miejscowosc:w.miejscowosc,numery_drog:[]})),...(dane.uug?.wyniki ?? []).slice(0,6).map((w:{id:string;nazwa:string;miejscowosc:string})=>({id:w.id,uug:true,slug:null,nazwa_pelna:w.nazwa,miejscowosc:w.miejscowosc,numery_drog:[]})),...(dane.osm?.wyniki ?? []).slice(0,6).map((w:{id:string;nazwa:string;miejscowosc:string})=>({id:w.id,osm:true,slug:null,nazwa_pelna:w.nazwa,miejscowosc:w.miejscowosc,numery_drog:[]}))].slice(0,6)); setIle(dane.ile + (dane.dodatkowe?.length ?? 0) || dane.uug?.wyniki.length || dane.osm?.wyniki.length || 0); }
      } catch { if (!controller.signal.aborted) setBlad(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, miejscowosc, kategoria, zarzadca]);
  const pasujaceNumery = (w: Wynik) => w.numery_drog.filter(n=>n.toLowerCase().includes(q.trim().toLowerCase()));
  const numer = (n:string) => {
    const start=n.toLowerCase().indexOf(q.trim().toLowerCase());
    return start<0 ? n : <>{n.slice(0,start)}<mark>{n.slice(start,start+q.trim().length)}</mark>{n.slice(start+q.trim().length)}</>;
  };
  const href = (w: Wynik) => w.dodatkowa ? {pathname:'/mapa' as const,query:{q:w.kandydat_nr_drogi,miejscowosc:w.miejscowosc,dodatkowa:w.dodatkowa}} : w.osm ? {pathname:'/mapa' as const,query:{q,miejscowosc:w.miejscowosc,osm:'1',odcinek:w.id}} : w.uug ? {pathname:'/mapa' as const,query:{q,miejscowosc:w.miejscowosc,uug:'1',odcinek:w.id}} : w.odcinek_id
    ? { pathname:'/mapa' as const,query:{q:w.numery_drog[0],miejscowosc:w.miejscowosc,odcinek:`odcinek-${w.odcinek_id}`,odcinki:String(w.odcinek_id)} }
    : widok === 'mapa'
    ? { pathname: '/mapa' as const, query: { q: w.nazwa_pelna, miejscowosc: w.miejscowosc, ...(kategoria && { kategoria }), ...(zarzadca && { zarzadca }), slug: w.slug } }
    : { pathname: `/ulica/${w.slug}` as `/ulica/${string}`, query: { powrot } };
  return <div ref={root} className="szukaj-drogi" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOtwarte(false); }}>
    <label htmlFor={`${id}-input`}>Szukaj ulicy lub numeru drogi</label>
    <input id={`${id}-input`} type="search" name="q" value={q} placeholder="np. Jadowska lub 440768W" autoComplete="off"
      role="combobox" aria-autocomplete="list" aria-expanded={otwarte && q.trim().length >= 2} aria-controls={`${id}-wyniki`}
      aria-activedescendant={otwarte && active >= 0 && wyniki[active] ? `${id}-${active}` : undefined}
      onFocus={() => setOtwarte(true)} onChange={(e) => { setQ(e.target.value); setOtwarte(true); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { setOtwarte(false); setActive(-1); }
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && wyniki.length) {
          e.preventDefault(); setOtwarte(true);
          setActive((a) => e.key === 'ArrowDown' ? (a + 1) % wyniki.length : (a <= 0 ? wyniki.length - 1 : a - 1));
        }
        if (e.key === 'Enter' && otwarte && active >= 0) {
          e.preventDefault(); root.current?.querySelector<HTMLAnchorElement>(`[data-wynik="${active}"]`)?.click();
        }
      }} />
    {otwarte && q.trim().length >= 2 ? <div className="podpowiedzi">
      <ul id={`${id}-wyniki`} role="listbox" aria-label="Podpowiedzi ulic">
        {wyniki.map((w, i) => <li key={w.id ?? w.slug ?? w.odcinek_id} id={`${id}-${i}`} role="option" aria-selected={active === i}>
          <Link data-wynik={i} href={href(w)} onClick={() => setOtwarte(false)}>
            <strong>{w.nazwa_pelna}{w.uug ? " · UUG/PRG" : ""}</strong>
            {w.osm ? <StatusNazwyOsm/> : null}
            {w.dodatkowa ? <span className="status-nazwy-osm">Targeo · nazwa bez potwierdzenia</span> : null}
            <span>{w.osm ? 'Okolice ' : ''}{w.miejscowosc ?? 'Miejscowość nieustalona'}{w.numery_drog.length ? ' · nr drogi ' : ''}{w.numery_drog.map((n,j)=><span className="numer-podpowiedzi" key={n}>{j?', ':''}{numer(n)}</span>)}</span>
            {pasujaceNumery(w).length ? <span>Pasuje numer drogi: {pasujaceNumery(w).join(', ')}</span> : null}
          </Link>
        </li>)}
      </ul>
      <p role="status">{loading ? 'Szukam…' : blad ? 'Podpowiedzi są niedostępne. Użyj przycisku Szukaj.' : wyniki.length ? `${wyniki.length} z ${ile} wyników. Strzałki wybierają wynik, Enter go otwiera.` : osmStatus==='niedostepne' ? 'Brak wyników lokalnych. Nie udało się sprawdzić OSM.' : osmStatus==='brak' ? 'Brak pasującej nazwy w bazie lokalnej, UUG i aktualnym OSM.' : uugStatus==='brak' ? 'Brak wyników lokalnych i w aktualnym UUG/PRG.' : uugStatus==='niedostepne' ? 'Brak wyników lokalnych. Usługa UUG jest chwilowo niedostępna.' : 'Brak podpowiedzi ulic. Użyj Szukaj, aby sprawdzić wyniki.'}</p>
    </div> : <ul id={`${id}-wyniki`} role="listbox" aria-label="Podpowiedzi ulic" hidden />}
  </div>;
}
