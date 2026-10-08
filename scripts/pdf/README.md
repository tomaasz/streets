# Odczyt uchwał z PDF-ów

Uchwały o zaliczeniu dróg do kategorii dróg gminnych niosą to, czego nie ma
w żadnym rejestrze maszynowym: **podstawę prawną**. BDOT10k mówi, że ulica jest
gminna; uchwała mówi, kto i kiedy tak postanowił, i na jakim odcinku.

To jedyne miejsce w projekcie z zależnością zewnętrzną. Reszta repozytorium
czyta ZIP-y i XML-e własnym kodem, ale napisanie czytnika PDF-ów od zera nie
opłaca się pod zadanie, które robi się kilka razy w roku — wtedy, gdy rada
podejmie nową uchwałę. Dlatego:

- **ekstrakcja** (ten katalog, Python + `pypdf`) — uruchamiana ręcznie,
  **poza** cotygodniowym timerem;
- **dopasowanie i wsad do bazy** (`scripts/import-uchwaly.mjs`, Node, bez
  zależności) — uruchamiane z repozytorium jak każdy inny krok.

Do repozytorium wchodzi wynik ekstrakcji, `data/raw/uchwaly-kategorie.json`.
Same PDF-y leżą w `data/uchwaly/` i są w `.gitignore` — ważą kilka MB,
a ściąga się je z e-dziennika albo z BIP-u.

## Użycie

```bash
python3 -m venv .venv && .venv/bin/pip install pypdf
.venv/bin/python scripts/pdf/czytaj-uchwaly.py data/uchwaly/*.pdf \
  > data/raw/uchwaly-kategorie.json

npm run data:uchwaly     # dopasowanie do ulic z PRG i wsad do bazy

# Lokalnie, z konfiguracją z .env, raport bez zapisu do bazy:
node --env-file=.env scripts/import-uchwaly.mjs --na-sucho \
  --raport-json=/tmp/raport-uchwaly.json
```

## Co skrypt rozpoznaje

Uchwały mają dwa układy i oba są obsłużone:

- **tabela w załączniku** — nagłówek kończy się na „Oznaczenie odcinka”,
  potem pozycje `<lp>. <nazwa> <długość> <opis odcinka>`;
- **lista w treści § 1** — `<lp>) droga w miejscowości <M> [- ul. <U>]
  o długości <D> km - odcinek <opis>;`.

Nazwa pozycji bywa sama („Akacjowa”), z miejscowością („Drogoszewo
ul. Szczęśliwa”), przebiegiem między wsiami („Deskurów – Tumanek – Fidest”),
samym numerem drogi („4412W”) albo samą miejscowością — wtedy chodzi o drogę
bez nazwy własnej.

## Czego się spodziewać po źródle

PDF-y bywają niechlujne i skrypt to zakłada:

- numeracja potrafi zgubić kropkę (w XXVII/264/16 pozycja 41 stoi jako `41`,
  nie `41.`) — marker jest przyjmowany dopiero, gdy numer jest kolejnym
  w ciągu, więc numery działek z opisu odcinka nie rozwalają listy;
- pozycja bywa **bez nazwy** (XXVII/264/16, zał. 2 poz. 16: jest opis odcinka
  i długość, nazwy nie ma) — taka pozycja dostaje `watpliwa: true` i nie
  jest automatycznie dopasowywana do ulicy. Wyjątek: poz. 16 uchwały
  XXVII/264/16 jest ręcznie powiązana w `db/seed/powiazania-odcinkow.json` z
  nienazwanym odcinkiem BDOT10k nr 440768W; geometria tej drogi trafia na mapę
  jako „Droga gminna bez nazwy” z podstawą prawną, a BDOT pozostaje źródłem
  geometrii;
- w nazwach zdarzają się literówki („Monte Casino” zamiast „Monte Cassino”,
  „Tadeusz Strusia” zamiast „Tadeusza Strusia”). **Nie poprawiamy ich
  automatycznie** — to treść aktu prawnego. Importer je raportuje jako
  niedopasowane i decyzja należy do człowieka;
- starsze uchwały wymieniają ulice, których dziś nie ma w PRG, bo zmieniły
  nazwę (XXVII/264/16 jest z września 2016 r., sprzed dekomunizacji nazw —
  „Gwardii Ludowej” i „Hanki Sawickiej” już nie istnieją).

Zatwierdzone powiązania pozycji bez nazwy zapisujemy w
`db/seed/powiazania-odcinkow.json`, razem z uzasadnieniem. Kolejka 16
niedopasowanych pozycji i propozycja dalszej organizacji są w
`docs/przeglad-zmian-2026-10-07.md`.
