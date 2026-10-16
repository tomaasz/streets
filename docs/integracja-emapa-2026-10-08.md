# Gminna e-mapa Wyszkowa — integracja 8 października 2026

Wykorzystujemy publiczny WMS warstwy „Adresy i ulice”, wskazany w konfiguracji
portalu https://wyszkow.e-mapa.net/:
https://www.punktyadresowe.pl/cgi-bin/wms/143505.
GetCapabilities potwierdza warstwy `ulice` (liniowe i powierzchniowe)
oraz `punkty`, układ EPSG:2180 i możliwość GetFeatureInfo w XML.
Ten sam serwer odrzuca WFS jako usługę niewłączoną.

## Funkcje

- Panel mapy: przełącznik „Gminna e-mapa — adresy i ulice”. Warstwa nakłada
  nazwy i adresy na każdy dotychczasowy podkład, jest widoczna po przybliżeniu
  (rozdzielczość poniżej 20,48 m/piksel). Pozostaje oddzielna od przebiegów
  PRG/BDOT10k. Atrybucja wskazuje urząd i GEO-SYSTEM.
- Kliknięcie mapy przy włączonej warstwie odczytuje gminne ulice w pobliżu
  punktu. Wynik pokazuje nazwę, miejscowość, SIMC i ULIC oraz przycisk
  znalezienia tej ulicy w bazie. Pokazuje również niepuste pola numeru,
  uchwały i opisu dokładnie jako informacje z e-mapy.
- Karta ulicy i szczegóły nazwanej ulicy na mapie: „Sprawdź w e-mapie”.
  Serwer bierze środkowy punkt najdłuższej linii PRG, pyta WMS i porównuje
  SIMC/ULIC oraz nazwę. Zgodne identyfikatory, różnica nazwy, inne
  identyfikatory, brak wyniku i awaria mają osobne komunikaty.
- `/zrodla` objaśnia zakres faktycznie używanej usługi.

## Granice interpretacji

Nie jest to kompletny import gminnej ewidencji. Odczyt przestrzenny dotyczy
jednego punktu i może nie znaleźć przesuniętej geometrii. Brak wyniku nie
dowodzi braku ulicy. Nie zmieniamy automatycznie lokalnych nazw, geometrii,
kategorii ani zarządców i nie wliczamy wyników WMS do statystyk sieci.
Potwierdzenie nazwy w ewidencji nie zastępuje uchwały o kategorii drogi.
Puste pola „Numer drogi” i „Uchwała” pozostają puste.

## Obsługa usługi i walidacja

API przyjmuje lokalny slug albo punkt w zasięgu gminnej usługi EPSG:2180.
Adres upstream i warstwy są stałe. GetFeatureInfo ma limit 7 sekund,
maksymalnie 20 obiektów i 500 kB XML; parser odrzuca DTD, błędy serwera,
inne źródła i nieprawidłowe identyfikatory. Wyniki są deduplikowane.
Pamięć wyników trwa godzinę (do 500 pozycji), równoległe zapytania są
współdzielone, awarie nie są zapamiętywane. Usługa nie zapisuje decyzji
w bazie. Przy błędzie kafli pozostałe podkłady pozostają dostępne.

## Sprawdzenie

Żywy odczyt Malowniczej w Skuszewie zwrócił SIMC 0523270 i ULIC 12090,
zgodne z PRG w aplikacji. `node scripts/test-emapa.mjs` sprawdza walidację
źródła, identyfikatorów, puste pola, duplikaty i błędy XML. Chromium sprawdza
kartę ulicy, pobranie PNG WMS, kliknięcie punktu, wyłączenie warstwy,
awarię i niezgodne identyfikatory, telefon oraz stronę źródeł.

Kompilacja produkcyjna i kontrola typów zakończyły się powodzeniem.
Wdrożono do `streets.service` na porcie 3000 i powtórzono scenariusze
Chromium e-mapy oraz odnośnika Targeo bez błędów JavaScript. Kontrola
wyrównania filtrów i sortowania przeszła przed wdrożeniem.

## Czytelny stan warstwy — 9 października 2026

Widok całej gminy bywa poza zakresem warstwy (`maxResolution: 20.48`).
Wcześniej zaznaczony checkbox nie zmieniał wtedy obrazu i nie było komunikatu
poza dymkiem pomocy. Teraz pasek pokazuje jawnie „E-mapa włączona, ale ukryta
przy tym oddaleniu” i przycisk „Przybliż do ulic i adresów”. Przycisk zachowuje
środek widoku i wybiera rozdzielczość z drabinki nie większą niż 5,3 m/piksel.
Zmiana rozdzielczości aktualizuje komunikat, również po ponownym oddaleniu.
Podczas pobierania kafli pojawia się komunikat wczytywania; błędy są osobno
sygnalizowane. Po wczytaniu opis wskazuje żółte przebiegi ulic i punkty
adresowe oraz możliwość pokrywania się linii z odcinkami aplikacji.
Wyłączenie e-mapy usuwa jej komunikat i odczyt danych po kliknięciu.

Sprawdzenie żywej warstwy potwierdziło HTTP 200 image/png i zmianę obrazu
mapy po przełączeniu: ponad 132 tys. pikseli różniło się o więcej niż 20/255
w co najmniej jednym kanale koloru. Sprawdzono także przybliżenie, oddalenie,
brak pobierania kafli poza zakresem, układ mobilny i dymki pomocy.
