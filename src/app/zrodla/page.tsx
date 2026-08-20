import { BrakBazy } from '@/components/BrakBazy';
import { zBaza } from '@/lib/stan';
import { zrodla } from '@/lib/zapytania';

export const dynamic = 'force-dynamic';

export default async function Strona() {
  const wynik = await zBaza(() => zrodla());
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  const lista = wynik.dane;
  return (
    <>
      <h1 className="text-xl font-bold">Źródła danych</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Każdy rekord w bazie wskazuje źródło i poziom pewności: 1 — import
        maszynowy do weryfikacji, 2 — źródło urzędowe wtórne, 3 — akt prawa
        miejscowego albo ewidencja dróg prowadzona przez zarządcę.
      </p>

      <div className="mt-5 grid gap-3">
        {lista.map((z) => (
          <article key={z.kod} className="karta p-4">
            <header className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-base font-semibold">{z.nazwa}</h2>
              <code className="text-xs text-[var(--tekst-2)]">{z.kod}</code>
              <span className="ml-auto text-xs text-[var(--tekst-2)]">
                domyślna pewność {z.domyslna_pewnosc}/3
              </span>
            </header>
            {z.opis ? <p className="mt-2 text-sm">{z.opis}</p> : null}
            <p className="mt-2 text-xs text-[var(--tekst-2)]">
              {[z.gestor, z.licencja].filter(Boolean).join(' · ')}
              {z.url ? (
                <>
                  {' · '}
                  <a href={z.url} rel="noreferrer">
                    {z.url}
                  </a>
                </>
              ) : null}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
