import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aktyZeStrony as bip } from '../scripts/lib/bip-akty.mjs';
import { aktyZeStrony as dziennik } from '../scripts/lib/edziennik-akty.mjs';
import { aktyZApiWydawcy } from '../scripts/lib/edziennik-api.mjs';

const url='https://bip.wyszkow.pl/index.php?cmd=zawartosc&opt=pokaz&id=123';
test('BIP: dokument na osobnej stronie, plik główny, załącznik i data aktu przywołanego',()=>{
  const html=`<div class="col-md-8"><h2 class="page-title">Zarządzenie nr 20/2026 zmieniające zarządzenie nr 227/2025 z dnia 15 października 2025 roku w sprawie modernizacji ulicy</h2>
    <a href="/pliki/Zarzadzenie_20_2026.pdf" class="file-link">Pobierz</a>
    <a href="/pliki/zalacznik.pdf" class="file-link">Załącznik</a></div>`;
  const [a]=bip(html,url);
  assert.equal(a.numer,'20/2026');assert.equal(a.rok,2026);assert.equal(a.data_podjecia,null);
  assert.equal(a.url_pdf,'https://bip.wyszkow.pl/pliki/Zarzadzenie_20_2026.pdf');
  assert.deepEqual(a.zalaczniki,['https://bip.wyszkow.pl/pliki/zalacznik.pdf']);
  assert.equal(a.url_zrodla,url);
});

test('BIP: strona sesji rozpoznaje akt drogowy i pomija inne tematy',()=>{
  const html=`<div class="col-md-8">Uchwała nr VII/29/2007 Rady Miejskiej z dnia 26 kwietnia 2007 r. w sprawie nadania nazwy ulicy.
    <a href="/pliki/vii_29.pdf">Uchwała nr VII/29/2007</a>
    Uchwała nr VII/30/2007 z dnia 26 kwietnia 2007 r. w sprawie budżetu.</div>`;
  const akty=bip(html,url);assert.equal(akty.length,1);assert.equal(akty[0].numer,'VII/29/2007');
  assert.equal(akty[0].data_podjecia,'2007-04-26');assert.equal(akty[0].url_pdf,'https://bip.wyszkow.pl/pliki/vii_29.pdf');
});

test('BIP: brak pliku nie staje się odnośnikiem do przypadkowego załącznika',()=>{
  const [a]=bip(`<div class="col-md-8"><h2 class="page-title">Uchwała nr XX/100/2026 w sprawie zaliczenia drogi do kategorii gminnej</h2></div>`,url);
  assert.equal(a.url_pdf,null);assert.equal(a.data_podjecia,null);
});

test('e-dziennik: pozycja publikacji i oryginalny organ pozostają do kontroli zakresu',()=>{
  const html=`<table><tr><th>Pozycja</th><th>Data aktu</th><th>Data publikacji</th><th>Tytuł</th></tr>
    <tr><td>1234</td><td>02.02.2026</td><td>10.02.2026</td><td>Uchwała nr XX/100/2026 Rada Miejska w Wyszkowie z dnia 2 lutego 2026 r. w sprawie zaliczenia drogi do kategorii gminnej <a href="/2026/1234.pdf">PDF</a></td></tr></table>`;
  const r=dziennik(html,1453);assert.equal(r.akty.length,1);assert.equal(r.akty[0].dziennik_pozycja,1234);
  assert.equal(r.akty[0].dziennik_rok,2026);assert.equal(r.akty[0].data_podjecia,'2026-02-02');
  assert.equal(r.akty[0].organ_zrodlowy,'Rada Miejska w Wyszkowie');
  assert.equal(r.akty[0].url_pdf,'https://edziennik.mazowieckie.pl/2026/1234.pdf');
});

test('e-dziennik: zmiana struktury jest odróżniana od pustej tabeli',()=>{
  assert.equal(dziennik('<html>Blokada</html>',1453).naglowki,null);
  assert.notEqual(dziennik('<table><tr><th>Pozycja</th><th>Tytuł</th></tr></table>',1453).naglowki,null);
});

test('e-dziennik API: metadane aktu, adres PDF, zakres wydawcy i typ dokumentu',()=>{
  const akt={LegalActType:'Uchwała',CaseNumber:'XIII/100/25',Subject:'w sprawie zaliczenia dróg do kategorii dróg gminnych',
    ActDate:'2025-04-24T00:00:00',Year:2025,Position:4556,Oid:205109,JournalNumber:0,
    PdfUrl:'GetActPdf.ashx?year=2025&book=0&position=4556'};
  const dane={Publisher:{Name:'Rada Miejska w Wyszkowie'},LegalActs:[akt,{...akt,LegalActType:'Porozumienie'}]};
  const [a]=aktyZApiWydawcy(dane);assert.equal(aktyZApiWydawcy(dane).length,1);
  assert.equal(a.numer,'XIII/100/25');assert.equal(a.data_podjecia,'2025-04-24');
  assert.equal(a.url,'https://edziennik.mazowieckie.pl/legalact/2025/4556');
  assert.equal(a.url_pdf,'https://edziennik.mazowieckie.pl/GetActPdf.ashx?year=2025&book=0&position=4556');
  assert.equal(a.url_metadanych,'https://edziennik.mazowieckie.pl/api/legalact?year=2025&journal=0&position=4556');
  assert.throws(()=>aktyZApiWydawcy({...dane,Publisher:{Name:'Rada Miejska w Radomiu'}}),/Wydawca/);
  assert.throws(()=>aktyZApiWydawcy({}),/odpowiedzi API/);
});
