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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClerkProvider localization={localizationMap[lang] as any}>{children}</ClerkProvider>;
}
