/** Parser tabel wydawców mazowieckiego dziennika urzędowego. */
import {TEMAT,data,kanonicznyOrgan,rodzajAktu,rozbijTytul,zTytulem} from './akty.mjs';
const BAZA='https://edziennik.mazowieckie.pl';

const czysty = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Tabela aktów to ta, której nagłówek ma jednocześnie „Pozycja” i „Tytuł”. */
function tabelaAktow(html) {
  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const naglowki = [...t[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
      czysty(m[1]).toLowerCase()
    );
    if (
      naglowki.some((n) => n.includes('pozycja')) &&
      naglowki.some((n) => n.includes('tytu'))
    ) {
      return { html: t[0], naglowki };
    }
  }
  return null;
}

function aktyZeStrony(html, id, baza = BAZA) {
  const tab = tabelaAktow(html);
  if (!tab) return { akty: [], wierszy: 0, naglowki: null };

  const kol = (...frazy) =>
    tab.naglowki.findIndex((n) => frazy.some((f) => n.includes(f)));
  const iPoz = kol('pozycja');
  const iAkt = kol('data aktu', 'data podj');
  const iPub = kol('data publikacji', 'data ogł', 'data ogl');
  const iTyt = kol('tytu');

  const akty = [];
  let wierszy = 0;
  for (const wm of tab.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const komorki = [...wm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (!komorki.length) continue;
    wierszy++;

    const tekstTytulu = czysty(komorki[iTyt] ?? '');
    if (!tekstTytulu || !TEMAT.test(tekstTytulu)) continue;

    const rozbite = rozbijTytul(tekstTytulu);
    if (!rozbite?.numer) continue;

    const pdf = /href="([^"]+\.pdf[^"]*)"/i.exec(wm[1])?.[1];
    const dataPubl = data(czysty(komorki[iPub] ?? ''));

    akty.push({
      organ: kanonicznyOrgan(rozbite.organ) ?? 'nieustalony',
      organ_zrodlowy: rozbite.organ,
      rodzaj: rodzajAktu(rozbite.rodzaj),
      numer: rozbite.numer,
      data_podjecia: data(czysty(komorki[iAkt] ?? '')),
      tytul: zTytulem(rozbite.tytul),
      dziennik_rok: dataPubl ? Number(dataPubl.slice(0, 4)) : null,
      dziennik_pozycja: Number(czysty(komorki[iPoz] ?? '')) || null,
      data_ogloszenia: dataPubl,
      url: `${baza}/publisher/${id}`,
      url_pdf: pdf ? new URL(pdf, baza).href : null,
    });
  }
  return { akty, wierszy, naglowki: tab.naglowki };
}


export { aktyZeStrony };
