'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KLUCZE_FILTROW } from '@/lib/filtry';
export function WidokiEksport({ widok }: { widok:'lista'|'mapa' }) {
  const sp=useSearchParams();
  const params=Object.fromEntries(KLUCZE_FILTROW.flatMap((k) => sp.get(k) ? [[k,sp.get(k)!]] : []));
  const query=new URLSearchParams(params);
  return <div className="widoki-i-eksport">
    <nav aria-label="Widok wyników" className="wybor-widoku">
      <Link href={{ pathname:'/',query:params }} aria-current={widok==='lista'?'page':undefined}>Lista</Link>
      <Link href={{ pathname:'/mapa',query:params }} aria-current={widok==='mapa'?'page':undefined}>Mapa</Link>
    </nav>
    <details className="eksport-wynikow"><summary>Eksport wyników</summary><div>
      <a href={`/api/eksport?format=csv&${query}`}>Pobierz CSV</a><a href={`/api/eksport?format=geojson&${query}`}>Pobierz GeoJSON</a>
    </div></details>
  </div>;
}
