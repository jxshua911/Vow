import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try { localStorage.setItem('vow:theme', theme); } catch { /* storage may be unavailable */ }
  }, [theme]);

  function setTheme(nextTheme: VowTheme) {
    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setThemeState((current) => current === 'light' ? 'dark' : 'light');
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() { return useContext(ThemeContext); }
