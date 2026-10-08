import { WyborFiltra, TekstFiltra } from '@/components/PoleFiltra';
import { DynamiczneFiltry } from '@/components/DynamiczneFiltry';
import Link from 'next/link';
import { kolejkaWeryfikacji } from '@/lib/kolejka';
import { FiltryDodatkowe } from '@/components/FiltryDodatkowe';
import { PropozycjaPowiazania } from '@/components/PropozycjaPowiazania';
import { zapytaj } from '@/lib/db';
import { STATUSY, GRUPY } from '@/lib/kolejka-typy';
import { BrakBazy } from '@/components/BrakBazy';
import { zBaza } from '@/lib/stan';
import { metryNaKm } from '@/lib/typy';
import { pierwszy, type ParametryWidoku } from '@/lib/filtry';
import { Paginacja } from '@/components/Paginacja';
import { WeryfikacjaForm } from '@/components/WeryfikacjaForm';
import { normalizuj } from '../../../scripts/lib/nazwy-ulic.mjs';

export const dynamic = 'force-dynamic';
const NASTEPNY_KROK: Record<string, string> = {
  'brak odcinków': 'Sprawdź przebieg w dokumentacji drogi i porównaj go z mapą. Ulica może być projektowana lub wymagać dopasowania geometrii.',
  'brak zarządcy': 'Sprawdź właściciela działek w ewidencji gruntów oraz dokumenty dotyczące zarządzania drogą.',
  'nieustalona kategoria': 'Sprawdź uchwałę o zaliczeniu do kategorii lub ewidencję dróg.',
  'do weryfikacji (import maszynowy)': 'Potwierdź kategorię i zarządcę dokumentem dotyczącym tego odcinka.',
  'nazwa spoza aktualnego rejestru ulic': 'Porównaj opis przebiegu i dokumenty o zmianach nazw. Zbieżność nazw nie wystarcza do potwierdzenia.',
  'wątpliwy odczyt dokumentu': 'Sprawdź oryginalny PDF, opis i załącznik mapowy przed powiązaniem drogi.',
  'brak powiązania pozycji uchwały': 'Sprawdź opis i załącznik uchwały, a następnie wskaż odpowiadający im odcinek lub odcinki na mapie.',
};

