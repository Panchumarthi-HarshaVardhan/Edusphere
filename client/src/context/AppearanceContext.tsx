import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppearancePreference = 'dark' | 'light' | 'system';

interface AppearanceContextValue {
  appearance: AppearancePreference;
  setAppearance: (appearance: AppearancePreference) => void;
}

const STORAGE_KEY = 'edusphere_appearance';
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appearance, setAppearanceState] = useState<AppearancePreference>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = appearance === 'light' || (appearance === 'system' && media.matches);
      document.documentElement.classList.toggle('theme-light', light);
      document.documentElement.classList.toggle('theme-dark', !light);
      document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);

  const setAppearance = (next: AppearancePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    setAppearanceState(next);
  };

  return (
    <AppearanceContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used within AppearanceProvider');
  return context;
};
