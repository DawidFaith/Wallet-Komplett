'use client';

import React, { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import Modal from '../components/Modal';

interface CreateConcertModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  onCreated: () => void;
}

export default function CreateConcertModal({ open, onClose, walletAddress, onCreated }: CreateConcertModalProps) {
  const [form, setForm] = useState({ title: '', eventDate: '', venue: '', creditReward: 0, shardReward: 0, repReward: 0 });
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const blob = await upload(
        `concerts/${walletAddress}/${Date.now()}-${file.name}`,
        file,
        { access: 'public', handleUploadUrl: '/api/concerts/upload', clientPayload: JSON.stringify({ wallet: walletAddress }) },
      );
      setImageUrl(blob.url);
      setImagePreview(URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild-Upload fehlgeschlagen');
    } finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Titel ist Pflichtfeld'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/concerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: walletAddress, ...form, imageUrl: imageUrl || null }),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch { /* ignore parse error */ }
      if (!res.ok) { setError(data.error ?? `Fehler ${res.status}`); return; }
      setForm({ title: '', eventDate: '', venue: '', creditReward: 0, shardReward: 0, repReward: 0 });
      setImageUrl(''); setImagePreview('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Netzwerkfehler — Server nicht erreichbar');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="🎤 Konzert-Quest erstellen">
      <div className="space-y-4 p-1">
        <p className="text-zinc-500 text-xs">Fans sehen das Event im Quest-Board und können sich einchecken</p>

        {/* Bild */}
        <div>
          <label className="text-zinc-400 text-xs mb-1.5 block">Event-Bild (optional)</label>
          {imagePreview ? (
            <div className="relative w-full h-32 rounded-xl overflow-hidden">
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => { setImageUrl(''); setImagePreview(''); }}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
              >✕</button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center gap-1.5 w-full h-24 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${uploading ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-700 hover:border-green-500/50 hover:bg-green-500/5'}`}>
              <span className="text-2xl">{uploading ? '⏳' : '📷'}</span>
              <span className="text-zinc-500 text-xs">{uploading ? 'Wird hochgeladen…' : 'Bild auswählen'}</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Event-Titel *</label>
            <input
              className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="z.B. Release Party Berlin"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Datum &amp; Uhrzeit</label>
              <input
                type="datetime-local"
                className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-green-500"
                value={form.eventDate}
                onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Location</label>
              <input
                className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="z.B. Berghain"
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Belohnungen pro Teilnehmer</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <input
                  type="number" min="0" placeholder="Credits"
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-amber-500 pr-8"
                  value={form.creditReward || ''}
                  onChange={e => setForm(f => ({ ...f, creditReward: Number(e.target.value) || 0 }))}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 text-xs font-bold">C</span>
              </div>
              <div className="relative">
                <input
                  type="number" min="0" placeholder="Shards"
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-cyan-500 pr-7"
                  value={form.shardReward || ''}
                  onChange={e => setForm(f => ({ ...f, shardReward: Number(e.target.value) || 0 }))}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-400 text-xs font-bold">✦</span>
              </div>
              <div>
                <input
                  type="number" min="0" placeholder="REP"
                  className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm border border-white/[0.07] focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={form.repReward || ''}
                  onChange={e => setForm(f => ({ ...f, repReward: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            disabled={saving || uploading || !form.title.trim()}
            onClick={handleSubmit}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {saving ? 'Erstellen…' : '🎤 Event erstellen & aktivieren'}
          </button>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm px-4 rounded-xl transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}
