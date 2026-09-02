-- =====================================================================
-- Adresy URL z bazy trafiają wprost do href (Zrodlo.tsx, ulica/[slug],
-- zarzadcy/page.tsx) bez sprawdzenia schematu w warstwie aplikacji.
-- Dziś nieszkodliwe — jedyna droga zapisu to zaufane pliki CSV i
-- /api/import/akty, który już waliduje schemat (adresAlbo() w tamtym
-- pliku) — ale sama baza tego nie wymuszała.
--
-- Zakaz jest listą tego, co naprawdę szkodzi (javascript:/data:/vbscript:
-- URI, klasyczny wektor XSS przez href), a nie listą dozwolonych schematów:
-- `akt_prawny.url_pdf` bywa ścieżką względną do public/uchwaly/ (patrz
-- scripts/import-uchwaly.mjs), nie zawsze pełnym http(s) adresem, więc
-- wymaganie '^https?://' złamałoby ten, w pełni legalny, przypadek.
-- =====================================================================

DO $$ BEGIN
  ALTER TABLE zarzadca ADD CONSTRAINT zarzadca_www_bezpieczny
    CHECK (www IS NULL OR www !~* '^(javascript|data|vbscript|file):');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE zrodlo_danych ADD CONSTRAINT zrodlo_danych_url_bezpieczny
    CHECK (url IS NULL OR url !~* '^(javascript|data|vbscript|file):');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE akt_prawny ADD CONSTRAINT akt_prawny_url_bezpieczny
    CHECK (url IS NULL OR url !~* '^(javascript|data|vbscript|file):');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE akt_prawny ADD CONSTRAINT akt_prawny_url_pdf_bezpieczny
    CHECK (url_pdf IS NULL OR url_pdf !~* '^(javascript|data|vbscript|file):');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
