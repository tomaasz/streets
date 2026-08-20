-- =====================================================================
-- Akty prawa miejscowego jako osobny byt.
--
-- Dla pracownika urzędu pytanie brzmi nie „jaka to kategoria", tylko
-- „na podstawie czego". Tekstowa kolumna podstawa_prawna tego nie
-- udźwignie: jedna uchwała zalicza zwykle kilkanaście ulic naraz,
-- a jedna ulica bywa zmieniana kilkoma uchwałami przez dwadzieścia lat.
-- Stąd tabela aktów i powiązania wiele-do-wielu.
-- =====================================================================

CREATE TABLE IF NOT EXISTS akt_prawny (
  id               serial PRIMARY KEY,
  organ            text NOT NULL,
  rodzaj           text NOT NULL CHECK (rodzaj IN (
                     'uchwała', 'zarządzenie', 'rozporządzenie', 'obwieszczenie')),
  numer            text NOT NULL,
  data_podjecia    date,
  tytul            text NOT NULL,
  dziennik_rok     integer,
  dziennik_pozycja integer,
  data_ogloszenia  date,
  data_wejscia     date,
  status           text NOT NULL DEFAULT 'nieustalony' CHECK (status IN (
                     'obowiązuje', 'uchylony', 'zmieniony', 'nieustalony')),
  url              text,
  url_pdf          text,
  zrodlo           text REFERENCES zrodlo_danych(kod),
  uwagi            text,
  utworzono        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rodzaj, numer, organ)
);

COMMENT ON COLUMN akt_prawny.dziennik_pozycja IS
  'Pozycja w Dzienniku Urzędowym Województwa Mazowieckiego. Akt prawa '
  'miejscowego wchodzi w życie dopiero po ogłoszeniu, więc bez tej pozycji '
  'i daty ogłoszenia nie da się odpowiedzieć, od kiedy obowiązuje.';
COMMENT ON COLUMN akt_prawny.status IS
  'Czy akt nadal obowiązuje. Domyślnie nieustalony — ustalenie wymaga '
  'sprawdzenia, czy nie został uchylony aktem późniejszym.';

CREATE INDEX IF NOT EXISTS idx_akt_data ON akt_prawny (data_podjecia DESC);
CREATE INDEX IF NOT EXISTS idx_akt_organ ON akt_prawny (organ);

-- ---------------------------------------------------------------------
-- Powiązania. Rola mówi, co akt z danym obiektem zrobił — bez tego
-- nie odróżnisz uchwały zaliczającej drogę od uchwały ją pozbawiającej.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS akt_ulica (
  akt_id   integer NOT NULL REFERENCES akt_prawny(id) ON DELETE CASCADE,
  ulica_id integer NOT NULL REFERENCES ulica(id) ON DELETE CASCADE,
  rola     text NOT NULL DEFAULT 'dotyczy' CHECK (rola IN (
             'nadanie nazwy', 'zmiana nazwy', 'zniesienie nazwy', 'dotyczy')),
  uwagi    text,
  PRIMARY KEY (akt_id, ulica_id, rola)
);

CREATE TABLE IF NOT EXISTS akt_droga (
  akt_id   integer NOT NULL REFERENCES akt_prawny(id) ON DELETE CASCADE,
  droga_id integer NOT NULL REFERENCES droga(id) ON DELETE CASCADE,
  rola     text NOT NULL DEFAULT 'dotyczy' CHECK (rola IN (
             'zaliczenie do kategorii', 'pozbawienie kategorii',
             'ustalenie przebiegu', 'zmiana przebiegu', 'dotyczy')),
  uwagi    text,
  PRIMARY KEY (akt_id, droga_id, rola)
);

CREATE INDEX IF NOT EXISTS idx_akt_ulica_ulica ON akt_ulica (ulica_id);
CREATE INDEX IF NOT EXISTS idx_akt_droga_droga ON akt_droga (droga_id);

-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_akty;
CREATE VIEW v_akty AS
SELECT
  a.*,
  COALESCE(u.ile, 0) AS powiazanych_ulic,
  COALESCE(d.ile, 0) AS powiazanych_drog
FROM akt_prawny a
LEFT JOIN (SELECT akt_id, COUNT(*) AS ile FROM akt_ulica GROUP BY akt_id) u
       ON u.akt_id = a.id
LEFT JOIN (SELECT akt_id, COUNT(*) AS ile FROM akt_droga GROUP BY akt_id) d
       ON d.akt_id = a.id;
