'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Lang } from '../utils/i18n';

const LANG_KEY = 'dfaith_language';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: 'de', setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');

  // ?lang= aus der URL hat Vorrang vor dem gespeicherten Wert — ein Link mit
  // z.B. ?lang=pl landet so sofort in der richtigen Sprache, egal auf
  // welcher Seite der App (Startseite, /home, Gewinnspiel-Links, …), auch
  // beim allerersten Besuch bevor localStorage überhaupt existiert.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlLang = new URLSearchParams(window.location.search).get('lang') as Lang | null;
    if (urlLang && ['de', 'en', 'pl'].includes(urlLang)) {
      setLangState(urlLang);
      localStorage.setItem(LANG_KEY, urlLang);
      return;
    }
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && ['de', 'en', 'pl'].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, l);
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext).lang;
}

export function useSetLang(): (l: Lang) => void {
  return useContext(LangContext).setLang;
}
