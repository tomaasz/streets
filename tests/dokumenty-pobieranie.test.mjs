import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprawdzAdresDokumentu, pobierzDokument } from '../scripts/lib/pobieranie-dokumentow.mjs';

test('pobieranie: odrzuca nieoficjalne źródła, lokalne adresy i dane logowania',()=>{
  for(const url of ['http://bip.wyszkow.pl/a','https://127.0.0.1/a','https://bip.wyszkow.pl.evil.example/a',
    'https://user:pass@bip.wyszkow.pl/a','https://bip.wyszkow.pl:8443/a','file:///etc/passwd'])
    assert.throws(()=>sprawdzAdresDokumentu(url));
  assert.equal(sprawdzAdresDokumentu('https://bip.wyszkow.pl/pliki/a.pdf').hostname,'bip.wyszkow.pl');
});

test('pobieranie: ponownie sprawdza każdy redirect i nie odpytuje adresu spoza źródeł',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async url=>{calls.push(String(url));return new Response(null,{status:302,headers:{location:'https://127.0.0.1/a'}});});
  await assert.rejects(pobierzDokument('https://bip.wyszkow.pl/a',new AbortController().signal),/źródła urzędowego/);
  assert.equal(calls.length,1);
});

test('pobieranie: egzekwuje limit także gdy serwer pomija Content-Length',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(20),{headers:{'content-type':'application/pdf'}}));
  await assert.rejects(pobierzDokument('https://bip.wyszkow.pl/a.pdf',new AbortController().signal,10),/limit rozmiaru/);
});

test('pobieranie: zachowuje bajty i końcowy adres oficjalnego pliku',async t=>{
  let n=0;
  t.mock.method(globalThis,'fetch',async()=>++n===1
    ?new Response(null,{status:302,headers:{location:'/pliki/a.pdf'}})
    :new Response('%PDF-1.7',{headers:{'content-type':'application/pdf'}}));
  const p=await pobierzDokument('https://bip.wyszkow.pl/start',new AbortController().signal);
  assert.equal(p.url,'https://bip.wyszkow.pl/pliki/a.pdf');assert.equal(p.typ,'application/pdf');assert.equal(p.tresc.toString(),'%PDF-1.7');
});
