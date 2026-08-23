import type { Zrodlo } from '@/lib/typy';

const OPIS_PEWNOSCI: Record<number, string> = {
  1: 'import maszynowy — do weryfikacji',
  2: 'źródło urzędowe wtórne',
  3: 'akt prawa miejscowego / ewidencja dróg',
};

const KOLOR_PEWNOSCI: Record<number, string> = {
  1: 'var(--kat-krajowa)',
  2: 'var(--kat-powiatowa)',
  3: 'var(--kat-gminna)',
};

/**
 * Skąd wiadomo i na ile pewnie. Bez tego wiersz zaimportowany hurtem
 * z BDOT10k wygląda w tabeli tak samo wiarygodnie jak potwierdzony uchwałą.
 */
export function ZnacznikZrodla({
  kody,
  pewnosc,
  slownik,
  x_2180,
  y_2180,
  url_pdf,
}: {
  kody: string[];
  pewnosc?: number | null;
  slownik: Map<string, Zrodlo>;
  x_2180?: number | null;
  y_2180?: number | null;
  url_pdf?: string | null;
}) {
  if (!kody.length) return <span className="text-[var(--tekst-2)]">—</span>;

  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      {kody.map((kod, i) => {
        const z = slownik.get(kod);
        const etykieta = z?.skrot ?? kod;
        const tytul = z
          ? `${z.nazwa}${z.gestor ? ` · ${z.gestor}` : ''}`
          : kod;
          
        let linkUrl = z?.url;
        // HOTFIX: dopóki baza się nie odświeży na produkcji (w poniedziałek),
        // wymuszamy tu właściwy, poprawny adres pobierania.
        if (kod === 'bdot10k') {
          if (x_2180 && y_2180) {
            // bbox o wielkości 1x1 km wokół środka ulicy
            const bbox = `${x_2180 - 500},${y_2180 - 500},${x_2180 + 500},${y_2180 + 500}`;
            linkUrl = `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?bbox=${bbox}`;
          } else {
            linkUrl = 'https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/';
          }
        } else if (kod === 'uchwala' && url_pdf) {
          linkUrl = url_pdf;
        }

        return (
          <span key={kod}>
            {i > 0 ? <span className="text-[var(--tekst-2)]">, </span> : null}
            {linkUrl ? (
              <a href={linkUrl} title={tytul} rel="noreferrer" target="_blank">
                {etykieta}
              </a>
            ) : (
              <span title={tytul}>{etykieta}</span>
            )}
          </span>
        );
      })}
      {pewnosc ? (
        <span
          className="text-xs font-semibold"
          style={{ color: KOLOR_PEWNOSCI[pewnosc] ?? 'var(--tekst-2)' }}
          title={`Pewność ${pewnosc}/3 — ${OPIS_PEWNOSCI[pewnosc]}`}
        >
          {pewnosc}/3
        </span>
      ) : null}
    </span>
  );
}
