'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaMusic, FaCheckCircle, FaChevronRight, FaFire } from 'react-icons/fa';

interface Artist {
  walletAddress: string;
  name: string;
  picture: string | null;
  questCount: number;
}

interface EcosystemStats {
  openQuests: number;
}

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<'fan' | 'artist'>('fan');
  const [applied, setApplied] = useState(false);
  const [sending, setSending] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [artistSocial, setArtistSocial] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState<EcosystemStats>({ openQuests: 0 });

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    fetch('/api/admin/artists')
      .then((r) => r.json())
      .then((d) => {
        setArtists(d.artists ?? []);
        if (d.stats) setStats(d.stats);
      })
      .catch(() => {});
  }, []);

  if (!isLoaded || isSignedIn) {
    return (
      <main className="min-h-screen bg-[#0a0908] flex items-center justify-center">
        <div className="border-2 border-white/10 border-t-amber-400 rounded-full w-10 h-10 animate-spin" />
      </main>
    );
  }

  const handleApply = async () => {
    if (!artistName.trim()) return;
    setSending(true);
    try {
      await fetch('/api/artist-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artistName, social: artistSocial }),
      });
    } catch (_) {}
    setSending(false);
    setApplied(true);
  };

  const totalQuests = artists.reduce((s, a) => s + (a.questCount || 0), 0);

  const fanFeatures = [
    { n: '01', title: 'Social verknüpfen', desc: 'Verbinde Instagram, TikTok, YouTube & Facebook für maximale Rewards.' },
    { n: '02', title: 'Quests erfüllen', desc: 'Absolviere Aufgaben deines Künstlers und erhalte echte Token direkt in dein Wallet.' },
    { n: '03', title: 'Exklusive Vorteile', desc: 'Frühzugang zu Songs, limitiertem Merch und mehr für aktive Supporter.' },
    { n: '04', title: 'Leaderboard & XP', desc: 'Sammle Punkte, steige auf und löse sie gegen Belohnungen ein.' },
  ];

  const artistFeatures = [
    { n: '01', title: 'Eigene Wallet & Token', desc: 'Dein eigenes Solana Wallet und Token für deine Community.' },
    { n: '02', title: 'Quest System', desc: 'Erstelle eigene Aufgaben mit individuellen Rewards für deine Fans.' },
    { n: '03', title: 'Merch & Content Drops', desc: 'Exklusive Drops nur für deine aktivsten Supporter.' },
  ];

  return (
    <main className="bg-[#0a0908] text-white min-h-screen">

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 h-14 bg-[#0a0908]/90 backdrop-blur-lg border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <Image src="/D.FAITH.png" alt="" width={24} height={24} className="rounded-lg" priority />
          <div className="leading-none">
            <div className="text-[11px] font-black tracking-[0.3em] uppercase text-white">D.FAITH</div>
            <div className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/30 mt-px">Ecosystem</div>
          </div>
        </div>
        <SignInButton mode="modal">
          <button className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-600 hover:text-amber-400 transition-colors">
            Login
          </button>
        </SignInButton>
      </nav>

      {/* ── MAIN LAYOUT: stacked on mobile, side-by-side on desktop ── */}
      <div className="min-h-[100svh] flex flex-col lg:flex-row lg:items-stretch pt-14">

        {/* ── LEFT COLUMN: brand + headline (desktop: fixed left half) ── */}
        <div className="flex flex-col justify-between px-6 py-10 lg:py-16 lg:px-14 lg:w-1/2 lg:min-h-[calc(100svh-3.5rem)] lg:sticky lg:top-14 lg:self-start">

          {/* Headline block */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-[clamp(2.6rem,7vw,4.5rem)] font-black leading-[1.0] tracking-tight mb-5">
              Sei dabei.<br />
              Supporte deine<br />
              <span className="text-amber-400">Künstler.</span><br />
              Werde belohnt.
            </h1>

            <p className="text-[clamp(12px,1.5vw,15px)] text-zinc-500 leading-relaxed mb-1 max-w-[360px]">
              Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.
            </p>
            <p className="text-xs text-zinc-700 font-medium tracking-widest mb-8 lg:mb-10">— Dawid Faith</p>

            {/* Quest hint */}
            {stats.openQuests > 0 && (
              <div className="flex items-center gap-2 mb-8">
                <FaFire size={11} className="text-amber-400" />
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400">
                  {stats.openQuests} {stats.openQuests === 1 ? 'Quest' : 'Quests'} verfügbar
                </span>
              </div>
            )}

            {/* Active Artists */}
            {artists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">
                    Aktive Künstler
                  </span>
                  {totalQuests > 0 && (
                    <>
                      <span className="text-zinc-800">·</span>
                      <span className="text-[9px] font-black tracking-[0.2em] uppercase text-amber-500">
                        {totalQuests} offen
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {artists.slice(0, 8).map((a) => (
                    <div
                      key={a.walletAddress}
                      className="relative flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] transition-colors rounded-full pl-0.5 pr-2.5 py-0.5 cursor-default"
                    >
                      {a.picture ? (
                        <img src={a.picture} alt={a.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <FaMusic size={9} className="text-zinc-600" />
                        </div>
                      )}
                      <span className="text-[10px] font-semibold text-zinc-300 truncate max-w-[80px]">{a.name}</span>
                      {a.questCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center ring-1 ring-[#0a0908]">
                          {a.questCount > 9 ? '9+' : a.questCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA — mobile only (desktop CTA is in right column) */}
          <div className="lg:hidden space-y-2.5 mt-10">
            <SignUpButton mode="modal">
              <button className="w-full py-[14px] bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-black text-sm tracking-[0.08em] uppercase rounded-2xl transition-all">
                Kostenlos starten
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full py-3 text-zinc-600 hover:text-zinc-300 font-semibold text-[11px] tracking-[0.2em] uppercase transition-colors">
                Bereits registriert? Einloggen
              </button>
            </SignInButton>
          </div>
        </div>

        {/* ── VERTICAL DIVIDER (desktop only) ── */}
        <div className="hidden lg:block w-px bg-white/[0.06] self-stretch" />
        {/* ── HORIZONTAL DIVIDER (mobile only) ── */}
        <div className="lg:hidden h-px bg-white/[0.06] mx-6" />

        {/* ── RIGHT COLUMN: features + apply + desktop CTA ── */}
        <div className="flex flex-col px-6 py-10 lg:py-16 lg:px-14 lg:w-1/2">

          {/* Desktop CTA at top of right column */}
          <div className="hidden lg:flex flex-col gap-2.5 mb-10">
            <SignUpButton mode="modal">
              <button className="w-full py-[14px] bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-black text-sm tracking-[0.08em] uppercase rounded-2xl transition-all">
                Kostenlos starten
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full py-3 border border-white/[0.07] hover:border-amber-400/20 text-zinc-600 hover:text-zinc-300 font-semibold text-[11px] tracking-[0.2em] uppercase transition-all rounded-xl">
                Bereits registriert? Einloggen
              </button>
            </SignInButton>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-5 border-b border-white/[0.07] mb-7 pb-0">
            {(['fan', 'artist'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-[11px] font-black tracking-[0.25em] uppercase border-b-2 transition-all -mb-px ${
                  tab === t
                    ? 'border-amber-400 text-white'
                    : 'border-transparent text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {t === 'fan' ? 'Für Fans' : 'Für Künstler'}
              </button>
            ))}
          </div>

          {tab === 'fan' ? (
            <div className="space-y-5">
              {fanFeatures.map((f) => (
                <div key={f.n} className="flex gap-4 items-start">
                  <span className="text-[10px] font-black text-amber-400/50 w-6 shrink-0 pt-0.5">{f.n}</span>
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5">{f.title}</p>
                    <p className="text-xs text-zinc-600 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {!applied ? (
                <div className="space-y-5">
                  {artistFeatures.map((f) => (
                    <div key={f.n} className="flex gap-4 items-start">
                      <span className="text-[10px] font-black text-amber-400/50 w-6 shrink-0 pt-0.5">{f.n}</span>
                      <div>
                        <p className="text-sm font-bold text-white mb-0.5">{f.title}</p>
                        <p className="text-xs text-zinc-600 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2.5 pt-2">
                    <div>
                      <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-700 mb-1.5 block">
                        Künstlername *
                      </label>
                      <input
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        placeholder="Dein Name"
                        className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-amber-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-700 mb-1.5 block">
                        Social Link
                      </label>
                      <input
                        value={artistSocial}
                        onChange={(e) => setArtistSocial(e.target.value)}
                        placeholder="instagram.com/…"
                        className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-amber-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={handleApply}
                      disabled={!artistName.trim() || sending}
                      className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-20 disabled:cursor-not-allowed text-black font-black text-xs tracking-[0.1em] uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {sending ? 'Sende…' : <>Interesse anmelden <FaChevronRight size={9} /></>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-14 text-center">
                  <FaCheckCircle size={30} className="text-amber-400 mx-auto mb-4" />
                  <p className="font-black text-white mb-2">Danke, {artistName}!</p>
                  <p className="text-zinc-600 text-sm">Wir melden uns so schnell wie möglich.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="h-px bg-white/[0.04]" />
      <footer className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/D.FAITH.png" alt="" width={12} height={12} className="rounded opacity-25" />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-800">D.FAITH Ecosystem</span>
        </div>
        <span className="text-[9px] text-zinc-800">© 2025</span>
      </footer>

    </main>
  );
}
