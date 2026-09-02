-- =====================================================================
-- PostGIS — wymagane, nie opcjonalne.
--
-- Do audytu 2026-09 ta migracja była pomijana domyślnie (`--postgis`
-- odblokowywał ją), żeby baza działała na dowolnym darmowym Postgresie
-- bez rozszerzenia. W praktyce jedyni dwaj darmowi dostawcy wymienieni
-- w docs/wdrozenie.md — Neon i Supabase — oba mają PostGIS, więc ta
-- ostrożność miała koszt bez odpowiadającej mu korzyści: aplikacja liczyła
-- upraszczanie geometrii (Douglasa–Peuckera) w JavaScripcie przy każdym
-- zapytaniu do /api/mapa, zamiast raz, w bazie, z indeksem przestrzennym
-- już dostępnym.
--
-- `geom_pg` jest kolumną GENEROWANĄ, nie backfillowaną jednorazowym
-- UPDATE-em: funkcje ST_GeomFromGeoJSON/ST_SetSRID/ST_Multi są IMMUTABLE,
-- więc Postgres liczy ją automatycznie przy każdym INSERT/UPDATE wiersza.
-- Backfill jednorazowym UPDATE-em (poprzednia wersja tej migracji) zostawał
-- w tyle o cały tydzień — cotygodniowe odświeżenie (deploy/odswiezenie.sh)
-- nie uruchamia migracji, tylko db:seed, więc świeżo wstawione wiersze
-- miałyby geom_pg puste aż do następnego ręcznego przebiegu migracji.
-- Kolumna generowana eliminuje ten problem: zawsze jest zgodna z `geom`.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- `IF NOT EXISTS` w ADD COLUMN sprawdza tylko nazwę, nie definicję — instalacje
-- z wcześniejszej wersji tej migracji (kolumna zwykła, dopełniana jednorazowym
-- UPDATE-em) miałyby tu cichy no-op i geom_pg zostałoby puste dla każdego
-- wiersza wstawionego po tamtym UPDATE-cie. geom_pg nie niesie żadnych danych
-- własnych — da się w całości odtworzyć z `geom` — więc DROP+ADD jest tu
-- bezstratny i to jedyny pewny sposób na przejście na kolumnę generowaną.
ALTER TABLE ulica         DROP COLUMN IF EXISTS geom_pg;
ALTER TABLE odcinek_drogi DROP COLUMN IF EXISTS geom_pg;

ALTER TABLE ulica
  ADD COLUMN geom_pg geometry(MultiLineString, 4326)
    GENERATED ALWAYS AS (
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom::text), 4326))
    ) STORED;

ALTER TABLE odcinek_drogi
  ADD COLUMN geom_pg geometry(MultiLineString, 4326)
    GENERATED ALWAYS AS (
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom::text), 4326))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_ulica_geom_pg   ON ulica        USING gist (geom_pg);
CREATE INDEX IF NOT EXISTS idx_odcinek_geom_pg ON odcinek_drogi USING gist (geom_pg);

-- Odtąd działają zapytania w rodzaju:
--   SELECT nazwa_pelna, ROUND(ST_Length(geom_pg::geography)) AS m FROM ulica;
--   SELECT ... WHERE ST_Intersects(geom_pg, ST_MakeEnvelope(x0,y0,x1,y1, 4326));
-- /api/mapa korzysta z geom_pg do upraszczania geometrii w bazie —
-- patrz src/app/api/mapa/route.ts.
