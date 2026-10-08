import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DZIENNIKI_WOJEWODZKIE,wydawcyGminy} from '../scripts/lib/dzienniki-wojewodzkie.mjs';
import {aktyZApiWydawcy} from '../scripts/lib/edziennik-api.mjs';
import {sprawdzAdresDokumentu} from '../scripts/lib/pobieranie-dokumentow.mjs';
const {gminy}=JSON.parse(readFileSync(new URL('../data/gminy-teryt.json',import.meta.url)));
const akt={LegalActType:'Uchwała',CaseNumber:'X/10/26',Subject:'w sprawie nadania nazwy ulicy',ActDate:'2026-01-02',Year:2026,Position:111,Oid:222,JournalNumber:0,PdfUrl:'GetActPdf.ashx?year=2026&position=111'};

test('katalog GUS: rozróżnia gminę miejską i wiejską oraz pomija części gmin',()=>{
  const boleslawiec=gminy.filter(g=>g.woj==='02' && g.nazwa==='Bolesławiec');
  assert.equal(boleslawiec.length,2);assert.notEqual(boleslawiec[0].kod,boleslawiec[1].kod);
  assert.equal(new Set(gminy.map(g=>g.kod)).size,gminy.length);
  assert(gminy.every(g=>/^\d{6}$/.test(g.kod) && ['gmina miejska','gmina miejska, miasto stołeczne','gmina wiejska','gmina miejsko-wiejska'].includes(g.rodzaj)));
  assert.equal(new Set(gminy.map(g=>g.woj)).size,16);
});

test('wydawcy: ten sam Bolesławiec rozdzielony według rodzaju gminy, błędna siedziba odrzucona',()=>{
  const lista=[
    {Oid:29,Name:'Rada Miasta Bolesławiec',City:'Bolesławiec'},
    {Oid:119,Name:'Rada Gminy Bolesławiec',City:'Bolesławiec'},
    {Oid:193,Name:'Prezydent Miasta Bolesławiec',City:'Bolesławiec'},
    {Oid:488,Name:'Wójt Gminy Bolesławiec',City:'Bolesławiec'},
    {Oid:923,Name:'Prezydent Miasta Zielona Góra',City:'Bolesławiec'},
    {Oid:48,Name:'Rada Powiatu Bolesławieckiego',City:'Bolesławiec'},
    {Oid:99,Name:'Rada Miasta Bolesławiec',City:'Bolesławiec'+'-inne'},
  ];
  // Ostatni rekord ma nazwę gminy w nazwie organu, mimo niepoprawnej siedziby.
  const miasta=gminy.find(g=>g.woj==='02' && g.nazwa==='Bolesławiec' && g.rodzaj==='gmina miejska');
  const wiejska=gminy.find(g=>g.woj==='02' && g.nazwa==='Bolesławiec' && g.rodzaj==='gmina wiejska');
  assert.deepEqual(wydawcyGminy(lista,miasta,gminy).map(p=>p.id),[29,193,99]);
  assert.deepEqual(wydawcyGminy(lista,wiejska,gminy).map(p=>p.id),[119,488]);
});

test('wydawcy: dopasowanie pełnych nazw bez kolizji Białystok/Białostocka i bez TERYT nie zgaduje powiatu',()=>{
  const gmina=gminy.find(g=>g.nazwa==='Białystok');
  assert.deepEqual(wydawcyGminy([
    {Oid:80,Name:'Rada Miasta Białystok',City:'Rada Miasta Białystok'},
    {Oid:53,Name:'Rada Miasta Dąbrowa Białostocka',City:'Dąbrowa Białostocka'},
    {Oid:496,Name:'Wojewoda Podlaski',City:'Białystok'},
  ],gmina,gminy).map(p=>p.id),[80]);
  assert.throws(()=>wydawcyGminy([],{...gmina,kod:'inny'},[gmina,{...gmina,kod:'inny'}]),/jednoznacznie/);
});

test('dzienniki: każda konfiguracja generuje własne publikacje, PDF i metadane bez zmiany organu na Wyszków',()=>{
  for(const d of DZIENNIKI_WOJEWODZKIE) {
    const organ='Rada Miasta Wybranej Gminy';
    const [a]=aktyZApiWydawcy({Publisher:{Name:organ},LegalActs:[akt]},
      {baza:d.baza,nazwaZrodla:d.tytul,nazwaWydawcy:organ,wyszkow:false});
    assert.equal(a.organ,organ);assert.equal(a.zrodlo,d.tytul);
    for(const u of [a.url,a.url_pdf,a.url_metadanych])assert.equal(sprawdzAdresDokumentu(u).origin,d.baza);
    assert.throws(()=>aktyZApiWydawcy({Publisher:{Name:'Inny organ'},LegalActs:[akt]},
      {baza:d.baza,nazwaWydawcy:organ,wyszkow:false}),/Wydawca/);
  }
  assert.throws(()=>sprawdzAdresDokumentu('https://edziennik.mazowieckie.pl.evil.example/akt.pdf'),/Adres/);
});

test('wydawcy: odmiana nazw, łączniki i błędna siedziba nie gubią właściwego organu',()=>{
  for(const [nazwa,organ,City] of [
    ['Tykocin','Rada Miejska w Tykocinie','Rada Gminy Augustów'],
    ['Jelcz-Laskowice','Rada Miejska w Jelczu - Laskowicach','Jelcz - Laskowice'],
    ['Sosnowiec','Rada Miejska w Sosnowcu','Sosnowiec'],
    ['Muszyna','Rada Miasta i Gminy Uzdrowiskowej Muszyna','Muszyna'],
  ]) {
    const gmina=gminy.find(g=>g.nazwa===nazwa);
    assert.deepEqual(wydawcyGminy([{Oid:1,Name:organ,City}],gmina,gminy).map(p=>p.id),[1],nazwa);
  }
  const opole=gminy.find(g=>g.nazwa==='Opole');
  assert.deepEqual(wydawcyGminy([{Oid:490,Name:'Wójt Gminy Pawonków',City:'Opole'}],opole,gminy),[]);
});
