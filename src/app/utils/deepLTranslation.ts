// DeepL API Translation Service - Client-Side Only (No Direct Blob Access)

export interface TranslationCache {
  [key: string]: string;
}

export interface DeepLResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
  cacheHit?: boolean;
  source?: string;
}

class TranslationService {
  private localCache: TranslationCache = {}; // Client-side cache

  constructor() {
    console.log('💻 Client-side: Translation service using API routes with server-side blob cache');
  }

  // Cache Key generieren
  private getCacheKey(text: string, targetLang: string): string {
    return `${text}_${targetLang}`.toLowerCase();
  }

  // DeepL API Aufruf über API Route (Server macht Blob Cache Check)
  async translateText(text: string, targetLang: string): Promise<string> {
    // Wenn Zielsprache Deutsch ist, Original zurückgeben
    if (targetLang === 'de' || targetLang === 'DE') {
      return text;
    }

    // Normalisiere Sprache
    const normalizedLang = targetLang.toUpperCase();

    try {
      // 1. Prüfe lokalen Client-Cache
      const cacheKey = this.getCacheKey(text, normalizedLang);
      if (this.localCache[cacheKey]) {
        console.log(`🎯 Client cache HIT: "${text}" -> "${this.localCache[cacheKey]}"`);
        return this.localCache[cacheKey];
      }

      // 2. API Call (Server-side macht Blob Cache Check + DeepL API)
      console.log(`🔄 API call for: "${text}" -> ${normalizedLang}`);
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          targetLang: normalizedLang,
        }),
      });

      if (!response.ok) {
        console.warn(`Translation failed for "${text}":`, response.statusText);
        return text; // Fallback auf Originaltext
      }

      const data: DeepLResponse = await response.json();
      const translatedText = data.translations[0]?.text || text;

      // 3. Speichere im lokalen Client-Cache
      this.localCache[cacheKey] = translatedText;
      
      // Log mit Cache-Info von Server (falls verfügbar)
      if (data.cacheHit !== undefined) {
        const cacheInfo = data.cacheHit ? 
          `🎯 Server cache HIT (${data.source || 'unknown'})` : 
          `🔄 Server cache MISS -> DeepL API`;
        console.log(`📊 ${cacheInfo} + Client cache SET: "${text}" -> "${translatedText}"`);
      } else {
        console.log(`💾 Client cache SET: "${text}" -> "${translatedText}"`);
      }
      
      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Fallback auf Originaltext
    }
  }

  // Mehrere Texte gleichzeitig übersetzen (effizienter)
  async translateMultiple(texts: string[], targetLang: string): Promise<string[]> {
    if (targetLang === 'de' || targetLang === 'DE') {
      return texts;
    }

    // Batch-Verarbeitung für bessere Performance
    const batchSize = 5; // Reduziere gleichzeitige API-Calls
    const results: string[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.translateText(text, targetLang));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Kleine Pause zwischen Batches um Performance-Warnings zu vermeiden
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  // Cache leeren
  clearCache(): void {
    this.localCache = {};
  }

  // Cache Status (nur lokaler Cache)
  getCacheSize(): number {
    return Object.keys(this.localCache).length;
  }

  // Client-Cache-Statistiken
  getCacheStats() {
    return {
      totalTranslations: Object.keys(this.localCache).length,
      clientSideOnly: true,
      serverSideCacheViaAPI: true
    };
  }
}

// Singleton Instance
export const translationService = new TranslationService();

// Unterstützte Sprachen
export const SUPPORTED_LANGUAGES = {
  de: 'DE', // Deutsch
  en: 'EN', // English
  pl: 'PL'  // Polski
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;
