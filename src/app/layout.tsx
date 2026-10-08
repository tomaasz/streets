import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Nawigacja } from '@/components/Nawigacja';
import { WyborMotywu } from '@/components/WyborMotywu';

export const metadata: Metadata = {
  title: 'Drogi i ulice gminy Wyszków',
  description:
    'Baza ulic gminy Wyszków z kategorią drogi i zarządcą — na danych PRG, BDOT10k i ULDK.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen">
        <a className="skip-link" href="#tresc">Przejdź do treści</a>
        <header className="menu-gorne border-b border-[var(--linia)]">
          <div className="naglowek mx-auto max-w-[1440px] px-4">
            <Link href="/" className="text-base font-bold no-underline text-[var(--tekst)]">
              Drogi gminy Wyszków
            </Link>
            <WyborMotywu />
            <Nawigacja />
          </div>
        </header>

        <main id="tresc" tabIndex={-1} className="mx-auto max-w-[1440px] px-4 py-4">{children}</main>

        <footer className="mx-auto max-w-[1440px] px-4 py-8 text-xs text-[var(--tekst-2)]">
          <p className="mb-3"><a href="/api/eksport?format=csv">Eksport całej bazy (CSV)</a></p>
          <p>
            Dane pochodzą z zasobów GUGiK (PRG, BDOT10k, ULDK) oraz z BIP gminy i
            powiatu. Kategorie i zarządcy zaimportowani maszynowo mają status
            „Do weryfikacji” i wymagają potwierdzenia uchwałą albo ewidencją dróg —
            zobacz <Link href="/braki">Braki</Link>.
          </p>
          <p className="mt-2">
            Serwis informacyjny. Nie zastępuje zaświadczenia ani wypisu z
            ewidencji dróg.
          </p>
        </footer>
      </body>
    </html>
  );
}
