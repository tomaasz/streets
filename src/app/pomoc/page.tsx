import Link from 'next/link';
import { UiHelp, UiPageHeading } from '@/components/WspolnyUi';

export const metadata = { title: 'Pomoc' };
export default function Pomoc() {
  return <>
    <div className="ui-help">
      <UiPageHeading title="Centrum pomocy — Drogi i ulice" level="public" lede="Wyszukiwanie ulic, mapa, zarządcy i weryfikacja źródeł." />
      <p className="mb-4"><Link className="ui-button ui-button-primary" href="/">Przejdź do wyszukiwarki dróg</Link></p>
    </div>
    <UiHelp>
      <section className="ui-help-section" id="pomoc-start">
        <h2>Szybki start w 3 krokach</h2>
        <ol>
          <li>Wpisz nazwę ulicy lub numer drogi w wyszukiwarce.</li>
          <li>Zawęź wyniki przez miejscowość, kategorię albo zarządcę.</li>
          <li>Otwórz szczegóły, sprawdź odcinki, dokumenty i źródło danych.</li>
        </ol>
        <p>Informacje można przeglądać bez logowania. Serwis informacyjny nie zastępuje zaświadczenia ani wypisu z ewidencji dróg.</p>
      </section>
      <section className="ui-help-section" id="pomoc-wyszukiwanie">
        <h2>Wyszukiwanie dróg i zarządców</h2>
        <p>Wyszukiwarka pomaga odnaleźć ulicę lub drogę numerowaną. Jeśli wyniki są zbyt wąskie, usuń część frazy i sprawdź wybrane filtry.</p>
        <p><Link href="/drogi">Drogi numerowane</Link> i <Link href="/zarzadcy">Zarządcy</Link> udostępniają dodatkowe sposoby przeglądania bazy. Nazwa drogi otwiera jej szczegóły, odcinki i dostępne dokumenty.</p>
      </section>
      <section className="ui-help-section" id="pomoc-mapa">
        <h2>Mapa i warstwy</h2>
        <p>Na <Link href="/mapa">mapie</Link> wybierz podkład i kliknij odcinek, aby sprawdzić jego dane. Kolory oznaczają kategorie dróg. Opisy przy przełącznikach wyjaśniają znaczenie warstw.</p>
        <p>Warstwy porównawcze i nazwy bez potwierdzenia wymagają sprawdzenia źródła. Dostępność podkładów zależy od usług ich dostawców.</p>
      </section>
      <section className="ui-help-section" id="pomoc-weryfikacja">
        <h2>Dokumenty, źródła i weryfikacja</h2>
        <p>Kategoria zaimportowana maszynowo nie zastępuje uchwały ani ewidencji. <Link href="/braki">Uzupełnij dane</Link> pokazuje pozycje wymagające sprawdzenia.</p>
        <p>W <Link href="/akty">Dokumentach prawnych</Link> znajdziesz materiały do weryfikacji, a <Link href="/zrodla">Rejestry i źródła</Link> opisują pochodzenie danych.</p>
        <p>Znalezienie lub dołączenie dokumentu nie oznacza automatycznego potwierdzenia kategorii i zarządcy drogi. Sprawdź treść dokumentu, datę i zakres obowiązywania.</p>
      </section>
      <section className="ui-help-section" id="pomoc-eksport">
        <h2>Eksport danych</h2>
        <p>Link „Eksport całej bazy (CSV)” w dolnej części strony pobiera dane do arkusza. Eksport całej bazy jest dostępny także <a href="/api/eksport?format=csv">tutaj</a>.</p>
        <p>Przy dalszym wykorzystaniu zachowaj informacje o pochodzeniu danych i ich statusie weryfikacji.</p>
      </section>
      <section className="ui-help-section" id="pomoc-wyglad">
        <h2>Nawigacja i wygląd</h2>
        <p>Przełącznik w nagłówku zmienia jasny i ciemny motyw, a menu aplikacji prowadzi do innych narzędzi urzędu. Wybór motywu jest zapamiętywany w przeglądarce.</p>
        <p>Wyszukiwarka tej pomocy filtruje poradnik. Spis treści prowadzi do rozdziałów, a Escape czyści wyszukiwanie.</p>
      </section>
      <section className="ui-help-section" id="pomoc-faq">
        <h2>Najczęstsze pytania</h2>
        <details><summary>Dlaczego nie znajduję ulicy?</summary><p>Sprawdź miejscowość i pozostałe filtry. Spróbuj fragmentu nazwy lub numeru drogi. Jeśli nadal brakuje wyniku, sprawdź zakres danych w rejestrach i źródłach.</p></details>
        <details><summary>Czy kategoria z importu jest już potwierdzona?</summary><p>Nie. Oznaczenie „Do weryfikacji” wymaga potwierdzenia dokumentem źródłowym, np. uchwałą albo ewidencją dróg.</p></details>
        <details><summary>Dlaczego podkład mapy się nie wczytuje?</summary><p>Sprawdź połączenie oraz inny podkład. Kafle pochodzą od dostawców zewnętrznych i mogą być czasowo niedostępne.</p></details>
      </section>
    </UiHelp>
  </>;
}
