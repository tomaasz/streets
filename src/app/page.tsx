import { WynikiUug } from '@/components/WynikiUug';
import { NazwyDodatkowe } from '@/components/NazwyDodatkowe';
import Link from 'next/link';
import {
  opcjeFiltrow, policzUlice, statystyki, ulice, zrodla,
} from '@/lib/zapytania';
import { SORTOWANIE,sortowanie } from '@/lib/sortowanie';
import { metryNaKm } from '@/lib/typy';
import { PlakietkaKategorii } from '@/components/Plakietka';
import { ZnacznikZrodla } from '@/components/Zrodlo';
import { BrakBazy } from '@/components/BrakBazy';
import { zBaza } from '@/lib/stan';
import { FiltryDrog } from '@/components/FiltryDrog';
import { Paginacja } from '@/components/Paginacja';
import { parametryFiltrow, offsetStrony } from '@/lib/filtry';

export const dynamic = 'force-dynamic';

type Parametry = Promise<Record<string, string | string[] | undefined>>;
const pierwszy = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) || undefined;

export default async function Strona({ searchParams }: { searchParams: Parametry }) {
  const sp = await searchParams;
  const filtry = {
    q: pierwszy(sp.q),
    kategoria: pierwszy(sp.kategoria),
    miejscowosc: pierwszy(sp.miejscowosc),
    zarzadca: pierwszy(sp.zarzadca),
    ...sortowanie(pierwszy(sp.sort),pierwszy(sp.kierunek)),
    limit: 50,
    slug: pierwszy(sp.slug),
    offset: offsetStrony(sp.offset),
  };

  const wynik = await zBaza(() =>
    Promise.all([
      ulice(filtry),
      policzUlice(filtry),
      opcjeFiltrow(filtry),
      statystyki(),
      zrodla(),
    ])
  );
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  const [wiersze, ile, opcje, stat, listaZrodel] =
    wynik.dane;
  const slownikZrodel = new Map(listaZrodel.map((z) => [z.kod, z]));

  const aktualneFiltry = parametryFiltrow(sp);
  const powrot = '/' + (new URLSearchParams({ ...aktualneFiltry, ...(filtry.offset > 0 ? { offset: String(filtry.offset) } : {}) }).size ? '?' + new URLSearchParams({ ...aktualneFiltry, ...(filtry.offset > 0 ? { offset: String(filtry.offset) } : {}) }) : '');

  return (
    <>
      <h1 className="text-xl font-bold">Ulice i drogi gminy Wyszków</h1>
      <p className="opis-strony mt-1 text-sm text-[var(--tekst-2)]">
        Jedna ulica bywa podzielona na kilka odcinków o różnej kategorii i różnym
        zarządcy — dlatego w kolumnach poniżej może być więcej niż jedna wartość.
      </p>

      <section className="statystyki-skrot" aria-label="Podsumowanie sieci dróg">
        <Kafelek etykieta="ulic w bazie" wartosc={stat.ogol.ulic} />
        <Kafelek etykieta="odcinków dróg" wartosc={stat.ogol.odcinkow} />
        <Kafelek etykieta="dróg numerowanych" wartosc={stat.ogol.drog} />
        <Kafelek
          etykieta="długość sieci"
          wartosc={metryNaKm(Number(stat.ogol.km))}
        />
      </section>

      <section className="podsumowanie podsumowanie-kategorie" aria-labelledby="tytul-podsumowania">
        <h2 id="tytul-podsumowania" className="text-sm font-semibold">Podsumowanie według kategorii dróg</h2>
      <div className="mt-1">
        <div className="przewijalne">
          <table className="dane">
            <thead>
              <tr>
                <th>Kategoria</th>
                <th className="text-right">Ulic</th>
                <th className="text-right">Odcinków</th>
                <th className="text-right">Długość</th>
              </tr>
            </thead>
            <tbody>
              {stat.wgKategorii.map((k) => (
                <tr key={k.kategoria}>
                  <td>
                    <Link href={`/?kategoria=${k.kategoria}`} className="no-underline">
                      <PlakietkaKategorii kategoria={k.kategoria} />
                    </Link>
                  </td>
                  <td className="text-right">{k.ulic}</td>
                  <td className="text-right">{k.odcinkow}</td>
                  <td className="text-right">{metryNaKm(Number(k.dlugosc_m))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </section>

      <div className="wyniki-drog">
      <FiltryDrog p={sp} widok="lista" opcje={opcje} />
      <p className="wyniki-licznik text-sm" role="status">Znaleziono <strong>{ile}</strong> pozycji.{filtry.q && /^\d+[a-z]?$/i.test(filtry.q.trim()) ? <span className="tekst-pomocniczy"> Szukasz fragmentu numeru „{filtry.q}”. Wyniki obejmują ulice i drogi z pasującym numerem lub opisem odcinka.</span> : null}</p>
      <Paginacja pathname="/" query={aktualneFiltry} offset={filtry.offset} limit={50} ile={ile} />
      <div className="przewijalne mt-2">
        <table className="dane ulice-tabela">
          <thead>
            <tr>
              {Object.entries(SORTOWANIE).map(([key,label])=><th key={key} scope="col" aria-sort={filtry.sort===key ? filtry.kierunek==='asc'?'ascending':'descending' : 'none'}>
                <Link prefetch={false} href={{pathname:'/',query:{...aktualneFiltry,sort:key,kierunek:filtry.sort===key && filtry.kierunek==='asc'?'desc':'asc'}}}
                  aria-label={`${label}: sortuj ${filtry.sort===key && filtry.kierunek==='asc'?'malejąco':'rosnąco'}`}>
                  {label} <span aria-hidden="true">{filtry.sort===key ? filtry.kierunek==='asc'?'↑':'↓':'↕'}</span>
                </Link>
              </th>)}
            </tr>
          </thead>
          <tbody>
            {wiersze.map((u) => (
              <tr key={u.id}>
                <td data-label="Ulica / droga">
                  <Link href={u.odcinek_id ? { pathname: "/mapa", query: { q:u.numery_drog[0], miejscowosc:u.miejscowosc ?? undefined, odcinek:`odcinek-${u.odcinek_id}`,odcinki:String(u.odcinek_id) } } : { pathname: `/ulica/${u.slug}`, query: { powrot } }} className="font-medium no-underline hover:underline">
                    {u.nazwa_pelna}
                  </Link>
                  {u.wielu_zarzadcow ? (
                    <span
                      className="ml-2 text-xs text-[var(--kat-nieustalona)]"
                      title="Ulica ma odcinki o różnych zarządcach"
                    >
                      ⚑ dzielona
                    </span>
                  ) : null}
                </td>
                <td data-label="Miejscowość" className="text-[var(--tekst-2)]">{u.miejscowosc ?? "Nieustalona"}</td>
                <td data-label="Kategoria">
                  <span className="flex flex-wrap gap-1">
                    {u.kategorie.length === 0 ? (
                      <span className="text-[var(--tekst-2)]">brak danych</span>
                    ) : (
                      u.kategorie.map((k) => <PlakietkaKategorii key={k} kategoria={k} />)
                    )}
                  </span>
                </td>
                <td data-label="Zarządca">
                  {u.zarzadcy.length === 0 ? (
                    <span className="text-[var(--tekst-2)]">—</span>
                  ) : (
                    u.zarzadcy.join(', ')
                  )}
                </td>
                <td data-label="Nr drogi" className="whitespace-nowrap">{u.numery_drog.join(', ') || '—'}</td>
                <td data-label="Źródło">
                  <ZnacznikZrodla
                    kody={u.zrodla}
                    pewnosc={u.pewnosc_min}
                    slownik={slownikZrodel}
                    x_2180={u.x_2180}
                    y_2180={u.y_2180}
                    url_pdf={u.url_pdf}
                  />
                </td>
                <td data-label="Długość" className="text-right whitespace-nowrap">{metryNaKm(u.dlugosc_m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NazwyDodatkowe q={filtry.q} miejscowosc={filtry.miejscowosc} kategoria={filtry.kategoria} zarzadca={filtry.zarzadca}/>
      {ile===0 && !filtry.slug && filtry.q && filtry.q.trim().length>=3 && filtry.q.length<=100 && /\p{L}/u.test(filtry.q) && !/^\d+\s*[a-z]?$/i.test(filtry.q.trim()) ? <WynikiUug key={JSON.stringify(filtry)} q={filtry.q} miejscowosc={filtry.miejscowosc} kategoria={filtry.kategoria} zarzadca={filtry.zarzadca}/> : null}
      {wiersze.length === 0 ? <p className="karta p-4">Brak wyników w lokalnej bazie urzędowej dla wybranych filtrów.</p> : null}
      <Paginacja pathname="/" query={aktualneFiltry} offset={filtry.offset} limit={50} ile={ile} />
      </div>

    </>
  );
}

function Kafelek({ etykieta, wartosc }: { etykieta: string; wartosc: string | number }) {
  return (
    <div className="karta statystyka">
      <div className="text-lg font-bold">{wartosc}</div>
      <div className="text-xs text-[var(--tekst-2)]">{etykieta}</div>
    </div>
  );
}
