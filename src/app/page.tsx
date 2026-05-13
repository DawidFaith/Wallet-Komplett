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

      {/* ══════════════════════════════════════════════ */}
      {/*  MOBILE LAYOUT  (versteckt ab lg)             */}
      {/* ══════════════════════════════════════════════ */}
      <div className="lg:hidden min-h-[100svh] flex flex-col pt-14">

        {/* Foto */}
        <div className="relative w-full" style={{ aspectRatio: '16/7' }}>
          <Image
            src="/Still%202025-03-19%20193121_19.7.1.jpg"
            alt="Dawid Faith"
            fill
            className="object-cover object-top"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0908]/80 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 px-6 py-8">
          <h1 className="text-[2.6rem] font-black leading-[1.0] tracking-tight mb-5">
            Sei dabei.<br />
            Supporte deine<br />
            <span className="text-amber-400">Künstler.</span><br />
            Werde belohnt.
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed mb-1 max-w-sm">
            Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.
          </p>
          <p className="text-xs text-zinc-700 font-medium tracking-widest mb-8">— Dawid Faith</p>

          {stats.openQuests > 0 && (
            <div className="flex items-center gap-2 mb-6">
              <FaFire size={11} className="text-amber-400" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400">
                {stats.openQuests} {stats.openQuests === 1 ? 'Quest' : 'Quests'} verfügbar
              </span>
            </div>
          )}

          {artists.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">Aktive Künstler</span>
                {totalQuests > 0 && (
                  <>
                    <span className="text-zinc-800">·</span>
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-amber-500">{totalQuests} offen</span>
                  </>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {artists.slice(0, 8).map((a) => (
                  <div key={a.walletAddress} className="relative flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] transition-colors rounded-full pl-0.5 pr-2.5 py-0.5 cursor-default">
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

          {/* Mobile CTAs */}
          <div className="mt-auto space-y-2.5">
            <SignUpButton mode="modal">
              <button className="w-full py-[14px] bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-black text-sm tracking-[0.08em] uppercase rounded-2xl transition-all">
                Jetzt Supporter werden
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full py-3 text-zinc-600 hover:text-zinc-300 font-semibold text-[11px] tracking-[0.2em] uppercase transition-colors">
                Bereits registriert? Einloggen
              </button>
            </SignInButton>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  DESKTOP LAYOUT  (ab lg sichtbar)             */}
      {/* ══════════════════════════════════════════════ */}
      <div className="hidden lg:flex" style={{ height: 'calc(100svh - 3.5rem)', marginTop: '3.5rem' }}>

        {/* ── LINKE HÄLFTE: Foto fullscreen + Overlay-Content ── */}
        <div className="relative w-[50%] h-full overflow-hidden">
          <Image
            src="/Still%202025-03-19%20193121_19.7.1.jpg"
            alt="Dawid Faith"
            fill
            className="object-cover object-top"
            sizes="50vw"
            priority
          />
          {/* Vignette rechts (nahtloser Übergang zum rechten Panel) */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0a0908]/50" />
          {/* Gradient von unten für Textlesbarkeit */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0908] via-[#0a0908]/55 to-transparent" />

          {/* Overlay-Content unten */}
          <div className="absolute bottom-0 left-0 right-0 px-12 pb-12">
            {stats.openQuests > 0 && (
              <div className="flex items-center gap-2 mb-5">
                <FaFire size={10} className="text-amber-400" />
                <span className="text-[10px] font-black tracking-[0.25em] uppercase text-amber-400">
                  {stats.openQuests} Quests offen
                </span>
              </div>
            )}

            <h1 className="text-[3.6rem] font-black leading-[0.95] tracking-tight mb-5">
              Sei dabei.<br />
              Supporte deine<br />
              <span className="text-amber-400">Künstler.</span><br />
              Werde belohnt.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-1 max-w-xs">
              Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.
            </p>
            <p className="text-xs text-zinc-600 font-medium tracking-widest mb-8">— Dawid Faith</p>

            {artists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">Aktive Künstler</span>
                  {totalQuests > 0 && (
                    <>
                      <span className="text-zinc-800">·</span>
                      <span className="text-[9px] font-black tracking-[0.2em] uppercase text-amber-500">{totalQuests} offen</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {artists.slice(0, 6).map((a) => (
                    <div key={a.walletAddress} className="relative flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/[0.08] hover:border-amber-400/20 transition-colors rounded-full pl-0.5 pr-2.5 py-0.5 cursor-default">
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
        </div>

        {/* Trennlinie */}
        <div className="w-px bg-white/[0.06] self-stretch shrink-0" />

        {/* ── RECHTE HÄLFTE: Features + CTA ── */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
          <div className="flex flex-col justify-between h-full px-14 py-12 max-w-[520px] w-full mx-auto">

            {/* Einleitung */}
            <div className="mb-2">
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-700 mb-2">
                Web3 · Musik · Community
              </p>
              <p className="text-[1.45rem] font-black text-white leading-snug">
                Werde Teil der<br />
                <span className="text-amber-400">Bewegung.</span>
              </p>
            </div>

            {/* Tab-Umschalter */}
            <div className="flex gap-6 border-b border-white/[0.07] mt-8 mb-7 pb-0">
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

            {/* Feature-Listen / Formular */}
            <div className="flex-1">
              {tab === 'fan' ? (
                <div className="space-y-6">
                  {fanFeatures.map((f) => (
                    <div key={f.n} className="flex gap-4 items-start">
                      <span className="text-[10px] font-black text-amber-400/40 w-6 shrink-0 pt-0.5">{f.n}</span>
                      <div>
                        <p className="text-[15px] font-bold text-white mb-1">{f.title}</p>
                        <p className="text-[13px] text-zinc-500 leading-relaxed">{f.desc}</p>
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
                          <span className="text-[10px] font-black text-amber-400/40 w-6 shrink-0 pt-0.5">{f.n}</span>
                          <div>
                            <p className="text-[15px] font-bold text-white mb-1">{f.title}</p>
                            <p className="text-[13px] text-zinc-500 leading-relaxed">{f.desc}</p>
                          </div>
                        </div>
                      ))}
                      <div className="space-y-2.5 pt-3">
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

            {/* Desktop CTAs — immer am unteren Rand der rechten Hälfte */}
            <div className="space-y-3 pt-10">
              <SignUpButton mode="modal">
                <button className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-black text-[13px] tracking-[0.1em] uppercase rounded-2xl transition-all shadow-[0_0_40px_rgba(251,191,36,0.15)]">
                  Jetzt Supporter werden
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="w-full py-3 border border-white/[0.06] hover:border-amber-400/20 text-zinc-600 hover:text-zinc-300 font-semibold text-[11px] tracking-[0.2em] uppercase transition-all rounded-xl">
                  Bereits registriert? Einloggen
                </button>
              </SignInButton>
            </div>

          </div>
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
