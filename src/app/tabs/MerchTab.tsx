"use client";
import { useEffect, useState, useRef } from "react";
import { useActiveAccount, useReadContract, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { base } from "thirdweb/chains";
import { client } from "../client";
import type { SupportedLanguage } from "../utils/deepLTranslation";
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

// Translation Components
import { TranslatedText, TranslatedTitle, TranslatedButton } from '../components/TranslatedText';

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
  stock?: number; // Verfügbare Stückanzahl für physische Produkte
  size?: string; // T-Shirt Größe
  sizes?: string[] | string; // Multiple Größen oder Größen-String
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

// Kompakter Audio Player im Spotify-Stil
function CompactAudioPlayer({ media }: { media: MediaFile }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const element = audioRef.current;
    if (element) {
      setCurrentTime(element.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const element = audioRef.current;
    if (element) {
      setDuration(element.duration);
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error('Audio loading error:', e);
    console.log('Media URL:', media.url);
    console.log('Media type:', media.mimeType);
  };

  const handleCanPlay = () => {
    console.log('Audio can play:', media.url);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const element = audioRef.current;
    if (element) {
      const newTime = parseFloat(e.target.value);
      element.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-amber-900/80/50 rounded-lg p-3 border border-zinc-700/50">
      <audio
        ref={audioRef}
        src={media.url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
        crossOrigin="anonymous"
        preload="metadata"
      />
      
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-200 hover:scale-105"
        >
          {isPlaying ? <FaPause className="text-xs" /> : <FaPlay className="text-xs ml-0.5" />}
        </button>
        
        {/* Progress Bar und Zeit */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer mb-1"
            style={{
              background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Musik Icon */}
        <FaMusic className="text-amber-400 text-sm" />
      </div>
      
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          background: #f59e0b;
          border-radius: 50%;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          height: 12px;
          width: 12px;
          background: #f59e0b;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}

// Verbesserter Audio Player mit modernem Design
function EnhancedMediaPlayer({ media }: { media: MediaFile }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    const audioElement = audioRef.current;
    const videoElement = videoRef.current;
    const element = audioElement || videoElement;
    
    if (!element) return;

    if (isPlaying) {
      element.pause();
    } else {
      element.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const element = audioRef.current || videoRef.current;
    if (element) {
      setCurrentTime(element.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const element = audioRef.current || videoRef.current;
    if (element) {
      setDuration(element.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const element = audioRef.current || videoRef.current;
    if (element) {
      const newTime = parseFloat(e.target.value);
      element.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    const element = audioRef.current || videoRef.current;
    if (element) {
      element.volume = newVolume;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  switch (media.type) {
    case "AUDIO":
      return (
        <div className="w-full bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl p-6 border border-zinc-700 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
              <FaMusic className="text-2xl text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {/* MB-Anzeige entfernt für saubere Darstellung */}
            </div>
          </div>
          
          <audio
            ref={audioRef}
            src={media.url}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          
          {/* Custom Controls */}
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-amber-800/70 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`,
                  WebkitAppearance: 'none',
                  outline: 'none'
                }}
              />
              <style jsx>{`
                input[type="range"]::-webkit-slider-thumb {
                  appearance: none;
                  height: 16px;
                  width: 16px;
                  background: #f59e0b;
                  border-radius: 50%;
                  cursor: pointer;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                input[type="range"]::-moz-range-thumb {
                  height: 16px;
                  width: 16px;
                  background: #f59e0b;
                  border-radius: 50%;
                  cursor: pointer;
                  border: none;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
              `}</style>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 bg-amber-600 hover:bg-amber-700 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-105"
                >
                  {isPlaying ? <FaPause className="text-lg" /> : <FaPlay className="text-lg ml-1" />}
                </button>
              </div>
              
              {/* Volume Control */}
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <FaVolumeUp />
                </button>
                {showVolumeSlider && (
                  <div className="absolute right-0 bottom-12 bg-amber-900/80 p-3 rounded-lg shadow-xl border border-amber-700/50">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-2 bg-amber-800/70 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    
    case "VIDEO":
      return (
        <div className="w-full bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl overflow-hidden border border-zinc-700 shadow-lg">
          <div className="relative">
            <video 
              ref={videoRef}
              src={media.url}
              controls
              className="w-full max-h-80 object-cover"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1">
              <FaVideo className="text-red-400 inline mr-2" />
              <span className="text-white text-sm font-medium">Video</span>
            </div>
          </div>
          <div className="p-4">
            {/* MB-Anzeige entfernt für saubere Darstellung */}
          </div>
        </div>
      );
    
    case "IMAGE":
      return (
        <div className="w-full bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl overflow-hidden border border-zinc-700 shadow-lg">
          <div className="relative group">
            <img 
              src={media.url} 
              alt={media.originalName}
              className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1">
              <FaImage className="text-blue-400 inline mr-2" />
              <span className="text-white text-sm font-medium">Bild</span>
            </div>
            <button className="absolute top-4 right-4 w-10 h-10 bg-black/70 backdrop-blur-sm rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/80">
              <FaExpand />
            </button>
          </div>
          <div className="p-4">
            <p className="text-gray-400 text-sm">{(media.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      );
    
    default:
      return (
        <div className="w-full bg-gradient-to-br from-amber-900/70 to-orange-950/80 rounded-xl p-6 border border-amber-700/50 shadow-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FaDownload className="text-2xl text-white" />
            </div>
            <p className="text-gray-400 text-sm mb-4">{(media.size / 1024 / 1024).toFixed(2)} MB</p>
            <a 
              href={media.url} 
              download="file"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
            >
              <FaDownload />
              Download
            </a>
          </div>
        </div>
      );
  }
}

interface MerchTabProps {
  language: SupportedLanguage;
}

export default function MerchTab({ language }: MerchTabProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendAndConfirmTransaction, isPending: isTransactionPending } = useSendAndConfirmTransaction();
  
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<{
    transactionHash: string;
    orderId: string;
    itemCount: number;
    totalPrice: number;
    hasPhysical: boolean;
  } | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [purchaseMessage, setPurchaseMessage] = useState<string>("");
  // Bildindizes für T-Shirt Galleries
  const [imageIndices, setImageIndices] = useState<{[productId: string]: number}>({});
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

  // D.FAITH Preis laden (gleiche Logik wie im BuyTab für korrekte Preise)
  const [dfaithPrice, setDfaithPrice] = useState<number | null>(null);
  const [ethPriceEur, setEthPriceEur] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [lastKnownPrices, setLastKnownPrices] = useState<{
    dfaith?: number;
    dfaithEur?: number;
    ethEur?: number;
    timestamp?: number;
  }>({});
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    // Lade gespeicherte Preise beim Start
    const loadStoredPrices = () => {
      try {
        const stored = localStorage.getItem('dawid_faith_prices');
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();
          // Verwende gespeicherte Preise wenn sie weniger als 6 Stunden alt sind
          if (parsed.timestamp && (now - parsed.timestamp) < 6 * 60 * 60 * 1000) {
            setLastKnownPrices(parsed);
            if (parsed.dfaith) setDfaithPrice(parsed.dfaith);
            if (parsed.dfaithEur) setDfaithPriceEur(parsed.dfaithEur);
            if (parsed.ethEur) setEthPriceEur(parsed.ethEur);
          }
        }
      } catch (e) {
        console.log('Fehler beim Laden gespeicherter Preise:', e);
      }
    };

    loadStoredPrices();

    const fetchDfaithPrice = async () => {
      setIsLoadingPrice(true);
      setPriceError(null);
      let ethEur: number | null = null;
      let dfaithPriceEur: number | null = null;
      let errorMsg = "";
      
      try {
        // 1. Hole ETH/EUR Preis von CoinGecko
        try {
          const ethResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur');
          if (ethResponse.ok) {
            const ethData = await ethResponse.json();
            ethEur = ethData['ethereum']?.eur;
            if (ethEur) {
              ethEur = Math.round(ethEur * 100) / 100;
            }
          }
        } catch (e) {
          console.log('ETH Preis Fehler:', e);
        }
        
        // Fallback auf letzten bekannten ETH Preis
        if (!ethEur && lastKnownPrices.ethEur) {
          ethEur = lastKnownPrices.ethEur;
        } else if (!ethEur) {
          ethEur = 3000; // Hard fallback für ETH
        }
        
        // 2. Hole D.FAITH Preis von ParaSwap für Base Chain
        try {
          const priceParams = new URLSearchParams({
            srcToken: DFAITH_TOKEN,
            destToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH address for ParaSwap
            srcDecimals: DFAITH_DECIMALS.toString(),
            destDecimals: "18", // ETH decimals
            amount: "100", // 1 D.FAITH (100 mit 2 Decimals)
            network: "8453", // Base Chain ID
            side: "SELL"
          });
          
          const priceResponse = await fetch(`https://apiv5.paraswap.io/prices?${priceParams}`);
          
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            console.log("ParaSwap Price Response:", priceData);
            
            if (priceData && priceData.priceRoute && priceData.priceRoute.destAmount) {
              // destAmount ist in ETH Wei (18 Decimals)
              const ethPerDfaith = Number(priceData.priceRoute.destAmount) / Math.pow(10, 18);
              setDfaithPrice(ethPerDfaith); // Wie viele ETH für 1 D.FAITH
              // Preis pro D.FAITH in EUR: ethPerDfaith * ethEur
              if (ethEur && ethPerDfaith > 0) {
                dfaithPriceEur = ethPerDfaith * ethEur;
              } else {
                dfaithPriceEur = null;
              }
            } else {
              errorMsg = "ParaSwap: Keine Liquidität verfügbar";
            }
          } else {
            errorMsg = `ParaSwap: ${priceResponse.status}`;
          }
        } catch (e) {
          console.log("ParaSwap Fehler:", e);
          errorMsg = "ParaSwap API Fehler";
        }
        
        // Fallback auf letzte bekannte D.FAITH Preise
        if (!dfaithPrice && lastKnownPrices.dfaith) {
          setDfaithPrice(lastKnownPrices.dfaith);
          errorMsg = "";
        }
        if (!dfaithPriceEur && lastKnownPrices.dfaithEur) {
          dfaithPriceEur = lastKnownPrices.dfaithEur;
          errorMsg = "";
        }
        
      } catch (e) {
        console.error("Price fetch error:", e);
        errorMsg = "Preis-API Fehler";
        
        // Verwende letzte bekannte Preise als Fallback
        if (lastKnownPrices.dfaith) setDfaithPrice(lastKnownPrices.dfaith);
        if (lastKnownPrices.dfaithEur) dfaithPriceEur = lastKnownPrices.dfaithEur;
        if (lastKnownPrices.ethEur) ethEur = lastKnownPrices.ethEur;
        
        if (dfaithPrice && dfaithPriceEur && ethEur) {
          errorMsg = ""; // Kein Fehler anzeigen wenn Fallback verfügbar
        }
      }
      
      // Setze Preise (entweder neue oder Fallback)
      if (ethEur) setEthPriceEur(ethEur);
      if (dfaithPriceEur !== null && dfaithPriceEur !== undefined) setDfaithPriceEur(dfaithPriceEur);
      
      // Speichere erfolgreiche Preise
      if (dfaithPrice && dfaithPriceEur && ethEur) {
        const newPrices = {
          dfaith: dfaithPrice,
          dfaithEur: dfaithPriceEur,
          ethEur: ethEur,
          timestamp: Date.now()
        };
        setLastKnownPrices(newPrices);
        try {
          localStorage.setItem('dawid_faith_prices', JSON.stringify(newPrices));
        } catch (e) {
          console.log('Fehler beim Speichern der Preise:', e);
        }
        setPriceError(null);
      } else {
        setPriceError(errorMsg || "Preise nicht verfügbar");
      }
      
      setIsLoadingPrice(false);
    };

    fetchDfaithPrice();
    // Preis alle 2 Minuten aktualisieren (gleich wie im BuyTab)
    const interval = setInterval(fetchDfaithPrice, 120000);
    return () => clearInterval(interval);
  }, [lastKnownPrices.dfaith, lastKnownPrices.dfaithEur, lastKnownPrices.ethEur, dfaithPrice]);

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
        // Automatische Erkennung digitaler Produkte
        // Ein Produkt ist nur dann digital, wenn es AUSSCHLIESSLICH aus digitalen Dateien (Audio/Video) besteht
        const productsWithDigitalFlag = data.map((product: Product) => ({
          ...product,
          isDigital: product.media.length > 0 && product.media.every(media => 
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

  // EUR zu D.FAITH umrechnen (jetzt mit korrekter Preislogik)
  const convertEurToDfaith = (eurPrice: number): number => {
    if (!dfaithPriceEur || dfaithPriceEur === 0) return 0;
    return eurPrice / dfaithPriceEur;
  };

  // Einzigartige Kategorien extrahieren

  const getCategoryDisplayName = (category: string) => {
    if (category === "all") return "Alle Produkte";
    
    const names: { [key: string]: string } = {
      "music": "Musik",
      "clothing": "Kleidung",
      "accessories": "Accessoires", 
      "digital": "Digital",
      "books": "Bücher",
      "art": "Kunst",
      "collectibles": "Sammlerstücke",
      "electronics": "Elektronik",
      "gaming": "Gaming",
      "lifestyle": "Lifestyle",
      "merch": "Merchandise",
      "cds": "CD",
      "cd": "CD"
    };
    return names[category.toLowerCase()] || category;
  };

  // Translated Category Display Component
  const TranslatedCategoryName = ({ category }: { category: string }) => {
    const displayName = getCategoryDisplayName(category);
    return <TranslatedText text={displayName} language={language} />;
  };

  // Bereinigt Dateinamen von Dateierweiterungen für bessere Anzeige
  const cleanFileName = (fileName: string): string => {
    if (!fileName) return '';
    
    // Entferne Dateierweiterungen und bereinige den Namen
    let cleaned = fileName
      .replace(/\.(mp3|wav|m4a|aac|mp4|avi|mov|wmv|flv|jpg|jpeg|png|gif|bmp|webp|pdf|doc|docx|txt)$/i, '')
      .replace(/[-_]/g, ' ') // Ersetze Bindestriche und Unterstriche mit Leerzeichen
      .trim();
    
    // Capitalize first letter of each word
    cleaned = cleaned.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return cleaned || 'Unbenannte Datei';
  };

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
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Bei physischen Produkten prüfen, ob noch Stück verfügbar sind
    if (!product.isDigital && product.stock !== undefined) {
      const currentInCart = cart[productId] || 0;
      if (currentInCart >= product.stock) {
        alert(`Nur ${product.stock} Stück von "${product.name}" verfügbar!`);
        return;
      }
    }
    
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

  // Prüft, ob ein Produkt noch zum Warenkorb hinzugefügt werden kann
  const canAddToCart = (product: Product): boolean => {
    // Digitale Produkte sind immer verfügbar
    if (product.isDigital) return true;
    
    // Physische Produkte ohne Stock-Info sind verfügbar
    if (product.stock === undefined) return true;
    
    // Prüfe verfügbaren Bestand
    const currentInCart = cart[product.id] || 0;
    return currentInCart < product.stock;
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

  // Versanddaten an API senden
  const sendShippingData = async (transactionHash: string, orderId: string, totalPriceDfaith: number) => {
    const shippingData = {
      // Transaktion & Bestellung
      transactionHash: transactionHash,
      expectedAmount: totalPriceDfaith,
      
      // Kundendaten
      customerData: {
        orderId: orderId,
        userId: account?.address || '',
        email: checkoutForm.email,
        firstName: checkoutForm.firstName || '',
        lastName: checkoutForm.lastName || '',
        
        // Versandadresse (nur bei physischen Produkten)
        shippingAddress: hasPhysicalProducts() ? {
          street: checkoutForm.street || '',
          city: checkoutForm.city || '',
          postalCode: checkoutForm.postalCode || '',
          country: checkoutForm.country || 'Deutschland',
          phone: checkoutForm.phone || ''
        } : null,
        
        // Zusätzliche Kundendaten
        hasPhysicalProducts: hasPhysicalProducts(),
        preferredLanguage: 'de'
      },
      
      // Produktdaten
      productData: {
        totalAmount: totalPriceDfaith,
        currency: 'D.FAITH',
        itemCount: getCartItemCount(),
        
        // Detaillierte Produktliste
        items: Object.entries(cart).map(([productId, quantity]) => {
          const product = products.find(p => p.id === productId);
          return {
            id: productId,
            name: product?.name || 'Unbekanntes Produkt',
            description: product?.description || '',
            category: product?.category || '',
            quantity: quantity,
            priceEur: product?.price || 0,
            priceDfaith: convertEurToDfaith(product?.price || 0),
            isDigital: product?.isDigital || false,
            
            // T-Shirt spezifische Daten
            size: product?.size || product?.sizes || null,
            
            // Medien-URLs für digitale Produkte
            mediaUrls: product?.media?.map(media => ({
              type: media.type,
              url: media.url,
              filename: media.originalName
            })) || []
          };
        })
      },
      
      // Zusätzliche Metadaten
      metadata: {
        orderDate: new Date().toISOString(),
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        source: 'dawid-faith-wallet',
        version: '1.0'
      }
    };

    console.log('📦 Sending shipping data:', shippingData);

    try {
      const response = await fetch('https://merch-balance-verifification-production.up.railway.app/api/v1/verify-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(shippingData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Verifikation fehlgeschlagen');
      }

      console.log('✅ Shipping data sent successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ Error sending shipping data:', error);
      throw error;
    }
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

      // Transaktion senden und Transaction Hash erhalten
      const transactionResult = await sendAndConfirmTransaction(transaction);
      const transactionHash = transactionResult.transactionHash;
      
      // Generiere eindeutige Order-ID
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 1. ZUERST: Transaktion mit echtem Hash verifizieren und Versanddaten senden
      try {
        const verifyResult = await sendShippingData(transactionHash, orderId, totalPriceDfaith);
        
        // 2. API hat automatisch Webhook gesendet - wir zeigen nur noch Erfolg an
        console.log('✅ Verifikation erfolgreich:', verifyResult.verification);
        console.log('📦 Webhook Status:', verifyResult.webhook);
        
      } catch (verifyError: any) {
        console.error("Verifikations-Fehler:", verifyError);
        
        // Detailliertes Error-Handling
        let errorMessage = 'Verifikation fehlgeschlagen';
        
        if (verifyError.message.includes('Transaction verification failed')) {
          errorMessage = 'Transaktion konnte nicht auf der Blockchain gefunden werden. Bitte prüfen Sie den Transaction Hash.';
        } else if (verifyError.message.includes('Validation failed')) {
          errorMessage = `Validierungsfehler: Ungültige Daten`;
        } else if (verifyError.message.includes('not confirmed')) {
          errorMessage = 'Transaktion wird noch bestätigt. Bitte warten Sie einen Moment und versuchen Sie es erneut.';
        } else if (verifyError.message.includes('amount mismatch')) {
          errorMessage = 'Bezahlter Betrag stimmt nicht überein. Bitte kontaktieren Sie den Support.';
        } else {
          errorMessage = verifyError.message || 'Unbekannter Verifikationsfehler';
        }
        
        throw new Error(errorMessage);
      }
      
      setPurchaseStatus("success");
      setSuccessDetails({
        transactionHash,
        orderId,
        itemCount: getCartItemCount(),
        totalPrice: totalPriceDfaith,
        hasPhysical: hasPhysicalProducts()
      });
      setShowSuccessModal(true);
      
      // Nach 1 Sekunde Checkout schließen, aber Success Modal offen lassen
      setTimeout(() => {
        setShowCheckout(false);
        setShowCart(false);
      }, 1000);
      
      // Erfolg-Modal nach 2 Sekunden schließen und dann Warenkorb/Checkout schließen
      setTimeout(() => {
        clearCart();
        setShowCart(false);
        setShowCheckout(false);
      }, 2000);

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

  // Modal-Hintergrund fixieren
  useEffect(() => {
    if (showCart || showCheckout) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCart, showCheckout]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <FaSpinner className="animate-spin text-4xl text-amber-400" />
        <span className="ml-4 text-white text-xl">
          <TranslatedText text="Lade Produkte..." language={language} />
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <FaTimes className="text-4xl text-red-400 mb-4 mx-auto" />
        <p className="text-red-400 text-xl">{error}</p>
        <TranslatedButton 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-amber-600 hover:bg-amber-700"
          text="Neu laden"
          language={language}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-950 via-orange-950 to-yellow-950 text-white">
      {/* Dawid Faith Shop - Ultra Professional Header Design */}
      <div className="relative mb-8 overflow-hidden">
        {/* Dawid Faith Gruppenbild-Hintergrund - Professionell integriert */}
        <div className="absolute inset-0">
          {/* Gruppenbild als Haupthintergrund */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('/Still 2025-03-19 193121_19.7.1.jpg')`
            }}
          />
          
          {/* Dunkle Overlay-Gradienten für Text-Lesbarkeit */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50"></div>
          
          {/* Künstlerische Farbakzente über dem Bild */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-950/30 via-amber-900/20 to-yellow-950/25"></div>
          
          {/* Subtile Textur für Tiefe */}
          <div className="absolute inset-0 opacity-10" 
               style={{
                 backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
                 backgroundSize: '40px 40px'
               }}>
          </div>
          
          {/* Schwebende Partikel für Dynamik */}
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-orange-400/50 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Main Header Section - Kompakter */}
        <div className="relative">
          <div className="container mx-auto px-6 py-12">
            {/* Premium Artist Branding */}
            <div className="max-w-6xl mx-auto text-center">
              
              {/* Logo/Brand Section with Geometric Elements */}
              <div className="relative mb-6">
                {/* Decorative Lines */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent transform -translate-y-1/2"></div>
                
                {/* Main Artist Name - Ohne Symbol */}
                <div className="relative inline-block bg-slate-900/60 backdrop-blur-lg px-12 py-6 rounded-2xl border border-amber-400/20 shadow-2xl">
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold font-pirata tracking-[0.05em] relative">
                    <span className="bg-gradient-to-r from-orange-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
                      DAWID FAITH
                    </span>
                  </h1>
                  
                  {/* Elegant Underline */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent"></div>
                </div>
                
                {/* Side Decorative Elements */}
                <div className="absolute top-1/2 left-8 w-3 h-3 bg-amber-400 rounded-full transform -translate-y-1/2 animate-pulse hidden lg:block"></div>
                <div className="absolute top-1/2 right-8 w-3 h-3 bg-amber-400 rounded-full transform -translate-y-1/2 animate-pulse hidden lg:block"></div>
              </div>
              
              {/* Professional Subtitle Section - Direkter Anschluss */}
              <div className="space-y-4 mb-2">
                <div className="bg-slate-800/40 backdrop-blur-md rounded-xl px-8 py-4 border border-slate-600/30 max-w-2xl mx-auto">
                  <h2 className="text-2xl md:text-3xl font-light text-slate-100 tracking-wide mb-2">
                    <TranslatedText text="Offizieller Fan Shop" language={language} />
                  </h2>
                  <div className="w-16 h-px bg-amber-400 mx-auto mb-3"></div>
                  <p className="text-slate-300 text-lg font-medium">
                    <TranslatedText text="Premium Kollektion • Exklusive Veröffentlichungen • Digitale Inhalte" language={language} />
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Ultra Modern Category Navigation - Direkter Anschluss mit gleichem Hintergrund */}
          <div className="relative">
            <div className="container mx-auto px-6 py-6">
              
              {/* Category Title - Kompakter */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium text-slate-200 tracking-wide">
                  <TranslatedText text="Kollektionen durchsuchen" language={language} />
                </h3>
                <div className="w-12 h-px bg-amber-400 mx-auto mt-2"></div>
              </div>
              
              {/* Premium Category Pills */}
              <div className="flex flex-wrap justify-center gap-3 max-w-6xl mx-auto">
                {categories.map((category, index) => (
                  <button
                    key={category}
                    className={`group relative px-6 py-3 rounded-xl text-sm font-medium tracking-wide transition-all duration-500 transform ${
                      selectedCategory === category
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/25 scale-105 translate-y-[-2px]'
                        : 'bg-slate-800/60 text-slate-300 border border-slate-600/40 hover:bg-slate-700/80 hover:text-white hover:border-amber-400/50 hover:scale-105 hover:translate-y-[-1px]'
                    }`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {/* Button Content */}
                    <span className="relative z-10 flex items-center gap-2">
                      <TranslatedCategoryName category={category} />
                      {selectedCategory === category && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      )}
                    </span>
                    
                    {/* Hover Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/15 group-hover:to-amber-600/15 rounded-xl transition-all duration-300"></div>
                  </button>
                ))}
              </div>
              
              {/* Elegant Results Counter - Kompakter */}
              <div className="text-center mt-5">
                <div className="inline-flex items-center gap-3 bg-slate-800/40 backdrop-blur-sm rounded-full px-6 py-2 border border-slate-600/30">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span className="text-slate-300 text-sm font-medium">
                    {filteredProducts.length} <TranslatedText text={filteredProducts.length === 1 ? 'Artikel' : 'Artikel'} language={language} /> <TranslatedText text="verfügbar" language={language} />
                  </span>
                  {selectedCategory !== "all" && (
                    <>
                      <span className="text-slate-500">•</span>
                      <span className="text-amber-400 text-sm font-medium">
                        {getCategoryDisplayName(selectedCategory)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schwebender Warenkorb Button - Unten rechts */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowCart(!showCart)}
          className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white relative shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 rounded-full w-16 h-16 p-0 flex items-center justify-center border border-white/20"
        >
          <FaShoppingCart className="text-xl" />
          {getCartItemCount() > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg animate-pulse">
              {getCartItemCount()}
            </span>
          )}
        </Button>
      </div>

      {/* Produktgrid - Mit margin für schwebenden Warenkorb */}
      <div className="p-4 pb-24">
        {/* Status-Nachrichten */}
        {purchaseMessage && (
          <div className={`p-4 rounded-lg flex items-center gap-2 mb-6 ${
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

        {/* Produktliste */}

      {/* Checkout-Formular Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="bg-zinc-900 border-zinc-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">🛒 Kasse</h3>
                <Button
                  onClick={() => setShowCheckout(false)}
                  className="bg-transparent hover:bg-amber-900/80 text-amber-400 hover:text-amber-300 border-none p-2"
                >
                  <FaTimes />
                </Button>
              </div>

              {/* Bestellübersicht */}
              <div className="mb-6 p-4 bg-amber-900/80 rounded-lg">
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
                    className="w-full p-3 bg-amber-900/80 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                  <div className="space-y-4 p-4 bg-amber-900/80 rounded-lg">
                    <h4 className="font-bold text-white mb-3">📦 Versandadresse</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">Vorname *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.firstName}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                        className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
                          placeholder="Musterstadt"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">Land *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.country}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, country: e.target.value }))}
                          placeholder="Deutschland"
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white placeholder-gray-400 focus:border-orange-400 focus:outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white font-medium mb-2">Telefon (optional)</label>
                        <input
                          type="tel"
                          value={checkoutForm.phone}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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

      {/* Produkte-Grid - Modernes Design mit besserer Übersicht */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredProducts.map(product => {
          const dfaithPrice = convertEurToDfaith(product.price);
          
          return (
            <Card key={product.id} className="bg-gradient-to-br from-amber-950/80 to-orange-950/60 border-amber-800/50 hover:border-orange-500/60 transition-all duration-300 overflow-hidden group shadow-xl hover:shadow-2xl hover:shadow-orange-500/15">
              <CardContent className="p-0 relative">
                {/* Medien-Vorschau */}
                {product.media.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-900/60 to-orange-950/80 relative">
                    {/* Spezielle Darstellung wenn MP3-Dateien vorhanden sind (unabhängig von Kategorie) */}
                    {(() => {
                      // Prüfe auf alle Audio-Dateien (unabhängig von Kategorie)
                      const audioMedias = product.media.filter(media => 
                        media.type === "AUDIO" || 
                        media.mimeType?.includes("audio") || 
                        media.originalName.toLowerCase().includes(".mp3") ||
                        media.originalName.toLowerCase().includes(".wav") ||
                        media.originalName.toLowerCase().includes(".m4a") ||
                        media.originalName.toLowerCase().includes(".aac")
                      );
                      const imageMedia = product.media.find(media => media.type === "IMAGE") || 
                                        product.media.find(media => 
                                          media.type !== "AUDIO" && 
                                          !media.mimeType?.includes("audio") &&
                                          !media.originalName.toLowerCase().match(/\.(mp3|wav|m4a|aac)$/)
                                        );
                      
                      if (audioMedias.length > 0) {
                        return (
                          <div className="space-y-2 p-3 relative">
                            {/* Bild anzeigen falls vorhanden */}
                            {imageMedia && (
                              <div className="w-full h-48 rounded-lg overflow-hidden relative group">
                                <img 
                                  src={imageMedia.url} 
                                  alt={imageMedia.originalName}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                {/* Gradient Overlay für bessere Lesbarkeit */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                
                                {/* Titel und Beschreibung Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                  <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold text-lg leading-tight flex-1 mr-2">{product.name}</h3>
                                    <span className="text-xs bg-gradient-to-r from-amber-600/90 to-amber-700/90 backdrop-blur-sm text-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                                      {product.category}
                                    </span>
                                  </div>
                                  <p className="text-gray-200 text-sm line-clamp-2 leading-relaxed">
                                    {product.description}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Alle Audio-Dateien anzeigen */}
                            <div className="space-y-2">
                              <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
                                {/* Liste aller Audio-Dateien */}
                                <div className="space-y-3">
                                  {audioMedias.map((audioMedia, index) => (
                                    <div key={audioMedia.id || index} className="bg-amber-900/80/50 rounded-lg p-2">
                                      {/* Audio-Datei Name */}
                                      <div className="flex items-center gap-2 mb-2">
                                        <FaPlay className="text-green-400 text-xs" />
                                        <span className="text-white text-sm font-medium truncate">
                                          {cleanFileName(audioMedia.originalName) || `Audio ${index + 1}`}
                                        </span>
                                      </div>
                                      
                                      {/* Audio Player */}
                                      <CompactAudioPlayer media={audioMedia} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Weitere Medien Badge */}
                            {(product.media.length - audioMedias.length - (imageMedia ? 1 : 0)) > 0 && (
                              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1">
                                <p className="text-xs text-white font-medium">
                                  +{product.media.length - audioMedias.length - (imageMedia ? 1 : 0)} weitere
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      } else if (product.media[0]?.type === "VIDEO") {
                        /* Spezielle Darstellung für Videos - Titel/Beschreibung unter dem Video */
                        return (
                          <div className="relative">
                            <EnhancedMediaPlayer media={product.media[0]} />
                            
                            {/* Titel und Beschreibung unter dem Video */}
                            <div className="p-4 bg-amber-900/80/80 backdrop-blur-sm">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-white font-bold text-lg leading-tight flex-1 mr-2">{product.name}</h3>
                                <span className="text-xs bg-gradient-to-r from-amber-600 to-amber-700 text-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                                  {product.category}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            </div>
                            
                            {product.media.length > 1 && (
                              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1">
                                <p className="text-xs text-white font-medium">
                                  +{product.media.length - 1} weitere
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      } else if (product.category.toLowerCase().includes('t.shirt') || product.category.toLowerCase().includes('tshirt') || product.category.toLowerCase().includes('shirt')) {
                        /* Spezielle T-Shirt Darstellung mit Bildergalerie und Größenauswahl */
                        const imageMedias = product.media.filter(media => 
                          media.type === "IMAGE" || 
                          media.mimeType?.includes("image") ||
                          media.originalName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
                        );
                        
                        return (
                          <div className="relative">
                            {/* T-Shirt Bildergalerie */}
                            {imageMedias.length > 0 && (
                              <div className="relative">
                                {/* Haupt-Bildergalerie mit Scroll */}
                                <div className="w-full h-64 relative overflow-hidden bg-amber-900/80 rounded-lg">
                                  {imageMedias.map((media, index) => (
                                    <div 
                                      key={index} 
                                      className="absolute inset-0 w-full h-full bg-zinc-900 flex items-center justify-center transition-opacity duration-300"
                                      style={{ 
                                        opacity: index === (imageIndices[product.id] || 0) ? 1 : 0,
                                        zIndex: index === (imageIndices[product.id] || 0) ? 10 : 1
                                      }}
                                    >
                                      <img 
                                        src={media.url} 
                                        alt={`${product.name} - Bild ${index + 1}`}
                                        className="max-w-full max-h-full object-contain rounded"
                                      />
                                    </div>
                                  ))}
                                  
                                  {/* Navigation Buttons bei mehreren Bildern */}
                                  {imageMedias.length > 1 && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const currentIndex = imageIndices[product.id] || 0;
                                          const newIndex = (currentIndex - 1 + imageMedias.length) % imageMedias.length;
                                          setImageIndices(prev => ({
                                            ...prev,
                                            [product.id]: newIndex
                                          }));
                                        }}
                                        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/80 text-white p-3 rounded-full hover:bg-black/90 transition-all duration-200 z-10 shadow-lg"
                                      >
                                        ←
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const currentIndex = imageIndices[product.id] || 0;
                                          const newIndex = (currentIndex + 1) % imageMedias.length;
                                          setImageIndices(prev => ({
                                            ...prev,
                                            [product.id]: newIndex
                                          }));
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/80 text-white p-3 rounded-full hover:bg-black/90 transition-all duration-200 z-10 shadow-lg"
                                      >
                                        →
                                      </button>
                                      
                                      {/* Bild-Indikatoren */}
                                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                                        {imageMedias.map((_, index) => (
                                          <button
                                            key={index}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setImageIndices(prev => ({
                                                ...prev,
                                                [product.id]: index
                                              }));
                                            }}
                                            className={`w-2 h-2 rounded-full transition-all ${
                                              index === (imageIndices[product.id] || 0) 
                                                ? 'bg-white' 
                                                : 'bg-white/50 hover:bg-white/70'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                                
                                {/* T-Shirt Info Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 hover:opacity-100 transition-opacity duration-300">
                                  <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-bold text-lg leading-tight flex-1 mr-2">{product.name}</h3>
                                    <span className="text-xs bg-gradient-to-r from-amber-600/90 to-amber-700/90 backdrop-blur-sm text-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                                      {product.category}
                                    </span>
                                  </div>
                                  <p className="text-gray-200 text-sm line-clamp-2 leading-relaxed mb-2">
                                    {product.description}
                                  </p>
                                  
                                  {/* Größen-Info falls verfügbar */}
                                  {(product.size || product.sizes) && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-amber-400">📏 Größe:</span>
                                      <span className="bg-white/20 px-2 py-1 rounded-full font-medium">
                                        {product.size || (Array.isArray(product.sizes) ? product.sizes.join(', ') : product.sizes)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        /* Standard-Darstellung für andere Kategorien mit Overlay */
                        return (
                          <div className="relative">
                            <EnhancedMediaPlayer media={product.media[0]} />
                            
                            {/* Titel und Beschreibung Overlay für alle anderen Kategorien */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 hover:opacity-100 transition-opacity duration-300">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-bold text-lg leading-tight flex-1 mr-2">{product.name}</h3>
                                <span className="text-xs bg-gradient-to-r from-amber-600/90 to-amber-700/90 backdrop-blur-sm text-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                                  {product.category}
                                </span>
                              </div>
                              <p className="text-gray-200 text-sm line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            </div>
                            
                            {product.media.length > 1 && (
                              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1">
                                <p className="text-xs text-white font-medium">
                                  +{product.media.length - 1} weitere
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
                
                <div className="p-6">
                  {/* Spezielle Behandlung für T-Shirts */}
                  {product.category.toLowerCase().includes('t.shirt') || product.category.toLowerCase().includes('tshirt') || product.category.toLowerCase().includes('shirt') ? (
                    /* T-Shirt Layout mit Titel, Beschreibung, Größe und Preis */
                    <div className="space-y-4">
                      {/* Titel und Beschreibung für T-Shirts */}
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-bold text-lg leading-tight flex-1 mr-2">{product.name}</h3>
                          <span className="text-xs bg-gradient-to-r from-amber-600 to-amber-700 text-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                            {product.category}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed mb-3">
                          {product.description}
                        </p>
                        
                        {/* Größen-Anzeige für T-Shirts */}
                        {(product.size || product.sizes) && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-amber-400 text-sm font-medium">Größe:</span>
                            <span className="bg-gradient-to-r from-amber-600/20 to-amber-700/20 border border-amber-400/30 px-3 py-1 rounded-full text-amber-300 font-medium text-sm">
                              {product.size || (Array.isArray(product.sizes) ? product.sizes.join(', ') : product.sizes)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Preis und Button */}
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <div className="text-amber-400 font-bold text-lg flex items-center gap-2">
                            <FaCoins className="text-amber-500" />
                            {dfaithPrice.toFixed(2)} D.FAITH
                          </div>
                          <div className="text-gray-400 text-sm flex items-center gap-1.5">
                            <FaEuroSign className="text-xs" />
                            {product.price.toFixed(2)} EUR
                          </div>
                          
                          {/* Verfügbare Stückanzahl für physische Produkte */}
                          {!product.isDigital && product.stock !== undefined && (
                            <div className="text-green-400 text-sm flex items-center gap-1.5">
                              <span>📦</span>
                              <span>Verfügbar: {product.stock} Stück</span>
                            </div>
                          )}
                          
                          {/* Stückanzahl für physische Produkte */}
                          {!product.isDigital && cart[product.id] && (
                            <div className="text-amber-300 text-sm flex items-center gap-1.5 mt-1">
                              <FaShoppingCart className="text-xs" />
                              <span>Im Warenkorb: {cart[product.id]} Stück</span>
                            </div>
                          )}
                        </div>
                        
                        <Button
                          onClick={() => addToCart(product.id)}
                          disabled={!canAddToCart(product)}
                          className={`${
                            canAddToCart(product)
                              ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                              : "bg-gray-600 text-gray-400 cursor-not-allowed"
                          } flex items-center justify-center gap-1 px-4 py-2`}
                        >
                          <span className="text-lg font-bold">
                            {canAddToCart(product) ? "+" : "✕"}
                          </span>
                          <FaShoppingCart className="text-sm" />
                          {!canAddToCart(product) && (
                            <span className="text-xs ml-1">Ausverkauft</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : product.media.length > 0 && product.media[0]?.type === "VIDEO" ? (
                    /* Nur Preis und Button für Videos */
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-amber-400 font-bold text-lg flex items-center gap-2">
                          <FaCoins className="text-amber-500" />
                          {dfaithPrice.toFixed(2)} D.FAITH
                        </div>
                        <div className="text-gray-400 text-sm flex items-center gap-1.5">
                          <FaEuroSign className="text-xs" />
                          {product.price.toFixed(2)} EUR
                        </div>
                        
                        {/* Verfügbare Stückanzahl für physische Produkte */}
                        {!product.isDigital && product.stock !== undefined && (
                          <div className="text-green-400 text-sm flex items-center gap-1.5">
                            <span>📦</span>
                            <span>Verfügbar: {product.stock} Stück</span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => addToCart(product.id)}
                        disabled={!canAddToCart(product)}
                        className={`${
                          canAddToCart(product)
                            ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        } flex items-center justify-center gap-1 px-4 py-2`}
                      >
                        <span className="text-lg font-bold">
                          {canAddToCart(product) ? "+" : "✕"}
                        </span>
                        <FaShoppingCart className="text-sm" />
                        {!canAddToCart(product) && (
                          <span className="text-xs ml-1">Ausverkauft</span>
                        )}
                      </Button>
                    </div>
                  ) : (
                    /* Standard Layout - nur Preis und Button, da Titel/Beschreibung bereits im Overlay sind */
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-amber-400 font-bold text-lg flex items-center gap-2">
                          <FaCoins className="text-amber-500" />
                          {dfaithPrice.toFixed(2)} D.FAITH
                        </div>
                        <div className="text-gray-400 text-sm flex items-center gap-1.5">
                          <FaEuroSign className="text-xs" />
                          {product.price.toFixed(2)} EUR
                        </div>
                        
                        {/* Verfügbare Stückanzahl für physische Produkte */}
                        {!product.isDigital && product.stock !== undefined && (
                          <div className="text-green-400 text-sm flex items-center gap-1.5">
                            <span>📦</span>
                            <span>Verfügbar: {product.stock} Stück</span>
                          </div>
                        )}
                        
                        {/* Stückanzahl für physische Produkte */}
                        {!product.isDigital && cart[product.id] && (
                          <div className="text-amber-300 text-sm flex items-center gap-1.5 mt-1">
                            <FaShoppingCart className="text-xs" />
                            <span>Im Warenkorb: {cart[product.id]} Stück</span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => addToCart(product.id)}
                        disabled={!canAddToCart(product)}
                        className={`${
                          canAddToCart(product)
                            ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        } flex items-center justify-center gap-1 px-4 py-2`}
                      >
                        <span className="text-lg font-bold">
                          {canAddToCart(product) ? "+" : "✕"}
                        </span>
                        <FaShoppingCart className="text-sm" />
                        {!canAddToCart(product) && (
                          <span className="text-xs ml-1">Ausverkauft</span>
                        )}
                      </Button>
                    </div>
                  )}
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
          <p className="text-gray-400 text-xl">
            <TranslatedText text="Keine Produkte in dieser Kategorie gefunden." language={language} />
          </p>
        </div>
      )}
      
      </div>

      {/* Warenkorb Sidebar - Erweitert mit D.FAITH Balance */}
      {showCart && (
        <div className="fixed inset-0 z-50 overflow-hidden" style={{ position: 'fixed' }}>
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setShowCart(false)}
          ></div>
          <div className="absolute right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-700 shadow-2xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-6 border-b border-zinc-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FaShoppingCart />
                    <TranslatedText text="Warenkorb" language={language} />
                  </h3>
                  <Button
                    onClick={() => setShowCart(false)}
                    className="bg-amber-900/80 hover:bg-amber-800/70 text-red-400 hover:text-red-300 border border-amber-700/50 hover:border-red-500 p-2 rounded-lg transition-all duration-200"
                  >
                    <FaTimes className="text-lg" />
                  </Button>
                </div>
                
                {/* D.FAITH Balance - Nur sichtbar wenn Warenkorb offen */}
                <div className="bg-amber-900/80/50 rounded-lg p-4 border border-amber-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FaCoins className="text-amber-400 text-sm" />
                    <span className="text-gray-300 text-sm font-medium">
                      <TranslatedText text="Ihr D.FAITH Guthaben" language={language} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-amber-400">{dfaithBalance}</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ {dfaithPriceEur > 0 ? `${(parseFloat(dfaithBalance) * dfaithPriceEur).toFixed(2)}€` : "Berechnung..."}
                  </div>
                </div>
              </div>
              
              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-6">
                {Object.keys(cart).length === 0 ? (
                  <div className="text-center py-12">
                    <FaShoppingCart className="text-4xl text-gray-600 mb-4 mx-auto" />
                    <p className="text-gray-400">
                      <TranslatedText text="Warenkorb ist leer" language={language} />
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(cart).map(([productId, quantity]) => {
                      const product = products.find(p => p.id === productId);
                      if (!product) return null;
                      
                      const dfaithPrice = convertEurToDfaith(product.price);
                      
                      return (
                        <div key={productId} className="bg-amber-900/80 rounded-lg p-4 border border-zinc-700">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="text-white font-medium text-sm">{product.name}</h4>
                              <div className="text-xs space-y-1 mt-2">
                                <p className="text-amber-400 font-bold">{dfaithPrice.toFixed(2)} D.FAITH</p>
                                <p className="text-gray-400 flex items-center gap-1">
                                  <FaEuroSign className="text-xs" />
                                  {product.price.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={() => removeFromCart(productId)}
                              className="bg-red-600 hover:bg-red-700 text-white p-2 text-xs"
                            >
                              <FaTimes />
                            </Button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Menge: {quantity}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer - Checkout */}
              {Object.keys(cart).length > 0 && (
                <div className="p-6 border-t border-zinc-700">
                  {/* Wallet-Verbindungswarnung */}
                  {!account?.address && (
                    <div className="mb-4 p-4 bg-red-900/30 border border-red-600/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <FaTimes className="text-red-400" />
                        <span className="text-red-300 font-semibold">
                          <TranslatedText text="Keine Wallet verbunden" language={language} />
                        </span>
                      </div>
                      <p className="text-red-200 text-sm">
                        <TranslatedText text="Sie müssen eine Wallet verbinden, um Produkte kaufen zu können." language={language} />
                      </p>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-white">Gesamt:</span>
                      <span className="text-amber-400">{getTotalPriceDfaith().toFixed(2)} D.FAITH</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={purchaseStatus === "pending" || !account?.address}
                  >
                    {purchaseStatus === "pending" ? (
                      <div className="flex items-center gap-2">
                        <FaSpinner className="animate-spin" />
                        Verarbeitung...
                      </div>
                    ) : !account?.address ? (
                      <>
                        Wallet verbinden erforderlich
                      </>
                    ) : (
                      <>
                        Zur Kasse
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ position: 'fixed' }}>
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setShowCheckout(false)}
          ></div>
          <div className="relative bg-zinc-900 border border-zinc-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">🛒 Kasse</h3>
                <Button
                  onClick={() => setShowCheckout(false)}
                  className="bg-amber-900/80 hover:bg-amber-800/70 text-red-400 hover:text-red-300 border border-amber-700/50 hover:border-red-500 p-2 rounded-lg transition-all duration-200"
                >
                  <FaTimes className="text-lg" />
                </Button>
              </div>

              {/* Bestellübersicht */}
              <div className="mb-6 p-4 bg-amber-900/80 rounded-lg">
                <h4 className="font-bold text-white mb-3">📋 Ihre Bestellung</h4>
                <div className="space-y-2">
                  {Object.entries(cart).map(([productId, quantity]) => {
                    const product = products.find(p => p.id === productId);
                    if (!product) return null;
                    
                    const dfaithPrice = convertEurToDfaith(product.price);
                    
                    return (
                      <div key={productId} className="flex justify-between items-center py-2 border-b border-amber-700/50 last:border-b-0">
                        <div>
                          <p className="text-white font-medium">{product.name}</p>
                          <p className="text-xs text-gray-400">Menge: {quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-amber-400 font-bold">{(dfaithPrice * quantity).toFixed(2)} D.FAITH</p>
                          <p className="text-xs text-gray-400">{(product.price * quantity).toFixed(2)}€</p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 mt-2 border-t border-amber-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Gesamt:</span>
                      <span className="text-amber-400 font-bold text-lg">{getTotalPriceDfaith().toFixed(2)} D.FAITH</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallet-Verbindungswarnung im Checkout */}
              {!account?.address && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-600/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FaTimes className="text-red-400 text-lg" />
                    <span className="text-red-300 font-semibold">Keine Wallet verbunden</span>
                  </div>
                  <p className="text-red-200 text-sm mb-3">
                    Um den Kauf abzuschließen, müssen Sie zunächst eine Wallet verbinden.
                  </p>
                  <p className="text-red-200 text-xs">
                    💡 Tipp: Verwenden Sie den Wallet-Tab, um eine Wallet zu erstellen oder zu verbinden.
                  </p>
                </div>
              )}

              {/* Formular */}
              <form onSubmit={(e) => { e.preventDefault(); handlePurchase(); }} className="space-y-4">
                {/* E-Mail */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    📧 <TranslatedText text="E-Mail-Adresse" language={language} /> *
                  </label>
                  <input
                    type="email"
                    required
                    value={checkoutForm.email}
                    onChange={(e) => setCheckoutForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-3 bg-amber-900/80 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
                    placeholder="ihre@email.de"
                  />
                </div>

                {/* Versandadresse bei physischen Produkten */}
                {hasPhysicalProducts() && (
                  <div className="space-y-4 p-4 bg-amber-900/80 rounded-lg">
                    <h4 className="font-bold text-white mb-3">📦 Versandadresse</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">Vorname *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.firstName}
                          onChange={(e) => setCheckoutForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
                          placeholder="Mustermann"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">
                        <TranslatedText text="Straße & Hausnummer" language={language} /> *
                      </label>
                      <input
                        type="text"
                        required
                        value={checkoutForm.street}
                        onChange={(e) => setCheckoutForm(prev => ({ ...prev, street: e.target.value }))}
                        className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
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
                          className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white focus:border-orange-400 focus:outline-none"
                          placeholder="Berlin"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-white font-medium mb-2">Land *</label>
                      <input
                        type="text"
                        required
                        value={checkoutForm.country}
                        onChange={(e) => setCheckoutForm(prev => ({ ...prev, country: e.target.value }))}
                        placeholder="Deutschland"
                        className="w-full p-3 bg-amber-800/70 border border-amber-700/50 rounded-lg text-white placeholder-gray-400 focus:border-orange-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Kaufen Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={purchaseStatus === "pending" || !account?.address}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {purchaseStatus === "pending" ? (
                      <div className="flex items-center justify-center gap-2">
                        <FaSpinner className="animate-spin" />
                        Transaktion läuft...
                      </div>
                    ) : (
                      <>
                        Zur Kasse ({getTotalPriceDfaith().toFixed(2)} D.FAITH)
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Erfolgs-Modal */}
      {showSuccessModal && successDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ position: 'fixed' }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
          <div className="relative bg-gradient-to-br from-green-900 to-emerald-800 border border-green-500/50 w-full max-w-lg mx-4 rounded-2xl shadow-2xl">
            <div className="p-8 text-center">
              {/* Erfolgs-Icon */}
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <FaCheck className="text-3xl text-white" />
              </div>
              
              {/* Hauptnachricht */}
              <h2 className="text-3xl font-bold text-white mb-4">
                🎉 <TranslatedText text="Kauf erfolgreich!" language={language} />
              </h2>
              
              <p className="text-green-100 text-lg mb-6">
                <TranslatedText text="Ihre Zahlung wurde erfolgreich verarbeitet und Ihre Bestellung wurde automatisch an unser System weitergeleitet." language={language} />
              </p>
              
              {/* Details */}
              <div className="bg-black/20 rounded-lg p-4 mb-6 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-200">Order-ID:</span>
                    <span className="text-white font-mono">{successDetails.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-200">Transaktion:</span>
                    <span className="text-white font-mono">{successDetails.transactionHash.substring(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-200">Artikel:</span>
                    <span className="text-white">{successDetails.itemCount} Stück</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-200">Bezahlt:</span>
                    <span className="text-amber-400 font-bold">{successDetails.totalPrice.toFixed(2)} D.FAITH</span>
                  </div>
                </div>
              </div>
              
              {/* Weitere Schritte */}
              <div className="bg-green-800/30 rounded-lg p-4 mb-6">
                <h3 className="text-white font-bold mb-2">
                  📧 <TranslatedText text="Nächste Schritte:" language={language} />
                </h3>
                <p className="text-green-100 text-sm">
                  {successDetails.hasPhysical 
                    ? "Sie erhalten eine Versandbestätigung per E-Mail, sobald Ihre Bestellung versendet wird."
                    : "Ihre Download-Links wurden bereits an Ihre E-Mail-Adresse gesendet."
                  }
                </p>
              </div>
              
              {/* Schließen Button */}
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    clearCart();
                    setPurchaseStatus("idle");
                    setSuccessDetails(null);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-bold"
                >
                  <TranslatedText text="Weiter einkaufen" language={language} />
                </Button>
                
                <button
                  onClick={() => window.open(`https://basescan.org/tx/${successDetails.transactionHash}`, '_blank')}
                  className="text-green-300 hover:text-green-200 text-sm underline"
                >
                  <TranslatedText text="Transaktion auf BaseScan anzeigen" language={language} /> →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}