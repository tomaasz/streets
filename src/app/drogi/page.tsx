import Link from 'next/link';
import { WierszDrogi } from '@/components/WierszDrogi';
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
      <p className="mt-2 text-sm tekst-pomocniczy">Wybierz „Pokaż na mapie”, aby zobaczyć odcinki drogi w gminie, lub rozwiń „Źródła i dokumenty”, aby sprawdzić pochodzenie danych.</p>

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
              <th>Mapa i źródła</th>
            </tr>
          </thead>
          <tbody>
            {publiczne.map((d) => (
              <WierszDrogi key={d.id} id={d.id} numer={d.numer}
                mapa={d.ma_geometrie ? <Link
                    href={{ pathname: '/mapa', query: { droga: String(d.id), q: d.numer } }}
                    prefetch={false}
                    className="whitespace-nowrap"
                    aria-label={`Pokaż drogę ${d.numer} na mapie`}
                  >Pokaż na mapie</Link> : <span className="text-sm tekst-pomocniczy">Brak przebiegu na mapie</span>}
                zrodla={<div className="zrodla-drogi-sekcje text-sm">
                      <div>
                        <p className="font-semibold">Dane drogi i opis przebiegu</p>
                        <p>{d.zrodlo_nazwa ?? 'Brak wskazanego źródła'}</p>
                        {d.zrodlo_url ? <a className="block mt-1" href={d.zrodlo_url} target="_blank" rel="noreferrer">Otwórz serwis źródłowy ↗</a> : null}
                        <p className="text-xs tekst-pomocniczy mt-1">Adres rejestru lub serwisu; nie jest odnośnikiem do konkretnego dokumentu.</p>
                      </div>
                      {d.zrodla_odcinkow.length ? <div>
                        <p className="font-semibold">Źródła odcinków na mapie</p>
                        <ul className="list-disc pl-4 mt-1 space-y-1">{d.zrodla_odcinkow.map(z => <li key={z.kod}>
                          {z.url ? <a href={z.url} target="_blank" rel="noreferrer">{z.nazwa} ↗</a> : z.nazwa}
                        </li>)}</ul>
                      </div> : null}
                      {d.podstawa_prawna ? <div><p className="font-semibold">Podstawa prawna w bazie</p><p>{d.podstawa_prawna}</p></div> : null}
                      <div>
                        <p className="font-semibold">Powiązane dokumenty ({d.dokumenty.length})</p>
                        {d.dokumenty.length ? <ul className="mt-1 space-y-3">{d.dokumenty.map(a => <li key={`${a.id}-${a.zakres}-${a.rola}`}>
                          <p>{a.tytul}</p>
                          <p className="text-xs tekst-pomocniczy">{a.numer} · {a.rola} · {a.zakres}</p>
                          {a.url_pdf ? <a className="block mt-1" href={a.url_pdf} target="_blank" rel="noreferrer">Podgląd dokumentu (PDF) ↗</a> : null}
                          {a.url ? <a className="block mt-1" href={a.url} target="_blank" rel="noreferrer">Publikacja dokumentu ↗</a> : null}
                          {!a.url && !a.url_pdf ? <p className="text-xs tekst-pomocniczy">Brak odnośnika do dokumentu.</p> : null}
                        </li>)}</ul> : <p className="mt-1 tekst-pomocniczy">Brak powiązanego dokumentu w bazie. Sam wpis w rejestrze nie potwierdza kategorii drogi.</p>}
                      </div>
                    </div>}
              >
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
              </WierszDrogi>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
