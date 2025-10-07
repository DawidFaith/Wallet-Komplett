import { useState, useEffect } from 'react';
import { translationService, type SupportedLanguage } from '../utils/deepLTranslation';

interface UseTranslationOptions {
  fallback?: string;
  skipEmpty?: boolean;
}

export function useTranslation(
  text: string, 
  language: SupportedLanguage = 'de',
  options: UseTranslationOptions = {}
) {
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nicht übersetzen wenn:
    // - Text leer und skipEmpty aktiv
    // - Sprache Deutsch
    // - Text bereits übersetzt
    if ((options.skipEmpty && !text.trim()) || 
        language === 'de' || 
        translatedText !== text) {
      return;
    }

    let isMounted = true;

    const translateAsync = async () => {
      if (!text.trim()) {
        setTranslatedText(options.fallback || text);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await translationService.translateText(text, language);
        
        if (isMounted) {
          setTranslatedText(result);
        }
      } catch (err) {
        console.error('Translation error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Translation failed');
          setTranslatedText(options.fallback || text);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    translateAsync();

    return () => {
      isMounted = false;
    };
  }, [text, language, options.fallback, options.skipEmpty, translatedText]);

  return {
    translatedText,
    isLoading,
    error,
    isTranslated: language !== 'de' && translatedText !== text
  };
}

// Hook für mehrere Texte
export function useMultipleTranslations(
  texts: string[],
  language: SupportedLanguage = 'de'
) {
  const [translatedTexts, setTranslatedTexts] = useState<string[]>(texts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (language === 'de') {
      setTranslatedTexts(texts);
      return;
    }

    let isMounted = true;

    const translateMultipleAsync = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await translationService.translateMultiple(texts, language);
        
        if (isMounted) {
          setTranslatedTexts(results);
        }
      } catch (err) {
        console.error('Multiple translation error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Translation failed');
          setTranslatedTexts(texts); // Fallback
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    translateMultipleAsync();

    return () => {
      isMounted = false;
    };
  }, [texts, language]);

  return {
    translatedTexts,
    isLoading,
    error
  };
}