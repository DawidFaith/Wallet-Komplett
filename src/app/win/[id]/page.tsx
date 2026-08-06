'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaGift, FaExternalLinkAlt, FaCheckCircle } from 'react-icons/fa';
import { useLang, useSetLang } from '../../components/LangContext';
import { t, tFmt, type Lang } from '../../utils/i18n';

type Platform = 'instagram' | 'tiktok' | 'facebook' | 'youtube';

const PLATFORM_META: Record<Platform, { label: string; icon: ReactNode; color: string }> = {
  instagram: { label: 'Instagram', icon: <FaInstagram size={18} />, color: 'text-pink-500' },
  tiktok:    { label: 'TikTok',    icon: <FaTiktok size={17} />,    color: 'text-zinc-200' },
  facebook:  { label: 'Facebook',  icon: <FaFacebook size={18} />, color: 'text-blue-500' },
  youtube:   { label: 'YouTube',   icon: <FaYoutube size={18} />,  color: 'text-red-500' },
};

const LANG_FLAGS: Record<Lang, string> = { de: '🇩🇪', en: '🇺🇸', pl: '🇵🇱' };

const ERROR_CODE_KEYS: Record<string, string> = {
  missing_fields: 'win.errGeneric',
  invalid_email: 'win.errGeneric',
  invalid_body: 'win.errGeneric',
  consent_required: 'win.consentRequired',
  not_found: 'win.notFound',
  ended: 'win.ended',
  sold_out: 'win.soldOut',
  platform_unavailable: 'win.errPlatformUnavailable',
  already_participated: 'win.errAlreadyParticipated',
  handle_taken: 'win.errHandleTaken',
  already_credited: 'win.errAlreadyCredited',
  verification_unavailable: 'win.errVerificationUnavailable',
};

function errorCodeToMessage(errorCode: string | undefined, lang: Lang): string {
  const key = (errorCode && ERROR_CODE_KEYS[errorCode]) || 'win.errGeneric';
  return t(key, lang);
}

