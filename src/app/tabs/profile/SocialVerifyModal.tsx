'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook,
  FaCheck, FaSync, FaCopy, FaUnlink, FaChevronRight, FaUserCheck,
} from 'react-icons/fa';
import { t, tFmt, type Lang } from '../../utils/i18n';

type Platform = 'instagram' | 'tiktok' | 'facebook';

const PLATFORM_CONFIG = {
  instagram: {
    icon: <FaInstagram size={22} className="text-pink-500" />,
    label: 'Instagram',
    color: 'pink',
    handlePrefix: '@',
    profileUrl: (_handle: string) => `https://www.instagram.com/dfaith_ecosystem/`,
  },
  tiktok: {
    icon: <FaTiktok size={20} className="text-zinc-100" />,
    label: 'TikTok',
    color: 'zinc',
    handlePrefix: '@',
    profileUrl: (handle: string) => `https://www.tiktok.com/@${handle}`,
  },
  facebook: {
    icon: <FaFacebook size={22} className="text-blue-500" />,
    label: 'Facebook',
    color: 'blue',
    handlePrefix: '',
    profileUrl: (_handle: string) => `https://www.facebook.com/1144846495374893`,
  },
};

interface SocialVerifyModalProps {
  platform: Platform;
  walletAddress: string;
  currentHandle: string | null;
  currentVerified: boolean;
  currentName: string | null;
  currentPicture: string | null;
  lang: Lang;
  onDone: () => void;
  onClose: () => void;
}

type Step = 'start' | 'preview' | 'instructions' | 'success' | 'error';

