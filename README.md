# Drogi i ulice gminy Wyszków

Baza wszystkich ulic gminy Wyszków wraz z odpowiedzią na pytanie **kto zarządza
daną drogą** — zbudowana z otwartych danych GUGiK i wykazów z BIP, wystawiona
jako aplikacja webowa (Next.js na Vercelu + Postgres w chmurze).

TERC gminy: **143505** · powiat wyszkowski **1435** · województwo mazowieckie.

---

## Dlaczego to nie jest jedna tabela

„Ulica" i „droga" to dwa różne byty i mylenie ich psuje bazę na pierwszym
rekordzie:

* **Ulica** to obiekt adresowy z PRG / TERYT ULIC — ma nazwę, `SIMC`
  (miejscowość) i `SYM_UL` (identyfikator ulicy).
* **Droga** to obiekt z ustawy o drogach publicznych — ma kategorię i numer,
  a kategoria wyznacza zarządcę (art. 19 udp).

Jedna ulica może być podzielona na kilka odcinków o różnej kategorii — przez
Wyszków biegną DK 62 i DW 618, i biegną **ulicami**, które dalej są już gminne.
Dlatego model to `ulica (1) → odcinek (n) → kategoria + zarządca`.

Druga oś: **zarządca formalny** (z ustawy) to nie zawsze **podmiot utrzymujący**.
Porozumienie z art. 19 ust. 4 udp bywa podstawą przejęcia przez gminę chodników
i zieleni przy drogach powiatowych — stąd dwie osobne kolumny na odcinku.

Trzecia rzecz, którą łatwo pominąć: **`zrodlo` i `pewnosc` przy każdym rekordzie**.
Bez nich po trzech miesiącach nie odróżnisz rekordu zaimportowanego hurtem z
BDOT10k od potwierdzonego uchwałą.

```
pewnosc 1  import maszynowy (BDOT10k) — do weryfikacji
pewnosc 2  źródło urzędowe wtórne (wykaz w BIP, PRG)
pewnosc 3  akt prawa miejscowego albo ewidencja dróg zarządcy
```

## Skąd biorą się dane

