-- =====================================================================
-- Naprawa indeksu wyszukiwania ulic.
--
-- Migracja 0002 zbudowała indeks trigramowy na bez_ogonkow(nazwa). Każde
-- faktyczne wyszukiwanie w aplikacji (src/lib/zapytania.ts, /api/eksport,
-- /api/mapa) filtruje po bez_ogonkow(nazwa_pelna) — kolumnie generowanej
-- jako `cecha || ' ' || nazwa`. To inne wyrażenie niż to, na którym stoi
-- indeks, więc planer nigdy go nie użył: każde wpisanie frazy w polu
-- „Szukaj ulicy" robiło pełny skan tabeli `ulica`.
--
-- Stary indeks zostaje skasowany, a nie zostawiony obok — dwa indeksy na
-- prawie tej samej treści tylko podwajają koszt zapisu bez żadnej korzyści,
-- bo nic w kodzie już nie filtruje po samej `nazwa` bez `cecha`.
-- =====================================================================

DROP INDEX IF EXISTS idx_ulica_szukaj;

CREATE INDEX IF NOT EXISTS idx_ulica_szukaj
  ON ulica USING gin (bez_ogonkow(nazwa_pelna) gin_trgm_ops);
