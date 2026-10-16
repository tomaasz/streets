# Spójne rozmiary kontrolek — 9 października 2026

Wdrożono zalecenia audytu w wyszukiwarce listy ulic i mapy oraz w stałym pasku opcji mapy.

- Wysokość bazowa 36 px; pola i sąsiadujące przyciski mają taką samą wysokość.
- Tekst 14 px / 20 px, padding 4 px / 8 px, promień 6 px, odstęp etykieta–pole 4 px i odstępy kontrolek 8 px.
- Przełączniki mapy: checkbox 16 px i etykieta o wysokości 36 px; przycisk informacji 32 × 36 px.
- Przy szerokości do 640 px lub dowolnym wskaźniku dotykowym (`any-pointer: coarse`): kontrolki minimum 44 px, checkbox 20 px; wybór motywu minimum 44 px.
- Przyciski powiększania i pełnego ekranu na mapie zachowują 44 × 44 px.
- Tokeny `--streets-*` zdefiniowano w `src/app/globals.css`; układ kolumn filtrów i tabeli zachowano.

Sprawdzenie na działającej wersji produkcyjnej: build z TypeScript, Chromium w szerokościach 1920, 900 i 390 px oraz dotykowy ekran 1280 px; wysokości kontrolek, brak poziomego przepełnienia, ciemny motyw, położenie i funkcje paska mapy, dymki hover/fokus/Escape/dotyk, podkład zapasowy przy pustych kaflach BDOT, wyrównanie filtrów z tabelą, sortowanie i zachowanie parametrów przy paginacji. Wszystkie kontrole przeszły. Pasek nad mapą na desktopie: 95 px.
