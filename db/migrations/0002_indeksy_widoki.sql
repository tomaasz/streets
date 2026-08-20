-- =====================================================================
-- Indeksy, wyszukiwanie pełnotekstowe i widoki raportowe
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_ulica_miejscowosc ON ulica (miejscowosc);
CREATE INDEX IF NOT EXISTS idx_ulica_nazwa       ON ulica (nazwa);
CREATE INDEX IF NOT EXISTS idx_odcinek_ulica     ON odcinek_drogi (ulica_id);
CREATE INDEX IF NOT EXISTS idx_odcinek_droga     ON odcinek_drogi (droga_id);
CREATE INDEX IF NOT EXISTS idx_odcinek_kategoria ON odcinek_drogi (kategoria);
CREATE INDEX IF NOT EXISTS idx_odcinek_zarzadca  ON odcinek_drogi (zarzadca_id);

-- Wyszukiwarka: unaccent + trigram, żeby "kosciuszki" znajdowało
-- "Tadeusza Kościuszki".
CREATE EXTENSION IF NOT EXISTS pg_trgm  SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- unaccent() jest STABLE, więc nie wchodzi wprost do indeksu — opakowujemy.
CREATE OR REPLACE FUNCTION bez_ogonkow(txt text)
  RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT lower(public.unaccent('public.unaccent', COALESCE(txt, ''))) $$;

CREATE INDEX IF NOT EXISTS idx_ulica_szukaj
  ON ulica USING gin (bez_ogonkow(nazwa) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Widok główny: ulica + zagregowani zarządcy jej odcinków.
-- Ulica z dwoma zarządcami ma tu dwa wpisy w tablicy — to jest ten
-- przypadek, który psuje płaski model "jedna ulica = jeden zarządca".
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ulica_zarzadcy AS
SELECT
  u.id,
  u.slug,
  u.simc,
  u.sym_ul,
  u.miejscowosc,
  u.cecha,
  u.nazwa,
  u.nazwa_pelna,
  u.dlugosc_m,
  u.geom,
  COUNT(o.id)                                            AS liczba_odcinkow,
  COALESCE(
    ARRAY_AGG(DISTINCT o.kategoria::text)
      FILTER (WHERE o.id IS NOT NULL), '{}')              AS kategorie,
  COALESCE(
    ARRAY_AGG(DISTINCT z.nazwa)
      FILTER (WHERE z.id IS NOT NULL), '{}')              AS zarzadcy,
  COALESCE(
    ARRAY_AGG(DISTINCT z.kod)
      FILTER (WHERE z.id IS NOT NULL), '{}')              AS zarzadcy_kody,
  COALESCE(
    ARRAY_AGG(DISTINCT u2.nazwa)
      FILTER (WHERE u2.id IS NOT NULL), '{}')             AS utrzymujacy,
  COALESCE(
    ARRAY_AGG(DISTINCT o.nr_drogi)
      FILTER (WHERE o.nr_drogi IS NOT NULL), '{}')        AS numery_drog,
  MIN(o.pewnosc)                                         AS pewnosc_min,
  BOOL_OR(o.kategoria = 'nieustalona')                   AS ma_luke,
  COUNT(o.id) > 1
    AND COUNT(DISTINCT o.zarzadca_id) > 1                AS wielu_zarzadcow
FROM ulica u
LEFT JOIN odcinek_drogi o ON o.ulica_id = u.id
LEFT JOIN zarzadca z       ON z.id = o.zarzadca_id
LEFT JOIN zarzadca u2      ON u2.id = o.utrzymujacy_id
GROUP BY u.id;

-- ---------------------------------------------------------------------
-- Raport kompletności — lista roboty do domknięcia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_braki AS
SELECT
  u.id,
  u.slug,
  u.miejscowosc,
  u.nazwa_pelna,
  u.dlugosc_m,
  CASE
    WHEN COUNT(o.id) = 0                                    THEN 'brak odcinków'
    WHEN BOOL_OR(o.kategoria = 'nieustalona')               THEN 'nieustalona kategoria'
    WHEN BOOL_OR(o.zarzadca_id IS NULL)                     THEN 'brak zarządcy'
    WHEN MIN(o.pewnosc) = 1                                 THEN 'do weryfikacji (import maszynowy)'
  END AS problem,
  -- waga sortuje robotę: najpierw dziury, na końcu masowa weryfikacja
  CASE
    WHEN COUNT(o.id) = 0                                    THEN 1
    WHEN BOOL_OR(o.kategoria = 'nieustalona')               THEN 2
    WHEN BOOL_OR(o.zarzadca_id IS NULL)                     THEN 3
    ELSE                                                         4
  END AS waga
FROM ulica u
LEFT JOIN odcinek_drogi o ON o.ulica_id = u.id
GROUP BY u.id
HAVING COUNT(o.id) = 0
    OR BOOL_OR(o.kategoria = 'nieustalona')
    OR BOOL_OR(o.zarzadca_id IS NULL)
    OR MIN(o.pewnosc) = 1;

-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_statystyki_kategorii AS
SELECT
  o.kategoria::text            AS kategoria,
  z.nazwa                      AS zarzadca,
  COUNT(*)                     AS liczba_odcinkow,
  COUNT(DISTINCT o.ulica_id)   AS liczba_ulic,
  SUM(o.dlugosc_m)             AS dlugosc_m
FROM odcinek_drogi o
LEFT JOIN zarzadca z ON z.id = o.zarzadca_id
GROUP BY o.kategoria, z.nazwa
ORDER BY o.kategoria, z.nazwa;
