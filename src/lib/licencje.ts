/** Wspólny katalog: admin_serwer/wspolne_licencje/sync.py. Odczyt lokalny, bez sieci. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import manifest from '../../package.json';
import catalog from './licencje-katalog.json';

export type LicenseComponent = {
  name: string; version: string; license: string; kind: string; purpose: string;
  repositories: { label: string; url: string }[];
};

type PackageMetadata = {
  version?: string; license?: string; description?: string;
  repository?: string | { url?: string };
};

export function repositoryUrl(value: string): string {
  const normalized = value.replace(/^git\+/, '').replace(/^git:\/\/github.com\//, 'https://github.com/').replace(/\.git$/, '');
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || url.username || url.password || /\s/.test(normalized)) return '';
    return normalized;
  } catch { return ''; }
}

export function licenseLegend(licenses: string[]) {
  const text = licenses.join('\n');
  return catalog.legend.filter(item => item.match.some(token => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i').test(text);
  }));
}

export async function licenseRegistry(): Promise<LicenseComponent[]> {
  const packages = [...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)];
  const components = await Promise.all(packages.map(async (name): Promise<LicenseComponent> => {
    let info: PackageMetadata = {};
    try { info = JSON.parse(await readFile(path.join(process.cwd(), 'node_modules', name, 'package.json'), 'utf8')); }
    catch { /* Brak metadanych jest widoczny w zestawieniu. */ }
    const rawRepo = typeof info.repository === 'string' ? info.repository : info.repository?.url || '';
    const repo = repositoryUrl(rawRepo);
    return {
      name, version: info.version || 'nieustalona', license: info.license || 'nieustalona',
      kind: name in manifest.devDependencies ? 'Narzędzie budowania / typowania' : 'Biblioteka aplikacji',
      purpose: info.description || '', repositories: repo ? [{ label: 'Repozytorium', url: repo }] : [],
    };
  }));
  return [
    {name:'Node.js', version:process.version, license:'MIT', kind:'Środowisko uruchomieniowe', purpose:'Serwer aplikacji.', repositories:[{label:'Repozytorium',url:'https://github.com/nodejs/node'}]},
    ...components,
    {name:'PostgreSQL', version:'—', license:'PostgreSQL License',kind:'Baza danych',purpose:'Przechowywanie danych dróg.',repositories:[{label:'Repozytorium',url:'https://github.com/postgres/postgres'}]},
    {name:'OpenStreetMap',version:'—',license:'ODbL 1.0',kind:'Źródło danych',purpose:'Pomocnicze nazwy ulic; warunki bazy danych są odrębne od licencji aplikacji.',repositories:[]},
    {name:'Dane GUGiK, e-mapa i pozostałe źródła',version:'—',license:'Warunki dostawcy',kind:'Źródła danych',purpose:'Zakres i pochodzenie danych opisuje widok „Rejestry i źródła”. Licencja biblioteki mapowej nie określa praw do podkładu mapy.',repositories:[]},
    {name:'Akty prawa miejscowego',version:'—',license:'Akt normatywny',kind:'Źródło danych',purpose:'Podstawa kategorii i zarządcy drogi.',repositories:[]},
  ];
}

export const licenseNotation = catalog.notation;
