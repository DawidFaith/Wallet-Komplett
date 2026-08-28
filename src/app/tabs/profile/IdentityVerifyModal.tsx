'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FaIdCard, FaCamera, FaCheck, FaClock, FaTimes, FaSync } from 'react-icons/fa';
import type { Lang } from '../../utils/i18n';

interface IdentityVerifyModalProps {
  walletAddress: string;
  lang: Lang;
  onClose: () => void;
  onVerified?: () => void;
}

type Status = 'loading' | 'none' | 'pending' | 'approved' | 'rejected';

const STRINGS: Record<Lang, {
  title: string;
  why: string;
  idType: string;
  idTypePersonalausweis: string;
  idTypeReisepass: string;
  idTypeFuehrerschein: string;
  idNumber: string;
  idNumberPlaceholder: string;
  docPhoto: string;
  selfiePhoto: string;
  privacyHint: string;
  submit: string;
  submitting: string;
  pendingTitle: string;
  pendingBody: string;
  approvedTitle: string;
  approvedBody: string;
  rejectedTitle: string;
  resubmit: string;
  missingFields: string;
  networkError: string;
  close: string;
  altOption: string;
}> = {
  de: {
    title: 'Identität verifizieren',
    why: 'Um Missbrauch durch Mehrfach-Accounts zu verhindern, prüfen wir einmalig deine Identität, bevor du Credits einlösen, NFTs kaufen oder auf dem Marktplatz verkaufen kannst.',
    idType: 'Dokumenttyp',
    idTypePersonalausweis: 'Personalausweis',
    idTypeReisepass: 'Reisepass',
    idTypeFuehrerschein: 'Führerschein',
    idNumber: 'Ausweisnummer',
    idNumberPlaceholder: 'z.B. L01X00T47',
    docPhoto: 'Foto des Dokuments',
    selfiePhoto: 'Selfie mit dem Dokument',
    privacyHint: 'Deine Fotos werden nur zur Prüfung genutzt und danach sofort gelöscht. Es wird nur gespeichert, ob deine Identität verifiziert wurde.',
    submit: 'Zur Prüfung einreichen',
    submitting: 'Wird gesendet…',
    pendingTitle: 'In Prüfung',
    pendingBody: 'Deine Verifizierung wird geprüft. Das dauert in der Regel nicht lange.',
    approvedTitle: 'Verifiziert',
    approvedBody: 'Deine Identität wurde erfolgreich verifiziert.',
    rejectedTitle: 'Abgelehnt',
    resubmit: 'Erneut einreichen',
    missingFields: 'Bitte alle Felder ausfüllen und beide Fotos hochladen.',
    networkError: 'Netzwerkfehler. Bitte versuche es erneut.',
    close: 'Schließen',
    altOption: 'Geht nicht anders? Kontaktiere Dawid Faith (@dfaith_ecosystem) auf Instagram, TikTok oder Facebook — er kann deine Identität als letzte Option auch manuell bestätigen.',
  },
  en: {
    title: 'Verify your identity',
    why: 'To prevent abuse via multiple accounts, we verify your identity once before you can redeem credits, buy NFTs, or sell on the marketplace.',
    idType: 'Document type',
    idTypePersonalausweis: 'National ID card',
    idTypeReisepass: 'Passport',
    idTypeFuehrerschein: "Driver's license",
    idNumber: 'Document number',
    idNumberPlaceholder: 'e.g. L01X00T47',
    docPhoto: 'Photo of the document',
    selfiePhoto: 'Selfie holding the document',
    privacyHint: 'Your photos are only used for review and deleted immediately afterwards. We only store whether your identity was verified.',
    submit: 'Submit for review',
    submitting: 'Submitting…',
    pendingTitle: 'Under review',
    pendingBody: 'Your verification is being reviewed. This usually doesn’t take long.',
    approvedTitle: 'Verified',
    approvedBody: 'Your identity has been successfully verified.',
    rejectedTitle: 'Rejected',
    resubmit: 'Resubmit',
    missingFields: 'Please fill in all fields and upload both photos.',
    networkError: 'Network error. Please try again.',
    close: 'Close',
    altOption: "Can't do this right now? Contact Dawid Faith (@dfaith_ecosystem) on Instagram, TikTok, or Facebook — as a last option, he can confirm your identity manually.",
  },
  pl: {
    title: 'Zweryfikuj swoją tożsamość',
    why: 'Aby zapobiec nadużyciom poprzez wiele kont, jednorazowo weryfikujemy Twoją tożsamość, zanim będziesz mógł/mogła wymieniać kredyty, kupować NFT lub sprzedawać na rynku.',
    idType: 'Typ dokumentu',
    idTypePersonalausweis: 'Dowód osobisty',
    idTypeReisepass: 'Paszport',
    idTypeFuehrerschein: 'Prawo jazdy',
    idNumber: 'Numer dokumentu',
    idNumberPlaceholder: 'np. L01X00T47',
    docPhoto: 'Zdjęcie dokumentu',
    selfiePhoto: 'Selfie z dokumentem',
    privacyHint: 'Twoje zdjęcia są używane wyłącznie do weryfikacji i natychmiast potem usuwane. Zapisujemy tylko informację, czy Twoja tożsamość została zweryfikowana.',
    submit: 'Wyślij do weryfikacji',
    submitting: 'Wysyłanie…',
    pendingTitle: 'W trakcie weryfikacji',
    pendingBody: 'Twoja weryfikacja jest sprawdzana. Zwykle nie trwa to długo.',
    approvedTitle: 'Zweryfikowano',
    approvedBody: 'Twoja tożsamość została pomyślnie zweryfikowana.',
    rejectedTitle: 'Odrzucono',
    resubmit: 'Wyślij ponownie',
    missingFields: 'Wypełnij wszystkie pola i prześlij oba zdjęcia.',
    networkError: 'Błąd sieci. Spróbuj ponownie.',
    close: 'Zamknij',
    altOption: 'Nie możesz teraz? Skontaktuj się z Dawidem Faith (@dfaith_ecosystem) na Instagramie, TikToku lub Facebooku — jako ostatnia opcja może on potwierdzić Twoją tożsamość ręcznie.',
  },
};

