'use client';

import React, { useState } from 'react';
import { FaYoutube, FaChevronRight, FaSync, FaCheck, FaUserCheck } from 'react-icons/fa';
import Image from 'next/image';
import type { YouTubeBinding } from '../types';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface LinkChannelViewProps {
  walletAddress: string;
  onLinked: (binding: YouTubeBinding) => void;
}

export default function LinkChannelView({ walletAddress, onLinked }: LinkChannelViewProps) {
  const lang = useLang();
  const [channelInput, setChannelInput] = useState('');
  const [preview, setPreview] = useState<{
    channelId: string;
    channelName: string;
    channelThumbnail: string;
    verificationCode: string;
  } | null>(null);
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const handlePreview = async () => {
    if (!channelInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/youtube-quests/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, channelInput: channelInput.trim(), action: 'preview' }),
      });
      let data: { error?: string; channelId?: string; channelName?: string; channelThumbnail?: string; verificationCode?: string };
      try { data = await res.json(); } catch { data = { error: `Server-Fehler (${res.status})` }; }
      if (!res.ok) { setError(data.error ?? 'Unbekannter Fehler'); return; }
      setPreview(data as { channelId: string; channelName: string; channelThumbnail: string; verificationCode: string });
      setStep('verify');
    } catch {
      setError(lang === 'en' ? 'Network error. Check your connection.' : lang === 'pl' ? 'Błąd sieci. Sprawdź połączenie.' : 'Netzwerkfehler. Prüfe deine Internetverbindung und versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/youtube-quests/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, channelInput: channelInput.trim(), action: 'verify' }),
      });
      let data: { error?: string; binding?: YouTubeBinding };
      try { data = await res.json(); } catch { data = { error: `Server-Fehler (${res.status})` }; }
      if (!res.ok) { setError(data.error ?? 'Unbekannter Fehler'); return; }
      if (data.binding) onLinked(data.binding);
    } catch {
      setError('Netzwerkfehler.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.verificationCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FaYoutube size={28} className="text-red-500" />
          <div>
            <h2 className="font-bold text-white text-lg">{t('yt.title', lang)}</h2>
            <p className="text-zinc-400 text-sm">{t('yt.subtitle', lang)}</p>
          </div>
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 space-y-1">
              <p className="font-semibold text-yellow-400">{t('yt.howTitle', lang)}</p>
              <p>1. {t('yt.step1', lang)}</p>
              <p>2. {t('yt.step2', lang)}</p>
              <p>3. {t('yt.step3', lang)}</p>
              <p>4. {t('yt.step4', lang)}</p>
            </div>
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder={t('yt.placeholder', lang)}
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-amber-500 focus:outline-none placeholder-zinc-500"
              onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
            />
            {error && <p className="text-amber-400 text-sm">{error}</p>}
            <button
              onClick={handlePreview}
              disabled={loading || !channelInput.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <FaSync className="animate-spin" /> : <FaChevronRight />}
              {loading ? t('yt.searchLoading', lang) : t('yt.loadBtn', lang)}
            </button>
          </div>
        )}

        {step === 'verify' && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
              {preview.channelThumbnail && (
                <Image
                  src={preview.channelThumbnail}
                  alt={preview.channelName}
                  width={48}
                  height={48}
                  unoptimized
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-semibold">{preview.channelName}</p>
                <p className="text-zinc-400 text-xs">{preview.channelId}</p>
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
              <p className="text-yellow-400 font-semibold text-sm">{t('yt.codeTitle', lang)}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-900 text-yellow-300 font-mono text-sm px-3 py-2 rounded-lg border border-zinc-700 select-all">
                  {preview.verificationCode}
                </code>
                <button
                  onClick={copyCode}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-lg transition-colors text-sm shrink-0"
                >
                  {codeCopied ? <FaCheck className="text-green-400" /> : t('btn.copy', lang)}
                </button>
              </div>
              <ol className="text-zinc-400 text-sm space-y-1 list-decimal list-inside">
                <li>
                  Öffne{' '}
                  <a
                    href={`https://studio.youtube.com/channel/${preview.channelId}/editing/details`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 underline"
                  >
                    {t('yt.instr1', lang)}
                  </a>
                </li>
                <li>{t('yt.instr2', lang)}</li>
                <li>{t('yt.instr3', lang)}</li>
                <li>{t('yt.instr4', lang)}</li>
              </ol>
            </div>

            {error && <p className="text-amber-400 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('input'); setError(''); setPreview(null); }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 rounded-xl transition-colors"
              >
                {t('btn.back', lang)}
              </button>
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <FaSync className="animate-spin" /> : <FaUserCheck />}
                {loading ? t('btn.verifying', lang) : t('btn.verify', lang)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
