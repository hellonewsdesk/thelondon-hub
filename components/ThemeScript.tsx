export const THEME_STORAGE_KEY = 'lh_theme';

/**
 * Sets `data-theme` on <html> BEFORE first paint.
 *
 * This has to be a blocking inline script in the document head. Anything
 * later — a useEffect, a deferred script — paints the light palette first and
 * then swaps, which is the white-flash every hand-rolled dark mode has. It
 * runs in under a millisecond and touches only one attribute.
 *
 * Reads an explicit choice from localStorage; with none stored it follows the
 * OS. Wrapped in try/catch because localStorage throws outright in a locked-
 * down private window, and a theme preference is never worth a broken page.
 *
 * With JS off the attribute is never set, and globals.css falls back to the
 * `@media (prefers-color-scheme: dark)` block, which is scoped
 * `:root:not([data-theme='light'])` so a stored light choice always wins.
 */
const script = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',(s==='dark'||s==='light')?s:(d?'dark':'light'));}catch(e){}})();`;

export function ThemeScript() {
  return (
    <script
      // Static string defined above — no interpolation of anything dynamic.
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
