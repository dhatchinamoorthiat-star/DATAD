import { createContext, useContext, useEffect, useState } from 'react';
import { applyNativeShellStyles, syncStatusBar } from '../utils/nativeShell';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Light-first: new users get the light theme unless their OS prefers dark.
  // An explicit choice (the in-app toggle) always wins.
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    // The status bar sits outside the WebView, so it does not inherit the
    // `dark` class above — it has to be told separately, and this is the one
    // place that knows the answer. No-op on the web.
    syncStatusBar(dark);
  }, [dark]);

  // Native-only chrome rules (tap highlight, selection, overscroll). Applied
  // once, here, because this provider already wraps the whole tree.
  useEffect(() => {
    applyNativeShellStyles();
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
