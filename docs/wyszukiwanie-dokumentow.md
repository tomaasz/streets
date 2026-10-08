# Wyszukiwanie i dołączanie dokumentów z internetu

W `/akty` wybierz **Znajdź w internecie**, województwo, gminę, lata oraz temat.
Katalog obejmuje 2479 gmin z oficjalnego pliku TERC GUS z 8 października 2026.
Miasto, gmina wiejska i gmina miejsko-wiejska są odrębnymi pozycjami;
miasta i obszary wiejskie będące częściami gmin nie tworzą dodatkowych wpisów.
Wyszukiwanie obejmuje dokumenty drogowe: uchwały, zarządzenia, rozporządzenia
i obwieszczenia. Opcjonalna fraza zawęża tytuł lub numer. Dla Wyszkowa uwzględniamy również
organy powiatu; nie każda pozycja powiatowa dotyczy wyłącznie terenu gminy.
Dla pozostałych gmin wyszukiwanie obejmuje rozpoznane organy gminne.

Filtr tematu rozpoznaje całe wyrazy i odmiany nazw dróg, ulic, rond, skwerów
i placów. Nie uznaje „placówek oświatowych” za place ani samego zwrotu
„w drodze” za temat drogowy. Dopasowanie dotyczy tytułu; treść dokumentu
nadal wymaga sprawdzenia przed przetworzeniem.

Wyniki można przełączać między kartami a **Kompaktową listą**. Przełączenie
zachowuje zaznaczone dokumenty, a wybrany układ jest zapamiętywany
w przeglądarce. Oba widoki udostępniają publikację źródłową i podgląd pliku.

## Źródła

- BIP Wyszkowa: przegląd archiwów według lat. Parser obsługuje stare wykazy sesji
  i osobne strony aktów. Dokumenty z odnośnikiem do pliku mają podgląd.
  Przy osobnej stronie rozpoznawane są również dodatkowe pliki dokumentu.
- Dzienniki urzędowe wszystkich 16 województw: publiczne API używane przez
  oficjalne witryny. Konfiguracja domen jest w
  `scripts/lib/dzienniki-wojewodzkie.mjs`. `/api/publisher` udostępnia katalog
  wydawców, a `/api/publisher/{id}` — akty wybranego organu. Wyniki zachowują datę, numer,
  pozycję publikacji, adres PDF i adres metadanych konkretnego aktu.
  Dla starszego wariantu mazowieckiego archiwum Wyszkowa pozostaje parser tabel HTML.
- Bieżący rejestr uchwał w BIP odsyła do eSesji Wyszkowa. Obecna integracja
  sprawdza dostępność i pokazuje odnośnik, ale nie parsuje tego rejestru.
  Akty ogłoszone w dzienniku można znaleźć przez API dziennika niezależnie
  od dostępności eSesji.

Dostęp z tej sieci bywa zmienny: HTTP 403, timeout albo inna struktura
odpowiedzi są raportowane oddzielnie od pustej listy wyników. Sprawdzenie
BIP ma limit 40 sekund i 180 stron, a API dziennika — 25 sekund.
Przerwane wyszukiwanie wyświetla wyniki częściowe. Żadne źródło nie jest
przedstawiane jako gwarancja kompletności dokumentacji.

Przed wyszukiwaniem aplikacja pokazuje rozpoznane **Organy wydające**.
Wszystkie są początkowo zaznaczone; można ograniczyć zakres do wybranych.
Serwer niezależnie sprawdza, czy ich identyfikatory należą do katalogu
rozpoznanego dla wybranej gminy. Katalog dziennika jest pamiętany przez
10 minut; błędy nie są zapamiętywane.

Dzienniki nie podają kodów TERYT wydawców. Dopasowanie uwzględnia nazwę
organu, siedzibę i rodzaj gminy. Dla gmin o tej samej nazwie i rodzaju
w kilku powiatach jednego województwa aplikacja zgłasza niejednoznaczność
oraz udostępnia rejestr źródłowy. Brak rozpoznanych organów i niedostępność
źródła są zgłaszane osobno; obecność gminy w katalogu GUS nie gwarantuje
odczytu jej dokumentów. Nie odczytujemy BIP wszystkich gmin.

