-- =====================================================================
-- Powiązanie aktu prawnego z konkretnym odcinkiem drogi.
--
-- Migracja 0005 dała aktom relacje z ulicą i z drogą numerowaną
-- (akt_ulica, akt_droga), ale nie z odcinkiem — `odcinek_drogi.podstawa_prawna`
-- zostawał wolnym tekstem. Aplikacja odgadywała powiązanie dopasowaniem
-- podciągu (`podstawa_prawna.includes('nr ' + akt.numer)`), co przy zbieżnym
-- numerze dwóch aktów albo innym formacie tekstu podsuwa urzędnikowi zły
-- dokument — a to jest właśnie pytanie, na które ta baza ma dawać pewną
-- odpowiedź. Ta tabela robi z tego klucz obcy sprawdzany przez bazę.
-- =====================================================================

CREATE TABLE IF NOT EXISTS akt_odcinek (
  akt_id     integer NOT NULL REFERENCES akt_prawny(id) ON DELETE CASCADE,
  odcinek_id integer NOT NULL REFERENCES odcinek_drogi(id) ON DELETE CASCADE,
  rola       text NOT NULL DEFAULT 'dotyczy' CHECK (rola IN (
               'zaliczenie do kategorii', 'ustalenie zarządcy', 'dotyczy')),
  uwagi      text,
  PRIMARY KEY (akt_id, odcinek_id, rola)
);

COMMENT ON TABLE akt_odcinek IS
  'Który akt jest podstawą prawną danego odcinka. `podstawa_prawna` na '
  'odcinku zostaje jako czytelny tekst do wyświetlenia, ale to ta tabela '
  'jest źródłem prawdy o powiązaniu — wypełnia ją scripts/import-uchwaly.mjs, '
  'nie dopasowanie tekstu w warstwie prezentacji.';

CREATE INDEX IF NOT EXISTS idx_akt_odcinek_odcinek ON akt_odcinek (odcinek_id);
