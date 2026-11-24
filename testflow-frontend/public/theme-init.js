// Applies the saved (or system) theme before the first paint; a file of its own so the CSP needs no inline script.
(function() {
  try {
    var savedTheme = localStorage.getItem('theme');
    var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemTheme)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    // Storage can be blocked: keep the default theme.
  }
})();
