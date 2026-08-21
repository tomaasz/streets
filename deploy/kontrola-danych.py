#!/usr/bin/env python3
"""Kontrola swiezo pobranych danych przed wsadem do bazy.

Uruchamiane miedzy `npm run data:*` a `npm run db:seed`. Zadaniem jest nie
przepuscic do bazy pliku pustego albo obcietego — seed kasuje odcinki
o zrodle `bdot10k` i wstawia je na nowo, wiec pusty `data/odcinki.json`
skasowalby zawartosc bazy.

Kody wyjscia:
  0 — dane wygladaja sensownie (moga byc drobne odchylenia, sa wypisane)
  2 — dane odbiegaja od punktu odniesienia na tyle, ze wsad jest wstrzymany
  3 — brak pliku, zly JSON albo pusta lista

Punkt odniesienia siedzi w ~/.config/drogi/punkt-odniesienia.json i mozna go
podniesc po kazdym udanym przebiegu, zeby prog jechal razem z danymi.
"""
import json
import os
import sys
from pathlib import Path

REPO = Path(os.environ.get("REPO", "/home/tomaasz/projekty/streets"))
KONFIG = Path(
    os.environ.get(
        "PUNKT_ODNIESIENIA",
        os.path.expanduser("~/.config/drogi/punkt-odniesienia.json"),
    )
)

# Ponizej tego ulamka punktu odniesienia wsad jest wstrzymywany.
# 0.5 to duzo wiecej niz "kilka procent" z docs/stan-bazy.md, a duzo mniej
# niz rzad wielkosci — lapie awarie, nie lapie normalnej zmiennosci zrodel.
PROG_BLOKADY = float(os.environ.get("PROG_BLOKADY", "0.5"))
PROG_OSTRZEZENIA = float(os.environ.get("PROG_OSTRZEZENIA", "0.10"))

# plik, sciezka do listy, etykieta, czy blokuje wsad
POZYCJE = [
    ("data/raw/prg-ulice.json", "ulice", "ulic (PRG)", True),
    ("data/odcinki.json", "odcinki", "odcinkow (BDOT x PRG)", True),
    ("data/raw/bdot-drogi.json", "drogi", "odcinkow BDOT10k", True),
    ("data/raw/akty-bip.json", "akty", "aktow z BIP", False),
]


def wczytaj_odniesienie() -> dict:
    try:
        return json.loads(KONFIG.read_text())
    except FileNotFoundError:
        sys.exit(f"BLAD: brak punktu odniesienia {KONFIG}")
    except json.JSONDecodeError as e:
        sys.exit(f"BLAD: {KONFIG} to nie jest poprawny JSON: {e}")


def main() -> int:
    odniesienie = wczytaj_odniesienie()
    wyniki = []
    blokada = []
    braki = []

    for plik, klucz, etykieta, blokujacy in POZYCJE:
        sciezka = REPO / plik
        try:
            dane = json.loads(sciezka.read_text())
        except FileNotFoundError:
            braki.append(f"{plik}: brak pliku")
            continue
        except json.JSONDecodeError as e:
            braki.append(f"{plik}: zly JSON ({e})")
            continue

        lista = dane.get(klucz) if isinstance(dane, dict) else dane
        if not isinstance(lista, list):
            braki.append(f"{plik}: pole `{klucz}` nie jest lista")
            continue
        ile = len(lista)
        if ile == 0 and blokujacy:
            braki.append(f"{plik}: lista `{klucz}` jest pusta")
            continue

        wzorzec = odniesienie.get(klucz)
        if not wzorzec:
            wyniki.append(f"  {etykieta}: {ile} (brak punktu odniesienia)")
            continue

        odchylenie = (ile - wzorzec) / wzorzec
        opis = f"  {etykieta}: {ile} wobec {wzorzec} ({odchylenie:+.1%})"
        if blokujacy and ile < wzorzec * PROG_BLOKADY:
            blokada.append(opis + "  <-- ponizej progu")
        elif abs(odchylenie) > PROG_OSTRZEZENIA:
            wyniki.append(opis + "  <-- warto obejrzec")
        else:
            wyniki.append(opis)

    print("Kontrola danych przed wsadem:")
    for w in wyniki:
        print(w)
    for w in blokada:
        print(w)

    if braki:
        print("\nDane niekompletne — wsad wstrzymany:")
        for b in braki:
            print(f"  {b}")
        return 3
    if blokada:
        print(
            f"\nSpadek ponizej {PROG_BLOKADY:.0%} punktu odniesienia — wsad wstrzymany."
            "\nBaza zostaje nietknieta. Obejrzyj dane w data/ i uruchom ponownie recznie."
        )
        return 2
    print("\nDane w normie — wsad moze isc dalej.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
