/**
 * Übersetzungs-Cache — Postgres statt Vercel Blob.
 *
 * Vorher lag der komplette Cache als eine einzige JSON-Datei auf Vercel Blob
 * und wurde bei JEDEM Cache-Treffer (nicht nur bei neuen Übersetzungen)
 * erneut vollständig hochgeladen — auf dem Hobby-Plan ein unnötig großer
 * Treiber für Blob-Operationen/Bandbreite. Neon/Postgres wird in dieser App
 * ohnehin schon für alles genutzt, kostet hier nichts extra und passt als
 * Key-Value-Zugriffsmuster (ein Wert pro Anfrage statt ganze Datei) deutlich
 * besser.
 *
 * Öffentliche API (getTranslation/setTranslation/getStats/cleanup/forceReload)
 * bleibt unverändert, damit /api/translate, /api/translate-batch und
 * /api/translation-stats ohne Änderungen weiterlaufen.
 */
import { getDb } from './db';

export interface TranslationStats {
  totalRequests: number;
  totalCacheHits: number;
  languageDistribution: Record<string, number>;
  totalTranslations: number;
  cacheHitRate: number;
}

async function ensureTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS translation_cache (
      cache_key       TEXT PRIMARY KEY,
      source_text     TEXT NOT NULL,
      target_language TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      usage_count     INTEGER NOT NULL DEFAULT 1,
      last_used       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_translation_cache_last_used ON translation_cache (last_used)`;
  await sql`
    CREATE TABLE IF NOT EXISTS translation_cache_stats (
      id                     INTEGER PRIMARY KEY DEFAULT 1,
      total_requests         INTEGER NOT NULL DEFAULT 0,
      total_cache_hits       INTEGER NOT NULL DEFAULT 0,
      language_distribution  JSONB   NOT NULL DEFAULT '{}'::jsonb,
      CHECK (id = 1)
    )
  `;
  await sql`INSERT INTO translation_cache_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
}

function cacheKey(text: string, targetLang: string): string {
  return `${text.toLowerCase().trim()}_${targetLang.toLowerCase()}`;
}

class TranslationCache {
  /** Holt eine gecachte Übersetzung, oder null bei Cache-Miss. */
  async getTranslation(text: string, targetLang: string): Promise<string | null> {
    await ensureTables();
    const sql = getDb();
    const key = cacheKey(text, targetLang);

    await sql`
      UPDATE translation_cache_stats SET total_requests = total_requests + 1 WHERE id = 1
    `;

    const rows = await sql`
      UPDATE translation_cache
      SET usage_count = usage_count + 1, last_used = NOW()
      WHERE cache_key = ${key}
      RETURNING translated_text
    `;
    if (!rows.length) return null;

    await sql`UPDATE translation_cache_stats SET total_cache_hits = total_cache_hits + 1 WHERE id = 1`;
    return rows[0].translated_text as string;
  }

  /** Speichert eine neue Übersetzung im Cache. */
  async setTranslation(text: string, targetLang: string, translatedText: string): Promise<void> {
    await ensureTables();
    const sql = getDb();
    const key = cacheKey(text, targetLang);

    await sql`
      INSERT INTO translation_cache (cache_key, source_text, target_language, translated_text)
      VALUES (${key}, ${text}, ${targetLang}, ${translatedText})
      ON CONFLICT (cache_key) DO UPDATE
      SET translated_text = ${translatedText}, last_used = NOW()
    `;
    await sql`
      UPDATE translation_cache_stats
      SET language_distribution = language_distribution || jsonb_build_object(
        ${targetLang}, COALESCE((language_distribution->>${targetLang})::int, 0) + 1
      )
      WHERE id = 1
    `;
  }

  async getStats(): Promise<TranslationStats> {
    await ensureTables();
    const sql = getDb();
    const [statsRow] = await sql`SELECT total_requests, total_cache_hits, language_distribution FROM translation_cache_stats WHERE id = 1`;
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM translation_cache`;

    const totalRequests = Number(statsRow?.total_requests ?? 0);
    const totalCacheHits = Number(statsRow?.total_cache_hits ?? 0);
    const cacheHitRate = totalRequests > 0 ? (totalCacheHits / totalRequests) * 100 : 0;

    return {
      totalRequests,
      totalCacheHits,
      languageDistribution: (statsRow?.language_distribution as Record<string, number>) ?? {},
      totalTranslations: Number(count ?? 0),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    };
  }

  /** Entfernt alte, selten verwendete Einträge. Gibt die Anzahl gelöschter Zeilen zurück. */
  async cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    await ensureTables();
    const sql = getDb();
    const cutoff = new Date(Date.now() - maxAge).toISOString();
    const rows = await sql`
      DELETE FROM translation_cache WHERE last_used < ${cutoff} AND usage_count < 3 RETURNING cache_key
    `;
    return rows.length;
  }

  /** Kein In-Memory-State mehr zu invalidieren — Postgres ist immer die aktuelle Quelle. Bleibt als No-Op für Abwärtskompatibilität. */
  async forceReload(): Promise<void> {
    await ensureTables();
  }
}

export const translationCache = new TranslationCache();