export default async function Strona({ searchParams }: { searchParams: Promise<ParametryWidoku> }) {
  const sp = await searchParams;
  const params = Object.fromEntries(['q','miejscowosc','problem','status','typ','grupa'].flatMap((k) => pierwszy(sp[k]) ? [[k,pierwszy(sp[k])!]] : []));
  const rawOffset = Number(pierwszy(sp.offset));
  const requestedOffset = Number.isFinite(rawOffset) ? Math.max(0,Math.trunc(rawOffset)) : 0;
  const wynik = await zBaza(()=>Promise.all([kolejkaWeryfikacji(),zapytaj<{klucz:string;rodzaj:string;uzasadnienie:string;nazwa:string;data:string}>(`SELECT klucz,rodzaj,uzasadnienie,cel->>'nazwa' nazwa,to_char(utworzono,'YYYY-MM-DD HH24:MI') data FROM powiazanie_zatwierdzone ORDER BY utworzono DESC LIMIT 10`)]));
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  const [wszystkie,historia] = wynik.dane;
  const grupa=params.grupa ?? (params.typ || params.problem || params.status || params.q || params.miejscowosc ? 'wszystkie' : 'propozycje');
  const etykiety={propozycje:'Propozycje do zatwierdzenia',...GRUPY,wszystkie:'Wszystkie sprawy'};
  const pasujeGrupa=(r:typeof wszystkie[number],g:string)=>g==='wszystkie'||(g==='propozycje' ? !!r.kandydaci?.length : r.grupa===g);
  const miejscowosci = [...new Set(wszystkie.map((r) => r.miejscowosc))].sort((a,b) => a.localeCompare(b,'pl'));
  const problemy = [...new Set(wszystkie.map((r) => r.problem))].sort((a,b) => a.localeCompare(b,'pl'));
  const przefiltrowane = wszystkie.filter((r) =>
    pasujeGrupa(r,grupa) &&
    (!params.q || normalizuj(`${r.nazwa} ${r.miejscowosc} ${r.akt ?? ''} ${r.opis ?? ''} ${r.notatka}`).includes(normalizuj(params.q))) &&
    (!params.miejscowosc || r.miejscowosc === params.miejscowosc) &&
    (!params.problem || r.problem === params.problem) &&
    (!params.status || r.status === params.status) &&
    (!params.typ || (params.typ === 'uchwaly' ? !!r.akt : !!r.slug))
  ).sort((a,b) => a.waga-b.waga || (b.dlugosc_m ?? 0)-(a.dlugosc_m ?? 0) || a.klucz.localeCompare(b.klucz));
  const offset = Math.min(requestedOffset, Math.max(0,Math.ceil(przefiltrowane.length/50)-1)*50);
  const lista = przefiltrowane.slice(offset,offset+50);
  const powrot = `/braki?${new URLSearchParams({ ...params,offset:String(offset) })}`;
  return <>
    <h1 className="text-xl font-bold">Uzupełnianie danych</h1>
    <p className="mt-1 max-w-[75ch] text-sm tekst-pomocniczy">Aplikacja szuka dopasowań ulic, odcinków i uchwał. Zacznij od propozycji: porównaj przebieg na mapie, sprawdź dokument i zatwierdź właściwe odcinki. Zatwierdzenie uzupełni dane i rozwiąże konkretny brak.</p>
    <div className="kolejka-podsumowanie mt-4" aria-label="Rodzaje spraw">
      {Object.entries(etykiety).map(([g,n])=><Link key={g} className="karta p-3" aria-current={grupa===g?'page':undefined} href={{pathname:'/braki',query:{grupa:g}}}>
        <strong>{wszystkie.filter(r=>pasujeGrupa(r,g)).length}</strong><span>{n}</span>
      </Link>)}
    </div>
    <details className="mt-3"><summary>Co oznaczają grupy spraw?</summary><p className="tekst-pomocniczy mt-2">Propozycja jest wynikiem porównania danych. W grupie „Wymagają danych o zarządcy” brakuje dokumentu o właścicielu lub zarządzaniu drogą wewnętrzną; sama nazwa ulicy nie wskazuje zarządcy. Ronda i skwery mają osobną grupę.</p></details>
    <DynamiczneFiltry className="filtry-drog wyszukiwanie" action="/braki">
      <input type="hidden" name="grupa" value={grupa}/>
      <label>Szukaj pozycji<TekstFiltra type="search" name="q" defaultValue={params.q} placeholder="Nazwa, numer uchwały lub opis" /></label>
      <FiltryDodatkowe desktopOpen={false} aktywne={[params.miejscowosc,params.problem,params.status,params.typ].filter(Boolean).length}>
      <label>Miejscowość<WyborFiltra aria-label="Miejscowość" name="miejscowosc" defaultValue={params.miejscowosc ?? ''}><option value="">Wszystkie miejscowości</option>{miejscowosci.map((m) => <option key={m}>{m}</option>)}</WyborFiltra></label>
      <label>Problem<WyborFiltra aria-label="Problem" name="problem" defaultValue={params.problem ?? ''}><option value="">Wszystkie problemy</option>{problemy.map((p) => <option key={p}>{p}</option>)}</WyborFiltra></label>
      <label>Status pracy<WyborFiltra aria-label="Status pracy" name="status" defaultValue={params.status ?? ''}><option value="">Wszystkie statusy</option>{Object.entries(STATUSY).map(([v,n]) => <option key={v} value={v}>{n}</option>)}</WyborFiltra></label>
      <label>Rodzaj pozycji<WyborFiltra aria-label="Rodzaj pozycji" name="typ" defaultValue={params.typ ?? ''}><option value="">Wszystkie pozycje</option><option value="ulice">Ulice</option><option value="uchwaly">Pozycje uchwał</option></WyborFiltra></label>
      </FiltryDodatkowe>
      <button className="przycisk primary" type="submit">Szukaj</button><Link className="przycisk" href="/braki">Wyczyść</Link>
    </DynamiczneFiltry>
    <p className="mt-4" role="status">{etykiety[grupa as keyof typeof etykiety] ?? "Wszystkie sprawy"}: <strong>{przefiltrowane.length}</strong> pozycji.</p>
    <Paginacja pathname="/braki" query={{...params,grupa}} offset={offset} limit={50} ile={przefiltrowane.length} />
    <div className="kolejka-lista">
      {lista.map((r) => <article className="karta p-4" key={r.klucz}>
        <header className="rekord-naglowek"><div><h2 className="font-semibold">{r.nazwa}</h2><p className="tekst-pomocniczy">{r.miejscowosc} · {metryNaKm(r.dlugosc_m)}</p></div><span className="plakietka">{STATUSY[r.status]}</span></header>
        <p className="mt-2 font-medium">{r.problem}</p>
        {r.akt ? <p className="mt-1"><a href={r.pdf} target="_blank" rel="noreferrer">Uchwała {r.akt} (PDF)</a> · {r.pozycja}</p> : null}
        {r.opis ? <p className="mt-2">{r.opis}</p> : null}
        <p className="mt-2 tekst-pomocniczy">{r.grupa==='obiekty' ? 'To nazwany obiekt z PRG. Brak odcinka BDOT nie oznacza, że obiekt nie istnieje. Skwer nie wymaga klasyfikowania jako droga; rondo należy porównać z drogami, które się na nim łączą.' : r.problem==='brak odcinków' ? 'Przebieg PRG jest dostępny. Brakuje przypisania odcinka BDOT, z którego pochodzą dane o kategorii i zarządcy.' : r.problem==='brak zarządcy' ? 'Odcinek jest oznaczony w BDOT jako wewnętrzny. Potrzebny jest dokument o właścicielu lub zarządzaniu terenem, np. ewidencja gruntów lub umowa. Aplikacja nie ma tych danych.' : NASTEPNY_KROK[r.problem]}</p>
        {r.blokada ? <p className="mt-2 font-medium">{r.blokada}</p> : null}
        {r.kandydaci?.length && r.zrodlo_hash ? <PropozycjaPowiazania klucz={r.klucz} hash={r.zrodlo_hash} propozycjeHash={r.propozycje_hash!} kandydaci={r.kandydaci} uchwala={!!r.akt} dlugosc={r.dlugosc_m} prgSlug={r.slug}/> : (r.grupa==='dopasowania'||r.grupa==='geometria') && !r.blokada ? <p className="mt-2 tekst-pomocniczy">Nie znaleziono propozycji na podstawie obecnych danych. {r.dane_pozycji?.typ==='ulica' ? 'Możliwa dawna nazwa ulicy — potrzebny dokument o zmianie nazwy.' : 'Potrzebny jest dokładniejszy opis, numer drogi lub załącznik mapowy.'}</p> : null}
        <div className="rekord-akcje mt-3">
          {r.slug ? <Link className="przycisk" href={{ pathname:`/ulica/${r.slug}`,query:{ powrot } }}>Sprawdź kartę ulicy</Link> : null}
          <Link className="przycisk" href={{ pathname:'/mapa',query:{ ...(r.slug ? { slug:r.slug } : {}),...(r.miejscowosc !== 'Przebieg między miejscowościami' ? { miejscowosc:r.miejscowosc } : {}),bez_nazwy:'1' } }}>Zobacz dostępny przebieg</Link>
        </div>
        <details className="mt-3"><summary>Notatki i status pracy</summary>
          {r.zmodyfikowano ? <p className="tekst-pomocniczy">Ostatni zapis: {r.zmodyfikowano}</p> : null}
          <WeryfikacjaForm klucz={r.klucz} status={r.status} notatka={r.notatka} />
        </details>
      </article>)}
    </div>
    {lista.length===0 ? <p className="karta p-4 mt-4">Brak pozycji spełniających filtry. Zmień wyszukiwanie lub wyczyść filtry.</p> : null}
    <Paginacja pathname="/braki" query={{...params,grupa}} offset={offset} limit={50} ile={przefiltrowane.length} />
    <details className="karta p-4 mt-4"><summary>Ostatnio zatwierdzone powiązania ({historia.length})</summary>
      <p className="tekst-pomocniczy mt-2">Decyzje są zachowywane przy ponownym imporcie. Gdy zmieni się geometria lub treść źródła, aplikacja wymaga ponownego porównania.</p>
      {historia.length ? <ul className="mt-3">{historia.map(h=><li className="mt-3" key={h.klucz}><strong>{h.nazwa || h.klucz}</strong> · {h.rodzaj==='uchwala'?'powiązanie uchwały':'przypisanie przebiegu'}<p>{h.uzasadnienie}</p></li>)}</ul> : <p className="mt-2">Nie zatwierdzono jeszcze powiązań.</p>}
    </details>
  </>;
}
