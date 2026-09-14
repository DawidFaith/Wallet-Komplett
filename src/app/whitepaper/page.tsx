import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'D.FAITH Whitepaper',
  description: 'Token-Daten, Utility und Mechanik von D.FAITH — dem nativen Token des D.FAITH Ecosystems.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-[11px] font-black tracking-[0.3em] uppercase text-amber-400 mb-4">{title}</h2>
      <div className="space-y-4 text-[15px] text-zinc-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2.5 border-b border-white/[0.06]">
      <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-zinc-500 sm:w-48 shrink-0">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}

export default function WhitepaperPage() {
  return (
    <main className="bg-[#0a0908] text-white min-h-screen">
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 h-14 bg-[#0a0908]/90 backdrop-blur-lg border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/D.FAITH.png" alt="" width={24} height={24} className="rounded-lg" priority />
          <div className="leading-none">
            <div className="text-[11px] font-black tracking-[0.3em] uppercase text-white">D.FAITH</div>
            <div className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/50 mt-px">Ecosystem</div>
          </div>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-400 hover:text-amber-400 transition-colors"
        >
          <FaArrowLeft size={10} /> Zurück
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
        <p className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-500 mb-3">Whitepaper</p>
        <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
          D.FAITH <span className="text-amber-400">Token</span>
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed mb-14 max-w-lg">
          D.FAITH ist der native Utility-Token des D.FAITH Ecosystems — der Belohnungs-, Zahlungs- und
          Wertträger für Fans und Artists innerhalb der Plattform.
        </p>

        <Section title="Token-Basics">
          <div>
            <Fact label="Symbol" value="DFAITH" />
            <Fact label="Name" value="D.FAITH" />
            <Fact label="Netzwerk" value="Solana (SPL Token)" />
            <Fact label="Dezimalstellen" value="2" />
            <Fact label="Freeze Authority" value="deaktiviert (nicht einfrierbar)" />
            <Fact label="Supply" value="live on-chain einsehbar, transparent über jeden Solana-Explorer" />
          </div>
        </Section>

        <Section title="Utility — wofür D.FAITH genutzt wird">
          <ul className="list-disc list-outside pl-5 space-y-2">
            <li>Belohnung für abgeschlossene Social-Media-Quests (YouTube, Instagram, TikTok, Facebook)</li>
            <li>Zahlungsmittel im Shop für Songs und digitale Collectibles (NFTs)</li>
            <li>Währung im Peer-to-Peer-NFT-Marktplatz zwischen Fans</li>
            <li>Grundlage des Reputation-Level-Systems: höhere Level erhöhen den Quest-Reward-Bonus</li>
            <li>Direkt gegen SOL tauschbar über eine integrierte Swap-Funktion (Jupiter-Aggregator)</li>
          </ul>
        </Section>

        <Section title="Preisbildung">
          <p>
            D.FAITH hat keinen fixen internen Preis — der Kurs bildet sich frei über den Markt (DEX-Liquidität
            auf Solana). Live-Kurse werden über GeckoTerminal und Jupiter bezogen; Swaps laufen über den
            Jupiter-Aggregator.
          </p>
          <p>
            Ausnahme ist der Fiat-Einstieg: Guthaben („Credits“), das per Karte gekauft wird, ist intern fix mit
            1&nbsp;€&nbsp;=&nbsp;100&nbsp;D.FAITH-Credits hinterlegt — unabhängig vom Marktkurs des Tokens.
          </p>
        </Section>

        <Section title="Marktplatz-Gebühren">
          <p>Bei jedem Verkauf eines NFTs auf dem Sekundärmarkt wird der Erlös in D.FAITH wie folgt aufgeteilt:</p>
          <div>
            <Fact label="Verkäufer" value="92,5 %" />
            <Fact label="Artist-Royalty" value="5 %" />
            <Fact label="Plattformgebühr" value="2,5 %" />
          </div>
        </Section>

        <Section title="Reputation & Level">
          <p>
            Fans steigen durch Aktivität im Ecosystem in einem 100-stufigen Reputation-System auf (10 Tiers à
            10 Level). Jedes Level erhöht den Quest-Reward-Bonus linear — von 0 % auf Level 1 bis zu 99 % auf
            Level 100. Artists können pro Level zusätzlich einmalige D.FAITH-Belohnungen für Level-Ups
            konfigurieren.
          </p>
        </Section>

        <p className="text-xs text-zinc-500 leading-relaxed mt-16 pt-8 border-t border-white/[0.06]">
          Dieses Dokument wird laufend um weitere Details ergänzt (u. a. Tokenverteilung und Staking-Mechanik).
          Alle Angaben ohne Gewähr — maßgeblich sind die On-Chain-Daten auf Solana.
        </p>
      </div>
    </main>
  );
}
