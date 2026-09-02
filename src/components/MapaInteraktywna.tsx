'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import {
  DEF_2180,
  PODKLADY,
  ROZDZIELCZOSCI_2180,
  mnoznikEkranu,
  rozdzielczosciWidoku,
  siatkaWmts,
} from '@/lib/geoportal';
import {
  RANGA_KATEGORII,
  szerokoscLinii,
  szerokoscObwodki,
  widocznaEtykieta,
  widocznyNumer,
} from '@/lib/styl-mapy';
import { ETYKIETY_KATEGORII, KATEGORIE, metryNaKm } from '@/lib/typy';

/** Zasięg Polski w PL-1992 — poza niego nie ma po co wyjeżdżać. */
const ZASIEG_POLSKI: [number, number, number, number] = [
  141052, 125827, 880917, 805332,
];

/** Środek gminy Wyszków w PL-1992 — punkt startowy, zanim wejdą dane. */
const SRODEK_GMINY: [number, number] = [666580, 527978];

type Slowniki = {
  zarzadcy: string[];
  podstawy: string[];
  zrodla: { kod: string; nazwa: string; url: string | null }[];
};

/**
 * Właściwości odcinka tak, jak podaje je `/api/mapa`: powtarzalne teksty
 * siedzą w słownikach, a przy odcinku zostaje sam indeks.
 */
type Wlasciwosci = {
  slug: string;
  nazwa: string;
  miejscowosc: string;
  kategoria?: string;
  nr_drogi?: string;
  dlugosc_m?: number;
  pewnosc?: number;
  zarzadca?: number;
  podstawa?: number;
  zrodlo?: number;
};

const PUSTE_SLOWNIKI: Slowniki = { zarzadcy: [], podstawy: [], zrodla: [] };

/**
 * Mapa dróg na podkładzie z Geoportalu, w układzie PL-1992.
 *
 * OpenLayers, a nie Leaflet ani MapLibre — powody stoją w `lib/geoportal.ts`:
 * urzędowa mapa topograficzna i BDOT10k istnieją wyłącznie w EPSG:2180,
 * a spośród bibliotek, które radzą sobie z dowolnym układem współrzędnych,
 * OpenLayers jako jedyna daje przy okazji płynny zoom, renderowanie na
 * canvasie i odsuwanie kolidujących etykiet.
 *
 * Cała biblioteka wchodzi dopiero w `useEffect`, więc na serwerze nie ma jej
 * wcale. Do czasu, aż się doczyta, widać `children` — na stronie ulicy jest to
 * statyczne SVG wyrenderowane na serwerze, więc przebieg drogi jest na ekranie
 * od pierwszej klatki, bez czekania na JavaScript i bez przeskoku układu.
 */
