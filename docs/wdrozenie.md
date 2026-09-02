# Wdrożenie: Vercel + darmowy Postgres

Całość mieści się w darmowych planach: Vercel Hobby + Neon Free.

## 1. Baza danych

Aplikacja wymaga PostGIS (migracja `0003_postgis.sql` zakłada rozszerzenie
i na nim stoi upraszczanie geometrii oraz filtrowanie mapy po zasięgu widoku
— patrz `docs/model-danych.md`). W Vercel Marketplace (Project → Storage)
darmowy plan i PostGIS razem mają:

| Provider | PostGIS | Uwagi |
|---|---|---|
| **Neon** | tak | 0,5 GB, baza usypia po nieaktywności; wstrzykuje `DATABASE_URL` |
| **Supabase** | tak | 500 MB, projekt pauzowany po tygodniu bezczynności; wstrzykuje `POSTGRES_URL` |

`Nile` i `Prisma Postgres` mają darmowy plan, ale bez PostGIS — migracja
`0003` zawiedzie na `CREATE EXTENSION postgis`, więc nie nadają się dla tej
aplikacji.

Aplikacja czyta connection string po kolei z `DATABASE_URL`, `POSTGRES_URL`,
`DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING` i `POSTGRES_PRISMA_URL`,
więc integracje Neona i Supabase działają bez dopisywania aliasu.

Używaj **puli połączeń** — na Neonie host z sufiksem `-pooler`, na Supabase
port 6543. Funkcje serverless skalują się w poziomie i bez poolera wyczerpią
limit połączeń bazy.

**Trzymaj funkcje w tym samym regionie co bazę.** Każde żądanie renderuje się
po stronie serwera i wykonuje kilka zapytań, więc podróż przez pół Europy
mnoży się przez ich liczbę. Region ustawia się w `vercel.json` w polu
`regions`: `lhr1` dla bazy w `eu-west-2` (Londyn), `fra1` dla `eu-central-1`
(Frankfurt). Region bazy odczytasz z hosta w connection stringu.

### Baza, której już używasz

Nie trzeba zakładać nowej. Ustaw `DB_SCHEMA` na własną nazwę:

```bash
DB_SCHEMA=drogi DATABASE_URL="postgresql://…" npm run db:migrate
DB_SCHEMA=drogi DATABASE_URL="postgresql://…" npm run db:seed
```

Tabele trafią do schematu `drogi`, a `search_path` ustawia się na każdym
połączeniu, więc nic nie koliduje z tym, co już w bazie jest. Tę samą zmienną
dodaj w Environment Variables na Vercelu.

`--reset` kasuje wyłącznie schemat docelowy. Skasowania `public` skrypt
odmawia bez jawnego `--force` — w bazie współdzielonej zabrałoby to cudze
tabele. Rozszerzenia (`pg_trgm`, `unaccent`, `postgis`) instalują się zawsze
w `public`, bo są wspólne dla całej bazy.

### Schemat i dane — wariant bez instalowania czegokolwiek

W repozytorium jest workflow `Wgraj dane do bazy`, który robi migrację, wsad
i raport na runnerze GitHuba. Connection string zostaje sekretem repozytorium
i nigdzie się nie przewija.

1. **Settings → Secrets and variables → Actions → New repository secret**,
   nazwa `DATABASE_URL`, wartość — pooled connection string.
2. **Actions → Wgraj dane do bazy → Run workflow.** Podaj schemat
   (przy bazie współdzielonej zostaw `drogi`). Migracja zakłada PostGIS
   automatycznie.
3. Raport ze stanem bazy ląduje w podsumowaniu joba i jako artefakt.

### Schemat i dane — z lokalnej maszyny

Potrzebny tylko Node 20+:

```bash
git clone https://github.com/tomaasz/streets && cd streets
npm install
DATABASE_URL="postgresql://…" DB_SCHEMA=drogi npm run db:setup
```

