'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const POZYCJE = [
  ['/', 'Ulice i drogi'], ['/mapa', 'Mapa'], ['/braki', 'Uzupełnij dane'],
  ['/drogi', 'Drogi numerowane'], ['/zarzadcy', 'Zarządcy'],
  ['/akty', 'Dokumenty prawne'], ['/zrodla', 'Rejestry i źródła'],
] as const;

export function Nawigacja() {
  const path = usePathname();
  return <nav aria-label="Główna nawigacja" className="nawigacja">
    {POZYCJE.map(([href, label]) => {
      const active = path === href || (href === '/' && path.startsWith('/ulica/'));
      return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>;
    })}
  </nav>;
}