| Warstwa | Źródło | Co daje |
|---|---|---|
| Lista ulic | **PRG** przez [Usługę Uniwersalnego Wyszukiwania GUGiK](https://services.gugik.gov.pl/uug/) | nazwa, `SIMC`, `SYM_UL`, oś ulicy |
| Kategoria i numer drogi | **BDOT10k**, warstwa `OT_SKDR_L`, [paczka powiatowa](https://opendata.geoportal.gov.pl/bdot10k/) | `kategoriaZarzadzania`, `numerDrogi`, `klasaDrogi`, `materialNawierzchni` |
| Granice, obręby, działki | **ULDK** [uldk.gugik.gov.pl](https://uldk.gugik.gov.pl/) | granica gminy, lista obrębów = miejscowości |
| Przebieg dróg powiatowych | [BIP Gminy Wyszków](https://bip.wyszkow.pl/), [BIP Powiatu](https://bip.powiat-wyszkowski.pl/) | wykazy dróg powiatowych |
| Rozstrzygnięcie | [Dziennik Urzędowy Woj. Mazowieckiego](https://edziennik.mazowieckie.pl/) | uchwały o zaliczeniu do kategorii |
| Drogi wewnętrzne | **EGiB** powiatu, [wyszkowski.e-mapa.net](https://wyszkowski.e-mapa.net/) | właściciel działki drogowej = zarządca |

Wszystkie źródła maszynowe są bezpłatne i nie wymagają rejestracji.

### Czego te dane jeszcze nie mówią

BDOT10k dla powiatu wyszkowskiego niesie kategorię zarządzania dla **każdego**
odcinka, ale numer drogi tylko dla części z nich, a dla dróg wewnętrznych nie ma
właściciela. Dokończenie bazy to:

1. potwierdzenie kategorii i numerów uchwałami (`pewnosc` 1 → 3),
2. join dróg wewnętrznych do EGiB po działkach, żeby ustalić właściciela,
3. wpisanie porozumień z art. 19 ust. 4 tam, gdzie gmina utrzymuje cudzą drogę.

Zakładka **Braki** w aplikacji jest listą tej roboty, posortowaną po długości.

## Co jest w bazie

Stan na PRG z 2026-08-20 i BDOT10k w wersji 2026-04-15
(pełna migawka: [`docs/stan-bazy.md`](docs/stan-bazy.md)):

| | |
|---|---:|
| ulic w 25 miejscowościach | **710** |
| odcinków dróg | **3 677** |
| dróg numerowanych | **211** |
| długość sieci | **949,4 km** |
| **ulic z ustaloną kategorią i zarządcą** | **660 z 710** |

| Kategoria | Zarządca | Ulic | Długość |
|---|---|---:|---:|
| krajowa | Generalny Dyrektor Dróg Krajowych i Autostrad | 6 | 30,1 km |
| wojewódzka | Zarząd Województwa Mazowieckiego (MZDW) | 4 | 8,8 km |
| powiatowa | Zarząd Powiatu Wyszkowskiego | 27 | 46,8 km |
| gminna | Burmistrz Wyszkowa | 236 | 165,4 km |
| wewnętrzna | właściciel terenu — do ustalenia z EGiB | 453 | 698,2 km |

Jedenaście ulic ma więcej niż jednego zarządcę — m.in. ul. Warszawska
(DK 62 na 543 m + gminna na 1 507 m) i ul. Generała Józefa Sowińskiego
(DW 618 na 434 m + gminna 440725W na 1 223 m). To jest ten przypadek,
dla którego model musi mieć odcinki.

## Ustalenia z danych, które warto znać

* Gmina Wyszków używa **dwóch** bloków numerów dróg gminnych: `4405xxW`
  i `4407xxW`. W paczce BDOT10k dla całego powiatu obie serie leżą praktycznie
  w całości w granicach gminy Wyszków (49,6 km z 50,4 km oraz 84,7 km z 85,0 km).
* Odcinki S8 w granicach gminy są w BDOT10k opisane numerem szlaku europejskiego
  **E67**, nie `S8`. Zarządcą jest tak czy inaczej GDDKiA.
* W gminie występuje więcej numerów dróg powiatowych niż w wykazie „dróg do
  odśnieżania" z BIP — ten wykaz jest podzbiorem, nie rejestrem.
* Powiat wyszkowski nie powołał Zarządu Dróg Powiatowych; obowiązki zarządu
  drogi wykonuje **Zarząd Powiatu**, obsługiwany przez Wydział Inwestycji
  i Dróg Publicznych starostwa.

## Uruchomienie lokalnie

```bash
npm install
cp .env.example .env          # wpisz DATABASE_URL
npm run db:migrate            # schemat
npm run data:all              # pobierz PRG + BDOT10k i zbuduj odcinki (~40 min)
npm run db:seed               # wsad do bazy
npm run dev                   # http://localhost:3000
```

`npm run data:all` odpytuje usługi GUGiK; jeżeli `data/raw/*.json` już są
w repozytorium, można od razu przejść do `db:seed`.

Baza z PostGIS (Neon, Supabase) — dodatkowo:

```bash
node scripts/migrate.mjs --postgis
```

Migracja `0003` dokłada kolumny `geometry(MultiLineString, 4326)` obok
`jsonb` i indeksy GiST. Aplikacja działa bez niej — geometria jest trzymana
jako GeoJSON w `jsonb`, żeby baza chodziła na dowolnym darmowym hostingu.

## Wdrożenie: Vercel + Postgres w chmurze

1. **Baza.** Vercel → Storage → Neon albo Supabase (oba mają darmowy plan
   i PostGIS). Aplikacja czyta connection string z `DATABASE_URL`,
   `POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING` lub
   `POSTGRES_PRISMA_URL`, więc obie integracje działają bez aliasu. Używaj puli
   połączeń (Neon: host z sufiksem `-pooler`, Supabase: port 6543).
   Masz już bazę, której chcesz użyć? Ustaw `DB_SCHEMA=drogi` — tabele pójdą
   do własnego schematu i nic się nie zderzy.
2. **Projekt.** Zaimportuj to repozytorium na [Vercel](https://vercel.com).
   Framework wykryje się sam (Next.js).
3. **Zmienna środowiskowa.** W ustawieniach projektu dodaj `DATABASE_URL`
   dla środowisk Production, Preview i Development.
4. **Migracja i wsad.** Albo z lokalnej maszyny (potrzebny tylko Node 20+):

   ```bash
   DATABASE_URL="postgresql://..." DB_SCHEMA=drogi npm run db:setup
   ```

   albo bez instalowania czegokolwiek — dodaj `DATABASE_URL` jako sekret
   repozytorium i uruchom workflow **Actions → Wgraj dane do bazy**.

Aplikacja jest w całości server-side (`force-dynamic`), więc nie trzeba
przebudowywać deploymentu po odświeżeniu danych.

## API

| Ścieżka | Opis |
|---|---|
| `GET /api/ulice?q=&kategoria=&miejscowosc=&zarzadca=` | lista ulic z zarządcami, JSON |
| `GET /api/eksport?format=csv` | pełny wykaz ulica × odcinek, CSV z BOM (Excel) |
| `GET /api/eksport?format=geojson` | to samo z geometrią, EPSG:4326 |

Filtry działają tak samo w API i w interfejsie.

## Struktura

```
db/migrations/     schemat (0003 z PostGIS jest opcjonalna)
db/seed/           słowniki: zarządcy, źródła, opisy dróg — ręcznie utrzymywane
scripts/           harvest-prg, harvest-bdot, build-odcinki, migrate, seed
data/raw/          surowe pobrania z GUGiK (w repo, żeby dało się odtworzyć wynik)
data/odcinki.json  wynik dopasowania BDOT ↔ PRG, wsad dla seed
src/app/           Next.js App Router
src/lib/           dostęp do bazy i zapytania
```

## Jak działa dopasowanie BDOT ↔ PRG

PRG nie wie, kto zarządza drogą. BDOT nie wie, jak nazywa się ulica. Łączy je
geometria: oś drogi z BDOT jest próbkowana co 15 m, dla każdej próbki szukamy
najbliższej osi ulicy z PRG w promieniu 25 m (indeks siatkowy 50 m), a odcinek
przypisujemy do ulicy, która zebrała większość próbek. Próg i tolerancję zmienia
się zmienną `TOLERANCJA_M`.

Odcinki, które nie trafiły w żadną ulicę (drogi polne, leśne, dojazdy do pól),
zostają w bazie z `ulica_id = NULL` — są częścią sieci drogowej gminy, po prostu
nie mają nazwy ulicy.

## Zastrzeżenie

Serwis informacyjny. Nie zastępuje zaświadczenia, wypisu z ewidencji dróg ani
uzgodnienia z zarządcą. Dane BDOT10k są aktualizowane powiatami i mogą być
opóźnione względem stanu faktycznego.
