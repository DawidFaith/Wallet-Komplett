# 📦 Shipping Data API - Dokumentation

## Übersicht
Diese Dokumentation beschreibt die `sendShippingData` Funktion, die alle Versand- und Bestelldaten an das Order Management System sendet.

## 🔧 Funktion: `sendShippingData`

### Parameter
```typescript
sendShippingData(
  transactionHash: string,    // Blockchain Transaction Hash
  orderId: string,           // Eindeutige Bestellnummer  
  totalPriceDfaith: number   // Gesamtpreis in D.FAITH
)
```

### API-Endpoint
- **URL:** `https://merch-balance-verifification-production.up.railway.app/api/v1/verify-purchase`
- **Methode:** `POST`
- **Content-Type:** `application/json`
- **Accept:** `application/json`

## 📋 Datenstruktur

### Vollständige Payload
```json
{
  "transactionHash": "0x123abc...",
  "expectedAmount": 15.50,
  "customerData": {
    "orderId": "ORDER-1234567890-abc123",
    "userId": "0x789def...",
    "email": "kunde@email.de",
    "firstName": "Max",
    "lastName": "Mustermann",
    "shippingAddress": {
      "street": "Musterstraße 123",
      "city": "Berlin", 
      "postalCode": "12345",
      "country": "Deutschland",
      "phone": "+49123456789"
    },
    "hasPhysicalProducts": true,
    "preferredLanguage": "de"
  },
  "productData": {
    "totalAmount": 15.50,
    "currency": "D.FAITH",
    "itemCount": 2,
    "items": [
      {
        "id": "prod123",
        "name": "DAWID FAITH T-Shirt XL",
        "description": "Offizielles DAWID FAITH Merchandise",
        "category": "T.Shirt",
        "quantity": 1,
        "priceEur": 25.00,
        "priceDfaith": 12.50,
        "isDigital": false,
        "size": "XL",
        "mediaUrls": []
      },
      {
        "id": "prod456", 
        "name": "New Song - Digital Download",
        "description": "Neuester Track von DAWID FAITH",
        "category": "music",
        "quantity": 1,
        "priceEur": 3.00,
        "priceDfaith": 3.00,
        "isDigital": true,
        "size": null,
        "mediaUrls": [
          {
            "type": "AUDIO",
            "url": "https://example.com/song.mp3",
            "filename": "new_song.mp3"
          }
        ]
      }
    ]
  },
  "metadata": {
    "orderDate": "2025-08-13T15:30:00.000Z",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "timestamp": 1692797400000,
    "source": "dawid-faith-wallet",
    "version": "1.0"
  }
}
```

## 📊 Datenfelder im Detail

### 1. Transaktionsdaten
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `transactionHash` | string | Base Chain Transaction Hash |
| `expectedAmount` | number | Bezahlter Betrag in D.FAITH |

### 2. Kundendaten (`customerData`)
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `orderId` | string | Eindeutige Bestellnummer (FORMAT: ORDER-timestamp-random) |
| `userId` | string | Wallet-Adresse des Kunden |
| `email` | string | E-Mail-Adresse (PFLICHT) |
| `firstName` | string | Vorname (bei physischen Produkten PFLICHT) |
| `lastName` | string | Nachname (bei physischen Produkten PFLICHT) |
| `shippingAddress` | object\|null | Versandadresse (nur bei physischen Produkten) |
| `hasPhysicalProducts` | boolean | Flag für physische Produkte |
| `preferredLanguage` | string | Sprache (immer "de") |

### 3. Versandadresse (`shippingAddress`)
**Nur bei physischen Produkten (`hasPhysicalProducts: true`)**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `street` | string | Straße & Hausnummer |
| `city` | string | Stadt |
| `postalCode` | string | Postleitzahl |
| `country` | string | Land (Standard: "Deutschland") |
| `phone` | string | Telefonnummer (optional) |

### 4. Produktdaten (`productData`)
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `totalAmount` | number | Gesamtbetrag in D.FAITH |
| `currency` | string | Währung (immer "D.FAITH") |
| `itemCount` | number | Gesamtanzahl aller Artikel |
| `items` | array | Liste aller Produkte |

### 5. Produktdetails (`items[]`)
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | string | Produkt-ID aus dem System |
| `name` | string | Produktname |
| `description` | string | Produktbeschreibung |
| `category` | string | Produktkategorie |
| `quantity` | number | Bestellte Menge |
| `priceEur` | number | Einzelpreis in EUR |
| `priceDfaith` | number | Einzelpreis in D.FAITH |
| `isDigital` | boolean | Digital/Physisch Flag |
| `size` | string\|null | Größe (bei T-Shirts) |
| `mediaUrls` | array | Download-Links (bei digitalen Produkten) |

