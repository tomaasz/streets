import Link from 'next/link';
import { DOZWOLONE_LIMITY } from '@/lib/filtry';

export function Paginacja({ pathname, query, offset, limit, ile }: {
  pathname: '/' | '/braki' | '/akty' | '/drogi'; query: Record<string, string>; offset: number; limit: number; ile: number;
}) {
  const queryBezOffsetu = Object.fromEntries(
    Object.entries(query).filter(([k]) => k !== 'offset')
  );
  return <nav aria-label="Strony wyników" className="paginacja">
    <div className="ui-per-page" role="group" aria-label="Liczba pozycji na stronie">
      <span>Na stronie:</span>
      {DOZWOLONE_LIMITY.map((opt) =>
        opt === limit ? (
          <strong key={opt} aria-current="true">{opt}</strong>
        ) : (
          <Link
            key={opt}
            href={{ pathname, query: { ...queryBezOffsetu, limit: String(opt) } }}
            title={`Pokaż ${opt} pozycji na stronie`}
          >
            {opt}
          </Link>
        )
      )}
    </div>
    {offset > 0 ? <Link className="przycisk" href={{ pathname, query: { ...query, limit: String(limit), offset: Math.max(0, offset - limit) } }}>← Poprzednia</Link> : <span />}
    <span role="status">{ile ? `${offset + 1}–${Math.min(offset + limit, ile)} z ${ile}` : 'Brak wyników'}</span>
    {offset + limit < ile ? <Link className="przycisk" href={{ pathname, query: { ...query, limit: String(limit), offset: offset + limit } }}>Następna →</Link> : <span />}
  </nav>;
}
