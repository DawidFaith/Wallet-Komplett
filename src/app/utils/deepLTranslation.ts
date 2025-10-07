// DeepL API Translation Service
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
  private cache: TranslationCache = {};
  private apiKey: string | null = null;

  constructor() {
    // Lade API Key aus Environment Variables
    if (typeof window === 'undefined') {
      // Server-side
      this.apiKey = process.env.DEEPL_API_KEY || null;
    }
  }

  // Cache Key generieren
  private getCacheKey(text: string, targetLang: string): string {
    return `${text}_${targetLang}`.toLowerCase();
  }

  // DeepL API Aufruf
  async translateText(text: string, targetLang: string): Promise<string> {
    // Wenn Zielsprache Deutsch ist, Original zurückgeben
    if (targetLang === 'de' || targetLang === 'DE') {
      return text;
    }

    const cacheKey = this.getCacheKey(text, targetLang);
    
    // Cache prüfen
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      // DeepL API Call
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          targetLang: targetLang.toUpperCase(),
        }),
      });

      if (!response.ok) {
        console.warn(`Translation failed for "${text}":`, response.statusText);
        return text; // Fallback auf Originaltext
      }

      const data: DeepLResponse = await response.json();
      const translatedText = data.translations[0]?.text || text;

      // In Cache speichern
      this.cache[cacheKey] = translatedText;
      
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

    const results: string[] = [];
    
    for (const text of texts) {
      const translated = await this.translateText(text, targetLang);
      results.push(translated);
    }
    
    return results;
  }

  // Cache leeren (falls nötig)
  clearCache(): void {
    this.cache = {};
  }

  // Cache Status
  getCacheSize(): number {
    return Object.keys(this.cache).length;
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