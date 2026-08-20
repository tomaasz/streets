# Model danych

```
zrodlo_danych ──┐
                ├─< odcinek_drogi >── ulica        (PRG / TERYT)
zarzadca ───────┤          │
                └──────────┴───────── droga        (rejestr numerowanych dróg)
```

## `ulica`

Obiekt adresowy z PRG. Klucz naturalny to para `(simc, sym_ul)` — sam `SYM_UL`
powtarza się między miejscowościami. `slug` służy do adresów URL,
`nazwa_pelna` jest kolumną generowaną (`cecha || ' ' || nazwa`).

Geometria leży w `jsonb` jako GeoJSON w EPSG:4326. Wybór świadomy: dzięki temu
baza działa na dowolnym darmowym Postgresie, bez PostGIS. Migracja
`0003_postgis_opcjonalnie.sql` dokłada obok kolumnę `geometry` i indeksy GiST
tam, gdzie rozszerzenie jest dostępne.

## `odcinek_drogi`

Serce modelu. Jeden wiersz = spójny kawałek drogi o jednej kategorii i jednym
zarządcy.

| Kolumna | Po co |
|---|---|
| `ulica_id` | ulica, po której odcinek biegnie; `NULL` dla dróg bez nazwy |
| `droga_id` | numerowana droga publiczna, jeśli odcinek do niej należy |
| `kategoria` | `krajowa` / `wojewodzka` / `powiatowa` / `gminna` / `wewnetrzna` / `nieustalona` |
| `zarzadca_id` | zarządca formalny (art. 19 udp) |
| `utrzymujacy_id` | podmiot faktycznie utrzymujący — porozumienie z art. 19 ust. 4 |
| `wlasciciel`, `dzialki` | dla dróg wewnętrznych: kto i na czym (art. 8 ust. 2) |
| `zrodlo`, `pewnosc` | skąd rekord i ile mu ufamy |
| `podstawa_prawna` | numer uchwały albo rozporządzenia |

`ulica_id` i `droga_id` mogą być puste jednocześnie i to jest stan poprawny:
większość sieci w gminie to drogi polne, leśne i dojazdy do pól — bez nazwy
ulicy i bez numeru, a nadal z konkretnym właścicielem po stronie EGiB.
Tożsamością odcinka jest jego geometria, nie przypisanie do ulicy.

## `droga`

Rejestr numerowanych dróg publicznych przechodzących przez gminę: `S8`, `62`,
`618`, `4403W`, `440501W`… Osobna tabela, bo jedna droga przechodzi przez wiele
ulic, a pytania „którędy biegnie DW 618" i „kto zarządza ulicą Pułtuską" to dwa
różne pytania.

## `zarzadca`

Słownik. `typ` odpowiada kategorii drogi, `podstawa_prawna` cytuje przepis, na
podstawie którego dany podmiot jest zarządcą. Dane teleadresowe są tu, a nie
przy odcinku — inaczej aktualizacja numeru telefonu wymagałaby UPDATE na
tysiącach wierszy.

## Widoki

| Widok | Do czego |
|---|---|
| `v_ulica_zarzadcy` | ulica + zagregowane kategorie, zarządcy, numery dróg; flaga `wielu_zarzadcow` |
| `v_braki` | lista rekordów do domknięcia, z powodem |
| `v_statystyki_kategorii` | kilometry i liczby wg kategorii i zarządcy |

## Wyszukiwanie

`bez_ogonkow()` to `IMMUTABLE`-owy wrapper na `unaccent()` — bez niego funkcja
jest `STABLE` i nie wejdzie do indeksu. Na jej wyniku stoi indeks GIN
`gin_trgm_ops`, dzięki czemu `kosciuszki` znajduje `Tadeusza Kościuszki`.

## Typowe zapytania

```sql
-- Kto zarządza ulicą Pułtuską?
SELECT o.kategoria, o.nr_drogi, z.nazwa, o.dlugosc_m, o.pewnosc
  FROM ulica u
  JOIN odcinek_drogi o ON o.ulica_id = u.id
  LEFT JOIN zarzadca z ON z.id = o.zarzadca_id
 WHERE u.slug = 'wyszkow-pultuska';

-- Ulice podzielone między dwóch zarządców
SELECT nazwa_pelna, miejscowosc, zarzadcy
  FROM v_ulica_zarzadcy
 WHERE wielu_zarzadcow
 ORDER BY dlugosc_m DESC;

-- Ile kilometrów utrzymuje gmina
SELECT SUM(dlugosc_m) / 1000.0 AS km
  FROM odcinek_drogi o
  JOIN zarzadca z ON z.id = o.zarzadca_id
 WHERE z.kod = 'burmistrz-wyszkowa';
```
