const KROKI = [
  {
    tytul: 'Podłącz Postgresa',
    tresc:
      'Vercel → Storage → Neon, Supabase, Nile albo Prisma Postgres (wszystkie mają darmowy plan; Neon i Supabase mają też PostGIS). Integracja sama wstrzykuje connection string. Można też podpiąć bazę, której już używasz — patrz niżej.',
  },
  {
    tytul: 'Sprawdź nazwę zmiennej',
    tresc:
      'Aplikacja czyta po kolei DATABASE_URL, POSTGRES_URL, DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING i POSTGRES_PRISMA_URL, więc integracje Neona i Supabase działają bez zmian. Po dodaniu zmiennej zrób redeploy.',
  },
  {
    tytul: 'Załóż schemat i wgraj dane',
    tresc:
      'Z lokalnej kopii repozytorium: DATABASE_URL="postgresql://…" npm run db:migrate && npm run db:seed. Dane źródłowe leżą w katalogu data/, więc trwa to sekundy.',
  },
];

export function BrakBazy({ szczegoly }: { szczegoly?: string }) {
  return (
    <div className="karta p-6">
      <h1 className="text-lg font-bold">Baza nie jest jeszcze podłączona</h1>
      <p className="mt-2 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        Aplikacja jest wdrożona, ale nie ma połączenia z Postgresem. Wszystkie
        dane źródłowe są w repozytorium, więc wypełnienie bazy to trzy kroki:
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

      <p className="mt-5 max-w-[70ch] text-sm text-[var(--tekst-2)]">
        <strong className="text-[var(--tekst)]">Baza współdzielona z innym projektem?</strong>{' '}
        Ustaw <code>DB_SCHEMA=drogi</code> — tabele trafią do własnego schematu
        i nic się nie zderzy. Przy takim ustawieniu <code>db:migrate --reset</code>{' '}
        kasuje wyłącznie ten schemat; skasowania <code>public</code> skrypt
        odmawia bez <code>--force</code>.
      </p>

      {szczegoly ? (
        <p className="mt-5 text-xs text-[var(--tekst-2)]">
          Komunikat z bazy: <code>{szczegoly}</code>
        </p>
      ) : null}
    </div>
  );
}
