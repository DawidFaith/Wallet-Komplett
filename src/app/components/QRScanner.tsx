"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { FaCamera, FaTimes } from "react-icons/fa";

interface QRScannerProps {
  isOpen: boolean;
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function QRScanner({ isOpen, onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanner, setScanner] = useState<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const reader = new BrowserMultiFormatReader();
      setScanner(reader);
      startScanning(reader);
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async (reader: BrowserMultiFormatReader) => {
    try {
      setError(null);
      setIsScanning(true);

      // Kamera-Zugriff anfordern
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } // Rückseitige Kamera bevorzugen
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // QR-Code-Scanning starten
        reader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
          if (result) {
            const text = result.getText();
            // Überprüfen ob es eine gültige Ethereum-Adresse ist
            if (text && (text.startsWith('0x') || text.startsWith('ethereum:'))) {
              let address = text;
              // Ethereum URI Format handhaben (ethereum:0x...)
              if (text.startsWith('ethereum:')) {
                address = text.replace('ethereum:', '').split('?')[0];
              }
              onScan(address);
              stopScanning();
            }
          }
          if (error && error.name !== 'NotFoundException') {
            console.error('QR Scanner Error:', error);
          }
        });
      }
    } catch (err: any) {
      console.error('Kamera-Zugriff fehlgeschlagen:', err);
      setError('Kamera-Zugriff fehlgeschlagen. Bitte erlaube den Kamera-Zugriff.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    // Video-Stream stoppen
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-zinc-900 rounded-xl p-4 max-w-sm w-full border border-amber-400">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FaCamera className="text-amber-400" />
            QR-Code scannen
          </h3>
          <button
            onClick={onClose}
            className="text-amber-400 hover:text-yellow-300 p-2 rounded-lg hover:bg-zinc-800 transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Scanner Bereich */}
        <div className="space-y-4">
          {error ? (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center">
              <div className="text-red-400 text-sm mb-2">❌ {error}</div>
              <button
                onClick={() => startScanning(scanner!)}
                className="bg-amber-400 text-black px-4 py-2 rounded-lg font-medium hover:bg-amber-500 transition-all"
              >
                Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 bg-black rounded-xl object-cover"
              />
              
              {/* Scan-Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Scan-Rahmen */}
                <div className="absolute inset-4 border-2 border-amber-400 rounded-xl">
                  {/* Ecken */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 border-amber-400"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 border-amber-400"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 border-amber-400"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 border-amber-400"></div>
                </div>
                
                {/* Scan-Linie */}
                {isScanning && (
                  <div className="absolute inset-4 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Anweisungen */}
          <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
            <div className="text-zinc-300 text-sm text-center">
              <div className="text-amber-400 font-medium mb-1">📱 QR-Code scannen</div>
              <div>Richte die Kamera auf den QR-Code der Wallet-Adresse</div>
            </div>
          </div>

          {/* Abbrechen Button */}
          <button
            onClick={onClose}
            className="w-full bg-zinc-700 text-white py-3 rounded-xl font-medium hover:bg-zinc-600 transition-all"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
