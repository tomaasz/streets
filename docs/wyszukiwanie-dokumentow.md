# Wyszukiwanie i dołączanie dokumentów z internetu

W `/akty` wybierz **Znajdź w internecie**, gminę Wyszków, lata oraz temat.
Wyszukiwanie obejmuje dokumenty drogowe: uchwały, zarządzenia, rozporządzenia
i obwieszczenia. Opcjonalna fraza zawęża tytuł lub numer. Wyniki dotyczące
powiatu pokazują właściwy organ; nie każda pozycja powiatowa dotyczy wyłącznie
terenu gminy Wyszków.

## Źródła

- BIP gminy: przegląd archiwów według lat. Parser obsługuje stare wykazy sesji
  i osobne strony aktów. Dokumenty z odnośnikiem do pliku mają podgląd.
  Przy osobnej stronie rozpoznawane są również dodatkowe pliki dokumentu.
- Mazowiecki dziennik urzędowy: publiczne API używane przez jego witrynę.
  `/api/publisher` rozpoznaje warianty nazw organów Wyszkowa, a
  `/api/publisher/{id}` udostępnia akty. Wyniki zachowują datę, numer,
  pozycję publikacji, adres PDF i adres metadanych konkretnego aktu.
  Dla starszego wariantu serwisu pozostaje parser tabel HTML.
- Bieżący rejestr uchwał w BIP odsyła do eSesji Wyszkowa. Obecna integracja
  sprawdza dostępność i pokazuje odnośnik, ale nie parsuje tego rejestru.
  Akty ogłoszone w dzienniku można znaleźć przez API dziennika niezależnie
  od dostępności eSesji.

Dostęp z tej sieci bywa zmienny: HTTP 403, timeout albo inna struktura
odpowiedzi są raportowane oddzielnie od pustej listy wyników. Sprawdzenie
BIP ma limit 40 sekund i 180 stron, a API dziennika — 25 sekund.
Przerwane wyszukiwanie wyświetla wyniki częściowe. Żadne źródło nie jest
przedstawiane jako gwarancja kompletności dokumentacji.

Obecnie obsługiwana jest gmina Wyszków (TERYT 143505). Dodanie innej gminy
wymaga konfiguracji źródeł, ustalenia organów i sprawdzenia parsera jej BIP.
Samo dopisanie nazwy do selektora nie wystarczy.

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
środowiskiem). Testy parserów sprawdzają m.in. daty aktów przywołanych,
rozpoznawanie plików i odpowiedzi API. Testy pobierania obejmują odrzucanie
adresów spoza źródeł także po przekierowaniu i limit rozmiaru bez
`Content-Length`.

Limity pobierania: 15 MB na dokument, 2 MB na stronę publikacji, osiem sekund
na pojedyncze pobranie i 45 sekund na partię. Dokument musi mieć nagłówek
PDF, DOC lub DOCX; strona błędu pod adresem PDF nie trafia do kolejki jako
gotowy dokument. Zachowane HTML i JSON pobierane są jako załączniki;
tylko PDF jest wyświetlany w podglądzie.
