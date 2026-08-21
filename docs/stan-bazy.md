# Stan bazy dróg gminy Wyszków

Migawka wygenerowana przez `npm run raport` na danych PRG z 2026-08-21, BDOT10k w wersji 2026-04-15 oraz trzech uchwałach Rady Miejskiej w Wyszkowie o zaliczeniu dróg do kategorii dróg gminnych. Odtworzysz ją tym samym poleceniem po każdym odświeżeniu danych.

Od 2026-08-21 obowiązuje **reguła pierwszeństwa źródeł**: tam, gdzie uchwała rady mówi co innego niż odczyt z BDOT10k, rozstrzyga uchwała — bo to ona kategorię drogi ustanawia, a BDOT jest odczytem z mapy. Reguła nie dotyka odcinków krajowych, wojewódzkich i powiatowych: uchwała rady gminy nie może przekwalifikować cudzej drogi. Szczegóły w `scripts/import-uchwaly.mjs`.

- ulic: **710** w 25 miejscowościach
- odcinków dróg: **3678**
- dróg numerowanych: **211**
- długość sieci: **949,4 km**

## Wg kategorii

| Kategoria | Zarządca | Ulic | Odcinków | Długość [km] |
|---|---|---:|---:|---:|
| krajowa | Generalny Dyrektor Dróg Krajowych i Autostrad | 6 | 8 | 30,1 |
| wojewodzka | Zarząd Województwa Mazowieckiego | 4 | 4 | 8,8 |
| powiatowa | Zarząd Powiatu Wyszkowskiego | 27 | 36 | 46,8 |
| gminna | Burmistrz Wyszkowa | 241 | 336 | 176,6 |
| wewnetrzna | — | 411 | 3294 | 687,1 |

## Drogi publiczne numerowane

| Numer | Kategoria | Przebieg | Długość w gminie [km] | Pewność |
|---|---|---|---:|---:|
| 62 | krajowa | Strzelno – Płock – Wyszków – Węgrów – Siemiatycze; przez Wyszków biegnie ulicami miasta. | 18,3 | 2/3 |
| E67 | krajowa | Szlak europejski Via Baltica pokrywający się z S8 na odcinku przez gminę. | 11,8 | 2/3 |
| 4403W | powiatowa | Wyszków – Brańszczyk – Długosiodło | 1,3 | 2/3 |
| 4406W | powiatowa | od DK nr 62 – Kamieńczyk – Puste Łąki | 9,3 | 2/3 |
| 4408W | powiatowa | Wyszków – Porządzie – Długosiodło | 7,2 | 2/3 |
| 4412W | powiatowa | Leszczydół Stary – Leszczydół-Pustki | 4,3 | 2/3 |
| 4413W | powiatowa | Wola Mystkowska – Kozłowo – Ostrowy | 0,9 | 2/3 |
| 4414W | powiatowa | Wyszków – Popowo Kościelne | 4,6 | 2/3 |
| 4415W | powiatowa | Leszczydół Stary – Leszczydół Działki – Leszczydół-Podwielątki – Wielątki | 3,2 | 2/3 |
| 4417W | powiatowa | Kręgi – Olszanka | 4,3 | 2/3 |
| 4418W | powiatowa | Rybno – Gulczewo | 4,0 | 2/3 |
| 4419W | powiatowa | Wyszków – Drogoszewo – Ślubów | 6,6 | 2/3 |
| 4421W | powiatowa | od węzła S8 – Lucynów – Mostówka – Zabrodzie | 0,7 | 1/3 |
| 4422W | powiatowa | Puste Łąki – Urle – Jadów | 0,5 | 2/3 |
| 618 | wojewodzka | Gołymin-Ośrodek – Pułtusk – Wyszków; klasa G. | 8,8 | 2/3 |

## Ulice o więcej niż jednym zarządcy

Takich ulic jest 11.

| Ulica | Miejscowość | Zarządcy | Numery dróg |
|---|---|---|---|
| ul. Sosnowa | Wyszków | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440724W, 4408W |
| ul. Zakręzie | Wyszków | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 4403W, 440749W |
| ul. Jaśminowa | Ślubów | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440789W, 4419W |
| ul. Mazowiecka | Kamieńczyk | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 4406W, 440760W |
| ul. Wspólna | Deskurów | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440756W, 4419W |
| ul. Warszawska | Wyszków | Burmistrz Wyszkowa; Generalny Dyrektor Dróg Krajowych i Autostrad | 62 |
| ul. Generała Józefa Sowińskiego | Wyszków | Burmistrz Wyszkowa; Zarząd Województwa Mazowieckiego | 440725W, 618 |
| ul. 3 Maja | Wyszków | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440565W, 4414W |
| al. Wolności | Wyszków | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440504W, 4419W |
| ul. Strażacka | Rybno | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440782W, 4414W |
| ul. Ignacego Daszyńskiego | Wyszków | Burmistrz Wyszkowa; Zarząd Powiatu Wyszkowskiego | 440584W, 4408W |

## Do domknięcia

| Problem | Ulic |
|---|---:|
| brak zarządcy | 411 |
| brak odcinków | 49 |
| do weryfikacji (import maszynowy) | 43 |
