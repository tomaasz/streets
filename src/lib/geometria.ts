import type { GeoJSONLinie } from './typy';

/** Metry na stopień szerokości geograficznej — dość dokładne dla Polski. */
const METRY_NA_STOPIEN = 111_320;

function linie(g: GeoJSONLinie): number[][][] {
  return g.type === 'LineString'
    ? [g.coordinates as number[][]]
    : (g.coordinates as number[][][]);
}

/**
 * Douglas–Peucker na współrzędnych WGS84, z tolerancją podaną w metrach.
 *
 * Odległości liczymy w płaskim przybliżeniu: południki skracamy o cos(φ),
 * a wynik mnożymy przez metry na stopień. Na obszarze jednej gminy błąd tego
 * uproszczenia to promile — a stawką jest tolerancja rzędu metra, więc nie ma
 * po co ciągnąć tu geodezji.
 */
function upros(punkty: number[][], tolerancjaM: number): number[][] {
  if (punkty.length < 3 || tolerancjaM <= 0) return punkty;

  const k = Math.cos((punkty[0][1] * Math.PI) / 180);
  const prog = tolerancjaM / METRY_NA_STOPIEN;
  const prog2 = prog * prog;

  const zostaje = new Array<boolean>(punkty.length).fill(false);
  zostaje[0] = zostaje[punkty.length - 1] = true;

  // iteracyjnie, nie rekurencyjnie — pojedyncza linia z BDOT10k potrafi mieć
  // kilkaset wierzchołków i nie ma powodu ryzykować głębokości stosu
  const stos: [number, number][] = [[0, punkty.length - 1]];
  while (stos.length) {
    const [a, b] = stos.pop()!;
    if (b - a < 2) continue;

    const [ax, ay] = punkty[a];
    const dx = (punkty[b][0] - ax) * k;
    const dy = punkty[b][1] - ay;
    const dlugosc2 = dx * dx + dy * dy;

    let najdalej = -1;
    let gdzie = -1;
    for (let i = a + 1; i < b; i++) {
      const px = (punkty[i][0] - ax) * k;
      const py = punkty[i][1] - ay;
      // rzut punktu na odcinek a–b, przycięty do jego końców
      const t = dlugosc2
        ? Math.max(0, Math.min(1, (px * dx + py * dy) / dlugosc2))
        : 0;
      const ex = px - t * dx;
      const ey = py - t * dy;
      const odchylenie2 = ex * ex + ey * ey;
      if (odchylenie2 > najdalej) {
        najdalej = odchylenie2;
        gdzie = i;
      }
    }

    if (najdalej > prog2) {
      zostaje[gdzie] = true;
      stos.push([a, gdzie], [gdzie, b]);
    }
  }

  return punkty.filter((_, i) => zostaje[i]);
}

/**
 * Upraszcza geometrię i przycina współrzędne do sześciu miejsc po przecinku
 * (~11 cm), bo więcej i tak nie niesie informacji — PRG i BDOT10k tyle właśnie
 * podają.
 *
 * Domyślna tolerancja metra leży dobrze poniżej błędu własnego BDOT10k
 * (mapa 1:10 000), więc nie gubimy niczego, czego dane by nie zgubiły same.
 */
export function uproscGeometrie(
  geom: GeoJSONLinie | null,
  tolerancjaM: number
): GeoJSONLinie | null {
  if (!geom) return null;

  const wynik = linie(geom)
    .map((l) => upros(l, tolerancjaM))
    // linia, z której po uproszczeniu zostały mniej niż dwa punkty, nie jest
    // już linią — lepiej ją wyrzucić niż podsuwać rendererowi śmieć
    .filter((l) => l.length >= 2)
    .map((l) => l.map((p) => [zaokr(p[0]), zaokr(p[1])]));

  if (!wynik.length) return null;
  return geom.type === 'LineString' && wynik.length === 1
    ? { type: 'LineString', coordinates: wynik[0] }
    : { type: 'MultiLineString', coordinates: wynik };
}

const zaokr = (v: number) => Math.round(v * 1e6) / 1e6;
