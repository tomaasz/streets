import { zapytaj } from '@/lib/db';

export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string;plik:string}>}) {
  const {id,plik}=await params;
  if(!/^\d+$/.test(id)||!/^\d+$/.test(plik))return new Response('Nie znaleziono pliku.',{status:404});
  const [p]=await zapytaj<{tresc:Buffer;typ:string;rola:string}>(`SELECT tresc,typ,rola FROM plik_dokumentu WHERE id::text=$1 AND dokument_id::text=$2`,[plik,id]);
  if(!p)return new Response('Nie znaleziono pliku.',{status:404});
  const pdf=p.typ==='application/pdf';
  return new Response(new Uint8Array(p.tresc),{headers:{
    'Content-Type':pdf?'application/pdf':'application/octet-stream',
    'Content-Disposition':`${pdf?'inline':'attachment'}; filename="dokument-${id}-${plik}.${pdf?'pdf':p.rola==='metadane'?'json':p.rola==='publikacja'?'html':'bin'}"`,
    'Content-Security-Policy':"sandbox; default-src 'none'",
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }});
}
