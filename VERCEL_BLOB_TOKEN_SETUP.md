# Environment Variables für Vercel Blob Storage

## Problem: BLOB_READ_WRITE_TOKEN fehlt

Der Fehler `No token found. Either configure the BLOB_READ_WRITE_TOKEN environment variable` tritt auf, weil das Vercel Blob Token nicht korrekt konfiguriert ist.

## ✅ Lösung für Vercel Deployment

### 1. **Automatische Token-Generierung in Vercel**

Vercel generiert den `BLOB_READ_WRITE_TOKEN` automatisch, ABER nur wenn:

1. ✅ Dein Projekt ist bei Vercel deployed
2. ✅ Vercel Blob Storage ist in deinem Account aktiviert
3. ✅ Das Token wird automatisch bei den Environment Variables hinzugefügt

### 2. **Vercel Dashboard Setup**

1. Gehe zu: https://vercel.com/dashboard
2. Wähle dein Projekt: `Wallet-Komplett`
3. Gehe zu: **Settings** → **Environment Variables**
4. Prüfe ob `BLOB_READ_WRITE_TOKEN` existiert

**Falls nicht vorhanden:**
- Gehe zu **Storage** → **Create Database** → **Blob**
- Wähle dein Projekt aus
- Vercel erstellt automatisch die Environment Variable

### 3. **Manuelles Hinzufügen (falls nötig)**

Falls das Token nicht automatisch generiert wurde:

```bash
# In Vercel Dashboard -> Settings -> Environment Variables
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...your_token_here
```

⚠️ **WICHTIG:** Niemals das echte Token in Git committen!

## 🔧 Lokale Entwicklung

Für lokale Entwicklung **ist kein Blob Token nötig**. Das System verwendet automatisch einen lokalen Cache.

### .env.local (Optional für lokale Tests)
```bash
# DeepL API (erforderlich)
DEEPL_API_KEY=your_deepl_api_key_here

# Vercel Blob (nur für lokale Blob-Tests - normalerweise nicht nötig)
# BLOB_READ_WRITE_TOKEN=your_local_test_token
```

## 🚀 Deployment-Checklist

1. ✅ Code ist zu GitHub gepusht
2. ✅ Vercel ist mit GitHub Repository verbunden
3. ✅ `DEEPL_API_KEY` ist in Vercel Environment Variables gesetzt
4. ✅ Vercel Blob Storage ist aktiviert (erstellt automatisch `BLOB_READ_WRITE_TOKEN`)
5. ✅ Nach erstem Deployment: System verwendet automatisch globalen Cache

## 📊 Verifikation

Nach dem Deployment kannst du prüfen:

1. **Environment Variables** in Vercel Dashboard
2. **Logs** im Vercel Deployment anschauen
3. **Translation Stats** unter `/translation-cache` aufrufen

Das System ist robust gebaut und funktioniert auch ohne Blob Token (mit lokalem Fallback).

## 🔍 Debug-Informationen

Die `/api/translation-stats` API zeigt Debug-Informationen:

```json
{
  "debug": {
    "isVercel": true/false,
    "hasBlobAccess": true/false,
    "tokenSource": "BLOB_READ_WRITE_TOKEN" | "none",
    "vercelEnv": "production" | "preview" | "development"
  }
}
```