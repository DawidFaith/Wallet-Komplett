'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaMusic, FaCheckCircle, FaBolt, FaLock, FaGift, FaStar,
  FaChevronRight, FaRocket, FaArrowRight, FaFire,
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
    <main className="min-h-screen bg-[#0a0908] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0908]/70 backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <Image src="/D.FAITH.png" alt="" width={20} height={20} className="rounded-md opacity-90" />
          <span className="text-[11px] font-black tracking-[0.35em] uppercase bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
            D.FAITH
          </span>
          <span className="text-[11px] font-black tracking-[0.35em] uppercase text-white/50">Ecosystem</span>
        </div>
        <SignInButton mode="modal">
          <button className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 hover:text-amber-400 transition-colors">
            Login →
          </button>
        </SignInButton>
      </nav>

      {/* ── HERO ── full-height, split layout */}
      <section className="relative min-h-[100svh] flex flex-col">

        {/* top amber bar */}
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* content */}
        <div className="flex flex-col flex-1 justify-between px-6 pt-24 pb-10 max-w-lg mx-auto w-full">

          {/* Brand block */}
          <div className="flex items-start gap-4 mt-4">
            <div className="shrink-0 mt-1">
              <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-amber-400/40 shadow-[0_0_32px_rgba(251,191,36,0.25)]">
                <Image src="/D.FAITH.png" alt="D.FAITH" width={56} height={56} className="w-full h-full object-cover" priority />
              </div>
            </div>
            <div>
              <div className="text-[28px] sm:text-[36px] font-black leading-none tracking-tight">
                <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-300 bg-clip-text text-transparent">
                  D.FAITH
                </span>
                <br />
                <span className="text-white/90">Ecosystem</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-400">Aktiv</span>
                {stats.openQuests > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-amber-400">
                      {stats.openQuests} {stats.openQuests === 1 ? 'Quest' : 'Quests'} verfügbar
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Big tagline */}
          <div className="my-8">
            <p className="text-[42px] sm:text-[54px] font-black leading-[0.95] tracking-[-0.02em]">
              Supporte.
              <br />
              <span className="text-amber-400">Verdiene.</span>
              <br />
              Werde Teil.
            </p>
            <p className="mt-4 text-zinc-400 text-[13px] leading-[1.7] max-w-[300px]">
              Erfülle Quests deiner Lieblingskünstler und erhalte echte Token-Rewards direkt in dein Wallet.
            </p>
          </div>

          {/* Active Artists strip */}
          {artists.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">
                  Aktive Künstler
                </span>
                {totalQuests > 0 && (
                  <span className="flex items-center gap-1 text-[9px] font-black tracking-[0.2em] uppercase text-amber-400">
                    <FaFire size={8} />
                    {totalQuests} offen
                  </span>
                )}
              </div>

              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                {artists.map((a) => (
                  <button
                    key={a.walletAddress}
                    onClick={() => document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="shrink-0 relative group focus:outline-none"
                  >
                    {/* card */}
                    <div className={`w-[88px] bg-white/[0.04] border rounded-2xl p-2.5 pb-3 flex flex-col items-center gap-2 transition-all duration-200 group-hover:bg-white/[0.08] group-active:scale-95 ${
                      a.questCount > 0
                        ? 'border-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                        : 'border-white/[0.06]'
                    }`}>
                      <div className="relative">
                        {a.picture ? (
                          <img src={a.picture} alt={a.name}
                            className="w-11 h-11 rounded-xl object-cover" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <FaMusic size={14} className="text-amber-400/60" />
                          </div>
                        )}
                        {a.questCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-black text-[9px] font-black rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ring-2 ring-[#0a0908]">
                            {a.questCount > 9 ? '9+' : a.questCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-semibold text-zinc-200 text-center leading-tight line-clamp-2 w-full">
                        {a.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div id="cta" className="space-y-2.5">
            <SignUpButton mode="modal">
              <button className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black text-[13px] tracking-[0.15em] uppercase rounded-2xl transition-colors flex items-center justify-center gap-2">
                <FaRocket size={12} />
                Kostenlos registrieren
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full py-3 border border-white/[0.08] hover:border-amber-400/30 text-zinc-500 hover:text-amber-400 font-bold text-[11px] tracking-[0.2em] uppercase rounded-2xl transition-all flex items-center justify-center gap-1.5">
                Bereits registriert
                <FaArrowRight size={9} />
              </button>
            </SignInButton>
          </div>
        </div>

        {/* bottom bar */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-6 py-12 max-w-lg mx-auto">
        <p className="text-[9px] font-black tracking-[0.45em] uppercase text-amber-400/80 mb-8">So funktioniert es</p>

        {/* Fan / Artist Toggle */}
        <div className="flex mb-8 border border-white/[0.07] rounded-xl overflow-hidden">
          {(['fan', 'artist'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-black tracking-[0.15em] uppercase transition-all ${
                tab === t
                  ? 'bg-amber-400 text-black'
                  : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
              }`}
            >
              {t === 'fan' ? 'Für Fans' : 'Für Künstler'}
            </button>
          ))}
        </div>

        {tab === 'fan' ? (
          <div className="space-y-0 divide-y divide-white/[0.05]">
            {[
              { icon: <FaBolt />, n: '01', title: 'Quest auswählen', desc: 'Entscheide, welchen Künstler du unterstützen willst und wähle eine passende Quest.' },
              { icon: <FaStar />,  n: '02', title: 'Social verknüpfen', desc: 'Verbinde Instagram, TikTok, YouTube oder Facebook für mehr Belohnungen.' },
              { icon: <FaGift />,  n: '03', title: 'Reward erhalten', desc: 'Nach der Überprüfung landen Token-Belohnungen direkt in deinem Wallet.' },
              { icon: <FaLock />,  n: '04', title: 'Exklusive Vorteile', desc: 'Frühzugang zu Tracks, limitiertem Merch und mehr für aktive Supporter.' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-4 py-5">
                <span className="text-[28px] font-black text-white/[0.06] leading-none shrink-0 w-8 mt-0.5">{s.n}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-400 text-[11px]">{s.icon}</span>
                    <p className="text-sm font-bold text-white">{s.title}</p>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {!applied ? (
              <div className="space-y-4">
                <div className="space-y-1 divide-y divide-white/[0.05]">
                  {[
                    { n: '01', title: 'Eigene Solana Wallet', desc: 'Dein eigenes Wallet und dein eigener Token auf Solana.' },
                    { n: '02', title: 'Quest System', desc: 'Erstelle Aufgaben für deine Fanbase mit individuellen Rewards.' },
                    { n: '03', title: 'Content & Merch Drops', desc: 'Exklusive limitierte Drops nur für deine Community.' },
                  ].map((s) => (
                    <div key={s.n} className="flex items-start gap-4 py-5">
                      <span className="text-[28px] font-black text-white/[0.06] leading-none shrink-0 w-8 mt-0.5">{s.n}</span>
                      <div>
                        <p className="text-sm font-bold text-white mb-1">{s.title}</p>
                        <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 space-y-3">
                  <div>
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-1.5 block">
                      Künstlername *
                    </label>
                    <input
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="Dein Name"
                      className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-amber-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-500 mb-1.5 block">
                      Social Link
                    </label>
                    <input
                      value={artistSocial}
                      onChange={(e) => setArtistSocial(e.target.value)}
                      placeholder="instagram.com/…"
                      className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-amber-400/40 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleApply}
                    disabled={!artistName.trim()}
                    className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-25 disabled:cursor-not-allowed text-black font-black text-[12px] tracking-[0.15em] uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    Interesse anmelden
                    <FaChevronRight size={10} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <FaCheckCircle size={36} className="text-amber-400 mx-auto mb-4" />
                <p className="font-black text-white text-base mb-2">Danke, {artistName}!</p>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Wir melden uns so schnell wie möglich bei dir.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.05] px-6 py-6 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/D.FAITH.png" alt="" width={14} height={14} className="rounded opacity-30" />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-700">D.FAITH Ecosystem</span>
        </div>
        <span className="text-[9px] text-zinc-800">© 2025</span>
      </footer>

    </main>
  );
}
