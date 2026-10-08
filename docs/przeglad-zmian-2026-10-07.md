# Przegląd zmian i plan uzupełniania dróg — 7 października 2026

## Ustalenia i naprawy

- Działający proces Next.js miał starszą kompilację w pamięci, a katalog
  `.next` został zastąpiony. Strona odwoływała się do nieistniejącego
  `/_next/static/chunks/3hw4n6lfus190.js`, który zwracał HTTP 500.
  Przeglądarka nie uruchamiała komponentu mapy. Wymagana była kompilacja
  i restart `streets.service`.
- Importer zmieniał `zrodlo` geometrii BDOT na `uchwala`, a przy kolejnym
  uruchomieniu kasował te rekordy. W bazie było 263 takich geometrii.
  Teraz źródło geometrii pozostaje `bdot10k`, podstawę kategorii zapisuje
  `akt_odcinek`, a odtwarzanie obejmuje tylko rekordy uchwał bez geometrii.
  Starsze rekordy z geometrią otrzymują ponownie źródło `bdot10k`.
- Powiązanie XXVII/264/16, zał. 2, lp. 16 → BDOT 440768W przeniesiono
  do `db/seed/powiazania-odcinkow.json`. Rejestr zawiera opis, uzasadnienie,
  długość z uchwały i dopuszczalne odchylenie. Import wymaga jednego
  kandydata. Numer 440768W pochodzi z BDOT, a ta pozycja uchwały nie podaje
  numeru. Długości 563 m z uchwały i 641 m z geometrii nie są zamienne.
- Mapa udostępnia PDF podstawy prawnej bezpośrednio w dymku odcinka.
  Wczytywanie danych ma limit 30 s oraz możliwość ponowienia.
- Raport importu obejmuje również wątpliwe odczyty PDF i może być zapisany
  jako JSON z numerem uchwały, załącznika i pozycji.

W bazie są trzy akty drogowe: XXVII/264/16, XLIII/426/17 i XIII/100/25.
Sama obecność aktu w źródłach nie oznacza, że wszystkie jego pozycje zostały
powiązane z geometrią. Uchwały o gospodarowaniu nieruchomościami nie
rozstrzygają kategorii konkretnego odcinka.

## Kolejka pozycji uchwał

Po zastosowaniu powiązania 440768W pozostało 16 pozycji do rozpatrzenia:

| Akt | Załącznik / pozycja | Miejsce lub nazwa | Długość z uchwały | Dalsze działanie |
|---|---|---|---|---|
| XIII/100/25 | § 1, poz. 1 | Kamieńczyk | 460 m | Ustalić przebieg od działki 3717/4 do ul. Nad Rozlewiskiem na podstawie załącznika i EGiB. |
| XXVII/264/16 | 1 / 31 | Gwardii Ludowej | 123 m | Sprawdzić uchwałę o zmianie nazwy i zachować nazwę historyczną. |
| XXVII/264/16 | 1 / 85 | Monte Casino | 81 m | Zweryfikować zgodność przebiegu z Monte Cassino; zapisać zatwierdzony alias. |
| XXVII/264/16 | 1 / 90 | Obwodnica | 2200 m | Wyznaczyć konkretne odcinki między Matejki, Białostocką i granicą miasta. |
| XXVII/264/16 | 1 / 123 | Hanki Sawickiej | 204 m | Sprawdzić akt zmiany nazwy. |
| XXVII/264/16 | 1 / 142 | Tadeusz Strusia | 123 m | Zweryfikować przebieg między Drzewieckiego i Ogródkową oraz zapis nazwy. |
| XXVII/264/16 | 2 / 1 | Deskurów – Tumanek – Fidest | 5263 m | Powiązać ciąg z wieloma odcinkami BDOT; sprawdzić zakres uchwały. |
| XXVII/264/16 | 2 / 24 | Leszczydół-Działki | 1695 m | Opis „wzdłuż miejscowości” wymaga załącznika mapowego lub ewidencji dróg. |
| XXVII/264/16 | 2 / 30 | Leszczydół-Pustki | 1090 m | Ustalić połączenie od Leszczydołu-Działek do granicy miejscowości. |
| XXVII/264/16 | 2 / 31 | Leszczydół-Pustki | 1622 m | Ustalić połączenie od 4412W do granicy miejscowości. |
| XXVII/264/16 | 2 / 36 | Rybienko Stare | 1453 m | Ustalić przebieg między 4418W a DK62. |
| XXVII/264/16 | 2 / 43 | Rybno | 380 m | Ustalić przebieg między 4418W a Boczną. |
| XXVII/264/16 | 2 / 53 | Ślubów | 1758 m | Ustalić przebieg od 4419W do granicy miejscowości. |
| XXVII/264/16 | 2 / 54 | Tulewo Górne | 431 m | Ustalić przebieg od 4418W do drogi gminnej. |
| XXVII/264/16 | 2 / 55 | Tulewo | 1025 m | Ustalić przebieg od 4418W do granicy miejscowości. |
| XXVII/264/16 | 2 / 56 | Leszczydół Stary | 650 m | Ustalić przebieg od granicy miasta do 4412W. |

