"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navigation from "./Navigation";
import WalletTab from "./tabs/WalletTab";
import TokenomicsTab from "./tabs/TokenomicsTab";
import MerchTab from "./tabs/MerchTab";
import StreamTab from "./tabs/StreamTab";
import LiveTab from "./tabs/LiveTab";
import InstagramTab from "./tabs/InstagramTab";
import TiktokTab from "./tabs/TiktokTab";
import FacebookTab from "./tabs/FacebookTab";

function HomeContent() {
  const [activeTab, setActiveTab] = useState("wallet");
  const searchParams = useSearchParams();

  // URL-Parameter für Tab laden
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen flex flex-col bg-zinc-950">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-8">
        {activeTab === "wallet" && <WalletTab />}
        {activeTab === "tokenomics" && <TokenomicsTab />}
        {activeTab === "merch" && <MerchTab />}
        {activeTab === "stream" && <StreamTab />}
        {activeTab === "live" && <LiveTab />}
        {activeTab === "instagram" && <InstagramTab />}
        {activeTab === "tiktok" && <TiktokTab />}
        {activeTab === "facebook" && <FacebookTab />}
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col bg-zinc-950">
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


