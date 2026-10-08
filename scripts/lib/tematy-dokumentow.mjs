export const normalizujTemat = s => String(s).toLocaleLowerCase('pl').normalize('NFD')
  .replace(/\p{M}/gu,'').replaceAll('ł','l');

// Całe wyrazy: „plac” i „placu”, ale nie „placówka”; „drogi”, ale nie
// samo „w drodze” opisujące tryb wydania decyzji lub przyznania dotacji.
const OBIEKT = /\b(?:drog(?:a|i|e|om|ach|ami)?|drogow[a-z]*|ulic[a-z]*|rond(?:o|a|u|em|om|ach|ami)?|skwer(?:u|y|ow|owi|om|em|ach|ami)?|plac(?:u|e|y|ow|owi|om|em|ach|ami)?)\b|\bdrodze\s+(?:wewnetrzn|gminn|powiatow|wojewodzk|krajow)[a-z]*/i;

export function pasujeTematDokumentu(tytul, temat='drogi') {
  const tekst=normalizujTemat(tytul);
  if(!OBIEKT.test(tekst))return false;
  if(temat==='drogi')return true;
  if(temat==='kategoria')return /\bkategor(?:ia|ii|ie|i|iom|iach)\b/.test(tekst);
  if(temat==='przebieg')return /\bprzebieg[a-z]*\b/.test(tekst);
  if(temat==='nazwy')return /\bnazw(?:a|y|e|om|ami|ach)?\b/.test(tekst);
  return false;
}

// Wspólna postać dla starszych importerów korzystających z .test().
export const TEMAT_DROGOWY = { test: tytul => pasujeTematDokumentu(tytul) };
