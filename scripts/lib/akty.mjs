/**
 * Wspólna logika rozpoznawania aktów prawnych — używana przez import
 * z eksportu XLSX i przez pobieranie ze stron wydawcy.
 */

/** Akty o drogach, ulicach i nazewnictwie. Reszta nas nie interesuje. */
export const TEMAT =
  /(drog|ulic|rond|skwer|\bplac\b|kategori\w+ dróg|nazw\w+ (ulic|rond|skwer|plac))/i;

/** Ta sama instytucja występuje w dzienniku pod kilkoma nazwami. */
const KANON = [
  [/burmistrz/i, 'Burmistrz Wyszkowa'],
  [/rada miejska/i, 'Rada Miejska w Wyszkowie'],
  [/rada powiatu/i, 'Rada Powiatu Wyszkowskiego'],
  [/zarząd powiatu/i, 'Zarząd Powiatu Wyszkowskiego'],
  [/starosta/i, 'Starosta Wyszkowski'],
  [/komisja bezpieczeństwa/i, 'Komisja Bezpieczeństwa i Porządku Publicznego w Wyszkowie'],
];

export const kanonicznyOrgan = (nazwa) =>
  KANON.find(([wz]) => wz.test(nazwa ?? ''))?.[1] ?? (nazwa || null);

const RODZAJE = {
  uchwala: 'uchwała', uchwaly: 'uchwała',
  zarzadzenie: 'zarządzenie', zarzadzenia: 'zarządzenie',
  rozporzadzenie: 'rozporządzenie', rozporzadzenia: 'rozporządzenie',
  obwieszczenie: 'obwieszczenie', obwieszczenia: 'obwieszczenie',
};

export const bezOgonkow = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim();

export const rodzajAktu = (s) =>
  RODZAJE[bezOgonkow(s)] ?? RODZAJE[bezOgonkow(s).replace(/[ay]$/, 'a')] ?? 'uchwała';

const MIESIACE = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12,
};

/** Data z tekstu: 02.02.2026, 2026-02-02, „2 lutego 2026 r.” albo serial Excela. */
export function data(kom, dataZSeriala) {
  const s = String(kom ?? '').trim();
  if (!s) return null;
  if (dataZSeriala && /^\d{4,6}(\.\d+)?$/.test(s)) return dataZSeriala(s);
  let m = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(s);
  if (m && MIESIACE[m[2].toLowerCase()]) {
    return `${m[3]}-${String(MIESIACE[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Rozbija zbitkę w rodzaju
 *   „Uchwała nr XII/118/2019 Rada Miejska w Wyszkowie z dnia 26 września
 *    2019 r. w sprawie zaliczenia drogi do kategorii dróg gminnych”
 * na części. Zwraca null, gdy tekst nie ma tej postaci — wtedy dane
 * pochodzą z osobnych kolumn.
 */
export function rozbijTytul(tekst) {
  // Na stronie wydawcy części pozycji rozdzielone są kreskami pionowymi,
  // w eksporcie arkusza — spacjami. Sprowadzamy oba zapisy do jednego.
  const t = String(tekst ?? '').replace(/\s*[|·]\s*/g, ' ').replace(/\s+/g, ' ');
  const m =
    /(Uchwał[ay]|Zarządzeni[ae]|Rozporządzeni[ae]|Obwieszczeni[ae])\s*(?:nr\s*)?([\w/.-]+)\s+(.*?)\s*z\s+dnia?\s+[^.]{5,40}?\s*r\.?\s*(w\s+sprawie\s+[\s\S]+)/i.exec(
      t
    );
  if (!m) return null;
  return {
    rodzaj: rodzajAktu(m[1]),
    numer: m[2].replace(/^nr\s*/i, '').trim(),
    organ: m[3].trim() || null,
    tytul: m[4].replace(/\s+/g, ' ').trim(),
  };
}

export const zTytulem = (t) =>
  /^w sprawie/i.test(t) ? t : `w sprawie ${t}`;
