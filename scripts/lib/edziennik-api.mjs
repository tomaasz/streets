import { kanonicznyOrgan } from './akty.mjs';

/** Faktyczna struktura publicznego API używanego przez stronę e-dziennika. */
export function aktyZApiWydawcy(dane, {baza='https://edziennik.mazowieckie.pl',nazwaZrodla='Dziennik Urzędowy Województwa Mazowieckiego',nazwaWydawcy='',wyszkow=true} = {}) {
  if(!dane || !Array.isArray(dane.LegalActs) || typeof dane.Publisher?.Name!=='string')
    throw new Error('Nie rozpoznano odpowiedzi API wydawcy.');
  const organZrodlowy=dane.Publisher.Name;
  if(nazwaWydawcy ? organZrodlowy.trim()!==nazwaWydawcy.trim() : !/wyszk/i.test(organZrodlowy))
    throw new Error('Wydawca nie dotyczy wybranej gminy ani powiatu.');
  const organ=wyszkow?kanonicznyOrgan(organZrodlowy):organZrodlowy.trim();
  const out=[];
  for(const a of dane.LegalActs) {
    const rodzaj=String(a.LegalActType ?? '').trim().toLocaleLowerCase('pl');
    if(!['uchwała','zarządzenie','rozporządzenie','obwieszczenie'].includes(rodzaj) ||
      typeof a.CaseNumber!=='string' || !a.CaseNumber.trim() || typeof a.Subject!=='string' ||
      !Number.isInteger(a.Year) || a.Year<2000 || a.Year>2100 ||
      !Number.isInteger(a.Position) || a.Position<=0 || !Number.isInteger(a.Oid) || a.Oid<=0)continue;
    const data=/^\d{4}-\d{2}-\d{2}/.exec(a.ActDate ?? '')?.[0] ?? null;
    const rok=data && !data.startsWith('0001')?Number(data.slice(0,4)):a.Year;
    const sciezka=Number(a.JournalNumber)>0?`${a.Year}/${a.JournalNumber}/${a.Position}`:`${a.Year}/${a.Position}`;
    const dup=a.DuplicateChar?`/duplicat/${encodeURIComponent(a.DuplicateChar)}`:'';
    const url=`${baza}/legalact/${sciezka}${dup}`;
    const pliki=[...new Set([a.PdfUrl,...(a.PdfBookUrlList ?? []).map(p=>p.Url)].filter(u=>typeof u==='string' && u))]
      .map(u=>new URL(u,`${baza}/`).href);
    out.push({organ,rodzaj,numer:a.CaseNumber.trim(),tytul:a.Subject.trim(),
      data_podjecia:data && !data.startsWith('0001')?data:null,rok,
      dziennik_rok:a.Year,dziennik_pozycja:a.Position,url,url_pdf:pliki[0] ?? null,
      zalaczniki:pliki.slice(1),url_metadanych:`${baza}/api/legalact?year=${a.Year}&journal=${Number(a.JournalNumber)||0}&position=${a.Position}${a.DuplicateChar?`&duplicateChar=${encodeURIComponent(a.DuplicateChar)}`:''}`,
      zrodlo:nazwaZrodla});
  }
  return out;
}
