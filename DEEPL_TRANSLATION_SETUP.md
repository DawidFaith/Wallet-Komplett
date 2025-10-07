# 🌍 DeepL API Translation Setup

## Warum DeepL?
- ✅ **Beste Übersetzungsqualität** (besser als Google Translate)
- ✅ **500.000 Zeichen/Monat KOSTENLOS**
- ✅ **Datenschutz-freundlich** (EU-Server)
- ✅ **Professionelle API** mit hoher Zuverlässigkeit
- ✅ **Unterstützt 31+ Sprachen** inkl. Deutsch, Englisch, Polnisch

## 🚀 Setup Schritte

### 1. DeepL API Key erhalten
1. Gehe zu: https://www.deepl.com/pro-api
2. Registriere dich für den **kostenlosen** DeepL API Plan
3. Kopiere deinen API Key

### 2. Environment Variable hinzufügen
Füge in `.env.local` hinzu:
```env
DEEPL_API_KEY=dein_deepl_api_key_hier
NEXT_PUBLIC_ENABLE_TRANSLATION=true
```

### 3. Unterstützte Sprachen
- **DE** 🇩🇪 Deutsch (Standard)
- **EN** 🇺🇸 English  
- **PL** 🇵🇱 Polski

## 💡 Funktionen
- ✅ Automatische Übersetzung aller Texte
- ✅ Caching für Performance
- ✅ Loading States
- ✅ Error Handling
- ✅ Real-time Sprachumstellung
- ✅ SEO-freundlich

## 🎯 Usage Beispiele
```tsx
// Einfache Übersetzung
<TranslatedText text="Willkommen" language={language} />

// Mit Fallback
<TranslatedText 
  text="Tokenomics" 
  language={language}
  fallback="Tokenomics" 
/>
```

## 📊 API Limits
- **Free Plan**: 500.000 Zeichen/Monat
- **Pro Plan**: Ab €5.99/Monat für mehr Volumen