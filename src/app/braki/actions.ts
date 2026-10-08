'use server';
import { revalidatePath } from 'next/cache';
import { kolejkaWeryfikacji, STATUSY } from '@/lib/kolejka';
import daneUchwal from '../../../data/raw/uchwaly-kategorie.json';
import { zastosujPowiazanie } from '../../../scripts/lib/powiazania-zatwierdzone.mjs';
import { zapytaj, pula } from '@/lib/db';

export type WynikZapisu = { ok: boolean; komunikat: string };
export async function zapiszWeryfikacje(_previous: WynikZapisu, form: FormData): Promise<WynikZapisu> {
  const klucz = String(form.get('klucz') ?? '');
  const status = String(form.get('status') ?? '');
  const notatka = String(form.get('notatka') ?? '').trim();
  if (!Object.hasOwn(STATUSY,status) || notatka.length > 2000 || klucz.length > 240)
    return { ok: false, komunikat: 'Sprawdź status i długość notatki (maks. 2000 znaków).' };
  if (status === 'wyjasnione' && !notatka)
    return { ok: false, komunikat: 'Opisz ustalenie i dokument, na podstawie którego wyjaśniono pozycję.' };
  try {
    if (!(await kolejkaWeryfikacji()).some((r) => r.klucz === klucz))
      return { ok: false, komunikat: 'Pozycja nie jest już w aktualnej kolejce. Odśwież wyniki.' };
    await zapytaj(`INSERT INTO weryfikacja_rekordu (klucz,status,notatka)
      VALUES ($1,$2,$3) ON CONFLICT (klucz) DO UPDATE SET
      status=EXCLUDED.status,notatka=EXCLUDED.notatka,zmodyfikowano=now() RETURNING klucz`,[klucz,status,notatka]);
    revalidatePath('/braki');
    return { ok: true, komunikat: 'Zapisano status pracy i notatkę.' };
  } catch (e) {
    console.error('Nie udało się zapisać weryfikacji',e);
    return { ok: false, komunikat: 'Nie udało się zapisać zmian. Spróbuj ponownie.' };
  }
}

export async function zatwierdzPowiazanie(_previous:WynikZapisu,form:FormData):Promise<WynikZapisu> {
  const klucz=String(form.get('klucz') ?? '');
  const hash=String(form.get('zrodlo_hash') ?? '');
  const propozycjeHash=String(form.get('propozycje_hash') ?? '');
  const uzasadnienie=String(form.get('uzasadnienie') ?? '').trim();
  const ids=[...new Set(form.getAll('odcinek').map(Number))];
  if(form.get('potwierdzam')!=='tak' || uzasadnienie.length<10 || uzasadnienie.length>2000 || !ids.length || ids.length>20 || ids.some(n=>!Number.isSafeInteger(n)||n<=0))
    return {ok:false,komunikat:'Wybierz odcinek, potwierdź sprawdzenie przebiegu i opisz podstawę zatwierdzenia (10–2000 znaków).'};
  let klient;
  try {
    const rekord=(await kolejkaWeryfikacji()).find(r=>r.klucz===klucz);
    if(!rekord || rekord.blokada || rekord.zrodlo_hash!==hash || rekord.propozycje_hash!==propozycjeHash || !['dopasowania','geometria'].includes(rekord.grupa))
      return {ok:false,komunikat:'Pozycja lub jej źródło zmieniły się. Odśwież propozycje.'};
    const kandydaci=ids.map(id=>rekord.kandydaci?.find(k=>k.id===id));
    if(kandydaci.some(k=>!k)) return {ok:false,komunikat:'Odcinek nie jest już w propozycjach tej pozycji. Odśwież wyniki.'};
    const rodzaj=rekord.akt ? 'uchwala' : 'geometria';
    const [,simc,sym_ul]=klucz.split(':');
    const decyzja={klucz,rodzaj,zrodlo_hash:hash,uzasadnienie,
      cel:{simc,sym_ul,nazwa:rekord.nazwa,miejscowosc:rekord.dane_pozycji?.miejscowosc ?? null,
        odcinki:kandydaci.map(k=>({hash:k!.hash,nr_drogi:k!.nr_drogi,simc:k!.simc,sym_ul:k!.sym_ul,kategoria:k!.kategoria,zarzadca_id:k!.zarzadca_id,pewnosc:k!.pewnosc,dlugosc_m:k!.dlugosc_m}))}};
    klient=await pula().connect();
    await klient.query('BEGIN');
    await klient.query('SELECT pg_advisory_xact_lock(hashtext($1))',[klucz]);
    await zastosujPowiazanie(klient,decyzja,daneUchwal,{sprawdzStan:true});
    await klient.query(`INSERT INTO powiazanie_zatwierdzone(klucz,rodzaj,zrodlo_hash,cel,uzasadnienie)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(klucz) DO UPDATE SET rodzaj=EXCLUDED.rodzaj,
      zrodlo_hash=EXCLUDED.zrodlo_hash,cel=EXCLUDED.cel,uzasadnienie=EXCLUDED.uzasadnienie,utworzono=now()`,
      [klucz,rodzaj,hash,JSON.stringify(decyzja.cel),uzasadnienie]);
    await klient.query('COMMIT');
    for(const path of ['/braki','/','/mapa','/akty','/drogi','/ulica/[slug]']) revalidatePath(path,path.includes('[slug]')?'page':undefined);
    return {ok:true,komunikat:rodzaj==='uchwala' ? 'Powiązano uchwałę z odcinkiem i uzupełniono kategorię oraz zarządcę. Pozycja została rozwiązana.' : 'Przypisano odcinek do ulicy. Ewentualne braki zarządcy lub dokumentów są widoczne w osobnej grupie.'};
  } catch(e) {
    if(klient) await klient.query('ROLLBACK');
    console.error('Zatwierdzenie powiązania',e);
    return {ok:false,komunikat:e instanceof Error && /zmieni|nowsz|nadrz|jednoznacz|przypisan/.test(e.message) ? e.message : 'Nie udało się zatwierdzić powiązania. Zmiany nie zostały zapisane.'};
  } finally {klient?.release();}
}
