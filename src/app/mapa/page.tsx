import Link from 'next/link';
import { MapaInteraktywna } from '@/components/MapaInteraktywna';
import { FiltryDrog } from '@/components/FiltryDrog';
import { opcjeFiltrow } from '@/lib/zapytania';
import { parametryFiltrow, type ParametryWidoku } from '@/lib/filtry';
import { zBaza } from '@/lib/stan';
import { BrakBazy } from '@/components/BrakBazy';
import { NazwyDodatkowe } from '@/components/NazwyDodatkowe';
import {nazwaDodatkowa} from '@/lib/nazwy-dodatkowe';
export const dynamic = 'force-dynamic';
export const metadata = { title:'Mapa dróg — gmina Wyszków',description:'Wyszukaj drogę i sprawdź jej zarządcę oraz podstawę prawną.' };
export default async function Strona({ searchParams }: { searchParams: Promise<ParametryWidoku> }) {
  const p = await searchParams;
  const params = parametryFiltrow(p);
  const propozycja=nazwaDodatkowa(params.dodatkowa);
  const porownanie=propozycja && params.q===propozycja.kandydat_nr_drogi && params.miejscowosc===propozycja.miejscowosc ? propozycja : undefined;
  const wynik = await zBaza(() => opcjeFiltrow(params));
  if (!wynik.ok) return <BrakBazy szczegoly={wynik.blad} />;
  return <>
    <h1 className="text-xl font-bold">Mapa dróg</h1>
    <p className="mt-1 text-sm tekst-pomocniczy">Znajdź drogę po nazwie lub numerze. Kliknij odcinek albo wybierz go z listy, aby sprawdzić zarządcę i dokumenty.</p>
    {params.droga ? <p className="karta p-3 mt-3 text-sm">Wybrana droga{params.q ? `: ${params.q}` : ''}. Mapa pokazuje jej odcinki w gminie, także bez przypisanej nazwy ulicy. <Link href="/drogi">Wróć do dróg numerowanych</Link></p> : null}
    <FiltryDrog p={p} widok="mapa" opcje={wynik.dane} />
    <NazwyDodatkowe q={params.q} miejscowosc={params.miejscowosc} kategoria={params.kategoria} zarzadca={params.zarzadca}/>
    {porownanie ? <section className="karta p-3 mt-3" aria-label="Porównanie nazwy z innej mapy">
      <h2 className="text-sm font-semibold">{porownanie.nazwa} · {porownanie.miejscowosc}{' '}<span className="status-nazwy-osm">{porownanie.zrodlo} · nazwa bez potwierdzenia</span></h2>
      <p className="text-sm mt-1">Na mapie pokazujemy do porównania drogę {porownanie.kandydat_nr_drogi} z BDOT10k. Powiązanie tej nazwy z odcinkiem jest przybliżone i wymaga weryfikacji. Dokumenty dotyczące drogi nie potwierdzają nadania nazwy „{porownanie.nazwa}”.</p>
      <a href={porownanie.url} target="_blank" rel="noreferrer" className="text-sm">Sprawdź nazwę w {porownanie.zrodlo} ↗</a>
    </section> : null}
    {params.prg ? <p className="karta p-3 mt-3">Porównanie przebiegu: linia przerywana „Przebieg PRG” pokazuje ulicę z rejestru nazw; pozostałe linie to wybrane odcinki BDOT. Sprawdź zgodność przebiegu i jego końców.</p> : null}
    <div className="mt-4"><MapaInteraktywna zrodloDanych={`/api/mapa?${new URLSearchParams(params)}`} wysokosc={620} legenda={false} /></div>
    <details className="mt-4 pomoc-mapy"><summary>Źródła mapy i zakres danych</summary>
      <p className="mt-2 tekst-pomocniczy">Przebieg pochodzi z PRG i BDOT10k. Kategoria może być potwierdzona uchwałą; dokument jest dostępny w szczegółach odcinka. Opcjonalna warstwa pokazuje także drogi bez przypisanej ulicy. Sam wpis w BDOT10k nie potwierdza ich kategorii.</p>
      <p className="mt-2 tekst-pomocniczy">Podkłady: OpenStreetMap i Geoportal GUGiK. Mapa pracuje w układzie PL-1992. Dokładność BDOT10k odpowiada mapie 1:10 000 i nie zastępuje wypisu z ewidencji dróg.</p>
      <p className="mt-2 tekst-pomocniczy">Dodatkowe nazwy z OSM są oznaczone jako „nazwa bez potwierdzenia” i mają bursztynową linię przerywaną. Nazwa ze zgłoszenia Targeo może wskazywać odcinek do porównania; takie powiązanie wymaga weryfikacji dokumentów.</p>
      <p className="mt-2 tekst-pomocniczy">Gminna e-mapa udostępnia urzędową warstwę ulic i adresów. Włącz ją w panelu, przybliż widok i kliknij ulicę. Odczyt nazwy, SIMC i ULIC służy do porównania z naszą bazą; kategoria oraz zarządca wymagają osobnego potwierdzenia.</p>
      <Link className="przycisk mt-2" href="/braki">Przejdź do weryfikacji danych</Link>
    </details>
  </>;
}
