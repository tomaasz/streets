import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Drogi i ulice gminy Wyszków',
  description:
    'Baza ulic gminy Wyszków z kategorią drogi i zarządcą — na danych PRG, BDOT10k i ULDK.',
};

const NAWIGACJA = [
  { href: '/', label: 'Ulice' },
  { href: '/drogi', label: 'Drogi numerowane' },
  { href: '/zarzadcy', label: 'Zarządcy' },
  { href: '/akty', label: 'Akty prawne' },
  { href: '/braki', label: 'Braki' },
  { href: '/zrodla', label: 'Źródła' },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen">
        <header className="border-b border-[var(--linia)]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-base font-bold no-underline text-[var(--tekst)]">
              Drogi gminy Wyszków
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAWIGACJA.map((p) => (
                <Link key={p.href} href={p.href} className="no-underline hover:underline">
                  {p.label}
                </Link>
              ))}
            </nav>
            <a
              href="/api/eksport?format=csv"
              className="ml-auto text-sm no-underline hover:underline"
            >
              Eksport CSV
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-6">{children}</main>

        <footer className="mx-auto max-w-[1200px] px-4 py-8 text-xs text-[var(--tekst-2)]">
          <p>
            Dane pochodzą z zasobów GUGiK (PRG, BDOT10k, ULDK) oraz z BIP gminy i
            powiatu. Kategorie i zarządcy zaimportowani maszynowo mają poziom
            pewności 1 i wymagają potwierdzenia uchwałą albo ewidencją dróg —
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
