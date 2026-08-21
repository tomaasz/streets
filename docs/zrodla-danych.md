# Katalog źródeł danych o drogach gminy Wyszków

Uporządkowane od najłatwiejszych do zautomatyzowania po te, które trzeba
wyciągnąć z urzędu.

## A. Kręgosłup — lista ulic

### 1. PRG przez Usługę Uniwersalnego Wyszukiwania GUGiK ★ używane

```
https://services.gugik.gov.pl/uug/?request=GetAddress&address=<miejscowość>,<fragment>
```

Zwraca JSON: `street`, `teryt` (TERC gminy), `simc`, `ulic` (SYM_UL), `x`, `y`
i `geometry_wkt` — oś ulicy jako `MULTILINESTRING` w PL-1992 (EPSG:2180).
Dopasowanie jest **fragmentem nazwy**, minimum dwa znaki, i jest ograniczone do
wskazanej miejscowości.

Nie ma trybu „wypisz wszystkie", więc `scripts/harvest-prg.mjs` przemiata
dwuznaki postaci `<dowolna litera><samogłoska>` — każda polska nazwa zawiera co
najmniej jeden taki dwuznak, więc przemiat jest kompletny. Żeby nie zalewać
usługi, dla każdej miejscowości leci najpierw krótka sonda; pełny przemiat
uruchamia się tylko tam, gdzie w ogóle są nazwane ulice.

### 2. TERYT ULIC (GUS)

`eteryt.stat.gov.pl` → katalog ULIC (XML/CSV). Urzędowo kompletne źródło nazw,
ale pobranie jest formularzowe (ASP.NET postback), więc nie da się go wprost
zautomatyzować. Warto pobrać raz ręcznie i porównać z PRG — **raport rozbieżności
nazw jest osobnym, wartościowym produktem ubocznym** tej bazy.

### 3. Własna EMUiA gminy

