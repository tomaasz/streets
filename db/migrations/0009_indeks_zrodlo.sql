-- =====================================================================
-- Indeks na kolumnie filtrującej operacje wsadowe.
--
-- `DELETE FROM odcinek_drogi WHERE zrodlo = 'bdot10k'` (scripts/seed.mjs)
-- i `WHERE zrodlo = 'uchwala'` (scripts/import-uchwaly.mjs) filtrują po
-- kolumnie bez indeksu — migracja 0002 indeksuje ulica_id, droga_id,
-- kategoria, zarzadca_id, ale nie zrodlo. Przy dzisiejszej skali (kilka
-- tysięcy wierszy) niezauważalne; przy większej — sekwencyjny skan na
-- każdym cotygodniowym odświeżeniu.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_odcinek_zrodlo ON odcinek_drogi (zrodlo);
