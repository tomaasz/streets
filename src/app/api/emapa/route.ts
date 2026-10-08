import {NextResponse} from 'next/server';
import {sprawdzEmape} from '@/lib/emapa';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
 const sp=new URL(req.url).searchParams,slug=sp.get('slug')??undefined;
 const x=Number(sp.get('x')??NaN),y=Number(sp.get('y')??NaN);
 if((slug&&slug.length>160)||(!slug&&(!Number.isFinite(x)||!Number.isFinite(y)||x<657700||x>676700||y<519800||y>535700)))return NextResponse.json({error:'Wskaż ulicę lub punkt na terenie gminy Wyszków.'},{status:400});
 return NextResponse.json(await sprawdzEmape(x,y,slug),{headers:{'Cache-Control':'no-store'}});
}
