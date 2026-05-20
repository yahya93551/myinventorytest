'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ThemeContextType = {
  dark: boolean;
  setDark: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme-preference');
    if (saved) {
      setDark(saved === 'dark');
    }
    setMounted(true);
  }, []);

  // Persist theme to localStorage
  const handleSetDark = (value: boolean) => {
    setDark(value);
    localStorage.setItem('theme-preference', value ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ dark, setDark: handleSetDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
