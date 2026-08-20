import { KOLORY_KATEGORII, type GeoJSONLinie } from '@/lib/typy';

export type WarstwaMapy = {
  geom: GeoJSONLinie | null;
  kategoria?: string;
  grubosc?: number;
  etykieta?: string;
};

function linie(geom: GeoJSONLinie | null): number[][][] {
  if (!geom) return [];
  return geom.type === 'LineString'
    ? [geom.coordinates as number[][]]
    : (geom.coordinates as number[][][]);
}

/**
 * Rysuje geometrię wprost w SVG. Bez kafelków i bibliotek zewnętrznych —
 * strona zostaje samowystarczalna, a przy jednej ulicy podkład i tak
 * niewiele wnosi.
 */
export function Mapa({
  warstwy,
  wysokosc = 320,
  tlo = true,
}: {
  warstwy: WarstwaMapy[];
  wysokosc?: number;
  tlo?: boolean;
}) {
  const wszystkie = warstwy.flatMap((w) => linie(w.geom).flat());
  if (wszystkie.length < 2) {
    return (
      <div className="karta p-4 text-sm text-[var(--tekst-2)]">
        Brak geometrii do narysowania.
      </div>
    );
  }

  const lony = wszystkie.map((p) => p[0]);
  const laty = wszystkie.map((p) => p[1]);
  const lat0 = (Math.min(...laty) + Math.max(...laty)) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);

  const x = (lon: number) => lon * k;
  const y = (lat: number) => -lat;

  const xs = lony.map(x);
  const ys = laty.map(y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const margines = Math.max((x1 - x0), (y1 - y0)) * 0.06 || 0.0005;

  const vb = [
    x0 - margines,
    y0 - margines,
    x1 - x0 + 2 * margines,
    y1 - y0 + 2 * margines,
  ];
  const skala = vb[2] / 1000; // grubość kreski w jednostkach viewBox

  return (
    <div
      className={tlo ? 'karta overflow-hidden' : 'overflow-hidden'}
      style={{ height: wysokosc }}
    >
      <svg
        viewBox={vb.join(' ')}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Przebieg dróg"
      >
        {warstwy.map((w, i) => (
          <g
            key={i}
            fill="none"
            stroke={
              w.kategoria
                ? (KOLORY_KATEGORII[w.kategoria] ?? 'var(--tekst-2)')
                : 'var(--linia)'
            }
            strokeWidth={(w.grubosc ?? 2.5) * skala}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {w.etykieta ? <title>{w.etykieta}</title> : null}
            {linie(w.geom).map((l, j) => (
              <path
                key={j}
                d={
                  'M' +
                  l.map((p) => `${x(p[0]).toFixed(6)},${y(p[1]).toFixed(6)}`).join('L')
                }
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
