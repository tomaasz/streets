'use client';
import { UiTabs } from './WspolnyUi';
import { usePathname } from 'next/navigation';

const POZYCJE = [
  ['/', 'Ulice i drogi'], ['/mapa', 'Mapa'], ['/braki', 'Uzupełnij dane'],
  ['/drogi', 'Drogi numerowane'], ['/zarzadcy', 'Zarządcy'],
  ['/pomoc', 'Pomoc'], ['/akty', 'Dokumenty prawne'], ['/zrodla', 'Rejestry i źródła'],
] as const;

export function Nawigacja() {
  const path = usePathname();
  return <UiTabs label="Główna nawigacja" items={POZYCJE.map(([url, label]) => ({
    url, label, current: path === url || (url === '/' && path.startsWith('/ulica/')),
  }))} />;
}
