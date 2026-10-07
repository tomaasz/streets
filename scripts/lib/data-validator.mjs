/**
 * Moduł walidacji schematu i integralności danych JSON w katalogu data/.
 */
import { doMultiLine } from './pl1992.mjs';

// Dozwolone kategorie zarządzania drogami w BDOT10k
export const DOZWOLONE_KATEGORIE = new Set([
  'krajowa',
  'wojewódzka',
  'powiatowa',
  'gminna',
  'wewnętrzna',
]);

// Zakres współrzędnych geograficznych (WGS84) dla gminy Wyszków z bezpiecznym buforem
export const DOMYSLNE_GRANICE_WGS84 = {
  minLon: 21.0,
  maxLon: 22.0,
  minLat: 52.3,
  maxLat: 52.8,
};

/**
 * Walidacja geometrii MultiLineString w formacie GeoJSON.
 */
export function walidujMultiLineString(geom, granice = DOMYSLNE_GRANICE_WGS84) {
  const bledy = [];
  if (!geom || typeof geom !== 'object') {
    return { poprawny: false, bledy: ['Brak obiektu geometrii'] };
  }
  if (geom.type !== 'MultiLineString') {
    bledy.push(`Niepoprawny typ geometrii: "${geom.type}" (oczekiwano "MultiLineString")`);
  }
  if (!Array.isArray(geom.coordinates)) {
    bledy.push('Brak tablicy coordinates');
    return { poprawny: bledy.length === 0, bledy };
  }
  if (geom.coordinates.length === 0) {
    bledy.push('Geometria MultiLineString nie zawiera żadnych linii (pusta tablica coordinates)');
  }

  for (let lIdx = 0; lIdx < geom.coordinates.length; lIdx++) {
    const linia = geom.coordinates[lIdx];
    if (!Array.isArray(linia)) {
      bledy.push(`Linia #${lIdx} nie jest tablicą`);
      continue;
    }
    if (linia.length < 2) {
      bledy.push(`Linia #${lIdx} ma mniej niż 2 punkty (${linia.length})`);
    }
    for (let pIdx = 0; pIdx < linia.length; pIdx++) {
      const punkt = linia[pIdx];
      if (!Array.isArray(punkt) || punkt.length < 2) {
        bledy.push(`Punkt #${pIdx} w linii #${lIdx} nie jest parą współrzędnych [lon, lat]`);
        continue;
      }
      const [lon, lat] = punkt;
      if (typeof lon !== 'number' || Number.isNaN(lon) || typeof lat !== 'number' || Number.isNaN(lat)) {
        bledy.push(`Nieprawidłowe współrzędne liczbowe w linii #${lIdx}, punkt #${pIdx}: [${lon}, ${lat}]`);
        continue;
      }
      if (granice) {
        if (lon < granice.minLon || lon > granice.maxLon) {
          bledy.push(
            `Długość geograficzna ${lon} poza zakresem [${granice.minLon}, ${granice.maxLon}] (linia #${lIdx}, punkt #${pIdx})`
          );
        }
        if (lat < granice.minLat || lat > granice.maxLat) {
          bledy.push(
            `Szerokość geograficzna ${lat} poza zakresem [${granice.minLat}, ${granice.maxLat}] (linia #${lIdx}, punkt #${pIdx})`
          );
        }
      }
    }
  }

  return { poprawny: bledy.length === 0, bledy };
}

/**
 * Walidacja pojedynczego rekordu odcinka z data/odcinki.json.
 */
