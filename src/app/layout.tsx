import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Nawigacja } from '@/components/Nawigacja';
import Script from 'next/script';
import { UiAppBar, UiFooter } from '@/components/WspolnyUi';
import katalog from '../../public/wspolny_ui/aplikacje.json';

export const metadata: Metadata = {
  title: {
    default: 'Drogi i ulice — UM Wyszków',
    template: '%s — Drogi i ulice — UM Wyszków',
  },
  description:
    'Baza ulic gminy Wyszków z kategorią drogi i zarządcą — na danych PRG, BDOT10k i ULDK.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head><link rel="stylesheet" href="/wspolny_ui/ui.css?v=0.11.2" /></head>
      <body className="ui-body" data-ui-access="public">
        <Script src="/streets-ui.js" strategy="beforeInteractive" />
        <Script src="/wspolny_ui/ui.js?v=0.11.2" strategy="beforeInteractive" />
        <UiAppBar appName="Drogi i ulice" apps={katalog.aplikacje.filter(app => !('admin' in app && app.admin))} />
        <Nawigacja />

        <main id="tresc" tabIndex={-1} className="ui-main">{children}</main>

        <footer className="streets-informacje px-4 py-4 text-xs text-[var(--tekst-2)]">
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
        <UiFooter appName="Drogi i ulice" links={[{ label: 'Pomoc', url: '/pomoc' }, { label: 'Licencje', url: '/licencje' }]} />
      </body>
    </html>
  );
}
