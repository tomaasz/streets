import { BrakBazy } from '@/components/BrakBazy';
import { zBaza } from '@/lib/stan';
import { akty } from '@/lib/zapytania';

export const dynamic = 'force-dynamic';

type Parametry = Promise<Record<string, string | string[] | undefined>>;

const KOLOR_STATUSU: Record<string, string> = {
  'obowiązuje': 'var(--kat-gminna)',
  uchylony: 'var(--kat-krajowa)',
  zmieniony: 'var(--kat-powiatowa)',
  nieustalony: 'var(--tekst-2)',
};

export default async function Strona({ searchParams }: { searchParams: Parametry }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) || undefined;

  const wynik = await zBaza(() => akty(q));
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  const lista = wynik.dane;

  const lata = new Set(
    lista.map((a) => a.data_podjecia?.slice(0, 4)).filter(Boolean)
  );

  return (
    <>
      <h1 className="text-xl font-bold">Akty prawa miejscowego</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Uchwały Rady Miejskiej i zarządzenia Burmistrza dotyczące dróg, ulic
        i nazewnictwa. To one rozstrzygają, do jakiej kategorii droga została
        zaliczona — wpis w tej tabeli podnosi pewność rekordu do 3/3.
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs text-[var(--tekst-2)]">
          Szukaj w tytule lub numerze
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="np. nazwy ulicy"
            className="w-64 rounded border border-[var(--linia)] bg-[var(--tlo)] px-2 py-1.5 text-sm text-[var(--tekst)]"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-[var(--linia)] bg-[var(--tlo-2)] px-3 py-1.5 text-sm font-medium"
        >
          Filtruj
        </button>
      </form>

      <p className="mt-4 text-sm text-[var(--tekst-2)]">
        {lista.length} aktów
        {lata.size ? ` z lat ${[...lata].sort()[0]}–${[...lata].sort().at(-1)}` : ''}
      </p>

      {lista.length === 0 ? (
        <p className="karta mt-3 p-4 text-sm text-[var(--tekst-2)]">
          Brak aktów w bazie. Uruchom <code>npm run data:akty</code>, żeby
          zaciągnąć je z BIP, albo dopisz je ręcznie do{' '}
          <code>db/seed/akty.csv</code>.
        </p>
      ) : (
        <div className="przewijalne mt-3">
          <table className="dane">
            <thead>
              <tr>
                <th>Numer</th>
                <th>Data</th>
                <th>Organ</th>
                <th>Tytuł</th>
                <th>Dziennik</th>
                <th>Status</th>
                <th className="text-right">Powiązania</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap font-semibold">
                    {a.url_pdf ? (
                      <a href={a.url_pdf} rel="noreferrer" target="_blank">
                        {a.numer}
                      </a>
                    ) : (
                      a.numer
                    )}
                  </td>
                  <td className="whitespace-nowrap text-[var(--tekst-2)]">
                    {a.data_podjecia ?? '—'}
                  </td>
                  <td className="whitespace-nowrap text-[var(--tekst-2)]">{a.organ}</td>
                  <td>
                    {a.url ? (
                      <a href={a.url} rel="noreferrer" target="_blank">
                        {a.tytul}
                      </a>
                    ) : (
                      a.tytul
                    )}
                  </td>
                  <td className="whitespace-nowrap text-[var(--tekst-2)]">
                    {a.dziennik_rok && a.dziennik_pozycja
                      ? `${a.dziennik_rok} poz. ${a.dziennik_pozycja}`
                      : '—'}
                  </td>
                  <td>
                    <span
                      className="plakietka"
                      style={{ color: KOLOR_STATUSU[a.status] ?? 'var(--tekst-2)' }}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap text-[var(--tekst-2)]">
                    {Number(a.powiazanych_ulic) + Number(a.powiazanych_drog) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
