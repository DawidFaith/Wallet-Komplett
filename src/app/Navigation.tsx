import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
} from "react-icons/fa";
import { FiChevronDown } from "react-icons/fi";
import { useState } from "react";

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
  en: "🇺🇸", 
  pl: "🇵🇱"
};

const languageNames = {
  de: "Deutsch",
  en: "English",
  pl: "Polski"
};

export default function Navigation({ activeTab, setActiveTab, language = "de", setLanguage }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [activeSocial, setActiveSocial] = useState<"instagram" | "tiktok" | "facebook" | "youtube">("instagram");
  const router = useRouter();
  const pathname = usePathname();

  // Funktionen für Navigation
  const navigateToTab = (tab: string) => {
    if (pathname === "/wallet" && tab !== "wallet") {
      // Wenn wir auf der Wallet-Seite sind und zu einem anderen Tab wechseln wollen
      router.push(`/?tab=${tab}`);
    } else if (pathname === "/" || pathname === "/wallet") {
      // Auf der Hauptseite oder Wallet-Seite
      setActiveTab(tab);
    } else {
      // Von anderen Seiten zur Hauptseite mit Tab
      router.push(`/?tab=${tab}`);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-zinc-900 border-b border-zinc-800 z-50">
      <ul className="flex justify-center items-center gap-8 py-3">
        {/* Tokenomics */}
        <li>
          <button
            title="Tokenomics"
            onClick={() => navigateToTab("tokenomics")}
            className="flex items-center"
          >
            <FaChartBar
              size={22}
              className={`transition-colors ${
                activeTab === "tokenomics" ? "text-yellow-400" : "text-zinc-400"
              } hover:text-yellow-400`}
            />
          </button>
        </li>
        {/* Wallet */}
        <li>
          <button
            title="Wallet"
            onClick={() => navigateToTab("wallet")}
            className="flex items-center"
          >
            <FaWallet
              size={22}
              className={`transition-colors ${
                activeTab === "wallet" ? "text-blue-400" : "text-zinc-400"
              } hover:text-blue-400`}
            />
          </button>
        </li>
        {/* Social Media Icon + Dropdown */}
        <li className="relative flex items-center">
          <button
            title="Social Media"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center"
            aria-haspopup="true"
            aria-expanded={open}
          >
            {socialIcons[activeSocial]}
            <FiChevronDown
              size={22}
              className={`ml-1 transition-transform duration-300 ${
                open ? "text-pink-400 rotate-180" : "text-zinc-400"
              } hover:text-pink-400`}
            />
          </button>
          {open && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 bg-zinc-800 rounded-lg shadow-xl flex flex-col z-50 min-w-[140px] border border-zinc-700 overflow-hidden">
              <button
                onClick={() => {
                  setOpen(false);
                  setActiveSocial("instagram");
                  navigateToTab("instagram");
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200 border-b border-zinc-700"
              >
                <FaInstagram className="text-pink-500" /> 
                <span className="font-medium">Instagram</span>
              </button>
              <button
                onClick={() => {
                  setActiveSocial("tiktok");
                  navigateToTab("tiktok");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200 border-b border-zinc-700"
              >
                <FaTiktok className="text-zinc-100" /> 
                <span className="font-medium">TikTok</span>
              </button>
              <button
                onClick={() => {
                  setActiveSocial("facebook");
                  navigateToTab("facebook");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200 border-b border-zinc-700"
              >
                <FaFacebook className="text-blue-600" /> 
                <span className="font-medium">Facebook</span>
              </button>
              <button
                onClick={() => {
                  setActiveSocial("youtube");
                  navigateToTab("youtube");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200"
              >
                <FaYoutube className="text-red-500" /> 
                <span className="font-medium">YouTube</span>
              </button>
            </div>
          )}
        </li>
        {/* Merch */}
        <li>
          <button
            title="Merch"
            onClick={() => navigateToTab("merch")}
            className="flex items-center"
          >
            <FaTshirt
              size={22}
              className={`transition-colors ${
                activeTab === "merch" ? "text-green-400" : "text-zinc-400"
              } hover:text-green-400`}
            />
          </button>
        </li>
        {/* Live */}
        <li>
          <button
            title="Live"
            onClick={() => navigateToTab("live")}
            className="flex items-center"
          >
            <FaMusic
              size={22}
              className={`transition-colors ${
                activeTab === "live" ? "text-purple-400" : "text-zinc-400"
              } hover:text-purple-400`}
            />
          </button>
        </li>

        {/* Language Selector */}
        <li className="relative flex items-center">
          <button
            title="Sprache / Language / Język"
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1"
            aria-haspopup="true"
            aria-expanded={langOpen}
          >
            <span className="text-lg">{languageFlags[language]}</span>
            <FiChevronDown
              size={20}
              className={`transition-transform duration-300 ${
                langOpen ? "text-blue-400 rotate-180" : "text-zinc-400"
              } hover:text-blue-400`}
            />
          </button>
          {langOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 bg-zinc-800 rounded-lg shadow-xl flex flex-col z-50 min-w-[120px] border border-zinc-700 overflow-hidden">
              <button
                onClick={() => {
                  setLanguage?.("de");
                  setLangOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200 border-b border-zinc-700 ${
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
                className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200 border-b border-zinc-700 ${
                  language === "en" ? "bg-zinc-700" : ""
                }`}
              >
                <span className="text-lg">🇺🇸</span>
                <span className="font-medium">English</span>
              </button>
              <button
                onClick={() => {
                  setLanguage?.("pl");
                  setLangOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 hover:bg-zinc-700 text-zinc-100 w-full transition-colors duration-200 ${
                  language === "pl" ? "bg-zinc-700" : ""
                }`}
              >
                <span className="text-lg">🇵🇱</span>
                <span className="font-medium">Polski</span>
              </button>
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
}