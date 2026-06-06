'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { deDE, enUS, plPL } from '@clerk/localizations';
import { useLang } from './LangContext';

const localizationMap = {
  de: deDE,
  en: enUS,
  pl: plPL,
};

export function ClerkLocalizationProvider({ children }: { children: React.ReactNode }) {
  const lang = useLang();
  return <ClerkProvider localization={localizationMap[lang] as never}>{children}</ClerkProvider>;
}
