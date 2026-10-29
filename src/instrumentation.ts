/**
 * Automatyczne raportowanie nieobsłużonych wyjątków serwerowych Next.js (Node.js) do lokalnego Bugsinka.
 */

const BUGSINK_URL = 'http://192.168.0.12:8005/api/6/store/?sentry_key=6b69a4b58d1840088f95fc93cf821691&sentry_version=7';

function hex32(): string {
  let out = '';
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

export async function onRequestError(
  err: { digest?: string } & Error,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  try {
    const payload = {
      event_id: hex32(),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      logger: 'streets',
      server_name: 'wwyubuapp3',
      request: {
        url: `http://192.168.0.12:3000${request.path || '/'}`,
        method: request.method || 'GET',
      },
      tags: {
        routePath: context.routePath,
        routeType: context.routeType,
      },
      exception: {
        values: [
          {
            type: err?.name || 'Error',
            value: err?.message || String(err),
          },
        ],
      },
    };
    await fetch(BUGSINK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignoruj błędy połączenia z lokalnym Bugsinkiem
  }
}