export default function SocialVerifyModal({
  platform,
  walletAddress,
  currentHandle,
  currentVerified,
  currentName,
  currentPicture,
  lang,
  onDone,
  onClose,
}: SocialVerifyModalProps) {
  const cfg = PLATFORM_CONFIG[platform];
  const cacheKey = `social_preview_${platform}_${walletAddress}`;
  const fingerprintRef = useRef<string | null>(null);

  // Fingerprint im Hintergrund laden
  useEffect(() => {
    let cancelled = false;
    import('@fingerprintjs/fingerprintjs').then(FingerprintJS => {
      FingerprintJS.load().then(fp => fp.get()).then(result => {
        if (!cancelled) fingerprintRef.current = result.visitorId;
      }).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Cache-Hilfsfunktionen
  const savePreviewCache = (h: string, p: { name: string; picture: string; verificationCode: string }) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ handle: h, ...p, ts: Date.now() }));
    } catch { /* ignore */ }
  };
  const clearPreviewCache = () => { try { localStorage.removeItem(cacheKey); } catch { /* ignore */ } };
  const loadPreviewCache = (): { handle: string; name: string; picture: string; verificationCode: string } | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const d = JSON.parse(raw);
      // Max 2 Stunden gültig
      if (!d.ts || Date.now() - d.ts > 2 * 60 * 60 * 1000) { localStorage.removeItem(cacheKey); return null; }
      return d;
    } catch { return null; }
  };

  const cached = !currentHandle ? loadPreviewCache() : null;

  const [step, setStep] = useState<Step>(currentHandle ? 'success' : cached ? 'instructions' : 'start');
  const [handle, setHandle] = useState(currentHandle ?? cached?.handle ?? '');
  const [preview, setPreview] = useState<{ name: string; picture: string; verificationCode: string } | null>(cached ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [name, setName] = useState(currentName);
  const [picture, setPicture] = useState(currentPicture);

  const call = async (body: object) => {
    const res = await fetch('/api/youtube-quests/social-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        platform,
        fingerprint: fingerprintRef.current ?? undefined,
        ...body,
      }),
    });
    return { ok: res.ok, data: await res.json() };
  };

  const handlePreview = async () => {
    if (!handle.trim()) return;
    setLoading(true); setError('');
    try {
      if (platform === 'facebook') {
        // Facebook Preview: social-verify aufrufen für Verifizierungscode
        const { ok, data } = await call({ handle: handle.trim(), action: 'preview' });
        if (!ok) { setError(data.error ?? t('sv.serverError', lang)); return; }
        setPreview(data);
        savePreviewCache(handle.trim(), data);
        setStep('instructions');
        return;
      }
      const { ok, data } = await call({ handle: handle.trim(), action: 'preview' });
      if (!ok) { setError(data.error ?? t('sv.serverError', lang)); return; }
      setPreview(data);
      savePreviewCache(handle.trim(), data);
      setStep('instructions');
    } catch { setError(t('sv.networkError', lang)); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (!preview) return;
    setLoading(true); setError('');
    try {
      const extraBody = {};
      const { ok, data } = await call({ handle: handle.trim(), action: 'verify', ...extraBody });
      if (!ok) { setError(data.error ?? t('sv.serverError', lang)); return; }
      if (data.notFound) {
        const cleanHandle = handle.replace(/^@/, '').trim();
        const key = platform === 'instagram' ? 'sv.notFoundInstagram' : platform === 'facebook' ? 'sv.notFoundFacebook' : 'sv.notFoundTiktok';
        setError(tFmt(key, lang, { code: preview.verificationCode, handle: cleanHandle }));
        return;
      }
      clearPreviewCache();
      setName(data.name); setPicture(data.picture);
      setStep('success');
      onDone();
      // Modal nach kurzem Erfolgs-Flash automatisch schließen
      setTimeout(() => onClose(), 1800);
    } catch { setError(t('sv.networkError', lang)); }
    finally { setLoading(false); }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      await call({ action: 'unlink' });
      clearPreviewCache();
      setHandle(''); setPreview(null); setName(null); setPicture(null);
      setStep('start');
      onDone();
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const copyCode = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.verificationCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            {cfg.icon}
            <span className="text-white font-bold">{tFmt('sv.headerLink', lang, { platform: cfg.label })}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Bereits verifiziert ─────────────────────────────── */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-4">
                {picture && (
                  <Image src={picture} alt={name ?? ''} width={48} height={48} unoptimized className="w-12 h-12 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{name ?? handle}</p>
                  <p className="text-zinc-400 text-xs">@{handle}</p>
                </div>
                {currentVerified && (
                  <span className="shrink-0 flex items-center gap-1 text-green-400 text-xs font-semibold bg-green-900/30 px-2 py-1 rounded-full">
                    <FaCheck size={9} /> {t('sv.verified', lang)}
                  </span>
                )}
              </div>

              <a
                href={cfg.profileUrl(handle)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-zinc-400 text-xs hover:text-white transition-colors"
              >
                {tFmt('sv.viewProfile', lang, { platform: cfg.label })}
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('start'); setHandle(''); }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {t('sv.change', lang)}
                </button>
                <button
                  onClick={handleUnlink}
                  disabled={loading}
                  className="flex-1 bg-red-900/40 hover:bg-red-800/60 text-red-400 text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <div className="border-2 border-red-400/30 border-t-red-400 rounded-full w-3 h-3 animate-spin" /> : <FaUnlink size={11} />}
                  {t('sv.unlink', lang)}
                </button>
              </div>
            </div>
          )}

          {/* ── Handle-Eingabe ──────────────────────────────────── */}
          {step === 'start' && (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 space-y-1.5">
                <p className="font-semibold text-yellow-400 text-sm">{t('sv.howItWorks', lang)}</p>
                {platform === 'instagram' ? (
                  <>
                    <p>{t('sv.igStart1', lang)}</p>
                    <p>{t('sv.igStart2', lang)}</p>
                    <p>{t('sv.igStart3', lang)}</p>
                    <p>{t('sv.igStart4', lang)}</p>
                  </>
                ) : platform === 'facebook' ? (
                  <>
                    <p>{t('sv.fbStart1', lang)}</p>
                    <p>{t('sv.fbStart2', lang)}</p>
                    <p>{t('sv.fbStart3', lang)}</p>
                    <p>{t('sv.fbStart4', lang)}</p>
                  </>
                ) : (
                  <>
                    <p>{tFmt('sv.genericStart1', lang, { platform: cfg.label })}</p>
                    <p>{t('sv.genericStart2', lang)}</p>
                    <p>{t('sv.genericStart3', lang)}</p>
                    <p>{t('sv.genericStart4', lang)}</p>
                  </>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">@</span>
                <input
                  value={handle.replace(/^@/, '')}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={platform === 'facebook' ? t('sv.placeholderFacebook', lang) : t('sv.placeholderGeneric', lang)}
                  className="w-full bg-zinc-800 text-white rounded-xl pl-8 pr-4 py-3 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-500"
                  onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handlePreview}
                disabled={loading || !handle.trim()}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <FaSync className="animate-spin" size={14} /> : <FaChevronRight size={14} />}
                {loading ? (platform === 'instagram' ? t('sv.loadingIg', lang) : t('sv.searching', lang)) : (platform === 'facebook' ? t('sv.continue', lang) : t('sv.loadProfile', lang))}
              </button>
            </div>
          )}

          {/* ── Code + Anleitung ───────────────────────────────── */}
          {step === 'instructions' && preview && (
            <div className="space-y-4">
              {/* Profil-Vorschau */}
              <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
                {platform === 'facebook' ? (
                  <div className="w-11 h-11 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                    <FaFacebook className="text-blue-400" size={20} />
                  </div>
                ) : (
                  <Image src={preview.picture} alt={preview.name} width={44} height={44} unoptimized className="w-11 h-11 rounded-full" />
                )}
                <div>
                  <p className="text-white font-semibold text-sm">{preview.name}</p>
                  <p className="text-zinc-400 text-xs">@{handle.replace(/^@/, '')}</p>
                </div>
              </div>

              {/* Code – nur für TikTok */}
              {platform === 'tiktok' && (
              <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
                <p className="text-yellow-400 font-semibold text-sm">{t('sv.yourCode', lang)}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-zinc-900 text-yellow-300 font-mono text-sm px-3 py-2 rounded-lg border border-zinc-700 select-all">
                    {preview.verificationCode}
                  </code>
                  <button
                    onClick={copyCode}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg transition-colors text-sm shrink-0"
                  >
                    {codeCopied ? <FaCheck className="text-green-400" /> : <FaCopy size={13} />}
                  </button>
                </div>
                <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                  <li>{t('sv.tiktokStep1', lang)}</li>
                  <li>{t('sv.tiktokStep2', lang)}</li>
                  <li>{tFmt('sv.tiktokStep3', lang, { code: preview.verificationCode })}</li>
                  <li>{t('sv.tiktokStep4', lang)}</li>
                </ol>
                <p className="text-yellow-500 text-xs">{t('sv.bioDelayHint', lang)}</p>
              </div>
              )}

              {/* Tag-Anleitung – Instagram */}
              {platform === 'instagram' && (
              <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
                <p className="text-pink-400 font-semibold text-sm">{t('sv.yourCode', lang)}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-zinc-900 text-yellow-300 font-mono text-sm px-3 py-2 rounded-lg border border-zinc-700 select-all">
                    {preview.verificationCode}
                  </code>
                  <button
                    onClick={copyCode}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg transition-colors text-sm shrink-0"
                  >
                    {codeCopied ? <FaCheck className="text-green-400" /> : <FaCopy size={13} />}
                  </button>
                </div>
                <p className="text-pink-400 font-semibold text-sm">{t('sv.howToVerify', lang)}</p>
                <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                  <li>{t('sv.igOpenApp', lang)}</li>
                  <li>{t('sv.igGoToPost', lang)}</li>
                  <li>{t('sv.stepWriteCodeComment', lang)}</li>
                  <li>{t('sv.stepComeBackVerify', lang)}</li>
                </ol>
                <a
                  href="https://www.instagram.com/dfaith_ecosystem/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-zinc-900 rounded-lg px-3 py-2 flex items-center gap-2 border border-zinc-700 hover:border-pink-500 transition-colors"
                >
                  <FaInstagram size={14} className="text-pink-400 shrink-0" />
                  <span className="text-pink-300 font-mono text-sm">@dfaith_ecosystem</span>
                  <span className="text-zinc-500 text-xs ml-auto">{t('sv.openProfile', lang)}</span>
                </a>
                <p className="text-yellow-500 text-xs">{t('sv.commentDelayHint', lang)}</p>
              </div>
              )}

              {/* Facebook – zeigt Seiten-Link + Kommentar-Anweisung mit Code */}
              {platform === 'facebook' && (
              <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
                <p className="text-blue-400 font-semibold text-sm">{t('sv.yourCode', lang)}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-zinc-900 text-yellow-300 font-mono text-sm px-3 py-2 rounded-lg border border-zinc-700 select-all">
                    {preview.verificationCode}
                  </code>
                  <button
                    onClick={copyCode}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg transition-colors text-sm shrink-0"
                  >
                    {codeCopied ? <FaCheck className="text-green-400" /> : <FaCopy size={13} />}
                  </button>
                </div>
                <p className="text-blue-400 font-semibold text-sm">{t('sv.howToVerify', lang)}</p>
                <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                  <li>{t('sv.fbOpenApp', lang)}</li>
                  <li>{t('sv.fbGoToPost', lang)}</li>
                  <li>{t('sv.stepWriteCodeComment', lang)}</li>
                  <li>{t('sv.stepComeBackVerify', lang)}</li>
                </ol>
                <a
                  href="https://www.facebook.com/1144846495374893"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-zinc-900 rounded-lg px-3 py-2 flex items-center gap-2 border border-zinc-700 hover:border-blue-500 transition-colors"
                >
                  <FaFacebook size={14} className="text-blue-400 shrink-0" />
                  <span className="text-blue-300 font-mono text-sm">D.Faith Ecosystem</span>
                  <span className="text-zinc-500 text-xs ml-auto">{t('sv.openPage', lang)}</span>
                </a>
                <p className="text-yellow-500 text-xs">{t('sv.commentDelayHint', lang)}</p>
              </div>
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('start'); setError(''); }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {t('sv.back', lang)}
                </button>
                <button
                  onClick={() => handleVerify()}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <FaSync className="animate-spin" size={13} /> : <FaUserCheck size={14} />}
                  {loading ? t('sv.verifying', lang) : t('sv.verify', lang)}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
