# Wspólny UI — integracja streets (14.10.2026)

Źródło: `/home/serwis/apps/wspolny_ui`, wersja 0.10.1, granat `#1A334B`.
Kopie CSS, JS, herbu i szablonów są zarządzane przez `sync.py` ze źródła.
Nie edytuj ręcznie zarządzanych kopii; lokalne dopasowania są w plikach aplikacji.

```bash
cd /home/serwis/apps/wspolny_ui
python3 sync.py --app streets --check
python3 sync.py --app streets --dry-run
python3 sync.py --app streets
```

Sprawdzenie obejmuje szablony, moduł Django lub komponent Next oraz manifest
SHA-256 i wersję. Brakujące pliki również zwracają kod błędu. Przed nadpisaniem
skrypt wykonuje kopię w `.sync-backups/`; `--backup-dir` zmienia jej lokalizację.
Lokalna konfiguracja i logika aplikacji nie są synchronizowane.

`layout.tsx` używa `UiAppBar` i `UiFooter`, nawigacja używa `UiTabs`,
a podsumowanie dróg `UiKpi`. Lokalne tokeny kontrolek mają prefiks `--streets-*`.
Powierzchnie i tekst używają wspólnych tokenów; kolory kategorii dróg pozostały
lokalne. Mapa obserwuje `data-ui-theme`. `public/streets-ui.js` zachowuje dawny
wybór z `drogi-motyw`, jeśli użytkownik nie wybrał jeszcze wspólnego motywu.
Pomoc jest pod `/pomoc`.

Aktualna kompilacja: `.next-ui-0-10-0`; ustawienie usługi:
`/etc/systemd/system/streets.service.d/wspolny-ui.conf`.
Dla następnej aktualizacji kompiluj do nowego katalogu przez `STREETS_BUILD_DIR`,
sprawdź typy, testy i widoki, potem zmień wartość w usłudze i zrestartuj ją.
Poprzednia kompilacja `.next-licencje` pozostała dostępna do wycofania zmiany.

## Podpowiedzi (15.10.2026)

`PrzelacznikMapy` korzysta z `data-ui-tooltip-ref` i przycisku
`data-ui-tooltip-trigger`, bez lokalnego stanu hover i własnego `.mapa-dymek`.
Treść opisowa pozostaje dostępna dla czytników ekranu także przy checkboxie.
Wygląd i zachowanie zapewniają wspólne `ui.css` i `ui.js` (0.10.1).
Kompilacja `.next-ui-0-10-0` przeszła Next build i kontrolę typów; widok mapy
sprawdzono w Chromium na komputerze oraz telefonie z dotykiem.
Poprzednia `.next-wspolny-ui` pozostaje dostępna do wycofania zmiany.

## Centrum pomocy (16.10.2026, UI 0.11.2)

`/pomoc` używa `UiHelp` i zawiera siedem rozdziałów. Synchronizacja kopiuje
również `src/components/UiHelpInit.tsx`. Ten komponent kliencki uruchamia
wspólny skrypt po hydracji oraz usuwa listenery przy opuszczeniu strony;
nie należy inicjalizować poradnika przed hydracją React.

Aktualna kompilacja: `.next-ui-pomoc-0-11-2-20261016`. Przełączenie nastąpiło
po udanej kompilacji do osobnego katalogu i kontroli wejścia bezpośredniego
oraz powrotu z `/braki` przez router. Poprzednia kompilacja
`.next-ui-favicony-20261015` pozostaje dostępna do wycofania.
Zasoby w `layout.tsx` mają parametr `?v=0.11.2`.
