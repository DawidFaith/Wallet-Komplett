import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  FaWallet,
  FaChartBar,
  FaTshirt,
  FaVideo,
  FaBroadcastTower,
  FaInstagram,
  FaTiktok,
  FaFacebook,
  FaYoutube,
  FaMusic,
  FaGlobe,
  FaIdBadge,
  FaStar,
  FaTasks,
  FaGem,
  FaGift,
} from "react-icons/fa";
import { MdStorefront } from "react-icons/md";
import { GiCrystalShine } from "react-icons/gi";
import { FiChevronDown } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useLang, useSetLang } from "./components/LangContext";
import { t } from "./utils/i18n";

type NavigationProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language?: "de" | "en" | "pl";
  setLanguage?: (language: "de" | "en" | "pl") => void;
};

const socialIcons = {
  instagram: <FaInstagram size={22} className="text-pink-500" />,
  tiktok: <FaTiktok size={22} className="text-black dark:text-white" />,
  facebook: <FaFacebook size={22} className="text-blue-600" />,
  youtube: <FaYoutube size={22} className="text-red-500" />,
};

const languageFlags = {
  de: "🇩🇪",
  en: "EN",
  pl: "🇵🇱"
};

const languageNames = {
  de: "Deutsch",
  en: "English",
  pl: "Polski"
};

