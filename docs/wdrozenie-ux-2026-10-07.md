# Wdrożenie rekomendacji UX — 7 października 2026

## Wyszukiwanie i kontekst

Lista i mapa mają wspólne wyszukiwanie nazwy lub numeru drogi oraz filtry
kategorii, miejscowości i zarządcy. Podpowiedzi można wybrać myszą lub
strzałkami i Enterem. Przełączenie widoku zachowuje filtry i wybrany odcinek.
Powrót z karty ulicy przywraca wyniki zamiast otwierać całą bazę.

Zmiana kategorii, miejscowości lub zarządcy automatycznie aktualizuje URL
oraz wyniki bez przeładowania strony. Tekst uruchamia wyszukiwanie po 450 ms
przerwy w pisaniu. Przycisk „Szukaj” pozwala przyspieszyć wyszukiwanie.
Każda lista opcji uwzględnia pozostałe filtry oraz zapytanie tekstowe;
liczniki pokazują liczbę pozycji dla danej opcji. Obecnie wybrana opcja
bez wyników pozostaje widoczna z licznikiem 0 i można ją wyczyścić.
Automatyczne filtrowanie działa także w kolejce weryfikacji i dokumentach.

Lista oraz podpowiedzi obejmują ulice PRG i odcinki bez przypisanej ulicy
potwierdzone relacją `akt_odcinek`. Droga gminna 440768W jest widoczna
w wynikach Kamieńczyka, również po wyborze kategorii gminnej, a kliknięcie
nazwy lub podpowiedzi otwiera jej szczegóły na mapie. Miejscowość pochodzi
z jawnego pola w sprawdzonym rejestrze `powiazania-odcinkow.json`,
zweryfikowanego względem miejscowości w bazie. Brak przypisania do PRG
nie ukrywa już tej drogi. Długość 641 m pozostaje długością geometrii;
563 m z uchwały jest opisana w uwagach odcinka.

Wyszukiwanie jest przed statystykami. Podsumowanie sieci jest rozwijane.
Lista jest dzielona na strony po 50 pozycji. Na telefonie wiersze mają układ
kart z nazwanymi polami. Eksport wyników zachowuje zakres filtrów; eksport
całej bazy jest osobną akcją w stopce.

## Mapa

Ustawienia podkładu i warstw są zwijane. Kontrolki mają obszary 44×44 px.
Szczegóły odcinka otwierają się w panelu bocznym na komputerze i w panelu
od dołu na telefonie. Panel pokazuje oddzielnie źródło przebiegu i podstawę
kategorii. Uwagi i rozbieżności są rozwijane, PDF jest bezpośrednio dostępny.

Lista odcinków pozwala wybrać rekord bez klikania cienkiej linii na mapie.
Ma paginację po 50 pozycji. Escape zamyka szczegóły i przywraca fokus.
Kontener mapy jest dostępny z klawiatury, a przyciski mają polskie etykiety.
Wybrany odcinek jest zapisywany w URL i odtwarzany po odświeżeniu.

Warstwa „Drogi bez przypisanej ulicy” dodaje niepowiązane odcinki BDOT10k.
Linia przerywana odróżnia niepotwierdzone drogi bez nazwy oraz samą oś ulicy
od odcinków powiązanych z dokumentem. Filtr miejscowości dla dodatkowych
odcinków obejmuje otoczenie zasięgu ulic tej miejscowości — jest pomocą
w szukaniu kandydatów, nie ustaleniem administracyjnej przynależności drogi.
Mapa i eksport używają wspólnych warunków SQL.

## Kolejka weryfikacji

„Uzupełnij dane” obejmuje wszystkie 503 ulice z problemami oraz 16 pozycji
uchwał bez dopasowania. Pozycje dokumentów są ustalane z aktualnych relacji
w bazie i tych samych reguł normalizacji nazw co importer; nie z kopii
jednorazowego raportu. Dostępne są filtry rodzaju pozycji, problemu,
miejscowości, statusu i tekstu oraz pełna paginacja.

Każda pozycja ma następny krok, możliwość porównania na mapie, a pozycje
uchwał — numer, załącznik/pozycję, opis i PDF. Formularz zapisuje status
„Do weryfikacji”, „W trakcie” lub „Wyjaśnione” oraz notatkę. „Wyjaśnione”
wymaga uzasadnienia. Jest to status pracy, a nie zmiana kategorii drogi,
zarządcy lub pewności informacji. Edycja dotyczy współdzielonej kolejki
wewnętrznej aplikacji; zapis jest dostępny jej użytkownikom.

Migracja `0010_weryfikacja.sql` dodaje wyłącznie tabelę `weryfikacja_rekordu`.
Klucze SIMC/SYM_UL oraz akt/załącznik/pozycja zachowują notatki po ponownym
seedzie. Migracja nie usuwa ani nie modyfikuje geometrii dróg.

