"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Navigation from "../Navigation";
import QuestBoardTab from "../tabs/QuestBoardTab";
import ProfileTab from "../tabs/ProfileTab";
import SolanaWalletTab from "../tabs/SolanaWalletTab";
import ReputationTab from "../tabs/ReputationTab";
import ShopTab from "../tabs/ShopTab";
import CollectiblesTab from "../tabs/CollectiblesTab";
import type { SupportedLanguage } from "../utils/deepLTranslation";
import type { ArtistInfo } from "../tabs/quest-board/index";
import { useLang, useSetLang } from "../components/LangContext";

const LAST_TAB_KEY = 'dfaith_last_tab';
const LAST_ARTIST_KEY = 'dfaith_last_artist';

function HomeContent() {
  const [activeTab, setActiveTab] = useState("profile");
  const language = useLang() as SupportedLanguage;
  const setLangCtx = useSetLang();
  const { user } = useUser();
  // Artist der direkt vom Profil-Tab zum Quest Board weitergeleitet wird
  const [questArtist, setQuestArtist] = useState<ArtistInfo | null>(null);
  const [shopArtistWallet, setShopArtistWallet] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const handleSetLanguage = (lang: SupportedLanguage) => {
    setLangCtx(lang);
  };

  // Referral-Code aus localStorage speichern — nur für neue Konten (UNIQUE-Constraint verhindert Doppelungen)
  useEffect(() => {
    if (!user?.id) return;
    const referralCode = typeof window !== 'undefined' ? localStorage.getItem('dfaith_referral') : null;
    if (!referralCode || referralCode === user.id.toLowerCase()) return;
    fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrerWallet: referralCode, referredWallet: user.id }),
    }).then(r => {
      // Bei Erfolg (gespeichert) oder 400 (Selbst-Referral) localStorage löschen
      if ((r.ok || r.status === 400) && typeof window !== 'undefined') {
        localStorage.removeItem('dfaith_referral');
      }
    }).catch(() => {});
  }, [user?.id]);

  // Beim ersten Laden: gespeicherten Tab + Artist wiederherstellen (URL-Parameter hat Vorrang)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
      return;
    }
    const saved = localStorage.getItem(LAST_TAB_KEY);
    if (saved) {
      setActiveTab(saved);
      if (saved === 'quest-board') {
        const savedArtist = localStorage.getItem(LAST_ARTIST_KEY);
        if (savedArtist) {
          try { setQuestArtist(JSON.parse(savedArtist)); } catch {}
        }
      }
    }
  }, [searchParams]);

  const artistParam = searchParams.get("artist");

  // Wenn Tab manuell gewechselt wird, questArtist zurücksetzen + Tab speichern
  const handleTabChange = (tab: string) => {
    if (tab !== "quest-board") {
      setQuestArtist(null);
      localStorage.removeItem(LAST_ARTIST_KEY);
    }
    setActiveTab(tab);
    localStorage.setItem(LAST_TAB_KEY, tab);
  };

  const handleNavigateToArtistQuests = (artist: ArtistInfo) => {
    setQuestArtist(artist);
    setActiveTab("quest-board");
    localStorage.setItem(LAST_TAB_KEY, "quest-board");
    localStorage.setItem(LAST_ARTIST_KEY, JSON.stringify(artist));
  };

  const handleNavigateToArtistShop = (artistWallet: string) => {
    setShopArtistWallet(artistWallet);
    setActiveTab("shop");
    localStorage.setItem(LAST_TAB_KEY, "shop");
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#13120e]">
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={handleTabChange}
        language={language}
        setLanguage={handleSetLanguage}
      />
      <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-8">
        {activeTab === "profile" && <ProfileTab language={language} onNavigate={handleTabChange} onNavigateToArtistQuests={handleNavigateToArtistQuests} onNavigateToArtistShop={handleNavigateToArtistShop} />}
        {activeTab === "quest-board" && <QuestBoardTab language={language} filterArtist={questArtist} onClearArtist={() => setQuestArtist(null)} artistWallet={artistParam} />}
        {activeTab === "solana-wallet" && <SolanaWalletTab />}
        {activeTab === "reputation" && <ReputationTab artistWallet={artistParam} />}
        {activeTab === "shop" && <ShopTab initialArtistWallet={shopArtistWallet ?? artistParam} />}
        {activeTab === "collectibles" && <CollectiblesTab />}
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col bg-[#13120e]">
        <div className="fixed top-0 left-0 w-full bg-zinc-900 border-b border-zinc-800 z-50 h-16"></div>
        <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-8">
          <div className="flex items-center justify-center">
            <div className="border-4 border-white/20 border-t-white rounded-full w-12 h-12 animate-spin"></div>
          </div>
        </section>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}