/** Verkleinert/komprimiert ein Bild client-seitig (max. 1600px Kante, JPEG q=0.8) vor dem Upload. */
function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image decode failed'));
      img.onload = () => {
        const maxEdge = 1600;
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
          const scale = maxEdge / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas unsupported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1] ?? '');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function IdentityVerifyModal({ walletAddress, lang, onClose, onVerified }: IdentityVerifyModalProps) {
  const s = STRINGS[lang];
  const [status, setStatus] = useState<Status>('loading');
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);
  const [idType, setIdType] = useState<'personalausweis' | 'reisepass' | 'fuehrerschein'>('personalausweis');
  const [idNumber, setIdNumber] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/identity/status?walletAddress=${encodeURIComponent(walletAddress)}`);
      const data = await res.json();
      if (!res.ok) { setStatus('none'); return; }
      setStatus(data.status as Status);
      setRejectionReason(data.rejectionReason);
    } catch {
      setStatus('none');
    }
  }, [walletAddress]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleSubmit = async () => {
    if (!idNumber.trim() || !docFile || !selfieFile) {
      setError(s.missingFields);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const [docImageBase64, selfieImageBase64] = await Promise.all([
        compressImageToBase64(docFile),
        compressImageToBase64(selfieFile),
      ]);
      const res = await fetch('/api/identity/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, idType, idNumber: idNumber.trim(), docImageBase64, selfieImageBase64 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? s.networkError); return; }
      setStatus('pending');
      onVerified?.();
    } catch {
      setError(s.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <FaIdCard size={20} className="text-yellow-400" />
            <span className="text-white font-bold">{s.title}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {status === 'loading' && (
            <div className="flex justify-center py-8">
              <FaSync className="animate-spin text-zinc-500" size={20} />
            </div>
          )}

          {status === 'pending' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-yellow-900/30 flex items-center justify-center">
                <FaClock className="text-yellow-400" size={22} />
              </div>
              <p className="text-white font-semibold">{s.pendingTitle}</p>
              <p className="text-zinc-400 text-sm">{s.pendingBody}</p>
              <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                {s.close}
              </button>
            </div>
          )}

          {status === 'approved' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-900/30 flex items-center justify-center">
                <FaCheck className="text-green-400" size={22} />
              </div>
              <p className="text-white font-semibold">{s.approvedTitle}</p>
              <p className="text-zinc-400 text-sm">{s.approvedBody}</p>
              <button onClick={onClose} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                {s.close}
              </button>
            </div>
          )}

          {(status === 'none' || status === 'rejected') && (
            <div className="space-y-4">
              {status === 'rejected' && (
                <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-3 flex items-start gap-2">
                  <FaTimes className="text-red-400 shrink-0 mt-0.5" size={13} />
                  <div>
                    <p className="text-red-300 font-semibold text-sm">{s.rejectedTitle}</p>
                    {rejectionReason && <p className="text-red-400/80 text-xs mt-0.5">{rejectionReason}</p>}
                  </div>
                </div>
              )}

              <p className="text-zinc-400 text-sm">{s.why}</p>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">{s.idType}</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as typeof idType)}
                  className="w-full mt-1.5 bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-yellow-500 focus:outline-none text-sm"
                >
                  <option value="personalausweis">{s.idTypePersonalausweis}</option>
                  <option value="reisepass">{s.idTypeReisepass}</option>
                  <option value="fuehrerschein">{s.idTypeFuehrerschein}</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">{s.idNumber}</label>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={s.idNumberPlaceholder}
                  className="w-full mt-1.5 bg-zinc-800 text-white rounded-xl px-4 py-3 border border-zinc-700 focus:border-yellow-500 focus:outline-none text-sm placeholder-zinc-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">{s.docPhoto}</label>
                <label className="mt-1.5 flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 cursor-pointer hover:border-yellow-500 transition-colors">
                  <FaCamera className="text-zinc-500 shrink-0" size={16} />
                  <span className="text-zinc-300 text-sm truncate">{docFile?.name ?? '—'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">{s.selfiePhoto}</label>
                <label className="mt-1.5 flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 cursor-pointer hover:border-yellow-500 transition-colors">
                  <FaCamera className="text-zinc-500 shrink-0" size={16} />
                  <span className="text-zinc-300 text-sm truncate">{selfieFile?.name ?? '—'}</span>
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              <p className="text-zinc-500 text-xs">{s.privacyHint}</p>

              <p className="text-zinc-500 text-xs bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3">{s.altOption}</p>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {submitting ? <FaSync className="animate-spin" size={13} /> : <FaIdCard size={14} />}
                {submitting ? s.submitting : status === 'rejected' ? s.resubmit : s.submit}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
