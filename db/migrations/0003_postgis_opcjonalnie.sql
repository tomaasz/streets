-- =====================================================================
-- OPCJONALNE — uruchom tylko na bazie z PostGIS (Neon i Supabase mają).
-- Dokłada prawdziwą kolumnę geometryczną obok jsonb i wypełnia ją
-- z GeoJSON-a. Reszta aplikacji działa bez tego kroku.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

ALTER TABLE ulica        ADD COLUMN IF NOT EXISTS geom_pg geometry(MultiLineString, 4326);
ALTER TABLE odcinek_drogi ADD COLUMN IF NOT EXISTS geom_pg geometry(MultiLineString, 4326);

UPDATE ulica
   SET geom_pg = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom::text), 4326))
 WHERE geom IS NOT NULL AND geom_pg IS NULL;

UPDATE odcinek_drogi
   SET geom_pg = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom::text), 4326))
 WHERE geom IS NOT NULL AND geom_pg IS NULL;

CREATE INDEX IF NOT EXISTS idx_ulica_geom_pg   ON ulica        USING gist (geom_pg);
CREATE INDEX IF NOT EXISTS idx_odcinek_geom_pg ON odcinek_drogi USING gist (geom_pg);

-- Od teraz działają zapytania w rodzaju:
--   SELECT nazwa_pelna, ROUND(ST_Length(geom_pg::geography)) AS m FROM ulica;
--   SELECT ... WHERE ST_DWithin(geom_pg::geography, ST_Point(21.46, 52.59)::geography, 300);
