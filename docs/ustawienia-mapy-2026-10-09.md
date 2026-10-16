# Ustawienia mapy — 9 października 2026

Wdrożono trzy uzgodnione zmiany:

- Stała legenda sześciu kategorii na `/mapa`, pod przełącznikami. Ma próbki kolorów i tekst; na komputerze mieści się w jednym rzędzie, na telefonie zawija się bez poziomego przepełnienia. Karta jednej ulicy zachowuje układ bez pełnej legendy.
- Domyślne delikatne przygaszenie podkładów: opacity 0,8 zamiast wcześniejszego 0,45. Linie dróg i e-mapa zachowują swoją intensywność; checkbox pozwala przywrócić pełne tło.
- Preferencje podkładu, przygaszenia i e-mapy zapisują się w `localStorage` pod kluczem `drogi-mapa-preferencje`, wspólnie dla mapy i kart ulic. Odczyt następuje przed inicjalizacją mapy i pierwszym zapisem, aby nie nadpisać poprzedniego wyboru. Akceptowane są tylko znane podkłady i wartości boolean; uszkodzony zapis lub blokada pamięci nie zatrzymują mapy. Filtry nadal pochodzą z URL.

Pierwsze otwarcie: OSM, przygaszenie włączone, e-mapa wyłączona. Po zapisaniu preferencji kolejne otwarcia odtwarzają wybór użytkownika.

Walidacja produkcji: build i TypeScript; Chromium sprawdził wysokość legendy i paska, wizualną zmianę podkładu, zapamiętanie po odświeżeniu i przejściu na kartę ulicy, zachowanie filtrów URL, telefon i ciemny motyw oraz poprawny, uszkodzony i niedostępny localStorage. Sprawdzenie funkcji paska mapy również przeszło. Bez błędów JavaScript.
