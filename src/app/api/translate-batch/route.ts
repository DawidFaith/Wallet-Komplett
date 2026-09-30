// Batch Translation API mit DB-Cache
import { NextRequest, NextResponse } from 'next/server';
import { translationCache } from '../../lib/translationCache';

export interface BatchTranslationRequest {
  texts: string[];
  targetLang: string;
}

export interface BatchTranslationResponse {
  translations: string[];
  cacheHits: number;
  totalRequests: number;
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json() as BatchTranslationRequest;
    const { texts, targetLang } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'Invalid texts array provided' },
        { status: 400 }
      );
    }

    if (!targetLang) {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      );
    }

    // Wenn Zielsprache Deutsch ist, Original zurückgeben
    if (targetLang.toLowerCase() === 'de') {
      return NextResponse.json({
        translations: texts,
        cacheHits: texts.length,
        totalRequests: texts.length,
        processingTime: Date.now() - startTime,
      } as BatchTranslationResponse);
    }

    const normalizedLang = targetLang.toUpperCase();
    const translations: string[] = [];
    let cacheHits = 0;
    const textsToTranslate: string[] = [];
    const indexMap: number[] = [];

    // 1. Prüfe Cache für alle Texte
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const cachedTranslation = await translationCache.getTranslation(text, normalizedLang);
      
      if (cachedTranslation) {
        translations[i] = cachedTranslation;
        cacheHits++;
      } else {
        textsToTranslate.push(text);
        indexMap.push(i);
      }
    }

    // 2. Übersetze nur nicht-gecachte Texte
    if (textsToTranslate.length > 0) {
      console.log(`🔄 Translating ${textsToTranslate.length} new texts to ${normalizedLang}`);
      
      try {
        const deepLResponse = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            text: textsToTranslate.join('\n---SEPARATOR---\n'),
            target_lang: normalizedLang,
            source_lang: 'DE',
          }),
        });

        if (!deepLResponse.ok) {
          throw new Error(`DeepL API error: ${deepLResponse.status} ${deepLResponse.statusText}`);
        }

        const deepLData = await deepLResponse.json();
        const translatedTexts = deepLData.translations[0].text.split('\n---SEPARATOR---\n');

        // 3. Speichere neue Übersetzungen im Cache
        for (let i = 0; i < textsToTranslate.length; i++) {
          const originalText = textsToTranslate[i];
          const translatedText = translatedTexts[i] || originalText;
          const originalIndex = indexMap[i];
          
          translations[originalIndex] = translatedText;
          
          // Speichere im Cache
          await translationCache.setTranslation(originalText, normalizedLang, translatedText);
        }

      } catch (error) {
        console.error('DeepL API error:', error);
        
        // Fallback: Verwende Originaltexte für nicht übersetzte
        for (let i = 0; i < textsToTranslate.length; i++) {
          const originalIndex = indexMap[i];
          if (!translations[originalIndex]) {
            translations[originalIndex] = textsToTranslate[i];
          }
        }
      }
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Batch translation completed: ${cacheHits}/${texts.length} cache hits (${Math.round(cacheHits/texts.length*100)}%) in ${processingTime}ms`);

    return NextResponse.json({
      translations,
      cacheHits,
      totalRequests: texts.length,
      processingTime,
    } as BatchTranslationResponse);

  } catch (error) {
    console.error('Batch translation error:', error);
    
    return NextResponse.json(
      { error: 'Translation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}