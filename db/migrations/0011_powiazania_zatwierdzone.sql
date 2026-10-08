-- Decyzja użytkownika jest oddzielona od notatki i przetrwa ponowny import.
CREATE TABLE IF NOT EXISTS powiazanie_zatwierdzone (
  klucz text PRIMARY KEY,
  rodzaj text NOT NULL CHECK (rodzaj IN ('uchwala','geometria')),
  zrodlo_hash text NOT NULL,
  cel jsonb NOT NULL,
  uzasadnienie text NOT NULL,
  utworzono timestamptz NOT NULL DEFAULT now()
);
