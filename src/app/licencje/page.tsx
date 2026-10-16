import Link from 'next/link';
import { licenseLegend, licenseNotation, licenseRegistry } from '@/lib/licencje';
import './licencje.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Licencje i komponenty' };

export default async function Licencje() {
  const components = await licenseRegistry();
  const legend = licenseLegend(components.map(c => c.license));
  return <div className="license-page">
    <h1>Licencje i komponenty</h1>
    <p className="license-note">Drogi gminy Wyszków — biblioteki, narzędzia i źródła danych. Wersje bezpośrednich zależności są odczytywane lokalnie; osobno oznaczamy narzędzia budowania.</p>
    <p className="license-note">Repozytoria otwierają się w nowej karcie po kliknięciu. Wyświetlenie tego zestawienia nie pobiera danych z zewnętrznych serwerów. Brak linku oznacza brak ustalonego adresu repozytorium. <Link href="/zrodla">Rejestry i źródła danych</Link>.</p>
    <section className="license-section" aria-labelledby="license-components-title">
      <h2 id="license-components-title">Biblioteki i programy</h2>
      <div className="license-table-wrap" role="region" aria-label="Komponenty aplikacji" tabIndex={0}>
        <table className="license-table">
          <thead><tr><th scope="col">Komponent</th><th scope="col">Rodzaj</th><th scope="col">Wersja</th><th scope="col">Licencja</th><th scope="col">Zastosowanie</th></tr></thead>
          <tbody>{components.map(c => <tr key={c.name}>
            <th scope="row">{c.name}{c.repositories.map(r => <div key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label} <span aria-hidden="true">↗</span><span className="license-sr-only"> (nowa karta)</span></a></div>)}</th>
            <td>{c.kind}</td><td>{c.version}</td><td>{c.license}</td><td>{c.purpose}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="license-section" aria-labelledby="license-legend-title">
      <h2 id="license-legend-title">Legenda licencji – najważniejsze zasady</h2>
      <div className="license-table-wrap" role="region" aria-label="Legenda licencji" tabIndex={0}>
        <table className="license-table"><thead><tr><th scope="col">Licencja</th><th scope="col">Główne cechy</th></tr></thead>
          <tbody>{legend.map(l => <tr key={l.id}><th scope="row">{l.title}</th><td>{l.summary}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="license-note">{licenseNotation}</p>
    </section>
  </div>;
}
