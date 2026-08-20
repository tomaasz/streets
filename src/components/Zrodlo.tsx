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
}: {
  kody: string[];
  pewnosc?: number | null;
  slownik: Map<string, Zrodlo>;
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
        return (
          <span key={kod}>
            {i > 0 ? <span className="text-[var(--tekst-2)]">, </span> : null}
            {z?.url ? (
              <a href={z.url} title={tytul} rel="noreferrer" target="_blank">
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
