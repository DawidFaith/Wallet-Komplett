'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaInstagram, FaShareAlt, FaRedo, FaCheck, FaPaperPlane, FaStar } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t, tFmt } from '../../../utils/i18n';

interface InstagramDmShareModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  repBonusPercent?: number;
  /** Wenn vorhanden: Fan kam über den Story-Link → einfacher 1-Klick Claim-Flow */
  storyClaimToken?: string;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

type Step =
  | 'idle'           // Noch nicht gestartet
  | 'starting'       // Quest wird vorbereitet
  | 'waiting'        // Warte auf @-Tag per Webhook
  | 'ready'          // @-Tag erkannt → User muss Belohnung einlösen
  | 'success'        // Quest komplett
  | 'expired'
  | 'error';

export default function InstagramDmShareModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  repBonusPercent = 0,
  storyClaimToken,
  onCompleted,
  onClose,
}: InstagramDmShareModalProps) {
  const lang = useLang();
  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [linkTemplate, setLinkTemplate] = useState('');
  const [dmLink, setDmLink] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [creatorHandle, setCreatorHandle] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayRep = quest ? Math.round((quest.reputationReward ?? 0) * (1 + repBonusPercent / 100)) : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

  // Countdown Timer
  useEffect(() => {
    if (step !== 'waiting') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const update = () => {
      if (!expiresAt) return;
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStep('expired');
      }
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [step, expiresAt]);

  // Status beim Öffnen laden
  useEffect(() => {
    if (!quest) return;
    setStep('idle');
    setError('');
    setRewardAmount(0);

    fetch('/api/instagram-quests/dm-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', questId: quest.id, walletAddress }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.alreadyCompleted || data.tagVerified) {
          setStep('success');
        } else if (data.started && !data.expired) {
          setExpiresAt(data.expiresAt ?? null);
          setInstagramHandle(data.instagramHandle ?? '');
          setCreatorHandle(data.creatorHandle ?? '');
          if (data.dmLink) setDmLink(data.dmLink);
          setStep('waiting');
        }
      })
      .catch(() => {});
  }, [quest, walletAddress]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = useCallback(async () => {
    if (!quest) return;
    setLoading(true);
    setError('');
    setStep('starting');
    try {
      const res = await fetch('/api/instagram-quests/dm-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', questId: quest.id, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Starten');
        setStep('error');
        return;
      }
      setExpiresAt(data.expiresAt);
      setInstagramHandle(data.instagramHandle ?? '');
      setCreatorHandle(data.creatorHandle ?? '');
      if (data.dmLink) setDmLink(data.dmLink);
      setStep('waiting');
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress]);

  const handleComplete = useCallback(async () => {
    if (!quest) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/instagram-quests/dm-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', questId: quest.id, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(lang === 'en' ? 'Error completing quest.' : lang === 'pl' ? 'Błąd podczas kończenia.' : 'Fehler beim Abschließen');
        return;
      }
      setRewardAmount(data.rewardAmount ?? displayReward);
      setStep('success');
      onCompleted(data.rewardAmount ?? displayReward, data.levelBonus);
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress, onCompleted, displayReward]);

  // (Polling entfernt – Link = Verifikation, kein Webhook-Check nötig)

  if (!quest) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal open={true} title="Story Quest" onClose={onClose}>
      <div className="space-y-4 text-white">
        {/* Header */}
        <div className="flex items-center gap-3">
          <FaInstagram size={20} className="text-pink-400 shrink-0" />
          <div>
            <p className="font-semibold text-sm">{quest.videoTitle}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-zinc-500 flex items-center gap-1">Story Quest · <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />{formatCredits(displayReward)} D.FAITH</p>
              {levelBonusPercent > 0 && (
                <span className="text-[10px] text-green-300 font-semibold">inkl. +{levelBonusPercent}% Bonus</span>
              )}
              {(quest.reputationReward ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-yellow-400">
                  <FaStar size={9} /> +{displayRep} REP{repBonusPercent > 0 && ` (+${repBonusPercent}%)`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── STORY-CLAIM FLOW (Token aus Story-Link) ── */}
        {storyClaimToken && (
          <StoryClaimSection
            token={storyClaimToken}
            walletAddress={walletAddress}
            rewardAmount={displayReward}
            questTitle={quest.videoTitle}
            onSuccess={(amount) => {
              onCompleted(amount);
            }}
            onClose={onClose}
          />
        )}

        {/* ── NORMALER ZWEI-SCHRITT FLOW ── */}
        {!storyClaimToken && (
          <>
            {/* Fortschritt */}
            <div className="flex items-center gap-2 text-xs">
              <StepBadge
                num={1}
                label="Story + @-Tag"
                done={step === 'success'}
                active={['starting', 'waiting'].includes(step)}
              />
            </div>

            {/* ── IDLE ── */}
            {step === 'idle' && (
              <div className="space-y-3">
                {/* Reward Preview */}
                <div className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/40 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Belohnung</span>
                  <span className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
                    <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full" unoptimized />
                    +{formatCredits(displayReward)} D.FAITH
                    {(quest.reputationReward ?? 0) > 0 && (
                      <span className="text-amber-300 text-xs font-semibold ml-1 flex items-center gap-0.5">
                        <FaStar size={9} /> +{displayRep} REP{repBonusPercent > 0 && ` (+${repBonusPercent}%)`}
                      </span>
                    )}
                  </span>
                </div>

                {/* Instructions */}
                <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-3 py-3 space-y-2.5">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <FaPaperPlane size={12} className="text-pink-400" /> {t('verify.dmHowTitle', lang)}
                  </p>
                  <ol className="space-y-2">
                    <li className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[10px]">1</span>
                      <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep1claim', lang) }} />
                    </li>
                    <li className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[10px]">2</span>
                      <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep2claim', lang).replace('{handle}', creatorHandle ? `@${creatorHandle}` : (lang === 'en' ? 'the artist' : lang === 'pl' ? 'artyste' : 'den Künstler')) }} />
                    </li>
                    <li className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">3</span>
                      <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep3claim', lang) }} />
                    </li>
                  </ol>
                </div>

                {quest.videoUrl && (
                  <a
                    href={quest.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleStart}
                    className="flex items-center justify-center gap-2 w-full bg-pink-600 hover:bg-pink-500 rounded-xl px-3 py-2.5 text-sm text-white font-semibold transition-colors"
                  >
                    <FaShareAlt size={13} />
                    {t('verify.openPost', lang)}
                  </a>
                )}

                {!quest.videoUrl && (
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <><FaRedo size={11} /> {t('verify.questStart', lang)}</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ── STARTING ── */}
            {step === 'starting' && (
              <div className="text-center py-4">
                <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-zinc-400">{t('verify.preparing', lang)}</p>
              </div>
            )}
          </>
        )}

        {/* ── WAITING: Anleitung durchführen, Künstler schickt Link ── */}
        {!storyClaimToken && step === 'waiting' && (
          <div className="space-y-3">
            {/* Schritte-Checklist */}
            <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-3 py-3 space-y-2">
              <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                <FaPaperPlane size={11} className="text-pink-400" /> {t('verify.dmStepsTitle', lang)}
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[10px]">1</span>
                  <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep1wait', lang) }} />
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[10px]">2</span>
                  <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep2wait', lang).replace('{handle}', creatorHandle ? `@${creatorHandle}` : (lang === 'en' ? 'the artist' : lang === 'pl' ? 'artyste' : 'den Künstler')) }} />
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">3</span>
                  <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep3wait', lang) }} />
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-[10px]">4</span>
                  <span className="text-zinc-300" dangerouslySetInnerHTML={{ __html: t('verify.dmStep4wait', lang) }} />
                </div>
              </div>
            </div>

            {quest.videoUrl && (
              <a
                href={quest.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-500 rounded-xl px-3 py-2.5 text-sm text-white font-semibold transition-colors"
              >
                <FaShareAlt size={13} />
                {t('verify.openPostShare', lang)}
              </a>
            )}

            {/* Warte-Hinweis */}
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <div className="animate-spin w-3 h-3 border border-purple-400 border-t-transparent rounded-full shrink-0" />
              <p className="text-xs text-purple-300">
                {t('verify.artistChecks', lang)}
              </p>
            </div>

            {expiresAt && (
              <p className="text-center text-xs text-zinc-500">{lang === 'en' ? `Expires in ${formatTime(secondsLeft)}` : lang === 'pl' ? `Wygaśnie za ${formatTime(secondsLeft)}` : `Verfällt in ${formatTime(secondsLeft)}`}</p>
            )}
          </div>
        )}

        {/* ── SUCCESS ── */}
        {!storyClaimToken && step === 'success' && (
          <div className="text-center py-2 space-y-4">
            <div className="text-5xl animate-bounce">🎉</div>
            <p className="font-bold text-xl text-green-400">{t('verify.questDone', lang)}</p>
            <p className="text-xs text-zinc-400">{t('verify.storyShared', lang)}</p>

            {/* Belohnungs-Box */}
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-2xl px-4 py-4 space-y-2">
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">{t('verify.rewardLabel', lang)}</p>
              <div className="flex items-center justify-center gap-2">
                <Image src="/D.FAITH.png" alt="D.FAITH" width={28} height={28} className="w-7 h-7 rounded-full" unoptimized />
                <span className="text-3xl font-black text-yellow-400">+{formatCredits(rewardAmount || displayReward)}</span>
                <span className="text-lg font-bold text-yellow-300">D.FAITH</span>
              </div>
              {(quest.reputationReward ?? 0) > 0 && (
                <div className="flex items-center justify-center gap-1 text-amber-300 text-sm font-semibold">
                  <FaStar size={12} /> +{displayRep} Reputation{repBonusPercent > 0 && ` (+${repBonusPercent}%)`}
                </div>
              )}
              <p className="text-xs text-green-400">✓ {t('verify.creditsAdded', lang)}</p>
            </div>

            <button onClick={onClose} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">{t('btn.close', lang)}</button>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {!storyClaimToken && step === 'expired' && (
          <div className="space-y-3">
            <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl px-3 py-2 text-xs text-amber-300">
              {t('verify.expiredTitle', lang)} {lang === 'en' ? 'Please restart the quest.' : lang === 'pl' ? 'Uruchom quest od nowa.' : 'Bitte starte die Quest neu.'}
            </div>
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {lang === 'en' ? 'Restart quest' : lang === 'pl' ? 'Uruchom ponownie' : 'Quest neu starten'}
            </button>
          </div>
        )}

        {/* ── INVITE PENDING ── */}
        {/* (entfernt – ersetzt durch Link DM Konzept) */}

        {/* ── NOT TESTER ── */}
        {/* (entfernt – ersetzt durch Link DM Konzept) */}

        {/* ── ERROR ── */}
        {!storyClaimToken && step === 'error' && (
          <div className="space-y-3">
            <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl px-3 py-2 text-xs text-amber-300">
              {error}
            </div>
            <button onClick={() => setStep('idle')} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              {t('verify.back', lang)}
            </button>
          </div>
        )}

        {/* Inline-Fehler (nicht fatal) */}
        {!storyClaimToken && error && !['error', 'idle', 'expired', 'success'].includes(step) && (
          <div className="bg-orange-900/30 border border-orange-600/40 rounded-xl px-3 py-2 text-xs text-orange-300">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Helper Component ─────────────────────────────────────────────────────────

function StepBadge({ num, label, done, active }: { num: number; label: string; done: boolean; active: boolean }) {
  const bg = done ? 'bg-green-600' : active ? 'bg-pink-600' : 'bg-zinc-700';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center text-xs font-bold transition-colors`}>
        {done ? <FaCheck size={9} /> : num}
      </div>
      <span className="text-[10px] text-zinc-500 max-w-[60px] text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Story-Claim Abschnitt ─────────────────────────────────────────────────────

interface StoryClaimSectionProps {
  token: string;
  walletAddress: string;
  rewardAmount: number;
  questTitle: string;
  onSuccess: (amount: number) => void;
  onClose: () => void;
}

function StoryClaimSection({ token, walletAddress, rewardAmount, onSuccess, onClose }: StoryClaimSectionProps) {
  const lang = useLang();
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [claimed, setClaimed] = useState(0);

  const handleClaim = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/instagram-quests/story-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, walletAddress }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimed(data.rewardAmount ?? rewardAmount);
        setState('success');
        onSuccess(data.rewardAmount ?? rewardAmount);
      } else {
        setErrorMsg(data.error ?? lang === 'en' ? 'Error redeeming' : lang === 'pl' ? 'Błąd odbioru' : 'Fehler beim Einlösen');
        setState('error');
      }
    } catch {
      setErrorMsg(lang === 'en' ? 'Network error. Please try again.' : lang === 'pl' ? 'Błąd sieci. Spróbuj ponownie.' : 'Netzwerkfehler. Bitte versuche es erneut.');
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="text-center py-2 space-y-4">
        <div className="text-5xl animate-bounce">🎉</div>
        <p className="font-bold text-xl text-green-400">{t('verify.questDone', lang)}</p>
        <p className="text-xs text-zinc-400">{t('verify.storyShared', lang)}</p>

        {/* Belohnungs-Box */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-2xl px-4 py-4 space-y-2">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">{t('verify.rewardLabel', lang)}</p>
          <div className="flex items-center justify-center gap-2">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={28} height={28} className="w-7 h-7 rounded-full" unoptimized />
            <span className="text-3xl font-black text-yellow-400">+{formatCredits(claimed)}</span>
            <span className="text-lg font-bold text-yellow-300">D.FAITH</span>
          </div>
          <p className="text-xs text-green-400">✓ {t('verify.creditsAdded', lang)}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
        >
          {t('btn.close', lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Reward Preview */}
      <div className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/40 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-zinc-400">{t('verify.rewardLabel', lang)}</span>
        <span className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
          <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full" unoptimized />
          +{formatCredits(rewardAmount)} D.FAITH
        </span>
      </div>

      <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-3 py-3 space-y-1">
        <p className="font-semibold text-white text-xs flex items-center gap-1.5">
          <FaCheck size={10} className="text-green-400" /> {t('verify.storyClaimDone', lang)}
        </p>
        <p className="text-xs text-zinc-400">
        {t('verify.storyFound', lang)}
        </p>
      </div>

      {state === 'error' && (
        <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl px-3 py-2 text-xs text-amber-300">
          {errorMsg}
        </div>
      )}

      <button
        onClick={state === 'loading' ? undefined : handleClaim}
        disabled={state === 'loading'}
        className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
      >
        {state === 'loading' ? (
          <>
            <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
            {lang === 'en' ? 'Redeeming…' : lang === 'pl' ? 'Odbieram…' : 'Einlösen…'}
          </>
        ) : (
          <>
            <FaStar size={13} />
            +{formatCredits(rewardAmount)} D.FAITH {lang === 'en' ? 'redeem' : lang === 'pl' ? 'odbierz' : 'einlösen'}
          </>
        )}
      </button>
    </div>
  );
}
