import Link from 'next/link';

export default function NieZnaleziono() {
  return (
    <div className="karta p-6">
      <h1 className="text-lg font-bold">Nie ma takiej strony</h1>
      <p className="mt-2 text-sm text-[var(--tekst-2)]">
        Ulica mogła zmienić nazwę albo nie ma jej w rejestrze PRG.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/">Wróć do listy ulic</Link>
      </p>
    </div>
  );
}
