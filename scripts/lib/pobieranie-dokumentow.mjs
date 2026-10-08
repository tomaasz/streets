/** Tylko skonfigurowane oficjalne źródła; każdy redirect sprawdzany osobno. */
/** @param {string} adres */
export function sprawdzAdresDokumentu(adres) {
  const u = new URL(adres);
  if (u.protocol !== 'https:' || u.port || u.username || u.password ||
    !['bip.wyszkow.pl','edziennik.mazowieckie.pl','wyszkow.esesja.pl'].includes(u.hostname))
    throw new Error('Adres pliku nie należy do obsługiwanego źródła urzędowego.');
  return u;
}

/** @param {string} adres @param {AbortSignal} sygnal */
export async function pobierzDokument(adres, sygnal, limit=15*1024*1024) {
  let u=sprawdzAdresDokumentu(adres);
  const signal=AbortSignal.any([sygnal,AbortSignal.timeout(8000)]);
  for(let i=0;i<5;i++) {
    const res=await fetch(u,{signal,redirect:'manual',cache:'no-store',headers:{'User-Agent':'drogi-wyszkow/1.0 (wyszukiwanie dokumentow urzedowych)'}});
    if([301,302,303,307,308].includes(res.status)) {
      const location=res.headers.get('location');
      await res.body?.cancel();
      if(!location) throw new Error('Źródło zwróciło przekierowanie bez adresu.');
      u=sprawdzAdresDokumentu(new URL(location,u).href);continue;
    }
    if(!res.ok) {await res.body?.cancel();throw new Error(`Źródło odpowiedziało HTTP ${res.status}.`);}
    if(Number(res.headers.get('content-length'))>limit) {await res.body?.cancel();throw new Error('Plik przekracza limit rozmiaru.');}
    const chunks=[];let size=0;
    if(!res.body) throw new Error('Źródło zwróciło pustą odpowiedź.');
    const reader=res.body.getReader();
    try {while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>limit)throw new Error('Plik przekracza limit rozmiaru.');chunks.push(value);
    }} finally {await reader.cancel();}
    const tresc=Buffer.concat(chunks);
    if(!tresc.length)throw new Error('Źródło zwróciło pusty plik.');
    return {tresc,typ:(res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0],url:u.href};
  }
  throw new Error('Źródło zwróciło zbyt wiele przekierowań.');
}
