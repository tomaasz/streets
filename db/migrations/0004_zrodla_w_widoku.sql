-- =====================================================================
-- Źródło pochodzenia widoczne wprost przy każdej ulicy.
-- Bez tego wszystkie wiersze w tabeli wyglądają jednakowo wiarygodnie,
-- a rekord z importu BDOT10k i rekord potwierdzony uchwałą to dwie
-- różne rzeczy.
-- =====================================================================

-- Krótka etykieta do wyświetlania w wąskiej kolumnie.
ALTER TABLE zrodlo_danych ADD COLUMN IF NOT EXISTS skrot text;

UPDATE zrodlo_danych SET skrot = COALESCE(skrot, kod) WHERE skrot IS NULL;

-- Widok dostaje listę źródeł odcinków danej ulicy. CREATE OR REPLACE nie
-- pozwala dokładać kolumn w środku listy, więc przebudowujemy go w całości.
DROP VIEW IF EXISTS v_ulica_zarzadcy;

CREATE VIEW v_ulica_zarzadcy AS
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
  -- źródła odcinków; gdy ulica nie ma odcinków, zostaje źródło samej ulicy
  COALESCE(
    ARRAY_AGG(DISTINCT o.zrodlo)
      FILTER (WHERE o.zrodlo IS NOT NULL),
    ARRAY[u.zrodlo]::text[], '{}')                        AS zrodla,
  MIN(o.pewnosc)                                         AS pewnosc_min,
  BOOL_OR(o.kategoria = 'nieustalona')                   AS ma_luke,
  COUNT(o.id) > 1
    AND COUNT(DISTINCT o.zarzadca_id) > 1                AS wielu_zarzadcow
FROM ulica u
LEFT JOIN odcinek_drogi o ON o.ulica_id = u.id
LEFT JOIN zarzadca z       ON z.id = o.zarzadca_id
LEFT JOIN zarzadca u2      ON u2.id = o.utrzymujacy_id
GROUP BY u.id;
