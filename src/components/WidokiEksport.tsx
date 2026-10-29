'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KLUCZE_FILTROW } from '@/lib/filtry';
export function WidokiEksport({ widok }: { widok:'lista'|'mapa' }) {
  const sp=useSearchParams();
  const params=Object.fromEntries(KLUCZE_FILTROW.flatMap((k) => sp.get(k) ? [[k,sp.get(k)!]] : []));
  const query=new URLSearchParams(params);
  return <div className="widoki-i-eksport">
    <Link className="przycisk" href={{ pathname: widok === 'lista' ? '/mapa' : '/', query: params }}>
      {widok === 'lista' ? 'Pokaż na mapie' : 'Pokaż jako listę'}
    </Link>
    <details className="eksport-wynikow"><summary>Eksport wyników</summary><div>
      <a href={`/api/eksport?format=csv&${query}`}>Pobierz CSV</a><a href={`/api/eksport?format=geojson&${query}`}>Pobierz GeoJSON</a>
    </div></details>
  </div>;
}
