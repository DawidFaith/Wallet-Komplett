'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaRocket, FaArrowRight, FaBolt, FaLock,
  FaGift, FaStar, FaMusic, FaCheckCircle, FaChevronRight,
  FaFire,
} from 'react-icons/fa';

interface Artist {
  walletAddress: string;
  name: string;
  picture: string | null;
  artistType: string | null;
  questCount: number;
}

interface EcosystemStats {
  artistCount: number;
  openQuests: number;
  openRewards: number;
}

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<'fan' | 'artist'>('fan');
  const [applied, setApplied] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [artistSocial, setArtistSocial] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState<EcosystemStats>({ artistCount: 0, openQuests: 0, openRewards: 0 });

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/home');
    }
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
      <main className="min-h-screen bg-[#0d0c0a] flex items-center justify-center">
        <div className="border-2 border-white/10 border-t-amber-400 rounded-full w-10 h-10 animate-spin" />
      </main>
    );
  }

  const handleApply = () => {
    if (!artistName.trim()) return;
    setApplied(true);
  };

  const totalQuestsForUser = artists.reduce((acc, a) => acc + (a.questCount || 0), 0);

  return (
    <main className="min-h-screen bg-[#0d0c0a] text-white overflow-x-hidden selection:bg-amber-400/30">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3 bg-[#0d0c0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-400/40 blur-md rounded-full" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-[1.5px]">
              <div className="w-full h-full rounded-[6px] bg-[#0d0c0a] flex items-center justify-center overflow-hidden">
                <Image src="/D.FAITH.png" alt="" width={24} height={24} className="object-cover" />
              </div>
            </div>
          </div>
          <div className="leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-[13px] tracking-[0.18em] uppercase bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                D.FAITH
              </span>
              <span className="text-[8px] bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-sm px-1 py-[1px] font-bold tracking-widest uppercase">
                Beta
              </span>
            </div>
            <span className="text-[8px] text-zinc-500 tracking-[0.3em] uppercase font-semibold mt-0.5 block">
              Ecosystem
            </span>
          </div>
        </div>
        <SignInButton mode="modal">
          <button className="text-[11px] text-zinc-400 hover:text-amber-300 transition-colors uppercase tracking-[0.18em] font-semibold">
            Login
          </button>
        </SignInButton>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[100svh] flex flex-col overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#0d0c0a]" />
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-amber-500/[0.08] rounded-full blur-[100px]" />
          <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/15 rounded-full blur-[55px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#0d0c0a] via-[#0d0c0a]/80 to-transparent" />
        </div>

        {/* Brand Headline: Token + D.FAITH Ecosystem */}
        <div className="relative z-10 flex flex-col items-center pt-24 pb-2 px-6 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Token */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl border border-amber-400/20 scale-[1.35] animate-[ping_3s_ease-in-out_infinite]" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-[2px] bg-gradient-to-br from-amber-200 via-amber-500 to-amber-800 shadow-[0_0_40px_rgba(251,191,36,0.35)]">
                <div className="w-full h-full rounded-[14px] bg-[#0d0c0a] flex items-center justify-center overflow-hidden">
                  <Image
                    src="/D.FAITH.png"
                    alt="D.FAITH"
                    width={80}
                    height={80}
                    className="w-[88%] h-[88%] object-cover rounded-xl"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Headline */}
            <h1 className="flex flex-col leading-none">
              <span className="text-[26px] sm:text-[34px] font-black tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                D.FAITH
              </span>
              <span className="text-[14px] sm:text-[18px] font-black tracking-[0.32em] uppercase text-white/90 mt-1">
                Ecosystem
              </span>
            </h1>
          </div>

          {/* Live + Quest counter pill — direkt neben/unter der Headline */}
          <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1.5 bg-[#0d0c0a] border border-emerald-400/30 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-black tracking-[0.25em] uppercase text-emerald-300">Live</span>
            </span>
            {stats.openQuests > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-amber-400/15 border border-amber-400/30 rounded-full px-2.5 py-1">
                <FaFire size={10} className="text-amber-400" />
                <span className="text-[10px] font-black tracking-[0.18em] uppercase text-amber-300">
                  {stats.openQuests} {stats.openQuests === 1 ? 'Quest' : 'Quests'} verfügbar
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Text content */}
        <div className="relative z-10 flex flex-col justify-end flex-1 px-6 pb-8 max-w-lg mx-auto w-full">
          <div className="mb-6">
            <h2 className="text-[2.1rem] sm:text-5xl font-black leading-[1.05] tracking-tight mb-3">
              Supporte
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                deine Künstler.
              </span>
              <br />
              Werde belohnt.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              Das <span className="text-amber-300 font-semibold">D.FAITH Ecosystem</span> verbindet Künstler und Fans —
              mit echten Token-Belohnungen, eigenen Quests und einer Community, die zählt.
            </p>
          </div>

          {/* Active Artists — interaktiv, direkt im Hero */}
          {artists.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <p className="text-[10px] font-black tracking-[0.28em] uppercase text-white">
                    Aktive Künstler
                  </p>
                  <span className="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5 font-bold">
                    {artists.length}
                  </span>
                </div>
                {totalQuestsForUser > 0 && (
                  <div className="flex items-center gap-1 bg-amber-400/15 border border-amber-400/30 rounded-full px-2 py-1">
                    <FaFire size={9} className="text-amber-400" />
                    <span className="text-[9px] font-black tracking-[0.15em] uppercase text-amber-300">
                      {totalQuestsForUser} offen
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {artists.map((a) => (
                  <button
                    key={a.walletAddress}
                    onClick={() => {
                      const el = document.getElementById('cta-block');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="flex flex-col items-center gap-1.5 shrink-0 w-[76px] group focus:outline-none"
                  >
                    <div className="relative">
                      {a.questCount > 0 && (
                        <span className="absolute inset-0 rounded-full border-2 border-amber-400/50 scale-110 animate-pulse" />
                      )}
                      {a.picture ? (
                        <img
                          src={a.picture}
                          alt={a.name}
                          className={`w-14 h-14 rounded-full object-cover border-2 transition-transform group-hover:scale-105 group-active:scale-95 ${
                            a.questCount > 0
                              ? 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.4)]'
                              : 'border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-14 h-14 rounded-full border-2 bg-amber-500/10 flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95 ${
                            a.questCount > 0
                              ? 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.4)]'
                              : 'border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                          }`}
                        >
                          <FaMusic size={18} className="text-amber-400/70" />
                        </div>
                      )}
                      {a.questCount > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-300 to-amber-500 text-black text-[9px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-2 ring-[#0d0c0a]">
                          {a.questCount > 99 ? '99+' : a.questCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-200 text-center leading-tight line-clamp-2 max-w-full font-semibold">
                      {a.name}
                    </p>
                    {a.questCount > 0 && (
                      <span className="text-[8px] font-bold tracking-wider uppercase text-amber-400 leading-none">
                        {a.questCount} Quest{a.questCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toggle */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-full p-1 w-fit backdrop-blur-sm">
            <button
              onClick={() => setTab('fan')}
              className={`px-5 py-2 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase transition-all ${
                tab === 'fan'
                  ? 'bg-gradient-to-r from-amber-300 to-amber-500 text-black shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ich bin Fan
            </button>
            <button
              onClick={() => setTab('artist')}
              className={`px-5 py-2 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase transition-all ${
                tab === 'artist'
                  ? 'bg-gradient-to-r from-amber-300 to-amber-500 text-black shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ich bin Künstler
            </button>
          </div>
        </div>
      </section>

      {/* Dynamic Content */}
      <section className="relative z-10 px-6 pb-20 max-w-lg mx-auto pt-0">

        {tab === 'fan' ? (
          <div id="cta-block" className="space-y-3">
            <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-gradient-to-b from-amber-300 to-amber-500 rounded-full" />
                <p className="text-[10px] font-black tracking-[0.28em] uppercase text-white">Für Fans</p>
              </div>
              <div className="space-y-4">
                {[
                  {
                    icon: <FaBolt size={15} className="text-amber-400" />,
                    title: 'Erfülle Aufgaben deines Künstlers',
                    desc: 'Absolviere Quests und erhalte dafür echte Belohnungen direkt in dein Wallet.',
                  },
                  {
                    icon: <FaLock size={15} className="text-amber-400" />,
                    title: 'Frühzugang zu Songs & limitiertem Merch',
                    desc: 'Als aktiver Fan erhältst du exklusiven Zugang vor allen anderen.',
                  },
                  {
                    icon: <FaGift size={15} className="text-amber-400" />,
                    title: 'Dein Engagement wird belohnt',
                    desc: 'Sammle XP, steige im Leaderboard auf und löse Punkte gegen Rewards ein.',
                  },
                  {
                    icon: <FaStar size={15} className="text-amber-400" />,
                    title: 'Social Quests',
                    desc: 'Verknüpfe Instagram, TikTok, YouTube & Facebook für maximale Belohnungen.',
                  },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3 items-start">
                    <div className="mt-0.5 w-8 h-8 bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-snug">{f.title}</p>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust row removed */}

            <SignUpButton mode="modal">
              <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:via-amber-300 hover:to-amber-400 text-black font-black py-3.5 rounded-xl text-sm transition-all tracking-[0.15em] uppercase shadow-[0_8px_28px_rgba(251,191,36,0.35)]">
                <FaRocket size={12} />
                Jetzt kostenlos starten
              </button>
            </SignUpButton>

            <SignInButton mode="modal">
              <button className="w-full flex items-center justify-center gap-1.5 text-zinc-400 hover:text-amber-300 text-xs py-2 transition-colors">
                Bereits registriert? Einloggen
                <FaArrowRight size={9} />
              </button>
            </SignInButton>
          </div>

        ) : (
          <div>
            {!applied ? (
              <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <FaMusic size={13} className="text-amber-400" />
                  <h2 className="font-black text-sm text-white uppercase tracking-[0.18em]">Künstler Bewerbung</h2>
                </div>
                <p className="text-zinc-400 text-xs mb-5 leading-relaxed">
                  Baue deine eigene Community mit Quests, eigenem Token und Rewards. Bewirb dich jetzt für einen Platz im Ecosystem.
                </p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase tracking-[0.18em] font-bold mb-1 block">
                      Dein Künstlername *
                    </label>
                    <input
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="z.B. Dawid Faith"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase tracking-[0.18em] font-bold mb-1 block">
                      Social Media Link
                    </label>
                    <input
                      value={artistSocial}
                      onChange={(e) => setArtistSocial(e.target.value)}
                      placeholder="instagram.com/deinname"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  {[
                    'Eigene Solana Wallet & D.FAITH Token',
                    'Quest System für deine Fanbase',
                    'Merch & exklusive Content-Drops',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                      <FaCheckCircle size={10} className="text-amber-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApply}
                  disabled={!artistName.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:via-amber-300 hover:to-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black py-3 rounded-xl text-sm transition-all tracking-[0.15em] uppercase shadow-[0_8px_28px_rgba(251,191,36,0.3)]"
                >
                  Interesse anmelden
                  <FaChevronRight size={11} />
                </button>
              </div>
            ) : (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8 text-center">
                <FaCheckCircle size={34} className="text-amber-400 mx-auto mb-3" />
                <h3 className="font-bold text-white text-base mb-2">Danke, {artistName}!</h3>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                  Deine Bewerbung ist bei uns eingegangen. Wir melden uns so schnell wie möglich bei dir.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Image src="/D.FAITH.png" alt="" width={16} height={16} className="rounded-full opacity-50" />
          <span className="text-zinc-500 text-[10px] tracking-[0.28em] uppercase font-bold">
            D.FAITH Ecosystem · Beta
          </span>
        </div>
        <p className="text-zinc-600 text-[10px]">© 2025 · Alle Rechte vorbehalten</p>
      </footer>

    </main>
  );
}
