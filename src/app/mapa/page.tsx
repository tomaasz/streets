import Link from 'next/link';
import { MapaInteraktywna } from '@/components/MapaInteraktywna';
import { ETYKIETY_KATEGORII, KATEGORIE } from '@/lib/typy';

export const metadata = {
  title: 'Mapa dróg — gmina Wyszków',
  description:
    'Interaktywna mapa dróg i ulic gminy Wyszków na podkładzie z Geoportalu, ' +
    'w układzie PL-1992. Kolor odpowiada kategorii drogi.',
};

type Parametry = {
  kategoria?: string;
  miejscowosc?: string;
  zarzadca?: string;
  q?: string;
};

export default async function Strona({
  searchParams,
}: {
  searchParams: Promise<Parametry>;
}) {
  const p = await searchParams;
  const zapytanie = new URLSearchParams();
  for (const k of ['kategoria', 'miejscowosc', 'zarzadca', 'q'] as const) {
    if (p[k]) zapytanie.set(k, p[k]!);
  }
  // `/api/mapa`, nie `/api/eksport` — te same dane, ale odchudzone i z ETagiem;
  // eksport zostaje tym, czym był: plikiem do pobrania
  const zrodlo = `/api/mapa${zapytanie.size ? `?${zapytanie}` : ''}`;
  // Next 16 typuje trasy, więc href idzie obiektem, nie sklejonym stringiem
  const filtr = (kat?: string) =>
    ({ pathname: '/mapa', query: kat ? { kategoria: kat } : {} }) as const;

  return (
    <>
      <h1 className="text-xl font-bold">Mapa dróg</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Podkład pochodzi z Geoportalu (GUGiK), mapa pracuje w układzie PL-1992 —
        tym samym, w którym robi się mapy urzędowe. Kliknij odcinek, żeby
        zobaczyć kategorię, zarządcę i podstawę prawną.
      </p>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={filtr()}
          className={`karta px-3 py-1 no-underline ${p.kategoria ? '' : 'font-semibold'}`}
        >
          wszystkie
        </Link>
        {KATEGORIE.filter((k) => k !== 'nieustalona').map((k) => (
          <Link
            key={k}
            href={filtr(k)}
            className={`karta px-3 py-1 no-underline ${
              p.kategoria === k ? 'font-semibold' : ''
            }`}
          >
            <span
              className="mr-2 inline-block h-[3px] w-4 align-middle"
              style={{ background: `var(--kat-${k})` }}
            />
            {ETYKIETY_KATEGORII[k]}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        <MapaInteraktywna zrodloDanych={zrodlo} wysokosc={620} />
      </div>

      <p className="mt-3 max-w-[70ch] text-xs text-[var(--tekst-2)]">
        Mapa pokazuje odcinki, dla których znamy geometrię ulicy z PRG. Drogi
        polne, leśne i dojazdy do pól, które nie mają nazwy w PRG, nie mają tu
        czego rysować — ich udział w sieci widać w{' '}
        <Link href="/braki">Brakach</Link>. Przebieg odcinka jest z BDOT10k
        i ma dokładność mapy 1:10&nbsp;000; nie zastępuje wypisu z ewidencji
        dróg ani mapy do celów projektowych.
      </p>
    </>
  );
}
