const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
export function odczytajEmape(xml) {
 if(typeof xml!=='string' || xml.length>500000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/^\s*<GetFeatureInfo>[\s\S]*<\/GetFeatureInfo>\s*$/.test(xml)) throw new Error('Niepoprawna odpowiedź e-mapy');
 const wyniki=[];
 for(const match of xml.matchAll(/<Ulica>([\s\S]*?)<\/Ulica>/g)) {
  const field=name=>decode(match[1].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([^<]*)</'+name+'>'))?.[1] ?? '').trim();
  const simc=field('SIMC'),ulic=field('ULIC'),nazwa=field('Nazwa'),miejscowosc=field('Miejscowosc');
  if(!/^\d{7}$/.test(simc)||!/^\d{5}$/.test(ulic)||!nazwa||!miejscowosc||field('Zrodlo_danych')!=='wyszkow.e-mapa.net') continue;
  if(wyniki.some(w=>w.simc===simc&&w.ulic===ulic)) continue;
  wyniki.push({simc,ulic,nazwa,miejscowosc,cecha:field('Cecha'),numer_drogi:field('Numer_drogi'),uchwala:field('Uchwala'),opis:field('Opis')});
 }
 return wyniki;
}
