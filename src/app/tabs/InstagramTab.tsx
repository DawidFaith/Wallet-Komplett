import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Hilfsfunktionen für Level/EXP
const levelThresholds = [39, 119, 239, 399, 599, 839, 1119, 1439, 1799, 2199, 2639, 3119, 3639, 4199, 4799, 5439, 6119, 6839, 7599, 8399, 9239, 10119, 11039, 11999, 12999, 14039, 15119, 16239, 17399, 18599, 19839, 21119, 22439, 23799, 25199, 26639, 28119, 29639, 31199, 32799, 34439, 36119, 37839, 39599, 41399, 43239, 45119, 47039, 48999, 99999999];
const levelMins = [0, 40, 120, 240, 400, 600, 840, 1120, 1440, 1800, 2200, 2640, 3120, 3640, 4200, 4800, 5440, 6120, 6840, 7600, 8400, 9240, 10120, 11040, 12000, 13000, 14040, 15120, 16240, 17400, 18600, 19840, 21120, 22440, 23800, 25200, 26640, 28120, 29640, 31200, 32800, 34440, 36120, 37840, 39600, 41400, 43240, 45120, 47040, 49000];

function getLevelAndExpRange(exp: number) {
  let level = 1;
  let minExp = 0;
  let maxExp = 39;
  for (let i = 0; i < levelThresholds.length; i++) {
    if (exp <= levelThresholds[i]) {
      level = i + 1;
      maxExp = levelThresholds[i];
      minExp = levelMins[i];
      break;
    }
  }
  return { level, minExp, maxExp };
}

