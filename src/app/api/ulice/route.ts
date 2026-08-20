import { NextResponse } from 'next/server';
import { policzUlice, ulice } from '@/lib/zapytania';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filtry = {
    q: sp.get('q') ?? undefined,
    kategoria: sp.get('kategoria') ?? undefined,
    miejscowosc: sp.get('miejscowosc') ?? undefined,
    zarzadca: sp.get('zarzadca') ?? undefined,
    limit: Number(sp.get('limit') ?? 200),
    offset: Number(sp.get('offset') ?? 0),
  };
  const [dane, ile] = await Promise.all([ulice(filtry), policzUlice(filtry)]);
  return NextResponse.json({ ile, zwrocono: dane.length, ulice: dane });
}
