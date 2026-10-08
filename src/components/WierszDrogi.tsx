'use client';

import { useState, type ReactNode } from 'react';

export function WierszDrogi({ id, numer, children, mapa, zrodla }: {
  id: number;
  numer: string;
  children: ReactNode;
  mapa: ReactNode;
  zrodla: ReactNode;
}) {
  const [otwarte, setOtwarte] = useState(false);
  const panelId = `zrodla-drogi-${id}`;
  const przyciskId = `przycisk-zrodla-drogi-${id}`;

  return <>
    <tr>
      {children}
      <td className="min-w-[190px]">
        {mapa}
        <button
          id={przyciskId}
          type="button"
          className="zrodla-drogi-przycisk"
          aria-label={`Źródła i dokumenty drogi ${numer}`}
          aria-expanded={otwarte}
          aria-controls={panelId}
          onClick={() => setOtwarte(v => !v)}
        >
          <span aria-hidden="true">{otwarte ? '▾' : '▸'}</span> Źródła i dokumenty
        </button>
      </td>
    </tr>
    <tr hidden={!otwarte} className="zrodla-drogi-wiersz">
      <td colSpan={9}>
        <section id={panelId} aria-labelledby={przyciskId} className="zrodla-drogi-panel">
          <h2 className="font-semibold mb-3">Źródła i dokumenty drogi {numer}</h2>
          {zrodla}
        </section>
      </td>
    </tr>
  </>;
}
