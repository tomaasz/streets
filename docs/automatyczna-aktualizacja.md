# Automatyczna aktualizacja aktów prawnych

Celem jest, żeby nikt niczego nie klikał: raz ustawione zadanie samo pobiera
nowe uchwały z Dziennika Urzędowego Województwa Mazowieckiego i zapisuje je do
tej samej bazy, z której czyta strona.

```bash
npm run data:edziennik-auto
```

Jedno polecenie: wchodzi na strony dziesięciu wydawców dotyczących Wyszkowa,
czyta tabelę aktów, odsiewa te niedotyczące dróg ani nazewnictwa i zapisuje
resztę do bazy. Nowe akty dochodzą, istniejące są aktualizowane po kluczu
(rodzaj, numer, organ). Nic nie kasuje.

## Wariant bez repozytorium na komputerze urzędu

`scripts/edziennik-samodzielny.mjs` to jeden plik bez zależności. Wystarczy go
skopiować na maszynę z Node 18+ — nie trzeba klonować repozytorium ani
instalować pakietów, a **hasło do bazy nigdy nie trafia na tę maszynę**.
Skrypt pobiera akty i wysyła je do aplikacji, a ona zapisuje je u siebie.

```bash
node edziennik-samodzielny.mjs                 # tylko pobierz i pokaż
export APLIKACJA=https://streets-lyart.vercel.app
export IMPORT_TOKEN=…
node edziennik-samodzielny.mjs --wyslij        # pobierz i wyślij
```

Token ustaw najpierw w projekcie na Vercelu jako zmienną `IMPORT_TOKEN`
(Settings → Environment Variables) i zrób redeploy. Dopóki jej nie ma, endpoint
importu jest wyłączony i odpowiada kodem 503 — świeży deployment nie stoi
otworem. Bez poprawnego tokenu odpowiada 401.

Endpoint sprawdza każde pole osobno: rodzaj musi być jednym ze znanych, daty
muszą mieć postać RRRR-MM-DD, adresy muszą zaczynać się od http, a pozycja bez
numeru albo bez tytułu odpada. Do bazy nie trafia nic, czego kształtu nie
sprawdzono.

## Gdzie to uruchomić

Serwis odrzuca połączenia z centrów danych — stoi za Akamai Bot Managerem.
Sprawdzone: Google Cloud dostaje `403`, AWS w Londynie nie dostaje odpowiedzi,
OVH też nie. Zadanie musi więc chodzić na maszynie z siecią, którą serwis
przyjmuje — w praktyce z komputera w urzędzie, dopóki Mazowiecki Urząd
Wojewódzki nie odblokuje adresu IP serwera.

Skrypt rozpoznaje blokadę i kończy się kodem 2 z czytelnym komunikatem,
zamiast po cichu zapisać pustą listę. Podobnie kończy się kodem 3, gdy przejrzy
wiersze, ale nie rozpozna ani jednego aktu — to znaczy, że serwis zmienił układ
tabeli i trzeba poprawić parser. **W obu przypadkach nic nie jest zapisywane,
więc nieudany przebieg nie psuje danych już zebranych.**

## Linux — timer systemd

```ini
# /etc/systemd/system/drogi-akty.service
[Unit]
Description=Aktualizacja aktów prawnych z e-dziennika
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/streets
Environment=DATABASE_URL=postgresql://…
Environment=DB_SCHEMA=drogi
ExecStart=/usr/bin/node scripts/harvest-edziennik-auto.mjs --do-bazy
```

```ini
# /etc/systemd/system/drogi-akty.timer
[Unit]
Description=Cotygodniowa aktualizacja aktów prawnych

[Timer]
OnCalendar=Mon 06:30
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now drogi-akty.timer
systemctl list-timers drogi-akty      # kiedy następny przebieg
journalctl -u drogi-akty -n 50        # co zrobił ostatnio
```

`Persistent=true` jest istotne: jeśli komputer był w poniedziałek wyłączony,
zadanie wykona się przy najbliższym uruchomieniu, a nie dopiero za tydzień.

## Linux — cron

```cron
30 6 * * 1 cd /opt/streets && DATABASE_URL='postgresql://…' DB_SCHEMA=drogi \
  /usr/bin/node scripts/harvest-edziennik-auto.mjs --do-bazy >> /var/log/drogi-akty.log 2>&1
```

## Windows — Harmonogram zadań

1. **Harmonogram zadań → Utwórz zadanie**
2. Zakładka **Ogólne**: „Uruchom niezależnie od tego, czy użytkownik jest
   zalogowany”
3. **Wyzwalacze**: co tydzień, poniedziałek 06:30
4. **Akcje**: program `node`, argumenty
   `scripts\harvest-edziennik-auto.mjs --do-bazy`, katalog `C:\streets`
5. **Warunki**: odznacz „Uruchom tylko wtedy, gdy komputer jest zasilany z sieci”,
   jeśli to laptop

Connection string ustaw jako zmienną środowiskową systemu (`DATABASE_URL`,
`DB_SCHEMA`), nie wpisuj go w polu argumentów — inaczej będzie widoczny na
liście zadań.

## Wariant zapasowy: eksport arkusza

Gdyby serwis zmienił układ strony i parser przestał działać, zostaje jego własny
eksport XLSX (zielona ikona nad tabelą wydawcy). Pliki wrzuca się do
`data/edziennik/` i uruchamia `npm run data:edziennik-xlsx`. Ta droga jest
ręczna, ale odporna na zmiany układu strony.
