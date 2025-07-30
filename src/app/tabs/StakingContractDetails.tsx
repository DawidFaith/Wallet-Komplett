import { useEffect, useState } from "react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { base } from "thirdweb/chains";

const DFAITH_TOKEN = {
  address: "0x69eFD833288605f320d77eB2aB99DDE62919BbC1",
  decimals: 2,
  symbol: "D.FAITH"
};
const STAKING_CONTRACT = {
  address: "0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940",
};

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID!,
});

export default function StakingContractDetails() {
  const [rewardBalance, setRewardBalance] = useState<string>("-");
  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState<string>("-");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const stakingContract = getContract({ client, chain: base, address: STAKING_CONTRACT.address });
        // getContractInfo liefert: totalStakedTokens, rewardBalance, currentStage, currentRate
        const contractInfo = await readContract({
          contract: stakingContract,
          method: "function getContractInfo() view returns (uint256,uint256,uint8,uint256)",
          params: []
        });
        const rewardBalanceRaw = contractInfo[1];
        setRewardBalance((Number(rewardBalanceRaw) / Math.pow(10, DFAITH_TOKEN.decimals)).toFixed(DFAITH_TOKEN.decimals));

        // totalRewardsDistributed ist public, kann direkt gelesen werden
        const totalRewards = await readContract({
          contract: stakingContract,
          method: "function totalRewardsDistributed() view returns (uint256)",
          params: []
        });
        setTotalRewardsDistributed((Number(totalRewards) / Math.pow(10, DFAITH_TOKEN.decimals)).toFixed(DFAITH_TOKEN.decimals));
      } catch (e) {
        setRewardBalance("-");
        setTotalRewardsDistributed("-");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-zinc-900 rounded-xl border border-purple-500/30 p-6 flex flex-col gap-4 items-start mt-8">
      {/* Kopfbereich mit Icon, Titel, Untertitel */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-purple-500/20">
          <span className="text-purple-400 text-3xl">🔒</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-purple-400">Staking Contract</h3>
          <p className="text-zinc-400 text-sm">Smart Contract für D.INVEST Staking & Rewards</p>
        </div>
      </div>

      {/* Details-Box */}
      <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20 w-full">
        <h4 className="font-semibold text-purple-300 mb-3">📋 Vertragsdetails</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-400">Vertragstyp:</span>
            <div className="text-white font-semibold">Staking Contract</div>
          </div>
          <div>
            <span className="text-zinc-400">Adresse:</span>
            <div className="text-blue-400 font-mono text-xs break-all">0xe85b...9940</div>
            <a href="https://basescan.org/address/0xe85b32a44b9eD3ecf8bd331FED46fbdAcDBc9940#code" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs">Vollständige Adresse</a>
          </div>
          <div>
            <span className="text-zinc-400">Sicherheit:</span>
            <div className="text-green-400 font-semibold">ReentrancyGuard</div>
          </div>
          <div>
            <span className="text-zinc-400">Staking-Token:</span>
            <div className="text-blue-400 font-semibold">D.INVEST (0 Dezimalstellen)</div>
          </div>
          <div>
            <span className="text-zinc-400">Belohnungs-Token:</span>
            <div className="text-amber-400 font-semibold">D.FAITH (2 Dezimalstellen)</div>
          </div>
          <div>
            <span className="text-zinc-400">Min. Auszahlungsbetrag:</span>
            <div className="text-white font-semibold">0.01 D.FAITH</div>
          </div>
        </div>
      </div>

      {/* Live Rewards-Box */}
      <div className="bg-zinc-800/50 rounded-lg p-4 border border-amber-400/20 w-full">
        <h4 className="font-semibold text-amber-400 mb-3">💸 Live Rewards</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Verfügbare Rewards im Contract:</span>
            <span className="text-amber-400 font-semibold">{loading ? "..." : rewardBalance + " D.FAITH"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Bereits ausgeschüttete Rewards:</span>
            <span className="text-green-400 font-semibold">{loading ? "..." : totalRewardsDistributed + " D.FAITH"}</span>
          </div>
        </div>
      </div>
      {/* Reward-Stufen Übersicht */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 w-full mt-4">
        <h4 className="font-semibold text-orange-400 mb-3">📈 Reward-Stufen (Halving-System)</h4>
        <div className="space-y-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-green-400 font-semibold">Stufe 1</span>
              <span className="text-green-400 font-bold">10% / Woche</span>
            </div>
            <div className="text-xs text-zinc-400">0 – 10.000 D.FAITH ausgeschüttet</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-blue-400 font-semibold">Stufe 2</span>
              <span className="text-blue-400 font-bold">5% / Woche</span>
            </div>
            <div className="text-xs text-zinc-400">10.000 – 20.000 D.FAITH</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-purple-400 font-semibold">Stufe 3</span>
              <span className="text-purple-400 font-bold">2,5% / Woche</span>
            </div>
            <div className="text-xs text-zinc-400">20.000 – 40.000 D.FAITH</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-yellow-400 font-semibold">Stufe 4</span>
              <span className="text-yellow-400 font-bold">1,25% / Woche</span>
            </div>
            <div className="text-xs text-zinc-400">40.000 – 60.000 D.FAITH</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-red-400 font-semibold">Stufe 5</span>
              <span className="text-red-400 font-bold">0,63% / Woche</span>
            </div>
            <div className="text-xs text-zinc-400">60.000 – 80.000 D.FAITH</div>
          </div>
          <div className="bg-zinc-500/10 border border-zinc-500/20 rounded p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-zinc-400 font-semibold">Stufe 6</span>
              <span className="text-zinc-400 font-bold">0,31% / Woche</span>
            </div>
            <div className="text-xs text-zinc-400">80.000+ D.FAITH (Finale Stufe)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
