/** Wspólny zakres mapy i eksportu; aliasy tabel: u (ulica), o (odcinek), z (zarządca). */
export function warunkiDrog(sp: URLSearchParams) {
  const droga = sp.get('droga');
  const gdzie = [sp.get('bez_nazwy') === '1' || droga ? 'TRUE' : `(u.id IS NOT NULL OR EXISTS (
    SELECT 1 FROM akt_odcinek ao WHERE ao.odcinek_id=o.id AND ao.rola='zaliczenie do kategorii'))`];
  const par: unknown[] = [];
  const dodaj = (v: string | null, sql: (n:number) => string) => { if (v) { par.push(v); gdzie.push(sql(par.length)); } };
  // Identyfikator wybiera całą drogę, także odcinki bez przypisanej ulicy.
  dodaj(droga, (n) => `o.droga_id::text=$${n}`);
  const odcinki=(sp.get('odcinki') ?? '').split(',').filter(v=>/^\d+$/.test(v)).slice(0,100).map(Number).filter(Number.isSafeInteger);
  if(odcinki.length) {par.push(odcinki);gdzie.push(`o.id=ANY($${par.length}::int[])`);}
  dodaj(sp.get('slug'),(n) => `u.slug=$${n}`);
  dodaj(sp.get('kategoria'),(n) => `o.kategoria::text=$${n}`);
  dodaj(sp.get('zarzadca'),(n) => `z.kod=$${n}`);
  dodaj(sp.get('miejscowosc'),(n) => `(u.miejscowosc=$${n} OR (u.id IS NULL AND (
    o.opis_odcinka ILIKE '%' || $${n} || '%'${sp.get('bez_nazwy') === '1' ? ` OR o.geom_pg && (
      SELECT ST_Expand(ST_Extent(um.geom_pg)::geometry,0.005) FROM ulica um WHERE um.miejscowosc=$${n})` : ''})))`);
  const q=sp.get('q');
  if (q && !droga) { par.push(`%${q}%`); gdzie.push(`(bez_ogonkow(u.nazwa_pelna) LIKE bez_ogonkow($${par.length})
    OR bez_ogonkow(o.opis_odcinka) LIKE bez_ogonkow($${par.length}) OR o.nr_drogi ILIKE $${par.length})`); }
  return { sql:`WHERE ${gdzie.join(' AND ')}`,par };
}
