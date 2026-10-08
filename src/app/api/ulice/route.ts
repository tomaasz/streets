import {szukajUug,zapytanieUug} from '@/lib/uug';
import {szukajOsm} from '@/lib/osm';
import {nazwyDodatkowe} from '@/lib/nazwy-dodatkowe';
import { NextResponse } from 'next/server';
import { policzUlice, ulice } from '@/lib/zapytania';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filtry = {
    sort:sp.get('sort') ?? undefined,
    kierunek:sp.get('kierunek') ?? undefined,
    q: sp.get('q') ?? undefined,
    kategoria: sp.get('kategoria') ?? undefined,
    miejscowosc: sp.get('miejscowosc') ?? undefined,
    zarzadca: sp.get('zarzadca') ?? undefined,
    slug: sp.get('slug') ?? undefined,
    limit: Number(sp.get('limit') ?? 200),
    offset: Number(sp.get('offset') ?? 0),
  };
  const [dane, ile] = await Promise.all([ulice(filtry), policzUlice(filtry)]);
  const dodatkowe=!filtry.slug ? nazwyDodatkowe(filtry.q,filtry.miejscowosc,filtry.kategoria,filtry.zarzadca) : [];
  const uug=ile===0 && !filtry.slug && !dodatkowe.length && zapytanieUug(filtry.q,filtry.miejscowosc,filtry.kategoria,filtry.zarzadca) ? await szukajUug(filtry.q!,filtry.miejscowosc!) : undefined;
  const osm=uug && (uug.status==='brak' || uug.status==='niedostepne') ? await szukajOsm(filtry.q!,filtry.miejscowosc!) : undefined;
  return NextResponse.json({ uug, osm, dodatkowe, ile, zwrocono: dane.length, ulice: dane });
}
