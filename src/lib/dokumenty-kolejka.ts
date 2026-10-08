import { createHash } from 'node:crypto';
import { pula, zapytaj } from './db';
import { pobierzDokument } from './dokumenty-internet';
import type { DokumentWKolejce, DokumentZnaleziony } from './dokumenty-typy';

export async function kolejkaDokumentow() {
  return zapytaj<DokumentWKolejce>(`SELECT d.id,d.status,d.blad,
    to_char(d.dolaczono AT TIME ZONE 'Europe/Warsaw','YYYY-MM-DD HH24:MI') dolaczono,d.metadane,
    COALESCE((SELECT json_agg(json_build_object('id',p.id,'rola',p.rola,'typ',p.typ,'url',p.url,
      'bajtow',octet_length(p.tresc)) ORDER BY p.id) FROM plik_dokumentu p WHERE p.dokument_id=d.id),'[]'::json) pliki
    FROM dokument_do_przetworzenia d ORDER BY d.dolaczono DESC,d.id DESC LIMIT 100`);
}

export async function zapiszDokumentWKolejce(a:DokumentZnaleziony,gmina:string,signal:AbortSignal) {
  const pliki:{url:string;rola:string;typ:string;tresc:Buffer;sha256:string}[]=[];
  const bledy:string[]=[];
  const adresy:[string,string|null][]=[['publikacja',a.url],['dokument',a.url_pdf],
    ...(a.url_metadanych?[['metadane',a.url_metadanych] as [string,string]]:[]),
    ...[...new Set(a.zalaczniki ?? [])].filter(u=>u!==a.url_pdf).map(u=>['dokument',u] as [string,string])];
  if(adresy.length>10)throw new Error('Dokument ma zbyt wiele załączników do pobrania naraz.');
  for(const [rola,url] of adresy) {
    if(!url)continue;
    try {
      const p=await pobierzDokument(url,signal,rola==='publikacja'?2*1024*1024:15*1024*1024);
      const pdf=p.tresc.subarray(0,5).toString()==='%PDF-';
      const zip=p.tresc[0]===0x50 && p.tresc[1]===0x4b;
      const doc=p.tresc.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
      if(rola==='dokument' && !pdf && !doc && !(zip && /\.docx(?:\?|$)/i.test(url)))
        throw new Error('Odnośnik nie zwrócił pliku PDF, DOC lub DOCX.');
      if(rola==='publikacja' && p.typ!=='text/html' && p.typ!=='application/xhtml+xml')
        throw new Error('Nie rozpoznano strony publikacji.');
      if(rola==='metadane')JSON.parse(p.tresc.toString('utf8'));
      pliki.push({...p,rola,typ:pdf?'application/pdf':p.typ,sha256:createHash('sha256').update(p.tresc).digest('hex')});
    }catch(e) {
      bledy.push(`${rola==='metadane'?'Metadane źródłowe':rola==='dokument'?'Plik dokumentu':'Strona publikacji'}: ${e instanceof Error && /HTTP|limit|Adres|plik|publikacji/.test(e.message)?e.message:'Źródło nie odpowiedziało w terminie lub zwróciło nierozpoznaną odpowiedź.'}`);
    }
  }
  const status=bledy.length?'blad_pobrania':!a.url_pdf?'brak_pliku':'do_przetworzenia';
  const klient=await pula().connect();
  try {
    await klient.query('BEGIN');
    const {rows}=await klient.query<{id:number}>(`INSERT INTO dokument_do_przetworzenia
      (gmina,rodzaj,organ,numer,metadane,status,blad) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(gmina,rodzaj,organ,numer) DO UPDATE SET
        metadane=EXCLUDED.metadane,status=EXCLUDED.status,blad=EXCLUDED.blad,dolaczono=now()
      WHERE dokument_do_przetworzenia.status IN ('blad_pobrania','brak_pliku') RETURNING id`,
      [gmina,a.rodzaj,a.organ,a.numer,JSON.stringify(a),status,bledy.join(' ') || null]);
    if(!rows.length) {await klient.query('COMMIT');return 'juz_dolaczony';}
    for(const p of pliki)await klient.query(`INSERT INTO plik_dokumentu(dokument_id,url,rola,typ,sha256,tresc)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dokument_id,url) DO UPDATE SET
      typ=EXCLUDED.typ,sha256=EXCLUDED.sha256,tresc=EXCLUDED.tresc,pobrano=now()`,
      [rows[0].id,p.url,p.rola,p.typ,p.sha256,p.tresc]);
    await klient.query('COMMIT');return status;
  }catch(e){await klient.query('ROLLBACK');throw e;}finally{klient.release();}
}
