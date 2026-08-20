import Link from 'next/link';
import { zarzadcy } from '@/lib/zapytania';
import { metryNaKm } from '@/lib/typy';

export const dynamic = 'force-dynamic';

const TYPY: Record<string, string> = {
  krajowy: 'droga krajowa',
  wojewodzki: 'droga wojewódzka',
  powiatowy: 'droga powiatowa',
  gminny: 'droga gminna',
  wewnetrzny: 'droga wewnętrzna',
  kolejowy: 'teren kolejowy',
  lesny: 'droga leśna',
  prywatny: 'teren prywatny',
  inny: 'inny',
};

export default async function Strona() {
  const lista = await zarzadcy();
  return (
    <>
      <h1 className="text-xl font-bold">Zarządcy dróg</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Zarządca formalny wynika z art. 19 ustawy o drogach publicznych i zależy
        wyłącznie od kategorii drogi. Dla dróg wewnętrznych kategorii nie ma —
        zarządcą jest właściciel terenu (art. 8 ust. 2), którego trzeba ustalić z
        ewidencji gruntów.
      </p>

      <div className="mt-5 grid gap-3">
        {lista.map((z) => (
          <article key={z.kod} className="karta p-4">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold">{z.nazwa}</h2>
              <span className="text-xs text-[var(--tekst-2)]">{TYPY[z.typ] ?? z.typ}</span>
              <span className="ml-auto text-sm">
                {Number(z.odcinkow) > 0 ? (
                  <Link href={`/?zarzadca=${z.kod}`} className="no-underline hover:underline">
                    {z.ulic} ulic · {z.odcinkow} odc. · {metryNaKm(Number(z.dlugosc_m))}
                  </Link>
                ) : (
                  <span className="text-[var(--tekst-2)]">brak przypisanych odcinków</span>
                )}
              </span>
            </header>

            {z.jednostka ? (
              <p className="mt-2 text-sm">{z.jednostka}</p>
            ) : null}
            <p className="mt-1 text-sm text-[var(--tekst-2)]">
              {[z.adres, z.telefon, z.email].filter(Boolean).join(' · ')}
              {z.www ? (
                <>
                  {' '}
                  <a href={z.www} rel="noreferrer">
                    {z.www}
                  </a>
                </>
              ) : null}
            </p>
            {z.podstawa_prawna ? (
              <p className="mt-2 text-xs text-[var(--tekst-2)]">
                Podstawa: {z.podstawa_prawna}
              </p>
            ) : null}
            {z.uwagi ? <p className="mt-2 text-sm">{z.uwagi}</p> : null}
          </article>
        ))}
      </div>
    </>
  );
}
