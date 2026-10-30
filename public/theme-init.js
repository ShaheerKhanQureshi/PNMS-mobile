/* Applies the remembered colour theme before the first paint so the page never flashes the wrong theme.
 * Loaded as a plain same-origin script (the Content-Security-Policy forbids inline scripts).
 * It only reads the non-sensitive "last used" hint ("light" | "dark" | "system"); the per-user preference is
 * resolved by ThemeProvider (src/lib/theme.tsx) as soon as the signed-in user is known. */
(function () {
  try {
    var hint = localStorage.getItem('pnms.theme.hint');
    var dark =
      hint === 'dark' ||
      ((hint === 'system' || !hint) && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#131a17' : '#165d48');
  } catch (e) {
    /* storage unavailable: fall back to the light theme */
  }
})();
