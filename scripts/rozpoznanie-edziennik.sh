#!/bin/sh
# Rozpoznanie dostępu do Dziennika Urzędowego Województwa Mazowieckiego.
#
# Serwis blokuje adresy centrów danych, ale różnie w różnych sieciach:
# z Google Cloud zwraca 403, z AWS w Londynie nie odpowiada wcale.
# Zanim napiszemy importer, trzeba wiedzieć, z której maszyny da się go
# uruchomić i jak serwis jest zbudowany.
#
# Skrypt tylko czyta: kilka żądań GET, jeden plik tymczasowy w /tmp.
# Uruchom:  sh rozpoznanie-edziennik.sh 2>&1 | tee wynik.txt

B=https://edziennik.mazowieckie.pl
PLIK=/tmp/ed-rozpoznanie.html

echo "== kody odpowiedzi =="
for u in / /api/search /api/legalacts /actbytype /robots.txt /sitemap.xml; do
  printf '%-16s %s\n' "$u" "$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$B$u")"
done

echo
echo "== strona główna =="
if curl -sf -m 25 "$B/" -o "$PLIK"; then
  echo "pobrano $(wc -c < "$PLIK") bajtów"
  echo "--- pierwsze 600 znaków ---"
  head -c 600 "$PLIK"; echo
  echo
  echo "--- tytuł i generator ---"
  grep -oiE '<title>[^<]*</title>|<meta name="generator"[^>]*>' "$PLIK" | head -3
  echo
  echo "--- skrypty ---"
  grep -oE 'src="[^"]+\.js[^"]*"' "$PLIK" | head -10
  echo
  echo "--- adresy API w HTML ---"
  grep -oE '"/(api|rest|services)/[a-zA-Z0-9_/-]{2,60}"' "$PLIK" | sort -u | head -20
  echo
  echo "--- adresy API w bundlach JS ---"
  for j in $(grep -oE 'src="([^"]+\.js[^"]*)"' "$PLIK" | sed 's/src="//;s/"//' | head -4); do
    case "$j" in http*) U="$j" ;; /*) U="$B$j" ;; *) U="$B/$j" ;; esac
    curl -s -m 30 "$U" | grep -oE '"/(api|rest|services)/[a-zA-Z0-9_{}$/-]{2,70}"' |
      sort -u | head -12
  done
else
  echo "NIE UDAŁO SIĘ POBRAĆ strony głównej — ta maszyna jest zablokowana."
  echo "Odpowiedź serwera:"
  curl -s -m 20 "$B/" | head -c 400
fi
