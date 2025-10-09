// Translation Cache Statistics API
import { NextResponse } from 'next/server';
import { vercelBlobCache, isVercelEnvironment, getBlobEnvironmentInfo } from '../../lib/vercelBlobCache';

export interface TranslationStatsResponse {
  success: boolean;
  data?: {
    totalTranslations: number;
    totalRequests: number;
    totalCacheHits: number;
    cacheHitRate: number;
    languageDistribution: Record<string, number>;
    estimatedCostSavings: number;
    environment: 'vercel' | 'local';
    lastUpdated?: string;
    debug?: {
      isVercel: boolean;
      hasBlobAccess: boolean;
      tokenSource: string;
      vercelEnv: string;
    };
  };
  error?: string;
}

export async function GET() {
  try {
    const envInfo = getBlobEnvironmentInfo();
    
    if (!envInfo.canUseBlob) {
      return NextResponse.json({
        success: true,
        data: {
          totalTranslations: 0,
          totalRequests: 0,
          totalCacheHits: 0,
          cacheHitRate: 0,
          languageDistribution: {},
          estimatedCostSavings: 0,
          environment: 'local',
          debug: {
            isVercel: envInfo.isVercel,
            hasBlobAccess: envInfo.hasBlobAccess,
            tokenSource: envInfo.tokenSource,
            vercelEnv: envInfo.vercelEnv
          }
        }
      } as TranslationStatsResponse);
    }

    // Hole Statistiken vom Vercel Blob Cache
    const stats = await vercelBlobCache.getStats();
    
    // Berechne geschätzte Kosteneinsparungen
    // Annahme: $0.02 pro DeepL API-Aufruf (basierend auf 1M Zeichen = $20)
    const estimatedCostSavings = stats.totalCacheHits * 0.02;
    
    console.log(`📊 Translation stats: ${stats.totalTranslations} cached, ${stats.cacheHitRate}% hit rate`);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        estimatedCostSavings: Math.round(estimatedCostSavings * 100) / 100,
        environment: 'vercel'
      }
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

    if (!isVercelEnvironment()) {
      return NextResponse.json({
        success: false,
        error: 'Cache management only available in Vercel environment'
      } as TranslationStatsResponse, { status: 400 });
    }

    switch (action) {
      case 'cleanup':
        const deletedCount = await vercelBlobCache.cleanup();
        return NextResponse.json({
          success: true,
          data: {
            message: `Cleaned up ${deletedCount} old translations`,
            deletedCount
          }
        });

      case 'force_reload':
        await vercelBlobCache.forceReload();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Cache reloaded from Vercel Blob'
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