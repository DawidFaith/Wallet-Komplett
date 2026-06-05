'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaKey, FaStar, FaCheck } from 'react-icons/fa';
import Modal from '../components/Modal';
import type { QuestIndexEntry } from '../types';
import { formatCredits } from '../utils';
import { useLang } from '../../../components/LangContext';
import { t } from '../../../utils/i18n';

interface SecretVerifyModalProps {
  quest: QuestIndexEntry | null;
  walletAddress: string;
  levelBonusPercent?: number;
  onCompleted: (rewardAmount: number, levelBonus?: number) => void;
  onClose: () => void;
}

type Step = 'input' | 'wrong' | 'success' | 'error';

export default function SecretVerifyModal({
  quest,
  walletAddress,
  levelBonusPercent = 0,
  onCompleted,
  onClose,
}: SecretVerifyModalProps) {
  const lang = useLang();
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [levelBonus, setLevelBonus] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const levelBonusAmount = quest ? Math.round(quest.rewardAmount * levelBonusPercent) / 100 : 0;
  const displayReward = quest ? quest.rewardAmount + levelBonusAmount : 0;

  const handleClose = () => {
    setCode('');
    setStep('input');
    setLoading(false);
    setLevelBonus(0);
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quest || !code.trim()) return;
    setLoading(true);
    try {
      const endpoint = quest.platform === 'tiktok'
        ? '/api/tiktok-quests/secret-verify'
        : quest.platform === 'facebook'
        ? '/api/facebook-quests/secret-verify'
        : '/api/youtube-quests/secret-verify';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id, walletAddress, code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Unbekannter Fehler');
        setStep('error');
        return;
      }

      if (data.notYet) {
        setStep('wrong');
      } else if (data.success) {
        setRewardAmount(data.rewardAmount);
        setLevelBonus(data.levelBonus ?? 0);
        setStep('success');
        onCompleted(data.rewardAmount, data.levelBonus);
      }
    } catch {
      setErrorMsg(lang === 'en' ? 'Network error. Please try again.' : lang === 'pl' ? 'Błąd sieci. Spróbuj ponownie.' : 'Netzwerkfehler. Bitte versuche es erneut.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === 'success' ? t('verify.secretCorrect', lang)
    : step === 'error' ? t('verify.errorTitle', lang)
    : t('verify.secretTitle', lang);

  return (
    <Modal open={!!quest} onClose={handleClose} title={title}>
      {/* Reward-Banner */}
      {quest && step !== 'success' && step !== 'error' && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-2.5 mb-1">
          <span className="text-zinc-400 text-xs">{t('verify.rewardLabel', lang)}</span>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
              <Image src="/D.FAITH.png" alt="" width={13} height={13} className="w-3.5 h-3.5 rounded-full shrink-0" />
              +{formatCredits(displayReward)} D.FAITH
            </span>
            {levelBonusPercent > 0 && (
              <span className="text-green-300 font-bold text-[10px]">{lang === 'en' ? `incl. +${levelBonusPercent}% Bonus` : lang === 'pl' ? `w tym +${levelBonusPercent}% Bonus` : `inkl. +${levelBonusPercent}% Bonus`}</span>
            )}
            {(quest.reputationReward ?? 0) > 0 && (
              <span className="text-purple-300 font-bold text-sm flex items-center gap-1">
                <FaStar size={10} /> +{quest?.reputationReward} REP
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Erfolg ─────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="space-y-4">
          <style>{`
            @keyframes secretConfettiFloat {
              0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
              100% { transform: translateY(-120px) rotate(240deg) scale(0.6); opacity: 0; }
            }
            .secret-confetti {
              position: absolute;
              animation: secretConfettiFloat 1.25s ease-out forwards;
              pointer-events: none;
              font-size: 1rem;
            }
          `}</style>
          <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-6 text-center">
            {['🎊', '✨', '🎉', '⭐', '💫', '🎊', '✨', '🎉'].map((icon, i) => (
              <span
                key={i}
                className="secret-confetti"
                style={{
                  left: `${12 + i * 11}%`,
                  bottom: `${8 + (i % 3) * 10}%`,
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                {icon}
              </span>
            ))}
            <FaCheck size={32} className="text-green-400 mx-auto mb-3" />
            <p className="text-green-300 font-semibold text-lg">{t('verify.secretCodeRight', lang)}</p>
            <div className="flex flex-col items-center gap-1 mt-2">
              <div className="flex items-center gap-1 text-amber-400 font-bold text-xl">
                <Image src="/D.FAITH.png" alt="" width={16} height={16} className="w-4 h-4 rounded-full" />
                +{formatCredits(rewardAmount)} D.FAITH
              </div>
              {(quest?.reputationReward ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-purple-300 font-bold text-sm">
                  <FaStar size={10} /> +{quest?.reputationReward} REP
                </div>
              )}
              {levelBonus > 0 && (
                <div className="text-green-300 text-xs font-semibold mt-1">
                  {t('verify.repBonus', lang).replace('{bonus}', formatCredits(levelBonus))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            {t('btn.close', lang)}
          </button>
        </div>
      )}

      {/* ── Fehler ──────────────────────────────────────────────── */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
            <p className="text-amber-300 text-sm">{errorMsg}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors font-semibold"
          >
            {t('btn.close', lang)}
          </button>
        </div>
      )}

      {/* ── Code-Eingabe / Falscher Code ───────────────────── */}
      {(step === 'input' || step === 'wrong') && quest && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-3">
            <p className="text-blue-200 text-xs leading-relaxed">
              {t('verify.secretInstruction', lang).replace('{platform}',
                quest.platform === 'youtube' ? 'YouTube Short'
                : quest.platform === 'tiktok' ? 'TikTok Video'
                : quest.platform === 'facebook' ? 'Facebook Video'
                : 'Reel'
              )}
            </p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-4 space-y-1">
            <p className="text-white text-sm font-semibold">{quest.videoTitle}</p>
            <p className="text-zinc-400 text-xs">
              {quest.description || '🔑 Finde den geheimen Code im Video und gib ihn ein!'}
            </p>
          </div>

          {step === 'wrong' && (
            <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl p-3">
              <p className="text-orange-300 text-sm font-semibold">Falscher Code!</p>
              <p className="text-orange-200 text-xs mt-0.5">
                Schau nochmal ins Video – die Buchstaben sind nacheinander versteckt.
              </p>
            </div>
          )}

          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-1.5">
              <FaKey className="inline mr-1 text-yellow-400" size={12} />
              {t('verify.secretInputLabel', lang)}
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('verify.secretInputPlaceholder', lang)}
              maxLength={50}
              required
              autoFocus
              className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-yellow-500 focus:outline-none text-sm placeholder-zinc-500 font-mono tracking-widest text-center text-lg uppercase"
            />
            <p className="text-zinc-600 text-xs mt-1 text-center">
              {lang === 'en' ? 'Case does not matter' : lang === 'pl' ? 'Wielkość liter nie ma znaczenia' : 'Groß-/Kleinschreibung spielt keine Rolle'}
            </p>
          </div>

          <a
            href={quest.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {t('verify.toVideoFindCode', lang)}
          </a>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="border-2 border-black/30 border-t-black rounded-full w-4 h-4 animate-spin" />
              : <><FaKey size={14} /> {t('verify.secretSubmit', lang)}</>
            }
          </button>
        </form>
      )}
    </Modal>
  );
}
