import { Pool } from 'pg';

// Integracje na Vercelu wstrzykują connection string pod różnymi nazwami:
// Neon daje DATABASE_URL, Supabase POSTGRES_URL. Sprawdzamy po kolei, żeby
// nie zmuszać nikogo do ręcznego dopisywania aliasu.
const NAZWY_ZMIENNYCH = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
] as const;

function connectionString(): string | null {
  for (const n of NAZWY_ZMIENNYCH) {
    const v = process.env[n];
    if (v) return v;
  }
  return null;
}

function schemat(): string {
  const s = process.env.DB_SCHEMA || 'public';
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) {
    throw new Error(`DB_SCHEMA="${s}" zawiera niedozwolone znaki`);
  }
  return s;
}

// Funkcje serverless na Vercelu żyją krótko i jest ich wiele naraz, więc
// każda instancja trzyma najwyżej jedno połączenie. Na Neonie i Supabase
// i tak łączymy się przez pooler.
const globalny = globalThis as unknown as { pulaPg?: Pool };

export function pula(): Pool {
  if (!globalny.pulaPg) {
    const cs = connectionString();
    if (!cs) {
      throw new Error(
        `Brak connection stringa — ustaw DATABASE_URL (sprawdzane: ${NAZWY_ZMIENNYCH.join(', ')})`
      );
    }
    const nazwa = schemat();
    const pool = new Pool({
      connectionString: cs,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: cs.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    });
    pool.on('connect', (klient) => {
      void klient.query(`SET search_path TO "${nazwa}", public`);
    });
    globalny.pulaPg = pool;
  }
  return globalny.pulaPg;
}

export async function zapytaj<T extends object = Record<string, unknown>>(
  sql: string,
  parametry: unknown[] = []
): Promise<T[]> {
  const { rows } = await pula().query(sql, parametry);
  return rows as T[];
}
