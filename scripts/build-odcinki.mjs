#!/usr/bin/env node
/**
 * Łączy dwa źródła w tabelę odcinków:
 *   - PRG (data/raw/prg-ulice.json)   — nazwa ulicy, SIMC, SYM_UL, oś ulicy
 *   - BDOT10k (data/raw/bdot-drogi.json) — kategoria zarządzania, numer drogi
 *
 * PRG nie wie, kto drogą zarządza; BDOT nie wie, jak ulica się nazywa.
 * Dopasowanie jest geometryczne: oś drogi z BDOT próbkujemy co 15 m i
 * szukamy najbliższej osi ulicy z PRG w promieniu tolerancji. Odcinek
 * przypisujemy do ulicy, do której należy większość próbek.
 *
 * Wynik: data/odcinki.json — wsad dla scripts/seed.mjs.
 */
import { readFile, writeFile } from 'node:fs/promises';

const TOLERANCJA_M = Number(process.env.TOLERANCJA_M ?? 25);
const KROK_M = 15;
const KOMORKA_M = 50;
const MIN_UDZIAL = 0.5;

const PRG = new URL('../data/raw/prg-ulice.json', import.meta.url);
const BDOT = new URL('../data/raw/bdot-drogi.json', import.meta.url);
const OUT = new URL('../data/odcinki.json', import.meta.url);

// --- lokalna płaska projekcja metryczna wokół gminy -------------------
let lat0 = 0, lon0 = 0, mLat = 110540, mLon = 111320;
const rzut = ([lon, lat]) => [(lon - lon0) * mLon, (lat - lat0) * mLat];

function ustawProjekcje(punkty) {
  lat0 = punkty.reduce((s, p) => s + p[1], 0) / punkty.length;
  lon0 = punkty.reduce((s, p) => s + p[0], 0) / punkty.length;
  mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
}