## Proponowana organizacja dalszej pracy

1. **Osobny rekord pozycji uchwały.** Tożsamość: akt + załącznik/§ + lp.
   Zachować oryginalną nazwę, opis, długość, PDF i stronę dokumentu.
   Statusy: nierozpatrzona, kandydat, potwierdzona, odrzucona, zastąpiona.
   Pozycja musi istnieć także wtedy, gdy nie ma odpowiadającej ulicy w PRG.
2. **Relacja pozycji z odcinkami.** Jedna pozycja może obejmować kilka
   odcinków BDOT lub fragment większego odcinka. Zapisywać uzasadnienie,
   autora i datę weryfikacji. Identyfikatory odcinków w bazie zmieniają się
   podczas seeda; powiązania trzeba odtwarzać z trwałych identyfikatorów
   źródłowych, numeru, lokalizacji i kontroli geometrii.
3. **Nazwy historyczne i aliasy.** Łączyć zatwierdzone warianty z SIMC/SYM_UL
   i okresem obowiązywania. Automatyczne podobieństwo tekstu ma wskazywać
   kandydatów; potwierdzenie wymaga przebiegu i odpowiedniego dokumentu.
   Treść uchwały pozostaje w oryginalnym brzmieniu.
4. **Rozdzielenie braków.** Obecne `v_braki` obejmuje 49 ulic bez odcinków,
   411 bez zarządcy i 43 do weryfikacji importu. Nie obejmuje 16 powyższych
   pozycji ani 2939 odcinków bez powiązania z ulicą. Droga bez nazwy może
   być kompletnym rekordem, a ulica bez odcinka może być projektowana.
   Dla każdej grupy potrzebne są osobne statusy i filtry miejscowości.
5. **Warstwa kandydatów na mapie.** Opcjonalna warstwa dróg BDOT bez
   przypisanej ulicy, z oznaczeniem źródła i stopnia weryfikacji. Ułatwi
   wskazywanie brakujących połączeń. Dopasowanie całej ulicy z uchwały
   do wszystkich jej odcinków trzeba z czasem zastąpić dopasowaniem
   konkretnego zakresu — obecna reguła działa na poziomie ulicy.

Pierwsza kolejność: Kamieńczyk z uchwały 2025 → dwa warianty nazw
(Monte Casino, Tadeusz Strusia) → nazwy historyczne → wiejskie połączenia
z jednoznacznymi końcami → opisowe ciągi wymagające dokumentacji mapowej.

Raport można odtworzyć bez zapisu do bazy:

```bash
node --env-file=.env scripts/import-uchwaly.mjs --na-sucho \
  --raport-json=/tmp/raport-uchwaly.json
```

## Kontrola wdrożenia

Nie uruchamiać `next build` nad katalogiem kompilacji używanym przez działający
proces. Docelowo budować osobne katalogi wydań i przełączać usługę na gotowe
wydanie. Przy wdrożeniu w jednym katalogu zatrzymać usługę przed kompilacją
i uruchomić ją po sukcesie. Sam udany build nie aktualizuje działającego
procesu Next.js.

Po wdrożeniu sprawdzić stronę w przeglądarce: odpowiedzi HTTP plików JS,
obecność `.ol-viewport` i canvasu, dane odcinka bez nazwy, PDF oraz eksport.
Kontrola TypeScript nie wykrywa rozjazdu między procesem a katalogiem `.next`.

Weryfikacja wykonana przy tej zmianie: TypeScript i build zakończone sukcesem;
usługa zrestartowana; mapa oraz podkład sprawdzone w Chromium. Potwierdzono
dymek odcinka 440768W z linkiem do PDF, filtr kategorii, eksport CSV/GeoJSON
oraz ponowienie po zasymulowanym HTTP 500 z API. Import zastosowano, następnie
powtórzono na sucho: porównanie identyfikatorów i skrótów geometrii potwierdziło
zachowanie wszystkich 3677 geometrii. Pozostało 16 pozycji wymagających
uzupełnienia lub weryfikacji dokumentów.