`db:setup` to migracja, wsad i raport w jednym. Wsad idzie do bazy paczkami
po kilkaset wierszy w jednym zapytaniu, więc przez sieć trwa kilkanaście
sekund, a nie kwadrans. Osobno:

```bash
DATABASE_URL="postgresql://…" npm run db:migrate
DATABASE_URL="postgresql://…" npm run db:seed
DATABASE_URL="postgresql://…" npm run raport
```

`npm run db:migrate` zakłada rozszerzenie PostGIS przy okazji (migracja
`0003`) — osobnego kroku nie ma, baza musi je tylko udostępniać (patrz
tabela dostawców wyżej).

## 2. Projekt na Vercelu

### Dwie pułapki, na które łatwo wpaść

**Vercel wciąga `DATABASE_URL` z `.env.example`.** Na ekranie importu pokazuje
się „Environment Variables — 1 Detected" i jeśli przejdziesz dalej bez
sprawdzenia, przykładowa wartość (`user:haslo@ep-xxx-pooler…`) zostaje zapisana
jako zmienna projektu. Potem integracja Storage odmawia podłączenia
z komunikatem *„This project already has an existing environment variable with
name DATABASE_URL"*. Usuń tę zmienną w Settings → Environment Variables
i podłącz bazę jeszcze raz. Atrapa jest szkodliwa także wtedy, gdy obejdziesz
kolizję innym prefiksem: aplikacja sprawdza `DATABASE_URL` jako pierwszy, więc
przesłoniłaby prawdziwy adres.

**Podłączenie bazy nie odświeża działającego deploymentu.** Vercel wstrzykuje
zmienne w momencie tworzenia deploymentu, więc instancja zbudowana przed
podłączeniem Storage nadal ma stary snapshot środowiska i pokazuje ekran
konfiguracji. Po podłączeniu bazy zrób **Deployments → ⋯ → Redeploy**
(build cache może zostać). Najpierw dodaj `DB_SCHEMA`, żeby jeden redeploy
załatwił obie zmienne.

### Import

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   `tomaasz/streets`.
2. Framework wykryje się jako Next.js; nie zmieniaj Build Command ani Output
   Directory.
3. **Environment Variables**: dodaj `DATABASE_URL` dla Production, Preview
   i Development.
4. Deploy.

Zamiast kroku 1 i 3 można podpiąć Neona przez Vercel Marketplace
(Project → Storage → Neon) — integracja sama wstrzykuje `DATABASE_URL`.

Dopóki zmiennej nie ma, aplikacja nie wywala się — pokazuje ekran z tymi
krokami.

## 3. Odświeżanie danych

BDOT10k jest aktualizowany paczkami powiatowymi, PRG na bieżąco. Odświeżenie:

```bash
npm run data:all                       # ~40 min, odpytuje usługi GUGiK
DATABASE_URL="postgresql://…" npm run db:seed
```

`db:seed` jest idempotentny: ulice i drogi aktualizuje po kluczach naturalnych,
a odcinki ze źródła `bdot10k` podmienia w całości. Rekordy wprowadzone ręcznie
(z innym `zrodlo`) przetrwają odświeżenie — to celowe, bo to one mają
`pewnosc = 3`.

Aplikacja renderuje wszystko po stronie serwera (`force-dynamic`), więc po
wgraniu danych nie trzeba przebudowywać deploymentu.

## Koszty

| Element | Plan | Limit, o który można zahaczyć |
|---|---|---|
| Vercel Hobby | darmowy | tylko projekty niekomercyjne |
| Neon Free | darmowy | 0,5 GB danych, baza usypia po nieaktywności |

Cała baza to ok. 6 tys. odcinków i 800 ulic z geometrią — grubo poniżej 100 MB.
Pierwsze zapytanie po dłuższej przerwie potrafi trwać sekundę, bo Neon budzi
uśpioną instancję.
