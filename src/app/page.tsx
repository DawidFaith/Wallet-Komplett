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
    <main className="bg-[#0a0908] text-white min-h-screen">

      {/* ── SCREEN 1: everything above the fold ── */}
      <section className="min-h-[100svh] flex flex-col px-5 pt-5 pb-6 max-w-sm mx-auto">

        {/* Top row: brand + login */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Image src="/D.FAITH.png" alt="" width={28} height={28} className="rounded-lg" priority />
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
        </div>

        {/* Headline block — takes up the most visual weight */}
        <div className="flex-1 flex flex-col justify-center">

          {/* Token — just the image */}
          <Image
            src="/D.FAITH.png"
            alt="D.FAITH"
            width={56}
            height={56}
            className="rounded-xl mb-6"
          />

          <h1 className="text-[2.8rem] font-black leading-[1.0] tracking-tight mb-5">
            Sei dabei.<br />
            Supporte deine<br />
            <em className="not-italic text-amber-400">Künstler.</em><br />
            Werde belohnt.
          </h1>

          <p className="text-[13px] text-zinc-500 leading-relaxed mb-1 max-w-[280px]">
            Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.
          </p>
          <p className="text-[11px] text-zinc-700 font-medium tracking-widest mb-7">— Dawid Faith</p>

          {/* Artists: pill row */}
          {artists.length > 0 && (
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">
                  Aktive Künstler
                </span>
                {totalQuests > 0 && (
                  <>
                    <span className="text-zinc-800">·</span>
                    <span className="flex items-center gap-1 text-[9px] font-black tracking-[0.2em] uppercase text-amber-500">
                      <FaFire size={8} />
                      {totalQuests} Quests
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {artists.slice(0, 6).map((a) => (
                  <div
                    key={a.walletAddress}
                    className="relative flex items-center gap-1.5 bg-white/[0.05] rounded-full pl-0.5 pr-2.5 py-0.5"
                  >
                    {a.picture ? (
                      <img src={a.picture} alt={a.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <FaMusic size={9} className="text-zinc-600" />
                      </div>
                    )}
                    <span className="text-[10px] font-semibold text-zinc-300 truncate max-w-[72px]">{a.name}</span>
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

        {/* CTA — pinned to bottom */}
        <div className="space-y-2.5 pt-2">
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
      </section>

      {/* ── SCREEN 2: details (scrollable bonus) ── */}
      <section className="px-5 py-10 max-w-sm mx-auto border-t border-white/[0.05]">

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl mb-7">
          {(['fan', 'artist'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[10px] font-black tracking-[0.2em] uppercase rounded-lg transition-all ${
                tab === t ? 'bg-amber-400 text-black' : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {t === 'fan' ? 'Für Fans' : 'Für Künstler'}
            </button>
          ))}
        </div>

        {tab === 'fan' ? (
          <div className="space-y-5">
            {[
              { n: '01', title: 'Quests erfüllen', desc: 'Absolviere Aufgaben und erhalte echte Token direkt in dein Wallet.' },
              { n: '02', title: 'Social verknüpfen', desc: 'Instagram, TikTok, YouTube & Facebook für maximale Rewards.' },
              { n: '03', title: 'Exklusive Vorteile', desc: 'Frühzugang zu Songs, limitiertem Merch und mehr.' },
              { n: '04', title: 'Leaderboard & XP', desc: 'Sammle Punkte, steige auf und löse sie gegen Belohnungen ein.' },
            ].map((f) => (
              <div key={f.n} className="flex gap-3.5 items-start">
                <span className="text-[10px] font-black text-amber-400/50 w-6 shrink-0 pt-0.5">{f.n}</span>
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">{f.title}</p>
                  <p className="text-xs text-zinc-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
            <SignUpButton mode="modal">
              <button className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs tracking-[0.1em] uppercase rounded-xl transition-colors mt-2">
                Jetzt registrieren
              </button>
            </SignUpButton>
          </div>
        ) : (
          <div>
            {!applied ? (
              <div className="space-y-5">
                {[
                  { n: '01', title: 'Eigene Wallet & Token', desc: 'Dein eigenes Solana Wallet und Token für deine Community.' },
                  { n: '02', title: 'Quest System', desc: 'Erstelle eigene Aufgaben mit individuellen Rewards.' },
                  { n: '03', title: 'Merch & Content Drops', desc: 'Exklusive Drops nur für deine aktivsten Supporter.' },
                ].map((f) => (
                  <div key={f.n} className="flex gap-3.5 items-start">
                    <span className="text-[10px] font-black text-amber-400/50 w-6 shrink-0 pt-0.5">{f.n}</span>
                    <div>
                      <p className="text-sm font-bold text-white mb-0.5">{f.title}</p>
                      <p className="text-xs text-zinc-600 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
                <div className="space-y-2.5 pt-1">
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
                    disabled={!artistName.trim()}
                    className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-20 disabled:cursor-not-allowed text-black font-black text-xs tracking-[0.1em] uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    Interesse anmelden <FaChevronRight size={9} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <FaCheckCircle size={30} className="text-amber-400 mx-auto mb-4" />
                <p className="font-black text-white mb-2">Danke, {artistName}!</p>
                <p className="text-zinc-600 text-sm">Wir melden uns so schnell wie möglich.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.04] px-5 py-5 flex items-center justify-between max-w-sm mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/D.FAITH.png" alt="" width={12} height={12} className="rounded opacity-20" />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-800">D.FAITH Ecosystem</span>
        </div>
        <span className="text-[9px] text-zinc-800">© 2025</span>
      </footer>

    </main>
  );
}
