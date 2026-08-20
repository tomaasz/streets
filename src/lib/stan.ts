/**
 * Świeżo wdrożony projekt nie ma jeszcze DATABASE_URL ani schematu.
 * Zamiast pięćsetki pokazujemy wtedy instrukcję konfiguracji — dzięki temu
 * pierwszy deployment jest od razu do czegoś przydatny.
 */
export type Wynik<T> =
  | { ok: true; dane: T }
  | { ok: false; blad: string };

const SPODZIEWANE = [
  'DATABASE_URL',
  'does not exist',
  'nie istnieje',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'password authentication failed',
  'Connection terminated',
  'self-signed certificate',
];

export async function zBaza<T>(fn: () => Promise<T>): Promise<Wynik<T>> {
  try {
    return { ok: true, dane: await fn() };
  } catch (e) {
    const blad = e instanceof Error ? e.message : String(e);
    if (SPODZIEWANE.some((s) => blad.includes(s))) return { ok: false, blad };
    throw e;
  }
}
