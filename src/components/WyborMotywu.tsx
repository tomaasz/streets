'use client';
import { useEffect, useState } from 'react';
type Motyw = 'system' | 'light' | 'dark';
export function WyborMotywu() {
  const [motyw, setMotyw] = useState<Motyw>('system');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('drogi-motyw');
      if (saved === 'light' || saved === 'dark') { setMotyw(saved); document.documentElement.dataset.theme = saved; }
    } catch { /* Motyw działa również bez dostępu do pamięci przeglądarki. */ }
  }, []);
  const zmien = (value: Motyw) => {
    setMotyw(value);
    if (value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    try { localStorage.setItem('drogi-motyw', value); } catch { /* wybór nadal obowiązuje w tej karcie */ }
  };
  return <label className="wybor-motywu">Wygląd
    <select aria-label="Wygląd" value={motyw} onChange={(e) => zmien(e.target.value as Motyw)}>
      <option value="system">System</option><option value="light">Jasny</option><option value="dark">Ciemny</option>
    </select>
  </label>;
}
