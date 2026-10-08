export function BrakBazy({ szczegoly }: { szczegoly?: string }) {
  if (szczegoly) console.error('Baza dróg jest niedostępna:', szczegoly);
  return <div className="karta p-6" role="status">
    <h1 className="text-lg font-bold">Dane są chwilowo niedostępne</h1>
    <p className="mt-2">Nie udało się połączyć z bazą dróg. Spróbuj ponownie za chwilę; jeśli problem się powtarza, zgłoś go administratorowi aplikacji.</p>
    <a className="przycisk mt-4" href="">Spróbuj ponownie</a>
  </div>;
}
