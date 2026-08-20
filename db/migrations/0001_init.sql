-- =====================================================================
-- Baza dróg i ulic gminy Wyszków — schemat bazowy
-- ---------------------------------------------------------------------
-- Zasada modelu: ULICA (obiekt adresowy z PRG/TERYT) to co innego niż
-- DROGA (obiekt z ustawy o drogach publicznych). Jedna ulica może być
-- podzielona na kilka ODCINKÓW o różnej kategorii i różnym zarządcy —
-- np. ulica, którą biegnie droga wojewódzka, a dalej droga gminna.
--
-- Druga oś: zarządca formalny (z art. 19 ustawy o drogach publicznych)
-- vs podmiot faktycznie utrzymujący (porozumienie z art. 19 ust. 4).
-- Stąd dwie osobne kolumny na odcinku.
-- =====================================================================

CREATE TABLE IF NOT EXISTS zrodlo_danych (
  kod              text PRIMARY KEY,
  nazwa            text NOT NULL,
  gestor           text,
  url              text,
  licencja         text,
  domyslna_pewnosc smallint NOT NULL DEFAULT 1
                     CHECK (domyslna_pewnosc BETWEEN 1 AND 3),
  opis             text
);

COMMENT ON TABLE zrodlo_danych IS
  'Rejestr źródeł. Bez tego po kilku miesiącach nie da się odróżnić rekordu '
  'zaimportowanego hurtem od potwierdzonego uchwałą.';
COMMENT ON COLUMN zrodlo_danych.domyslna_pewnosc IS
  '1 = import maszynowy do weryfikacji, 2 = źródło urzędowe wtórne, '
  '3 = akt prawa miejscowego / ewidencja dróg';

-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS zarzadca (
  id              smallserial PRIMARY KEY,
  kod             text NOT NULL UNIQUE,
  nazwa           text NOT NULL,
  typ             text NOT NULL CHECK (typ IN (
                    'krajowy', 'wojewodzki', 'powiatowy', 'gminny',
                    'wewnetrzny', 'kolejowy', 'lesny', 'prywatny', 'inny')),
  podstawa_prawna text,
  jednostka       text,
  adres           text,
  telefon         text,
  email           text,
  www             text,
  uwagi           text
);

COMMENT ON COLUMN zarzadca.typ IS
  'Kategoria zarządcy wg art. 19 udp; "wewnetrzny" dla dróg niezaliczonych '
  'do żadnej kategorii (zarządza właściciel terenu).';

-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE kategoria_drogi AS ENUM (
    'krajowa', 'wojewodzka', 'powiatowa', 'gminna',
    'wewnetrzna', 'nieustalona');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rejestr numerowanych dróg publicznych przebiegających przez gminę.
CREATE TABLE IF NOT EXISTS droga (
  id              serial PRIMARY KEY,
  numer           text NOT NULL UNIQUE,
  kategoria       kategoria_drogi NOT NULL,
  klasa           text,
  przebieg        text,
  zarzadca_id     smallint REFERENCES zarzadca(id),
  dlugosc_gmina_m integer,
  podstawa_prawna text,
  zrodlo          text REFERENCES zrodlo_danych(kod),
  pewnosc         smallint NOT NULL DEFAULT 1 CHECK (pewnosc BETWEEN 1 AND 3),
  uwagi           text
);

COMMENT ON COLUMN droga.klasa IS 'Klasa techniczna: A, S, GP, G, Z, L, D.';

-- ---------------------------------------------------------------------

-- Ulica = obiekt z PRG / TERYT ULIC. Klucz naturalny to (SIMC, SYM_UL).
CREATE TABLE IF NOT EXISTS ulica (
  id           serial PRIMARY KEY,
  simc         char(7) NOT NULL,
  sym_ul       char(5) NOT NULL,
  terc_gmina   char(6) NOT NULL,
  miejscowosc  text NOT NULL,
  cecha        text NOT NULL DEFAULT 'ul.',
  nazwa        text NOT NULL,
  nazwa_pelna  text GENERATED ALWAYS AS (cecha || ' ' || nazwa) STORED,
  slug         text NOT NULL UNIQUE,
  dlugosc_m    integer,
  x_2180       numeric(10, 2),
  y_2180       numeric(10, 2),
  geom         jsonb,
  zrodlo       text REFERENCES zrodlo_danych(kod),
  aktualizacja date,
  UNIQUE (simc, sym_ul)
);

COMMENT ON COLUMN ulica.geom IS
  'GeoJSON MultiLineString w EPSG:4326, przeliczony z PL-1992. jsonb zamiast '
  'geometrii PostGIS, żeby baza działała na dowolnym darmowym hostingu; '
  'migracja 0003 dokłada kolumnę PostGIS tam, gdzie rozszerzenie jest dostępne.';

-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS odcinek_drogi (
  id               serial PRIMARY KEY,
  ulica_id         integer REFERENCES ulica(id) ON DELETE CASCADE,
  droga_id         integer REFERENCES droga(id),
  opis_odcinka     text,
  kategoria        kategoria_drogi NOT NULL DEFAULT 'nieustalona',
  nr_drogi         text,
  klasa            text,
  zarzadca_id      smallint REFERENCES zarzadca(id),
  utrzymujacy_id   smallint REFERENCES zarzadca(id),
  porozumienie     text,
  wlasciciel       text,
  dzialki          text[],
  dlugosc_m        integer,
  nawierzchnia     text,
  podstawa_prawna  text,
  zrodlo           text NOT NULL REFERENCES zrodlo_danych(kod),
  pewnosc          smallint NOT NULL DEFAULT 1 CHECK (pewnosc BETWEEN 1 AND 3),
  data_weryfikacji date,
  uwagi            text,
  geom             jsonb,
  utworzono        timestamptz NOT NULL DEFAULT now(),
  zmodyfikowano    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN odcinek_drogi.ulica_id IS
  'Ulica, po której odcinek biegnie. NULL jest poprawny: większość sieci '
  'w gminie to drogi polne, leśne i dojazdy do pól — nie mają ani nazwy '
  'ulicy, ani numeru, a nadal są drogami wewnętrznymi z konkretnym właścicielem.';

COMMENT ON COLUMN odcinek_drogi.utrzymujacy_id IS
  'Podmiot faktycznie utrzymujący odcinek, jeśli inny niż zarządca — '
  'porozumienie z art. 19 ust. 4 udp (gmina bardzo często przejmuje '
  'chodniki i zieleń przy drogach powiatowych).';
COMMENT ON COLUMN odcinek_drogi.wlasciciel IS
  'Właściciel terenu — istotny tylko dla dróg wewnętrznych, gdzie to on '
  'jest zarządcą (art. 8 ust. 2 udp).';

CREATE OR REPLACE FUNCTION dotknij_zmodyfikowano() RETURNS trigger AS $$
BEGIN
  NEW.zmodyfikowano := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_odcinek_zmodyfikowano ON odcinek_drogi;
CREATE TRIGGER trg_odcinek_zmodyfikowano
  BEFORE UPDATE ON odcinek_drogi
  FOR EACH ROW EXECUTE FUNCTION dotknij_zmodyfikowano();
