"use client";

import { useState } from "react";
import Navigation from "../Navigation";
import WalletTab from "../tabs/WalletTab";

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState("wallet");

  return (
    <main className="min-h-screen flex flex-col bg-zinc-950">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-8">
        <WalletTab />
      </section>
    </main>
  );
}