## Propozycje i zatwierdzanie powiązań

Widok `/braki` domyślnie pokazuje propozycje dopasowania. Pozostałe grupy to:
uchwały bez powiązania, ulice bez powiązania z BDOT, brak dokumentów o
zarządcy, źródła do potwierdzenia oraz ronda i skwery. Licznik propozycji
jest przekrojem tych spraw, a nie dodatkową kategorią do sumowania.

Dopasowanie nazw uwzględnia tę samą miejscowość i rodzaj obiektu oraz
niewielką różnicę pisowni. Przebieg PRG bez odcinków porównywany jest
z nieprzypisanymi geometriami BDOT: odległość do 30 m i minimum 50%
długości odcinka w tym otoczeniu. Dla nienazwanych pozycji uchwał
aplikacja podaje do ośmiu kandydatów z otoczenia miejscowości, uporządkowanych
według zbliżonej długości. Te reguły tworzą propozycje; nie stanowią dowodu
identyczności drogi. Opis, długości i różnice są widoczne na karcie.

Użytkownik wybiera jeden lub kilka odcinków, porównuje je na mapie,
podaje podstawę zatwierdzenia i potwierdza sprawdzenie zakresu. Mapa
porównawcza może wyświetlać niezależny przebieg PRG jako linię przerywaną.
Zatwierdzenie geometrii wyłącznie przypisuje odcinek do ulicy. Zatwierdzenie
uchwały zapisuje relację `akt_odcinek`, kategorię gminną i Burmistrza
Wyszkowa jako zarządcę wybranych odcinków. Nie zmienia geometrii.

Migracja `0011_powiazania_zatwierdzone.sql` dodaje rejestr decyzji i ich
uzasadnień. Klucze naturalne ulic, skróty geometrii i treści źródłowej
pozwalają odtworzyć decyzje po zmianie identyfikatorów podczas importu.
Seed przywraca przypisania geometryczne, a importer uchwał także
zatwierdzenia prawne. Gdy geometria lub treść źródła ulegnie zmianie,
stare powiązanie nie jest stosowane. Zapis w aplikacji odbywa się w
transakcji; ponownie sprawdza źródło, propozycje, stan odcinków,
kategorię nadrzędną i nowsze podstawy prawne. Notatka nadal jest oddzielnym
zapisem organizującym pracę, bez modyfikowania danych drogi.

Test `node --env-file=.env scripts/test-powiazania.mjs` tworzy izolowaną
kopię schematu, sprawdza zapis i odtworzenie po zmianie identyfikatora,
idempotencję oraz blokady zmienionego PRG i kategorii nadrzędnej, po czym
usuwa schemat testowy. Testy przeglądarkowe na osobnej kopii danych sprawdziły
zatwierdzenie obu rodzajów powiązań, znikanie rozwiązanych spraw, historię,
blokadę danych zmienionych po wyświetleniu oraz widok telefonu. Pełny seed
i import uchwał na tej kopii potwierdziły zachowanie decyzji.

## Czytelność i dostępność

Aktywna nawigacja ma wyróżnienie i `aria-current`. Dodano link pomijający
nawigację oraz widoczne obramowanie fokusu. Kategorie zachowują kolor próbki
i obramowania, ale tekst korzysta z kontrastowego koloru podstawowego.
Oznaczenia pewności mają opis słowny zamiast samego ułamka.

Można wybrać motyw systemowy, jasny lub ciemny; wybór jest zapamiętywany.
Również kolory na mapie reagują na ręczną zmianę motywu. Komunikaty dla
użytkownika nie zawierają poleceń terminala ani instrukcji edycji skryptów.
Obecność dokumentu w bazie nie jest przedstawiana jako automatyczne
potwierdzenie kategorii dowolnego odcinka.

## Sprawdzenie

W Chromium sprawdzono podpowiedzi i wybór klawiaturą, zachowanie filtrów,
powrót z karty, wybór i odtworzenie odcinka, PDF, oba eksporty, warstwę
kandydatów, dostęp do ostatniej strony kolejki, zapis statusów i notatek,
walidację uzasadnienia, trwałość motywu, telefon, fokus oraz ponowienie
mapy po HTTP 500. Wpisy utworzone przez test zostały przywrócone do stanu
sprzed testu. Import uchwał na sucho nadal raportuje te same 16 pozycji.

Dla Kamieńczyka dodatkowa warstwa zwiększa liczbę geometrii z 85 do 479;
eksport GeoJSON ma dokładnie ten sam zakres. Wyszukiwarka na telefonie
znajduje się około 280 px od góry zamiast około 742 px.

