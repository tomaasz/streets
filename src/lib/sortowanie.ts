export const SORTOWANIE = {
 nazwa:'Ulica / droga',miejscowosc:'Miejscowość',kategoria:'Kategoria',
 zarzadca:'Zarządca',numer:'Nr drogi',zrodlo:'Źródło',dlugosc:'Długość',
} as const;
export type KolumnaSortowania = keyof typeof SORTOWANIE;
export function sortowanie(sort?:string,kierunek?:string) {
 return {sort:sort && Object.hasOwn(SORTOWANIE,sort) ? sort as KolumnaSortowania : 'miejscowosc' as const,
 kierunek:kierunek==='desc'?'desc' as const:'asc' as const};
}
