"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navigation from "../Navigation";
import QuestBoardTab from "../tabs/QuestBoardTab";
import ProfileTab from "../tabs/ProfileTab";
import SolanaWalletTab from "../tabs/SolanaWalletTab";
import ReputationTab from "../tabs/ReputationTab";
import ShopTab from "../tabs/ShopTab";
import type { SupportedLanguage } from "../utils/deepLTranslation";
import type { ArtistInfo } from "../tabs/quest-board/index";

const LAST_TAB_KEY = 'dfaith_last_tab';
const LAST_ARTIST_KEY = 'dfaith_last_artist';

function HomeContent() {
  const [activeTab, setActiveTab] = useState("profile");
  const [language, setLanguage] = useState<SupportedLanguage>("de");
  // Artist der direkt vom Profil-Tab zum Quest Board weitergeleitet wird
  const [questArtist, setQuestArtist] = useState<ArtistInfo | null>(null);
  const searchParams = useSearchParams();

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

  return (
    <main className="min-h-screen flex flex-col bg-[#13120e]">
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={handleTabChange}
        language={language}
        setLanguage={setLanguage}
      />
      <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-8">
        {activeTab === "profile" && <ProfileTab language={language} onNavigate={handleTabChange} onNavigateToArtistQuests={handleNavigateToArtistQuests} />}
        {activeTab === "quest-board" && <QuestBoardTab language={language} filterArtist={questArtist} onClearArtist={() => setQuestArtist(null)} artistWallet={artistParam} />}
        {activeTab === "solana-wallet" && <SolanaWalletTab />}
        {activeTab === "reputation" && <ReputationTab artistWallet={artistParam} />}
        {activeTab === "shop" && <ShopTab initialArtistWallet={artistParam} />}
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


