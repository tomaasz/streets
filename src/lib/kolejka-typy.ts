export const STATUSY = { do_weryfikacji: 'Do weryfikacji', w_trakcie: 'W trakcie', wyjasnione: 'Wyjaśnione' } as const;
export type StatusPracy = keyof typeof STATUSY;

export const GRUPY = {
  dopasowania: 'Uchwały do dopasowania',
  geometria: 'Przebieg ulicy do dopasowania',
  dokumenty: 'Wymagają danych o zarządcy',
  zrodla: 'Wymagają potwierdzenia źródłem',
  obiekty: 'Ronda i skwery',
} as const;