export function walidujOdcinek(odcinek, idx = 0, granice = DOMYSLNE_GRANICE_WGS84) {
  const bledy = [];
  if (!odcinek || typeof odcinek !== 'object') {
    return { poprawny: false, bledy: [`Odcinek #${idx} nie jest obiektem`] };
  }

  // kategoria_bdot
  if (typeof odcinek.kategoria_bdot !== 'string' || !DOZWOLONE_KATEGORIE.has(odcinek.kategoria_bdot)) {
    bledy.push(`Odcinek #${idx}: nieprawidłowa kategoria_bdot "${odcinek.kategoria_bdot}"`);
  }

  // dlugosc_m
  if (typeof odcinek.dlugosc_m !== 'number' || Number.isNaN(odcinek.dlugosc_m) || odcinek.dlugosc_m < 0) {
    bledy.push(`Odcinek #${idx}: nieprawidłowa dlugosc_m "${odcinek.dlugosc_m}"`);
  }

  // odcinkow_bdot
  if (
    typeof odcinek.odcinkow_bdot !== 'number' ||
    !Number.isInteger(odcinek.odcinkow_bdot) ||
    odcinek.odcinkow_bdot < 1
  ) {
    bledy.push(`Odcinek #${idx}: nieprawidłowa liczba odcinkow_bdot "${odcinek.odcinkow_bdot}"`);
  }

  // ulica (może być null dla dróg bez przypisanej ulicy)
  if (odcinek.ulica !== null) {
    if (typeof odcinek.ulica !== 'object') {
      bledy.push(`Odcinek #${idx}: pole ulica musi być obiektem lub null`);
    } else {
      const { simc, sym_ul, nazwa, miejscowosc } = odcinek.ulica;
      if (typeof simc !== 'string' || !/^\d{7}$/.test(simc)) {
        bledy.push(`Odcinek #${idx}: nieprawidłowy kod SIMC "${simc}" (wymagane 7 cyfr)`);
      }
      if (typeof sym_ul !== 'string' || !/^\d{5}$/.test(sym_ul)) {
        bledy.push(`Odcinek #${idx}: nieprawidłowy kod SYM_UL "${sym_ul}" (wymagane 5 cyfr)`);
      }
      if (typeof nazwa !== 'string' || nazwa.trim().length === 0) {
        bledy.push(`Odcinek #${idx}: brak lub pusta nazwa ulicy`);
      }
      if (typeof miejscowosc !== 'string' || miejscowosc.trim().length === 0) {
        bledy.push(`Odcinek #${idx}: brak lub pusta miejscowość ulicy`);
      }
    }
  }

  // numer (opcjonalny tekst lub null)
  if (odcinek.numer !== null && typeof odcinek.numer !== 'string') {
    bledy.push(`Odcinek #${idx}: pole numer musi być stringiem lub null`);
  }

  // geom
  const resGeom = walidujMultiLineString(odcinek.geom, granice);
  if (!resGeom.poprawny) {
    for (const b of resGeom.bledy) {
      bledy.push(`Odcinek #${idx}: ${b}`);
    }
  }

  return { poprawny: bledy.length === 0, bledy };
}

/**
 * Walidacja całego pliku data/odcinki.json.
 */
