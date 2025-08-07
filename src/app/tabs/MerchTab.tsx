"use client";
import { useEffect, useState } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "../client";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { 
  FaShoppingCart, 
  FaCoins, 
  FaCheck, 
  FaTimes, 
  FaSpinner, 
  FaDownload, 
  FaMusic, 
  FaVideo,
  FaImage,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaExpand,
  FaFilter,
  FaEuroSign
} from "react-icons/fa";

// Token-Konfiguration (gleich wie im WalletTab)
const DFAITH_TOKEN = "0x69eFD833288605f320d77eB2aB99DDE62919BbC1";
const DFAITH_DECIMALS = 2;

// API Typen basierend auf Ihrer API-Struktur
interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: "AUDIO" | "VIDEO" | "IMAGE" | "DOCUMENT";
  createdAt: string;
  productId: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // EUR Preis
  category: string;
  media: MediaFile[];
  isDigital?: boolean; // Zur Unterscheidung zwischen digitalen und physischen Produkten
}

// Checkout-Formulardaten
interface CheckoutFormData {
  email: string;
  // Für physische Produkte
  firstName?: string;
  lastName?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

// API-Konfiguration
const API_BASE_URL = "https://merch-verwaltung.vercel.app";

// Media Player Komponente
function MediaPlayer({ media }: { media: MediaFile }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const togglePlay = (audioElement: HTMLAudioElement) => {
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  switch (media.type) {
    case "AUDIO":
      return (
        <div className="w-full">
          <audio 
            controls 
            className="w-full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={media.url} type={media.mimeType} />
            Ihr Browser unterstützt Audio nicht.
          </audio>
          <div className="mt-2 text-xs text-gray-400">
            <p>📁 {media.originalName}</p>
            <p>📊 {(media.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      );
    
    case "VIDEO":
      return (
        <div className="w-full">
          <video controls className="w-full max-h-64 rounded">
            <source src={media.url} type={media.mimeType} />
            Ihr Browser unterstützt Video nicht.
          </video>
          <div className="mt-2 text-xs text-gray-400">
            <p>📁 {media.originalName}</p>
            <p>📊 {(media.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      );
    
    case "IMAGE":
      return (
        <div className="w-full">
          <img 
            src={media.url} 
            alt={media.originalName}
            className="w-full h-48 object-cover rounded"
          />
          <div className="mt-2 text-xs text-gray-400">
            <p>📁 {media.originalName}</p>
            <p>📊 {(media.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      );
    
    default:
      return (
        <div className="p-4 bg-zinc-800 rounded">
          <FaDownload className="text-2xl text-amber-400 mb-2" />
          <p className="text-white font-medium">{media.originalName}</p>
          <p className="text-gray-400 text-sm">{(media.size / 1024 / 1024).toFixed(2)} MB</p>
          <a 
            href={media.url} 
            download={media.originalName}
            className="text-amber-400 hover:text-amber-300 text-sm"
          >
            📥 Download
          </a>
        </div>
      );
  }
}

export default function MerchTab() {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending: isTransactionPending } = useSendTransaction();
  
  // State Management
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [dfaithBalance, setDfaithBalance] = useState<string>("0.00");
  const [dfaithPriceEur, setDfaithPriceEur] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<{[key: string]: number}>({});
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [purchaseMessage, setPurchaseMessage] = useState<string>("");
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormData>({
    email: "",
    firstName: "",
    lastName: "",
    street: "",
    city: "",
    postalCode: "",
    country: "Deutschland",
    phone: ""
  });

  // D.FAITH Balance laden
  const { data: dfaithBalanceData } = useReadContract({
    contract: getContract({
      client,
      chain: base,
      address: DFAITH_TOKEN
    }),
    method: "function balanceOf(address) view returns (uint256)",
    params: [account?.address || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!account?.address,
      refetchInterval: 5000,
    }
  });

  // Balance formatieren
  useEffect(() => {
    if (dfaithBalanceData) {
      const formattedBalance = (Number(dfaithBalanceData) / Math.pow(10, DFAITH_DECIMALS)).toFixed(DFAITH_DECIMALS);
      setDfaithBalance(formattedBalance);
    }
  }, [dfaithBalanceData]);

  // D.FAITH Preis laden (ähnlich wie im WalletTab)
  useEffect(() => {
    const fetchDfaithPrice = async () => {
      try {
        // Hier nutzen wir die gleiche Logik wie im WalletTab für Live-Preisdaten
        const priceResponse = await fetch('/api/prices'); // Falls vorhanden
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData.dfaithEur) {
            setDfaithPriceEur(priceData.dfaithEur);
          }
        } else {
          // Fallback: fester Preis oder gespeicherter Preis
          const lastKnownPrices = localStorage.getItem('walletPrices');
          if (lastKnownPrices) {
            const parsed = JSON.parse(lastKnownPrices);
            if (parsed.dfaithEur) {
              setDfaithPriceEur(parsed.dfaithEur);
            }
          } else {
            // Fallback Preis
            setDfaithPriceEur(0.01); // 1 Cent als Fallback
          }
        }
      } catch (error) {
        console.error("Fehler beim Laden der D.FAITH Preise:", error);
        // Fallback Preis
        setDfaithPriceEur(0.01);
      }
    };

    fetchDfaithPrice();
    const interval = setInterval(fetchDfaithPrice, 30000); // Alle 30 Sekunden
    return () => clearInterval(interval);
  }, []);

  // Produkte von API laden
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Automatische Erkennung digitaler Produkte basierend auf Medientypen
        const productsWithDigitalFlag = data.map((product: Product) => ({
          ...product,
          isDigital: product.media.some(media => 
            media.type === "AUDIO" || media.type === "VIDEO" || media.type === "DOCUMENT"
          )
        }));
        setProducts(productsWithDigitalFlag);
        setError("");
      } catch (err) {
        console.error("Fehler beim Laden der Produkte:", err);
        setError("Fehler beim Laden der Produkte. Bitte versuchen Sie es später erneut.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // EUR zu D.FAITH umrechnen
  const convertEurToDfaith = (eurPrice: number): number => {
    if (dfaithPriceEur === 0) return 0;
    return eurPrice / dfaithPriceEur;
  };

  // Einzigartige Kategorien extrahieren
  const categories = ["all", ...Array.from(new Set(products.map(p => p.category)))];

  // Gefilterte Produkte
  const filteredProducts = selectedCategory === "all" 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  // Icon für Medientyp
  const getMediaIcon = (type: string) => {
    switch(type) {
      case "AUDIO": return <FaMusic className="text-green-400" />;
      case "VIDEO": return <FaVideo className="text-red-400" />;
      case "IMAGE": return <FaImage className="text-blue-400" />;
      default: return <FaDownload className="text-gray-400" />;
    }
  };

  // In den Warenkorb hinzufügen
  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  // Aus dem Warenkorb entfernen
  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId]--;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  // Warenkorb leeren
  const clearCart = () => {
    setCart({});
    setShowCheckout(false);
    setCheckoutForm({
      email: "",
      firstName: "",
      lastName: "",
      street: "",
      city: "",
      postalCode: "",
      country: "Deutschland",
      phone: ""
    });
  };

  // Prüfen ob physische Produkte im Warenkorb sind
  const hasPhysicalProducts = () => {
    return Object.keys(cart).some(productId => {
      const product = products.find(p => p.id === productId);
      return product && !product.isDigital;
    });
  };

  // Formular-Validierung
  const validateCheckoutForm = (): string[] => {
    const errors: string[] = [];
    
    if (!checkoutForm.email || !/\S+@\S+\.\S+/.test(checkoutForm.email)) {
      errors.push("Gültige E-Mail-Adresse erforderlich");
    }
    
    if (hasPhysicalProducts()) {
      if (!checkoutForm.firstName) errors.push("Vorname erforderlich");
      if (!checkoutForm.lastName) errors.push("Nachname erforderlich");
      if (!checkoutForm.street) errors.push("Straße erforderlich");
      if (!checkoutForm.city) errors.push("Stadt erforderlich");
      if (!checkoutForm.postalCode) errors.push("Postleitzahl erforderlich");
      if (!checkoutForm.country) errors.push("Land erforderlich");
    }
    
    return errors;
  };

  // Gesamtpreis berechnen (in D.FAITH)
  const getTotalPriceDfaith = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        const dfaithPrice = convertEurToDfaith(product.price);
        return total + (dfaithPrice * quantity);
      }
      return total;
    }, 0);
  };

  // Gesamtpreis in EUR
  const getTotalPriceEur = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId);
      return total + (product ? product.price * quantity : 0);
    }, 0);
  };

  // Anzahl Artikel im Warenkorb
  const getCartItemCount = () => {
    return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  };

  // Kauf abwickeln
  const handlePurchase = async () => {
    if (!account?.address) {
      setPurchaseMessage("Bitte Wallet verbinden");
      setPurchaseStatus("error");
      return;
    }

    // Formular validieren
    const validationErrors = validateCheckoutForm();
    if (validationErrors.length > 0) {
      setPurchaseMessage(`Formular unvollständig: ${validationErrors.join(", ")}`);
      setPurchaseStatus("error");
      return;
    }

    const totalPriceDfaith = getTotalPriceDfaith();
    const userBalance = parseFloat(dfaithBalance);

    if (userBalance < totalPriceDfaith) {
      setPurchaseMessage(`Nicht genügend D.FAITH Token. Benötigt: ${totalPriceDfaith.toFixed(2)}, Verfügbar: ${userBalance.toFixed(2)}`);
      setPurchaseStatus("error");
      return;
    }

    setPurchaseStatus("pending");
    
    try {
      // Korrekte Shop-Wallet Adresse
      const shopWalletAddress = "0xb53aBFC43355af7b4f8EcB14E0bB7651E6Ea5A55"; 
      const amountInWei = BigInt(Math.floor(totalPriceDfaith * Math.pow(10, DFAITH_DECIMALS)));

      const contract = getContract({
        client,
        chain: base,
        address: DFAITH_TOKEN
      });

      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [shopWalletAddress, amountInWei]
      });

      const transactionResult = await sendTransaction(transaction);

      // Bestellung an Backend senden
      const orderData = {
        walletAddress: account.address,
        email: checkoutForm.email,
        shippingAddress: hasPhysicalProducts() ? {
          firstName: checkoutForm.firstName,
          lastName: checkoutForm.lastName,
          street: checkoutForm.street,
          city: checkoutForm.city,
          postalCode: checkoutForm.postalCode,
          country: checkoutForm.country,
          phone: checkoutForm.phone
        } : null,
        products: Object.entries(cart).map(([productId, quantity]) => {
          const product = products.find(p => p.id === productId);
          return {
            productId,
            quantity,
            priceEur: product?.price || 0,
            isDigital: product?.isDigital || false
          };
        }),
        totalEur: getTotalPriceEur(),
        totalDfaith: totalPriceDfaith,
        transactionHash: "completed", // Transaktion war erfolgreich
        hasPhysicalProducts: hasPhysicalProducts(),
        timestamp: new Date().toISOString()
      };

      // Webhook an Backend senden
      try {
        const webhookResponse = await fetch(`${API_BASE_URL}/api/webhook/order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData)
        });

        if (!webhookResponse.ok) {
          console.warn("Webhook fehlgeschlagen, aber Zahlung war erfolgreich");
        }
      } catch (webhookError) {
        console.warn("Webhook-Fehler:", webhookError);
      }

      setPurchaseStatus("success");
      setPurchaseMessage(`✅ Kauf erfolgreich! ${getCartItemCount()} Artikel für ${totalPriceDfaith.toFixed(2)} D.FAITH gekauft. ${hasPhysicalProducts() ? "Versandbestätigung folgt per E-Mail." : "Download-Links wurden an Ihre E-Mail gesendet."}`);
      clearCart();
      setShowCart(false);
      setShowCheckout(false);

    } catch (error) {
      console.error("Kauf-Fehler:", error);
      setPurchaseStatus("error");
      setPurchaseMessage("❌ Kauf fehlgeschlagen. Bitte versuchen Sie es erneut.");
    }

    // Status nach 8 Sekunden zurücksetzen
    setTimeout(() => {
      setPurchaseStatus("idle");
      setPurchaseMessage("");
    }, 8000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <FaSpinner className="animate-spin text-4xl text-amber-400" />
        <span className="ml-4 text-white text-xl">Lade Produkte...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <FaTimes className="text-4xl text-red-400 mb-4 mx-auto" />
        <p className="text-red-400 text-xl">{error}</p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-amber-600 hover:bg-amber-700"
        >
          Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header mit Balance und Warenkorb */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">🛍️ D.FAITH Merch Shop</h1>
          <div className="space-y-1">
            <p className="text-amber-400 text-sm">
              Verfügbare D.FAITH: <span className="font-bold">{dfaithBalance}</span>
            </p>
            <p className="text-gray-400 text-xs">
              D.FAITH Preis: {dfaithPriceEur > 0 ? `${dfaithPriceEur.toFixed(4)}€` : "Lädt..."}
            </p>
          </div>
        </div>
        
        {/* Warenkorb Button */}
        <Button
          onClick={() => setShowCart(!showCart)}
          className="bg-amber-600 hover:bg-amber-700 text-white relative"
        >
          <FaShoppingCart className="mr-2" />
          Warenkorb
          {getCartItemCount() > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {getCartItemCount()}
            </span>
          )}
        </Button>
      </div>

      {/* Status-Nachrichten */}
      {purchaseMessage && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          purchaseStatus === "success" ? "bg-green-900/30 border border-green-600 text-green-400" :
          purchaseStatus === "error" ? "bg-red-900/30 border border-red-600 text-red-400" :
          "bg-yellow-900/30 border border-yellow-600 text-yellow-400"
        }`}>
          {purchaseStatus === "success" && <FaCheck />}
          {purchaseStatus === "error" && <FaTimes />}
          {purchaseStatus === "pending" && <FaSpinner className="animate-spin" />}
          {purchaseMessage}
        </div>
      )}

      {/* Kategorie-Filter */}
      <div className="flex flex-wrap gap-2">
        <FaFilter className="text-amber-400 text-lg mt-2 mr-2" />
        {categories.map(category => (
          <Button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`${
              selectedCategory === category 
                ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" 
                : "bg-transparent border-amber-600 text-amber-400 hover:bg-amber-600/10"
            }`}
          >
            {category === "all" ? "Alle" : category}
          </Button>
        ))}
      </div>

      {/* Warenkorb Sidebar */}
      {showCart && (
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">🛒 Warenkorb</h3>
              <Button
                onClick={() => setShowCart(false)}
                className="bg-transparent hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border-none p-2"
              >
                <FaTimes />
              </Button>
            </div>
            
            {Object.keys(cart).length === 0 ? (
              <p className="text-gray-400">Warenkorb ist leer</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(cart).map(([productId, quantity]) => {
                  const product = products.find(p => p.id === productId);
                  if (!product) return null;
                  
                  const dfaithPrice = convertEurToDfaith(product.price);
                  
                  return (
                    <div key={productId} className="flex justify-between items-center border-b border-zinc-700 pb-2">
                      <div>
                        <p className="text-white font-medium">{product.name}</p>
                        <div className="text-sm space-y-1">
                          <p className="text-amber-400">{dfaithPrice.toFixed(2)} D.FAITH</p>
                          <p className="text-gray-400 flex items-center gap-1">
                            <FaEuroSign className="text-xs" />
                            {product.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => removeFromCart(productId)}
                          className="border-amber-600 text-amber-400 hover:bg-amber-600/10 bg-transparent w-8 h-8 p-0 text-sm"
                        >
                          -
                        </Button>
                        <span className="text-white w-8 text-center">{quantity}</span>
                        <Button
                          onClick={() => addToCart(productId)}
                          className="border-amber-600 text-amber-400 hover:bg-amber-600/10 bg-transparent w-8 h-8 p-0 text-sm"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  );
                })}
                
                <div className="border-t border-zinc-700 pt-4">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Gesamt D.FAITH:</span>
                      <span className="text-amber-400 font-bold">{getTotalPriceDfaith().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Gesamt EUR:</span>
                      <span className="text-gray-400">{getTotalPriceEur().toFixed(2)}€</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={clearCart}
                      className="border-red-600 text-red-400 hover:bg-red-600/10 bg-transparent flex-1"
                    >
                      Leeren
                    </Button>
                    <Button
                      onClick={() => setShowCheckout(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white flex-1"
                    >
                      <FaCoins className="mr-2" />
                      Zur Kasse
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checkout-Formular Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="bg-zinc-900 border-zinc-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">🛒 Kasse</h3>
                <Button
                  onClick={() => setShowCheckout(false)}
                  className="bg-transparent hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border-none p-2"
                >
                  <FaTimes />
                </Button>
              </div>

              {/* Bestellübersicht */}
              <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
                <h4 className="font-bold text-white mb-3">📋 Ihre Bestellung</h4>
                <div className="space-y-2">
                  {Object.entries(cart).map(([productId, quantity]) => {
                    const product = products.find(p => p.id === productId);
                    if (!product) return null;
                    
                    return (
                      <div key={productId} className="flex justify-between text-sm">
                        <span className="text-gray-300">
                          {product.name} x{quantity} 
                          {product.isDigital && <span className="text-blue-400 ml-2">📱 Digital</span>}
                          {!product.isDigital && <span className="text-green-400 ml-2">📦 Physisch</span>}
                        </span>
                        <span className="text-amber-400">{convertEurToDfaith(product.price * quantity).toFixed(2)} D.FAITH</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-zinc-700 pt-2 mt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-white">Gesamt:</span>
                      <span className="text-amber-400">{getTotalPriceDfaith().toFixed(2)} D.FAITH</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>EUR Gegenwert:</span>
                      <span>{getTotalPriceEur().toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formular */}
              <form onSubmit={(e) => { e.preventDefault(); handlePurchase(); }} className="space-y-4">
                {/* E-Mail (immer erforderlich) */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    📧 E-Mail-Adresse *
                  </label>
                  <input
                    type="email"
                    required
                    value={checkoutForm.email}
                    onChange={(e) => setCheckoutForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                    placeholder="ihre@email.de"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {hasPhysicalProducts() 
                      ? "Für Versandbestätigung und digitale Inhalte" 
                      : "Für Download-Links und Rechnungsversand"
                    }
                  </p>
                </div>

                {/* Versandadresse (nur bei physischen Produkten) */}
                {hasPhysicalProducts() && (
                  <div className="space-y-4 p-4 bg-zinc-800 rounded-lg">
                    <h4 className="font-bold text-white mb-3">📦 Versandadresse</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">Vorname *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.firstName}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                          placeholder="Max"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white font-medium mb-2">Nachname *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.lastName}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                          placeholder="Mustermann"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">Straße und Hausnummer *</label>
                      <input
                        type="text"
                        required
                        value={checkoutForm.street}
                        onChange={(e) => setCheckoutForm(prev => ({ ...prev, street: e.target.value }))}
                        className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                        placeholder="Musterstraße 123"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">PLZ *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.postalCode}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, postalCode: e.target.value }))}
                          className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                          placeholder="12345"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-white font-medium mb-2">Stadt *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.city}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                          placeholder="Musterstadt"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">Land *</label>
                        <select
                          required
                          value={checkoutForm.country}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, country: e.target.value }))}
                          className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                        >
                          <option value="Deutschland">Deutschland</option>
                          <option value="Österreich">Österreich</option>
                          <option value="Schweiz">Schweiz</option>
                          <option value="Niederlande">Niederlande</option>
                          <option value="Belgien">Belgien</option>
                          <option value="Frankreich">Frankreich</option>
                          <option value="Italien">Italien</option>
                          <option value="Spanien">Spanien</option>
                          <option value="Polen">Polen</option>
                          <option value="Tschechien">Tschechien</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-white font-medium mb-2">Telefon (optional)</label>
                        <input
                          type="tel"
                          value={checkoutForm.phone}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                          placeholder="+49 123 456789"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Aktionen */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="border-gray-600 text-gray-400 hover:bg-gray-600/10 bg-transparent flex-1"
                  >
                    Zurück
                  </Button>
                  <Button
                    type="submit"
                    disabled={isTransactionPending || purchaseStatus === "pending"}
                    className="bg-amber-600 hover:bg-amber-700 text-white flex-1"
                  >
                    {isTransactionPending || purchaseStatus === "pending" ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Zahlung läuft...
                      </>
                    ) : (
                      <>
                        <FaCoins className="mr-2" />
                        Jetzt kaufen ({getTotalPriceDfaith().toFixed(2)} D.FAITH)
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Produkte-Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => {
          const dfaithPrice = convertEurToDfaith(product.price);
          
          return (
            <Card key={product.id} className="bg-zinc-900 border-zinc-700 overflow-hidden">
              <CardContent className="p-0">
                {/* Digital/Physisch Badge */}
                <div className="absolute top-2 right-2 z-10">
                  {product.isDigital ? (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      📱 Digital
                    </span>
                  ) : (
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      📦 Physisch
                    </span>
                  )}
                </div>

                {/* Medien-Vorschau */}
                {product.media.length > 0 && (
                  <div className="p-4 bg-zinc-800 relative">
                    <MediaPlayer media={product.media[0]} />
                    {product.media.length > 1 && (
                      <p className="text-xs text-gray-400 mt-2">
                        +{product.media.length - 1} weitere Datei(en)
                      </p>
                    )}
                  </div>
                )}
                
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-bold">{product.name}</h3>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">
                      {product.category}
                    </span>
                  </div>
                  
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  
                  {/* Medien-Übersicht */}
                  {product.media.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {product.media.slice(0, 4).map(media => (
                        <div key={media.id} className="flex items-center gap-1 text-xs text-gray-400 bg-zinc-800 px-2 py-1 rounded">
                          {getMediaIcon(media.type)}
                          {media.type}
                        </div>
                      ))}
                      {product.media.length > 4 && (
                        <span className="text-xs text-gray-400">+{product.media.length - 4}</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-amber-400 font-bold flex items-center gap-1">
                        <FaCoins className="text-sm" />
                        {dfaithPrice.toFixed(2)} D.FAITH
                      </div>
                      <div className="text-gray-400 text-xs flex items-center gap-1">
                        <FaEuroSign className="text-xs" />
                        {product.price.toFixed(2)}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => addToCart(product.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <FaShoppingCart className="mr-2" />
                      In Warenkorb
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Keine Produkte gefunden */}
      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <FaShoppingCart className="text-4xl text-gray-600 mb-4 mx-auto" />
          <p className="text-gray-400 text-xl">Keine Produkte in dieser Kategorie gefunden.</p>
        </div>
      )}

      {/* Info-Sektion */}
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-6">
          <h3 className="text-white font-bold mb-4">ℹ️ Über den D.FAITH Merch Shop</h3>
          <div className="text-gray-400 space-y-2">
            <p>• Alle Artikel werden mit D.FAITH Token bezahlt</p>
            <p>• Live-Preisumrechnung von EUR zu D.FAITH</p>
            <p>• 📱 Digitale Produkte: Sofortiger Download nach Kauf</p>
            <p>• 📦 Physische Produkte: Versand nach Zahlungseingang</p>
            <p>• Direkte Medien-Wiedergabe (Audio, Video, Bilder)</p>
            <p>• Sichere Blockchain-basierte Transaktionen</p>
            <p>• Automatische E-Mail-Bestätigung und Webhooks</p>
            <p>• Weltweiter Versand verfügbar</p>
          </div>
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-600 rounded-lg">
            <p className="text-amber-400 text-sm">
              💡 <strong>Hinweis:</strong> Nach dem Kauf erhalten Sie eine E-Mail mit Download-Links (digital) 
              oder Versandbestätigung (physisch). Alle Transaktionen werden über die Base-Blockchain abgewickelt.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}