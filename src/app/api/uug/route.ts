import {NextResponse} from 'next/server';
import {szukajUug,zapytanieUug} from '@/lib/uug';
import {szukajOsm} from '@/lib/osm';
import {nazwyDodatkowe} from '@/lib/nazwy-dodatkowe';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 const sp=new URL(req.url).searchParams;
 const q=sp.get('q') ?? '',m=sp.get('miejscowosc') ?? '';
 if(!zapytanieUug(q,m,sp.get('kategoria') ?? undefined,sp.get('zarzadca') ?? undefined)) return NextResponse.json({status:'miejscowosc',wyniki:[]});
 const uug=await szukajUug(q,m);
 const osm=!nazwyDodatkowe(q,m).length && (uug.status==='brak' || uug.status==='niedostepne') ? await szukajOsm(q,m) : undefined;
 return NextResponse.json({...uug,osm},{headers:{'Cache-Control':'no-store'}});
}
