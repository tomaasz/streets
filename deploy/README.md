# Cotygodniowe odświeżanie na serwerze

Zestaw, który raz w tygodniu pobiera dane z GUGiK i BIP-u, sprawdza je,
wgrywa do bazy i nakłada regułę pierwszeństwa źródeł. Nikt niczego nie klika.

| plik | rola |
|---|---|
| `odswiezenie.sh` | cały przebieg, krok po kroku |
| `kontrola-danych.py` | bramka między pobraniem a wsadem |
| `punkt-odniesienia.przyklad.json` | progi dla bramki |
| `systemd/drogi-odswiezenie.service` | jednostka użytkownika |
| `systemd/drogi-odswiezenie.timer` | poniedziałki, `Persistent=true` |

## Kolejność kroków i dlaczego taka

```
npm ci → data:prg → data:bdot → data:build → data:akty
       → KONTROLA DANYCH → db:seed → data:uchwaly → raport
```

Dwie rzeczy w tej kolejności nie są przypadkowe:

- **Kontrola stoi przed `db:seed`**, nie po. `seed` kasuje odcinki o źródle
  `bdot10k` i wstawia je na nowo — pusty albo obcięty `data/odcinki.json`
  wyczyściłby więc zawartość bazy. Bramka przepuszcza dalej tylko dane,
  które wyglądają sensownie; inaczej kończy kodem 2 albo 3 i `set -e`
  przerywa całość, zanim cokolwiek zostanie zapisane.
- **`data:uchwaly` idzie po `db:seed`**, nie przed. Seed odtwarza wszystkie
  odcinki z BDOT10k od zera, więc reguła pierwszeństwa (uchwała rozstrzyga
  nad odczytem z mapy) znika przy każdym odświeżeniu i trzeba ją nałożyć
  na nowo. Odwrotna kolejność daje bazę, w której uchwały są zapisane, ale
  nie mają wpływu na kategorię i zarządcę.

`data:bdot` kasuje najpierw `data/cache/*_GML.zip`. Bez tego harvester
bierze paczkę z cache i cotygodniowe zadanie nigdy nie odświeżyłoby BDOT-u.

## Bramka: co przepuszcza, a co nie

`kontrola-danych.py` porównuje świeże pliki z punktem odniesienia:

- brak pliku, zły JSON albo pusta lista → **kod 3**, wsad wstrzymany;
- spadek poniżej progu (domyślnie 50% punktu odniesienia) → **kod 2**,
  wsad wstrzymany, baza nietknięta;
- odchylenie ponad 10% → przechodzi, ale jest wypisane w logu.

Próg 50% to dużo więcej niż „kilka procent”, o które dane źródłowe potrafią
się ruszyć, i dużo mniej niż rząd wielkości. Łapie awarie, nie łapie
normalnej zmienności. Można go zmienić zmienną `PROG_BLOKADY`.

## Instalacja

```bash
# 1. sekrety — nigdy w jednostce ani w cronie
mkdir -p ~/.config/drogi && chmod 700 ~/.config/drogi
cat > ~/.config/drogi/aktualizacja.env <<'EOF'
DATABASE_URL=postgresql://…   # pooled connection string
DB_SCHEMA=drogi
EOF
chmod 600 ~/.config/drogi/aktualizacja.env

# 2. progi bramki
cp deploy/punkt-odniesienia.przyklad.json ~/.config/drogi/punkt-odniesienia.json

# 3. jednostki
mkdir -p ~/.config/systemd/user
cp deploy/systemd/drogi-odswiezenie.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now drogi-odswiezenie.timer

# 4. żeby chodziło bez zalogowanego użytkownika
sudo loginctl enable-linger "$USER"
```

Jednostki zakładają repozytorium w `~/projekty/streets`. Przy innej ścieżce
podmień `%h/projekty/streets` w pliku `.service` — sam skrypt ścieżki nie
zna, wylicza ją z własnego położenia.

Wariant systemowy (`/etc/systemd/system`, `User=`, plik z sekretami
`root:root 0600`) też działa i jest szczelniejszy — wtedy `EnvironmentFile`
czyta root, a proces i tak leci na prawach użytkownika.

## Podgląd

```bash
systemctl --user list-timers drogi-odswiezenie   # kiedy następny przebieg
journalctl --user -u drogi-odswiezenie -n 50     # co zrobił ostatnio
cat ~/logs/drogi/raport-ostatni.md               # raport z ostatniego przebiegu
sudo systemctl --user start drogi-odswiezenie    # przebieg na żądanie
```

Nieudany przebieg **nic nie zapisuje** — ani do bazy, ani do `data/`.
Poprzedni wsad leży w `~/.local/share/drogi/poprzedni/`.

## Czego ten zestaw nie robi

Nie woła `data:edziennik-auto`. Dziennik Urzędowy Woj. Mazowieckiego
odrzuca połączenia z centrów danych i z tego serwera odpowiada kodem `000`
— nie jest to problem sieci serwera, tylko blokada po stronie serwisu
(sprawdzone: adresy kontrolne odpowiadają 200, TLS do e-dziennika wstaje,
a serwis zabija strumień po wysłaniu żądania). Blokady nie obchodzimy.
Akty z e-dziennika dochodzą osobną drogą, opisaną
w `docs/automatyczna-aktualizacja.md`.
