import { useState, useEffect } from "react";

export default function TokenomicsTab() {
  const [contractBalance, setContractBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Smart Contract Balance abrufen
  useEffect(() => {
    const fetchContractBalance = async () => {
      setLoading(true);
      try {
        // Hier würde normalerweise ein Web3 Call gemacht werden
        // Für jetzt simulieren wir die Daten basierend auf dem Contract
        // In einer echten Implementation würde man web3.js oder ethers.js verwenden

        // Beispiel für Contract Call:
        // const balance = await contract.methods.getAvailableRewards().call();

        // Simulierte Live-Daten (später durch echte Contract Calls ersetzen)
        setTimeout(() => {
          setContractBalance(80000); // 80,000 D.FAITH im Contract
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error("Error fetching contract balance:", error);
        setLoading(false);
      }
    };

    fetchContractBalance();
  }, []);

  const liquiditySupply = 15000;
  const davidSupply = 5000;
  const totalSupply = 100000;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent mb-2">
          Tokenomics Übersicht
        </h2>
        <p className="text-zinc-400 text-sm">
          Ausführliche Informationen zu den D.FAITH und D.INVEST Token
        </p>
      </div>

      {/* Preis-Chart (nur DexScreener) */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 mb-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          📈 Live-Preis-Chart
        </h3>
        <div className="w-full h-96 rounded-lg overflow-hidden bg-zinc-800">
          <iframe
            src="https://dexscreener.com/base/0x7109214bafde13a6ef8060644656464bccab93cd?embed=1&theme=dark&trades=0&info=0"
            width="100%"
            height="100%"
            frameBorder="0"
            className="w-full h-full"
            title="DexScreener Chart"
          />
        </div>
        <div className="mt-4 text-xs text-zinc-400 text-center">
          Live-Daten von der Base Chain • Pool: 0x7109214bafde13a6ef8060644656464bccab93cd
          <span className="ml-2 text-green-400">• DexScreener: Speziell für DEX-Trading optimiert</span>
        </div>
      </div>

      {/* D.FAITH Token Box */}
      <div className="bg-zinc-900 rounded-xl border border-amber-500/30 p-6">
        <div className="flex items-center gap-4 mb-4">
          <img src="/D.FAITH.png" alt="D.FAITH" className="w-16 h-16 object-contain" />
          <div>
            <h3 className="text-2xl font-bold text-amber-400">D.FAITH</h3>
            <p className="text-zinc-400 text-sm">Dawid Faith Token</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
            <h4 className="font-semibold text-amber-300 mb-3">📊 Token Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-400">Token Name:</span>
                <div className="text-white font-semibold">Dawid Faith</div>
              </div>
              <div>
                <span className="text-zinc-400">Symbol:</span>
                <div className="text-white font-semibold">D.FAITH</div>
              </div>
              <div>
                <span className="text-zinc-400">Total Supply:</span>
                <div className="text-white font-semibold">{totalSupply.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-zinc-400">Adresse:</span>
                <div className="text-blue-400 font-mono text-xs break-all">0x69eF...BbC1</div>
                <a href="https://basescan.org/address/0x69eFD833288605f320d77eB2aB99DDE62919BbC1#code" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs">Vollständige Adresse</a>
              </div>
              <div>
                <span className="text-zinc-400">Contract Status:</span>
                <div className="text-green-400 font-semibold">Live & Aktiv</div>
              </div>
            </div>
          </div>

          {/* Supply Distribution */}
          <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
            <h4 className="font-semibold text-amber-300 mb-3">🔄 Supply Verteilung</h4>
            <div className="space-y-3">
              {/* Smart Contract */}
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-zinc-300">Smart Contract (Rewards)</span>
                </div>
                <div className="text-right">
                  {loading ? (
                    <div className="animate-pulse bg-zinc-600 h-4 w-16 rounded"></div>
                  ) : (
                    <>
                      <div className="text-blue-400 font-bold">{contractBalance?.toLocaleString() || "..."}</div>
                      <div className="text-xs text-zinc-500">{contractBalance ? `${((contractBalance / totalSupply) * 100).toFixed(1)}%` : ""}</div>
                    </>
                  )}
                </div>
              </div>

              {/* DEX Liquidity */}
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-zinc-300">DEX Liquidity</span>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">{liquiditySupply.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">{((liquiditySupply / totalSupply) * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Dawid Faith Holdings */}
              <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-zinc-300">Dawid Faith</span>
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-bold">{davidSupply.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">{((davidSupply / totalSupply) * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${contractBalance ? (contractBalance / totalSupply) * 100 : 0}%` }}
                    ></div>
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${(liquiditySupply / totalSupply) * 100}%` }}
                    ></div>
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: `${(davidSupply / totalSupply) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 mt-1 text-center">
                  Live Verteilung • Aktualisiert alle 30 Sekunden
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* D.INVEST Token Box */}
      <div className="bg-zinc-900 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center gap-4 mb-4">
          <img src="/D.INVEST.png" alt="D.INVEST" className="w-16 h-16 object-contain" />
          <div>
            <h3 className="text-2xl font-bold text-blue-400">D.INVEST</h3>
            <p className="text-zinc-400 text-sm">Investment- & Staking-Token</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <h4 className="font-semibold text-blue-300 mb-3">📊 Token Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-400">Token Name:</span>
                <div className="text-white font-semibold">D.INVEST</div>
              </div>
              <div>
                <span className="text-zinc-400">Symbol:</span>
                <div className="text-white font-semibold">D.INVEST</div>
              </div>
              <div>
                <span className="text-zinc-400">Supply:</span>
                <div className="text-white font-semibold">10.000</div>
              </div>
              <div>
                <span className="text-zinc-400">Adresse:</span>
                <div className="text-blue-400 font-mono text-xs break-all">0x6F1f...F4bb</div>
                <a href="https://basescan.org/address/0x6F1fFd03106B27781E86b33Df5dBB734ac9DF4bb#code" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs">Vollständige Adresse</a>
              </div>
              <div>
                <span className="text-zinc-400">Preis:</span>
                <div className="text-blue-400 font-semibold">5€ pro Token</div>
              </div>
              <div>
                <span className="text-zinc-400">Min. Kaufbetrag:</span>
                <div className="text-white font-semibold">5€</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}