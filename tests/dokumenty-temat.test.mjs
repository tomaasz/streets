import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pasujeTematDokumentu} from '../scripts/lib/tematy-dokumentow.mjs';

test('temat drogowy: odrzuca dokumenty o placówkach i trybie udzielania dotacji',()=>{
  for(const tytul of [
    'w sprawie określenia zasad udzielania obniżek nauczycieli zatrudnionych w szkołach i placówkach oświatowych',
    'w sprawie ustalenia trybu udzielania dotacji dla publicznych i niepublicznych placówek oświatowych',
    'w sprawie ustalenia średnich wydatków na utrzymanie dziecka w placówkach opiekuńczo-wychowawczych',
    'w sprawie przyznania pomocy w drodze dotacji na realizację zadań publicznych',
    'w sprawie określenia kategorii zaszeregowania pracowników placówek',
  ]) assert.equal(pasujeTematDokumentu(tytul),false,tytul);
});

test('temat drogowy: zachowuje odmiany nazw obiektów, kategorie, zarządców i modernizację',()=>{
  for(const tytul of [
    'w sprawie zaliczenia dróg do kategorii dróg gminnych',
    'w sprawie pozbawienia drogi kategorii drogi powiatowej',
    'w sprawie nadania nazwy drodze wewnętrznej położonej w miejscowości Sitno',
    'w sprawie ustalenia przebiegu ulicy',
    'w sprawie nadania nazwy rondu i placowi miejskiemu',
    'w sprawie nadania nazwy skwerowi',
    'Modernizacja ulicy Gen. Wł. Sikorskiego',
    'w sprawie ustalenia zarządcy drogi gminnej',
  ]) assert.equal(pasujeTematDokumentu(tytul),true,tytul);
});

test('filtry szczegółowe wymagają zarówno obiektu drogowego, jak i wybranego tematu',()=>{
  assert.equal(pasujeTematDokumentu('w sprawie nadania nazwy ulicy','nazwy'),true);
  assert.equal(pasujeTematDokumentu('w sprawie nadania nazwy szkole','nazwy'),false);
  assert.equal(pasujeTematDokumentu('w sprawie zaliczenia drogi do kategorii gminnej','kategoria'),true);
  assert.equal(pasujeTematDokumentu('w sprawie ustalenia kategorii placówek','kategoria'),false);
  assert.equal(pasujeTematDokumentu('w sprawie ustalenia przebiegu drogi','przebieg'),true);
  assert.equal(pasujeTematDokumentu('w sprawie przebiegu głosowania','przebieg'),false);
  assert.equal(pasujeTematDokumentu('w sprawie modernizacji ulicy','nazwy'),false);
});
