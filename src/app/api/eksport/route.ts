import { zapytaj } from '@/lib/db';
import { warunkiDrog } from '@/lib/warunki-drog';

export const dynamic = 'force-dynamic';

type Wiersz = {
  simc: string | null; sym_ul: string | null; miejscowosc: string | null; nazwa_pelna: string;
  dlugosc_m: number | null; kategoria: string | null; nr_drogi: string | null;
  klasa: string | null; nawierzchnia: string | null; zarzadca: string | null;
  utrzymujacy: string | null; podstawa_prawna: string | null;
  zrodlo: string | null; zrodlo_nazwa: string | null;
  zrodlo_url: string | null; pewnosc: number | null;
  odcinek_dlugosc_m: number | null; opis_odcinka: string | null; geom: unknown;
};


const csvPole = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const format = sp.get('format') === 'geojson' ? 'geojson' : 'csv';
  const { sql, par } = warunkiDrog(sp);

  // Identyfikatory na końcu ORDER BY domykają kolejność. Kilkanaście grup ma
  // remis na (miejscowość, nazwa, kategoria) i bez nich wracałyby w dowolnej
  // kolejności — a wtedy cotygodniowe odświeżenie danych produkuje w eksporcie
  // różnice tam, gdzie nic się nie zmieniło.
  const wiersze = await zapytaj<Wiersz>(
    `SELECT u.simc, u.sym_ul, u.miejscowosc,
            COALESCE(u.nazwa_pelna, CASE WHEN o.kategoria = 'gminna'
              THEN 'Droga gminna bez nazwy' ELSE 'Droga bez nazwy' END) AS nazwa_pelna,
            u.dlugosc_m,
            o.kategoria::text AS kategoria, o.nr_drogi, o.klasa, o.nawierzchnia,
            o.dlugosc_m AS odcinek_dlugosc_m, o.opis_odcinka,
            o.podstawa_prawna, o.zrodlo, o.pewnosc,
            z.nazwa AS zarzadca, w.nazwa AS utrzymujacy,
            zr.nazwa AS zrodlo_nazwa, zr.url AS zrodlo_url,
            COALESCE(o.geom, u.geom) AS geom
       FROM ulica u
       FULL OUTER JOIN odcinek_drogi o ON o.ulica_id = u.id
       LEFT JOIN zarzadca z      ON z.id = o.zarzadca_id
       LEFT JOIN zarzadca w      ON w.id = o.utrzymujacy_id
       LEFT JOIN zrodlo_danych zr ON zr.kod = o.zrodlo
       ${sql}
      ORDER BY u.miejscowosc NULLS LAST, u.nazwa NULLS LAST, o.kategoria, o.id, u.id`,
    par
  );

  const stempel = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());

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
    'nr_drogi', 'klasa', 'nawierzchnia', 'odcinek_dlugosc_m', 'opis_odcinka', 'zarzadca',
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