export function walidujPlikOdcinki(dane, granice = DOMYSLNE_GRANICE_WGS84) {
  const bledy = [];
  if (!dane || typeof dane !== 'object') {
    return { poprawny: false, bledy: ['Brak głównego obiektu JSON'] };
  }

  if (typeof dane.zbudowano !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dane.zbudowano)) {
    bledy.push(`Nieprawidłowa data zbudowano: "${dane.zbudowano}"`);
  }

  if (typeof dane.tolerancja_m !== 'number' || dane.tolerancja_m <= 0) {
    bledy.push(`Nieprawidłowa tolerancja_m: "${dane.tolerancja_m}"`);
  }

  if (!dane.zrodla || typeof dane.zrodla !== 'object') {
    bledy.push('Brak obiektu zrodla');
  } else {
    if (typeof dane.zrodla.prg !== 'string' || !dane.zrodla.prg) {
      bledy.push('Brak lub niepoprawna data źródła PRG w zrodla.prg');
    }
    if (typeof dane.zrodla.bdot !== 'string' || !dane.zrodla.bdot) {
      bledy.push('Brak lub niepoprawna wersja BDOT w zrodla.bdot');
    }
  }

  if (!dane.statystyki || typeof dane.statystyki !== 'object') {
    bledy.push('Brak obiektu statystyki');
  } else {
    const { ulic_prg, ulic_z_kategoria, odcinkow, odcinkow_bez_ulicy } = dane.statystyki;
    if (typeof ulic_prg !== 'number' || ulic_prg <= 0) {
      bledy.push('statystyki.ulic_prg musi być liczbą dodatnią');
    }
    if (typeof ulic_z_kategoria !== 'number' || ulic_z_kategoria < 0) {
      bledy.push('statystyki.ulic_prg_z_kategoria musi być liczbą nieujemną');
    }
    if (typeof odcinkow !== 'number' || odcinkow <= 0) {
      bledy.push('statystyki.odcinkow musi być liczbą dodatnią');
    }
    if (typeof odcinkow_bez_ulicy !== 'number' || odcinkow_bez_ulicy < 0) {
      bledy.push('statystyki.odcinkow_bez_ulicy musi być liczbą nieujemną');
    }
  }

  if (!Array.isArray(dane.odcinki)) {
    bledy.push('Pole odcinki nie jest tablicą');
    return { poprawny: bledy.length === 0, bledy };
  }

  if (dane.odcinki.length === 0) {
    bledy.push('Tablica odcinki jest pusta');
  }

  if (dane.statystyki && typeof dane.statystyki.odcinkow === 'number') {
    if (dane.odcinki.length !== dane.statystyki.odcinkow) {
      bledy.push(
        `Niezgodność liczby odcinków: tablica ma ${dane.odcinki.length}, a statystyki.odcinkow deklaruje ${dane.statystyki.odcinkow}`
      );
    }
  }

  let zliczoneBezUlicy = 0;
  for (let i = 0; i < dane.odcinki.length; i++) {
    const odcinek = dane.odcinki[i];
    if (odcinek?.ulica === null) zliczoneBezUlicy++;
    const res = walidujOdcinek(odcinek, i, granice);
    if (!res.poprawny) {
      bledy.push(...res.bledy);
      if (bledy.length > 50) {
        bledy.push('Przekroczono limit 50 błędów walidacji — przerwano dalsze sprawdzanie odcinków');
        break;
      }
    }
  }

  if (dane.statystyki && typeof dane.statystyki.odcinkow_bez_ulicy === 'number') {
    if (zliczoneBezUlicy !== dane.statystyki.odcinkow_bez_ulicy) {
      bledy.push(
        `Niezgodność odcinków bez ulicy: zliczono ${zliczoneBezUlicy}, a statystyki deklarują ${dane.statystyki.odcinkow_bez_ulicy}`
      );
    }
  }

  return { poprawny: bledy.length === 0, bledy, liczbaOdcinkow: dane.odcinki.length };
}

/**
 * Walidacja pliku surowego PRG (data/raw/prg-ulice.json).
 */
export function walidujPlikPrgUlice(dane, granice = DOMYSLNE_GRANICE_WGS84) {
  const bledy = [];
  if (!dane || typeof dane !== 'object') {
    return { poprawny: false, bledy: ['Brak głównego obiektu JSON w PRG'] };
  }
  if (!Array.isArray(dane.ulice) || dane.ulice.length === 0) {
    bledy.push('Brak tablicy ulice lub tablica jest pusta');
    return { poprawny: false, bledy };
  }

  for (let i = 0; i < dane.ulice.length; i++) {
    const u = dane.ulice[i];
    if (!u.sym_ul || !/^\d{5}$/.test(u.sym_ul)) {
      bledy.push(`Ulica PRG #${i}: nieprawidłowy sym_ul "${u.sym_ul}"`);
    }
    if (!u.simc || !/^\d{7}$/.test(u.simc)) {
      bledy.push(`Ulica PRG #${i}: nieprawidłowy simc "${u.simc}"`);
    }
    if (!u.nazwa || typeof u.nazwa !== 'string') {
      bledy.push(`Ulica PRG #${i}: brak nazwy`);
    }
    if (!u.miejscowosc || typeof u.miejscowosc !== 'string') {
      bledy.push(`Ulica PRG #${i}: brak miejscowości`);
    }
    // PRG zawiera LineString, MultiLineString, Polygon lub MultiPolygon (dla placów/rond)
    const mline = doMultiLine(u.geom);
    if (!mline) {
      bledy.push(`Ulica PRG #${i} (${u.nazwa}): brak lub nieobsługiwana geometria ${u.geom?.type}`);
    } else {
      const resGeom = walidujMultiLineString(mline, granice);
      if (!resGeom.poprawny) {
        bledy.push(...resGeom.bledy.map((b) => `Ulica PRG #${i} (${u.nazwa}): ${b}`));
        if (bledy.length > 50) break;
      }
    }
  }

  return { poprawny: bledy.length === 0, bledy, liczbaUlic: dane.ulice.length };
}

