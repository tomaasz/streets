'use client';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition, type ReactNode } from 'react';

export function DynamiczneFiltry({ action, children, className }: {action:string;children:ReactNode;className?:string}) {
  const router = useRouter();
  const [pending,startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  useEffect(() => () => { if(timer.current) clearTimeout(timer.current); },[]);
  const aktualizuj = (form:HTMLFormElement) => {
    if(timer.current) clearTimeout(timer.current);
    const params=new URLSearchParams();
    for(const [key,value] of new FormData(form)) if(typeof value==='string' && value.trim()) params.set(key,value.trim());
    params.delete('offset');params.delete('slug');params.delete('odcinek');params.delete('odcinki');params.delete('prg');params.delete('uug');params.delete('osm');params.delete('dodatkowa');
    startTransition(()=>router.replace((action+(params.size?'?'+params:'')) as Route,{scroll:false}));
  };
  return <form method="get" action={action} className={className} aria-busy={pending}
    onSubmit={e=>{e.preventDefault();aktualizuj(e.currentTarget);}}
    onCompositionStart={()=>{composing.current=true;if(timer.current) clearTimeout(timer.current);}}
    onCompositionEnd={e=>{composing.current=false;const form=e.currentTarget;timer.current=setTimeout(()=>aktualizuj(form),450);}}
    onChange={e=>{
      if(composing.current) return;
      const form=e.currentTarget;
      if(timer.current) clearTimeout(timer.current);
      if(e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type==='checkbox')) aktualizuj(form);
      else timer.current=setTimeout(()=>aktualizuj(form),450);
    }}>
    {children}
    <span role="status" className="status-filtrow tekst-pomocniczy text-sm">{pending?'Aktualizuję wyniki…':'Filtry aktualizują wyniki automatycznie.'}</span>
  </form>;
}
