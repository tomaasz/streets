const KROKI = [
  {
    tytul: 'Załóż darmową bazę Postgres',
    tresc:
      'Na neon.com (plan Free) utwórz projekt w regionie eu-central-1 i skopiuj pooled connection string — host ma sufiks -pooler. Równie dobrze zadziała Supabase albo Prisma Postgres.',
  },
  {
    tytul: 'Dodaj zmienną DATABASE_URL',
    tresc:
      'W ustawieniach projektu na Vercelu: Settings → Environment Variables → DATABASE_URL, dla Production, Preview i Development. Po dodaniu zrób redeploy.',
  },
  {
    tytul: 'Załóż schemat i wgraj dane',
    tresc:
      'Z lokalnej kopii repozytorium: DATABASE_URL="postgresql://…" npm run db:migrate && npm run db:seed',
  },
];

export function BrakBazy({ szczegoly }: { szczegoly?: string }) {
  return (
    <div className="karta p-6">
      <h1 className="text-lg font-bold">Baza nie jest jeszcze podłączona</h1>
      <p className="mt-2 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Aplikacja jest wdrożona, ale nie ma połączenia z Postgresem. Dane
        źródłowe leżą w repozytorium (<code>data/</code>), więc wypełnienie bazy
        to trzy kroki:
      </p>

      <ol className="mt-4 grid gap-3">
        {KROKI.map((k, i) => (
          <li key={k.tytul} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--linia)] text-xs font-bold">
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-semibold">{k.tytul}</div>
              <p className="text-sm text-[var(--tekst-2)]">{k.tresc}</p>
            </div>
          </li>
        ))}
      </ol>

      {szczegoly ? (
        <p className="mt-5 text-xs text-[var(--tekst-2)]">
          Komunikat z bazy: <code>{szczegoly}</code>
        </p>
      ) : null}
    </div>
  );
}
