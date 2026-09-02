import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type VowTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: VowTheme;
  setTheme: (theme: VowTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

function getInitialTheme(): VowTheme {
  try {
    return localStorage.getItem('vow:theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<VowTheme>(getInitialTheme);
  const [showThemeSplash, setShowThemeSplash] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try { localStorage.setItem('vow:theme', theme); } catch { /* storage may be unavailable */ }
  }, [theme]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  function showSplashAfterSwitch() {
    setShowThemeSplash(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowThemeSplash(false), 900);
  }

  function setTheme(nextTheme: VowTheme) {
    setThemeState((current) => {
      if (current === nextTheme) return current;
      return nextTheme;
    });
    showSplashAfterSwitch();
  }

  function toggleTheme() {
    setThemeState((current) => current === 'light' ? 'dark' : 'light');
    showSplashAfterSwitch();
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
    {children}
    {showThemeSplash && (
      <div className="vow-theme-splash" data-theme={theme} role="status" aria-label={`Switched to ${theme} mode`}>
        <img className="vow-theme-splash-logo" src={theme === 'dark' ? '/vow-logo-white.svg' : '/vow-logo.svg'} alt="VOW" />
      </div>
    )}
  </ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() { return useContext(ThemeContext); }
