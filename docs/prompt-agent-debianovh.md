# Zadanie dla agenta na serwerze debianovh

Poniższą treść wklej agentowi uruchomionemu na `debianovh`. Zawiera kontekst,
zadania i kryteria odbioru — jest napisana tak, żeby agent nie musiał niczego
zgadywać ani pytać o rzeczy, które już wiemy.

---

## Kontekst

Utrzymujesz bazę dróg i ulic gminy Wyszków. Repozytorium:
`https://github.com/tomaasz/streets`, gałąź `claude/wyszkow-streets-managers-db-2mezmd`.
Aplikacja stoi na Vercelu pod `https://streets-lyart.vercel.app`, dane siedzą
w Postgresie na Neonie, w schemacie `drogi`.

Repozytorium jest **prywatne**, a GitHub nie przyjmuje haseł przez HTTPS.
Sklonuj przez SSH (`git@github.com:tomaasz/streets.git`) albo przez HTTPS
z tokenem osobistym. Jeśli nie masz żadnego z nich — powiedz o tym i przerwij,
nie próbuj obchodzić uwierzytelniania.

Dane wejściowe pochodzą z pięciu źródeł. Cztery z nich odpowiadają z tego
serwera, piąte nie:

| Źródło | Skrypt | Dostęp z debianovh |
|---|---|---|
| PRG (ulice) — usługa GUGiK | `npm run data:prg` | działa |
| BDOT10k (kategorie i numery dróg) — GUGiK | `npm run data:bdot` | działa |
| ULDK (granice, obręby) — GUGiK | używane przez powyższe | działa |
| BIP gminy (uchwały) | `npm run data:akty` | działa |
| **Dziennik Urzędowy Woj. Mazowieckiego** | `npm run data:edziennik-auto` | **zablokowany** |

E-dziennik stoi za Akamai Bot Managerem i odrzuca sieci centrów danych.
Sprawdzone z trzech: Google Cloud dostaje `403 Dostęp zablokowany`, AWS
w Londynie timeout, ten serwer `000`.

## Czego NIE robić

**Nie obchodź blokady e-dziennika.** Żadnych proxy (w tym Webshare),
podmieniania adresów IP, podszywania się pod przeglądarkę w nagłówku
`User-Agent` ani rozwiązywania testów antybotowych. Serwis nazywa to wprost
działaniem niezgodnym z regulaminem, a odbiorcą tej bazy jest urząd gminy.
Jeśli e-dziennik odpowiada blokadą — zapisz to w raporcie i przejdź dalej.

Nie zmieniaj też schematu bazy ani nie uruchamiaj `db:migrate --reset`.
Baza jest współdzielona z innym projektem; `--reset` bez `DB_SCHEMA` odmówi
działania i dobrze, ale nie próbuj tego wymuszać.

## Zadanie 1 — rozstrzygnij, czy `000` to blokada, czy problem tego serwera

Wcześniejsze próby dawały `000`, co znaczy „brak odpowiedzi HTTP" i może
oznaczać zarówno blokadę po stronie serwisu, jak i problem z ruchem
wychodzącym tego serwera. Rozstrzygnij:

```sh
curl -s -o /dev/null -m 15 -w 'bip:   %{http_code}\n' https://bip.wyszkow.pl/
curl -s -o /dev/null -m 15 -w 'gugik: %{http_code}\n' https://uldk.gugik.gov.pl/
curl -sv -m 15 https://edziennik.mazowieckie.pl/ 2>&1 | head -20
getent hosts edziennik.mazowieckie.pl
```

* Kontrolne `200`, a e-dziennik `000` → blokada po stronie serwisu, koniec tematu.
* Kontrolne też `000` → problem z siecią serwera; zdiagnozuj i napraw (DNS,
  firewall, IPv6), bo wtedy inne źródła też będą kulały.

Wynik zapisz w raporcie, dosłownie, z kodami.

## Zadanie 2 — cotygodniowe odświeżanie danych, które działają

Ustaw na tym serwerze zadanie odświeżające dane z GUGiK i BIP. Wymagane
zmienne środowiskowe (weź je z bezpiecznego miejsca, **nie wpisuj na stałe
w plikach jednostki ani w cronie**):

```
DATABASE_URL=postgresql://…   # pooled connection string do Neona
DB_SCHEMA=drogi
```

Kroki:

```sh
npm ci
npm run data:prg          # ~40 min, odpytuje usługę GUGiK
npm run data:bdot         # pobiera paczkę BDOT10k powiatu 1435
npm run data:build        # dopasowanie BDOT ↔ PRG
npm run data:akty         # uchwały z BIP gminy
npm run db:seed           # wsad do bazy
npm run raport            # kontrola
```

Zbuduj z tego timer systemd uruchamiany raz w tygodniu, z `Persistent=true`.
Wzór jednostek jest w `docs/automatyczna-aktualizacja.md` — dostosuj go do
tego zestawu poleceń. Zadbaj, żeby nieudany krok przerywał całość, a nie
przepuszczał pustych danych do wsadu.

Po pierwszym przebiegu porównaj liczby z `docs/stan-bazy.md`. Punkt odniesienia
z 2026-08-20: **710 ulic, 3677 odcinków, 211 dróg numerowanych, 949,4 km**.
Odchylenie o kilka procent jest normalne (dane źródłowe się zmieniają), ale
spadek o rząd wielkości oznacza, że coś się zepsuło — wtedy **nie wgrywaj**,
tylko zgłoś.

## Zadanie 3 — sprawdź, czy nic nie przecieka

* `IMPORT_TOKEN` i `DATABASE_URL` nie mogą trafić do repozytorium, do logów
  ani do plików jednostek systemd czytelnych dla wszystkich.
* Katalog `data/cache/` (paczka BDOT10k, ~45 MB) jest w `.gitignore` — sprawdź,
  że tak zostało.
* Jeśli commitujesz odświeżone dane do repozytorium, commituj wyłącznie
  `data/raw/*.json` i `data/odcinki.json`.

## Raport końcowy

Napisz krótko i konkretnie:

1. Wynik zadania 1 z kodami odpowiedzi — blokada czy problem sieci serwera.
2. Czy timer działa, kiedy następny przebieg, gdzie są logi.
3. Liczby z `npm run raport` i jak wypadło porównanie ze stanem odniesienia.
4. Co poszło nie tak i czego nie udało się zrobić. Jeśli czegoś nie zrobiłeś,
   napisz to wprost — nie zgaduj i nie zaokrąglaj.
