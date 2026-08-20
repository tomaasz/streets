# Wdrożenie: Vercel + darmowy Postgres

Całość mieści się w darmowych planach: Vercel Hobby + Neon Free.

## 1. Baza danych

Polecany **[Neon](https://neon.com)** — plan Free, region `eu-central-1
(Frankfurt)`, ma PostGIS i `pg_trgm`. Alternatywy z darmowym planem:
[Supabase](https://supabase.com) (też PostGIS) i
[Prisma Postgres](https://www.prisma.io/postgres).

Po założeniu projektu skopiuj **pooled** connection string — na Neonie host ma
sufiks `-pooler`:

```
postgresql://user:haslo@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Pula jest istotna: funkcje serverless na Vercelu skalują się w poziomie i bez
poolera wyczerpią limit połączeń bazy.

### Schemat i dane

Z lokalnej kopii repozytorium, wskazując na chmurę:

```bash
DATABASE_URL="postgresql://…" npm run db:migrate
DATABASE_URL="postgresql://…" npm run db:seed
```

Jeśli baza ma PostGIS i chcesz zapytań przestrzennych:

```bash
DATABASE_URL="postgresql://…" node scripts/migrate.mjs --postgis
```

## 2. Projekt na Vercelu

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
