#!/bin/bash
# Cotygodniowe odświeżenie bazy dróg gminy Wyszków ze źródeł, które
# odpowiadają z serwera: PRG i BDOT10k (GUGiK) oraz uchwały z BIP gminy.
#
# Dziennik Urzędowy Woj. Mazowieckiego jest z serwera w centrum danych
# zablokowany (Akamai Bot Manager, brak odpowiedzi HTTP) i celowo NIE jest
# tu wołany. Akty z e-dziennika dochodzą osobną drogą — z komputera
# w urzędzie, patrz docs/automatyczna-aktualizacja.md.
#
# DATABASE_URL i DB_SCHEMA przychodzą ze środowiska (EnvironmentFile
# w jednostce systemd). Nie ma ich w tym pliku i nie mogą tu trafić.
#
# Każdy nieudany krok przerywa całość (set -e). Między pobraniem a wsadem
# stoi kontrola danych — pusty albo obcięty plik nie wchodzi do bazy.
#
# Instalacja i jednostki systemd: patrz deploy/README.md

set -Eeuo pipefail

# Repozytorium to katalog nadrzędny wobec tego skryptu — dzięki temu nie ma
# tu żadnej ścieżki związanej z konkretną maszyną.
REPO=${REPO:-$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)}
LOGI=${LOGI:-$HOME/logs/drogi}
KOPIE=${KOPIE:-$HOME/.local/share/drogi/poprzedni}

# systemd daje jednostkom ubogi PATH, a node siedzi zwykle w nvm.
if [ -z "${NODE_BIN:-}" ]; then
  NODE_BIN=$(command -v node || true)
fi
if [ -z "$NODE_BIN" ]; then
  NODE_BIN=$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1 || true)
fi
[ -n "$NODE_BIN" ] || { echo "Nie znalazłem node. Ustaw NODE_BIN." >&2; exit 1; }
export PATH="$(dirname "$NODE_BIN"):$PATH"

STEMPEL=$(date +%Y%m%d-%H%M)

krok() { printf '\n=== %s === %s\n' "$1" "$(date '+%F %T')"; }
blad() { printf '\nPRZERWANE na kroku: %s (linia %s)\n' "${KROK:-?}" "$1" >&2; }
trap 'blad $LINENO' ERR

: "${DATABASE_URL:?brak DATABASE_URL — jednostka nie wczytała EnvironmentFile}"
: "${DB_SCHEMA:?brak DB_SCHEMA — jednostka nie wczytała EnvironmentFile}"

mkdir -p "$LOGI" "$KOPIE"
chmod 750 "$LOGI"
cd "$REPO"

printf 'Odświeżenie %s\n' "$STEMPEL"
printf 'Repozytorium: %s (gałąź %s, %s)\n' "$REPO" \
  "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short HEAD)"
printf 'Node: %s (%s)\n' "$NODE_BIN" "$("$NODE_BIN" -v)"
printf 'Schemat bazy: %s\n' "$DB_SCHEMA"

KROK='kopia poprzednich danych'; krok "$KROK"
rm -rf "${KOPIE:?}"/*
cp -a data/raw "$KOPIE"/ 2>/dev/null || true
cp -a data/odcinki.json "$KOPIE"/ 2>/dev/null || true
echo "poprzedni wsad odłożony w $KOPIE"

KROK='npm ci'; krok "$KROK"
npm ci --no-audit --no-fund

KROK='data:prg (ulice z PRG/GUGiK, ~40 min)'; krok "$KROK"
npm run --silent data:prg

KROK='data:bdot (paczka BDOT10k powiatu 1435)'; krok "$KROK"
# harvest-bdot.mjs bierze paczkę z data/cache/, jeśli tam leży. Przy zadaniu
# cotygodniowym to znaczy „nigdy nie odświeżaj BDOT”, więc cache idzie precz.
# Jeśli pobranie padnie, set -e przerywa całość i stary bdot-drogi.json zostaje.
rm -f data/cache/*_GML.zip
npm run --silent data:bdot

KROK='data:build (dopasowanie BDOT <-> PRG)'; krok "$KROK"
npm run --silent data:build

KROK='data:akty (uchwały z BIP gminy)'; krok "$KROK"
npm run --silent data:akty

KROK='kontrola danych przed wsadem'; krok "$KROK"
REPO="$REPO" "$(dirname "$(readlink -f "$0")")/kontrola-danych.py"

KROK='db:seed (wsad do bazy)'; krok "$KROK"
npm run --silent db:seed

# MUSI iść po db:seed. Seed kasuje i odtwarza wszystkie odcinki o źródle
# bdot10k, więc reguła pierwszeństwa (uchwała > BDOT10k) znika przy każdym
# odświeżeniu i trzeba ją nałożyć na nowo. Odwrotna kolejność daje bazę,
# w której uchwały są zapisane, ale nie mają wpływu na kategorie i zarządcę.
KROK='data:uchwaly (podstawa prawna i reguła pierwszeństwa źródeł)'; krok "$KROK"
npm run --silent data:uchwaly

KROK='raport'; krok "$KROK"
npm run --silent raport | tee "$LOGI/raport-$STEMPEL.md" | sed -n '1,10p'
ln -sfn "$LOGI/raport-$STEMPEL.md" "$LOGI/raport-ostatni.md"

# raporty starsze niż pół roku nie są już nikomu potrzebne
find "$LOGI" -name 'raport-2*.md' -mtime +180 -delete

krok 'gotowe'
echo "pełny raport: $LOGI/raport-$STEMPEL.md"
