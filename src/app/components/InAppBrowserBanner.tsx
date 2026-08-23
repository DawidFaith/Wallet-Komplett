'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { useLang } from './LangContext';
import { t } from '../utils/i18n';

const DISMISS_KEY = 'iab-banner-dismissed';

/**
 * Hinweis-Banner, wenn die App im eingebetteten In-App-Browser von Instagram
 * oder Facebook läuft — dort blockieren diese Apps absichtlich die
 * Weiterleitung an native Apps (z.B. TikTok-Links funktionieren dann nicht).
 */
export default function InAppBrowserBanner() {
  const lang = useLang();
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
        <p className="font-bold">{t('inAppBrowser.title', lang)}</p>
        <p className="mt-0.5 leading-relaxed">{t('inAppBrowser.body', lang)}</p>
      </div>
      <button onClick={dismiss} className="shrink-0 p-1 hover:opacity-70 transition-opacity" aria-label={t('btn.close', lang)}>
        <FaTimes size={14} />
      </button>
    </div>
  );
}
