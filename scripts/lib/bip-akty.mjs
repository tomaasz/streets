/** Parser archiwum BIP Wyszkowa wspólny dla importera i wyszukiwania w aplikacji. */
const BAZA = 'https://bip.wyszkow.pl/';
const TEMAT = /(drog|dróg|ulic|rond|skwer|plac\b|kategori)/i;
const MIESIACE = { stycznia:1,lutego:2,marca:3,kwietnia:4,maja:5,czerwca:6,lipca:7,sierpnia:8,września:9,wrzesnia:9,października:10,pazdziernika:10,listopada:11,grudnia:12 };

const bezZnacznikow = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Treść merytoryczna strony BIP siedzi w kolumnie col-md-8. */
const trescStrony = (html) => {
  const i = html.indexOf('col-md-8');
  return i < 0 ? html : html.slice(i);
};

/** Nagłówek strony sesji: „Uchwały ... podjęte w dn. 16 lutego 2006 r. nr 1-15.” */
function dataSesji(tekst) {
  const m = /podjęte\s+w\s+dn\.?[a-z]*\s+([^.]{5,40}?)\s*r\./i.exec(tekst);
  return m ? dataZTekstu(m[1]) : null;
}

function dataZTekstu(txt) {
  const m = /(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(\d{4})/i.exec(txt);
  if (!m) return null;
  const mies = MIESIACE[m[2].toLowerCase()];
  if (!mies) return null;
  return `${m[3]}-${String(mies).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

// Ogon strony i załączniki doklejają się do tytułu — ucinamy je.
const KONIEC_TYTULU =
  /\s*(Załącznik|Załaczniki|Informacje o stronie|Metryka strony|Wytworzył|Wprowadził|Data wytworzenia|Opublikował|Uchwała\s+nr|Zarządzenie\s+nr|Rejestr zmian)\b[\s\S]*$/i;

function aktyZeStrony(html, zrodloUrl) {
  const seg = trescStrony(html);
  // Współczesny BIP publikuje akt na osobnej stronie. Tytuł może przywoływać
  // starsze zarządzenie; nie wolno odczytać jego daty jako daty nowego aktu.
  const naglowek = /<h2[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i.exec(seg);
  const pojedynczy = /^(Uchwała|Zarządzenie)\s+nr\s+((?:[IVXLCDM]+\/)?\d+\/\d{2,4})\s+([\s\S]+)/i.exec(bezZnacznikow(naglowek?.[1] ?? ''));
  if (pojedynczy) {
    const [,rodzaj,numer,tytul] = pojedynczy;
    if (!TEMAT.test(tytul)) return [];
    const pliki = [...seg.matchAll(/<a[^>]+href="([^"]+\.(?:pdf|doc|docx)(?:\?[^"]*)?)"[^>]*class="[^"]*file-link[^"]*"/gi)]
      .map(m => new URL(m[1].replace(/&amp;/g,'&'),BAZA).href);
    const plikGlowny = pliki.find(url => decodeURIComponent(url).toLowerCase().includes(numer.replaceAll('/','_').toLowerCase())) ?? (pliki.length === 1 ? pliki[0] : null);
    return [{organ:rodzaj.toLowerCase()==='zarządzenie'?'Burmistrz Wyszkowa':'Rada Miejska w Wyszkowie',
      rodzaj:rodzaj.toLowerCase(),numer,rok:Number(numer.split('/').pop().padStart(4,'20')),
      data_podjecia:/^zmienia|^w\s+sprawie|^w\s+sp\./i.test(tytul)?null:dataZTekstu(tytul.split(/w\s+sprawie|w\s+sp\./i)[0]),
      tytul,url_pdf:plikGlowny,url_zrodla:zrodloUrl,zalaczniki:plikGlowny?pliki.filter(url=>url!==plikGlowny):[]}];
  }
  const dataNaglowka = dataSesji(bezZnacznikow(seg).slice(0, 400));

  // odnośniki do plików, indeksowane numerem uchwały z treści odnośnika
  const pliki = new Map();
  for (const m of seg.matchAll(
    /<a[^>]+href="([^"]+\.(?:pdf|doc|docx))"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const nr = /nr\s+((?:[IVXLCDM]+\/)?\d+\/\d{2,4})/i.exec(bezZnacznikow(m[2]));
    if (nr && !pliki.has(nr[1])) {
      pliki.set(nr[1], new URL(m[1].replace(/&amp;/g, '&'), BAZA).href);
    }
  }

  const tekst = bezZnacznikow(seg);
  const akty = [];
  // Zapisy w BIP nie są jednolite: raz „z dn.”, raz „z dnia”, raz bez organu.
  // Wiążemy więc tylko numer uchwały z formułą „w sprawie”, a co pomiędzy —
  // przeszukujemy osobno w poszukiwaniu daty.
  // Rada podejmuje uchwały (numer rzymski/arabski/rok), Burmistrz wydaje
  // zarządzenia (numer arabski/rok). Oba bywają na tych samych stronach.
  const wzor =
    /(Uchwał[ay]|Zarządzeni[ae])\s+nr\s+((?:[IVXLCDM]+\/)?\d+\/\d{2,4})([\s\S]{0,200}?)w\s+sprawie\s+([\s\S]{5,600}?)(?=\s*(?:Uchwał[ay]\s+nr|Zarządzeni[ae]\s+nr|$))/gi;

  for (const m of tekst.matchAll(wzor)) {
    const zarzadzenie = /^Zarz/i.test(m[1]);
    const tytul = m[4].replace(KONIEC_TYTULU, '').replace(/\s*\.\s*$/, '').trim();
    if (!tytul || !TEMAT.test(tytul)) continue;
    akty.push({
      organ: zarzadzenie ? 'Burmistrz Wyszkowa' : 'Rada Miejska w Wyszkowie',
      rodzaj: zarzadzenie ? 'zarządzenie' : 'uchwała',
      numer: m[2],
      rok: Number(m[2].split('/').pop().padStart(4, '20').slice(-4)),
      data_podjecia: /zmienia|uchwał|zarządzeni/i.test(m[3]) ? null : dataZTekstu(m[3]) ?? dataNaglowka,
      tytul: `w sprawie ${tytul}`,
      url_pdf: pliki.get(m[2]) ?? null,
      url_zrodla: zrodloUrl,
    });
  }
  return akty;
}

/** Wszystkie odnośniki do podstron BIP z treści danej strony. */
function podstrony(html) {
  const seg = trescStrony(html);
  const out = new Map();
  for (const m of seg.matchAll(
    /<a[^>]+href="([^"]*cmd=zawartosc[^"]*id=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  )) {
    out.set(m[2], { url: m[1].replace(/&amp;/g, '&'), tytul: bezZnacznikow(m[3]) });
  }
  return out;
}

/**
 * Czy warto wejść głębiej. Archiwum ma kilka pięter i różne układy zależnie
 * od kadencji: kadencja → rocznik → miesiąc albo kadencja → rocznik → sesja.
 */
const WARTO_WEJSC =
  /^(sesje|uchwał|kadencja|\d{4}$|[IVXLCDM]+\s+sesja|sesja\b|stycz|lut|marz|kwie|maj|czerw|lip|sierp|wrze|paździer|pazdzier|listopad|grudz)/i;


export { aktyZeStrony, podstrony, trescStrony, bezZnacznikow, WARTO_WEJSC };