export default function Navigation({ activeTab, setActiveTab, language: _language, setLanguage: _setLanguage }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [activeSocial, setActiveSocial] = useState<"instagram" | "tiktok" | "facebook" | "youtube">("instagram");
  const router = useRouter();
  const pathname = usePathname();
  const language = useLang();
  const setLanguage = useSetLang();
  const { user } = useUser();
  const [isArtist, setIsArtist] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/youtube-quests/profile?wallet=${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsArtist(!!(data?.profile?.isArtist)))
      .catch(() => {});
  }, [user?.id]);

  // Funktionen für Navigation
  const navigateToTab = (tab: string) => {
    if (pathname === "/home") {
      setActiveTab(tab);
    } else {
      router.push(`/home?tab=${tab}`);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-[#1a180f] border-b border-white/8 z-50">
      <ul className="flex justify-center items-center gap-8 py-3">
        {/* Profil – ganz links */}
        <li>
          <button
            title={t('nav.profile', language)}
            onClick={() => navigateToTab("profile")}
            className="flex items-center"
          >
            <FaIdBadge
              size={23}
              className={`transition-colors ${
                activeTab === "profile" ? "text-red-400" : "text-zinc-400"
              } hover:text-red-400`}
            />
          </button>
        </li>
        {/* Verbundene Plattformen Dropdown */}
        <li className="relative flex items-center">
          <button
            title={t('nav.menu', language)}
            onClick={() => { setOpen((v) => !v); setLangOpen(false); }}
            className="flex items-center gap-1"
            aria-haspopup="true"
            aria-expanded={open}
          >
            <FaGlobe
              size={19}
              className={`transition-colors ${
                ["reputation", "shop", "quest-board", "collectibles", "marketplace", "giveaways"].includes(activeTab)
                  ? "text-amber-400"
                  : "text-zinc-400"
              } hover:text-amber-400`}
            />
            <FiChevronDown
              size={13}
              className={`transition-transform duration-300 ${
                open ? "text-amber-400 rotate-180" : "text-zinc-400"
              } hover:text-amber-400`}
            />
          </button>
          {open && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 bg-[#231e12] rounded-lg shadow-xl flex flex-col z-50 min-w-[160px] border border-white/10 overflow-hidden">
              <button
                onClick={() => { navigateToTab("quest-board"); setOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2515] w-full transition-colors duration-200 border-b border-white/10 ${
                  activeTab === "quest-board" ? "text-red-400" : "text-zinc-300"
                }`}
              >
                <FaTasks size={15} className={activeTab === "quest-board" ? "text-red-400" : "text-zinc-400"} />
                <span className="font-medium text-sm">{t('nav.questBoard', language)}</span>
              </button>
              <button
                onClick={() => { navigateToTab("reputation"); setOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2515] w-full transition-colors duration-200 border-b border-white/10 ${
                  activeTab === "reputation" ? "text-amber-400" : "text-zinc-300"
                }`}
              >
                <FaStar size={15} className={activeTab === "reputation" ? "text-amber-400" : "text-zinc-400"} />
                <span className="font-medium text-sm">{t('nav.reputation', language)}</span>
              </button>
              <button
                onClick={() => { navigateToTab("shop"); setOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2515] w-full transition-colors duration-200 border-b border-white/10 ${
                  activeTab === "shop" ? "text-amber-400" : "text-zinc-300"
                }`}
              >
                <FaTshirt size={15} className={activeTab === "shop" ? "text-amber-400" : "text-zinc-400"} />
                <span className="font-medium text-sm">{t('nav.shop', language)}</span>
              </button>
              <button
                onClick={() => { navigateToTab("collectibles"); setOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2515] w-full transition-colors duration-200 border-b border-white/10 ${
                  activeTab === "collectibles" ? "text-amber-400" : "text-zinc-300"
                }`}
              >
                <GiCrystalShine size={15} className={activeTab === "collectibles" ? "text-amber-400" : "text-zinc-400"} />
                <span className="font-medium text-sm">{t('nav.collectibles', language)}</span>
              </button>
              <button
                onClick={() => { navigateToTab("marketplace"); setOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2515] w-full transition-colors duration-200 ${
                  isArtist ? "border-b border-white/10" : ""
                } ${
                  activeTab === "marketplace" ? "text-amber-400" : "text-zinc-300"
                }`}
              >
                <MdStorefront size={15} className={activeTab === "marketplace" ? "text-amber-400" : "text-zinc-400"} />
                <span className="font-medium text-sm">{t('nav.marketplace', language)}</span>
              </button>
              {isArtist && (
                <button
                  onClick={() => { navigateToTab("giveaways"); setOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2515] w-full transition-colors duration-200 ${
                    activeTab === "giveaways" ? "text-amber-400" : "text-zinc-300"
                  }`}
                >
                  <FaGift size={15} className={activeTab === "giveaways" ? "text-amber-400" : "text-zinc-400"} />
                  <span className="font-medium text-sm">{t('nav.giveaways', language)}</span>
                </button>
              )}
            </div>
          )}
        </li>
        {/* Solana Wallet */}
        <li>
          <button
            title={t('nav.solanaWallet', language)}
            onClick={() => navigateToTab("solana-wallet")}
            className="flex items-center"
          >
            <FaWallet
              size={22}
              className={`transition-colors ${
                activeTab === "solana-wallet" ? "text-purple-400" : "text-zinc-400"
              } hover:text-purple-400`}
            />
          </button>
        </li>
        <li className="relative flex items-center">
          <button
            title={t('nav.language', language)}
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1"
            aria-haspopup="true"
            aria-expanded={langOpen}
          >
            <span className={language === "en" ? "text-sm font-bold" : "text-lg"}>{languageFlags[language]}</span>
            <FiChevronDown
              size={20}
              className={`transition-transform duration-300 ${
                langOpen ? "text-blue-400 rotate-180" : "text-zinc-400"
              } hover:text-blue-400`}
            />
          </button>
          {langOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 bg-[#231e12] rounded-lg shadow-xl flex flex-col z-50 min-w-[120px] border border-white/10 overflow-hidden">
              <button
                onClick={() => {
                  setLanguage?.("de");
                  setLangOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 hover:bg-[#2d2515] text-zinc-100 w-full transition-colors duration-200 border-b border-white/10 ${
                  language === "de" ? "bg-zinc-700" : ""
                }`}
              >
                <span className="text-lg">🇩🇪</span>
                <span className="font-medium">Deutsch</span>
              </button>
              <button
                onClick={() => {
                  setLanguage?.("en");
                  setLangOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 hover:bg-[#2d2515] text-zinc-100 w-full transition-colors duration-200 border-b border-white/10 ${
                  language === "en" ? "bg-zinc-700" : ""
                }`}
              >
                <span className="text-sm font-bold w-[1.35rem] text-center">EN</span>
                <span className="font-medium">English</span>
              </button>
              <button
                onClick={() => {
                  setLanguage?.("pl");
                  setLangOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 hover:bg-[#2d2515] text-zinc-100 w-full transition-colors duration-200 ${
                  language === "pl" ? "bg-zinc-700" : ""
                }`}
              >
                <span className="text-lg">🇵🇱</span>
                <span className="font-medium">Polski</span>
              </button>
            </div>
          )}
        </li>
        {/* User / Logout */}
        <li className="flex items-center">
          <UserButton afterSignOutUrl="/" />
        </li>
      </ul>
    </nav>
  );
}