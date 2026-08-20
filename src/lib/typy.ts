export type GeoJSONLinie = {
  type: 'MultiLineString' | 'LineString';
  coordinates: number[][][] | number[][];
};

export type WierszUlicy = {
  id: number;
  slug: string;
  simc: string;
  sym_ul: string;
  miejscowosc: string;
  cecha: string;
  nazwa: string;
  nazwa_pelna: string;
  dlugosc_m: number | null;
  kategorie: string[];
  zarzadcy: string[];
  zarzadcy_kody: string[];
  numery_drog: string[];
  liczba_odcinkow: number;
  ma_luke: boolean | null;
  wielu_zarzadcow: boolean | null;
  geom: GeoJSONLinie | null;
};

export type Odcinek = {
  id: number;
  kategoria: string;
  nr_drogi: string | null;
  klasa: string | null;
  dlugosc_m: number | null;
  nawierzchnia: string | null;
  zarzadca: string | null;
  zarzadca_kod: string | null;
  zarzadca_typ: string | null;
  jednostka: string | null;
  telefon: string | null;
  email: string | null;
  www: string | null;
  podstawa_prawna: string | null;
  utrzymujacy: string | null;
  zrodlo: string;
  pewnosc: number;
  przebieg: string | null;
  uwagi: string | null;
  geom: GeoJSONLinie | null;
};

export const KATEGORIE = [
  'krajowa',
  'wojewodzka',
  'powiatowa',
  'gminna',
  'wewnetrzna',
  'nieustalona',
] as const;

export const ETYKIETY_KATEGORII: Record<string, string> = {
  krajowa: 'krajowa',
  wojewodzka: 'wojewódzka',
  powiatowa: 'powiatowa',
  gminna: 'gminna',
  wewnetrzna: 'wewnętrzna',
  nieustalona: 'nieustalona',
};

export const KOLORY_KATEGORII: Record<string, string> = {
  krajowa: 'var(--kat-krajowa)',
  wojewodzka: 'var(--kat-wojewodzka)',
  powiatowa: 'var(--kat-powiatowa)',
  gminna: 'var(--kat-gminna)',
  wewnetrzna: 'var(--kat-wewnetrzna)',
  nieustalona: 'var(--kat-nieustalona)',
};

export function metryNaKm(m: number | null | undefined): string {
  if (m == null) return '—';
  return m >= 1000
    ? `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} km`
    : `${m} m`;
}
