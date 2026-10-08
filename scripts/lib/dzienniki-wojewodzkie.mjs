/** Oficjalne serwisy dzienników, przypisane do kodów województw TERYT. */
export const DZIENNIKI_WOJEWODZKIE = [
  ['02','dolnośląskie','Dolnośląskiego','edzienniki.duw.pl'],
  ['04','kujawsko-pomorskie','Kujawsko-Pomorskiego','edzienniki.bydgoszcz.uw.gov.pl'],
  ['06','lubelskie','Lubelskiego','edziennik.lublin.uw.gov.pl'],
  ['08','lubuskie','Lubuskiego','dzienniki.luw.pl'],
  ['10','łódzkie','Łódzkiego','dziennik.lodzkie.eu'],
  ['12','małopolskie','Małopolskiego','edziennik.malopolska.uw.gov.pl'],
  ['14','mazowieckie','Mazowieckiego','edziennik.mazowieckie.pl'],
  ['16','opolskie','Opolskiego','duwo.opole.uw.gov.pl'],
  ['18','podkarpackie','Podkarpackiego','edziennik.rzeszow.uw.gov.pl'],
  ['20','podlaskie','Podlaskiego','edziennik.bialystok.uw.gov.pl'],
  ['22','pomorskie','Pomorskiego','edziennik.gdansk.uw.gov.pl'],
  ['24','śląskie','Śląskiego','dzienniki.slask.eu'],
  ['26','świętokrzyskie','Świętokrzyskiego','edziennik.kielce.uw.gov.pl'],
  ['28','warmińsko-mazurskie','Warmińsko-Mazurskiego','edzienniki.olsztyn.uw.gov.pl'],
  ['30','wielkopolskie','Wielkopolskiego','edziennik.poznan.uw.gov.pl'],
  ['32','zachodniopomorskie','Zachodniopomorskiego','e-dziennik.szczecin.uw.gov.pl'],
].map(([kod,nazwa,odmiana,host])=>({kod,nazwa,host,baza:`https://${host}`,tytul:`Dziennik Urzędowy Województwa ${odmiana}`}));

const normalizuj=s=>String(s ?? '').toLocaleLowerCase('pl').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ł','l').replace(/\s*[-–]\s*/g,'-').replace(/\s+/g,' ').trim();
const nazwaGminy=s=>normalizuj(s).replace(/\s*\([^)]*\)$/,'');
const samorzad=/^(?:rada\s+(?:gminy|miasta|miejska|miejskiej)|wojt\b|burmistrz\b|prezydent\s+miasta\b)/;
const miejsceOrganu=tekst=>tekst.replace(/^(?:rada\s+(?:miasta\s+i\s+gminy|gminy\s+i\s+miasta|gminy|miasta|miejska|miejskiej)|wojt(?:\s+gminy)?|burmistrz(?:\s+(?:miasta\s+i\s+gminy|gminy\s+i\s+miasta|miasta|gminy))?|prezydent\s+miasta)\s+(?:uzdrowiskowej\s+)?(?:(?:w|we)\s+)?/,'');
function taSamaNazwaOdmieniona(a,b) {
  const slowa=a.split(/[ -]/).map(s=>s.replace(/iec$/,'c')),inne=b.split(/[ -]/);
  if(slowa.length!==inne.length)return false;
  return slowa.every((s,i)=>{
    const t=inne[i];let wspolne=0;
    while(wspolne<Math.min(s.length,t.length) && s[wspolne]===t[wspolne])wspolne++;
    return wspolne>=Math.min(s.length,Math.max(3,s.length-2));
  });
}

/** Metadane wydawców nie mają TERYT. Przy niejednoznaczności nie zgadujemy powiatu. */
export function wydawcyGminy(lista,gmina,gminy) {
  if(!Array.isArray(lista))throw new Error('Nie rozpoznano listy wydawców dziennika.');
  const nazwa=nazwaGminy(gmina.nazwa);
  const jednakowe=gminy.filter(g=>g.woj===gmina.woj && nazwaGminy(g.nazwa)===nazwa && g.rodzaj===gmina.rodzaj);
  if(jednakowe.length>1)throw new Error('Dziennik nie podaje kodów TERYT wydawców. Gminy o tej nazwie i rodzaju występują w kilku powiatach; nie można jednoznacznie przypisać organów. Sprawdź rejestr źródłowy.');
  const maBlizniaka=gminy.some(g=>g.woj===gmina.woj && g.kod!==gmina.kod && nazwaGminy(g.nazwa)===nazwa);
  const zawiera=(tekst,slowo)=>` ${tekst} `.includes(` ${slowo} `);
  return lista.filter(p=>{
    if(!Number.isSafeInteger(p.Oid) || p.Oid<=0 || typeof p.Name!=='string')return false;
    const organ=normalizuj(p.Name);const miasto=normalizuj(p.City);
    if(gmina.kod==='143505')return /wyszk/.test(organ);
    if(!samorzad.test(organ))return false;
    const nazwaWOrganie=zawiera(organ,nazwa);
    const miejsce=miejsceOrganu(organ);
    // Sama siedziba nie wystarcza: bywa błędna lub wskazuje urząd wojewódzki.
    // Nazwa organu musi również wskazywać tę gminę (z odmianą nazwy).
    if(!taSamaNazwaOdmieniona(nazwa,miejsce))return false;
    if(miasto!==nazwa && !nazwaWOrganie) {
      // Gdy siedziba jest błędna, pełna nazwa organu musi wskazywać tylko jedną nazwę gminy.
      const mozliwe=new Set(gminy.filter(g=>g.woj===gmina.woj && taSamaNazwaOdmieniona(nazwaGminy(g.nazwa),miejsce)).map(g=>nazwaGminy(g.nazwa)));
      if(mozliwe.size!==1 || !mozliwe.has(nazwa))return false;
    }
    if(maBlizniaka) {
      const wiejski=/^wojt\b|^rada\s+gminy\b/.test(organ) && !/miasta/.test(organ);
      if(gmina.rodzaj==='gmina wiejska')return wiejski;
      return !wiejski;
    }
    return true;
  }).map(p=>({id:p.Oid,nazwa:p.Name.trim()}));
}
