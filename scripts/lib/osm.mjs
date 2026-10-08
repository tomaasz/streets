export function normalizujOsm(s) {
 return s.normalize('NFD').replace(/\p{Mn}/gu,'').replace(/ł/gi,'l').toLowerCase().replace(/^ul(?:ica|\.)?\s+/,'').trim();
}

// OSM API /map zwraca węzły i drogi oddzielnie. Nie budujemy linii,
// jeśli choć jednego węzła brakuje; nie zgadujemy przebiegu ani nazwy.
export function odczytajOsm(dane) {
 if(!Array.isArray(dane?.elements)) throw new Error('Niepoprawna odpowiedź OSM');
 const nodes=new Map();
 for(const n of dane.elements) if(n.type==='node' && Number.isSafeInteger(n.id) && Number.isFinite(n.lon) && Number.isFinite(n.lat) && n.lon>=20 && n.lon<=23 && n.lat>=51 && n.lat<=54) nodes.set(n.id,[n.lon,n.lat]);
 const ways=new Map();
 for(const w of dane.elements) {
  if(w.type!=='way' || !Number.isSafeInteger(w.id) || w.id<=0 || typeof w.tags?.highway!=='string' || typeof w.tags?.name!=='string' || !w.tags.name.trim() || w.tags.name.length>200 || !Array.isArray(w.nodes) || w.nodes.length<2 || w.nodes.length>10000) continue;
  const coordinates=w.nodes.map(id=>nodes.get(id));
  if(coordinates.some(c=>!c) || coordinates.every(c=>c[0]===coordinates[0][0] && c[1]===coordinates[0][1])) continue;
  ways.set(w.id,{way:w.id,nazwa:w.tags.name.trim(),geometry:{type:'LineString',coordinates}});
 }
 return [...ways.values()];
}
