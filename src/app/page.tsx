'use client';

import { useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaMusic, FaCheckCircle, FaChevronRight, FaFire } from 'react-icons/fa';
import { t, tFmt, tPlural, type Lang } from './utils/i18n';
import { useSetLang } from './components/LangContext';

const LANG_KEY = 'dfaith_language';

const languageFlags: Record<Lang, string> = { de: '🇩🇪', en: '🇺🇸', pl: '🇵🇱' };

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
  const setLangCtx = useSetLang();
  const [tab, setTab] = useState<'fan' | 'artist'>('fan');
  const [applied, setApplied] = useState(false);
  const [language, setLanguage] = useState<Lang>('de');
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANG_KEY) as Lang | null;
      if (saved && ['de', 'en', 'pl'].includes(saved)) setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (l: Lang) => {
    setLanguage(l);
    setLangCtx(l);
    setLangOpen(false);
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, l);
  };
  const [sending, setSending] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [artistSocial, setArtistSocial] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState<EcosystemStats>({ openQuests: 0 });

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  // ?ref= Referral-Code aus URL in localStorage speichern
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref && ref.trim()) {
        localStorage.setItem('dfaith_referral', ref.trim().toLowerCase());
      }
    }
  }, []);

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
    { n: '01', title: t('landing.fan.1.title', language), desc: t('landing.fan.1.desc', language) },
    { n: '02', title: t('landing.fan.2.title', language), desc: t('landing.fan.2.desc', language) },
    { n: '03', title: t('landing.fan.3.title', language), desc: t('landing.fan.3.desc', language) },
    { n: '04', title: t('landing.fan.4.title', language), desc: t('landing.fan.4.desc', language) },
  ];

  const artistFeatures = [
    { n: '01', title: t('landing.artist.1.title', language), desc: t('landing.artist.1.desc', language) },
    { n: '02', title: t('landing.artist.2.title', language), desc: t('landing.artist.2.desc', language) },
    { n: '03', title: t('landing.artist.3.title', language), desc: t('landing.artist.3.desc', language) },
    { n: '04', title: t('landing.artist.4.title', language), desc: t('landing.artist.4.desc', language) },
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
        <div className="flex items-center gap-3">
          {/* Sprachauswahl */}
          <div className="relative">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="text-lg leading-none"
              title="Language / Sprache / Język"
            >
              {languageFlags[language]}
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-2 bg-[#1a1815] rounded-lg border border-white/10 overflow-hidden z-50 min-w-[120px] shadow-xl">
                {(['de', 'en', 'pl'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleSetLanguage(l)}
                    className={`flex items-center gap-2 px-3 py-2.5 w-full text-sm hover:bg-white/5 transition-colors ${
                      language === l ? 'text-amber-400' : 'text-zinc-300'
                    }`}
                  >
                    <span>{languageFlags[l]}</span>
                    <span className="font-medium">{l === 'de' ? 'Deutsch' : l === 'en' ? 'English' : 'Polski'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <SignInButton mode="modal">
            <button className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-600 hover:text-amber-400 transition-colors">
              {t('landing.login', language)}
            </button>
          </SignInButton>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════ */}
      {/*  MOBILE LAYOUT  (versteckt ab lg)             */}
      {/* ══════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col pt-14">

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
            {t('landing.headline1', language)}<br />
            {t('landing.headline2', language)}<br />
            <span className="text-amber-400">{t('landing.headline3', language)}</span><br />
            {t('landing.headline4', language)}
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed mb-1 max-w-sm">
            {t('landing.sub', language)}
          </p>
          <p className="text-xs text-zinc-700 font-medium tracking-widest mb-8">— Dawid Faith</p>

          {stats.openQuests > 0 && (
            <div className="flex items-center gap-2 mb-6">
              <FaFire size={11} className="text-amber-400" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400">
                {stats.openQuests} {tPlural('landing.questsAvailable_one', 'landing.questsAvailable_other', stats.openQuests, language)}
              </span>
            </div>
          )}

          {artists.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">{t('landing.activeArtists', language)}</span>
                {totalQuests > 0 && (
                  <>
                    <span className="text-zinc-800">·</span>
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-amber-500">{totalQuests} {t('landing.open', language)}</span>
                  </>
                )}
              </div>
              <div className="flex gap-3 flex-wrap">
                {artists.slice(0, 8).map((a) => (
                  <div key={a.walletAddress} className="relative flex flex-col items-center gap-1 cursor-default">
                    {a.picture ? (
                      <Image src={a.picture} alt={a.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <FaMusic size={11} className="text-zinc-600" />
                      </div>
                    )}
                    <span className="text-[9px] font-semibold text-zinc-400 truncate max-w-[60px] text-center">{a.name}</span>
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

          {/* Mobile Feature-Tabs */}
          <div className="mb-8">
            <div className="flex gap-6 border-b border-white/[0.07] mb-6">
              {(['fan', 'artist'] as const).map((tabVal) => (
                <button
                  key={tabVal}
                  onClick={() => setTab(tabVal)}
                  className={`pb-3 text-[11px] font-black tracking-[0.25em] uppercase border-b-2 transition-all -mb-px ${
                    tab === tabVal
                      ? 'border-amber-400 text-white'
                      : 'border-transparent text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {tabVal === 'fan' ? t('landing.forFans', language) : t('landing.forArtists', language)}
                </button>
              ))}
            </div>

            {tab === 'fan' ? (
              <div className="space-y-5">
                {fanFeatures.map((f) => (
                  <div key={f.n} className="flex gap-4 items-start">
                    <span className="text-[10px] font-black text-amber-400/40 w-6 shrink-0 pt-0.5">{f.n}</span>
                    <div>
                      <p className="text-[14px] font-bold text-white mb-1">{f.title}</p>
                      <p className="text-[12px] text-zinc-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {!applied ? (
                  <div className="space-y-4">
                    {artistFeatures.map((f) => (
                      <div key={f.n} className="flex gap-4 items-start">
                        <span className="text-[10px] font-black text-amber-400/40 w-6 shrink-0 pt-0.5">{f.n}</span>
                        <div>
                          <p className="text-[14px] font-bold text-white mb-1">{f.title}</p>
                          <p className="text-[12px] text-zinc-500 leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                    <div className="space-y-2.5 pt-2">
                      <div>
                        <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-700 mb-1.5 block">
                          {t('landing.form.nameLabel', language)}
                        </label>
                        <input
                          value={artistName}
                          onChange={(e) => setArtistName(e.target.value)}
                          placeholder={t('landing.form.namePlaceholder', language)}
                          className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-amber-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-700 mb-1.5 block">
                          {t('landing.form.socialLabel', language)}
                        </label>
                        <input
                          value={artistSocial}
                          onChange={(e) => setArtistSocial(e.target.value)}
                          placeholder={t('landing.form.socialPlaceholder', language)}
                          className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-amber-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors"
                        />
                      </div>
                      <button
                        onClick={handleApply}
                        disabled={!artistName.trim() || sending}
                        className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-20 disabled:cursor-not-allowed text-black font-black text-xs tracking-[0.1em] uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        {sending ? t('landing.form.submitting', language) : <>{t('landing.form.submit', language)} <FaChevronRight size={9} /></>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <FaCheckCircle size={30} className="text-amber-400 mx-auto mb-4" />
                    <p className="font-black text-white mb-2">{language === 'pl' ? `Dziękujemy, ${artistName}!` : language === 'en' ? `Thank you, ${artistName}!` : `Danke, ${artistName}!`}</p>
                    <p className="text-zinc-600 text-sm">{t('landing.form.successSub', language)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile CTAs */}
          <div className="mt-8 space-y-2.5">
            <SignUpButton mode="modal">
              <button className="w-full py-[14px] bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-black text-sm tracking-[0.08em] uppercase rounded-2xl transition-all">
                {t('landing.cta.signup', language)}
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full py-3 text-zinc-600 hover:text-zinc-300 font-semibold text-[11px] tracking-[0.2em] uppercase transition-colors">
                {t('landing.cta.login', language)}
              </button>
            </SignInButton>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  DESKTOP LAYOUT  (ab lg sichtbar)             */}
      {/* ══════════════════════════════════════════════ */}
      <div className="hidden lg:flex" style={{ height: 'calc(100svh - 3.5rem)', marginTop: '3.5rem' }}>

        {/* ── LINKE HÄLFTE: Foto + Overlay-Content ── */}
        <div className="relative w-[50%] h-full overflow-hidden shrink-0">
          <Image
            src="/Still%202025-03-19%20193121_19.7.1.jpg"
            alt="Dawid Faith"
            fill
            className="object-cover object-top"
            sizes="50vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0a0908]/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0908] via-[#0a0908]/55 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 px-12 pb-12">
            {stats.openQuests > 0 && (
              <div className="flex items-center gap-2 mb-5">
                <FaFire size={10} className="text-amber-400" />
                <span className="text-[10px] font-black tracking-[0.25em] uppercase text-amber-400">
                  {stats.openQuests} {tPlural('landing.questsAvailable_one', 'landing.questsAvailable_other', stats.openQuests, language)}
                </span>
              </div>
            )}

            <h1 className="text-[3.6rem] font-black leading-[0.95] tracking-tight mb-5">
              {t('landing.headline1', language)}<br />
              {t('landing.headline2', language)}<br />
              <span className="text-amber-400">{t('landing.headline3', language)}</span><br />
              {t('landing.headline4', language)}
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-1 max-w-xs">
              {t('landing.sub', language)}
            </p>
            <p className="text-xs text-zinc-600 font-medium tracking-widest mb-8">— Dawid Faith</p>

            {artists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black tracking-[0.35em] uppercase text-zinc-500">{t('landing.activeArtists', language)}</span>
                  {totalQuests > 0 && (
                    <>
                      <span className="text-zinc-800">·</span>
                      <span className="text-[9px] font-black tracking-[0.2em] uppercase text-amber-500">{totalQuests} {t('landing.open', language)}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-4 flex-wrap">
                  {artists.slice(0, 8).map((a) => (
                    <div key={a.walletAddress} className="relative flex flex-col items-center gap-1.5 cursor-default">
                      {a.picture ? (
                        <Image src={a.picture} alt={a.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <FaMusic size={11} className="text-zinc-600" />
                        </div>
                      )}
                      <span className="text-[9px] font-semibold text-zinc-400 truncate max-w-[60px] text-center">{a.name}</span>
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

            <div className="mb-2">
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-700 mb-2">
                {t('landing.tagline', language)}
              </p>
              <p className="text-[1.45rem] font-black text-white leading-snug">
                {t('landing.movement', language).split('\n')[0]}<br />
                <span className="text-amber-400">{t('landing.movement', language).split('\n')[1]}</span>
              </p>
            </div>

            <div className="flex gap-6 border-b border-white/[0.07] mt-8 mb-7 pb-0">
              {(['fan', 'artist'] as const).map((tabVal) => (
                <button
                  key={tabVal}
                  onClick={() => setTab(tabVal)}
                  className={`pb-3 text-[11px] font-black tracking-[0.25em] uppercase border-b-2 transition-all -mb-px ${
                    tab === tabVal
                      ? 'border-amber-400 text-white'
                      : 'border-transparent text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {tabVal === 'fan' ? t('landing.forFans', language) : t('landing.forArtists', language)}
                </button>
              ))}
            </div>

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
                            {t('landing.form.nameLabel', language)}
                          </label>
                          <input
                            value={artistName}
                            onChange={(e) => setArtistName(e.target.value)}
                            placeholder={t('landing.form.namePlaceholder', language)}
                            className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-amber-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black tracking-[0.3em] uppercase text-zinc-700 mb-1.5 block">
                            {t('landing.form.socialLabel', language)}
                          </label>
                          <input
                            value={artistSocial}
                            onChange={(e) => setArtistSocial(e.target.value)}
                            placeholder={t('landing.form.socialPlaceholder', language)}
                            className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-amber-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors"
                          />
                        </div>
                        <button
                          onClick={handleApply}
                          disabled={!artistName.trim() || sending}
                          className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-20 disabled:cursor-not-allowed text-black font-black text-xs tracking-[0.1em] uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {sending ? t('landing.form.submitting', language) : <>{t('landing.form.submit', language)} <FaChevronRight size={9} /></>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-14 text-center">
                      <FaCheckCircle size={30} className="text-amber-400 mx-auto mb-4" />
                      <p className="font-black text-white mb-2">{language === 'pl' ? `Dziękujemy, ${artistName}!` : language === 'en' ? `Thank you, ${artistName}!` : `Danke, ${artistName}!`}</p>
                      <p className="text-zinc-600 text-sm">{t('landing.form.successSub', language)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-10">
              <SignUpButton mode="modal">
                <button className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-black text-[13px] tracking-[0.1em] uppercase rounded-2xl transition-all shadow-[0_0_40px_rgba(251,191,36,0.15)]">
                  {t('landing.cta.signup', language)}
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="w-full py-3 border border-white/[0.06] hover:border-amber-400/20 text-zinc-600 hover:text-zinc-300 font-semibold text-[11px] tracking-[0.2em] uppercase transition-all rounded-xl">
                  {t('landing.cta.login', language)}
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
        <span className="text-[9px] text-zinc-800">© 2026</span>
      </footer>

    </main>
  );
}
