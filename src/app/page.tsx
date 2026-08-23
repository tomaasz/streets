import Link from 'next/link';
import {
  miejscowosci, policzUlice, statystyki, ulice, zarzadcy, zrodla,
} from '@/lib/zapytania';
import { ETYKIETY_KATEGORII, KATEGORIE, metryNaKm } from '@/lib/typy';
import { PlakietkaKategorii } from '@/components/Plakietka';
import { ZnacznikZrodla } from '@/components/Zrodlo';
import { BrakBazy } from '@/components/BrakBazy';
import { zBaza } from '@/lib/stan';

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
    limit: 300,
  };

  const wynik = await zBaza(() =>
    Promise.all([
      ulice(filtry),
      policzUlice(filtry),
      miejscowosci(),
      zarzadcy(),
      statystyki(),
      zrodla(),
    ])
  );
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  const [wiersze, ile, listaMiejscowosci, listaZarzadcow, stat, listaZrodel] =
    wynik.dane;
  const slownikZrodel = new Map(listaZrodel.map((z) => [z.kod, z]));

  const parametryEksportu = new URLSearchParams(
    Object.entries(filtry).flatMap(([k, v]) =>
      v && k !== 'limit' ? [[k, String(v)]] : []
    )
  );

  return (
    <>
      <h1 className="text-xl font-bold">Ulice gminy Wyszków i ich zarządcy</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Jedna ulica bywa podzielona na kilka odcinków o różnej kategorii i różnym
        zarządcy — dlatego w kolumnach poniżej może być więcej niż jedna wartość.
      </p>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kafelek etykieta="ulic w bazie" wartosc={stat.ogol.ulic} />
        <Kafelek etykieta="odcinków dróg" wartosc={stat.ogol.odcinkow} />
        <Kafelek etykieta="dróg numerowanych" wartosc={stat.ogol.drog} />
        <Kafelek
          etykieta="długość sieci"
          wartosc={metryNaKm(Number(stat.ogol.km))}
        />
      </section>

      <section className="karta mt-4 p-3">
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
      </section>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs text-[var(--tekst-2)]">
          Szukaj ulicy
          <input
            type="search"
            name="q"
            defaultValue={filtry.q ?? ''}
            placeholder="np. kosciuszki"
            className="w-56 rounded border border-[var(--linia)] bg-[var(--tlo)] px-2 py-1.5 text-sm text-[var(--tekst)]"
          />
        </label>
        <Wybor nazwa="kategoria" etykieta="Kategoria" wartosc={filtry.kategoria}>
          {KATEGORIE.map((k) => (
            <option key={k} value={k}>
              {ETYKIETY_KATEGORII[k]}
            </option>
          ))}
        </Wybor>
        <Wybor nazwa="miejscowosc" etykieta="Miejscowość" wartosc={filtry.miejscowosc}>
          {listaMiejscowosci.map((m) => (
            <option key={m.miejscowosc} value={m.miejscowosc}>
              {m.miejscowosc} ({m.ile})
            </option>
          ))}
        </Wybor>
        <Wybor nazwa="zarzadca" etykieta="Zarządca" wartosc={filtry.zarzadca}>
          {listaZarzadcow
            .filter((z) => Number(z.odcinkow) > 0)
            .map((z) => (
              <option key={z.kod} value={z.kod}>
                {z.nazwa}
              </option>
            ))}
        </Wybor>
        <button
          type="submit"
          className="rounded border border-[var(--linia)] bg-[var(--tlo-2)] px-3 py-1.5 text-sm font-medium"
        >
          Filtruj
        </button>
        <Link href="/" className="text-sm no-underline hover:underline">
          Wyczyść
        </Link>
      </form>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm text-[var(--tekst-2)]">
        <span>
          Znaleziono <strong className="text-[var(--tekst)]">{ile}</strong> ulic
          {wiersze.length < ile ? ` (pokazano ${wiersze.length})` : ''}
        </span>
        <span className="flex gap-3">
          <a href={`/api/eksport?format=csv&${parametryEksportu}`} className="no-underline hover:underline">
            CSV
          </a>
          <a href={`/api/eksport?format=geojson&${parametryEksportu}`} className="no-underline hover:underline">
            GeoJSON
          </a>
        </span>
      </div>

      <div className="przewijalne mt-2">
        <table className="dane">
          <thead>
            <tr>
              <th>Ulica</th>
              <th>Miejscowość</th>
              <th>Kategoria</th>
              <th>Zarządca</th>
              <th>Nr drogi</th>
              <th>Źródło</th>
              <th className="text-right">Długość</th>
            </tr>
          </thead>
          <tbody>
            {wiersze.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/ulica/${u.slug}`} className="font-medium no-underline hover:underline">
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
                <td className="text-[var(--tekst-2)]">{u.miejscowosc}</td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    {u.kategorie.length === 0 ? (
                      <span className="text-[var(--tekst-2)]">brak danych</span>
                    ) : (
                      u.kategorie.map((k) => <PlakietkaKategorii key={k} kategoria={k} />)
                    )}
                  </span>
                </td>
                <td>
                  {u.zarzadcy.length === 0 ? (
                    <span className="text-[var(--tekst-2)]">—</span>
                  ) : (
                    u.zarzadcy.join(', ')
                  )}
                </td>
                <td className="whitespace-nowrap">{u.numery_drog.join(', ') || '—'}</td>
                <td>
                  <ZnacznikZrodla
                    kody={u.zrodla}
                    pewnosc={u.pewnosc_min}
                    slownik={slownikZrodel}
                    x_2180={u.x_2180}
                    y_2180={u.y_2180}
                  />
                </td>
                <td className="text-right whitespace-nowrap">{metryNaKm(u.dlugosc_m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kafelek({ etykieta, wartosc }: { etykieta: string; wartosc: string | number }) {
  return (
    <div className="karta p-3">
      <div className="text-lg font-bold">{wartosc}</div>
      <div className="text-xs text-[var(--tekst-2)]">{etykieta}</div>
    </div>
  );
}

function Wybor({
  nazwa, etykieta, wartosc, children,
}: {
  nazwa: string; etykieta: string; wartosc?: string; children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--tekst-2)]">
      {etykieta}
      <select
        name={nazwa}
        defaultValue={wartosc ?? ''}
        className="rounded border border-[var(--linia)] bg-[var(--tlo)] px-2 py-1.5 text-sm text-[var(--tekst)]"
      >
        <option value="">wszystkie</option>
        {children}
      </select>
    </label>
  );
}