export function MapaInteraktywna({
  zrodloDanych,
  wysokosc = 520,
  podkladDomyslny = 'osm',
  legenda: zLegenda = true,
  children,
}: {
  zrodloDanych: string;
  wysokosc?: number;
  podkladDomyslny?: string;
  /** przy jednej ulicy spis sześciu kategorii to sam szum */
  legenda?: boolean;
  children?: React.ReactNode;
}) {
  const kontener = useRef<HTMLDivElement>(null);
  const dymek = useRef<HTMLDivElement>(null);

  const mapa = useRef<import('ol').Map | null>(null);
  const podklady = useRef<
    Record<string, import('ol/layer/Tile').default<import('ol/source/Tile').default>>
  >({});
  const nakladka = useRef<import('ol').Overlay | null>(null);
  const zasiegDanych = useRef<[number, number, number, number] | null>(null);
  const slowniki = useRef<Slowniki>(PUSTE_SLOWNIKI);

  const [gotowa, setGotowa] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [podklad, setPodklad] = useState(podkladDomyslny);
  const [przygaszony, setPrzygaszony] = useState(false);
  // Razem z właściwościami trzymamy współrzędne kliknięcia: pozycję dymka
  // ustawia osobny efekt, już po tym, jak React wstawi jego treść.
  const [wybrany, setWybrany] = useState<{
    w: Wlasciwosci;
    wsp: number[];
  } | null>(null);

  useEffect(() => {
    let zerwane = false;
    let sprzataj: (() => void) | undefined;

    (async () => {
      try {
        const [
          { Feature, Map: MapaOL, View, Overlay },
          { default: WarstwaKafli },
          { default: WarstwaWektorowa },
          { default: ZrodloWektorowe },
          { default: ZrodloWMTS },
          { default: SiatkaWMTS },
          { default: FormatGeoJSON },
          { Fill, Stroke, Style, Text },
          { Attribution, FullScreen, ScaleLine, defaults: kontrolki },
          { get: projekcja },
          { register },
          { default: proj4 },
          { default: ZrodloOSM },
        ] = await Promise.all([
          import('ol'),
          import('ol/layer/Tile'),
          import('ol/layer/Vector'),
          import('ol/source/Vector'),
          import('ol/source/WMTS'),
          import('ol/tilegrid/WMTS'),
          import('ol/format/GeoJSON'),
          import('ol/style'),
          import('ol/control'),
          import('ol/proj'),
          import('ol/proj/proj4'),
          import('proj4'),
          import('ol/source/OSM'),
        ] as const);

        if (zerwane || !kontener.current) return;

        // ---- układ współrzędnych ------------------------------------
        proj4.defs('EPSG:2180', DEF_2180);
        register(proj4);
        const pl1992 = projekcja('EPSG:2180')!;
        pl1992.setExtent(ZASIEG_POLSKI);

        const mnoznik = mnoznikEkranu();
        const rozdzielczosci = rozdzielczosciWidoku(mnoznik);

        // ---- podkłady -----------------------------------------------
        for (const p of PODKLADY) {
          if (p.kod === 'osm') {
            podklady.current[p.kod] = new WarstwaKafli({
              visible: p.kod === podkladDomyslny,
              source: new ZrodloOSM(),
            });
          } else {
            const siatka = siatkaWmts(p, mnoznik);
            podklady.current[p.kod] = new WarstwaKafli({
              visible: p.kod === podkladDomyslny,
              source: new ZrodloWMTS({
                url: p.url,
                layer: p.warstwa,
                matrixSet: 'EPSG:2180',
                format: p.format,
                style: 'default',
                requestEncoding: 'KVP',
                projection: pl1992,
                wrapX: false,
                tileGrid: new SiatkaWMTS(siatka),
                attributions:
                  '<a href="https://www.geoportal.gov.pl/" target="_blank" rel="noreferrer">Geoportal — GUGiK</a>',
              }),
            });
          }
        }

        // ---- kolory kategorii, prosto z motywu strony ----------------
        let kolory: Record<string, string> = {};
        const odswiezKolory = () => {
          const styl = getComputedStyle(document.documentElement);
          kolory = Object.fromEntries(
            KATEGORIE.map((k) => [
              k,
              styl.getPropertyValue(`--kat-${k}`).trim() || '#8a8a8a',
            ])
          );
        };
        odswiezKolory();
        const kolor = (k?: string) => kolory[k ?? 'nieustalona'] ?? '#8a8a8a';

        // ---- dane ----------------------------------------------------
        const odp = await fetch(zrodloDanych);
        if (!odp.ok) throw new Error(`dane: HTTP ${odp.status}`);
        const dane = await odp.json();
        if (zerwane || !kontener.current) return;
        slowniki.current = { ...PUSTE_SLOWNIKI, ...(dane.slowniki ?? {}) };

        const zrodlo = new ZrodloWektorowe({
          features: new FormatGeoJSON().readFeatures(dane, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2180',
          }),
          attributions:
            'Przebieg: PRG i BDOT10k — GUGiK. Kategorie: uchwały rady gminy.',
        });

        // ---- style ---------------------------------------------------
        // Obwódka i kreska rysują się w dwóch osobnych warstwach, nie jako
        // dwa style jednego odcinka. Inaczej biała obwódka jednej drogi
        // kładłaby się na kolorze drugiej i skrzyżowania wyglądałyby na
        // pocięte.
        const OBWODKA = 'rgba(255,255,255,0.92)';

        const stylObwodki = (
          f: import('ol/Feature').FeatureLike,
          r: number
        ) => {
          const kat = f.get('kategoria') as string | undefined;
          const szer = szerokoscLinii(kat, r);
          return new Style({
            stroke: new Stroke({
              color: OBWODKA,
              width: szerokoscObwodki(szer),
              lineCap: 'round',
              lineJoin: 'round',
            }),
            zIndex: RANGA_KATEGORII[kat ?? 'nieustalona'] ?? 0,
          });
        };

        const stylKreski = (f: import('ol/Feature').FeatureLike, r: number) => {
          const w = f.getProperties() as Wlasciwosci;
          const szer = szerokoscLinii(w.kategoria, r);
          // `String` nie jest tu ozdobą: `ol/render` woła na etykiecie
          // `split`, więc numer drogi, który przyszedł z bazy jako liczba,
          // wysypuje cały rysunek warstwy — razem z podkładem.
          const napis = String(
            (widocznaEtykieta(r) ? w.nazwa : widocznyNumer(r) ? w.nr_drogi : '') ??
              ''
          );

          return new Style({
            stroke: new Stroke({
              color: kolor(w.kategoria),
              // odcinek bez kategorii to sama oś ulicy z PRG — kreskowana,
              // żeby nie udawała, że wiemy o niej tyle samo co o reszcie
              lineDash: w.kategoria ? undefined : [6, 5],
              width: szer,
              lineCap: 'round',
              lineJoin: 'round',
            }),
            text: napis
              ? new Text({
                  text: napis,
                  placement: 'line',
                  overflow: false,
                  maxAngle: Math.PI / 5,
                  font: '600 12px ui-sans-serif, system-ui, sans-serif',
                  fill: new Fill({ color: '#16181d' }),
                  stroke: new Stroke({ color: 'rgba(255,255,255,0.95)', width: 3.5 }),
                })
              : undefined,
            zIndex: RANGA_KATEGORII[w.kategoria ?? 'nieustalona'] ?? 0,
          });
        };

        const warstwaObwodek = new WarstwaWektorowa({
          source: zrodlo,
          style: stylObwodki,
        });
        const warstwaKresek = new WarstwaWektorowa({
          source: zrodlo,
          style: stylKreski,
          declutter: true,
        });

        // Najechany odcinek dostaje ciemną poświatę — rysowaną POD obwódką,
        // nie nad nią. Gruba kreska na wierzchu zasłoniłaby kolor kategorii,
        // czyli akurat to, po co ktoś na tę drogę najeżdża.
        const zrodloPodswietlenia = new ZrodloWektorowe();
        const warstwaPodswietlenia = new WarstwaWektorowa({
          source: zrodloPodswietlenia,
          style: (f, r) =>
            new Style({
              stroke: new Stroke({
                color: 'rgba(17,19,24,0.75)',
                width:
                  szerokoscObwodki(szerokoscLinii(f.get('kategoria'), r)) + 7,
                lineCap: 'round',
                lineJoin: 'round',
              }),
            }),
        });

        // ---- mapa ----------------------------------------------------
        const widok = new View({
          projection: pl1992,
          center: SRODEK_GMINY,
          resolution: rozdzielczosci[8],
          resolutions: rozdzielczosci,
          extent: ZASIEG_POLSKI,
          constrainOnlyCenter: true,
          // mapa urzędowa ma północ u góry i tyle
          enableRotation: false,
        });

        const m = new MapaOL({
          target: kontener.current,
          view: widok,
          layers: [
            ...PODKLADY.map((p) => podklady.current[p.kod]),
            warstwaPodswietlenia,
            warstwaObwodek,
            warstwaKresek,
          ],
          controls: kontrolki({ attribution: false, rotate: false }).extend([
            new Attribution({ collapsible: true, collapsed: true }),
            new FullScreen({ tipLabel: 'Pełny ekran' }),
            new ScaleLine({ bar: true, steps: 4, text: true, minWidth: 130 }),
          ]),
        });
        mapa.current = m;

        // ---- dymek ---------------------------------------------------
        if (dymek.current) {
          nakladka.current = new Overlay({
            element: dymek.current,
            positioning: 'bottom-center',
            offset: [0, -12],
            autoPan: { animation: { duration: 200 } },
          });
          m.addOverlay(nakladka.current);
        }

        const odcinekPod = (piksel: number[]) =>
          m.forEachFeatureAtPixel(
            piksel,
            (f) => f as import('ol/Feature').default,
            { hitTolerance: 6, layerFilter: (l) => l === warstwaKresek }
          );

        // Do warstwy poświaty trafia KOPIA geometrii, nie ten sam obiekt.
        // Jeden `Feature` w dwóch źródłach naraz OpenLayers przyjmuje bez
        // słowa skargi, ale drugiego z nich już nie rysuje.
        let podswietlony: import('ol/Feature').FeatureLike | null = null;
        m.on('pointermove', (e) => {
          if (e.dragging) return;
          const f = odcinekPod(e.pixel);
          m.getTargetElement().style.cursor = f ? 'pointer' : '';
          if (podswietlony === (f ?? null)) return;
          podswietlony = f ?? null;
          zrodloPodswietlenia.clear();
          const g = f?.getGeometry();
          if (g) {
            zrodloPodswietlenia.addFeature(
              new Feature({
                geometry: g.clone(),
                kategoria: f!.get('kategoria'),
              })
            );
          }
        });

        m.on('singleclick', (e) => {
          const f = odcinekPod(e.pixel);
          setWybrany(
            f ? { w: f.getProperties() as Wlasciwosci, wsp: e.coordinate } : null
          );
        });

        // ---- widok na dane -------------------------------------------
        const zasieg = zrodlo.getExtent();
        if (zasieg && Number.isFinite(zasieg[0]) && zasieg[0] <= zasieg[2]) {
          zasiegDanych.current = zasieg as [number, number, number, number];
          widok.fit(zasieg, {
            padding: [28, 28, 28, 28],
            // bez tego pojedynczy, krótki odcinek wjeżdżałby na zbliżenie,
            // przy którym podkład jest już tylko rozmytą plamą
            minResolution: ROZDZIELCZOSCI_2180[14] * mnoznik,
          });
        }

        // motyw strony może się przełączyć w trakcie — kolory kategorii
        // trzeba wtedy przeczytać na nowo i przerysować kreski
        const motyw = window.matchMedia('(prefers-color-scheme: dark)');
        const naZmianeMotywu = () => {
          odswiezKolory();
          warstwaKresek.changed();
        };
        motyw.addEventListener('change', naZmianeMotywu);

        setGotowa(true);

        sprzataj = () => {
          motyw.removeEventListener('change', naZmianeMotywu);
          m.setTarget(undefined);
          m.dispose();
        };
      } catch (e) {
        if (!zerwane) setBlad(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      zerwane = true;
      sprzataj?.();
      mapa.current = null;
      podklady.current = {};
      nakladka.current = null;
    };
  }, [zrodloDanych, podkladDomyslny]);

  // przełączenie podkładu to sama widoczność warstw — mapa nie jest budowana
  // od nowa, więc nie gubi ani pozycji, ani wczytanych kafli
  useEffect(() => {
    for (const [kod, warstwa] of Object.entries(podklady.current)) {
      warstwa?.setVisible(kod === podklad);
    }
  }, [podklad, gotowa]);

  useEffect(() => {
    for (const warstwa of Object.values(podklady.current)) {
      warstwa?.setOpacity(przygaszony ? 0.45 : 1);
    }
  }, [przygaszony, gotowa]);

  // `autoPan` mierzy wysokość dymka w chwili `setPosition`. Wołany prosto
  // z obsługi kliknięcia zmierzyłby pusty div — React wstawia treść dopiero
  // przy następnym renderze — i uznałby, że wszystko się mieści. Efekt biegnie
  // już po wstawieniu treści, więc mapa odsuwa się dokładnie tyle, ile trzeba.
  useEffect(() => {
    nakladka.current?.setPosition(wybrany?.wsp);
  }, [wybrany]);

  const dopasuj = useCallback(() => {
    const z = zasiegDanych.current;
    if (z) {
      mapa.current
        ?.getView()
        .fit(z, { padding: [28, 28, 28, 28], duration: 250 });
    }
  }, []);

  const zamknijDymek = useCallback(() => setWybrany(null), []);

  const s = slowniki.current;
  const d = wybrany?.w;

  return (
    // Kontener mapy musi mieć rozmiar od pierwszej klatki. Gdy jest ukryty
    // przez display:none, OpenLayers widzi 0×0 i `fit` dobiera najmniejsze
    // przybliżenie — mapa otwiera się wtedy na całej Polsce zamiast na gminie.
    // Dlatego zapasowe SVG leży NA mapie, a nie zamiast niej.
    <div className="karta relative overflow-hidden" style={{ height: wysokosc }}>
      <div
        ref={kontener}
        className="mapa-ol"
        style={{ position: 'absolute', inset: 0 }}
      />

      <div ref={dymek} className="mapa-dymek">
        {d ? (
          <>
            <button
              type="button"
              className="mapa-dymek-zamknij"
              onClick={zamknijDymek}
              aria-label="Zamknij"
            >
              ×
            </button>
            <div className="font-semibold">{d.nazwa}</div>
            <div className="text-[var(--tekst-2)]">{d.miejscowosc}</div>
            <dl className="mapa-dymek-dane">
              <dt>Kategoria</dt>
              <dd>
                {d.kategoria ? (
                  <>
                    <span
                      className="mapa-probka"
                      style={{ background: `var(--kat-${d.kategoria})` }}
                    />
                    {ETYKIETY_KATEGORII[d.kategoria] ?? d.kategoria}
                    {d.nr_drogi ? ` nr ${d.nr_drogi}` : ''}
                  </>
                ) : (
                  // brak kategorii znaczy, że do ulicy nie przypisano żadnego
                  // odcinka — rysujemy samą oś z PRG i tak to nazywamy
                  'brak odcinka w bazie — widoczna oś ulicy z PRG'
                )}
              </dd>

              {d.zarzadca != null && s.zarzadcy[d.zarzadca] ? (
                <>
                  <dt>Zarządca</dt>
                  <dd>{s.zarzadcy[d.zarzadca]}</dd>
                </>
              ) : null}

              {d.dlugosc_m != null ? (
                <>
                  <dt>Długość</dt>
                  <dd>{metryNaKm(d.dlugosc_m)}</dd>
                </>
              ) : null}

              {d.podstawa != null && s.podstawy[d.podstawa] ? (
                <>
                  <dt>Podstawa</dt>
                  <dd>{s.podstawy[d.podstawa]}</dd>
                </>
              ) : null}

              {d.zrodlo != null && s.zrodla[d.zrodlo] ? (
                <>
                  <dt>Źródło</dt>
                  <dd>
                    {s.zrodla[d.zrodlo].url ? (
                      <a
                        href={s.zrodla[d.zrodlo].url!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.zrodla[d.zrodlo].nazwa}
                      </a>
                    ) : (
                      s.zrodla[d.zrodlo].nazwa
                    )}
                  </dd>
                </>
              ) : null}

              {d.pewnosc != null ? (
                <>
                  <dt>Pewność</dt>
                  <dd>{d.pewnosc}/3</dd>
                </>
              ) : null}
            </dl>
            <a className="mapa-dymek-link" href={`/ulica/${d.slug}`}>
              Karta ulicy →
            </a>
          </>
        ) : null}
      </div>

      {gotowa ? (
        <div className="mapa-panel">
          <fieldset className="mapa-panel-grupa">
            <legend>Podkład</legend>
            {PODKLADY.map((p) => (
              <label key={p.kod} title={p.opis}>
                <input
                  type="radio"
                  name={`podklad-${zrodloDanych}`}
                  checked={podklad === p.kod}
                  onChange={() => setPodklad(p.kod)}
                />
                {p.nazwa}
              </label>
            ))}
            <label className="mapa-panel-osobno">
              <input
                type="checkbox"
                checked={przygaszony}
                onChange={(e) => setPrzygaszony(e.target.checked)}
              />
              Przygaś podkład
            </label>
          </fieldset>

          {zLegenda ? (
            <fieldset className="mapa-panel-grupa">
              <legend>Kategoria drogi</legend>
              {KATEGORIE.map((k) => (
                <span key={k} className="mapa-panel-wpis">
                  <span
                    className="mapa-probka"
                    style={{ background: `var(--kat-${k})` }}
                  />
                  {ETYKIETY_KATEGORII[k]}
                </span>
              ))}
            </fieldset>
          ) : null}

          <button type="button" className="mapa-panel-przycisk" onClick={dopasuj}>
            Dopasuj widok
          </button>
        </div>
      ) : null}

      {!gotowa ? (
        <div
          style={{ position: 'absolute', inset: 0, background: 'var(--tlo)' }}
          aria-hidden={gotowa}
        >
          {children ?? (
            <div className="p-4 text-sm text-[var(--tekst-2)]">
              {blad ? 'Nie udało się wczytać mapy.' : 'Wczytywanie mapy…'}
            </div>
          )}
          {/*
            Gdy `children` niosą statyczne SVG, awaria mapy jest niewidoczna —
            przebieg drogi dalej stoi na ekranie. Pasek na dole mówi wprost,
            czego brakuje, żeby nikt nie brał zapasowego rysunku za mapę
            z podkładem.
          */}
          {blad ? (
            <p
              className="absolute inset-x-0 bottom-0 m-0 border-t border-[var(--linia)] bg-[var(--tlo-2)] p-2 text-xs text-[var(--tekst-2)]"
              role="status"
            >
              Mapa z podkładem z Geoportalu nie wczytała się ({blad}). Widoczny
              jest sam przebieg drogi.
            </p>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