function getQueryParam(param: string) {
  if (typeof window === "undefined") return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Modale als Komponenten
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed z-[1000] left-0 top-0 w-full h-full bg-black/60 flex justify-center items-center">
      <div className="bg-white text-black font-bold p-6 rounded-2xl max-w-sm w-full text-center text-base relative">
        <button
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-900 text-xl font-bold focus:outline-none"
          onClick={onClose}
          aria-label="Schließen"
          style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default function InstagramTab() {
  const router = useRouter();
  // State für Userdaten
  const [username, setUsername] = useState("@User");
  const [profileImage, setProfileImage] = useState("");
  const [exp, setExp] = useState(0);
  const [miningPower, setMiningPower] = useState(0);
  const [expTiktok, setExpTiktok] = useState(0);
  const [expInstagram, setExpInstagram] = useState(0);
  const [expStream, setExpStream] = useState(0);
  const [expFacebook, setExpFacebook] = useState(0);
  const [liveExp, setLiveExp] = useState(0);
  const [checkLike, setCheckLike] = useState(false);
  const [checkComment, setCheckComment] = useState(false);
  const [checkStory, setCheckStory] = useState(false);
  const [checkSave, setCheckSave] = useState(false);
  const [wallet, setWallet] = useState("");
  const [claimStatus, setClaimStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExpSources, setShowExpSources] = useState(false);

  // Modale
  const [modal, setModal] = useState<null | "upgrade" | "claim" | "storyHelp" | "likeSave" | "confirmCheckInitial" | "confirmCheckAfter" | "info" | "walletInfo">(null);
  // Like/Save Check Werte
  const [likeStart, setLikeStart] = useState<number | null>(null);
  const [saveStart, setSaveStart] = useState<number | null>(null);
  const [likeAfter, setLikeAfter] = useState<number | null>(null);
  const [saveAfter, setSaveAfter] = useState<number | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  // Level/Progress
  const { level, minExp, maxExp } = getLevelAndExpRange(exp);
  const currentLevelExp = exp - minExp;
  const levelRange = maxExp - minExp;
  const progressPercent = Math.round((currentLevelExp / (levelRange || 1)) * 100);

  // uuid aus URL oder Defaultwert
  const uuid = typeof window !== "undefined" && getQueryParam("uuid") ? getQueryParam("uuid") : "dfaith3789953";

  // Userdaten laden
  useEffect(() => {
    if (!uuid) return;
    setLoading(true);
    fetch("https://uuid-check-insta.vercel.app/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid })
    })
      .then((res) => res.json())
      .then((data) => {
        setUsername("@" + (data.username || "User"));
        setProfileImage(data.image || "https://via.placeholder.com/100");
        setExp(parseInt(data.expTotal) || 0);
        setMiningPower(Number(data.miningpower) || 0);
        setExpTiktok(Number(data.expTiktok) || 0);
        setExpInstagram(Number(data.expInstagram) || 0);
        setExpStream(Number(data.expStream) || 0);
        setExpFacebook(Number(data.expFacebook) || 0);
        setLiveExp(Number(data.liveNFTBonus) || 0);
        setCheckLike(data.liked === "true");
        setCheckComment(data.commented === "true");
        setCheckStory(data.story === "true");
        setCheckSave(data.saved === "true");
        if (data.wallet && data.wallet.startsWith("0x")) setWallet(data.wallet);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uuid]);

  // Like/Save Startwerte aus localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const likeStored = localStorage.getItem("dfaith_likeStart");
    const saveStored = localStorage.getItem("dfaith_saveStart");
    if (likeStored && saveStored) {
      setLikeStart(Number(likeStored));
      setSaveStart(Number(saveStored));
    }
  }, []);

  // Like/Save Check API
  const checkInitial = () => {
    if (!uuid) return;
    setLoading(true);
    fetch(`https://hook.eu2.make.com/bli0jo4nik0m9r4x9aj76ptktghdzckd?uuid=${encodeURIComponent(uuid)}`)
      .then((res) => res.json())
      .then((data) => {
        setLikeStart(Number(data.likes));
        setSaveStart(Number(data.saves));
        if (typeof window !== "undefined") {
          localStorage.setItem("dfaith_likeStart", String(data.likes));
          localStorage.setItem("dfaith_saveStart", String(data.saves));
        }
      })
      .finally(() => setLoading(false));
  };
  const checkAfter = () => {
    if (!uuid) return;
    setLoading(true);
    fetch(`https://hook.eu2.make.com/bli0jo4nik0m9r4x9aj76ptktghdzckd?uuid=${encodeURIComponent(uuid)}`)
      .then((res) => res.json())
      .then((data) => {
        setLikeAfter(Number(data.likes));
        setSaveAfter(Number(data.saves));
        if (likeStart !== null && saveStart !== null && Number(data.likes) > likeStart && Number(data.saves) > saveStart) {
          setConfirmationMessage("✅ Erfolgreich! Bitte lade die Seite neu.");
        }
      })
      .finally(() => setLoading(false));
  };

  // Claim absenden
  const submitClaim = () => {
    setClaimStatus("");
    if (!wallet.startsWith("0x") || wallet.length < 42) {
      setClaimStatus("❌ Ungültige Wallet-Adresse.");
      return;
    }
    setLoading(true);
    fetch("https://hook.eu2.make.com/1c62icx2yngv8v4g6y7k7songq01rblk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid, wallet, username: username.replace("@", "").trim(), miningpower: miningPower })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" || data.success === true || data.claimed === true) {
          setClaimStatus(data.message || "✅ Claim erfolgreich ausgelöst!");
          if (typeof window !== "undefined") localStorage.clear();
        } else {
          setClaimStatus("❌ Fehler: " + (data.message || "Unbekannter Fehler."));
        }
      })
      .catch(() => setClaimStatus("❌ Netzwerkfehler oder ungültige Antwort."))
      .finally(() => setLoading(false));
  };

  // UI
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#e5e7eb] p-0 font-[SF Pro Display,Poppins,sans-serif]">
      {/* Lade-Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex flex-col items-center justify-center">
          <div className="border-4 border-white/20 border-t-white rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p className="text-white font-bold text-lg drop-shadow">Wird verarbeitet...</p>
        </div>
      )}

      {/* Modale */}
      <Modal open={modal === "info"} onClose={() => setModal(null)}>
        <p className="text-lg font-bold mb-4">📊 Deine EXP-Quellen</p>
        <div className="text-left text-base space-y-2">
          <div className="flex items-center gap-2 border-l-4 border-pink-500 pl-2"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-5 h-5 rounded-full" /><b>Instagram:</b> <span>{expInstagram} EXP</span></div>
          <div className="flex items-center gap-2 border-l-4 border-black pl-2"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TikTok" className="w-5 h-5 rounded-full" /><b>TikTok:</b> <span>{expTiktok} EXP</span></div>
          <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-2"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-5 h-5" /><b>Facebook:</b> <span>{expFacebook} EXP</span></div>
          <div className="flex items-center gap-2 border-l-4 border-purple-700 pl-2"><img src="https://cdn-icons-png.flaticon.com/512/727/727245.png" alt="Stream" className="w-5 h-5 rounded-full" /><b>Stream:</b> <span>{expStream} EXP</span></div>
          <div className="flex items-center gap-2 border-l-4 border-yellow-400 pl-2"><img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Live" className="w-5 h-5 rounded-full" /><b>Live:</b> <span>{liveExp} EXP</span></div>
        </div>
      </Modal>
      <Modal open={modal === "upgrade"} onClose={() => setModal(null)}>
        <p className="text-xl font-bold mb-4">✨ Sammle mehr EXP!</p>
        <div className="flex flex-col gap-3 w-full">
          <button className="modal-btn w-full py-3 rounded-2xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base tracking-tight flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300" onClick={() => setModal("likeSave")}>❤️ 💾 <span>Like + Save</span></button>
          <button className="modal-btn w-full py-3 rounded-2xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base tracking-tight flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300" onClick={() => setModal("storyHelp")}>📣 <span>Story teilen</span></button>
        </div>
      </Modal>
      <Modal open={modal === "claim"} onClose={() => setModal(null)}>
        <div className="flex justify-center mb-2">
          <div onClick={() => setModal("walletInfo")}
            className="bg-white text-pink-600 font-bold rounded-full w-7 h-7 flex items-center justify-center shadow cursor-pointer">i</div>
        </div>
        <p className="text-lg font-bold mb-2">🪙 Wallet benötigt für Claim</p>
        {!wallet || !wallet.startsWith("0x") ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-zinc-800 text-base flex flex-col items-center animate-pulse">
            <span className="font-semibold mb-2 text-center">Du hast noch keine Wallet hinterlegt.<br/>Erstelle jetzt deine Wallet, um deine Belohnung zu erhalten!</span>
            <button
              className="w-full mt-2 mb-1 py-2 px-4 rounded-xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-zinc-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition text-base border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center block"
              onClick={() => router.push("/wallet")}
            >
              🚀 Wallet jetzt anlegen
            </button>
            <span className="text-xs text-zinc-500 mt-2">Du findest den Wallet Tab auch oben im Menü.</span>
          </div>
        ) : null}
        <input
          className="w-full p-2 my-2 rounded-lg border border-gray-300 text-black text-base focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition"
          type="text"
          placeholder="0x..."
          value={wallet}
          onChange={e => setWallet(e.target.value)}
          readOnly={!!wallet && wallet.startsWith("0x")}
        />
        <button
          className="modal-btn w-full py-3 rounded-2xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-zinc-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition text-base tracking-tight flex items-center justify-center gap-2 border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={submitClaim}
          disabled={!wallet || !wallet.startsWith("0x")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mr-1"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#FFA500" strokeWidth="2"/><text x="12" y="16" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">₿</text></svg>
          Claim
        </button>
        <p className="mt-2 min-h-[1.5em] text-center" style={{ color: claimStatus.startsWith("✅") ? "green" : claimStatus.startsWith("❌") ? "red" : undefined }}>{claimStatus}</p>
      </Modal>
      <Modal open={modal === "storyHelp"} onClose={() => setModal(null)}>
        <p>📣 Bitte teile meinen Beitrag in deiner Instagram-Story<br/><b>@dawidfaith</b>, damit du dein Upgrade erhältst.</p>
      </Modal>
      <Modal open={modal === "likeSave"} onClose={() => setModal(null)}>
        <div className="flex flex-col items-center gap-2 mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="gold-gradient-modal" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFD700"/>
                <stop offset="1" stopColor="#FFA500"/>
              </linearGradient>
            </defs>
            <path d="M3 21l2-2 7-7V7.83l2-2V11l7 7 2 2-1.41 1.41L12 13.41l-7.59 7.59L3 21z" fill="url(#gold-gradient-modal)"/>
            <rect x="11" y="2" width="2" height="6" rx="1" fill="url(#gold-gradient-modal)"/>
          </svg>
          <p className="text-lg font-bold text-zinc-900">Account Upgrade</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-zinc-800 text-base flex flex-col items-center">
            <span className="font-semibold mb-1">1️⃣ Entferne alle Likes und Saves von meinem Beitrag.</span>
            <button className="modal-btn w-full py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 mt-2" onClick={() => setModal("confirmCheckInitial")}>✅ Check aktuelle Werte</button>
            {likeStart !== null && saveStart !== null && (
              <div className="flex gap-4 mt-2">
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Likes: <b>{likeStart}</b></div>
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Saves: <b>{saveStart}</b></div>
              </div>
            )}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-zinc-800 text-base flex flex-col items-center">
            <span className="font-semibold mb-1">2️⃣ Like & speichere den Beitrag erneut, dann fortfahren!</span>
            <button className="modal-btn w-full py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 mt-2" onClick={() => setModal("confirmCheckAfter")}>✅ Check neue Werte</button>
            {likeAfter !== null && saveAfter !== null && (
              <div className="flex gap-4 mt-2">
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Likes: <b>{likeAfter}</b></div>
                <div className="bg-white/80 border border-zinc-200 rounded-lg px-3 py-1 text-zinc-900 text-sm">Saves: <b>{saveAfter}</b></div>
              </div>
            )}
          </div>
        </div>
        {confirmationMessage && <p className="text-green-600 font-bold mt-4 text-center">{confirmationMessage}</p>}
        <button className="modal-btn w-full mt-4 py-2 rounded-xl font-semibold bg-white text-zinc-900 shadow hover:bg-zinc-100 active:bg-zinc-200 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300" onClick={() => { if (typeof window !== "undefined") { localStorage.clear(); window.location.reload(); } }}>🔄 Neu laden</button>
      </Modal>
      <Modal open={modal === "confirmCheckInitial"} onClose={() => setModal(null)}>
        <p>Bitte <b>entferne zuerst alle Likes und Saves</b> von meinem Beitrag – danach werden die aktuellen Zahlen gespeichert.</p>
        <p className="text-yellow-400 font-bold mt-2">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
        <div className="flex gap-3 mt-4">
          <button className="modal-btn flex-1 py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 w-full" onClick={() => { setModal("likeSave"); checkInitial(); }}>✅ Ja, fortfahren</button>
        </div>
      </Modal>
      <Modal open={modal === "confirmCheckAfter"} onClose={() => setModal(null)}>
        <p>Bitte <b>like und speichere den Beitrag erneut</b>, bevor du fortfährst – gleich werden die neuen Zahlen gespeichert.</p>
        <p className="text-yellow-400 font-bold mt-2">⚠️ Diese Aktion ist nur einmal möglich pro Beitrag!</p>
        <div className="flex gap-3 mt-4">
          <button className="modal-btn flex-1 py-2 rounded-xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 w-full" onClick={() => { setModal("likeSave"); checkAfter(); }}>✅ Ja, fortfahren</button>
        </div>
      </Modal>
      <Modal open={modal === "walletInfo"} onClose={() => setModal(null)}>
        <p><b>🔒 Wichtiger Hinweis:</b><br/><br/>Deine Wallet-Adresse wird dauerhaft mit deinem Social-Media-Account verbunden.<br/><br/>Wenn du sie ändern willst, schreib mir eine <b>DM mit dem Stichwort „Wallet“</b> auf <b>Instagram</b>.</p>
      </Modal>

      {/* Card */}
      <div className="card w-full max-w-[350px] bg-white/90 rounded-3xl shadow-xl border border-zinc-200/80 relative overflow-hidden p-6 sm:p-8 text-zinc-900 text-center flex flex-col items-center" style={{boxShadow:'0 8px 32px 0 #0001, 0 1.5px 8px 0 #fff8'}}>
        <div className="username text-[2.1rem] sm:text-[2.4rem] font-semibold mb-2 flex items-center justify-center gap-2 tracking-tight" style={{fontFamily:'SF Pro Display,Poppins,Arial,sans-serif', letterSpacing:'0.01em'}}>
          <span className="text-zinc-900/90">{username}</span>
        </div>
        <div className="relative mb-4">
          <img
            src={profileImage || "https://via.placeholder.com/100"}
            alt="Profilbild"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover mx-auto border-4 border-zinc-200 shadow-md"
            style={{boxShadow:'0 0 0 4px #e5e7eb, 0 2px 16px 0 #0001'}}
          />
          <div className="absolute -inset-1 rounded-full bg-white/60 blur-[8px] z-[-1]"></div>
        </div>
        <div className="level-box bg-white/70 rounded-2xl p-4 sm:p-5 mb-4 w-full border border-zinc-200 shadow-inner">
          <div className="flex justify-between items-center mb-2">
            <div className="level font-semibold text-lg sm:text-xl text-zinc-900 tracking-tight flex items-center gap-2">
              Level {level}
            </div>
            <div className="exp text-sm sm:text-base font-semibold text-zinc-500">{exp} / {maxExp} EXP</div>
            <button className="bg-zinc-100 text-zinc-500 font-bold rounded-full w-8 h-8 flex items-center justify-center shadow border border-zinc-200 hover:scale-110 transition" title="Info" onClick={() => setModal("info")}>i</button>
          </div>
          <div className="progress-bar relative w-full h-4 bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-300 rounded-full overflow-hidden mb-2 border border-yellow-300 shadow-inner">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #FFD700 0%, #FFA500 100%)",
                boxShadow: '0 0 8px 2px #FFD70055',
                zIndex: 1
              }}
            ></div>
            <div className="progress-label absolute w-full h-full flex items-center justify-center text-xs sm:text-sm font-bold text-zinc-800" style={{zIndex:2, letterSpacing:'0.01em'}}>
              {currentLevelExp} / {levelRange} EXP
            </div>
          </div>
          <div className="mt-1 text-zinc-700 text-sm sm:text-base flex items-center justify-center gap-1 font-medium">
            <span>+{miningPower} D.FAITH</span>
          </div>
        </div>
        {/* System-Check */}
        <div className="system-check border border-zinc-200 rounded-2xl p-4 sm:p-5 bg-white/60 mb-4 w-full shadow-sm">
          <div className="system-check-header font-semibold text-sm sm:text-base mb-2 text-zinc-700">✅ System Check</div>
          <div className="check-item flex justify-between mb-1 text-[1rem] sm:text-[1.1rem] font-medium"><span>❤️ Like</span><span className={checkLike ? "text-green-500" : "text-red-400"}>{checkLike ? "✅" : "❌"} +10 EXP</span></div>
          <div className="check-item flex justify-between mb-1 text-[1rem] sm:text-[1.1rem] font-medium"><span>💬 Kommentar</span><span className={checkComment ? "text-green-500" : "text-red-400"}>{checkComment ? "✅" : "❌"} +10 EXP</span></div>
          <div className="check-item flex justify-between mb-1 text-[1rem] sm:text-[1.1rem] font-medium"><span>📣 Story</span><span className={checkStory ? "text-green-500" : "text-red-400"}>{checkStory ? "✅" : "❌"} +20 EXP</span></div>
          <div className="check-item flex justify-between mb-1 text-[1rem] sm:text-[1.1rem] font-medium"><span>💾 Save</span><span className={checkSave ? "text-green-500" : "text-red-400"}>{checkSave ? "✅" : "❌"} +10 EXP</span></div>
        </div>
        {/* Buttons */}
        <div className="button-row flex flex-col gap-3 mt-6 w-full">
          <button className="btn-upgrade w-full py-3 rounded-2xl font-semibold bg-zinc-900/90 text-white shadow hover:bg-zinc-900/95 active:bg-zinc-800 transition text-base sm:text-lg tracking-tight flex items-center justify-center gap-2 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300" onClick={() => setModal("upgrade")}>✨ Sammle mehr EXP</button>
          <button className="btn-claim w-full py-3 rounded-2xl font-semibold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-zinc-900 shadow-lg hover:from-yellow-500 hover:to-orange-500 active:from-yellow-600 active:to-orange-600 transition text-base sm:text-lg tracking-tight flex items-center justify-center gap-2 border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400" onClick={() => setModal("claim")}>🪙 Claim</button>
        </div>
      </div>
    </div>
  );
}