-- Status pracy i notatki, oddzielone od kategorii i źródeł danych drogi.
-- Klucz naturalny przeżywa cotygodniowe odtworzenie odcinków przez seed.
CREATE TABLE IF NOT EXISTS weryfikacja_rekordu (
  klucz text PRIMARY KEY CHECK (length(klucz) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'do_weryfikacji'
    CHECK (status IN ('do_weryfikacji', 'w_trakcie', 'wyjasnione')),
  notatka text NOT NULL DEFAULT '' CHECK (length(notatka) <= 2000),
  zmodyfikowano timestamptz NOT NULL DEFAULT now()
);
