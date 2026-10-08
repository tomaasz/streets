export const GMINY_DOKUMENTOW = [{ kod: '143505', nazwa: 'Wyszków', wojewodztwo: 'mazowieckie' }] as const;
export const TEMATY_DOKUMENTOW = {
  drogi: 'Wszystkie dokumenty drogowe',
  kategoria: 'Zaliczenie lub pozbawienie kategorii',
  przebieg: 'Przebieg drogi',
  nazwy: 'Nazwy ulic, rond i placów',
} as const;
export type ParametryDokumentow = { gmina: string; od: number; do: number; temat: keyof typeof TEMATY_DOKUMENTOW; q: string };
export type DokumentZnaleziony = {
  klucz: string; organ: string; rodzaj: string; numer: string;
  tytul: string; data_podjecia: string | null; rok: number;
  url: string; url_pdf: string | null; zrodlo: string;
  zalaczniki?: string[];
  url_metadanych?: string;
  dziennik_rok?: number | null; dziennik_pozycja?: number | null;
  w_bazie?: boolean; w_kolejce?: boolean;
};
export type RaportZrodla = { nazwa: string; status: 'ok' | 'czesciowe' | 'blad' | 'nieobslugiwane'; komunikat: string; stron: number; url?: string };
export type WynikSzukaniaDokumentow = { id?: string; wyniki: DokumentZnaleziony[]; zrodla: RaportZrodla[]; blad?: string };
export type DokumentWKolejce = {
  id: number; status: string; blad: string | null; dolaczono: string;
  metadane: DokumentZnaleziony;
  pliki: { id: number; rola: string; typ: string; url: string; bajtow: number }[];
};