Działający serwer należy zatrzymać przed zastąpieniem katalogu `.next`.
Przed kompilacją zachować poprzedni katalog do odtworzenia w razie błędu,
a po sukcesie uruchomić usługę `streets.service` i sprawdzić przeglądarkę.

## Wdrożenie na serwerze

Wersja została skompilowana i uruchomiona 7 października 2026 o 13:04 CEST
na porcie 3000. Poprzedni katalog kompilacji zachowano poza aplikacją.
Kontrola typów i `git diff --check` zakończyły się bez błędów.
Po wdrożeniu powtórzono scenariusze Chromium na porcie 3000, w tym dokładny
URL Kamieńczyka z pustymi parametrami, automatyczną zmianę miejscowości
i kategorii, kontekstowe opcje i liczniki, zachowanie tekstu i fokusu,
znalezienie 440768W oraz otwarcie odcinka i uchwały z listy i podpowiedzi.
Wszystkie scenariusze zakończyły się powodzeniem bez błędów JavaScript.

## Kompaktowy układ po korekcie użytkownika

Przywrócono stale widoczne cztery liczby podsumowania sieci. Szczegółowa
tabela kategorii pozostaje rozwijana. Na komputerze wyszukiwanie i trzy
filtry mieszczą się w jednym wierszu, a szerokość treści zwiększono do
1440 px. Panel wyszukiwania ma około 141 px wysokości, zwykły wiersz
tabeli 41 px. Zmniejszono odstępy nawigacji, tabel i paginacji. Na telefonie
kontrolki zachowują co najmniej 44 px; liczby podsumowania tworzą układ
2×2. Sprawdzono szerokości 1920, 900 i 390 px bez przepełnienia.

Po wdrożeniu sprawdzono działającą wersję na porcie 3000: podsumowanie,
kompaktowe wyszukiwanie, dynamiczne filtry, mapę porównawczą z geometrią
PRG, propozycje dla Deskurów–Tumanek–Fidest, osobne grupy dokumentów oraz
obiektów. Aplikacja znalazła propozycje dla 20 z 519 spraw. Decyzje testowe
wykonano wyłącznie na izolowanych schematach, które usunięto po testach;
produkcja nie ma testowych zatwierdzeń. Testy istniejących funkcji mapy,
eksportu, statusów pracy i motywu również przeszły.

## Wyszukiwanie nad kolumnami i sortowanie

Wyszukiwanie przeniesiono pod pełne podsumowanie kategorii. Na szerokim
ekranie pola nazwy/numeru, miejscowości, kategorii i zarządcy używają
tych samych szerokości co odpowiednie kolumny wyników. Wszystkie siedem
nagłówków przełącza sortowanie rosnące/malejące z oznaczeniem `aria-sort`.
Sortowanie wykonywane jest w SQL przed paginacją, nazwa pola i kierunek
są ograniczone do listy dozwolonych wartości. Długość i numer drogi
sortowane są liczbowo; gdy ulica ma kilka numerów, decyduje pierwszy
numer w wyświetlanym zestawie. Brakujące wartości trafiają na koniec.
URL, paginacja oraz zmiany filtrów zachowują porządek. Na telefonie
nagłówki są dostępnymi przyciskami nad kartami wyników.

## Aktualne wyszukiwanie UUG po braku wyników

Dotychczasowy import PRG już korzystał z UUG i źródło `prg` wskazuje
https://services.gugik.gov.pl/uug/. Dodano wyszukiwanie online po braku
lokalnych wyników: osobny panel listy, podpowiedzi oraz przebieg na mapie.
Wymagana jest wybrana miejscowość gminy Wyszków, nazwa o długości 3–100
znaków i brak filtrów kategorii/zarządcy. Numery dróg pozostają obsługiwane
lokalnie. Wyniki z UUG nie są automatycznie zapisywane w bazie ani wliczane
do podsumowania sieci. Nie przypisuje się im kategorii ani zarządcy.

Odpowiedź musi zawierać ulicę z TERC 143505 i SIMC wybranej miejscowości,
identyfikator ULIC oraz geometrię liniową w EPSG:4326. Zapytania mają limit
5 sekund, współdzielą równoległe pobieranie i pamięć wyników do godziny.
Błąd usługi jest odróżniany od braku wyników i nie jest zapamiętywany;
odpowiedzi mapy korzystające z UUG nie są buforowane przez CDN.

Sprawdzono żywe odpowiedzi: Jadowska w Kamieńczyku zwraca ULIC 07011,
a Mostowa nie zwraca wpisu. Napis Mostowa na podkładzie OpenStreetMap
nie jest wynikiem wyszukiwania UUG i nie potwierdza wpisu w PRG.
`node scripts/test-uug.mjs` sprawdza zakres identyfikatorów i geometrii
oraz duplikaty. Chromium sprawdza komunikat dla Mostowej na liście i mapie,
a symulowany nowy wpis — przejście na mapę, źródło i wybór po odświeżeniu.

