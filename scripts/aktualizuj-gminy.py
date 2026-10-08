#!/usr/bin/env python3
"""Odświeża katalog samodzielnych gmin z aktualnego pliku TERC GUS (stdlib)."""
import csv
import html
import io
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import zipfile

URL = ('https://eteryt.stat.gov.pl/eTeryt/rejestr_teryt/udostepnianie_danych/'
       'baza_teryt/uzytkownicy_indywidualni/pobieranie/pliki_pelne.aspx')


def aktualizuj():
    with urllib.request.urlopen(URL, timeout=30) as response:
        strona = response.read().decode('utf-8')
    pola = {n: html.unescape(v) for n, v in re.findall(
        r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', strona)}
    pola['__EVENTTARGET'] = 'ctl00$body$BTERCUrzedowyPobierz'
    pola['__EVENTARGUMENT'] = ''
    request = urllib.request.Request(URL, data=urllib.parse.urlencode(pola).encode())
    with urllib.request.urlopen(request, timeout=30) as response:
        archiwum = zipfile.ZipFile(io.BytesIO(response.read()))
    plik = next(n for n in archiwum.namelist() if re.fullmatch(r'TERC_Urzedowy_\d{4}-\d{2}-\d{2}\.csv', n))
    data = re.search(r'\d{4}-\d{2}-\d{2}', plik)[0]
    rows = list(csv.DictReader(io.StringIO(archiwum.read(plik).decode('utf-8-sig')), delimiter=';'))
    powiaty = {r['WOJ'] + r['POW']: r['NAZWA'] for r in rows if r['POW'] and not r['GMI']}
    gminy = [dict(kod=r['WOJ'] + r['POW'] + r['GMI'], nazwa=r['NAZWA'], woj=r['WOJ'],
                  powiat=powiaty[r['WOJ'] + r['POW']], rodzaj=r['NAZWA_DOD'])
             for r in rows if r['GMI'] and r['RODZ'] in ['1', '2', '3']]
    gminy.sort(key=lambda g: (g['woj'], g['nazwa'], g['kod']))
    if not 2000 <= len(gminy) <= 3500 or len({g['kod'] for g in gminy}) != len(gminy):
        raise ValueError('Nie rozpoznano pełnego katalogu gmin; istniejący plik pozostaje bez zmian.')
    wynik = dict(data=data, zrodlo=URL, gminy=gminy)
    target = Path(__file__).resolve().parent.parent / 'data/gminy-teryt.json'
    target.write_text(json.dumps(wynik, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Zapisano {len(gminy)} gmin; plik GUS z {data}.')


if __name__ == '__main__':
    aktualizuj()
