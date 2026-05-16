'use client';

import { useState } from 'react';

export default function DmQuestPage() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [rewardAmount, setRewardAmount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().toLowerCase().replace(/^@/, '');
    if (!h) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/instagram-quests/dm-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: h }),
      });
      const data = await res.json();
      if ((res.ok && data.success) || data.alreadyDone) {
        setRewardAmount(data.rewardAmount ?? 0);
        setMessage(data.message ?? 'Quest abgeschlossen!');
        setResult('success');
      } else {
        setMessage(data.error ?? 'Kein aktiver Quest gefunden.');
        setResult('error');
      }
    } catch {
      setMessage('Netzwerkfehler. Bitte erneut versuchen.');
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📸</div>
          <h1 className="text-xl font-bold text-white">Instagram Quest</h1>
          <p className="text-sm text-zinc-400 mt-1">Story-Share Belohnung einlösen</p>
        </div>

        {result === 'success' ? (
          <div className="bg-zinc-900 border border-green-600/40 rounded-2xl p-6 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-lg font-bold text-green-400">Quest abgeschlossen!</h2>
            {rewardAmount > 0 && (
              <p className="text-sm text-zinc-300">
                <span className="text-green-400 font-semibold">+{rewardAmount} DFAITH</span> Credits wurden gutgeschrieben.
              </p>
            )}
            <p className="text-xs text-zinc-500">{message}</p>
            <p className="text-xs text-zinc-600 mt-2">Du kannst diese Seite schließen.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed">
              Du hast den DM-Link erhalten? Super! Gib deinen Instagram-Handle ein um die Belohnung zu erhalten.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="handle" className="block text-xs text-zinc-400 mb-1.5">
                  Instagram Handle
                </label>
                <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 focus-within:border-pink-500 transition-colors">
                  <span className="text-zinc-500 text-sm mr-1">@</span>
                  <input
                    id="handle"
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="deinhandle"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>

              {result === 'error' && (
                <div className="bg-red-950/40 border border-red-700/40 rounded-xl px-3 py-2 text-xs text-red-400">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !handle.trim()}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Wird geprüft…
                  </>
                ) : (
                  'Quest abschließen ✓'
                )}
              </button>
            </form>

            <p className="text-xs text-zinc-600 text-center">
              Du musst zuerst den Story-Share in der App bestätigt haben.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
