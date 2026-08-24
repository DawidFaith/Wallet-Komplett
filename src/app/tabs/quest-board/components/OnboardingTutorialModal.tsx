'use client';

import React, { useState } from 'react';
import { FaTimes, FaUserCheck, FaTasks, FaCoins, FaGem, FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { t, type Lang } from '../../../utils/i18n';

interface OnboardingTutorialModalProps {
  open: boolean;
  onClose: () => void;
  language?: Lang;
}

const STEP_ICONS = [FaUserCheck, FaTasks, FaCoins, FaGem];
const STEP_COLORS = ['text-pink-400', 'text-cyan-400', 'text-amber-400', 'text-purple-400'];

export default function OnboardingTutorialModal({ open, onClose, language = 'de' }: OnboardingTutorialModalProps) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const steps = [
    { title: t('onboarding.step1Title', language), body: t('onboarding.step1Body', language) },
    { title: t('onboarding.step2Title', language), body: t('onboarding.step2Body', language) },
    { title: t('onboarding.step3Title', language), body: t('onboarding.step3Body', language) },
    { title: t('onboarding.step4Title', language), body: t('onboarding.step4Body', language) },
  ];
  const isLast = step === steps.length - 1;
  const Icon = STEP_ICONS[step];

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      onClick={handleClose}
    >
      <div
        className="bg-[#161410] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">
            {t('onboarding.title', language)}
          </span>
          <button onClick={handleClose} className="text-zinc-500 hover:text-white p-1 -mr-1 transition-colors">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="px-6 py-6 text-center space-y-3">
          <div className={`w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center ${STEP_COLORS[step]}`}>
            <Icon size={26} />
          </div>
          <p className="text-white font-bold text-lg">{steps[step].title}</p>
          <p className="text-zinc-400 text-sm leading-relaxed">{steps[step].body}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-300 ${i === step ? 'w-4 h-1.5 bg-amber-500' : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500'}`}
            />
          ))}
        </div>

        <div className="px-5 pb-5 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="shrink-0 w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center transition-colors"
            >
              <FaArrowLeft size={13} />
            </button>
          )}
          <button
            onClick={() => (isLast ? handleClose() : setStep((s) => s + 1))}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isLast ? (
              <><FaCheck size={12} /> {t('onboarding.done', language)}</>
            ) : (
              <>{t('onboarding.next', language)} <FaArrowRight size={12} /></>
            )}
          </button>
        </div>
        {!isLast && (
          <button
            onClick={handleClose}
            className="w-full text-zinc-600 hover:text-zinc-400 text-xs pb-4 transition-colors"
          >
            {t('onboarding.skip', language)}
          </button>
        )}
      </div>
    </div>
  );
}
