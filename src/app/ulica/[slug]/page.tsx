import Link from 'next/link';
import { notFound } from 'next/navigation';
import { odcinkiUlicy, ulica } from '@/lib/zapytania';
import { metryNaKm } from '@/lib/typy';
import { Mapa } from '@/components/Mapa';
import { MapaInteraktywna } from '@/components/MapaInteraktywna';
import { PlakietkaKategorii, PlakietkaPewnosci } from '@/components/Plakietka';

export const dynamic = 'force-dynamic';

export default async function Strona({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const u = await ulica(slug);
  if (!u) notFound();

  const odcinki = await odcinkiUlicy(u.id);

  return (
    <>
      <p className="text-sm">
        <Link href="/" className="no-underline hover:underline">
          ← Wszystkie ulice
        </Link>
      </p>

      <h1 className="mt-2 text-xl font-bold">{u.nazwa_pelna}</h1>
      <p className="text-sm text-[var(--tekst-2)]">
        {u.miejscowosc} · SIMC {u.simc} · SYM_UL {u.sym_ul} ·{' '}
        {metryNaKm(u.dlugosc_m)}
      </p>

      {u.wielu_zarzadcow ? (
        <p className="karta mt-4 border-l-4 p-3 text-sm"
           style={{ borderLeftColor: 'var(--kat-nieustalona)' }}>
          Ulica ma odcinki o różnych zarządcach. Pytanie „kto zarządza tą ulicą”
          nie ma tu jednej odpowiedzi — trzeba wskazać odcinek.
        </p>
      ) : null}

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tekst-2)]">
          Przebieg
        </h2>
        {/*
          Mapa interaktywna dokłada podkład z Geoportalu i zoom, ale wchodzi
          dopiero po stronie przeglądarki. Do tego czasu — i gdy JavaScript
          jest wyłączony albo Geoportal nie odpowiada — widać to samo SVG
          renderowane na serwerze. Przebieg drogi jest więc na ekranie od
          razu, bez pustego prostokąta i bez przeskoku układu.
        */}
        <MapaInteraktywna
          zrodloDanych={`/api/mapa?slug=${encodeURIComponent(u.slug)}`}
          podkladDomyslny="orto"
          wysokosc={420}
          legenda={false}
        >
          <Mapa
            wysokosc={420}
            tlo={false}
            warstwy={[
              // oś ulicy z PRG pod spodem — widać ją tam, gdzie żaden
              // odcinek z BDOT się nie dopasował
              {
                geom: u.geom,
                grubosc: 5,
                etykieta: `${u.nazwa_pelna} — oś ulicy z PRG`,
              },
              ...odcinki.map((o) => ({
                geom: o.geom,
                kategoria: o.kategoria,
                etykieta: `${o.kategoria}${o.nr_drogi ? ` nr ${o.nr_drogi}` : ''} — ${o.zarzadca ?? 'zarządca nieustalony'}`,
                grubosc: 3,
              })),
            ]}
          />
        </MapaInteraktywna>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tekst-2)]">
          Odcinki ({odcinki.length})
        </h2>

        {odcinki.length === 0 ? (
          <p className="karta p-4 text-sm text-[var(--tekst-2)]">
            Do tej ulicy nie przypisano żadnego odcinka drogi. Zwykle znaczy to,
            że oś z BDOT10k nie trafiła w oś ulicy z PRG — sprawdź w terenie albo
            zwiększ tolerancję dopasowania w <code>scripts/build-odcinki.mjs</code>.
          </p>
        ) : (
          <div className="grid gap-3">
            {odcinki.map((o) => (
              <article key={o.id} className="karta p-4">
                <header className="flex flex-wrap items-center gap-2">
                  <PlakietkaKategorii kategoria={o.kategoria} />
                  {o.nr_drogi ? (
                    <span className="text-sm font-semibold">nr {o.nr_drogi}</span>
                  ) : null}
                  <PlakietkaPewnosci pewnosc={o.pewnosc} />
                  <span className="ml-auto text-sm text-[var(--tekst-2)]">
                    {metryNaKm(o.dlugosc_m)}
                  </span>
                </header>

                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <Pole etykieta="Zarządca (formalny)">
                    {o.zarzadca ?? 'nieustalony — wymaga sprawdzenia w EGiB'}
                    {o.jednostka ? (
                      <span className="block text-[var(--tekst-2)]">{o.jednostka}</span>
                    ) : null}
                  </Pole>
                  {o.utrzymujacy ? (
                    <Pole etykieta="Utrzymujący (porozumienie)">{o.utrzymujacy}</Pole>
                  ) : null}
                  {o.podstawa_prawna ? (
                    <Pole etykieta="Podstawa prawna">{o.podstawa_prawna}</Pole>
                  ) : null}
                  {o.klasa ? <Pole etykieta="Klasa drogi">{o.klasa}</Pole> : null}
                  {o.nawierzchnia ? (
                    <Pole etykieta="Nawierzchnia">{o.nawierzchnia}</Pole>
                  ) : null}
                  {o.przebieg ? <Pole etykieta="Przebieg drogi">{o.przebieg}</Pole> : null}
                  <Pole etykieta="Kontakt">
                    {[o.telefon, o.email].filter(Boolean).join(' · ') || '—'}
                    {o.www ? (
                      <a className="block" href={o.www} rel="noreferrer">
                        {o.www}
                      </a>
                    ) : null}
                  </Pole>
                  <Pole etykieta="Źródło">
                    {(() => {
                      let url = o.zrodlo_url;
                      if (o.zrodlo === 'bdot10k') {
                        url = 'https://opendata.geoportal.gov.pl/bdot10k/schemat2021/14/1435_GML.zip';
                      }
                      return url ? (
                        <a href={url} rel="noreferrer" target="_blank">
                          {o.zrodlo_nazwa ?? o.zrodlo}
                        </a>
                      ) : (
                        (o.zrodlo_nazwa ?? o.zrodlo)
                      );
                    })()}
                  </Pole>
                </dl>

                {o.uwagi ? (
                  <p className="mt-3 text-sm text-[var(--tekst-2)]">{o.uwagi}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Pole({ etykieta, children }: { etykieta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--tekst-2)]">
        {etykieta}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
