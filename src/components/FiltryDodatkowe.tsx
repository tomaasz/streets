'use client';
import { useEffect, useState } from 'react';
export function FiltryDodatkowe({ aktywne, children, desktopOpen=true }: { aktywne: number; desktopOpen?:boolean; children: React.ReactNode }) {
  const [open,setOpen]=useState(desktopOpen);
  useEffect(() => { const media=window.matchMedia('(max-width:640px)');const update=()=>setOpen(aktywne>0 || (desktopOpen && !media.matches));update();media.addEventListener('change',update);return ()=>media.removeEventListener('change',update); },[aktywne,desktopOpen]);
  return <details className="filtry-dodatkowe" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary>Filtry{aktywne ? ` (${aktywne} aktywne)` : ''}</summary><div className="pola-filtrow">{children}</div>
  </details>;
}
