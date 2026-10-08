import Link from 'next/link';
export function Paginacja({ pathname, query, offset, limit, ile }: {
  pathname: '/' | '/braki'; query: Record<string, string>; offset: number; limit: number; ile: number;
}) {
  return <nav aria-label="Strony wyników" className="paginacja">
    {offset > 0 ? <Link className="przycisk" href={{ pathname, query: { ...query, offset: Math.max(0, offset - limit) } }}>← Poprzednia</Link> : <span />}
    <span role="status">{ile ? `${offset + 1}–${Math.min(offset + limit, ile)} z ${ile}` : 'Brak wyników'}</span>
    {offset + limit < ile ? <Link className="przycisk" href={{ pathname, query: { ...query, offset: offset + limit } }}>Następna →</Link> : <span />}
  </nav>;
}
