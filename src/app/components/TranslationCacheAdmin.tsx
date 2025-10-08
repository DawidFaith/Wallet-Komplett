'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

interface TranslationStats {
  totalTranslations: number;
  totalRequests: number;
  totalCacheHits: number;
  cacheHitRate: number;
  languageDistribution: Record<string, number>;
  estimatedCostSavings: number;
  environment: 'vercel' | 'local';
  lastUpdated?: string;
}

export default function TranslationCacheAdmin() {
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Lade Statistiken
  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/translation-stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        setMessage(`Fehler: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Fehler beim Laden der Statistiken: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Cache-Management Operationen
  const performCacheOperation = async (action: string) => {
    try {
      setOperationLoading(true);
      setMessage('');

      const response = await fetch('/api/translation-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(`✅ ${data.data.message || 'Operation erfolgreich'}`);
        await loadStats(); // Statistiken neu laden
      } else {
        setMessage(`❌ Fehler: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Fehler: ${error}`);
    } finally {
      setOperationLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Lade Cache-Statistiken...</span>
        </div>
      </Card>
    );
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('de-DE').format(num);
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Haupt-Statistiken */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <span className="mr-2">📊</span>
          Translation Cache Statistiken
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({stats?.environment === 'vercel' ? '☁️ Vercel Blob' : '💻 Lokal'})
          </span>
        </h2>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gespeicherte Übersetzungen */}
            <div className="bg-blue-50 p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-gray-600">Gespeicherte Übersetzungen</h3>
              <p className="text-2xl font-bold text-blue-600">
                {formatNumber(stats.totalTranslations)}
              </p>
            </div>

            {/* Cache Hit Rate */}
            <div className="bg-green-50 p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-gray-600">Cache Hit Rate</h3>
              <p className="text-2xl font-bold text-green-600">
                {formatPercentage(stats.cacheHitRate)}
              </p>
              <p className="text-xs text-gray-500">
                {formatNumber(stats.totalCacheHits)} / {formatNumber(stats.totalRequests)}
              </p>
            </div>

            {/* Kosteneinsparungen */}
            <div className="bg-purple-50 p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-gray-600">Geschätzte Einsparungen</h3>
              <p className="text-2xl font-bold text-purple-600">
                ${stats.estimatedCostSavings.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">in DeepL API-Kosten</p>
            </div>

            {/* Letzte Aktualisierung */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-gray-600">Letzte Aktualisierung</h3>
              <p className="text-sm font-medium text-gray-800">
                {stats.lastUpdated 
                  ? new Date(stats.lastUpdated).toLocaleString('de-DE')
                  : 'Unbekannt'
                }
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Sprachverteilung */}
      {stats && stats.environment === 'vercel' && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">🌍 Sprachverteilung</h3>
          <div className="space-y-2">
            {Object.entries(stats.languageDistribution).map(([lang, count]) => {
              const percentage = stats.totalRequests > 0 
                ? (count / stats.totalRequests) * 100 
                : 0;
              
              return (
                <div key={lang} className="flex items-center justify-between">
                  <span className="font-medium">
                    {lang === 'EN' ? '🇺🇸 Englisch' : 
                     lang === 'PL' ? '🇵🇱 Polnisch' : 
                     `🌐 ${lang}`}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-16 text-right">
                      {formatNumber(count)} ({formatPercentage(percentage)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Cache-Management (nur für Vercel) */}
      {stats && stats.environment === 'vercel' && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">⚙️ Cache-Verwaltung</h3>
          
          <div className="flex flex-wrap gap-3 mb-4">
            <Button
              onClick={() => loadStats()}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              🔄 Statistiken aktualisieren
            </Button>
            
            <Button
              onClick={() => performCacheOperation('force_reload')}
              disabled={operationLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              ⚡ Cache neu laden
            </Button>
            
            <Button
              onClick={() => performCacheOperation('cleanup')}
              disabled={operationLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              🧹 Alte Einträge bereinigen
            </Button>
          </div>

          {operationLoading && (
            <div className="flex items-center text-blue-600 mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Operation wird ausgeführt...
            </div>
          )}

          {message && (
            <div className={`p-3 rounded-lg ${
              message.startsWith('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}
        </Card>
      )}

      {/* Lokale Entwicklung Hinweis */}
      {stats && stats.environment === 'local' && (
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start">
            <span className="text-2xl mr-3">💻</span>
            <div>
              <h3 className="text-lg font-bold text-yellow-800 mb-2">
                Lokale Entwicklungsumgebung
              </h3>
              <p className="text-yellow-700">
                Das globale Vercel Blob Caching ist nur in der Vercel-Umgebung verfügbar. 
                In der lokalen Entwicklung wird ein temporärer lokaler Cache verwendet.
              </p>
              <p className="text-yellow-700 mt-2">
                Nach dem Deployment zu Vercel wird automatisch das globale Caching aktiviert.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}