'use client';
import {useId} from 'react';

export function PrzelacznikMapy({nazwa,opis,wlaczone,wylaczone,checked,onChange}:{nazwa:string;opis:string;wlaczone:string;wylaczone:string;checked:boolean;onChange:(checked:boolean)=>void}) {
 const id=useId();
 const pomoc=`${nazwa}\n${opis}\nZaznaczone: ${wlaczone}\nOdznaczone: ${wylaczone}`;
 return <span className="mapa-opcja">
  <label className="mapa-przelacznik"><input type="checkbox" checked={checked} aria-describedby={id} data-ui-tooltip-ref={id} onChange={e=>onChange(e.target.checked)}/>{nazwa}</label>
  <button type="button" className="mapa-info ui-tooltip-trigger" aria-label={`Informacja: ${nazwa}`} data-ui-tooltip-ref={id} data-ui-tooltip-trigger>ⓘ</button>
  <span id={id} className="ui-visually-hidden">{pomoc}</span>
 </span>;
}
