import { drogi } from '@/lib/zapytania';
import { BrakBazy } from '@/components/BrakBazy';
import { zBaza } from '@/lib/stan';
import { metryNaKm } from '@/lib/typy';
import { PlakietkaKategorii, PlakietkaPewnosci } from '@/components/Plakietka';

export const dynamic = 'force-dynamic';

export default async function Strona() {
  const wynik = await zBaza(() => drogi());
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  const lista = wynik.dane;
  const publiczne = lista.filter((d) => d.kategoria !== 'wewnetrzna');

  return (
    <>
      <h1 className="text-xl font-bold">Drogi numerowane w gminie</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Numery i kategorie pochodzą z BDOT10k. Opisy przebiegu dróg krajowych,
        wojewódzkich i powiatowych uzupełniono z wykazów BIP — te mają pewność 2.
        Numery gminne nadaje Zarząd Województwa Mazowieckiego; ich potwierdzeniem
        jest uchwała Rady Miejskiej o zaliczeniu drogi do kategorii.
      </p>

      <div className="przewijalne mt-5">
        <table className="dane">
          <thead>
            <tr>
              <th>Numer</th>
              <th>Kategoria</th>
              <th>Zarządca</th>
              <th>Przebieg</th>
              <th>Klasa</th>
              <th className="text-right">Ulic</th>
              <th className="text-right">Długość w gminie</th>
              <th>Pewność</th>
            </tr>
          </thead>
          <tbody>
            {publiczne.map((d) => (
              <tr key={d.id}>
                <td className="font-semibold whitespace-nowrap">{d.numer}</td>
                <td><PlakietkaKategorii kategoria={d.kategoria} /></td>
                <td>{d.zarzadca ?? '—'}</td>
                <td>
                  {d.przebieg ?? <span className="text-[var(--tekst-2)]">—</span>}
                  {d.uwagi ? (
                    <span className="block text-xs text-[var(--tekst-2)]">{d.uwagi}</span>
                  ) : null}
                </td>
                <td className="text-[var(--tekst-2)]">{d.klasa ?? '—'}</td>
                <td className="text-right">{d.ulic}</td>
                <td className="text-right whitespace-nowrap">
                  {metryNaKm(d.dlugosc_gmina_m)}
                </td>
                <td><PlakietkaPewnosci pewnosc={d.pewnosc} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
