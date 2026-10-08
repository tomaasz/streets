import Link from 'next/link';
import {nazwyDodatkowe,porownanieNazwy} from '@/lib/nazwy-dodatkowe';
export function NazwyDodatkowe({q,miejscowosc,kategoria,zarzadca}:{q?:string;miejscowosc?:string;kategoria?:string;zarzadca?:string}) {
 const nazwy=nazwyDodatkowe(q,miejscowosc,kategoria,zarzadca);
 if(!nazwy.length) return null;
 return <section className="karta p-3 mt-3" aria-label="Nazwy bez potwierdzenia w dokumentach">
  <h2 className="text-sm font-semibold">Nazwy z innych map — bez potwierdzenia w dokumentach</h2>
  <p className="tekst-pomocniczy mt-1">To nazwy pomocnicze ze wskazanych źródeł. Nie oznacza to, że są nieoficjalne; dokumenty aplikacji nie potwierdzają nadania tych nazw.</p>
  {nazwy.map(n=><div key={n.id} className="mt-2">
   <strong>{n.nazwa} · {n.miejscowosc}</strong>{' '}<span className="status-nazwy-osm">{n.zrodlo} · nazwa bez potwierdzenia</span>
   <p className="text-sm mt-1">{n.uwagi}</p>
   <div className="flex flex-wrap gap-3 mt-2"><a href={n.url} target="_blank" rel="noreferrer">Sprawdź nazwę w {n.zrodlo} ↗</a>
   <Link href={porownanieNazwy(n)}>Porównaj z drogą {n.kandydat_nr_drogi} →</Link></div>
  </div>)}
 </section>;
}
