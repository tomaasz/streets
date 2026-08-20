import { ETYKIETY_KATEGORII, KOLORY_KATEGORII } from '@/lib/typy';

export function PlakietkaKategorii({ kategoria }: { kategoria: string }) {
  return (
    <span
      className="plakietka"
      style={{ color: KOLORY_KATEGORII[kategoria] ?? 'var(--tekst-2)' }}
      title={`Kategoria drogi: ${ETYKIETY_KATEGORII[kategoria] ?? kategoria}`}
    >
      {ETYKIETY_KATEGORII[kategoria] ?? kategoria}
    </span>
  );
}

export function PlakietkaPewnosci({ pewnosc }: { pewnosc: number }) {
  const opis: Record<number, string> = {
    1: 'import maszynowy — do weryfikacji',
    2: 'źródło urzędowe wtórne',
    3: 'akt prawa miejscowego / ewidencja dróg',
  };
  const kolor = pewnosc >= 3 ? 'var(--kat-gminna)' : pewnosc === 2 ? 'var(--kat-powiatowa)' : 'var(--kat-krajowa)';
  return (
    <span className="plakietka" style={{ color: kolor }} title={opis[pewnosc]}>
      pewność {pewnosc}/3
    </span>
  );
}