/** Dogęszcza linię tak, by odstęp między punktami nie przekraczał kroku. */
function dogesc(linia, krok = KROK_M) {
  const out = [];
  for (let i = 0; i < linia.length; i++) {
    out.push(linia[i]);
    if (i + 1 === linia.length) break;
    const [x1, y1] = linia[i];
    const [x2, y2] = linia[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.floor(d / krok);
    for (let k = 1; k <= n; k++) {
      out.push([x1 + ((x2 - x1) * k) / (n + 1), y1 + ((y2 - y1) * k) / (n + 1)]);
    }
  }
  return out;
}

const klucz = (x, y) =>
  `${Math.floor(x / KOMORKA_M)}:${Math.floor(y / KOMORKA_M)}`;

function main(prg, bdot) {
  const wszystkie = [
    ...prg.ulice.flatMap((u) => u.geom?.coordinates?.flat() ?? []),
    ...bdot.drogi.flatMap((d) => d.geom.coordinates.flat()),
  ];
  ustawProjekcje(wszystkie);

  // --- indeks siatkowy osi ulic ---------------------------------------
  const siatka = new Map();
  prg.ulice.forEach((u, idx) => {
    for (const linia of u.geom?.coordinates ?? []) {
      for (const p of dogesc(linia.map(rzut))) {
        const k = klucz(p[0], p[1]);
        let kubelek = siatka.get(k);
        if (!kubelek) siatka.set(k, (kubelek = []));
        kubelek.push([p[0], p[1], idx]);
      }
    }
  });
  process.stderr.write(
    `Indeks: ${prg.ulice.length} ulic, ${siatka.size} komórek siatki\n`
  );

  const zasieg = Math.ceil(TOLERANCJA_M / KOMORKA_M);
  function najblizszaUlica(x, y) {
    let best = null, bestD = TOLERANCJA_M;
    const cx = Math.floor(x / KOMORKA_M), cy = Math.floor(y / KOMORKA_M);
    for (let dx = -zasieg; dx <= zasieg; dx++) {
      for (let dy = -zasieg; dy <= zasieg; dy++) {
        for (const [px, py, idx] of siatka.get(`${cx + dx}:${cy + dy}`) ?? []) {
          const d = Math.hypot(px - x, py - y);
          if (d < bestD) { bestD = d; best = idx; }
        }
      }
    }
    return best;
  }

  // --- dopasowanie każdego odcinka BDOT --------------------------------
  const dopasowane = [];
  for (const d of bdot.drogi) {
    const glosy = new Map();
    let probek = 0;
    for (const linia of d.geom.coordinates) {
      for (const p of dogesc(linia.map(rzut))) {
        probek++;
        const idx = najblizszaUlica(p[0], p[1]);
        if (idx !== null) glosy.set(idx, (glosy.get(idx) ?? 0) + 1);
      }
    }
    let idx = null, ile = 0;
    for (const [k, v] of glosy) if (v > ile) { ile = v; idx = k; }
    const udzial = probek ? ile / probek : 0;
    dopasowane.push({
      ...d,
      ulica_idx: udzial >= MIN_UDZIAL ? idx : null,
      udzial_dopasowania: Number(udzial.toFixed(2)),
    });
  }

  // --- agregacja: jedna ulica + kategoria + numer = jeden odcinek -------
  const grupy = new Map();
  for (const d of dopasowane) {
    const g = `${d.ulica_idx ?? 'x'}|${d.kategoria_bdot}|${d.numer ?? ''}`;
    let rec = grupy.get(g);
    if (!rec) {
      grupy.set(g, (rec = {
        ulica_idx: d.ulica_idx,
        kategoria_bdot: d.kategoria_bdot,
        numer: d.numer,
        nazwa_drogi: d.nazwa,
        klasy: new Set(),
        nawierzchnie: new Set(),
        dlugosc_m: 0,
        czesci: [],
        zrodlowych: 0,
      }));
    }
    rec.klasy.add(d.klasa);
    if (d.nawierzchnia) rec.nawierzchnie.add(d.nawierzchnia);
    rec.dlugosc_m += d.dlugosc_w_gminie_m ?? d.dlugosc_m;
    rec.zrodlowych++;
    rec.czesci.push(...d.geom.coordinates);
  }

  const odcinki = [...grupy.values()].map((r) => ({
    ulica: r.ulica_idx === null ? null : {
      simc: prg.ulice[r.ulica_idx].simc,
      sym_ul: prg.ulice[r.ulica_idx].sym_ul,
      nazwa: prg.ulice[r.ulica_idx].nazwa,
      miejscowosc: prg.ulice[r.ulica_idx].miejscowosc,
    },
    kategoria_bdot: r.kategoria_bdot,
    numer: r.numer,
    nazwa_drogi: r.nazwa_drogi,
    klasa: [...r.klasy].sort().join(', ') || null,
    nawierzchnia: [...r.nawierzchnie].sort().join(', ') || null,
    dlugosc_m: Math.round(r.dlugosc_m),
    odcinkow_bdot: r.zrodlowych,
    geom: { type: 'MultiLineString', coordinates: r.czesci },
  }));

  const bezUlicy = odcinki.filter((o) => !o.ulica);
  const zUlica = odcinki.filter((o) => o.ulica);
  const ulicZDopasowaniem = new Set(
    zUlica.map((o) => `${o.ulica.simc}:${o.ulica.sym_ul}`)
  ).size;

  process.stderr.write(
    `Odcinków po agregacji: ${odcinki.length} ` +
      `(z ulicą ${zUlica.length}, bez ulicy ${bezUlicy.length})\n` +
      `Ulic z przypisaną kategorią: ${ulicZDopasowaniem} / ${prg.ulice.length}\n`
  );

  return {
    zbudowano: new Date().toISOString().slice(0, 10),
    tolerancja_m: TOLERANCJA_M,
    zrodla: { prg: prg.pobrano, bdot: bdot.wersja_bdot },
    statystyki: {
      ulic_prg: prg.ulice.length,
      ulic_z_kategoria: ulicZDopasowaniem,
      odcinkow: odcinki.length,
      odcinkow_bez_ulicy: bezUlicy.length,
    },
    odcinki,
  };
}

const prg = JSON.parse(await readFile(PRG, 'utf8'));
const bdot = JSON.parse(await readFile(BDOT, 'utf8'));
const wynik = main(prg, bdot);
await writeFile(OUT, JSON.stringify(wynik) + '\n');
process.stderr.write(`Zapisano -> ${OUT.pathname}\n`);
