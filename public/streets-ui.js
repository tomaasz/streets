/* Drogi i ulice: domyślnie ciemny motyw; zachowaj ręczny wybór i starsze ustawienie. */
(function () {
  try {
    var saved = localStorage.getItem('ui-theme');
    if (saved !== 'light' && saved !== 'dark') {
      var previous = localStorage.getItem('drogi-motyw');
      localStorage.setItem('ui-theme', previous === 'light' || previous === 'dark' ? previous : 'dark');
    }
  } catch (error) { /* Brak dostępu do pamięci nie blokuje uruchomienia aplikacji. */ }
})();
