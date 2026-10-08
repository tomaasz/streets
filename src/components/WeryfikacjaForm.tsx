'use client';
import { useActionState } from 'react';
import { zapiszWeryfikacje } from '@/app/braki/actions';
import { STATUSY, type StatusPracy } from '@/lib/kolejka-typy';

export function WeryfikacjaForm({ klucz, status, notatka }: { klucz: string; status: StatusPracy; notatka: string }) {
  const [state, action, pending] = useActionState(zapiszWeryfikacje,{ ok: false, komunikat: '' });
  return <form action={action} className="formularz-weryfikacji">
    <input type="hidden" name="klucz" value={klucz} />
    <label>Status pracy<select aria-label="Status pracy" name="status" defaultValue={status}>
      {Object.entries(STATUSY).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Ustalenia i dokumenty<textarea name="notatka" defaultValue={notatka} maxLength={2000} rows={3} placeholder="Opisz sprawdzony przebieg, dokument lub kolejny krok…" /></label>
    <p className="tekst-pomocniczy">Status pracy nie zmienia kategorii drogi ani potwierdzenia jej podstawy prawnej.</p>
    <button className="przycisk primary" type="submit" disabled={pending}>{pending ? 'Zapisuję…' : 'Zapisz ustalenia'}</button>
    <p role="status" className={state.ok ? '' : 'blad-formularza'}>{state.komunikat}</p>
  </form>;
}
