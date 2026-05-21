import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pepscriptrx-theme';

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggle() { setTheme((t) => (t === 'light' ? 'dark' : 'light')); }

  return { theme, toggle, isDark: theme === 'dark' };
}

// Apply theme before first render to avoid flash
(function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme((stored as 'light' | 'dark') ?? preferred);
})();
