import { WyborFiltra } from '@/components/PoleFiltra';
import Link from 'next/link';
import { ETYKIETY_KATEGORII } from '@/lib/typy';
import { parametryFiltrow, type ParametryWidoku } from '@/lib/filtry';
import { SzukajDrogi } from './SzukajDrogi';
import { FiltryDodatkowe } from './FiltryDodatkowe';
import { WidokiEksport } from './WidokiEksport';
import { Suspense,type ReactNode } from 'react';
function KontenerFiltrow({lista,aktywne,children}:{lista:boolean;aktywne:number;children:ReactNode}) {
 return lista ? <div className="filtry-lista">{children}</div> : <FiltryDodatkowe aktywne={aktywne}>{children}</FiltryDodatkowe>;
}
import { DynamiczneFiltry } from './DynamiczneFiltry';
import type { opcjeFiltrow } from '@/lib/zapytania';

export function FiltryDrog({ p, widok, opcje }: {
  p: ParametryWidoku; widok: 'lista' | 'mapa';
  opcje: Awaited<ReturnType<typeof opcjeFiltrow>>;
}) {
  const params = parametryFiltrow(p);
  const path = widok === 'mapa' ? '/mapa' : '/';
  const powrot = `${path}${new URLSearchParams(params).size ? '?' + new URLSearchParams(params) : ''}`;
  return <section className={`wyszukiwanie ${widok==='lista' ? 'filtry-nad-kolumnami' : ''}`} aria-label="Wyszukiwanie i filtry dróg">
    <DynamiczneFiltry action={path} className="filtry-drog filtry-glowne">
      <SzukajDrogi value={params.q} miejscowosc={params.miejscowosc} kategoria={params.kategoria} zarzadca={params.zarzadca} widok={widok} powrot={powrot} />
      <button type="submit" className="przycisk primary">Szukaj</button>
      <Link href={path} className="przycisk">Wyczyść</Link>
      <KontenerFiltrow lista={widok==='lista'} aktywne={[params.kategoria,params.miejscowosc,params.zarzadca].filter(Boolean).length}>
      <label className="filtr-kategoria">Kategoria<WyborFiltra aria-label="Kategoria" name="kategoria" defaultValue={params.kategoria ?? ''}>
        <option value="">Wszystkie kategorie</option>{params.kategoria && !opcje.kategorie.some(k=>k.wartosc===params.kategoria) ? <option value={params.kategoria}>{ETYKIETY_KATEGORII[params.kategoria]} (0)</option> : null}{opcje.kategorie.map((k) => <option key={k.wartosc} value={k.wartosc}>{ETYKIETY_KATEGORII[k.wartosc]} ({k.ile})</option>)}
      </WyborFiltra></label>
      <label className="filtr-miejscowosc">Miejscowość<WyborFiltra aria-label="Miejscowość" name="miejscowosc" defaultValue={params.miejscowosc ?? ''}>
        <option value="">Wszystkie miejscowości</option>{params.miejscowosc && !opcje.miejscowosci.some(m=>m.wartosc===params.miejscowosc) ? <option value={params.miejscowosc}>{params.miejscowosc} (0)</option> : null}{opcje.miejscowosci.map((m) => <option key={m.wartosc} value={m.wartosc}>{m.wartosc} ({m.ile})</option>)}
      </WyborFiltra></label>
      <label className="filtr-zarzadca">Zarządca<WyborFiltra aria-label="Zarządca" name="zarzadca" defaultValue={params.zarzadca ?? ''}>
        <option value="">Wszyscy zarządcy</option>{params.zarzadca && !opcje.zarzadcy.some(z=>z.wartosc===params.zarzadca) ? <option value={params.zarzadca}>{params.zarzadca} (0)</option> : null}{opcje.zarzadcy.map((z) => <option key={z.wartosc} value={z.wartosc}>{z.nazwa} ({z.ile})</option>)}
      </WyborFiltra></label>
      </KontenerFiltrow>
      {params.sort ? <input type="hidden" name="sort" value={params.sort}/> : null}
      {params.kierunek ? <input type="hidden" name="kierunek" value={params.kierunek}/> : null}
      {params.bez_nazwy ? <input type="hidden" name="bez_nazwy" value={params.bez_nazwy} /> : null}
    </DynamiczneFiltry>
    <Suspense fallback={<p>Widok wyników</p>}><WidokiEksport widok={widok} /></Suspense>
  </section>;
}
