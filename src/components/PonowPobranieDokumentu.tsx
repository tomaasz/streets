'use client';
import { useActionState } from 'react';
import { ponowPobranieDokumentu } from '@/app/akty/actions';

export function PonowPobranieDokumentu({id}:{id:number}) {
  const [state,action,pending]=useActionState(ponowPobranieDokumentu,{ok:false,komunikat:''});
  return <form action={action} className="mt-2">
    <input type="hidden" name="id" value={id}/>
    <button className="przycisk" disabled={pending}>{pending?'Pobieram…':'Ponów pobranie'}</button>
    <p role="status" className="text-sm mt-1">{state.komunikat}</p>
  </form>;
}
