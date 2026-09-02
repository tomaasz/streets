/**
 * Podkłady mapowe z Geoportalu (GUGiK) w układzie PL-1992 (EPSG:2180).
 *
 * Dlaczego nie Web Mercator, w którym działa pół internetu: z trzech
 * podkładów, które są tu cokolwiek warte, tylko ortofotomapa jest wystawiona
 * w EPSG:3857. Mapa topograficzna i BDOT10k istnieją **wyłącznie** w EPSG:2180
 * (sprawdzone w GetCapabilities każdej z usług). Wybór Web Mercatora
 * oznaczałby więc rezygnację z mapy topograficznej — czyli z tego podkładu,
 * na którym urząd pracuje na co dzień. Ta sama przyczyna stoi za wyborem
 * OpenLayers zamiast MapLibre GL: MapLibre umie wyłącznie Mercatora.
 *
 * PL-1992 jest przy okazji układem, w którym trzymamy współrzędne ulic
 * (`ulica.x_2180`, `y_2180`) i w którym robi się mapy urzędowe.
 *
 * Siatka jest wspólna dla wszystkich trzech usług: kafel 512 px, lewy górny
 * róg (X=850000, Y=100000) w kolejności osi EPSG:2180, czyli w proj4
 * [wschód, północ] = [100000, 850000]. Różni je tylko wycinek drabinki:
 * ortofotomapa ma poziomy 0–16, topo i BDOT10k tylko od 2 do 14 — u siebie
 * numerowane od zera, stąd przeliczenie w `siatkaWmts`.
 */

/**
 * Rozdzielczości [m/px] = ScaleDenominator × 0,00028, poziomy 0–16.
 *
 * Uwaga: to nie jest drabinka o stałym kroku ×2. Między poziomami 7 a 8,
 * 10 a 11 oraz 12 a 13 krok wynosi 2,5 — bo GUGiK zbudował ją z okrągłych
 * mianowników skali (1:250 000, 1:100 000, 1:10 000, 1:5000…), a nie z potęg
 * dwójki. Wszystko, co tu liczymy, musi więc brać rozdzielczości z tablicy,
 * zamiast wyprowadzać je sobie z numeru poziomu.
 */
export const ROZDZIELCZOSCI_2180 = [
  8466.6836, 4233.3418, 2116.6709, 1058.33545, 529.167725, 264.583863,
  132.291931, 66.145966, 26.458386, 13.229193, 6.614597, 2.645839, 1.322919,
  0.529168, 0.264584, 0.132292, 0.066146,
];

export const ORIGIN_2180: [number, number] = [100000, 850000];
export const KAFEL_2180 = 512;

/** proj4: PL-1992 / PUWG 1992. */
export const DEF_2180 =
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 ' +
  '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

export type Podklad = {
  kod: string;
  nazwa: string;
  opis: string;
  url: string;
  warstwa: string;
  format: string;
  /** pierwszy poziom wspólnej drabinki, który usługa naprawdę serwuje */
  odPoziomu: number;
  /** ostatni taki poziom */
  doPoziomu: number;
};

const GEOPORTAL = 'https://mapy.geoportal.gov.pl/wss/service';

export const PODKLADY: Podklad[] = [
  {
    kod: 'topo',
    nazwa: 'Mapa topograficzna',
    opis: 'Urzędowa mapa topograficzna — rzeźba terenu, zabudowa, nazwy.',
    url: `${GEOPORTAL}/WMTS/guest/wmts/TOPO`,
    warstwa: 'MAPA TOPOGRAFICZNA',
    format: 'image/jpeg',
    odPoziomu: 2,
    doPoziomu: 14,
  },
  {
    kod: 'orto',
    nazwa: 'Ortofotomapa',
    opis: 'Zdjęcie lotnicze — widać, co jest w terenie naprawdę.',
    url: `${GEOPORTAL}/PZGIK/ORTO/WMTS/StandardResolution`,
    warstwa: 'ORTOFOTOMAPA',
    format: 'image/jpeg',
    odPoziomu: 0,
    doPoziomu: 16,
  },
  {
    kod: 'bdot',
    nazwa: 'BDOT10k',
    opis: 'Baza Danych Obiektów Topograficznych — źródło kategorii dróg.',
    url: `${GEOPORTAL}/WMTS/guest/wmts/BDOT10k`,
    warstwa: 'BDOT10k',
    format: 'image/png',
    odPoziomu: 2,
    doPoziomu: 14,
  },
  {
    kod: 'osm',
    nazwa: 'OpenStreetMap',
    opis: 'Otwarta mapa społecznościowa (aktualniejsze nazwy ulic).',
    url: '',
    warstwa: '',
    format: '',
    odPoziomu: 0,
    doPoziomu: 0,
  },
];

export type Siatka = {
  origin: [number, number];
  resolutions: number[];
  matrixIds: string[];
  tileSize: number;
};

/**
 * Siatka kafli WMTS dla jednej usługi, w postaci, jakiej oczekuje
 * `ol/tilegrid/WMTS`.
 *
 * `mnoznik` = 2 włącza tryb dla ekranów o podwyższonej gęstości. Geoportal
 * nie wystawia kafli @2x, więc sztuczka polega na czym innym: bierzemy ten
 * sam kafel co zwykle, ale ogłaszamy, że zajmuje on o połowę mniej pikseli
 * CSS (256 zamiast 512) przy dwukrotnie zgrubniejszej rozdzielczości widoku.
 * Zasięg kafla w terenie zostaje ten sam — 256 × 2r = 512 × r — więc siatka
 * dalej się zgadza, a obraz 512 px trafia na 256 px CSS, czyli dokładnie na
 * 512 fizycznych pikseli ekranu 2×. Efekt: mapa przestaje być rozmyta.
 *
 * Ten sposób, w odróżnieniu od leafletowego `detectRetina` (które podnosi
 * numer poziomu o jeden), nie zakłada, że drabinka idzie co ×2 — a ta
 * akurat w trzech miejscach idzie co ×2,5.
 */
export function siatkaWmts(p: Podklad, mnoznik = 1): Siatka {
  const poziomy = ROZDZIELCZOSCI_2180.slice(p.odPoziomu, p.doPoziomu + 1);
  return {
    origin: ORIGIN_2180,
    resolutions: poziomy.map((r) => r * mnoznik),
    // usługa numeruje swoje poziomy od zera, niezależnie od tego, od którego
    // szczebla wspólnej drabinki zaczyna
    matrixIds: poziomy.map((_, i) => `EPSG:2180:${i}`),
    tileSize: KAFEL_2180 / mnoznik,
  };
}

/** Drabinka rozdzielczości dla widoku mapy, zgodna z `siatkaWmts`. */
export function rozdzielczosciWidoku(mnoznik = 1): number[] {
  return ROZDZIELCZOSCI_2180.map((r) => r * mnoznik);
}

/**
 * 2 na ekranach o podwyższonej gęstości, 1 na zwykłych.
 *
 * Wyżej nie schodzimy: przy 3× kafli byłoby dziewięć razy więcej na ten sam
 * kawałek ekranu, a różnicy i tak nikt nie zobaczy.
 */
export function mnoznikEkranu(): 1 | 2 {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio > 1.3 ? 2 : 1;
}
