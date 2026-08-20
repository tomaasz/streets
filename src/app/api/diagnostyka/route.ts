import { zapytaj } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Sprawdza, czy źródła danych odpowiadają z sieci, w której stoi aplikacja.
 *
 * Powód: część serwisów publicznych blokuje adresy centrów danych. Zanim
 * uruchomi się import, trzeba wiedzieć, skąd w ogóle da się go uruchomić —
 * a to zależy od hosta, nie od kodu.
 *
 * Lista adresów jest stała i wpisana w kod. To nie jest proxy: nie da się
 * podać własnego adresu do odpytania.
 */
const ZRODLA = [
  { kod: 'uug', nazwa: 'GUGiK — Usługa Uniwersalnego Wyszukiwania (PRG)',
    url: 'https://services.gugik.gov.pl/uug/?request=GetAddress&address=Wyszk%C3%B3w,%20Pu' },
  { kod: 'uldk', nazwa: 'GUGiK — ULDK (granice i obręby)',
    url: 'https://uldk.gugik.gov.pl/?request=GetCommuneById&id=143505&result=teryt' },
  { kod: 'bdot10k', nazwa: 'GUGiK — WFS pobierania BDOT10k',
    url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/PobieranieBDOT10k?service=WFS&request=GetCapabilities' },
  { kod: 'bip-gmina', nazwa: 'BIP Gminy Wyszków', url: 'https://bip.wyszkow.pl/' },
  { kod: 'bip-powiat', nazwa: 'BIP Powiatu Wyszkowskiego', url: 'https://bip.powiat-wyszkowski.pl/' },
  { kod: 'edziennik', nazwa: 'Dziennik Urzędowy Woj. Mazowieckiego',
    url: 'https://edziennik.mazowieckie.pl/' },
  { kod: 'edziennik-api', nazwa: 'Dziennik Urzędowy — próba API',
    url: 'https://edziennik.mazowieckie.pl/api/search' },
] as const;

async function sprawdz(z: (typeof ZRODLA)[number]) {
  const start = Date.now();
  try {
    const res = await fetch(z.url, {
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'pl-PL,pl;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    const tekst = (await res.text()).slice(0, 300).replace(/\s+/g, ' ');
    return {
      ...z,
      status: res.status,
      typ: res.headers.get('content-type'),
      ms: Date.now() - start,
      zablokowane: res.status === 403 || /Dostęp zablokowany/i.test(tekst),
      poczatek: tekst.slice(0, 220),
    };
  } catch (e) {
    return {
      ...z,
      status: 0,
      typ: null,
      ms: Date.now() - start,
      zablokowane: true,
      poczatek: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const [zrodla, baza] = await Promise.all([
    Promise.all(ZRODLA.map(sprawdz)),
    zapytaj<{ ulic: string; odcinkow: string; aktow: string }>(
      `SELECT (SELECT COUNT(*) FROM ulica)         AS ulic,
              (SELECT COUNT(*) FROM odcinek_drogi) AS odcinkow,
              (SELECT COUNT(*) FROM akt_prawny)    AS aktow`
    ).catch(() => [{ ulic: '?', odcinkow: '?', aktow: '?' }]),
  ]);

  return Response.json(
    {
      region: process.env.VERCEL_REGION ?? 'lokalnie',
      sprawdzono: new Date().toISOString(),
      baza: baza[0],
      zrodla,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
