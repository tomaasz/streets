import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DOZWOLONE_KATEGORIE,
  DOMYSLNE_GRANICE_WGS84,
  walidujMultiLineString,
  walidujOdcinek,
  walidujPlikOdcinki,
  walidujPlikPrgUlice,
  walidujPlikBdotDrogi,
  walidujPlikAktyBip,
} from '../scripts/lib/data-validator.mjs';

const ODCINKI_URL = new URL('../data/odcinki.json', import.meta.url);
const PRG_URL = new URL('../data/raw/prg-ulice.json', import.meta.url);
const BDOT_URL = new URL('../data/raw/bdot-drogi.json', import.meta.url);
const BIP_URL = new URL('../data/raw/akty-bip.json', import.meta.url);

describe('Walidacja schematu data/odcinki.json', () => {
  it('wczytuje i parsuje poprawnie plik data/odcinki.json', async () => {
    const content = await readFile(ODCINKI_URL, 'utf8');
    const data = JSON.parse(content);
    assert.ok(data, 'Dane nie powinny być puste');
    assert.ok(Array.isArray(data.odcinki), 'Pole odcinki musi być tablicą');
    assert.ok(data.odcinki.length > 0, 'Tablica odcinki nie może być pusta');
  });

  it('posiada poprawną strukturę metadanych nagłówka', async () => {
    const data = JSON.parse(await readFile(ODCINKI_URL, 'utf8'));
    assert.match(data.zbudowano, /^\d{4}-\d{2}-\d{2}$/, 'Pole zbudowano musi być datą ISO');
    assert.equal(typeof data.tolerancja_m, 'number', 'Tolerancja musi być liczbą');
    assert.ok(data.tolerancja_m > 0, 'Tolerancja musi być dodatnia');
    assert.ok(data.zrodla?.prg, 'Musi być zdefiniowane źródło PRG');
    assert.ok(data.zrodla?.bdot, 'Musi być zdefiniowane źródło BDOT');
  });

  it('posiada spójne statystyki zagregowane', async () => {
    const data = JSON.parse(await readFile(ODCINKI_URL, 'utf8'));
    const { statystyki, odcinki } = data;
    assert.ok(statystyki, 'Brak sekcji statystyki');
    assert.equal(odcinki.length, statystyki.odcinkow, 'Liczba odcinków w tablicy musi odpowiadać statystykom');

    const bezUlicy = odcinki.filter((o) => o.ulica === null).length;
    assert.equal(bezUlicy, statystyki.odcinkow_bez_ulicy, 'Liczba odcinków bez ulicy musi się zgadzać');

    assert.ok(statystyki.ulic_prg > 0, 'Liczba ulic PRG musi być dodatnia');
    assert.ok(statystyki.ulic_z_kategoria > 0, 'Liczba ulic z kategorią musi być dodatnia');
    assert.ok(statystyki.ulic_z_kategoria <= statystyki.ulic_prg, 'Ulice z kategorią nie mogą przekraczać sumy ulic');
  });

  it('wszystkie odcinki posiadają dozwoloną kategorię zarządzania BDOT10k', async () => {
    const data = JSON.parse(await readFile(ODCINKI_URL, 'utf8'));
    for (const [idx, o] of data.odcinki.entries()) {
      assert.ok(
        DOZWOLONE_KATEGORIE.has(o.kategoria_bdot),
        `Odcinek #${idx} ma niedozwoloną kategorię: ${o.kategoria_bdot}`
      );
    }
  });

  it('wszystkie odcinki powiązane z ulicą posiadają poprawne kody TERYT SIMC i SYM_UL', async () => {
    const data = JSON.parse(await readFile(ODCINKI_URL, 'utf8'));
    for (const [idx, o] of data.odcinki.entries()) {
      if (o.ulica !== null) {
        assert.match(o.ulica.simc, /^\d{7}$/, `Odcinek #${idx}: SIMC musi mieć 7 cyfr`);
        assert.match(o.ulica.sym_ul, /^\d{5}$/, `Odcinek #${idx}: SYM_UL musi mieć 5 cyfr`);
        assert.ok(o.ulica.nazwa?.trim(), `Odcinek #${idx}: nazwa ulicy nie może być pusta`);
        assert.ok(o.ulica.miejscowosc?.trim(), `Odcinek #${idx}: miejscowość nie może być pusta`);
      }
    }
  });

  it('wszystkie geometrie są poprawnym GeoJSON MultiLineString z koordynatami w granicach gminy', async () => {
    const data = JSON.parse(await readFile(ODCINKI_URL, 'utf8'));
    for (const [idx, o] of data.odcinki.entries()) {
      const wynikGeom = walidujMultiLineString(o.geom, DOMYSLNE_GRANICE_WGS84);
      assert.ok(
        wynikGeom.poprawny,
        `Odcinek #${idx} ma błędną geometrię: ${wynikGeom.bledy.join('; ')}`
      );
    }
  });

  it('kompleksowa walidacja walidujPlikOdcinki zwraca wynik poprawny bez błędów', async () => {
    const data = JSON.parse(await readFile(ODCINKI_URL, 'utf8'));
    const wynik = walidujPlikOdcinki(data);
    assert.equal(wynik.poprawny, true, `Błędy walidacji: ${wynik.bledy.join('; ')}`);
    assert.equal(wynik.bledy.length, 0);
  });
});

