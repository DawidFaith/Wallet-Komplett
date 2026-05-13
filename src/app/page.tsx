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
  artistType: string | null;
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

  const handleApply = () => { if (artistName.trim()) setApplied(true); };
  const totalQuests = artists.reduce((s, a) => s + (a.questCount || 0), 0);

  return (
    <main className="min-h-screen bg-[#0a0908] text-white">

      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 h-14 bg-[#0a0908]/90 backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <Image src="/D.FAITH.png" alt="" width={22} height={22} className="rounded-md" />
          <span className="text-xs font-black tracking-[0.3em] uppercase text-white">D.FAITH</span>
          <span className="text-xs font-black tracking-[0.3em] uppercase text-white/30">Ecosystem</span>
        </div>
        <SignInButton mode="modal">
          <button className="text-[11px] font-semibold tracking-widest uppercase text-zinc-600 hover:text-amber-400 transition-colors">
            Login
          </button>
        </SignInButton>
      </nav>

      {/* HERO */}
      <section className="flex flex-col min-h-[100svh] px-6 pt-28 pb-12 max-w-lg mx-auto">

        {/* Token — naked, no decorations */}
        <div className="mb-10">
          <Image
            src="/D.FAITH.png"
            alt="D.FAITH Token"
            width={72}
            height={72}
            className="rounded-2xl"
            priority
          />
        </div>

        {/* Headline */}
        <h1 className="text-[2.6rem] sm:text-[3.2rem] font-black leading-[1.0] tracking-tight mb-6">
          Sei dabei.<br />
          Supporte deine<br />
          <span className="text-amber-400">Künstler.</span><br />
          Werde belohnt.
        </h1>

        {/* Quote */}
        <p className="text-zinc-400 text-sm leading-relaxed mb-2 max-w-[340px]">
          Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.
        </p>
        <p className="text-zinc-600 text-xs font-medium tracking-widest mb-10">— Dawid Faith</p>

        {/* Quest hint */}
        {stats.openQuests > 0 && (
          <div className="flex items-center gap-2 mb-10">
            <FaFire size={11} className="text-amber-400" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400">
              {stats.openQuests} {stats.openQuests === 1 ? 'Quest' : 'Quests'} verfügbar
            </span>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto space-y-3">
          <SignUpButton mode="modal">
            <button className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-black text-sm tracking-[0.1em] uppercase rounded-xl transition-colors">
              Kostenlos starten
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="w-full py-3.5 text-zinc-500 hover:text-white font-semibold text-xs tracking-[0.15em] uppercase transition-colors">
              Bereits registriert? Einloggen
            </button>
          </SignInButton>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="h-px bg-white/[0.06] mx-6" />

      {/* AKTIVE KÜNSTLER */}
      {artists.length > 0 && (
        <section className="px-6 py-10 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-black tracking-[0.35em] uppercase text-zinc-400">
                Aktive Künstler
              </p>
            </div>
            {totalQuests > 0 && (
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400">
                {totalQuests} offen
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {artists.map((a) => (
              <button
                key={a.walletAddress}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="group relative focus:outline-none"
              >
                <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] active:scale-95 transition-all">
                  <div className="relative">
                    {a.picture ? (
                      <img
                        src={a.picture}
                        alt={a.name}
                        className="w-14 h-14 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
                        <FaMusic size={16} className="text-zinc-600" />
                      </div>
                    )}
                    {a.questCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-black text-[9px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ring-[#0a0908]">
                        {a.questCount > 9 ? '9+' : a.questCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-zinc-300 text-center leading-tight line-clamp-2 w-full">
                    {a.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* DIVIDER */}
      <div className="h-px bg-white/[0.06] mx-6" />

      {/* FAN / ARTIST */}
      <section className="px-6 py-10 max-w-lg mx-auto">

        {/* Toggle */}
        <div className="flex gap-4 mb-8 border-b border-white/[0.06] pb-4">
          {(['fan', 'artist'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[11px] font-black tracking-[0.25em] uppercase pb-1 border-b-2 transition-all ${
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
          <div className="space-y-6">
            {[
              { title: 'Quests erfüllen', desc: 'Absolviere Aufgaben deines Künstlers und erhalte echte Token direkt in dein Wallet.' },
              { title: 'Social verknüpfen', desc: 'Verbinde Instagram, TikTok, YouTube & Facebook für maximale Rewards.' },
              { title: 'Exklusive Vorteile', desc: 'Frühzugang zu Songs, limitiertem Merch und mehr für aktive Supporter.' },
              { title: 'Leaderboard & XP', desc: 'Sammle Punkte, steige auf und löse sie gegen weitere Belohnungen ein.' },
            ].map((f, i) => (
              <div key={f.title} className="flex gap-4">
                <span className="text-[11px] font-black text-amber-400/60 w-5 pt-0.5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-sm font-bold text-white mb-1">{f.title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}

            <SignUpButton mode="modal">
              <button className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm tracking-[0.1em] uppercase rounded-xl transition-colors mt-2">
                Jetzt registrieren
              </button>
            </SignUpButton>
          </div>
        ) : (
          <div>
            {!applied ? (
              <div className="space-y-5">
                {[
                  { title: 'Eigene Wallet & Token', desc: 'Dein eigenes Solana Wallet und dein eigener Token für deine Community.' },
                  { title: 'Quest System', desc: 'Erstelle eigene Aufgaben mit individuellen Rewards für deine Fans.' },
                  { title: 'Merch & Content Drops', desc: 'Exklusive Drops nur für deine aktivsten Supporter.' },
                ].map((f, i) => (
                  <div key={f.title} className="flex gap-4">
                    <span className="text-[11px] font-black text-amber-400/60 w-5 pt-0.5 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">{f.title}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}

                <div className="pt-2 space-y-3">
                  <div>
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-600 mb-1.5 block">
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
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-600 mb-1.5 block">
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
                    disabled={!artistName.trim()}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-20 disabled:cursor-not-allowed text-black font-black text-sm tracking-[0.1em] uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    Interesse anmelden
                    <FaChevronRight size={10} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-14 text-center">
                <FaCheckCircle size={32} className="text-amber-400 mx-auto mb-4" />
                <p className="font-black text-white mb-2">Danke, {artistName}!</p>
                <p className="text-zinc-500 text-sm">Wir melden uns so schnell wie möglich.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <div className="h-px bg-white/[0.06] mx-6" />
      <footer className="px-6 py-6 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/D.FAITH.png" alt="" width={14} height={14} className="rounded opacity-25" />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-700">D.FAITH Ecosystem</span>
        </div>
        <span className="text-[9px] text-zinc-800">© 2025</span>
      </footer>

    </main>
  );
}
