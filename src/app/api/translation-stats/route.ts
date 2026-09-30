// Translation Cache Statistics API
import { NextResponse } from 'next/server';
import { translationCache } from '../../lib/translationCache';

export interface TranslationStatsResponse {
  success: boolean;
  data?: {
    totalTranslations: number;
    totalRequests: number;
    totalCacheHits: number;
    cacheHitRate: number;
    languageDistribution: Record<string, number>;
    estimatedCostSavings: number;
  };
  error?: string;
}

export async function GET() {
  try {
    const stats = await translationCache.getStats();

    // Geschätzte Kosteneinsparungen: $0.02 pro vermiedenem DeepL API-Aufruf
    // (basierend auf 1M Zeichen = $20)
    const estimatedCostSavings = stats.totalCacheHits * 0.02;

    console.log(`📊 Translation stats: ${stats.totalTranslations} cached, ${stats.cacheHitRate}% hit rate`);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        estimatedCostSavings: Math.round(estimatedCostSavings * 100) / 100,
      },
    } as TranslationStatsResponse);

  } catch (error) {
    console.error('Error fetching translation stats:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as TranslationStatsResponse, {
      status: 500
    });
  }
}

// POST endpoint für Cache-Management (Admin-Funktionen)
export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'cleanup': {
        const deletedCount = await translationCache.cleanup();
        return NextResponse.json({
          success: true,
          data: {
            message: `Cleaned up ${deletedCount} old translations`,
            deletedCount
          }
        });
      }

      case 'force_reload':
        await translationCache.forceReload();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Cache reloaded'
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        } as TranslationStatsResponse, { status: 400 });
    }

  } catch (error) {
    console.error('Error in cache management:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as TranslationStatsResponse, {
      status: 500
    });
  }
}
