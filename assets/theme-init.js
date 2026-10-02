(() => {
  let theme;
  try { theme = localStorage.getItem('cherry-theme'); } catch (_) { /* Optional storage. */ }
  document.documentElement.dataset.theme = theme === 'light' || theme === 'dark' ? theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();