[wyszkow.e-mapa.net](https://wyszkow.e-mapa.net/) — geoportal w systemie
Geo-System (iMPA), prowadzony przez Urząd Miejski w Wyszkowie. Najbardziej
aktualne źródło i dostępne „od środka": lepiej poprosić geodetę o eksport
GML/WFS niż scrapować portal.

## B. Kategoria i numer drogi

### 4. BDOT10k, paczka powiatowa ★ używane

```
https://opendata.geoportal.gov.pl/bdot10k/schemat2021/14/1435_GML.zip
```

Adres paczki można też odczytać z WFS pobierania:

```
https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/PobieranieBDOT10k
  ?service=WFS&version=2.0.0&request=GetFeature
  &typeNames=ms:BDOT10k_powiaty
  &propertyName=TERYT,NAZWA_POWIATU,Data_aktualizacji,URL_GML
```

Interesujące warstwy:

* `OT_SKDR_L` — **oś drogi**, jedna linia na drogę. `kategoriaZarzadzania`,
  `numerDrogi`, `klasaDrogi`, `materialNawierzchni`, `szerokoscNawierzchni`,
  `liczbaJezdniDrogi`. To jest warstwa, z której korzysta ten projekt.
* `OT_SKJZ_L` — **jezdnie**, po jednej linii na jezdnię (drogi dwujezdniowe mają
  dwie). Przydatne przy S8, przeszkadza przy sumowaniu kilometrów.
* `OT_SKRP_L`, `OT_SKPP_L` — ronda i przejścia.

Dane nie zawsze są w pełni aktualne — traktować jako szkielet do weryfikacji,
nie jako źródło prawdy.

### 5. OpenStreetMap / Overpass API

Do walidacji krzyżowej: zapytanie po granicy gminy, tagi `highway`, `name`,
`ref`. Wychwyci ulice, których nie ma w BDOT, i odwrotnie. Nie jest źródłem
urzędowym — służy do znajdowania rozbieżności, nie do rozstrzygania.

## C. Prawda formalna

### Drogi krajowe
GDDKiA Oddział w Warszawie. Przez gminę: **S8** (obwodnica Wyszkowa oddana
w 2008 r., w BDOT oznaczona numerem szlaku **E67**) oraz **DK 62**
(Strzelno – Płock – Wyszków – Siemiatycze), która przez miasto biegnie ulicami.

### Drogi wojewódzkie
Mazowiecki Zarząd Dróg Wojewódzkich, obsługa przez Rejon Drogowy
Wołomin – Nowy Dwór Mazowiecki. Przez gminę **DW 618**
(Gołymin-Ośrodek – Pułtusk – Wyszków), klasa G. Aktualny wykaz:
`mzdw.pl/pl/strona/wykaz-drog-wojewodzkich` plus geoportal MZDW.

### Drogi powiatowe
Powiat wyszkowski **nie ma Zarządu Dróg Powiatowych** — zarządcą jest Zarząd
Powiatu, a obsługę prowadzi Wydział Inwestycji i Dróg Publicznych starostwa.
Źródła: uchwała Rady Powiatu o przebiegu dróg powiatowych oraz
`Mapa dróg powiatowych.pdf` na BIP powiatu.

Wykaz z BIP gminy (załącznik do zamówienia na zimowe utrzymanie) wymienia
`4403W`, `4406W`, `4413W`, `4414W`, `4417W`, `4418W`, `4419W` — ale to lista dróg
**do odśnieżania**, czyli podzbiór. BDOT10k pokazuje w granicach gminy również
`4408W`, `4412W`, `4415W`, `4421W`, `4422W`. Rozbieżność rozstrzyga uchwała.

### Drogi gminne
Dwa źródła, oba w gminie:

* **Uchwały Rady Miejskiej** o zaliczeniu do kategorii dróg gminnych, z numerami
  nadanymi przez Zarząd Województwa Mazowieckiego. Komplet w
  [edziennik.mazowieckie.pl](https://edziennik.mazowieckie.pl/) — to najlepsza
  droga do kompletności, bo wykaz na BIP bywa niepełny.
* **Ewidencja dróg gminnych** prowadzona przez UM na podstawie rozporządzenia
  MI z 16.02.2005 (Dz.U. 2005 nr 67 poz. 582): książki dróg, dzienniki objazdu,
  mapa techniczno-eksploatacyjna. Formalnie to jest ta baza, którą tu budujemy —
  zacznij od sprawdzenia, w jakiej postaci jest prowadzona.

### Drogi wewnętrzne
Tu jest najwięcej roboty: 698 km z ok. 950 km sieci w gminie. Brak kategorii,
zarządcą jest właściciel terenu (art. 8 ust. 2 udp). Źródło: **EGiB powiatu**
(Wydział Geodezji, [wyszkowski.e-mapa.net](https://wyszkowski.e-mapa.net/)) —
działki o użytku `dr`, kolumna właściciel: Gmina Wyszków / Skarb Państwa / KOWR /
Lasy Państwowe (Nadleśnictwo Wyszków) / PKP PLK / spółdzielnie / osoby prywatne /
deweloperzy.

Geometrię pojedynczej działki można pobrać z ULDK:

```
https://uldk.gugik.gov.pl/?request=GetParcelByIdOrNr&id=143505_4.0001.123&result=geom_wkt
```

## Dostępność źródeł z sieci

Nie każde źródło da się odpytać z każdej sieci — część serwisów blokuje adresy
centrów danych. Sprawdzić to można pod `/api/diagnostyka`; endpoint odpytuje
stałą listę adresów i pokazuje, co odpowiadają.

Stan sprawdzony z funkcji na Vercelu w regionie `lhr1`:

| Źródło | Wynik |
|---|---|
| GUGiK: UUG, ULDK, WFS BDOT10k | 200, poniżej 300 ms |
| BIP gminy i powiatu | 200 |
| **edziennik.mazowieckie.pl** | **brak odpowiedzi, timeout po 20 s** |

Z sieci Google Cloud ten sam serwis zwraca `403 Dostęp zablokowany` z numerem
zgłoszenia. Blokadę stawia Akamai Bot Manager — widać go w konsoli przeglądarki
jako skrypt `edziennik.mazowieckie.pl/akam/…`.

Sprawdzone i odrzucone drogi obejścia:

* **ELI, `api.sejm.gov.pl/eli`** — obejmuje wyłącznie Dziennik Ustaw i Monitor
  Polski, dzienników wojewódzkich tam nie ma.
* **`dziennikiurzedowe.gov.pl`** — krajowy spis dzienników, ale dla Mazowsza
  odsyła wprost pod `edziennik.mazowieckie.pl/actbymonths`, czyli pod ten sam
  zablokowany host.
* **`dane.gov.pl`** — nie publikuje dzienników wojewódzkich.
* **Osobne hosty** (`api.`, `edzienniki.`, `edziennik2.`) — nie istnieją w DNS.
* **`/rss`, `/feed`, `/opendata`, `/api/v1/acts`** — 403 albo brak odpowiedzi.

Innego wydania tych samych danych po prostu nie ma. Automatyzacja musi więc
działać z sieci, którą serwis przyjmuje, albo trzeba wystąpić do Mazowieckiego
Urzędu Wojewódzkiego o dostęp dla konkretnego adresu IP. Import z e-dziennika trzeba więc uruchamiać z sieci, która nie jest
blokowana — z komputera w urzędzie albo z hostingu o polskim adresie:

```bash
node scripts/harvest-edziennik.mjs --rozpoznanie
```

## D. Pomocnicze

### ULDK — granice i obręby ★ używane

```
https://uldk.gugik.gov.pl/?request=GetCommuneById&id=143505&result=teryt,commune,geom_wkt
https://uldk.gugik.gov.pl/?request=GetRegionById&id=143505&result=teryt,region
```

Drugie zapytanie zwraca 27 obrębów ewidencyjnych gminy — to lista miejscowości,
po której przemiatamy PRG.

## Kolejność działania

1. PRG → wypełnij `ulica`. Kompletna lista nazw.
2. BDOT10k → wypełnij `odcinek_drogi` z `pewnosc = 1`, przycięte do granicy gminy.
3. Uchwały (edziennik mazowiecki, BIP powiatu, MZDW, GDDKiA) → nadpisz kategorie
   i numery, podnieś `pewnosc` do 3.
4. Reszta = wewnętrzne → join do EGiB po działkach, ustal właściciela.
   Tu wyjdą białe plamy do domknięcia zapytaniem do geodety albo objazdem.

Największe ryzyko na styku źródeł: rozjazd nazwy ulicy między TERYT, EMUiA gminy
i uchwałami (klasyczne „Janka" vs „Ignacego Krasickiego"). Zrób raport
rozbieżności zanim zaczniesz łączyć.
