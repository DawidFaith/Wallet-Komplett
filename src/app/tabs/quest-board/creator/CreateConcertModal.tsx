'use client';

import React, { useState } from 'react';
import Modal from '../components/Modal';

interface CreateConcertModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  onCreated: () => void;
}

export default function CreateConcertModal({ open, onClose, walletAddress, onCreated }: CreateConcertModalProps) {
  const [form, setForm] = useState({ title: '', eventDate: '', venue: '', creditReward: 0, shardReward: 0, repReward: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Titel ist Pflichtfeld'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/concerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: walletAddress, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler beim Erstellen'); return; }
      setForm({ title: '', eventDate: '', venue: '', creditReward: 0, shardReward: 0, repReward: 0 });
      onCreated();
      onClose();
    } catch { setError('Netzwerkfehler'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="🎤 Konzert-Quest erstellen">
      <div className="space-y-4 p-1">
        <p className="text-zinc-500 text-xs">Fans sehen das Event im Quest-Board und können sich einchecken</p>

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

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            disabled={saving || !form.title.trim()}
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
