# Stałe opcje mapy — 9 października 2026

Zastąpiono rozwijany panel zasłaniający mapę stałym paskiem nad mapą.
Pierwszy wiersz zawiera wybór podkładu, przygaszanie, odnośnik Targeo
i dopasowanie widoku. Drugi — gminną e-mapę, odcinki bez przypisanej
ulicy, liczbę odcinków i rozwijaną pomoc. Długie objaśnienia pojawiają
się w układzie strony, bez nakładania na mapę.

Na komputerze pasek ma około 110 px wysokości; na telefonie kontrolki
zawijają się i pozostają dostępne bez przewijania poziomego. Wybór podkładu
zachowuje cztery dotychczasowe opcje. Przyciski i etykiety przełączników
mają co najmniej 44 px wysokości; stan jest widoczny w natywnych kontrolkach.

Sprawdzono zmianę podkładu, przygaszanie, przełącznik e-mapy, odcinki
bez przypisanej ulicy i aktualizację URL, rozwijanie pomocy, odnośnik
Targeo oraz dopasowanie widoku. Kontrola układu przy 1920, 1440, 900 i 390 px
potwierdziła brak przepełnienia i brak zasłaniania mapy. Kontrola typów
i `git diff --check` przeszły.

## Dymki przełączników i pusty BDOT10k

Dodano objaśnienia trzech checkboxów: opis funkcji, skutki zaznaczenia
i odznaczenia. Dymki są dostępne po najechaniu, fokusie oraz kliknięciu
przycisku informacji, również na telefonie; Escape zamyka dymek.
Checkboxy mają powiązany opis dla czytników ekranu. Treść wyjaśnia m.in.,
że gminna warstwa wymaga przybliżenia, a odcinki bez przypisanej ulicy
nie muszą być drogami bez oficjalnej nazwy.

Podczas diagnozy BDOT10k zwracał dla skali całej gminy puste odpowiedzi
HTTP 200 z typem image/png. Dla bliższej skali serwer zwrócił prawidłowy PNG.
Dodano OpenStreetMap jako warstwę zapasową pod podkładami Geoportalu oraz
komunikat o błędzie kafli wybranego podkładu. Układ i przybliżenie mapy
nie zmieniają się przy błędzie. Poprawna warstwa WMTS jest rysowana nad
OSM, dzięki czemu wybrany podkład pozostaje widoczny po pobraniu kafli.

Chromium sprawdza pusty kafel HTTP 200, wyświetlenie tła i komunikatu,
zmianę podkładu, dymki hover/fokus/Escape/kliknięcie i brak przepełnienia
na telefonie. Powtórzono kontrolę stałego paska i przełączników.
