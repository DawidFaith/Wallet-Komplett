'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SiSolana } from 'react-icons/si';
import {
  FaInstagram, FaTiktok, FaYoutube, FaFacebook,
  FaMusic, FaTrophy, FaWallet, FaCoins,
  FaRocket, FaStar, FaUsers, FaShieldAlt,
  FaArrowRight, FaCheckCircle,
} from 'react-icons/fa';

const ARTIST_FEATURES = [
  {
    icon: <FaWallet size={22} className="text-purple-400" />,
    title: 'Custodial Wallet',
    desc: 'Deine eigene Solana-Wallet – sicher verwaltet, ohne Seed-Phrase.',
  },
  {
    icon: <FaCoins size={22} className="text-yellow-400" />,
    title: 'D.FAITH Token',
    desc: 'Erstelle und verteile deinen eigenen Token an deine Community.',
  },
  {
    icon: <FaRocket size={22} className="text-pink-400" />,
    title: 'Quest System',
    desc: 'Missionen für Fans erstellen und sie mit Rewards belohnen.',
  },
  {
    icon: <SiSolana size={22} className="text-green-400" />,
    title: 'On-Chain Rewards',
    desc: 'Direkte Token-Transfers auf der Solana Blockchain.',
  },
];

const FAN_FEATURES = [
  {
    icon: <FaUsers size={22} className="text-blue-400" />,
    title: 'Künstler unterstützen',
    desc: 'Folge Quests deiner Lieblings-Künstler und verdiene Punkte.',
  },
  {
    icon: <FaTrophy size={22} className="text-orange-400" />,
    title: 'XP & Leaderboard',
    desc: 'Sammle Erfahrungspunkte und klettere im Ranking nach oben.',
  },
  {
    icon: <FaStar size={22} className="text-yellow-400" />,
    title: 'Exclusive Rewards',
    desc: 'Token, Merch und Zugang zu exklusiven Inhalten als Belohnung.',
  },
  {
    icon: <FaShieldAlt size={22} className="text-purple-400" />,
    title: 'Social Quests',
    desc: 'Instagram, TikTok, YouTube & Facebook Aktivitäten verknüpfen.',
  },
];

const PLATFORMS = [
  { icon: <FaInstagram size={18} />, label: 'Instagram', color: 'text-pink-500' },
  { icon: <FaTiktok size={18} />, label: 'TikTok', color: 'text-white' },
  { icon: <FaYoutube size={18} />, label: 'YouTube', color: 'text-red-500' },
  { icon: <FaFacebook size={18} />, label: 'Facebook', color: 'text-blue-500' },
];

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/home');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="border-4 border-white/10 border-t-purple-500 rounded-full w-12 h-12 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <FaMusic size={16} className="text-purple-400" />
          <span className="font-bold text-base tracking-wide">D.FAITH</span>
          <span className="text-[10px] bg-purple-600/30 text-purple-300 border border-purple-600/40 rounded-full px-2 py-0.5 font-semibold tracking-wider uppercase ml-1">
            Beta
          </span>
        </div>
        <SignInButton mode="modal">
          <button className="text-sm text-zinc-300 hover:text-white transition-colors font-medium">
            Einloggen
          </button>
        </SignInButton>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        {/* Hintergrund-Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-violet-800/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto gap-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2 bg-purple-950/50 border border-purple-700/40 rounded-full px-4 py-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-purple-300 font-medium tracking-wide uppercase">
              Beta · Für Künstler & Fans
            </span>
          </div>

          {/* Titel */}
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Das{' '}
            <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-purple-500 bg-clip-text text-transparent">
              D.FAITH
            </span>{' '}
            Ecosystem
          </h1>

          {/* Untertitel */}
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-lg">
            Die Plattform, die Künstler und Fans durch Blockchain-Technologie,
            Social Media Quests und echte Rewards verbindet.
          </p>

          {/* Feature-Chips */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-1">
            {['Solana Wallet', 'D.FAITH Token', 'Quest System', 'Leaderboard', 'Merch'].map((f) => (
              <div key={f} className="flex items-center gap-1.5 text-sm text-zinc-400">
                <FaCheckCircle size={12} className="text-purple-400" />
                {f}
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-3 w-full max-w-sm">
            <SignUpButton mode="modal">
              <button className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-purple-900/40">
                <FaRocket size={13} />
                Jetzt registrieren
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-semibold py-3 px-6 rounded-xl transition-all text-sm">
                Einloggen
                <FaArrowRight size={11} />
              </button>
            </SignInButton>
          </div>

          {/* Plattformen */}
          <div className="flex items-center gap-5 mt-3 opacity-50">
            {PLATFORMS.map(({ icon, label, color }) => (
              <div key={label} className={`flex items-center gap-1.5 ${color}`}>
                {icon}
                <span className="text-zinc-500 text-[11px]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">

        {/* Für Künstler */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-violet-600 rounded-full" />
            <h2 className="text-xl font-bold">Für Künstler</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ARTIST_FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex gap-4 items-start hover:border-purple-800/50 transition-colors"
              >
                <div className="mt-0.5 shrink-0 w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">{f.title}</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Für Fans */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-400 to-violet-500 rounded-full" />
            <h2 className="text-xl font-bold">Für Fans</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FAN_FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex gap-4 items-start hover:border-blue-800/40 transition-colors"
              >
                <div className="mt-0.5 shrink-0 w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">{f.title}</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="relative overflow-hidden rounded-3xl border border-purple-800/30 bg-gradient-to-br from-purple-950/50 via-zinc-900 to-zinc-900 p-8 text-center">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-700/10 rounded-full blur-3xl pointer-events-none" />
          <FaMusic size={26} className="text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Bereit für das Ecosystem?</h3>
          <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
            Registriere dich kostenlos und sei Teil der ersten Beta-Generation
            des D.FAITH Ecosystems.
          </p>
          <SignUpButton mode="modal">
            <button className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold py-3 px-8 rounded-xl transition-all text-sm shadow-lg shadow-purple-900/40">
              <FaRocket size={13} />
              Jetzt kostenlos beitreten
            </button>
          </SignUpButton>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 px-6 py-6 text-center">
        <p className="text-zinc-600 text-xs">
          © 2025 D.FAITH Ecosystem · Beta Version · Alle Rechte vorbehalten
        </p>
      </footer>

    </main>
  );
}


