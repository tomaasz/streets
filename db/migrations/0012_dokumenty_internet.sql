-- Wyniki rozpoznania pozostają oddzielone od aktów potwierdzających drogi.
CREATE TABLE IF NOT EXISTS wyszukiwanie_dokumentow (
  id uuid PRIMARY KEY,
  gmina text NOT NULL,
  parametry jsonb NOT NULL,
  wyniki jsonb NOT NULL,
  utworzono timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dokument_do_przetworzenia (
  id serial PRIMARY KEY,
  gmina text NOT NULL,
  rodzaj text NOT NULL,
  organ text NOT NULL,
  numer text NOT NULL,
  metadane jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('do_przetworzenia','blad_pobrania','brak_pliku','przetworzony')),
  blad text,
  dolaczono timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gmina, rodzaj, organ, numer)
);

CREATE TABLE IF NOT EXISTS plik_dokumentu (
  id serial PRIMARY KEY,
  dokument_id integer NOT NULL REFERENCES dokument_do_przetworzenia(id) ON DELETE CASCADE,
  url text NOT NULL,
  rola text NOT NULL CHECK (rola IN ('publikacja','dokument','metadane')),
  typ text NOT NULL,
  sha256 text NOT NULL,
  tresc bytea NOT NULL,
  pobrano timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dokument_id, url)
);

CREATE INDEX IF NOT EXISTS idx_dokument_kolejka ON dokument_do_przetworzenia(dolaczono DESC);

ALTER TABLE plik_dokumentu DROP CONSTRAINT IF EXISTS plik_dokumentu_rola_check;
ALTER TABLE plik_dokumentu ADD CONSTRAINT plik_dokumentu_rola_check
  CHECK (rola IN ('publikacja','dokument','metadane'));
