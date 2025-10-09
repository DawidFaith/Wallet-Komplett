// DeepL API Translation Service with Vercel Blob Global Cache
import { vercelBlobCache, isVercelEnvironment } from '../lib/vercelBlobCache';

export interface TranslationCache {
  [key: string]: string;
}

export interface DeepLResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

class TranslationService {
  private localCache: TranslationCache = {}; // Fallback für lokale Entwicklung
  private apiKey: string | null = null;
  private useGlobalCache: boolean;

  constructor() {
    // Lade API Key aus Environment Variables
    if (typeof window === 'undefined') {
      // Server-side
      this.apiKey = process.env.DEEPL_API_KEY || null;
    }
    
    // Verwende globalen Cache nur wenn Vercel Blob verfügbar ist
    this.useGlobalCache = isVercelEnvironment();
    
    if (this.useGlobalCache) {
      console.log('🌐 Attempting to use Vercel Blob global translation cache');
    } else {
      console.log('💻 Using local translation cache (development/fallback)');
    }
  }

  // Cache Key generieren
  private getCacheKey(text: string, targetLang: string): string {
    return `${text}_${targetLang}`.toLowerCase();
  }

  // DeepL API Aufruf mit globalem Cache
  async translateText(text: string, targetLang: string): Promise<string> {
    // Wenn Zielsprache Deutsch ist, Original zurückgeben
    if (targetLang === 'de' || targetLang === 'DE') {
      return text;
    }

    // Normalisiere Sprache
    const normalizedLang = targetLang.toUpperCase();

    try {
      // 1. Prüfe globalen Vercel Blob Cache (falls verfügbar)
      if (this.useGlobalCache) {
        try {
          const cachedTranslation = await vercelBlobCache.getTranslation(text, normalizedLang);
          if (cachedTranslation) {
            return cachedTranslation;
          }
        } catch (blobError) {
          console.log(`📝 Blob cache unavailable, using local cache: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`);
          this.useGlobalCache = false; // Umschalten auf lokalen Cache
        }
      }
      
      // 2. Fallback: Lokaler Cache
      const cacheKey = this.getCacheKey(text, normalizedLang);
      if (this.localCache[cacheKey]) {
        console.log(`🎯 Local cache HIT: "${text}" -> "${this.localCache[cacheKey]}"`);
        return this.localCache[cacheKey];
      }

      // 2. Cache Miss - DeepL API Call
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

      // 3. Speichere in entsprechendem Cache
      if (this.useGlobalCache) {
        try {
          await vercelBlobCache.setTranslation(text, normalizedLang, translatedText);
        } catch (blobError) {
          console.log(`📝 Blob save failed, using local cache: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`);
          this.useGlobalCache = false;
          // Fallback: Lokaler Cache
          const cacheKey = this.getCacheKey(text, normalizedLang);
          this.localCache[cacheKey] = translatedText;
          console.log(`💾 Local cache SET: "${text}" -> "${translatedText}"`);
        }
      } else {
        const cacheKey = this.getCacheKey(text, normalizedLang);
        this.localCache[cacheKey] = translatedText;
        console.log(`💾 Local cache SET: "${text}" -> "${translatedText}"`);
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

  // Cache leeren (falls nötig)
  clearCache(): void {
    this.localCache = {};
    // Globaler Cache wird nicht geleert - nur für Admin-Interface
  }

  // Cache Status
  async getCacheSize(): Promise<number> {
    if (this.useGlobalCache) {
      const stats = await vercelBlobCache.getStats();
      return stats.totalTranslations;
    }
    return Object.keys(this.localCache).length;
  }

  // Cache-Statistiken (nur für globalen Cache)
  async getCacheStats() {
    if (this.useGlobalCache) {
      return await vercelBlobCache.getStats();
    }
    return {
      totalTranslations: Object.keys(this.localCache).length,
      totalRequests: 0,
      totalCacheHits: 0,
      cacheHitRate: 0,
      languageDistribution: {},
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