function LanguageSwitcher() {
  const lang = useLang();
  const setLang = useSetLang();
  return (
    <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-full p-1">
      {(['de', 'en', 'pl'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${
            lang === l ? 'bg-amber-500/20 ring-1 ring-amber-400/60' : 'opacity-60 hover:opacity-100'
          }`}
        >
          {LANG_FLAGS[l]}
        </button>
      ))}
    </div>
  );
}

interface PublicCampaign {
  id: string;
  title: string;
  imageUrl: string | null;
  mediaType: 'image' | 'video';
  requiredText: string;
  creditReward: number;
  status: 'active' | 'ended';
  slotsLeft: number;
  platforms: { platform: Platform; postUrl: string }[];
  artistName: string;
  releaseAt: string | null;
  presaveUrl: string | null;
}

interface PendingState {
  entryId: string;
  code?: string;
  requiredText?: string;
}

export default function GiveawayLandingPage() {
  const params = useParams();
  const campaignId = String(params.id);
  const lang = useLang();

  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [handle, setHandle]     = useState('');
  const [email, setEmail]       = useState('');
  const [consent, setConsent]   = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError]       = useState('');

  const [pending, setPending]     = useState<PendingState | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [result, setResult]     = useState<{ credited: boolean; amount?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/giveaways/campaign/${campaignId}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      setCampaign(data.campaign);
      if (data.campaign?.platforms?.length === 1) setPlatform(data.campaign.platforms[0].platform);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    setError('');
    if (!campaign) return;
    if (!platform) return setError(t('win.step1Title', lang));
    if (!handle.trim()) return setError(t('win.handleLabel', lang));
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('win.emailLabel', lang));
    if (!consent) return setError(t('win.consentRequired', lang));

    setStarting(true);
    try {
      const res = await fetch('/api/giveaways/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Immer die aufgelöste Kampagnen-ID verwenden, nicht den URL-Parameter —
        // der kann bei permanenten Artist-Links auch eine Wallet-Adresse sein.
        body: JSON.stringify({ campaignId: campaign.id, platform, handle: handle.trim(), email: email.trim(), consent: true, lang }),
      });
      const data = await res.json();
      if (!res.ok) { setError(errorCodeToMessage(data.errorCode, lang)); return; }
      if (data.verified) {
        setResult({ credited: !!data.credited, amount: data.amount });
      } else {
        setPending({ entryId: data.entryId, code: data.code, requiredText: data.requiredText });
      }
    } catch {
      setError(t('win.errGeneric', lang));
    } finally {
      setStarting(false);
    }
  };

  const handleVerify = async () => {
    if (!pending) return;
    setVerifying(true);
    setVerifyMsg('');
    try {
      const res = await fetch('/api/giveaways/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: pending.entryId }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyMsg(errorCodeToMessage(data.errorCode, lang)); return; }
      if (!data.verified) { setVerifyMsg(t('win.verifyNotFound', lang)); return; }
      setResult({ credited: !!data.credited, amount: data.amount });
    } catch {
      setVerifyMsg(t('win.errGeneric', lang));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0c0a] flex items-center justify-center">
        <span className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen bg-[#0e0c0a] flex flex-col items-center justify-center text-center px-6">
        <FaGift className="text-zinc-600 mb-4" size={36} />
        <p className="text-zinc-300 font-semibold">{t('win.notFound', lang)}</p>
      </div>
    );
  }

  const activePlatform = campaign.platforms.find(p => p.platform === platform);

  return (
    <div className="min-h-screen bg-[#0e0c0a] text-white pb-16">
      <div className="max-w-md mx-auto w-full">
        {campaign.imageUrl && (
          campaign.mediaType === 'video' ? (
            <video src={campaign.imageUrl} className="w-full h-48 object-cover" muted autoPlay loop playsInline controls />
          ) : (
            <Image src={campaign.imageUrl} alt={campaign.title} width={800} height={400} className="w-full h-48 object-cover" />
          )
        )}
        <div className="px-5 pt-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <FaGift className="text-amber-400" size={16} />
              <h1 className="text-xl font-black">{campaign.title}</h1>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center gap-2 mb-6">
            <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full px-3 py-1">
              {tFmt('win.reward', lang, { n: campaign.creditReward })}
            </span>
            {campaign.status === 'active' && (
              <span className="bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-xs font-bold rounded-full px-3 py-1">
                {tFmt('win.slotsLeft', lang, { n: campaign.slotsLeft })}
              </span>
            )}
          </div>

          {campaign.status !== 'active' || campaign.slotsLeft <= 0 ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-center text-zinc-400 text-sm">
              {campaign.slotsLeft <= 0 ? t('win.soldOut', lang) : t('win.ended', lang)}
            </div>
          ) : result ? (
            <div className={`rounded-2xl p-5 text-center border ${result.credited ? 'bg-green-500/10 border-green-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
              <FaCheckCircle className={`mx-auto mb-3 ${result.credited ? 'text-green-400' : 'text-amber-400'}`} size={28} />
              <p className="font-bold mb-1.5">{result.credited ? t('win.creditedTitle', lang) : t('win.pendingTitle', lang)}</p>
              <p className="text-zinc-300 text-sm mb-4">
                {result.credited ? tFmt('win.creditedBody', lang, { n: result.amount ?? campaign.creditReward }) : t('win.pendingBody', lang)}
              </p>
              <a
                href="/"
                className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl px-5 py-2.5 text-sm transition-all"
              >
                {t('win.goToApp', lang)}
              </a>
            </div>
          ) : pending && activePlatform ? (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">{t('win.step3Title', lang)}</p>
              {pending.code ? (
                <>
                  <p className="text-zinc-300 text-sm">{t('win.instructionsIntro', lang)}</p>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl py-3 text-center">
                    <span className="text-amber-300 font-black text-2xl tracking-widest">{pending.code}</span>
                  </div>
                </>
              ) : (
                <p className="text-zinc-300 text-sm">
                  {tFmt('win.instructionsIntroWord', lang, { word: pending.requiredText ?? '' })}
                </p>
              )}
              <a
                href={activePlatform.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl py-3 text-sm font-semibold transition-all"
              >
                <FaExternalLinkAlt size={11} /> {t('win.openPost', lang)}
              </a>
              {verifyMsg && (
                <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">{verifyMsg}</p>
              )}
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3 text-sm transition-all"
              >
                {verifying ? t('win.verifyLoading', lang) : t('win.verifyButton', lang)}
              </button>
            </div>
          ) : (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2">{t('win.step1Title', lang)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {campaign.platforms.map(p => (
                    <button
                      key={p.platform}
                      onClick={() => setPlatform(p.platform)}
                      className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold border transition-all ${
                        platform === p.platform
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-400'
                      }`}
                    >
                      <span className={PLATFORM_META[p.platform].color}>{PLATFORM_META[p.platform].icon}</span>
                      {PLATFORM_META[p.platform].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2">{t('win.step2Title', lang)}</p>
                <div className="space-y-2.5">
                  <input
                    value={handle} onChange={e => setHandle(e.target.value)}
                    placeholder={t('win.handleLabel', lang)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/60"
                  />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('win.emailLabel', lang)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>
              </div>

              <p className="text-zinc-600 text-[10px] leading-relaxed">
                {tFmt('win.platformDisclaimer', lang, {
                  platforms: campaign.platforms.map(p => PLATFORM_META[p.platform].label).join(', '),
                })}
              </p>

              <label className="flex items-start gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox" checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  {t('win.consentPrefix', lang)}{' '}
                  <Link href={`/win/${campaign.id}/terms`} target="_blank" className="text-amber-400 hover:text-amber-300 underline">
                    {t('win.termsAndPrivacyLabel', lang)}
                  </Link>{' '}
                  {t('win.consentSuffix', lang)}
                </span>
              </label>

              {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">{error}</p>}

              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black rounded-xl py-3.5 text-sm transition-all"
              >
                {starting ? t('win.startLoading', lang) : t('win.startButton', lang)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
