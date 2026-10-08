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
        <article className="karta p-4">
          <h2 className="text-base font-semibold">Gminna e-mapa · Adresy i ulice</h2>
          <p className="text-sm mt-2">Korzystamy z publicznej warstwy WMS gminy Wyszków: ulice i punkty adresowe. Można włączyć ją na mapie oraz sprawdzić ulicę w jej karcie. Nazwę porównujemy po identyfikatorach SIMC i ULIC.</p>
          <p className="text-sm mt-2">Odczyt dotyczy wskazanego punktu, a nie całej ewidencji. Brak wyniku nie dowodzi braku ulicy. Nie importujemy automatycznie kategorii ani zarządcy, a wpis w ewidencji ulic nie zastępuje dokumentu nadającego kategorię drodze. Wyniki sprawdzeń są pamiętane do godziny.</p>
          <a href="https://www.punktyadresowe.pl/cgi-bin/wms/143505?SERVICE=WMS&amp;REQUEST=GetCapabilities" target="_blank" rel="noreferrer" className="text-sm">Metadane usługi WMS ↗</a>
        </article>
        <article className="karta p-4">
          <h2 className="text-base font-semibold">Nazwy pomocnicze z innych map</h2>
          <p className="text-sm mt-2">Nazwy z OSM i zgłoszeń z Targeo pokazujemy osobno, jako „nazwa bez potwierdzenia”. Nie są wpisami urzędowej bazy ulic ani potwierdzeniem kategorii lub zarządcy. Nie zwiększają liczb w podsumowaniu sieci.</p>
          <p className="text-sm mt-2">OSM sprawdzamy po braku wyników lokalnych i UUG, w okolicach wybranej miejscowości. Przypisanie miejscowości jest przybliżeniem na podstawie najbliższej osi PRG. Wyniki są pamiętane do 24 godzin.</p>
          <p className="text-sm mt-2">Targeo służy jako wskazanie nazwy z linkiem do konkretnego wyniku. Nie importujemy jego geometrii. Pokazany odcinek BDOT10k jest kandydatem do porównania, a nie potwierdzonym powiązaniem nazwy.</p>
          <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" className="text-sm">© OpenStreetMap contributors · ODbL ↗</a>
        </article>
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
