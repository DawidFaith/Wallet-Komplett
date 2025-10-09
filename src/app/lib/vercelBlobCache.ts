// Vercel Blob Global Translation Cache
import { put, head, list } from '@vercel/blob';

export interface TranslationCacheEntry {
  sourceText: string;
  targetLanguage: string;
  translatedText: string;
  createdAt: string;
  usageCount: number;
  lastUsed: string;
}

export interface TranslationCacheData {
  version: string;
  lastUpdated: string;
  translations: Record<string, TranslationCacheEntry>;
  stats: {
    totalRequests: number;
    totalCacheHits: number;
    languageDistribution: Record<string, number>;
  };
}

class VercelBlobTranslationCache {
  private readonly CACHE_BLOB_NAME = 'translation-cache.json';
  private localCache: TranslationCacheData | null = null;
  private isLoading = false;

  // Cache Key generieren
  private getCacheKey(text: string, targetLang: string): string {
    return `${text.toLowerCase().trim()}_${targetLang.toLowerCase()}`;
  }

  // Initialisiere leeren Cache
  private createEmptyCache(): TranslationCacheData {
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      translations: {},
      stats: {
        totalRequests: 0,
        totalCacheHits: 0,
        languageDistribution: {},
      },
    };
  }

  // Lade Cache von Vercel Blob
  async loadCache(): Promise<TranslationCacheData> {
    if (this.localCache && !this.isExpired()) {
      return this.localCache;
    }

    if (this.isLoading) {
      // Warte auf laufenden Load-Vorgang
      await this.waitForLoad();
      return this.localCache || this.createEmptyCache();
    }

    this.isLoading = true;

    try {
      // Prüfe ob Vercel Blob verfügbar ist
      if (!this.canUseVercelBlob()) {
        console.log('📝 Using local cache - Vercel Blob not available');
        this.localCache = this.createEmptyCache();
        return this.localCache;
      }

      // Prüfe ob Blob existiert
      const blobs = await list({ prefix: this.CACHE_BLOB_NAME });
      
      if (blobs.blobs.length === 0) {
        console.log('🆕 Creating new translation cache blob');
        this.localCache = this.createEmptyCache();
        await this.saveCache();
        return this.localCache;
      }

      // Lade existierenden Cache
      const blobUrl = blobs.blobs[0].url;
      const response = await fetch(blobUrl);
      
      if (!response.ok) {
        console.warn('⚠️ Failed to load cache blob, creating new one');
        this.localCache = this.createEmptyCache();
        return this.localCache;
      }

      const cacheData = await response.json() as TranslationCacheData;
      this.localCache = cacheData;
      
      console.log(`✅ Loaded translation cache: ${Object.keys(cacheData.translations).length} entries`);
      return this.localCache;

    } catch (error) {
      console.error('❌ Error loading translation cache:', error);
      console.log('📝 Falling back to local cache');
      this.localCache = this.createEmptyCache();
      return this.localCache;
    } finally {
      this.isLoading = false;
    }
  }

  // Warte auf laufenden Load-Vorgang
  private async waitForLoad(): Promise<void> {
    while (this.isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Prüfe ob lokaler Cache veraltet ist (5 Minuten)
  private isExpired(): boolean {
    if (!this.localCache) return true;
    const lastUpdate = new Date(this.localCache.lastUpdated);
    const now = new Date();
    return (now.getTime() - lastUpdate.getTime()) > 5 * 60 * 1000; // 5 Minuten
  }

  // Speichere Cache zu Vercel Blob
  async saveCache(): Promise<void> {
    if (!this.localCache) return;

    // Prüfe ob wir wirklich in der Vercel-Umgebung sind
    if (!this.canUseVercelBlob()) {
      console.log('🔄 Skipping blob save - not in Vercel environment or token missing');
      return;
    }

    try {
      this.localCache.lastUpdated = new Date().toISOString();
      
      const blob = await put(this.CACHE_BLOB_NAME, JSON.stringify(this.localCache, null, 2), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
      });

      console.log(`💾 Translation cache saved to blob: ${blob.url}`);
    } catch (error) {
      console.error('❌ Error saving translation cache:', error);
      // Fallback: Nutze lokalen Cache weiter
      console.log('📝 Continuing with local cache as fallback');
    }
  }

  // Prüfe ob Vercel Blob verfügbar ist
  private canUseVercelBlob(): boolean {
    // Prüfe verschiedene mögliche Token-Namen basierend auf Custom Prefix
    const tokenSources = [
      'BLOB_READ_WRITE_TOKEN',
      'NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN',
      'VERCEL_BLOB_READ_WRITE_TOKEN',
      // Custom prefix variations (wallet-komplett-qswd)
      'WALLET_KOMPLETT_QSWD_BLOB_READ_WRITE_TOKEN',
      'WALLETKOMPLETT_QSWD_BLOB_READ_WRITE_TOKEN',
      'WALLET_KOMPLETT_QSWD_BLOB_READ_WRITE_TOKEN',
    ];
    
    let foundToken = '';
    let tokenSource = '';
    
    for (const source of tokenSources) {
      const token = process.env[source];
      if (token && token.length > 10) { // Mindestlänge für gültiges Token
        foundToken = token;
        tokenSource = source;
        break;
      }
    }
    
    const hasToken = !!foundToken;
    const isVercel = !!(
      process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.NEXT_PUBLIC_VERCEL_ENV
    );

    // Debug logging mit allen verfügbaren Blob-Environment Variables
    const allBlobEnvs = Object.keys(process.env)
      .filter(key => key.toLowerCase().includes('blob'))
      .map(key => ({
        name: key,
        length: process.env[key]?.length || 0,
        prefix: process.env[key]?.substring(0, 20)
      }));

    console.log(`🔍 Blob availability check:`, {
      hasToken,
      tokenSource,
      tokenLength: foundToken.length,
      tokenPrefix: foundToken ? foundToken.substring(0, 20) + '...' : 'none',
      allBlobEnvs,
      isVercel,
      vercelEnv: process.env.VERCEL_ENV,
      canUse: hasToken
    });

    // Wenn Token vorhanden ist, versuche Blob zu verwenden
    return hasToken;
  }

  // Hole Übersetzung aus Cache
  async getTranslation(text: string, targetLang: string): Promise<string | null> {
    const cache = await this.loadCache();
    const cacheKey = this.getCacheKey(text, targetLang);
    
    // Update Stats
    cache.stats.totalRequests++;
    
    const entry = cache.translations[cacheKey];
    if (entry) {
      // Cache Hit
      entry.usageCount++;
      entry.lastUsed = new Date().toISOString();
      cache.stats.totalCacheHits++;
      
      // Immer speichern für maximale Cache-Persistenz
      await this.saveCache();
      
      console.log(`🎯 Cache HIT: "${text}" -> "${entry.translatedText}" (${targetLang})`);
      return entry.translatedText;
    }
    
    console.log(`🔍 Cache MISS: "${text}" (${targetLang})`);
    return null;
  }

  // Speichere neue Übersetzung in Cache
  async setTranslation(text: string, targetLang: string, translatedText: string): Promise<void> {
    const cache = await this.loadCache();
    const cacheKey = this.getCacheKey(text, targetLang);
    
    // Erstelle neuen Cache-Eintrag
    cache.translations[cacheKey] = {
      sourceText: text,
      targetLanguage: targetLang,
      translatedText,
      createdAt: new Date().toISOString(),
      usageCount: 1,
      lastUsed: new Date().toISOString(),
    };
    
    // Update Sprach-Statistiken
    cache.stats.languageDistribution[targetLang] = 
      (cache.stats.languageDistribution[targetLang] || 0) + 1;
    
    // Versuche zu speichern (Fallback bei Fehlern)
    if (this.canUseVercelBlob()) {
      await this.saveCache();
    } else {
      console.log(`📝 Local cache SET: "${text}" -> "${translatedText}" (${targetLang})`);
    }
    
    console.log(`💾 New translation cached: "${text}" -> "${translatedText}" (${targetLang})`);
  }

  // Hole Cache-Statistiken
  async getStats(): Promise<TranslationCacheData['stats'] & { totalTranslations: number; cacheHitRate: number }> {
    const cache = await this.loadCache();
    const totalTranslations = Object.keys(cache.translations).length;
    const cacheHitRate = cache.stats.totalRequests > 0 
      ? (cache.stats.totalCacheHits / cache.stats.totalRequests) * 100 
      : 0;

    return {
      ...cache.stats,
      totalTranslations,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    };
  }

  // Cache-Cleanup (entferne alte, selten verwendete Einträge)
  async cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cache = await this.loadCache();
    const now = new Date().getTime();
    let deletedCount = 0;

    for (const [key, entry] of Object.entries(cache.translations)) {
      const entryAge = now - new Date(entry.lastUsed).getTime();
      
      // Lösche wenn älter als maxAge und wenig verwendet
      if (entryAge > maxAge && entry.usageCount < 3) {
        delete cache.translations[key];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await this.saveCache();
      console.log(`🧹 Cleaned up ${deletedCount} old translation entries`);
    }

    return deletedCount;
  }

  // Force Reload vom Blob (für Admin-Interface)
  async forceReload(): Promise<TranslationCacheData> {
    this.localCache = null;
    return await this.loadCache();
  }
}

// Singleton Instance
export const vercelBlobCache = new VercelBlobTranslationCache();

// Hilfsfunktionen für Environment Detection
export const isVercelEnvironment = (): boolean => {
  return !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV
  );
};

export const hasBlobAccess = (): boolean => {
  return !!(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN
  );
};

export const getBlobEnvironmentInfo = () => {
  const hasToken = hasBlobAccess();
  const tokenLength = hasToken ? (process.env.BLOB_READ_WRITE_TOKEN?.length || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN?.length || 0) : 0;
  
  return {
    isVercel: isVercelEnvironment(),
    vercelEnv: process.env.VERCEL_ENV || 'development',
    hasBlobAccess: hasToken,
    tokenLength,
    canUseBlob: hasToken, // Vereinfacht: nur Token-Check
    tokenSource: process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN' : 
                 process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN ? 'NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN' : 
                 'none',
    environment: process.env.NODE_ENV || 'development'
  };
};