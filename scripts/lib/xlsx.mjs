/**
 * Minimalny czytnik XLSX — tyle, ile trzeba, żeby wczytać eksport z
 * e-dziennika. Bez zależności: plik XLSX to ZIP z XML-ami, a czytnik ZIP
 * już mamy na potrzeby paczek BDOT10k.
 */
import { listaWpisow, rozpakuj } from './zip.mjs';

const encje = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

/**
 * Eksport z e-dziennika opatruje każdy element przedrostkiem przestrzeni nazw
 * (`<x:row>`, `<x:c>`), a Excel i większość generatorów pisze je gołe.
 * Wzorce muszą przyjmować oba warianty, inaczej arkusz wychodzi pusty.
 */
const P = '(?:[A-Za-z_][\\w.-]*:)?';
const RE = {
  row: new RegExp(`<${P}row\\b[^>]*>([\\s\\S]*?)</${P}row>`, 'g'),
  c: new RegExp(
    `<${P}c\\b([^>]*?)/>|<${P}c\\b([^>]*)>([\\s\\S]*?)</${P}c>`,
    'g'
  ),
  t: new RegExp(`<${P}t\\b[^>]*>([\\s\\S]*?)</${P}t>`, 'g'),
  si: new RegExp(`<${P}si>([\\s\\S]*?)</${P}si>`, 'g'),
  v: new RegExp(`<${P}v\\b[^>]*>([\\s\\S]*?)</${P}v>`),
};

/** Numer kolumny z adresu komórki: A→0, B→1, ... AA→26 */
function kolumna(adres) {
  const litery = /^([A-Z]+)/.exec(adres)?.[1] ?? 'A';
  let n = 0;
  for (const z of litery) n = n * 26 + (z.charCodeAt(0) - 64);
  return n - 1;
}

/** Serial daty Excela → YYYY-MM-DD (system 1900, z jego znanym przesunięciem). */
export function dataZSeriala(n) {
  const dni = Math.floor(Number(n));
  if (!Number.isFinite(dni) || dni < 1) return null;
  const ms = (dni - 25569) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * @param {Buffer} buf zawartość pliku .xlsx
 * @returns {string[][]} wiersze pierwszego arkusza jako tekst
 */
export function czytajXlsx(buf) {
  const wpisy = listaWpisow(buf);
  const czytaj = (koniec) => {
    const w = wpisy.find((x) => x.nazwa.endsWith(koniec));
    return w ? rozpakuj(buf, w).toString('utf8') : '';
  };

  // wspólne teksty; komórki typu "s" trzymają indeks do tej tablicy
  const wspolne = [];
  for (const m of czytaj('xl/sharedStrings.xml').matchAll(RE.si)) {
    const kawalki = [...m[1].matchAll(RE.t)].map((t) => t[1]);
    wspolne.push(encje(kawalki.join('')));
  }

  const arkusz =
    czytaj('xl/worksheets/sheet1.xml') ||
    czytaj('worksheets/sheet1.xml') ||
    (() => {
      const w = wpisy.find((x) => /worksheets\/.*\.xml$/.test(x.nazwa));
      return w ? rozpakuj(buf, w).toString('utf8') : '';
    })();

  const wiersze = [];
  for (const wm of arkusz.matchAll(RE.row)) {
    const komorki = [];
    // Adres komórki jest w XLSX opcjonalny. Gdy go nie ma — a e-dziennik go nie
    // podaje — obowiązuje kolejność wystąpienia, nie „A1” dla wszystkich.
    let nastepna = 0;
    for (const cm of wm[1].matchAll(RE.c)) {
      const atrybuty = cm[1] ?? cm[2] ?? '';
      const tresc = cm[3] ?? '';
      const adres = /\br="([A-Z]+\d+)"/.exec(atrybuty)?.[1];
      const typ = /\bt="([^"]+)"/.exec(atrybuty)?.[1];
      let wartosc = '';
      if (typ === 's') {
        const i = Number(RE.v.exec(tresc)?.[1] ?? -1);
        wartosc = wspolne[i] ?? '';
      } else if (typ === 'inlineStr') {
        wartosc = encje(
          [...tresc.matchAll(RE.t)].map((t) => t[1]).join('')
        );
      } else {
        wartosc = encje(RE.v.exec(tresc)?.[1] ?? '');
      }
      const i = adres ? kolumna(adres) : nastepna;
      komorki[i] = wartosc.trim();
      nastepna = i + 1;
    }
    wiersze.push([...komorki].map((k) => k ?? ''));
  }
  return wiersze;
}
