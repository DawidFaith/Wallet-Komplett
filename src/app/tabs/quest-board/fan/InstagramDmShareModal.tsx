'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaInstagram, FaShareAlt, FaExternalLinkAlt, FaRedo, FaCheck, FaCopy, FaPaperPlane } from 'react-icons/fa';
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
  | 'idle'         // Noch nicht gestartet
  | 'starting'     // Baseline wird geladen
  | 'part1'        // Teil 1: Story teilen, warten auf Share
  | 'checking'     // Share wird geprüft
  | 'part2'        // Share OK, warten auf DM-Klick
  | 'success'      // Quest komplett (über DM-Klick oder poll)
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
  const [copied, setCopied] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [creatorHandle, setCreatorHandle] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown Timer
  useEffect(() => {
    if (step !== 'part1' && step !== 'part2') {
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
        if (data.started && !data.expired) {
          setExpiresAt(data.expiresAt ?? null);
          setInstagramHandle('');
          if (data.shareVerified && !data.clickVerified) {
            setLinkTemplate(data.linkTemplate ?? '');
            setStep('part2');
          } else if (!data.shareVerified) {
            setStep('part1');
          }
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
      setLinkTemplate(data.linkTemplate ?? '');
      setStep('part1');
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress]);

  const handleCheck = useCallback(async () => {
    if (!quest) return;
    setLoading(true);
    setError('');
    setStep('checking');
    try {
      const res = await fetch('/api/instagram-quests/dm-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', questId: quest.id, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Prüfen');
        setStep('part1');
        return;
      }
      if (data.expired) {
        setStep('expired');
      } else if (data.shareVerified && data.clickVerified) {
        // Komplett abgeschlossen (über dm-click Seite bereits completed)
        setStep('success');
        onCompleted(quest.rewardAmount);
      } else if (data.shareVerified) {
        // Story OK → Link-Template anzeigen, warte auf DM-Klick
        setLinkTemplate(data.linkTemplate ?? '');
        setStep('part2');
      } else if (data.notYet) {
        setError(data.message ?? 'Kein neuer Share erkannt. Teile den Beitrag in deiner Story und prüfe erneut.');
        setStep('part1');
      }
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
      setStep('part1');
    } finally {
      setLoading(false);
    }
  }, [quest, walletAddress, onCompleted]);

  // Poll ob DM-Klick erfolgt ist (alle 5 Sek wenn in part2)
  useEffect(() => {
    if (step !== 'part2' || !quest) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/instagram-quests/dm-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', questId: quest.id, walletAddress }),
        });
        const data = await res.json();
        if (data.clickVerified || data.alreadyCompleted) {
          clearInterval(poll);
          setStep('success');
          onCompleted(quest.rewardAmount);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [step, quest, walletAddress, onCompleted]);

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
            <p className="text-xs text-zinc-500">Story Quest · {formatCredits(quest.rewardAmount)} DFAITH</p>
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
            {/* Zwei-Schritt Fortschritt */}
            <div className="flex items-center gap-2 text-xs">
              <StepBadge
                num={1}
                label="Story teilen"
                done={['part2', 'success'].includes(step)}
                active={['part1', 'starting', 'checking'].includes(step)}
              />
              <div className="flex-1 h-px bg-zinc-700" />
              <StepBadge
                num={2}
                label="DM-Link klicken"
                done={step === 'success'}
                active={step === 'part2'}
              />
            </div>

            {/* ── IDLE ── */}
            {step === 'idle' && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Teile diesen Beitrag in deiner Story (Teil 1). Nach der Bestätigung bekommst du einen Link per DM – klicke ihn (Teil 2) um die Belohnung zu erhalten.
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

        {/* ── PART 1: Story teilen ── */}
        {!storyClaimToken && (step === 'part1' || step === 'checking') && (
          <div className="space-y-3">
            <div className="bg-zinc-800/60 rounded-xl px-3 py-3 space-y-1">
              <p className="font-semibold text-white text-xs flex items-center gap-1.5"><FaPaperPlane size={11} className="text-pink-400" /> Teil 1 – Story teilen</p>
              <p className="text-xs text-zinc-400">
                Öffne den Beitrag auf Instagram und teile ihn in deiner Story.
                {creatorHandle && (
                  <> Markiere dabei <span className="text-pink-400 font-semibold">@{creatorHandle}</span> in der Story.</>)}
              </p>
              <p className="text-xs text-zinc-400">
                Komm dann zurück und klicke &quot;Share prüfen&quot;.
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
                Beitrag öffnen &amp; teilen
              </a>
            )}

            {expiresAt && (
              <p className="text-center text-xs text-zinc-500">Verläuft in {formatTime(secondsLeft)}</p>
            )}

            <button
              onClick={handleCheck}
              disabled={loading || step === 'checking'}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              <FaRedo size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Prüfe Share…' : 'Share prüfen'}
            </button>
          </div>
        )}

        {/* ── PART 2: DM-Klick ── */}
        {!storyClaimToken && step === 'part2' && (
          <div className="space-y-3">
            <div className="bg-green-900/30 border border-green-600/40 rounded-xl px-3 py-2 text-xs text-green-300 flex items-center gap-2">
              <FaCheck size={10} /> Story-Share bestätigt!
            </div>

            <div className="bg-zinc-800/60 rounded-xl px-3 py-3 space-y-1">
              <p className="font-semibold text-white text-xs">📩 Teil 2 – DM-Link klicken</p>
              <p className="text-xs text-zinc-400">
                Du bekommst gleich einen Link per DM. Klicke ihn um die Quest abzuschließen.
              </p>
            </div>

            {/* Link-Template für Creator zum Kopieren */}
            {linkTemplate && (
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Link-Template (für Link DM konfiguriert)</p>
                <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-xl px-3 py-2">
                  <span className="text-xs text-pink-300 truncate flex-1 font-mono">{linkTemplate}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(linkTemplate);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 text-zinc-400 hover:text-white transition-colors"
                    title="Kopieren"
                  >
                    {copied ? <FaCheck size={12} className="text-green-400" /> : <FaCopy size={12} />}
                  </button>
                </div>
              </div>
            )}

            {expiresAt && (
              <p className="text-center text-xs text-zinc-500">Verläuft in {formatTime(secondsLeft)}</p>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <div className="animate-spin w-3 h-3 border border-zinc-500 border-t-pink-500 rounded-full" />
              Warte auf Klick…
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {!storyClaimToken && step === 'success' && (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">🎉</div>
            <p className="font-bold text-lg text-green-400">Quest abgeschlossen!</p>
            <p className="text-sm text-zinc-400">
              +{formatCredits(rewardAmount || quest.rewardAmount)} DFAITH Credits wurden gutgeschrieben.
            </p>
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
        <p className="text-sm text-zinc-400">
          +{formatCredits(claimed)} DFAITH Credits wurden gutgeschrieben.
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
