export const KLUCZE_FILTROW = ['q', 'kategoria', 'miejscowosc', 'zarzadca', 'slug', 'odcinek', 'bez_nazwy', 'odcinki', 'prg', 'sort', 'kierunek', 'uug', 'osm', 'dodatkowa', 'droga'] as const;
export type ParametryWidoku = Record<string, string | string[] | undefined>;
export function pierwszy(v: string | string[] | undefined) { return (Array.isArray(v) ? v[0] : v) || undefined; }
export function parametryFiltrow(p: ParametryWidoku) {
  return Object.fromEntries(KLUCZE_FILTROW.flatMap((k) => pierwszy(p[k]) ? [[k, pierwszy(p[k])!]] : []));
}
export function bezpiecznyPowrot(v?: string) {
  if (!v || v.startsWith('//')) return '/';
  const pathname = v.split('?')[0];
  return ['/', '/mapa', '/braki'].includes(pathname) ? v : '/';
}

export function offsetStrony(v: string | string[] | undefined, limit=50) {
  const n=Number(pierwszy(v));
  return Number.isFinite(n) ? Math.max(0,Math.floor(n/limit)*limit) : 0;
}
