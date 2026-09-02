import { Pool } from 'pg';

import { NAZWY_ZMIENNYCH, connectionString, sprawdzSchemat } from '../../scripts/lib/db.mjs';

// Funkcje serverless na Vercelu żyją krótko i jest ich wiele naraz, więc
// każda instancja trzyma najwyżej jedno połączenie. Na Neonie i Supabase
// i tak łączymy się przez pooler.
const globalny = globalThis as unknown as { pulaPg?: Pool };

export function pula(): Pool {
  if (!globalny.pulaPg) {
    const cs = connectionString();
    if (!cs) {
      throw new Error(
        'Brak connection stringa — nie znalazłem żadnej zmiennej z adresem ' +
          `postgres:// (sprawdzane: ${NAZWY_ZMIENNYCH.join(', ')} oraz dowolna *_URL)`
      );
    }
    // sprawdzSchemat, nie gołe schemat() — waliduje DB_SCHEMA regexem przed
    // interpolacją do SET search_path niżej. To jedyna linia obrony: nazwy
    // schematu nie da się w Postgresie sparametryzować przez $1.
    const nazwa = sprawdzSchemat();
    const pool = new Pool({
      connectionString: cs,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      // rejectUnauthorized: true weryfikuje certyfikat serwera przeciw
      // systemowemu zbiorowi zaufanych CA Node.js — Neon i Supabase (oba
      // wymienione w docs/wdrozenie.md) używają certyfikatów z publicznie
      // zaufanych CA, więc to działa bez dokładania własnego łańcucha.
      // false wyłączałoby tę weryfikację całkowicie: kanał zostaje
      // zaszyfrowany, ale klient przyjąłby certyfikat od kogokolwiek —
      // otwiera to na man-in-the-middle na connection stringu i danych.
      ssl: cs.includes('sslmode=disable') ? false : { rejectUnauthorized: true },
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