describe('Walidacja plików źródłowych w data/raw/', () => {
  it('data/raw/prg-ulice.json jest zgodny ze schematem PRG', async () => {
    const data = JSON.parse(await readFile(PRG_URL, 'utf8'));
    const wynik = walidujPlikPrgUlice(data);
    assert.equal(wynik.poprawny, true, `Błędy PRG: ${wynik.bledy.join('; ')}`);
    assert.ok(wynik.liczbaUlic > 0);
  });

  it('data/raw/bdot-drogi.json jest zgodny ze schematem BDOT10k', async () => {
    const data = JSON.parse(await readFile(BDOT_URL, 'utf8'));
    const wynik = walidujPlikBdotDrogi(data);
    assert.equal(wynik.poprawny, true, `Błędy BDOT: ${wynik.bledy.join('; ')}`);
    assert.ok(wynik.liczbaDrog > 0);
  });

  it('data/raw/akty-bip.json jest zgodny ze schematem BIP', async () => {
    const data = JSON.parse(await readFile(BIP_URL, 'utf8'));
    const wynik = walidujPlikAktyBip(data);
    assert.equal(wynik.poprawny, true, `Błędy BIP: ${wynik.bledy.join('; ')}`);
    assert.ok(wynik.liczbaAktow > 0);
  });
});

describe('Przypadki negatywne i testy jednostkowe walidatora', () => {
  it('odrzuca obiekt geometrii o błędnym typie', () => {
    const res = walidujMultiLineString({ type: 'LineString', coordinates: [] });
    assert.equal(res.poprawny, false);
    assert.ok(res.bledy.some((b) => b.includes('Niepoprawny typ geometrii')));
  });

  it('odrzuca geometrię bez punktów lub z linią o mniej niż 2 punktach', () => {
    const res = walidujMultiLineString({
      type: 'MultiLineString',
      coordinates: [[[21.4, 52.5]]],
    });
    assert.equal(res.poprawny, false);
    assert.ok(res.bledy.some((b) => b.includes('mniej niż 2 punkty')));
  });

  it('odrzuca współrzędne spoza dozwolonego obszaru gminy', () => {
    const res = walidujMultiLineString({
      type: 'MultiLineString',
      coordinates: [[[10.0, 50.0], [10.1, 50.1]]],
    });
    assert.equal(res.poprawny, false);
    assert.ok(res.bledy.some((b) => b.includes('poza zakresem')));
  });

  it('odrzuca odcinek z niedozwoloną kategorią BDOT', () => {
    const odcinek = {
      kategoria_bdot: 'autostrada_prywatna',
      dlugosc_m: 100,
      odcinkow_bdot: 1,
      ulica: null,
      numer: null,
      geom: {
        type: 'MultiLineString',
        coordinates: [[[21.45, 52.59], [21.46, 52.59]]],
      },
    };
    const res = walidujOdcinek(odcinek, 0);
    assert.equal(res.poprawny, false);
    assert.ok(res.bledy.some((b) => b.includes('nieprawidłowa kategoria_bdot')));
  });

  it('odrzuca odcinek z błędnym kodem SIMC lub SYM_UL', () => {
    const odcinek = {
      kategoria_bdot: 'gminna',
      dlugosc_m: 100,
      odcinkow_bdot: 1,
      ulica: {
        simc: '123', // zbyt krótki SIMC
        sym_ul: 'abc', // nieliczbowy SYM_UL
        nazwa: 'Testowa',
        miejscowosc: 'Wyszków',
      },
      numer: null,
      geom: {
        type: 'MultiLineString',
        coordinates: [[[21.45, 52.59], [21.46, 52.59]]],
      },
    };
    const res = walidujOdcinek(odcinek, 0);
    assert.equal(res.poprawny, false);
    assert.ok(res.bledy.some((b) => b.includes('kod SIMC')));
    assert.ok(res.bledy.some((b) => b.includes('kod SYM_UL')));
  });

  it('odrzuca plik przy niezgodności liczby odcinków ze statystykami', () => {
    const mockDane = {
      zbudowano: '2026-10-07',
      tolerancja_m: 25,
      zrodla: { prg: '2026-10-05', bdot: '2026-04-15' },
      statystyki: {
        ulic_prg: 10,
        ulic_z_kategoria: 10,
        odcinkow: 999, // deklaracja 999, a tablica ma 1
        odcinkow_bez_ulicy: 1,
      },
      odcinki: [
        {
          kategoria_bdot: 'gminna',
          dlugosc_m: 50,
          odcinkow_bdot: 1,
          ulica: null,
          numer: null,
          geom: {
            type: 'MultiLineString',
            coordinates: [[[21.45, 52.59], [21.46, 52.59]]],
          },
        },
      ],
    };
    const res = walidujPlikOdcinki(mockDane);
    assert.equal(res.poprawny, false);
    assert.ok(res.bledy.some((b) => b.includes('Niezgodność liczby odcinków')));
  });
});
