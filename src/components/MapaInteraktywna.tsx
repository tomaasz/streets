'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PlakietkaKategorii } from './Plakietka';
import {StatusNazwyOsm} from './StatusNazwyOsm';
import {linkTargeo} from '@/lib/targeo';
import {SprawdzEmape} from './SprawdzEmape';
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
  slug?: string;
  nazwa: string;
  miejscowosc?: string;
  opis_odcinka?: string;
  uwagi?: string;
  akty?: { numer: string; url_pdf: string | null }[];
  kategoria?: string;
  nr_drogi?: string;
  dlugosc_m?: number;
  pewnosc?: number;
  zarzadca?: number;
  podstawa?: number;
  zrodlo?: number;
  status_nazwy?: 'osm';
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
  const panelSzczegolow = useRef<HTMLElement>(null);
  const ostatniFocus = useRef<HTMLElement | null>(null);
  const wybierz = useRef<(id: string | null, dopasuj?: boolean) => void>(() => {});
  const idPanelu = useId();

  const mapa = useRef<import('ol').Map | null>(null);
  const podklady = useRef<
    Record<string, import('ol/layer/Tile').default<import('ol/source/Tile').default>>
  >({});
  const zasiegDanych = useRef<[number, number, number, number] | null>(null);
  const slowniki = useRef<Slowniki>(PUSTE_SLOWNIKI);

  const [gotowa, setGotowa] = useState(false);
  const [emapa,setEmapa]=useState(false);
  const emapaAktywna=useRef(false);
  const emapaWarstwa=useRef<import('ol/layer/Tile').default | null>(null);
  const [emapaPunkt,setEmapaPunkt]=useState<number[]>();
  const [emapaBlad,setEmapaBlad]=useState(false);
  const [targeoHref,setTargeoHref]=useState<string>();
  const [blad, setBlad] = useState<string | null>(null);
  const [uugStatus,setUugStatus]=useState<string>();
  const [osmStatus,setOsmStatus]=useState<string>();
  const [proba, setProba] = useState(0);
  const [odcinki, setOdcinki] = useState<{ id: string; w: Wlasciwosci }[]>([]);
  const [stronaListy, setStronaListy] = useState(0);
  const [bezNazwy, setBezNazwy] = useState(() => new URLSearchParams(zrodloDanych.split('?')[1]).get('bez_nazwy') === '1');
  const [mobilny, setMobilny] = useState(false);
  const [kartaHref, setKartaHref] = useState('');
  const urlDanych = (() => {
    const [path, query] = zrodloDanych.split('?');
    const sp = new URLSearchParams(query);
    if (bezNazwy) sp.set('bez_nazwy', '1'); else sp.delete('bez_nazwy');
    sp.delete('odcinek');
    return `${path}?${sp}`;
  })();
  useEffect(() => { setBezNazwy(new URLSearchParams(zrodloDanych.split('?')[1]).get('bez_nazwy') === '1'); }, [zrodloDanych]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const zmien = () => setMobilny(media.matches);
    zmien(); media.addEventListener('change', zmien);
    return () => media.removeEventListener('change', zmien);
  }, []);
  const [podklad, setPodklad] = useState(podkladDomyslny);
  const [przygaszony, setPrzygaszony] = useState(false);
  // Wybrany odcinek jest wspólny dla kliknięcia mapy i listy dostępnej z klawiatury.
  const [wybrany, setWybrany] = useState<{
    w: Wlasciwosci;
    wsp: number[];
  } | null>(null);

  useEffect(() => {
    let zerwane = false;
    let sprzataj: (() => void) | undefined;
    const kontroler = new AbortController();
    setGotowa(false);
    setEmapaPunkt(undefined);setEmapaBlad(false);
    setTargeoHref(undefined);
    setBlad(null);
    setUugStatus(undefined);
    setOsmStatus(undefined);
    setWybrany(null);
    setOdcinki([]); setStronaListy(0);
    zasiegDanych.current = null;
    const limit = window.setTimeout(() => {
      kontroler.abort();
      if (!zerwane) setBlad('Przekroczono czas wczytywania mapy (30 s).');
    }, 30_000);

    (async () => {
      try {
        const [
          { Feature, Map: MapaOL, View },
          { default: WarstwaKafli },
          { default: WarstwaWektorowa },
          { default: ZrodloWektorowe },
          { default: ZrodloWMTS },
          { default: SiatkaWMTS },
          { default: FormatGeoJSON },
          { Fill, Stroke, Style, Text },
          { Attribution, FullScreen, ScaleLine, defaults: kontrolki },
          { get: projekcja, transform },
          { register },
          { default: proj4 },
          { default: ZrodloOSM },
          { default: ZrodloWMS },
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
          import('ol/source/TileWMS'),
        ] as const);

        if (zerwane || !kontener.current) return;
        kontroler.signal.throwIfAborted();

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
        const odp = await fetch(urlDanych, { signal: kontroler.signal });
        if (!odp.ok) throw new Error(`dane: HTTP ${odp.status}`);
        const dane = await odp.json();
        if (zerwane || !kontener.current) return;
        slowniki.current = { ...PUSTE_SLOWNIKI, ...(dane.slowniki ?? {}) };
        setUugStatus(dane.uugStatus);
        setOsmStatus(dane.osmStatus);

        const zrodlo = new ZrodloWektorowe({
          features: new FormatGeoJSON().readFeatures(dane, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:2180',
          }),
          attributions:
            dane.osmStatus==='ok' ? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors · ODbL</a>. Nazwy bez potwierdzenia w dokumentach aplikacji.' : 'Przebieg: PRG i BDOT10k — GUGiK. Kategorie: uchwały rady gminy.',
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
            ((w.slug || w.status_nazwy==='osm') && widocznaEtykieta(r)
              ? w.nazwa
              : widocznyNumer(r)
                ? w.nr_drogi
                : '') ?? ''
          );

          return new Style({
            stroke: new Stroke({
              color: w.status_nazwy==='osm' ? '#b45309' : kolor(w.kategoria),
              // odcinek bez kategorii to sama oś ulicy z PRG — kreskowana,
              // żeby nie udawała, że wiemy o niej tyle samo co o reszcie
              lineDash: !w.kategoria || (!w.slug && !w.akty?.length) ? [6, 5] : undefined,
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

        const gminneZrodlo=new ZrodloWMS({url:'https://www.punktyadresowe.pl/cgi-bin/wms/143505',params:{LAYERS:'ulice,punkty',VERSION:'1.1.1',FORMAT:'image/png',TRANSPARENT:true},projection:pl1992,attributions:'<a href="https://wyszkow.e-mapa.net/" target="_blank" rel="noreferrer">Adresy i ulice — Urząd Miejski w Wyszkowie / GEO-SYSTEM</a>'});
        gminneZrodlo.on('tileloaderror',()=>{if(!zerwane)setEmapaBlad(true);});
        emapaWarstwa.current=new WarstwaKafli({source:gminneZrodlo,visible:emapaAktywna.current,maxResolution:20.48,opacity:.85});
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
            emapaWarstwa.current,
            warstwaPodswietlenia,
            warstwaObwodek,
            warstwaKresek,
          ],
          controls: kontrolki({ attribution: false, rotate: false, zoomOptions: { zoomInTipLabel: 'Przybliż mapę', zoomOutTipLabel: 'Oddal mapę' } }).extend([
            new Attribution({ collapsible: true, collapsed: true, tipLabel: 'Źródła i autorzy mapy' }),
            new FullScreen({ tipLabel: 'Pełny ekran' }),
            new ScaleLine({ bar: true, steps: 4, text: true, minWidth: 130 }),
          ]),
        });
        mapa.current = m;
        const aktualizujTargeo=()=>{
          const center=widok.getCenter(),resolution=widok.getResolution();
          if(!center || !resolution) return;
          const [lon,lat]=transform(center,'EPSG:2180','EPSG:4326');
          setTargeoHref(linkTargeo(lon,lat,resolution));
        };
        m.on('moveend',aktualizujTargeo);
        kontener.current.querySelectorAll<HTMLButtonElement>('.ol-control button').forEach((b) => { if (b.title) b.setAttribute('aria-label',b.title); });

        const odcinekPod = (piksel: number[]) =>
          m.forEachFeatureAtPixel(
            piksel,
            (f) => f as import('ol/Feature').default,
            { hitTolerance: 6, layerFilter: (l) => l === warstwaKresek }
          );

        let wybraneFeature: import('ol/Feature').default | null = null;
        const podswietl = (f?: import('ol/Feature').default | null) => {
          zrodloPodswietlenia.clear();
          for (const feature of new Set([f, wybraneFeature])) {
            const geom = feature?.getGeometry();
            if (geom) zrodloPodswietlenia.addFeature(new Feature({ geometry: geom.clone(), kategoria: feature!.get('kategoria') }));
          }
        };
        wybierz.current = (id, dopasowanie = false) => {
          const feature = id ? zrodlo.getFeatureById(id) as import('ol/Feature').default | null : null;
          wybraneFeature = feature;
          podswietl(feature);
          const url = new URL(window.location.href);
          if (feature) url.searchParams.set('odcinek', String(feature.getId())); else url.searchParams.delete('odcinek');
          window.history.replaceState(null, '', url.pathname + url.search);
          if (!feature) { setWybrany(null); return; }
          ostatniFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : kontener.current;
          const ext = feature.getGeometry()!.getExtent();
          setWybrany({ w: feature.getProperties() as Wlasciwosci, wsp: [(ext[0]+ext[2])/2,(ext[1]+ext[3])/2] });
          if (dopasowanie) widok.fit(ext, { padding: [48,48,48,48], minResolution: ROZDZIELCZOSCI_2180[14]*mnoznik, duration: 250 });
          setKartaHref(feature.get('slug') && !url.pathname.startsWith('/ulica/') ? `/ulica/${feature.get('slug')}?powrot=${encodeURIComponent(url.pathname+url.search)}` : '');
        };
        setOdcinki(zrodlo.getFeatures().map((f) => ({ id: String(f.getId()), w: f.getProperties() as Wlasciwosci })));

        // Do warstwy poświaty trafia KOPIA geometrii, nie ten sam obiekt.
        // Jeden `Feature` w dwóch źródłach naraz OpenLayers przyjmuje bez
        // słowa skargi, ale drugiego z nich już nie rysuje.
        let podswietlony: import('ol/Feature').FeatureLike | null = null;
        m.on('pointermove', (e) => {
          if (e.dragging) return;
          const f = odcinekPod(e.pixel);
          const target = m.getTargetElement();
          if (target) target.style.cursor = f ? 'pointer' : '';
          if (podswietlony === (f ?? null)) return;
          podswietlony = f ?? null;
          podswietl(f);
        });

        m.on('singleclick', (e) => {
          const f = odcinekPod(e.pixel);
          wybierz.current(f ? String(f.getId()) : null);
          if(emapaAktywna.current)setEmapaPunkt([...e.coordinate]);
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
        const obserwatorMotywu = new MutationObserver(naZmianeMotywu);
        obserwatorMotywu.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        setGotowa(true);
        aktualizujTargeo();
        const initial = new URLSearchParams(window.location.search).get('odcinek');
        if (initial && zrodlo.getFeatureById(initial)) wybierz.current(initial);

        sprzataj = () => {
          motyw.removeEventListener('change', naZmianeMotywu);
          obserwatorMotywu.disconnect();
          m.setTarget(undefined);
          m.dispose();
        };
      } catch (e) {
        if (!zerwane) setBlad(kontroler.signal.aborted
          ? 'Przekroczono czas wczytywania mapy (30 s).'
          : e instanceof Error ? e.message : String(e));
      } finally {
        window.clearTimeout(limit);
      }
    })();

    return () => {
      zerwane = true;
      window.clearTimeout(limit);
      kontroler.abort();
      sprzataj?.();
      mapa.current = null;
      podklady.current = {};
      emapaWarstwa.current=null;
      wybierz.current = () => {};
    };
  }, [urlDanych, podkladDomyslny, proba]);
  useEffect(()=>{emapaAktywna.current=emapa;emapaWarstwa.current?.setVisible(emapa);if(!emapa)setEmapaPunkt(undefined);},[emapa,gotowa]);

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

  const dopasuj = useCallback(() => {
    const z = zasiegDanych.current;
    if (z) {
      mapa.current
        ?.getView()
        .fit(z, { padding: [28, 28, 28, 28], duration: 250 });
    }
  }, []);

  const zamknijDymek = useCallback(() => {
    wybierz.current(null);
    (ostatniFocus.current?.isConnected ? ostatniFocus.current : kontener.current)?.focus();
  }, []);
  useEffect(() => {
    if (!wybrany) return;
    panelSzczegolow.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); zamknijDymek(); }
      if (mobilny && e.key === 'Tab') {
        const focusables = panelSzczegolow.current?.querySelectorAll<HTMLElement>('button,a[href],input,select,[tabindex="0"]');
        if (!focusables?.length) return;
        const first = focusables[0], last = focusables[focusables.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown',keydown);
    return () => document.removeEventListener('keydown',keydown);
  }, [wybrany, mobilny, zamknijDymek]);

  const s = slowniki.current;
  const d = wybrany?.w;

  return (
    <div className="mapa-aplikacja">
      {gotowa ? <div className="mapa-narzedzia">
        <details className="ustawienia-mapy"><summary>Warstwy i podkład</summary>
          <div className="mapa-panel">
            <fieldset className="mapa-panel-grupa"><legend>Podkład mapy</legend>
              {PODKLADY.map((p) => <label key={p.kod} title={p.opis}>
                <input type="radio" name={`podklad-${idPanelu}`} checked={podklad===p.kod} onChange={() => setPodklad(p.kod)} />{p.nazwa}
              </label>)}
              {targeoHref ? <div className="mapa-targeo">
                <a href={targeoHref} target="_blank" rel="noreferrer" className="przycisk">Targeo — otwórz ten obszar ↗</a>
                <p className="tekst-pomocniczy text-xs mt-1">Osobna mapa w nowej karcie, z aktualnym środkiem i podobnym zbliżeniem.</p>
              </div> : null}
              <label><input type="checkbox" checked={przygaszony} onChange={(e) => setPrzygaszony(e.target.checked)} />Przygaś podkład</label>
            </fieldset>
            <label><input type="checkbox" checked={emapa} onChange={e=>{setEmapa(e.target.checked);setEmapaBlad(false);}}/>Gminna e-mapa — adresy i ulice</label>
            <p className="tekst-pomocniczy text-xs">Dodatkowa warstwa urzędowa. Przybliż mapę i kliknij ulicę, aby odczytać nazwę, SIMC i ULIC.</p>
            {emapa && emapaBlad?<p role="status" className="text-sm">Nie udało się pobrać części warstwy e-mapy. Pozostałe warstwy mapy są dostępne.</p>:null}
            <label><input type="checkbox" checked={bezNazwy} onChange={(e) => {
              const on = e.target.checked; setBezNazwy(on);
              const url = new URL(window.location.href);
              if (on) url.searchParams.set('bez_nazwy','1'); else url.searchParams.delete('bez_nazwy');
              window.history.replaceState(null,'',url.pathname+url.search);
            }} />Drogi bez przypisanej ulicy</label>
            <p className="tekst-pomocniczy">Przerywana linia oznacza dodatkowe odcinki bez potwierdzenia dokumentem lub samą oś ulicy. Przy filtrze miejscowości pokazujemy też odcinki w jej pobliżu.</p>
            {zLegenda ? <div className="legenda-mapy" aria-label="Legenda kategorii">{KATEGORIE.map((k) => <PlakietkaKategorii key={k} kategoria={k} />)}</div> : null}
          </div>
        </details>
        <button type="button" className="przycisk" onClick={dopasuj}>Dopasuj widok</button>
        <span role="status">{odcinki.length} odcinków na mapie</span>
        {emapa ? <span className="tekst-pomocniczy text-sm">e-mapa włączona · kliknij ulicę po przybliżeniu</span> : null}
      </div> : null}
      <div className={`mapa-layout ${d ? 'z-szczegolami' : ''}`}>
        <div className="mapa-plansza karta" style={{ height: wysokosc }}>
          <div ref={kontener} className="mapa-ol" tabIndex={0} role="region" aria-label="Mapa dróg. Strzałki przesuwają mapę, plus i minus zmieniają przybliżenie. Odcinek można wybrać z listy poniżej." />
          {!gotowa ? <div className="mapa-zapasowa" role="status">
            {children ?? <p className="p-4">{blad ? 'Nie udało się wczytać mapy.' : 'Wczytywanie mapy…'}</p>}
            {blad ? <div className="p-4"><p>{blad}{children ? ' Widoczny jest sam przebieg drogi.' : ''}</p>
              <button type="button" className="przycisk mt-2" onClick={() => setProba((p) => p+1)}>Spróbuj ponownie</button></div> : null}
          </div> : null}
        </div>
        {d && mobilny ? <div className="mapa-zaslona" aria-hidden="true" onClick={zamknijDymek} /> : null}
        {d ? <aside ref={panelSzczegolow} className="mapa-szczegoly karta" role={mobilny ? 'dialog' : 'region'} aria-modal={mobilny ? true : undefined} aria-labelledby={`${idPanelu}-tytul`}>
          <div className="szczegoly-naglowek"><h2 id={`${idPanelu}-tytul`} className="font-semibold">{d.nazwa}</h2>
            <button className="przycisk" type="button" onClick={zamknijDymek} aria-label="Zamknij szczegóły odcinka">×</button></div>
          {d.miejscowosc ? <p className="tekst-pomocniczy">{d.miejscowosc}</p> : null}
          {d.status_nazwy==='osm' ? <StatusNazwyOsm/> : null}
          {d.opis_odcinka ? <p className="mt-2">{d.opis_odcinka}</p> : null}
          {d.slug ? <SprawdzEmape key={d.slug} slug={d.slug}/> : null}
          <dl className="szczegoly-dane">
            <dt>Kategoria</dt><dd>{d.kategoria ? <PlakietkaKategorii kategoria={d.kategoria} /> : 'Brak odcinka — widoczna oś ulicy z rejestru'}{d.nr_drogi ? <span className="block mt-1">nr {d.nr_drogi}</span> : null}</dd>
            <dt>Zarządca</dt><dd>{d.zarzadca != null ? s.zarzadcy[d.zarzadca] : 'Nieustalony — wymaga sprawdzenia'}</dd>
            {d.dlugosc_m != null ? <><dt>Długość odcinka</dt><dd>{metryNaKm(d.dlugosc_m)}</dd></> : null}
            <dt>Przebieg</dt><dd>{d.zrodlo != null ? s.zrodla[d.zrodlo]?.nazwa : 'Państwowy rejestr granic (PRG)'}
              {d.zrodlo != null && s.zrodla[d.zrodlo]?.url ? <a className="block" href={s.zrodla[d.zrodlo].url!} target="_blank" rel="noreferrer">Sprawdź źródło przebiegu ↗</a> : null}</dd>
            <dt>Potwierdzenie kategorii</dt><dd>{d.podstawa != null && s.podstawy[d.podstawa] ? s.podstawy[d.podstawa] : 'Brak powiązanej podstawy prawnej w bazie'}
              {d.akty?.map((a) => a.url_pdf ? <a className="block mt-2" key={a.numer} href={a.url_pdf} target="_blank" rel="noreferrer">Uchwała {a.numer} (PDF)</a> : null)}</dd>
            <dt>Status danych</dt><dd>{d.status_nazwy==='osm' ? 'Nazwa z OSM — bez potwierdzenia w dokumentach aplikacji' : d.akty?.length ? 'Powiązane z dokumentem' : d.pewnosc === 2 ? 'Źródło urzędowe — sprawdź podstawę kategorii' : 'Do weryfikacji'}</dd>
          </dl>
          {d.uwagi ? <details className="mt-3"><summary>Uwagi i rozbieżności</summary><p className="mt-2 tekst-pomocniczy">{d.uwagi}</p></details> : null}
          {d.slug && kartaHref ? <a className="przycisk mt-3" href={kartaHref}>Karta ulicy →</a> : null}
        </aside> : null}
      </div>
      {emapa && emapaPunkt ? <SprawdzEmape key={emapaPunkt.join(',')} x={emapaPunkt[0]} y={emapaPunkt[1]} automatycznie/> : null}
      {gotowa ? <details className="lista-odcinkow mt-4" open={odcinki.length<=10}>
        <summary>Lista odcinków ({odcinki.length}) — wybierz bez używania mapy</summary>
        {odcinki.length===0 ? <p className="p-3" role="status">{osmStatus==='niedostepne' ? 'Brak wyników lokalnych. Nie udało się sprawdzić OSM — spróbuj ponownie później.' : osmStatus==='brak' ? 'Brak pasującej nazwy w bazie lokalnej, UUG i aktualnych obiektach OSM.' : uugStatus==='niedostepne' ? 'Brak wyników lokalnych. Usługa UUG jest chwilowo niedostępna — spróbuj ponownie później.' : uugStatus==='brak' ? 'Brak wyników lokalnych. UUG również nie znalazło tej ulicy. Nazwy na podkładzie mapy nie potwierdzają wpisu w PRG.' : 'Brak geometrii spełniających filtry. Zmień wyszukiwanie lub sprawdź kartę ulicy.'}</p> : <>
          <ul>{odcinki.slice(stronaListy*50,(stronaListy+1)*50).map(({ id,w }) => <li key={id}>
            <button type="button" onClick={() => wybierz.current(id,true)}>
              <strong>{w.nazwa}{w.nr_drogi ? ` · ${w.nr_drogi}` : ''}</strong>
              {w.status_nazwy==='osm' ? <StatusNazwyOsm/> : null}
              <span>{w.miejscowosc || w.opis_odcinka || 'Droga bez przypisanej ulicy'} · {w.kategoria ? ETYKIETY_KATEGORII[w.kategoria] : 'Brak odcinka'}</span>
            </button>
          </li>)}</ul>
          {odcinki.length>50 ? <div className="paginacja"><button className="przycisk" disabled={stronaListy===0} onClick={() => setStronaListy((p) => p-1)}>← Poprzednie odcinki</button>
            <span role="status">{stronaListy*50+1}–{Math.min((stronaListy+1)*50,odcinki.length)} z {odcinki.length}</span>
            <button className="przycisk" disabled={(stronaListy+1)*50>=odcinki.length} onClick={() => setStronaListy((p) => p+1)}>Następne odcinki →</button></div> : null}
        </>}
      </details> : null}
    </div>
  );
}