Trzy dzienniki (lubuski, łódzki, małopolski) nie przesyłają pełnego łańcucha
certyfikatów HTTPS. Dla tych konkretnych domen klient `undici` uzupełnia
certyfikaty pośrednie z repozytorium Certum, zachowując sprawdzanie
certyfikatu i nazwy hosta. Publiczne certyfikaty są w
`scripts/lib/certyfikaty-dziennikow.mjs`; ich podpisy sprawdzono przez
`openssl verify` względem zaufanych certyfikatów systemu. Źródła:

- https://homepldvtlsg2r35ca.repository.certum.pl/homepldvtlsg2r35ca.cer
- https://certumdvtlsg2r39ca.repository.certum.pl/certumdvtlsg2r39ca.cer

Katalog GUS można odświeżyć bez dodatkowych bibliotek:

```bash
python3 scripts/aktualizuj-gminy.py
```

Skrypt zachowuje adres źródła i datę pobranego pliku, sprawdza unikalność
kodów i liczbę gmin przed zapisaniem `data/gminy-teryt.json`.

## Dołączanie do kolejki

Zaznacz maksymalnie pięć pozycji i wybierz **Dołącz do przetworzenia**.
Serwer odczytuje metadane z zachowanych wyników wyszukiwania, nie z danych
przesłanych przez przeglądarkę. Wyniki pozostają dostępne przez siedem dni.

Kolejka i pliki są przechowywane w PostgreSQL, w tabelach migracji
`0012_dokumenty_internet.sql`. Oryginalne bajty, adres źródłowy, czas pobrania
i SHA-256 pozwalają przetwarzać zachowaną kopię także po zmianie publikacji.
Pobieramy stronę publikacji, plik główny, rozpoznane dodatkowe pliki oraz
metadane API, jeśli źródło je udostępnia. Nie oznacza to rozpoznania wszystkich
możliwych załączników ani odczytu treści dokumentu.

Statusy:

- **Do przetworzenia** — rozpoznane pliki zostały pobrane.
- **Niepełne pobranie** — szczegóły błędu i przycisk ponowienia w kolejce;
  udane pobrania pozostają zachowane.
- **Publikacja bez pliku** — zachowano stronę, ale nie rozpoznano adresu pliku.
- **Przetworzony** — status przewidziany dla następnego etapu.

Duplikaty sprawdzane są po gminie, rodzaju, organie i numerze aktu.
Powtórne dołączenie gotowego dokumentu nie tworzy nowej pozycji. Wpis aktu
istniejący w `akt_prawny` nie blokuje pobrania pliku do kolejki — etykieta
informuje, że opis dokumentu już jest w aplikacji.

Dołączanie nie uruchamia ekstrakcji PDF/OCR i nie zmienia `akt_prawny`,
kategorii, zarządców ani relacji dróg. Przetwarzanie treści i zatwierdzanie
powiązań stanowią kolejny etap.

## Uruchomienie i sprawdzenie

```bash
node --env-file=.env scripts/migrate.mjs
npm test
npm run typecheck
npm run build
node --env-file=.env scripts/test-powiazania.mjs
```

Testy jednostkowe nie wymagają bazy. Test powiązań wymaga skonfigurowanego
połączenia i uruchamia się osobno (`npm run test:powiazania` z odpowiednim
środowiskiem). Testy przypisania organów sprawdzają m.in. rozdzielenie gmin miejskich
i wiejskich, błędne siedziby oraz niejednoznaczność powiatów. Testy
parserów sprawdzają m.in. daty aktów przywołanych,
rozpoznawanie plików i odpowiedzi API. Testy pobierania obejmują odrzucanie
adresów spoza źródeł także po przekierowaniu i limit rozmiaru bez
`Content-Length`.

Limity pobierania: 15 MB na dokument, 2 MB na stronę publikacji, osiem sekund
na pojedyncze pobranie i 45 sekund na partię. Dokument musi mieć nagłówek
PDF, DOC lub DOCX; strona błędu pod adresem PDF nie trafia do kolejki jako
gotowy dokument. Zachowane HTML i JSON pobierane są jako załączniki;
tylko PDF jest wyświetlany w podglądzie.

8 października 2026 sprawdzono na żywo katalogi wydawców we wszystkich
16 województwach oraz przykładowe dokumenty drogowe, PDF i metadane
w każdym dzienniku. To weryfikacja integracji źródeł, a nie kompletności
archiwów wszystkich gmin.
