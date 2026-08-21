# Eksporty z Dziennika Urzędowego Województwa Mazowieckiego

Tu trafiają pliki `.xlsx` pobrane z serwisu `edziennik.mazowieckie.pl`.

Serwis blokuje maszyny w centrach danych (Akamai Bot Manager), ale ma własny
eksport listy aktów, więc pobranie robi się ręcznie z przeglądarki:

1. Wejdź na `https://edziennik.mazowieckie.pl/publisher/<id>`
2. Kliknij **zieloną ikonę arkusza** nad tabelą, po prawej od pola „Filtruj hasła”
3. Zapisz plik do tego katalogu

Wydawcy dotyczący Wyszkowa (grupa „W” w `/publisher-group`):

| id | organ |
|---|---|
| 163 | Starosta Powiatu Wyszkowskiego |
| 1453, 1222, 282, 760, 448, 468, 246, 1018, 1121 | pozostałe warianty — nazwa czytana z pliku |

Potem:

```bash
npm run data:edziennik-xlsx   # XLSX -> data/raw/akty-edziennik.json
npm run db:seed               # wsad do bazy
```

Importer sam rozpoznaje kolumny po nagłówkach i odsiewa akty niedotyczące
dróg ani nazewnictwa, więc można wrzucać pełne eksporty bez filtrowania.
