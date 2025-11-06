# D.INVEST LIVE-ONLY Setup Guide

## ✅ Code-Änderungen Abgeschlossen

Die D.INVEST Integration ist jetzt **NUR für Live-Modus** konfiguriert. Test-Keys werden automatisch abgelehnt.

## 🚀 Live-Deployment Checkliste

### 1. Vercel Environment Variables

Stelle sicher, dass in deinem Vercel Dashboard folgende **LIVE** Environment Variables konfiguriert sind:

```bash
# 🚀 LIVE STRIPE KEYS (ersetze durch deine echten Live-Keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51xxxxxxx
STRIPE_SECRET_KEY=sk_live_51xxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxx
```

### 2. Stripe Dashboard Konfiguration

#### Live Webhook erstellen:
1. Gehe zu: https://dashboard.stripe.com/webhooks
2. Wechsle in den **Live Mode** (Toggle oben rechts)
3. Klicke "Add endpoint"
4. **Endpoint URL**: `https://wallet-komplett.vercel.app/api/stripe-webhook`
5. **Events auswählen**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed` 
   - `payment_intent.canceled`
6. Speichern und **Webhook Secret** kopieren

#### Live API Keys holen:
1. Gehe zu: https://dashboard.stripe.com/apikeys
2. Stelle sicher, dass **Live Mode** aktiv ist
3. Kopiere:
   - **Publishable key** (pk_live_...)
   - **Secret key** (sk_live_...)

### 3. Vercel Deployment

```bash
# 1. Code deployen
git add .
git commit -m "🚀 D.INVEST Live-Modus aktiviert"
git push

# 2. Vercel Environment Variables setzen
# Gehe zu: https://vercel.com/dashboard -> Dein Projekt -> Settings -> Environment Variables
# Füge die Live-Keys hinzu (siehe oben)

# 3. Redeploy triggern
vercel --prod
```

### 4. Live-Produktion starten

Nach dem Deployment:

1. **Gehe zu**: https://wallet-komplett.vercel.app
2. **Wallet verbinden** 
3. **D.INVEST kaufen** mit echter Kreditkarte
4. **Logs prüfen**: Vercel Dashboard -> Functions -> Logs

#### Live-Status prüfen:
- **Payment Intent API**: https://wallet-komplett.vercel.app/api/create-payment-intent
- **Webhook Status**: https://wallet-komplett.vercel.app/api/stripe-webhook

Beide müssen `"mode": "LIVE"` und `"available": true` anzeigen.

## 📊 Monitoring & Logs

### Stripe Dashboard Monitoring:
- **Live Payments**: https://dashboard.stripe.com/payments
- **Webhook Events**: https://dashboard.stripe.com/webhooks/[webhook-id]/events
- **Logs**: https://dashboard.stripe.com/logs

### Vercel Logs:
- **Function Logs**: Vercel Dashboard -> Functions Tab
- **Real-time Logs**: `vercel logs --follow`

### Log Messages:
```bash
✅ Success Indicators:
- "🚀 LIVE Payment Intent created"
- "🎉 LIVE Payment successful"  
- "🚀 LIVE: Sending X D.INVEST tokens to wallet"

❌ Error Indicators:
- "❌ Nur LIVE Stripe Keys erlaubt! Test-Keys werden nicht akzeptiert"
- "❌ Payment failed"
- "💥 Error sending LIVE tokens"
- "available": false
```

## 🔒 Sicherheitshinweise

### Live-Modus Checkliste:
- [ ] ✅ **NUR** Live Keys (pk_live_, sk_live_) in Vercel Environment Variables
- [ ] ✅ Live Webhook Secret ist korrekt konfiguriert  
- [ ] ✅ Webhook URL zeigt auf Live-Domain
- [ ] ✅ **Test-Keys werden automatisch abgelehnt**
- [ ] ✅ Smart Contract für Token-Transfer ist bereit
- [ ] ✅ Backup-Strategie für fehlgeschlagene Zahlungen

### Fehlerbehandlung:
- **Payment succeeded, aber Token nicht gesendet**: Webhook Logs prüfen
- **"Test-Keys werden nicht akzeptiert" Error**: Nur Live-Keys verwenden
- **"available": false**: Live Keys & Webhook Secret fehlen
- **Webhook nicht triggered**: Stripe Live Webhook Logs prüfen

## 🎯 Nächste Schritte

1. **Smart Contract Integration**: Token-Sending implementieren
2. **Error Recovery**: Retry-Mechanismus für fehlgeschlagene Token-Sends
3. **Dashboard**: Admin-Panel für Payment-Monitoring
4. **Notifications**: Email/Discord Benachrichtigungen bei Zahlungen

---

**Status**: 🚀 LIVE-ONLY Mode Activated  
**Letztes Update**: November 2025  
**Version**: v3.0 (Live-Only Mode)  

⚠️ **WICHTIG**: Test-Modus ist vollständig deaktiviert. Nur Live-Keys werden akzeptiert!