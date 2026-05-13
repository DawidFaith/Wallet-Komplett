'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { SiSolana } from 'react-icons/si';
import {
  FaInstagram, FaTiktok, FaYoutube, FaFacebook,
  FaWallet, FaCoins, FaRocket, FaStar,
  FaUsers, FaShieldAlt, FaTrophy, FaArrowRight,
} from 'react-icons/fa';

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
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="border-2 border-white/10 border-t-amber-400 rounded-full w-10 h-10 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060608] text-white overflow-x-hidden">

      {/* ── Ambient Background ─────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -right-60 w-[600px] h-[600px] bg-violet-700/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-20 left-1/3 w-[400px] h-[400px] bg-amber-600/4 rounded-full blur-[100px]" />
      </div>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060608]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Image src="/D.FAITH.png" alt="D.FAITH" width={28} height={28} className="rounded-full" />
          <span className="font-bold text-sm tracking-widest uppercase text-white">D.Faith</span>
          <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 font-bold tracking-widest uppercase">
            Beta
          </span>
        </div>
        <SignInButton mode="modal">
          <button className="text-xs text-zinc-400 hover:text-amber-400 transition-colors font-medium tracking-wide uppercase">
            Einloggen
          </button>
        </SignInButton>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-20 text-center">

        {/* Thin horizontal line */}
        <div className="absolute top-28 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

        <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto gap-8">

          {/* Logo */}
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl scale-150" />
            <Image
              src="/D.FAITH.png"
              alt="D.FAITH"
              width={80}
              height={80}
              className="relative rounded-full ring-1 ring-amber-500/30"
            />
          </div>

          {/* Badge */}
          <div className="flex items-center gap-2 border border-white/8 rounded-full px-4 py-1.5 bg-white/3 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-[10px] text-zinc-400 tracking-widest uppercase font-medium">
              Beta · Für Künstler &amp; Fans
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-[42px] sm:text-6xl font-black leading-none tracking-tight">
              <span className="text-white">D.</span>
              <span className="text-amber-400">FAITH</span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base tracking-widest uppercase font-medium">
              Ecosystem
            </p>
          </div>

          {/* Description */}
          <p className="text-zinc-500 text-sm sm:text-base leading-relaxed max-w-md">
            Die Plattform, die Künstler und Fans durch{' '}
            <span className="text-zinc-300">Blockchain-Technologie</span>,{' '}
            <span className="text-zinc-300">Social Media Quests</span> und{' '}
            <span className="text-zinc-300">echte Rewards</span> verbindet.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
            <SignUpButton mode="modal">
              <button className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 px-6 rounded-xl transition-all text-sm tracking-wide">
                <FaRocket size={12} />
                Registrieren
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-semibold py-3 px-6 rounded-xl transition-all text-sm">
                Einloggen
                <FaArrowRight size={11} />
              </button>
            </SignInButton>
          </div>

          {/* Platforms */}
          <div className="flex items-center gap-6 opacity-30 mt-2">
            <FaInstagram size={16} className="text-pink-400" />
            <FaTiktok size={16} className="text-white" />
            <FaYoutube size={16} className="text-red-400" />
            <FaFacebook size={16} className="text-blue-400" />
            <SiSolana size={16} className="text-green-400" />
          </div>
        </div>

        {/* Bottom fade line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="relative px-6 py-20 max-w-3xl mx-auto">

        {/* Für Künstler */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
            <span className="text-[10px] text-amber-400 font-bold tracking-widest uppercase px-3">Für Künstler</span>
            <div className="h-px flex-1 bg-gradient-to-l from-amber-500/40 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <FaWallet size={18} className="text-amber-400" />, title: 'Custodial Wallet', desc: 'Eigene Solana-Wallet ohne Seed-Phrase' },
              { icon: <FaCoins size={18} className="text-amber-400" />, title: 'D.FAITH Token', desc: 'Token an deine Community verteilen' },
              { icon: <FaRocket size={18} className="text-amber-400" />, title: 'Quest System', desc: 'Missionen für Fans erstellen' },
              { icon: <SiSolana size={18} className="text-amber-400" />, title: 'On-Chain', desc: 'Direkte Transfers auf Solana' },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white/3 backdrop-blur-sm border border-white/7 rounded-2xl p-4 hover:border-amber-500/20 hover:bg-white/5 transition-all group"
              >
                <div className="mb-3">{f.icon}</div>
                <p className="font-semibold text-sm text-white mb-1">{f.title}</p>
                <p className="text-zinc-600 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Für Fans */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-violet-500/40 to-transparent" />
            <span className="text-[10px] text-violet-400 font-bold tracking-widest uppercase px-3">Für Fans</span>
            <div className="h-px flex-1 bg-gradient-to-l from-violet-500/40 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <FaUsers size={18} className="text-violet-400" />, title: 'Unterstützen', desc: 'Quests absolvieren & Künstler supporten' },
              { icon: <FaTrophy size={18} className="text-violet-400" />, title: 'XP & Ranking', desc: 'Punkte sammeln & im Leaderboard steigen' },
              { icon: <FaStar size={18} className="text-violet-400" />, title: 'Rewards', desc: 'Token, Merch & exklusive Inhalte' },
              { icon: <FaShieldAlt size={18} className="text-violet-400" />, title: 'Social Quests', desc: 'Instagram, TikTok, YouTube & Facebook' },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white/3 backdrop-blur-sm border border-white/7 rounded-2xl p-4 hover:border-violet-500/20 hover:bg-white/5 transition-all"
              >
                <div className="mb-3">{f.icon}</div>
                <p className="font-semibold text-sm text-white mb-1">{f.title}</p>
                <p className="text-zinc-600 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="relative rounded-2xl overflow-hidden border border-amber-500/15 p-8 text-center">
          {/* gold shimmer background */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 via-transparent to-violet-600/8" />
          <div className="absolute inset-0 bg-[#060608]/60" />
          <div className="relative z-10">
            <Image src="/D.FAITH.png" alt="D.FAITH" width={44} height={44} className="rounded-full mx-auto mb-4 ring-1 ring-amber-500/30" />
            <h3 className="text-lg font-bold mb-2 tracking-wide">Werde Teil des Ecosystems</h3>
            <p className="text-zinc-500 text-xs mb-6 max-w-xs mx-auto leading-relaxed">
              Registriere dich kostenlos und sei Teil der ersten Beta-Generation des D.FAITH Ecosystems.
            </p>
            <SignUpButton mode="modal">
              <button className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold py-2.5 px-7 rounded-xl transition-all text-sm tracking-wide">
                <FaRocket size={12} />
                Kostenlos beitreten
              </button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Image src="/D.FAITH.png" alt="D.FAITH" width={18} height={18} className="rounded-full opacity-50" />
          <span className="text-zinc-700 text-xs tracking-widest uppercase font-medium">D.Faith Ecosystem</span>
        </div>
        <p className="text-zinc-800 text-[10px] tracking-wide">
          Beta Version · © 2025 · Alle Rechte vorbehalten
        </p>
      </footer>

    </main>
  );
}
