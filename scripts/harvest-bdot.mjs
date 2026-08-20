#!/usr/bin/env node
/**
 * Pobiera paczkę BDOT10k dla powiatu i wyciąga z niej warstwę OT_SKDR_L
 * (osie dróg) przyciętą do granic gminy.
 *
 * OT_SKDR_L niesie dokładnie to, czego szukamy:
 *   kategoriaZarzadzania -> krajowa | wojewódzka | powiatowa | gminna | wewnętrzna
 *   numerDrogi           -> S8, 62, 618, 4403W, 440501W ...
 *   klasaDrogi, materialNawierzchni, szerokoscNawierzchni
 *
 * Granica gminy pochodzi z ULDK (uldk.gugik.gov.pl), też w PL-1992,
 * więc przycięcie robimy przed przeliczeniem na WGS84.
 *
 * Wynik: data/raw/bdot-drogi.json
 */
import { writeFile, mkdir, readFile, stat } from 'node:fs/promises';
import { listaWpisow, rozpakuj } from './lib/zip.mjs';
import { pl1992ToWgs84 } from './lib/pl1992.mjs';

const TERC_GMINA = process.env.TERC_GMINA ?? '143505';
const TERYT_POWIAT = TERC_GMINA.slice(0, 4);
const WOJ = TERC_GMINA.slice(0, 2);
const PACZKA = `https://opendata.geoportal.gov.pl/bdot10k/schemat2021/${WOJ}/${TERYT_POWIAT}_GML.zip`;
const CACHE = new URL(`../data/cache/${TERYT_POWIAT}_GML.zip`, import.meta.url);
const OUT = new URL('../data/raw/bdot-drogi.json', import.meta.url);

async function pobierzPaczke() {
  try {
    const s = await stat(CACHE);
    if (s.size > 1_000_000) {
      process.stderr.write(`Paczka z cache (${(s.size / 1e6).toFixed(1)} MB)\n`);
      return readFile(CACHE);
    }
  } catch {
    /* brak cache */
  }
  process.stderr.write(`Pobieram ${PACZKA} ...\n`);
  const res = await fetch(PACZKA, { signal: AbortSignal.timeout(600_000) });
  if (!res.ok) throw new Error(`BDOT10k: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(new URL('.', CACHE), { recursive: true });
  await writeFile(CACHE, buf);
  process.stderr.write(`Pobrano ${(buf.length / 1e6).toFixed(1)} MB\n`);
  return buf;
}

/** Granica gminy z ULDK jako lista pierścieni w PL-1992. */
async function granicaGminy() {
  const res = await fetch(
    `https://uldk.gugik.gov.pl/?request=GetCommuneById&id=${TERC_GMINA}&result=geom_wkt`,
    { signal: AbortSignal.timeout(120_000) }
  );
  const txt = await res.text();
  const linie = txt.split('\n');
  if (linie[0].trim() !== '0') throw new Error(`ULDK: ${linie[0]}`);
  const wkt = linie[1].split(';').pop();
  const pierscienie = [...wkt.matchAll(/\(([-\d.,\s]+)\)/g)].map((m) =>
    m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number))
  );
  return pierscienie;
}

function bbox(pierscienie) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of pierscienie)
    for (const [x, y] of r) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  return [x0, y0, x1, y1];
}

/** Ray casting po wszystkich pierścieniach (dziury w gminie i tak nie występują). */
function wPoligonie(x, y, pierscienie) {
  let w = false;
  for (const r of pierscienie) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) w = !w;
    }
  }
  return w;
}

const TEKST = (blok, tag) => {
  const m = new RegExp(`<ot:${tag}[^>]*>([^<]*)</ot:${tag}>`).exec(blok);
  return m ? m[1].trim() : null;
};

function dlugosc(pkt) {
  let d = 0;
  for (let i = 1; i < pkt.length; i++)
    d += Math.hypot(pkt[i][0] - pkt[i - 1][0], pkt[i][1] - pkt[i - 1][1]);
  return d;
}

