// Ten sam podział, co w scripts/seed.mjs — inaczej „Plac Jana Matejki”
// z uchwały nie trafiłby w „pl. Jana Matejki” z bazy. PRG ma w Wyszkowie
// jedno i drugie osobno: ulicę Jana Matejki i plac Jana Matejki, więc
// cecha musi wejść do klucza dopasowania, a nie zostać zdjęta.
const CECHY = [
  ['Aleja ', 'al.'], ['Al. ', 'al.'], ['Plac ', 'pl.'], ['Pl. ', 'pl.'],
  ['Rondo ', 'rondo'], ['Skwer ', 'skwer'], ['Bulwar ', 'bulwar'],
  ['Osiedle ', 'os.'], ['Os. ', 'os.'], ['Park ', 'park'],
];

export function rozbijNazwe(pelna) {
  for (const [prefiks, cecha] of CECHY) {
    if (pelna.startsWith(prefiks)) return { cecha, nazwa: pelna.slice(prefiks.length) };
  }
  return { cecha: 'ul.', nazwa: pelna };
}

const bezOgonkow = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();

/**
 * Nazwy z uchwały i z bazy muszą sprowadzić się do jednego zapisu.
 * Różnią się ogonkami, wielkością liter i interpunkcją — ale nie cechą,
 * bo ta jest częścią tożsamości obiektu.
 */
export function normalizuj(s) {
  return bezOgonkow(s)
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/\.+$/, ''))
    .filter(Boolean)
    .join(' ');
}

/** Klucz dopasowania: miejscowość + cecha + nazwa. */
export const klucz = (miejscowosc, cecha, nazwa) =>
  `${normalizuj(miejscowosc)}|${cecha}|${normalizuj(nazwa)}`;
