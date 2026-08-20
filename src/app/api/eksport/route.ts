import { zapytaj } from '@/lib/db';
import type { FiltryUlic } from '@/lib/zapytania';

export const dynamic = 'force-dynamic';

type Wiersz = {
  simc: string; sym_ul: string; miejscowosc: string; nazwa_pelna: string;
  dlugosc_m: number | null; kategoria: string | null; nr_drogi: string | null;
  klasa: string | null; nawierzchnia: string | null; zarzadca: string | null;
  utrzymujacy: string | null; podstawa_prawna: string | null;
  zrodlo: string | null; zrodlo_nazwa: string | null;
  zrodlo_url: string | null; pewnosc: number | null;
  odcinek_dlugosc_m: number | null; geom: unknown;
};

function warunki(f: FiltryUlic) {
  const gdzie: string[] = [];
  const par: unknown[] = [];
  if (f.q) { par.push(`%${f.q}%`); gdzie.push(`bez_ogonkow(u.nazwa_pelna) LIKE bez_ogonkow($${par.length})`); }
  if (f.kategoria) { par.push(f.kategoria); gdzie.push(`o.kategoria::text = $${par.length}`); }
  if (f.miejscowosc) { par.push(f.miejscowosc); gdzie.push(`u.miejscowosc = $${par.length}`); }
  if (f.zarzadca) { par.push(f.zarzadca); gdzie.push(`z.kod = $${par.length}`); }
  return { sql: gdzie.length ? `WHERE ${gdzie.join(' AND ')}` : '', par };
}

const csvPole = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const format = sp.get('format') === 'geojson' ? 'geojson' : 'csv';
  const { sql, par } = warunki({
    q: sp.get('q') ?? undefined,
    kategoria: sp.get('kategoria') ?? undefined,
    miejscowosc: sp.get('miejscowosc') ?? undefined,
    zarzadca: sp.get('zarzadca') ?? undefined,
  });

  const wiersze = await zapytaj<Wiersz>(
    `SELECT u.simc, u.sym_ul, u.miejscowosc, u.nazwa_pelna, u.dlugosc_m,
            o.kategoria::text AS kategoria, o.nr_drogi, o.klasa, o.nawierzchnia,
            o.dlugosc_m AS odcinek_dlugosc_m, o.podstawa_prawna, o.zrodlo, o.pewnosc,
            z.nazwa AS zarzadca, w.nazwa AS utrzymujacy,
            zr.nazwa AS zrodlo_nazwa, zr.url AS zrodlo_url,
            COALESCE(o.geom, u.geom) AS geom
       FROM ulica u
       LEFT JOIN odcinek_drogi o ON o.ulica_id = u.id
       LEFT JOIN zarzadca z      ON z.id = o.zarzadca_id
       LEFT JOIN zarzadca w      ON w.id = o.utrzymujacy_id
       LEFT JOIN zrodlo_danych zr ON zr.kod = o.zrodlo
       ${sql}
      ORDER BY u.miejscowosc, u.nazwa, o.kategoria`,
    par
  );

  const stempel = new Date().toISOString().slice(0, 10);

  if (format === 'geojson') {
    const geojson = {
      type: 'FeatureCollection',
      name: `drogi-wyszkow-${stempel}`,
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features: wiersze
        .filter((w) => w.geom)
        .map((w) => {
          const { geom, ...wlasciwosci } = w;
          return { type: 'Feature', properties: wlasciwosci, geometry: geom };
        }),
    };
    return new Response(JSON.stringify(geojson), {
      headers: {
        'content-type': 'application/geo+json; charset=utf-8',
        'content-disposition': `attachment; filename="drogi-wyszkow-${stempel}.geojson"`,
      },
    });
  }

  const kolumny: (keyof Wiersz)[] = [
    'simc', 'sym_ul', 'miejscowosc', 'nazwa_pelna', 'dlugosc_m', 'kategoria',
    'nr_drogi', 'klasa', 'nawierzchnia', 'odcinek_dlugosc_m', 'zarzadca',
    'utrzymujacy', 'podstawa_prawna', 'zrodlo', 'zrodlo_nazwa',
    'zrodlo_url', 'pewnosc',
  ];
  const csv = [
    kolumny.join(','),
    ...wiersze.map((w) => kolumny.map((k) => csvPole(w[k])).join(',')),
  ].join('\n');

  // BOM, żeby Excel nie rozjechał polskich znaków
  return new Response('﻿' + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="drogi-wyszkow-${stempel}.csv"`,
    },
  });
}
