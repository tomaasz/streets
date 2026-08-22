/**
 * Grubości, kolejność i widoczność kresek na mapie — sama arytmetyka,
 * bez OpenLayers. Dzięki temu da się to sprawdzić bez przeglądarki, a
 * komponent mapy zajmuje się już tylko sklejaniem obiektów `ol/style`.
 */

/** Kategoria wyższa rysuje się nad niższą, jak na mapie drogowej. */
export const RANGA_KATEGORII: Record<string, number> = {
  krajowa: 60,
  wojewodzka: 50,
  powiatowa: 40,
  gminna: 30,
  nieustalona: 20,
  wewnetrzna: 10,
};

/** Grubość kreski [px] przy widoku całej gminy; bliżej rośnie. */
const SZEROKOSC_BAZOWA: Record<string, number> = {
  krajowa: 4,
  wojewodzka: 3.6,
  powiatowa: 3.2,
  gminna: 2.8,
  nieustalona: 2.4,
  wewnetrzna: 2,
};

/** Rozdzielczość [m/px] przy widoku całej gminy i przy największym zbliżeniu. */
const ROZ_DALEKO = 26;
const ROZ_BLISKO = 0.26;

const przytnij = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Ile drogi „przejechaliśmy” od widoku całej gminy (0) do maksymalnego
 * zbliżenia (1). Liczone logarytmicznie, bo tak właśnie działa zoom —
 * liniowo po rozdzielczości kreski przez pierwszą połowę zakresu prawie
 * nie drgnęłyby, a potem wystrzeliłyby.
 */
export function postepZblizenia(rozdzielczosc: number): number {
  if (!(rozdzielczosc > 0)) return 1;
  return przytnij(
    Math.log2(ROZ_DALEKO / rozdzielczosc) / Math.log2(ROZ_DALEKO / ROZ_BLISKO),
    0,
    1
  );
}

/**
 * Grubość kreski rośnie ze zbliżeniem, ale wolniej niż skala — droga ma na
 * mapie zostać kreską, a nie rozlać się w pas. Przy widoku całej gminy
 * krajowa ma 2,5 px, przy pełnym zbliżeniu 7,5 px.
 */
export function szerokoscLinii(
  kategoria: string | undefined,
  rozdzielczosc: number
): number {
  const baza = SZEROKOSC_BAZOWA[kategoria ?? 'nieustalona'] ?? 2.4;
  return baza * (0.62 + 1.25 * postepZblizenia(rozdzielczosc));
}

/**
 * Obwódka pod kreską — to ona sprawia, że droga czyta się nad ortofotomapą
 * i że skrzyżowania nie zlewają się w plamę.
 */
export function szerokoscObwodki(szerokosc: number): number {
  return szerokosc + 2.6;
}

/** Nazwy wzdłuż osi mają sens dopiero, gdy jest gdzie je zmieścić. */
export function widocznaEtykieta(rozdzielczosc: number): boolean {
  return rozdzielczosc < 1.6;
}

/** Numer drogi (np. „S8”, „618”) czyta się z daleka i wchodzi wcześniej. */
export function widocznyNumer(rozdzielczosc: number): boolean {
  return rozdzielczosc < 14;
}
