import React, { useState } from 'react';
import { TranslatedText, TranslatedTitle, TranslatedButton } from './TranslatedText';
import type { SupportedLanguage } from '../utils/deepLTranslation';

interface TranslationDemoProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
}

export function TranslationDemo({ language, onLanguageChange }: TranslationDemoProps) {
  const [demoTexts] = useState([
    "Willkommen bei Dawid Faith",
    "Tokenomics",
    "Community",
    "Staking Rewards", 
    "Top Holder",
    "Live Metriken",
    "Whitepaper studieren",
    "Leaderboard anzeigen"
  ]);

  return (
    <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
      <TranslatedTitle 
        text="Übersetzungs-Demo" 
        language={language}
        level={2}
        className="text-xl font-bold text-white mb-4"
      />
      
      {/* Language Selector */}
      <div className="flex gap-2 mb-6">
        {(['de', 'en', 'pl'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => onLanguageChange(lang)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              language === lang 
                ? 'bg-blue-600 text-white' 
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Demo Texts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demoTexts.map((text, index) => (
          <div key={index} className="bg-zinc-900 rounded-lg p-4">
            <div className="text-xs text-zinc-500 mb-1">Original (DE):</div>
            <div className="text-zinc-300 mb-2">{text}</div>
            
            <div className="text-xs text-zinc-500 mb-1">
              Übersetzt ({language.toUpperCase()}):
            </div>
            <TranslatedText
              text={text}
              language={language}
              className="text-white font-medium"
              showLoadingIndicator={true}
            />
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
        <div className="text-xs text-zinc-500">Status:</div>
        <div className="text-sm text-zinc-300">
          <span className="text-green-400">✓</span> DeepL API Integration aktiv
          {language === 'de' ? (
            <span className="text-zinc-500 ml-2">(keine Übersetzung nötig)</span>
          ) : (
            <span className="text-blue-400 ml-2">(übersetzt nach {language.toUpperCase()})</span>
          )}
        </div>
      </div>
    </div>
  );
}