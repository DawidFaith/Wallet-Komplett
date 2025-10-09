import { NextRequest, NextResponse } from 'next/server';
import { vercelBlobCache } from '../../lib/vercelBlobCache';

export interface TranslateResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
  cacheHit?: boolean;
  source?: 'vercel_blob' | 'deepl_api' | 'direct';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { text, targetLang } = await request.json();

    // Validierung
    if (!text || !targetLang) {
      return NextResponse.json(
        { error: 'Text and targetLang are required' },
        { status: 400 }
      );
    }

    const normalizedLang = targetLang.toUpperCase();

    // Wenn Zielsprache Deutsch ist, Original zurückgeben
    if (normalizedLang === 'DE') {
      return NextResponse.json({
        translations: [{ 
          detected_source_language: 'DE', 
          text: text 
        }],
        cacheHit: true,
        source: 'direct'
      } as TranslateResponse);
    }

    // 1. Prüfe Vercel Blob Cache (immer versuchen - Token ist verfügbar)
    try {
      console.log(`🔍 Checking blob cache for: "${text}" -> ${normalizedLang} [Length: ${text.length}, CharCodes: ${text.split('').map((c: string) => c.charCodeAt(0)).join(',')}]`);
      const cachedTranslation = await vercelBlobCache.getTranslation(text, normalizedLang);
      
      if (cachedTranslation) {
        console.log(`🎯 Blob cache HIT for "${text}" -> "${cachedTranslation}" (${Date.now() - startTime}ms)`);
        
        return NextResponse.json({
          translations: [{ 
            detected_source_language: 'DE', 
            text: cachedTranslation 
          }],
          cacheHit: true,
          source: 'vercel_blob'
        } as TranslateResponse);
      } else {
        console.log(`🔍 Blob cache MISS for: "${text}"`);
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache access failed, continuing with DeepL API:', cacheError);
      // Weitermachen mit DeepL API
    }

    // 2. Cache Miss - DeepL API Call
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      console.error('DEEPL_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Translation service not configured' },
        { status: 500 }
      );
    }

    console.log(`🔄 DeepL API call for "${text}" -> ${normalizedLang}`);

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        target_lang: normalizedLang,
        source_lang: 'DE'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepL API Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Translation failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const translatedText = data.translations[0]?.text || text;

    // 3. Speichere im Vercel Blob Cache (immer versuchen)
    try {
      console.log(`💾 Saving to blob cache: "${text}" -> "${translatedText}"`);
      await vercelBlobCache.setTranslation(text, normalizedLang, translatedText);
      console.log(`✅ Successfully saved to blob cache`);
    } catch (cacheError) {
      console.warn('⚠️ Failed to save to cache, but translation was successful:', cacheError);
    }

    console.log(`✅ DeepL translation completed: "${text}" -> "${translatedText}" (${Date.now() - startTime}ms)`);

    return NextResponse.json({
      ...data,
      cacheHit: false,
      source: 'deepl_api'
    } as TranslateResponse);
    
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
// Force redeploy for blob cache fix - Thu Oct  9 07:52:05 UTC 2025