/**
 * Walidacja pliku surowego BDOT10k (data/raw/bdot-drogi.json).
 */
export function walidujPlikBdotDrogi(dane, granice = DOMYSLNE_GRANICE_WGS84) {
  const bledy = [];
  if (!dane || typeof dane !== 'object') {
    return { poprawny: false, bledy: ['Brak głównego obiektu JSON w BDOT'] };
  }
  if (!Array.isArray(dane.drogi) || dane.drogi.length === 0) {
    bledy.push('Brak tablicy drogi lub tablica jest pusta');
    return { poprawny: false, bledy };
  }

  for (let i = 0; i < dane.drogi.length; i++) {
    const d = dane.drogi[i];
    if (!d.id || typeof d.id !== 'string') {
      bledy.push(`Droga BDOT #${i}: brak identyfikatora id`);
    }
    if (!DOZWOLONE_KATEGORIE.has(d.kategoria_bdot)) {
      bledy.push(`Droga BDOT #${i}: nieprawidłowa kategoria "${d.kategoria_bdot}"`);
    }
    if (typeof d.dlugosc_m !== 'number' || d.dlugosc_m < 0) {
      bledy.push(`Droga BDOT #${i}: nieprawidłowa długość "${d.dlugosc_m}"`);
    }
    const resGeom = walidujMultiLineString(d.geom, granice);
    if (!resGeom.poprawny) {
      bledy.push(...resGeom.bledy.map((b) => `Droga BDOT #${i} (${d.id}): ${b}`));
      if (bledy.length > 50) break;
    }
  }

  return { poprawny: bledy.length === 0, bledy, liczbaDrog: dane.drogi.length };
}

/**
 * Walidacja pliku aktów BIP (data/raw/akty-bip.json).
 */
export function walidujPlikAktyBip(dane) {
  const bledy = [];
  if (!dane || typeof dane !== 'object') {
    return { poprawny: false, bledy: ['Brak głównego obiektu JSON w aktach BIP'] };
  }
  if (!Array.isArray(dane.akty)) {
    bledy.push('Brak tablicy akty');
    return { poprawny: false, bledy };
  }

  for (let i = 0; i < dane.akty.length; i++) {
    const a = dane.akty[i];
    if (!a.rodzaj || typeof a.rodzaj !== 'string') bledy.push(`Akt BIP #${i}: brak rodzaju aktu`);
    if (!a.numer || typeof a.numer !== 'string') bledy.push(`Akt BIP #${i}: brak numeru aktu`);
    if (!a.tytul || typeof a.tytul !== 'string') bledy.push(`Akt BIP #${i}: brak tytułu aktu`);
    if (a.url_pdf !== null && typeof a.url_pdf !== 'string') {
      bledy.push(`Akt BIP #${i}: nieprawidłowy url_pdf (musi być stringiem lub null)`);
    }
  }

  return { poprawny: bledy.length === 0, bledy, liczbaAktow: dane.akty.length };
}
