import type { DokumentWKolejce } from '@/lib/dokumenty-typy';
import { PonowPobranieDokumentu } from './PonowPobranieDokumentu';

const STATUSY:Record<string,string>={do_przetworzenia:'Do przetworzenia',blad_pobrania:'Niepełne pobranie',brak_pliku:'Publikacja bez pliku',przetworzony:'Przetworzony'};
export function KolejkaDokumentow({dokumenty}:{dokumenty:DokumentWKolejce[]}) {
  return <section className="mt-8" aria-labelledby="kolejka-dokumentow-tytul">
    <h2 id="kolejka-dokumentow-tytul" className="text-lg font-semibold">Kolejka przetwarzania</h2>
    <p className="tekst-pomocniczy mt-1">Zachowane dokumenty i strony publikacji oczekują na odczyt treści oraz weryfikację powiązań z drogami. Pokazujemy ostatnie 100 pozycji.</p>
    {!dokumenty.length?<p className="karta p-4 mt-3 tekst-pomocniczy">Kolejka jest pusta. Wyszukaj dokumenty i dołącz wybrane pozycje.</p>:<div className="dokumenty-wyniki mt-3">{dokumenty.map(d=><article key={d.id} className="karta p-4">
      <p className="font-semibold">{d.metadane.rodzaj} {d.metadane.numer} · {STATUSY[d.status]}</p>
      <p className="mt-1 text-sm">{d.metadane.tytul}</p>
      <p className="tekst-pomocniczy mt-1">{d.metadane.organ} · Dołączono: {d.dolaczono}</p>
      <a className="inline-block mt-2 text-sm" href={d.metadane.url} target="_blank" rel="noreferrer">Publikacja źródłowa ↗</a>
      <ul className="mt-2 space-y-1 text-sm">{d.pliki.map(p=><li key={p.id}>
        <a href={`/api/dokumenty/${d.id}/pliki/${p.id}`} target="_blank" rel="noreferrer">{p.rola==='metadane'?'Pobierz metadane ze źródła':p.rola==='publikacja'?'Pobierz zachowaną stronę publikacji':p.typ==='application/pdf'?'Podgląd zachowanego PDF':'Pobierz zachowany dokument'} · {Math.ceil(p.bajtow/1024)} KB</a>
      </li>)}</ul>
      {d.blad?<p className="mt-2 text-sm">{d.blad}</p>:null}
      {d.status==='brak_pliku'?<p className="tekst-pomocniczy mt-2">Zachowano stronę publikacji. Nie rozpoznano odnośnika do pliku dokumentu.</p>:null}
      {d.status==='blad_pobrania'?<PonowPobranieDokumentu id={d.id}/>:null}
    </article>)}</div>}
  </section>;
}
