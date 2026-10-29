export const KLUCZE_FILTROW = ['q', 'kategoria', 'miejscowosc', 'zarzadca', 'slug', 'odcinek', 'bez_nazwy', 'odcinki', 'prg', 'sort', 'kierunek', 'uug', 'osm', 'dodatkowa', 'droga', 'limit'] as const;
export const DOZWOLONE_LIMITY = [25, 50, 100, 200] as const;
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

export function limitStrony(v: string | string[] | undefined, domyslny = 25) {
  const n = Number(pierwszy(v));
  return (DOZWOLONE_LIMITY as readonly number[]).includes(n) ? n : domyslny;
}

export function offsetStrony(v: string | string[] | undefined, limit=25) {
  const n=Number(pierwszy(v));
  return Number.isFinite(n) ? Math.max(0,Math.floor(n/limit)*limit) : 0;
}
