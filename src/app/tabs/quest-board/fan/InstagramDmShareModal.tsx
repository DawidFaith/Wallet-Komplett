'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaInstagram, FaShareAlt, FaRedo, FaCheck, FaPaperPlane, FaStar } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';

interface InstagramDmShareModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  /** Wenn vorhanden: Fan kam über den Story-Link → einfacher 1-Klick Claim-Flow */
  storyClaimToken?: string;
  onCompleted: (rewardAmount: number) => void;
  onClose: () => void;
}

type Step =
  | 'idle'           // Noch nicht gestartet
  | 'starting'       // Quest wird vorbereitet
  | 'waiting'        // Warte auf @-Tag per Webhook
  | 'ready'          // @-Tag erkannt → User muss Belohnung einlösen
  | 'success'        // Quest komplett
  | 'not_tester'     // Noch nicht als Instagram-Tester eingetragen
  | 'invite_pending' // Tester, aber Einladung noch nicht angenommen
  | 'expired'
  | 'error';

export default function InstagramDmShareModal({
  quest,
  walletAddress,
  storyClaimToken,
  onCompleted,
  onClose,
}: InstagramDmShareModalProps) {
  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [linkTemplate, setLinkTemplate] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [creatorHandle, setCreatorHandle] = useState('');
  const [testerEmail, setTesterEmail] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        if (data.notTester) {
          setStep('not_tester');
        } else if (data.invitePending) {
          setStep('invite_pending');
        } else if (data.alreadyCompleted || data.tagVerified) {
          setStep('success');
        } else if (data.readyToComplete) {
          setInstagramHandle(data.instagramHandle ?? '');
          setCreatorHandle(data.creatorHandle ?? '');
          setStep('ready');
        } else if (data.started && !data.expired) {
          setExpiresAt(data.expiresAt ?? null);
          setInstagramHandle(data.instagramHandle ?? '');
          setCreatorHandle(data.creatorHandle ?? '');
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
        if (data.error === 'not_tester') {
          setStep('not_tester');
          return;
        }
        if (data.error === 'invite_pending') {
          setStep('invite_pending');
          return;
        }
        setError(data.error ?? 'Fehler beim Starten');
        setStep('error');
        return;
      }
      setExpiresAt(data.expiresAt);
      setInstagramHandle(data.instagramHandle ?? '');
      setCreatorHandle(data.creatorHandle ?? '');
      setStep('waiting');
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress]);

  const handleConfirmInvite = useCallback(async () => {
    if (!quest) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/instagram-quests/dm-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_invite', questId: quest.id, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Bestätigen');
        return;
      }
      // Einladung bestätigt → Quest direkt starten
      setStep('idle');
      handleStart();
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress, handleStart]);

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
        setError(data.error ?? 'Fehler beim Abschließen');
        return;
      }
      setRewardAmount(data.rewardAmount ?? quest.rewardAmount);
      setStep('success');
      onCompleted(data.rewardAmount ?? quest.rewardAmount);
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress, onCompleted]);

  // Poll: wurde @-Tag per Webhook erkannt? (alle 5 Sek wenn in waiting)
  useEffect(() => {
    if (step !== 'waiting' || !quest) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/instagram-quests/dm-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', questId: quest.id, walletAddress }),
        });
        const data = await res.json();
        if (data.readyToComplete) {
          clearInterval(poll);
          setStep('ready');
        } else if (data.tagVerified || data.alreadyCompleted) {
          clearInterval(poll);
          setStep('success');
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [step, quest, walletAddress]);

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
              <p className="text-xs text-zinc-500 flex items-center gap-1">Story Quest · <Image src="/D.FAITH.png" alt="" width={10} height={10} className="w-2.5 h-2.5 rounded-full shrink-0" />{formatCredits(quest.rewardAmount)} D.FAITH</p>
              {(quest.reputationReward ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-yellow-400">
                  <FaStar size={9} /> +{quest.reputationReward} REP
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
            rewardAmount={quest.rewardAmount}
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
                <p className="text-sm text-zinc-400">
                  Öffne den Beitrag auf Instagram, teile ihn in deiner Story und markiere dabei <span className="text-pink-400 font-semibold">@{creatorHandle || 'den Creator'}</span>. Sobald der Tag erkannt wird, wird die Quest automatisch abgeschlossen.
                </p>
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <FaShareAlt size={14} />
                  Quest starten
                </button>
              </div>
            )}

            {/* ── STARTING ── */}
            {step === 'starting' && (
              <div className="text-center py-4">
                <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Wird vorbereitet…</p>
              </div>
            )}
          </>
        )}

        {/* ── WAITING: Warte auf @-Tag ── */}
        {!storyClaimToken && step === 'waiting' && (
          <div className="space-y-3">
            <div className="bg-zinc-800/60 rounded-xl px-3 py-3 space-y-2">
              <p className="font-semibold text-white text-xs flex items-center gap-1.5"><FaPaperPlane size={11} className="text-pink-400" /> Story erstellen &amp; @-taggen</p>
              <p className="text-xs text-zinc-400">
                Erstelle eine Story und markiere{creatorHandle ? <> <span className="text-pink-400 font-semibold">@{creatorHandle}</span></> : ' den Creator'} darin. Die Quest wird automatisch abgeschlossen sobald der Tag erkannt wird.
              </p>
            </div>

            {quest.videoUrl && (
              <a
                href={quest.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-pink-600/20 border border-pink-600/40 hover:border-pink-500 rounded-xl px-3 py-2 text-sm text-pink-300 transition-colors"
              >
                <FaShareAlt size={12} />
                Beitrag auf Instagram öffnen
              </a>
            )}

            {expiresAt && (
              <p className="text-center text-xs text-zinc-500">Verläuft in {formatTime(secondsLeft)}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <div className="animate-spin w-3 h-3 border border-zinc-500 border-t-pink-500 rounded-full" />
              Warte auf @-Tag Erkennung…
            </div>
          </div>
        )}

        {/* ── READY: @-Tag erkannt, Belohnung einlösen ── */}
        {!storyClaimToken && step === 'ready' && (
          <div className="space-y-3">
            <div className="bg-green-900/30 border border-green-600/40 rounded-xl px-3 py-3 space-y-1">
              <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                <FaCheck size={13} /> Story erkannt!
              </p>
              <p className="text-xs text-zinc-400">
                Dein @-Tag wurde erkannt. Jetzt Belohnung einlösen.
              </p>
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-600/40 rounded-xl px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <><FaStar size={14} /> Belohnung einlösen</>
              )}
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {!storyClaimToken && step === 'success' && (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">🎉</div>
            <p className="font-bold text-lg text-green-400">Quest abgeschlossen!</p>
              <p className="text-sm text-zinc-400 flex items-center justify-center gap-1">
                <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
                +{formatCredits(rewardAmount || quest.rewardAmount)} D.FAITH Credits wurden gutgeschrieben.
              </p>
            {(quest.reputationReward ?? 0) > 0 && (
              <p className="text-xs text-yellow-400 flex items-center justify-center gap-1">
                <FaStar size={10} /> +{quest.reputationReward} Reputation
              </p>
            )}
            <button onClick={onClose} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Schließen
            </button>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {!storyClaimToken && step === 'expired' && (
          <div className="space-y-3">
            <div className="bg-red-900/30 border border-red-600/40 rounded-xl px-3 py-2 text-xs text-red-300">
              ⏰ Zeit abgelaufen. Bitte starte die Quest neu.
            </div>
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Quest neu starten
            </button>
          </div>
        )}

        {/* ── INVITE PENDING ── */}
        {!storyClaimToken && step === 'invite_pending' && (
          <div className="space-y-3">
            <div className="bg-blue-900/30 border border-blue-600/40 rounded-xl px-3 py-4 text-center space-y-2">
              <p className="text-2xl">📩</p>
              <p className="text-sm font-semibold text-blue-300">Instagram-Einladung annehmen</p>
              <p className="text-xs text-zinc-400">
                Du wurdest als Beta-Tester freigeschaltet! Akzeptiere jetzt die Einladung auf Instagram:
              </p>
              <a
                href="https://www.instagram.com/accounts/manage_access/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 mt-1 px-3 py-1.5 bg-blue-700/40 hover:bg-blue-700/60 border border-blue-600/50 rounded-lg text-xs text-blue-300 hover:text-white transition-colors"
              >
                <FaInstagram size={11} />
                Zu instagram.com/accounts/manage_access
              </a>
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-600/40 rounded-xl px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            <button
              onClick={handleConfirmInvite}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <><FaCheck size={12} /> Einladung angenommen – Quest starten</>
              )}
            </button>
            <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold py-2 rounded-xl text-sm transition-colors">
              Später
            </button>
          </div>
        )}

        {/* ── NOT TESTER ── */}
        {!storyClaimToken && step === 'not_tester' && (
          <div className="space-y-3">
            <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl px-3 py-4 text-center space-y-2">
              <p className="text-2xl">⏳</p>
              <p className="text-sm font-semibold text-yellow-300">Story Quest wird freigeschaltet</p>
              <p className="text-xs text-zinc-400">
                Story Quests sind aktuell im Beta-Modus. Dein Account wird innerhalb von 48h freigeschaltet. Du erhältst danach eine Einladung in Instagram unter:
              </p>
              <a
                href="https://www.instagram.com/accounts/manage_access/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 underline underline-offset-2"
              >
                <FaInstagram size={11} />
                instagram.com/accounts/manage_access
              </a>
            </div>
            <button onClick={onClose} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Alles klar
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {!storyClaimToken && step === 'error' && (
          <div className="space-y-3">
            <div className="bg-red-900/30 border border-red-600/40 rounded-xl px-3 py-2 text-xs text-red-300">
              {error}
            </div>
            <button onClick={() => setStep('idle')} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Zurück
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
        setErrorMsg(data.error ?? 'Fehler beim Einlösen');
        setState('error');
      }
    } catch {
      setErrorMsg('Netzwerkfehler. Bitte versuche es erneut.');
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="text-4xl">🎉</div>
        <p className="font-bold text-lg text-green-400">Quest abgeschlossen!</p>
          <p className="text-sm text-zinc-400 flex items-center justify-center gap-1">
            <Image src="/D.FAITH.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-full shrink-0" />
            +{formatCredits(claimed)} D.FAITH Credits wurden gutgeschrieben.
          </p>
        <button
          onClick={onClose}
          className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
        >
          Schließen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-zinc-800/60 rounded-xl px-3 py-3 space-y-1">
        <p className="font-semibold text-white text-xs">🎁 Story-Link Belohnung</p>
        <p className="text-xs text-zinc-400">
          Du hast den Story-Link des Artists geklickt. Fordere jetzt deine Belohnung ein!
        </p>
      </div>

      {state === 'error' && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-xl px-3 py-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      <button
        onClick={state === 'loading' ? undefined : handleClaim}
        disabled={state === 'loading'}
        className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
      >
        {state === 'loading' ? (
          <>
            <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
            Einlösen…
          </>
        ) : (
          <>
            <FaCheck size={12} />
            +{formatCredits(rewardAmount)} einlösen
          </>
        )}
      </button>
    </div>
  );
}
