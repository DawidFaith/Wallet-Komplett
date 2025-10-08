'use client';

import React, { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import TranslationCacheAdmin from './TranslationCacheAdmin';
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

// Erweiterte Cache-Demo Komponente
export function TranslationCacheDemo() {
  const [testText, setTestText] = useState('Bestätigen');
  const [targetLang, setTargetLang] = useState('EN');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [batchTexts, setBatchTexts] = useState(['Bestätigen', 'Mining Power', 'Wallet Balance']);

  // Teste einzelne Übersetzung
  const testSingleTranslation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText, targetLang }),
      });
      
      const data = await response.json();
      setResult({ type: 'single', data, timestamp: new Date() });
    } catch (error) {
      setResult({ type: 'error', error: error?.toString() });
    } finally {
      setLoading(false);
    }
  };

  // Teste Batch-Übersetzung
  const testBatchTranslation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: batchTexts, targetLang }),
      });
      
      const data = await response.json();
      setResult({ type: 'batch', data, timestamp: new Date() });
    } catch (error) {
      setResult({ type: 'error', error: error?.toString() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        
        {/* Header */}
        <Card className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <h1 className="text-3xl font-bold mb-2">
            🌐 Vercel Blob Translation Cache Demo
          </h1>
          <p className="text-blue-100">
            Teste das globale DeepL Cache-System mit Vercel Blob Storage
          </p>
        </Card>

        {/* Translation Tests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Einzelne Übersetzung */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">🔤 Einzelne Übersetzung</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Text:</label>
                <input
                  type="text"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Text zum Übersetzen..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Zielsprache:</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="EN">🇺🇸 English</option>
                  <option value="PL">🇵🇱 Polski</option>
                </select>
              </div>
              
              <Button
                onClick={testSingleTranslation}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? '⏳ Übersetze...' : '🚀 Übersetzen'}
              </Button>
            </div>
          </Card>

          {/* Batch-Übersetzung */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">📦 Batch-Übersetzung</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Texte (einer pro Zeile):</label>
                <textarea
                  value={batchTexts.join('\n')}
                  onChange={(e) => setBatchTexts(e.target.value.split('\n').filter(t => t.trim()))}
                  className="w-full p-2 border rounded-lg h-24"
                  placeholder="Bestätigen&#10;Mining Power&#10;Wallet Balance"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Zielsprache:</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="EN">🇺🇸 English</option>
                  <option value="PL">🇵🇱 Polski</option>
                </select>
              </div>
              
              <Button
                onClick={testBatchTranslation}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {loading ? '⏳ Übersetze Batch...' : '🚀 Batch Übersetzen'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Ergebnisse */}
        {result && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">📋 Ergebnis</h2>
            
            {result.type === 'error' ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">❌ Fehler: {result.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Performance Info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className={`px-2 py-1 rounded ${
                    result.data.cacheHit 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {result.data.cacheHit ? '🎯 Cache HIT' : '🔄 Cache MISS'}
                  </span>
                  
                  {result.data.source && (
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">
                      📍 {result.data.source}
                    </span>
                  )}
                  
                  {result.data.processingTime && (
                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">
                      ⏱️ {result.data.processingTime}ms
                    </span>
                  )}

                  {result.type === 'batch' && (
                    <span className="px-2 py-1 rounded bg-purple-100 text-purple-800">
                      📦 {result.data.cacheHits}/{result.data.totalRequests} Cache Hits
                    </span>
                  )}
                </div>

                {/* Übersetzungsergebnisse */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Übersetzungen:</h3>
                  
                  {result.type === 'single' ? (
                    <div className="p-2 bg-white rounded border">
                      <span className="font-medium">{testText}</span>
                      <span className="mx-2">→</span>
                      <span className="text-blue-600 font-medium">
                        {result.data.translations[0]?.text}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {batchTexts.map((text, index) => (
                        <div key={index} className="p-2 bg-white rounded border">
                          <span className="font-medium">{text}</span>
                          <span className="mx-2">→</span>
                          <span className="text-blue-600 font-medium">
                            {result.data.translations[index]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Raw JSON Response */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    🔍 Raw API Response anzeigen
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </Card>
        )}

        {/* Cache-Admin Interface */}
        <TranslationCacheAdmin />
      </div>
    </div>
  );
}