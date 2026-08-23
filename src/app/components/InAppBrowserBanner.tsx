'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { useLang, useSetLang } from './LangContext';
import { t, type Lang } from '../utils/i18n';

const DISMISS_KEY = 'iab-banner-dismissed';
const LANGS: { code: Lang; label: string }[] = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'pl', label: 'PL' },
];

/**
 * Hinweis-Banner, wenn die App im eingebetteten In-App-Browser von Instagram
 * oder Facebook läuft — dort blockieren diese Apps absichtlich die
 * Weiterleitung an native Apps (z.B. TikTok-Links funktionieren dann nicht).
 * Enthält eine eigene Sprachauswahl, da der Banner schon vor jeder anderen
 * UI (z.B. der Sprachauswahl im Header) sichtbar sein kann.
 */
export default function InAppBrowserBanner() {
  const lang = useLang();
  const setLang = useSetLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    const isInApp = /Instagram/i.test(ua) || /FBAN|FBAV|FB_IAB/i.test(ua);
    if (!isInApp) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch { /* ignore */ }
    setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (!show) return null;

  return (
    <div className="sticky top-0 z-[9999] bg-amber-500 text-black px-4 py-2.5 flex items-start gap-2.5 text-xs shadow-lg">
      <FaExclamationTriangle size={14} className="shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                lang === code ? 'bg-black text-amber-400' : 'bg-black/10 hover:bg-black/20 text-black/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-bold">{t('inAppBrowser.title', lang)}</p>
        <p className="mt-0.5 leading-relaxed">{t('inAppBrowser.body', lang)}</p>
      </div>
      <button onClick={dismiss} className="shrink-0 p-1 hover:opacity-70 transition-opacity" aria-label={t('btn.close', lang)}>
        <FaTimes size={14} />
      </button>
    </div>
  );
}
