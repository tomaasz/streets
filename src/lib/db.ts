import { Pool } from 'pg';

// Funkcje serverless na Vercelu żyją krótko i jest ich wiele naraz, więc
// każda instancja trzyma najwyżej jedno połączenie. Na Neonie i tak
// łączymy się przez pooler (host z sufiksem -pooler).
const globalny = globalThis as unknown as { pulaPg?: Pool };

export function pula(): Pool {
  if (!globalny.pulaPg) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Brak zmiennej DATABASE_URL');
    globalny.pulaPg = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: connectionString.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    });
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