Wersję skompilowano i wdrożono do `streets.service` na porcie 3000.
Po wdrożeniu powtórzono scenariusze UUG i kontrolę wyrównania filtrów,
sortowania oraz widoku mobilnego. Testy zakończyły się powodzeniem bez
błędów JavaScript. Podpowiedzi UUG mają ten sam limit sześciu pozycji co
lokalne; licznik pokazuje pełną liczbę znalezionych ulic.

## Nazwy bez potwierdzenia z OSM i zgłoszeń Targeo

Dodano oddzielne wyniki nazw pomocniczych. Etykieta „nazwa bez potwierdzenia”
dotyczy nadania nazwy, niezależnie od kategorii samej drogi. Brak dokumentu
w aplikacji nie przesądza, że nazwa jest nieoficjalna. Takie wyniki nie
otrzymują identyfikatorów TERYT, kategorii lub zarządcy i nie zwiększają
statystyk urzędowej sieci.

Po braku wyników lokalnych i UUG aplikacja sprawdza nazwane drogi OSM.
Zakres pobrania ustala znana miejscowość w bazie; przynależność wyniku jest
przybliżeniem na podstawie najbliższej osi PRG (do 1500 m), nie potwierdzeniem
granicy miejscowości. Drogi z nazwami już w lokalnym PRG są pomijane.
Obsługiwane są jedynie kompletne geometrie z węzłów OSM. Pamięć obszaru
trwa do 24 godzin, pobranie ma limit 10 sekund. OSM API /map wykorzystano
zamiast niedostępnych podczas wdrożenia instancji Overpass. Wyniki mają
etykietę w podpowiedzi, panelu i szczegółach, bursztynową linię przerywaną,
link do obiektu oraz atrybucję © OpenStreetMap contributors / ODbL.

Mostowa z przekazanego wyniku Targeo jest zapisana jako pomocnicze zgłoszenie
w `db/seed/nazwy-dodatkowe.json`, ze źródłem, datą i opisem. Nie pobieramy
geometrii Targeo. Punkt z odnośnika leży około 6 m od odcinka BDOT10k
nr 440768W, a przebieg widoczny na zrzucie jest zgodny z jego położeniem.
Przycisk porównania pokazuje ten odcinek z zastrzeżeniem, że powiązanie nazwy
jest kandydatem do weryfikacji. Uchwała potwierdzająca drogę nie jest
przedstawiana jako dokument nadający nazwę Mostowa. Samej Mostowej nie
znaleziono w aktualnym pobraniu obiektów OSM z okolic Kamieńczyka.

Sprawdzono walidację danych OSM (`node scripts/test-osm.mjs`), żywy wynik
„Pozioma” z OSM, wyszukiwanie Mostowej/Targeo, podpowiedzi, porównanie
440768W, odświeżenie mapy, wygląd na telefonie i kontrast etykiety w ciemnym
motywie. Dokumentacja źródeł dostępna jest również na `/zrodla`.

Po kompilacji i restarcie `streets.service` powtórzono testy na porcie 3000:
Mostowa z Targeo, porównanie 440768W i odświeżenie, żywy wynik OSM,
oznaczenia źródeł i statusu, telefon oraz ciemny motyw. Kontrola wyrównania
filtrów i sortowania również przeszła. Brak błędów JavaScript w scenariuszach.

## Targeo w panelu mapy

Do „Warstwy i podkład”, poniżej czterech podkładów, dodano „Targeo — otwórz
ten obszar ↗”. To odnośnik do oddzielnej mapy, nie warstwa WMTS. Oficjalny
kreator https://mapa.targeo.pl/kreator/ udostępnia osobne mapy do osadzania;
nie znaleziono publicznej usługi podkładu dla używanej konfiguracji OpenLayers.
Środek bieżącego widoku przeliczany jest z EPSG:2180 na WGS84, zbliżenie jest
przybliżone. Odnośnik aktualizuje się po przesunięciu lub zmianie skali mapy
i otwiera nową kartę. Przycisk ma co najmniej 44 px wysokości również na
komputerze. Sprawdzono współrzędne, nawigację, przesunięcie klawiaturą,
zmianę skali i podkładu oraz widok mobilny.

Przy okazji sprawdzono e-mapę Wyszkowa: źródło `portal-gminy` figuruje
w słowniku, ale nie ma przypisanych ulic ani odcinków i nie jest obsługiwane
przez importer. Dodanie rzeczywistego importu EMUiA wymaga zidentyfikowania
gminnej warstwy/usługi i sprawdzenia jej identyfikatorów i aktualności.
