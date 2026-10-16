import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// TypeScript 7 udostępnia kompilator CLI, bez dawnego transpileModule.
const output = mkdtempSync(path.join(os.tmpdir(), 'streets-license-test-'));
let functions;
try {
  execFileSync('./node_modules/.bin/tsc', [
    '--ignoreConfig', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'node', '--target', 'ES2022',
    '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck',
    '--outDir', output, 'src/lib/licencje.ts',
  ], { stdio: 'inherit' });
  functions = createRequire(import.meta.url)(path.join(output, 'src/lib/licencje.js'));
} finally { rmSync(output, { recursive: true, force: true }); }
const { repositoryUrl, licenseLegend, licenseRegistry } = functions;

test('Repozytoria: aktywne schematy i poświadczenia są odrzucane', () => {
  for (const value of ['javascript:alert(1)', 'http://github.com/a/b', 'https://user:secret@github.com/a/b', 'https://[', 'https://github.com/a/\nb']) {
    assert.equal(repositoryUrl(value), '', value);
  }
  assert.equal(repositoryUrl('git+https://github.com/a/b.git'), 'https://github.com/a/b');
});

test('Legenda rozróżnia GPL, LGPL i AGPL', () => {
  for (const [value, expected] of [['LGPL-3.0-only', 'LGPL'], ['AGPL-3.0', 'AGPL'], ['GPL-2.0', 'GPL']]) {
    const actual = licenseLegend([value]).map(l => l.id).filter(id => ['GPL', 'LGPL', 'AGPL'].includes(id));
    assert.equal(actual.length, 1);
    assert.equal(actual[0], expected);
  }
  assert(licenseLegend(['nieustalona']).some(l => l.id === 'unknown'));
});

test('Rejestr odczytuje zainstalowane wersje i oznacza narzędzia budowania', async () => {
  const data = await licenseRegistry();
  const next = data.find(c => c.name === 'next');
  const installed = JSON.parse(readFileSync(new URL('../node_modules/next/package.json', import.meta.url)));
  assert.equal(next.version, installed.version);
  assert.equal(next.license, installed.license);
  assert.equal(data.find(c => c.name === 'typescript').kind, 'Narzędzie budowania / typowania');
  for (const component of data) {
    assert.equal(typeof component.license, 'string');
    for (const repo of component.repositories) assert.equal(repositoryUrl(repo.url), repo.url);
  }
});
