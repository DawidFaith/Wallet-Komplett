import React from 'react';
import { useTranslation } from '../hooks/useDeepLTranslation';
import type { SupportedLanguage } from '../utils/deepLTranslation';

interface TranslatedTextProps {
  text: string;
  language: SupportedLanguage;
  fallback?: string;
  className?: string;
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  showLoadingIndicator?: boolean;
}

export function TranslatedText({
  text,
  language,
  fallback,
  className = '',
  as: Component = 'span',
  showLoadingIndicator = false
}: TranslatedTextProps) {
  const { translatedText, isLoading, error } = useTranslation(text, language, { fallback });

  // Loading State (optional)
  if (showLoadingIndicator && isLoading) {
    return (
      <Component className={`${className} animate-pulse`}>
        <span className="bg-gray-300 rounded text-transparent select-none">
          {text}
        </span>
      </Component>
    );
  }

  // Error State (fallback auf Original)
  if (error) {
    console.warn(`Translation failed for "${text}":`, error);
  }

  return (
    <Component className={className}>
      {translatedText}
    </Component>
  );
}

// Spezielle Komponente für Titel
export function TranslatedTitle({
  text,
  language,
  level = 1,
  className = '',
  fallback
}: {
  text: string;
  language: SupportedLanguage;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  fallback?: string;
}) {
  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  
  return (
    <TranslatedText
      text={text}
      language={language}
      fallback={fallback}
      className={className}
      as={HeadingTag}
    />
  );
}

// Komponente für Buttons mit Übersetzung
export function TranslatedButton({
  text,
  language,
  onClick,
  className = '',
  fallback,
  ...buttonProps
}: {
  text: string;
  language: SupportedLanguage;
  onClick?: () => void;
  className?: string;
  fallback?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { translatedText, isLoading } = useTranslation(text, language, { fallback });

  return (
    <button
      onClick={onClick}
      className={`${className} ${isLoading ? 'opacity-75' : ''}`}
      {...buttonProps}
    >
      {translatedText}
    </button>
  );
}