### 6. Mediendateien (`mediaUrls[]`)
**Nur bei digitalen Produkten**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `type` | string | AUDIO, VIDEO, IMAGE, DOCUMENT |
| `url` | string | Download-URL |
| `filename` | string | Originaler Dateiname |

### 7. Metadaten (`metadata`)
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `orderDate` | string | Bestelldatum (ISO 8601) |
| `userAgent` | string | Browser-Information |
| `timestamp` | number | Unix-Timestamp |
| `source` | string | Quelle (immer "dawid-faith-wallet") |
| `version` | string | API-Version |

## 🔄 API-Response

### Erfolgreiche Antwort
```json
{
  "success": true,
  "verification": {
    "transactionVerified": true,
    "amountMatches": true,
    "blockConfirmed": true
  },
  "webhook": {
    "sent": true,
    "orderCreated": true,
    "emailSent": true
  },
  "orderId": "ORDER-1234567890-abc123"
}
```

### Fehlerhafte Antwort
```json
{
  "success": false,
  "error": "Transaction verification failed",
  "details": [
    "Transaction not found on blockchain",
    "Amount mismatch: expected 15.50, got 10.00"
  ]
}
```

## ⚠️ Fehlerbehandlung

### HTTP-Fehler
- `400` - Ungültige Anfrage / Validierungsfehler
- `404` - Transaktion nicht gefunden
- `500` - Server-Fehler

### API-Fehler
- `Transaction verification failed` - Transaktion nicht auf Blockchain gefunden
- `Validation failed` - Ungültige Daten
- `Amount mismatch` - Bezahlter Betrag stimmt nicht überein
- `Not confirmed` - Transaktion noch nicht bestätigt

## 🛠️ Implementierung

### Funktionsaufruf
```typescript
try {
  const result = await sendShippingData(
    transactionHash,
    orderId, 
    totalPriceDfaith
  );
  console.log('✅ Bestellung erfolgreich:', result);
} catch (error) {
  console.error('❌ Bestellfehler:', error.message);
}
```

### Logging
```typescript
console.log('📦 Sending shipping data:', shippingData);    // Vor dem Senden
console.log('✅ Shipping data sent successfully:', result); // Bei Erfolg
console.error('❌ Error sending shipping data:', error);    // Bei Fehler
```

## 🔐 Sicherheit

### Validierung
- E-Mail-Format wird geprüft
- Pflichtfelder werden validiert
- Blockchain-Transaktion wird verifiziert
- Betrag wird gegen erwarteten Wert geprüft

### Datenübertragung
- HTTPS-Verschlüsselung
- JSON-Format
- Fehlerhafte Requests werden abgelehnt

## 📈 Workflow

1. **Kauf abschließen** - Blockchain-Transaktion senden
2. **Daten sammeln** - Formular + Warenkorb + Metadaten
3. **API aufrufen** - `sendShippingData()` ausführen
4. **Verifikation** - API prüft Transaktion auf Base Chain
5. **Webhook** - Order Management System erhält Daten
6. **Bestätigung** - Kunde erhält E-Mail + Success Modal

## 🎯 Use Cases

### Digitale Produkte
- E-Mail mit Download-Links wird automatisch versendet
- Keine Versandadresse erforderlich
- Sofortiger Zugang nach Zahlungsbestätigung

### Physische Produkte  
- Vollständige Versandadresse wird übertragen
- Order Management System erstellt Versandetikett
- Tracking-Information per E-Mail

### Gemischte Bestellungen
- Digitale Produkte: Sofortiger Download
- Physische Produkte: Versand + Tracking
- Eine einheitliche Bestellung mit unterschiedlicher Abwicklung

## 🔧 Technische Details

### Dependencies
- `fetch()` API für HTTP-Requests
- `JSON.stringify()` für Datenkonvertierung
- React State für Formulardaten
- thirdweb für Blockchain-Integration

### Error Handling
- Try-Catch für API-Calls
- HTTP Status Code Prüfung
- API Success Flag Validierung
- Detaillierte Fehlermeldungen

### Performance
- Asynchrone Ausführung
- Minimale Payload-Größe
- Effiziente Datenstrukturen
- Logging für Debugging

---

**📞 Support:** Bei Problemen mit der API, überprüfen Sie die Console-Logs für detaillierte Fehlerinformationen.

**🔄 Updates:** Diese Dokumentation wird bei API-Änderungen aktualisiert.
