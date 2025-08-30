# Stripe Integration Setup für Vercel Deployment

## 🚀 Deployment Setup

### 1. Stripe Account Setup
1. Erstelle einen Account bei [stripe.com](https://stripe.com)
2. Gehe zu **Developers** → **API keys**
3. Kopiere deine Keys:
   - **Publishable key** (beginnt mit `pk_test_` oder `pk_live_`)
   - **Secret key** (beginnt mit `sk_test_` oder `sk_live_`)

### 2. Stripe Webhook Setup
1. Gehe zu **Developers** → **Webhooks**
2. Klicke **"Add endpoint"**
3. **Endpoint URL**: `https://your-vercel-domain.vercel.app/api/stripe-webhook`
4. **Events auswählen**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Kopiere den **Signing secret** (beginnt mit `whsec_`)

### 3. Vercel Environment Variables
Gehe zu deinem Vercel-Projekt → **Settings** → **Environment Variables** und füge hinzu:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key
STRIPE_SECRET_KEY=sk_test_your_actual_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret

# Thirdweb (bereits vorhanden)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

### 4. Nach dem Deployment
1. **Webhook URL aktualisieren** in Stripe Dashboard mit der echten Vercel-Domain
2. **Live-Modus aktivieren** wenn bereit für Produktion
3. **Test-Käufe durchführen** mit Stripe Test Cards

## 🧪 Testing mit Stripe Test Cards

Für Tests kannst du diese Testkarten verwenden:
- **Erfolgreiche Zahlung**: `4242 4242 4242 4242`
- **Fehlgeschlagene Zahlung**: `4000 0000 0000 0002`
- **Authentifizierung erforderlich**: `4000 0025 0000 3155`

**Expiry**: Beliebiges zukünftiges Datum (z.B. 12/25)
**CVC**: Beliebige 3 Ziffern (z.B. 123)

## 🔄 Workflow nach Stripe-Zahlung

1. **Benutzer kauft D.INVEST Token** → Stripe Checkout
2. **Zahlung erfolgreich** → Webhook wird ausgelöst
3. **Webhook verifiziert Zahlung** → Token-Transfer an Wallet
4. **Benutzer erhält Token** in seiner Wallet

## 🛠️ Entwicklung

Für lokale Entwicklung:
```bash
cp .env.example .env.local
# Fülle die echten Werte ein
npm run dev
```

## 🔐 Sicherheit

- **Secret Keys** niemals in Git committen
- **Webhook Signature** immer verifizieren
- **HTTPS** für Webhook-Endpoints verwenden
- **Metadaten** für Wallet-Adressen nutzen
