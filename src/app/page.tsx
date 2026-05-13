'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaRocket, FaArrowRight, FaBolt, FaLock,
  FaGift, FaStar, FaMusic, FaCheckCircle, FaChevronRight,
} from 'react-icons/fa';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<'fan' | 'artist'>('fan');
  const [applied, setApplied] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [artistSocial, setArtistSocial] = useState('');

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/home');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="border-2 border-white/10 border-t-amber-400 rounded-full w-10 h-10 animate-spin" />
      </main>
    );
  }

  const handleApply = () => {
    if (!artistName.trim()) return;
    setApplied(true);
  };

  return (
    <main className="min-h-screen bg-[#060608] text-white overflow-x-hidden">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3.5 bg-[#060608]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Image src="/D.FAITH.png" alt="D.FAITH" width={26} height={26} className="rounded-full" />
          <span className="font-bold text-sm tracking-widest uppercase">D.Faith</span>
          <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 font-bold tracking-widest uppercase">
            Beta
          </span>
        </div>
        <SignInButton mode="modal">
          <button className="text-xs text-zinc-500 hover:text-amber-400 transition-colors uppercase tracking-wide font-medium">
            Einloggen
          </button>
        </SignInButton>
      </nav>

      {/* Hero — Artist Photo */}
      <section className="relative min-h-[100svh] flex flex-col">
        {/* Background photo */}
        <div className="absolute inset-0">
          <Image
            src="/_ARC6705.jpg"
            alt="Dawid Faith"
            fill
            className="object-cover object-top"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-[#060608]/65 to-[#060608]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060608]/70 via-transparent to-transparent" />
        </div>

        {/* Text content — sits at the bottom of the hero */}
        <div className="relative z-10 flex flex-col justify-end flex-1 px-6 pb-10 pt-24 max-w-lg mx-auto w-full">
          <div className="mb-8">
            <div className="w-8 h-0.5 bg-amber-400 mb-5" />
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight mb-3">
              Sei dabei.<br />
              <span className="text-amber-400">Support deine</span>{' '}
              Künstler.<br />
              Werde belohnt.
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed mb-3 max-w-sm">
              Das D.FAITH Ecosystem verbindet Künstler und Fans — mit echten Belohnungen und echter Community.
            </p>
            <p className="text-zinc-600 text-xs tracking-widest uppercase font-medium">
              — Dawid Faith
            </p>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full p-1 w-fit">
            <button
              onClick={() => setTab('fan')}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all ${
                tab === 'fan' ? 'bg-amber-400 text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Ich bin Fan
            </button>
            <button
              onClick={() => setTab('artist')}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all ${
                tab === 'artist' ? 'bg-amber-400 text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Ich bin Künstler
            </button>
          </div>
        </div>
      </section>

      {/* Dynamic Content */}
      <section className="relative z-10 px-6 pb-20 max-w-lg mx-auto">

        {tab === 'fan' ? (
          /* ── FAN ─────────────────────────────────────────── */
          <div className="space-y-3">
            <div className="bg-white/3 border border-white/7 rounded-2xl p-5">
              <div className="space-y-4">
                {[
                  {
                    icon: <FaBolt size={15} className="text-amber-400" />,
                    title: 'Erfülle Aufgaben deines Künstlers',
                    desc: 'Absolviere Quests und erhalte dafür echte Belohnungen direkt in dein Wallet.',
                  },
                  {
                    icon: <FaLock size={15} className="text-amber-400" />,
                    title: 'Frühzugang zu Songs & limitierten Merch',
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
                    <div className="mt-0.5 w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-snug">{f.title}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SignUpButton mode="modal">
              <button className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold py-3.5 rounded-xl text-sm transition-all tracking-wide">
                <FaRocket size={12} />
                Jetzt kostenlos registrieren
              </button>
            </SignUpButton>

            <SignInButton mode="modal">
              <button className="w-full flex items-center justify-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs py-2 transition-colors">
                Bereits registriert? Einloggen
                <FaArrowRight size={9} />
              </button>
            </SignInButton>
          </div>

        ) : (
          /* ── KÜNSTLER ─────────────────────────────────────── */
          <div>
            {!applied ? (
              <div className="bg-white/3 border border-amber-500/15 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <FaMusic size={13} className="text-amber-400" />
                  <h2 className="font-bold text-sm text-white uppercase tracking-wide">Künstler Bewerbung</h2>
                </div>
                <p className="text-zinc-500 text-xs mb-5 leading-relaxed">
                  Baue deine eigene Community mit Quests, eigenem Token und Rewards. Bewirb dich jetzt für einen Platz auf der Plattform.
                </p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1 block">
                      Dein Künstlername *
                    </label>
                    <input
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="z.B. Dawid Faith"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1 block">
                      Social Media Link
                    </label>
                    <input
                      value={artistSocial}
                      onChange={(e) => setArtistSocial(e.target.value)}
                      placeholder="instagram.com/deinname"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  {[
                    'Eigene Solana Wallet & D.FAITH Token',
                    'Quest System für deine Fanbase',
                    'Merch & exklusive Content-Drops',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                      <FaCheckCircle size={10} className="text-amber-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApply}
                  disabled={!artistName.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-all tracking-wide"
                >
                  Interesse anmelden
                  <FaChevronRight size={11} />
                </button>
              </div>
            ) : (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8 text-center">
                <FaCheckCircle size={34} className="text-amber-400 mx-auto mb-3" />
                <h3 className="font-bold text-white text-base mb-2">Danke, {artistName}!</h3>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-xs mx-auto">
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
          <Image src="/D.FAITH.png" alt="D.FAITH" width={16} height={16} className="rounded-full opacity-40" />
          <span className="text-zinc-700 text-[10px] tracking-widest uppercase">D.Faith Ecosystem · Beta</span>
        </div>
        <p className="text-zinc-800 text-[10px]">© 2025 · Alle Rechte vorbehalten</p>
      </footer>

    </main>
  );
}
