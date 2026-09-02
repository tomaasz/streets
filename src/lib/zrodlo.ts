/**
 * Adres do podglądu wycinka BDOT10k na Geoportalu wokół danego punktu.
 *
 * Jedna implementacja zamiast dwóch: wcześniej ten sam bbox liczyły osobno
 * `Zrodlo.tsx` i `ulica/[slug]/page.tsx`, a `Zrodlo.tsx` nosiła to jako
 * doraźny „HOTFIX" zamiast stałego kodu.
 */
export function bdot10kUrl(x2180?: number | null, y2180?: number | null): string {
  if (!x2180 || !y2180) {
    return 'https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/';
  }
  // bbox o wielkości 1×1 km wokół punktu
  const bbox = `${x2180 - 500},${y2180 - 500},${x2180 + 500},${y2180 + 500}`;
  return `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?bbox=${bbox}`;
}