async function main() {
  const [zipBuf, pierscienie] = await Promise.all([pobierzPaczke(), granicaGminy()]);
  const [bx0, by0, bx1, by1] = bbox(pierscienie);
  process.stderr.write(
    `Granica gminy ${TERC_GMINA}: bbox ${bx0.toFixed(0)},${by0.toFixed(0)} - ${bx1.toFixed(0)},${by1.toFixed(0)}\n`
  );

  const wpis = listaWpisow(zipBuf).find((w) => w.nazwa.endsWith('OT_SKDR_L.xml'));
  if (!wpis) throw new Error('W paczce nie ma warstwy OT_SKDR_L');
  const xml = rozpakuj(zipBuf, wpis).toString('utf8');
  process.stderr.write(`OT_SKDR_L: ${(xml.length / 1e6).toFixed(1)} MB\n`);

  const drogi = [];
  let wszystkich = 0;
  for (const m of xml.matchAll(/<ot:OT_SKDR_L\b[\s\S]*?<\/ot:OT_SKDR_L>/g)) {
    wszystkich++;
    const blok = m[0];
    const pos = [...blok.matchAll(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/g)];
    if (!pos.length) continue;

    const czesci = pos.map((p) => {
      const liczby = p[1].trim().split(/\s+/).map(Number);
      const pkt = [];
      for (let i = 0; i + 1 < liczby.length; i += 2) pkt.push([liczby[i], liczby[i + 1]]);
      return pkt;
    });

    const wszystkiePkt = czesci.flat();
    // szybki odsiew po bbox, potem test punktowy
    const wBbox = wszystkiePkt.some(
      ([x, y]) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1
    );
    if (!wBbox) continue;

    // Odcinki biegnące granicą należą częściowo do sąsiedniej gminy.
    // Liczymy, ile metrów odcinka leży po naszej stronie, i to zapisujemy —
    // dzięki temu sumy kilometrów nie są zawyżone o cudze drogi.
    let dlWGminie = 0;
    for (const c of czesci) {
      const wsr = c.map(([x, y]) => wPoligonie(x, y, pierscienie));
      for (let i = 1; i < c.length; i++) {
        if (!wsr[i - 1] && !wsr[i]) continue;
        const seg = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
        dlWGminie += wsr[i - 1] && wsr[i] ? seg : seg / 2;
      }
    }
    if (dlWGminie < 1) continue;

    drogi.push({
      id: TEKST(blok, 'lokalnyId'),
      kategoria_bdot: TEKST(blok, 'kategoriaZarzadzania'),
      klasa: TEKST(blok, 'klasaDrogi'),
      numer: TEKST(blok, 'numerDrogi'),
      nazwa: TEKST(blok, 'nazwaDrogi'),
      nawierzchnia: TEKST(blok, 'materialNawierzchni'),
      szerokosc_m: TEKST(blok, 'szerokoscNawierzchni')
        ? Number(TEKST(blok, 'szerokoscNawierzchni'))
        : null,
      dlugosc_m: Math.round(czesci.reduce((s, c) => s + dlugosc(c), 0)),
      dlugosc_w_gminie_m: Math.round(dlWGminie),
      geom: {
        type: 'MultiLineString',
        coordinates: czesci.map((c) =>
          c.map(([x, y]) => pl1992ToWgs84(x, y).map((v) => Number(v.toFixed(6))))
        ),
      },
    });
  }

  const wersja = /<ot:wersja>([^<]+)</.exec(xml)?.[1]?.slice(0, 10) ?? null;
  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        zrodlo: 'GUGiK BDOT10k, warstwa OT_SKDR_L',
        paczka: PACZKA,
        wersja_bdot: wersja,
        terc_gmina: TERC_GMINA,
        pobrano: new Date().toISOString().slice(0, 10),
        liczba_odcinkow: drogi.length,
        drogi,
      },
      null,
      0
    ) + '\n'
  );
  process.stderr.write(
    `W powiecie ${wszystkich} odcinków, w gminie ${drogi.length}. Zapisano -> ${OUT.pathname}\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
