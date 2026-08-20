// Transformacja PL-1992 (EPSG:2180) -> WGS84 (EPSG:4326).
// Odwrotne odwzorowanie Gaussa-Krugera na elipsoidzie GRS80.
// Parametry: lat0=0, lon0=19E, k0=0.9993, FE=500000, FN=-5300000.

const A = 6378137.0;
const F = 1 / 298.257222101; // GRS80
const E2 = F * (2 - F);
const K0 = 0.9993;
const FE = 500000.0;
const FN = -5300000.0;
const LON0 = (19 * Math.PI) / 180;

const EP2 = E2 / (1 - E2);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

/**
 * Kolejnosc argumentow jak w WKT z GUGiK: najpierw easting, potem northing.
 * @param {number} e easting PL-1992 (~ 170k-870k)
 * @param {number} n northing PL-1992 (~ 130k-790k)
 * @returns {[number, number]} [lon, lat] w stopniach
 */
export function pl1992ToWgs84(e, n) {
  const northing = n - FN;
  const easting = e - FE;

  const M = northing / K0;
  const mu =
    M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256));

  const phi1 =
    mu +
    ((3 * E1) / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * E1 ** 2) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * E1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * E1 ** 4) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const C1 = EP2 * cosPhi1 ** 2;
  const T1 = tanPhi1 ** 2;
  const N1 = A / Math.sqrt(1 - E2 * sinPhi1 ** 2);
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 ** 2, 1.5);
  const D = easting / (N1 * K0);

  const lat =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) *
          D ** 6) /
          720);

  const lon =
    LON0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5) /
        120) /
      cosPhi1;

  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

/** MULTILINESTRING((x y, ...),(...)) w PL-1992 -> GeoJSON MultiLineString w WGS84 */
export function wktToGeoJson(wkt) {
  if (!wkt) return null;
  const m = /^\s*(MULTILINESTRING|LINESTRING|POINT|MULTIPOLYGON|POLYGON)\s*(.*)$/is.exec(
    wkt.trim()
  );
  if (!m) return null;
  const type = m[1].toUpperCase();
  const body = m[2];

  const pair = (s) => {
    const [a, b] = s.trim().split(/\s+/).map(Number);
    return pl1992ToWgs84(a, b);
  };
  const ring = (s) => s.split(',').map(pair);

  if (type === 'POINT') {
    return { type: 'Point', coordinates: pair(body.replace(/[()]/g, '')) };
  }
  if (type === 'LINESTRING') {
    return {
      type: 'MultiLineString',
      coordinates: [ring(body.replace(/[()]/g, ''))],
    };
  }
  if (type === 'MULTILINESTRING') {
    const parts = [...body.matchAll(/\(([^()]*)\)/g)].map((x) => ring(x[1]));
    return { type: 'MultiLineString', coordinates: parts };
  }
  if (type === 'POLYGON') {
    const parts = [...body.matchAll(/\(([^()]*)\)/g)].map((x) => ring(x[1]));
    return { type: 'Polygon', coordinates: parts };
  }
  if (type === 'MULTIPOLYGON') {
    const polys = [...body.matchAll(/\(\(([^()]*(?:\)[^()]*\([^()]*)*)\)\)/g)];
    return {
      type: 'MultiPolygon',
      coordinates: polys.map((p) =>
        [...p[0].matchAll(/\(([^()]*)\)/g)].map((x) => ring(x[1]))
      ),
    };
  }
  return null;
}

/** Przyblizona dlugosc geometrii w metrach (liczona w PL-1992, wiec wprost euklidesowa). */
export function wktLengthMeters(wkt) {
  if (!wkt) return null;
  let total = 0;
  for (const part of wkt.matchAll(/\(([^()]*)\)/g)) {
    const pts = part[1]
      .split(',')
      .map((s) => s.trim().split(/\s+/).map(Number))
      .filter((p) => p.length === 2 && p.every(Number.isFinite));
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
  }
  return Math.round(total);
}

/**
 * Sprowadza geometrię liniową do MultiLineString. PRG zwraca raz LINESTRING,
 * raz MULTILINESTRING — bez normalizacji `coordinates` znaczy raz listę linii,
 * a raz listę punktów, i każdy konsument tej geometrii wykłada się inaczej.
 */
export function doMultiLine(geom) {
  if (!geom) return null;
  switch (geom.type) {
    case 'MultiLineString':
      return geom;
    case 'LineString':
      return { type: 'MultiLineString', coordinates: [geom.coordinates] };
    // Place, skwery i ronda PRG trzyma jako poligony. Obrys traktujemy jak
    // linię — inaczej te obiekty traciłyby geometrię i wypadały z dopasowania.
    case 'Polygon':
      return { type: 'MultiLineString', coordinates: geom.coordinates };
    case 'MultiPolygon':
      return { type: 'MultiLineString', coordinates: geom.coordinates.flat() };
    default:
      return null;
  }
}
