import Link from 'next/link';
import { braki } from '@/lib/zapytania';
import { metryNaKm } from '@/lib/typy';

export const dynamic = 'force-dynamic';

const WYJASNIENIA: Record<string, string> = {
  'brak odcinków':
    'Ulica jest w PRG, ale żadna oś drogi z BDOT10k nie trafiła w jej geometrię. Najczęściej: ulica projektowana, ciąg pieszy albo rozjazd między źródłami.',
  'nieustalona kategoria':
    'Odcinek istnieje, ale nie wiadomo, do jakiej kategorii został zaliczony.',
  'brak zarządcy':
    'Kategoria wewnętrzna — zarządcą jest właściciel działki. Trzeba go odczytać z ewidencji gruntów i budynków.',
  'do weryfikacji (import maszynowy)':
    'Dane pochodzą wyłącznie z importu BDOT10k. Potwierdź uchwałą o zaliczeniu drogi albo wpisem w ewidencji dróg.',
};

export default async function Strona() {
  const lista = await braki();
  const wgProblemu = lista.reduce<Record<string, number>>((acc, r) => {
    acc[r.problem] = (acc[r.problem] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <h1 className="text-xl font-bold">Braki i rekordy do weryfikacji</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        To jest lista roboty do domknięcia, nie lista błędów. Baza świadomie
        zapisuje, skąd wziął się każdy rekord i jak bardzo mu ufamy — bez tego po
        kilku miesiącach nie da się odróżnić importu od ustalenia urzędowego.
      </p>

      <div className="mt-5 grid gap-3">
        {Object.entries(wgProblemu).map(([problem, ile]) => (
          <div key={problem} className="karta p-3">
            <div className="flex items-baseline gap-3">
              <strong>{problem}</strong>
              <span className="text-sm text-[var(--tekst-2)]">{ile} ulic</span>
            </div>
            <p className="mt-1 text-sm text-[var(--tekst-2)]">
              {WYJASNIENIA[problem]}
            </p>
          </div>
        ))}
      </div>

      <div className="przewijalne mt-6">
        <table className="dane">
          <thead>
            <tr>
              <th>Ulica</th>
              <th>Miejscowość</th>
              <th>Problem</th>
              <th className="text-right">Długość</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/ulica/${r.slug}`} className="no-underline hover:underline">
                    {r.nazwa_pelna}
                  </Link>
                </td>
                <td className="text-[var(--tekst-2)]">{r.miejscowosc}</td>
                <td>{r.problem}</td>
                <td className="text-right whitespace-nowrap">{metryNaKm(r.dlugosc_m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
