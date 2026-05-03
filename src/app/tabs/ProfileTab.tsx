'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import Image from 'next/image';
import {
  FaInstagram, FaTiktok, FaFacebook, FaYoutube,
  FaCheck, FaPencilAlt, FaTimes, FaSave,
  FaCoins, FaStar, FaLock,
} from 'react-icons/fa';
import QuestBoardTab from './QuestBoardTab';
import type { SupportedLanguage } from '../utils/deepLTranslation';

interface ProfileData {
  xp: number;
  credits: number;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
  profile: {
    instagramHandle: string | null;
    instagramVerified: boolean;
    tiktokHandle: string | null;
    tiktokVerified: boolean;
    facebookHandle: string | null;
    facebookVerified: boolean;
    youtubeChannelId: string | null;
    youtubeChannelName: string | null;
    youtubeChannelThumbnail: string | null;
    youtubeVerified: boolean;
  };
}

interface ProfileTabProps {
  language: SupportedLanguage;
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ProfileTab({ language: _language }: ProfileTabProps) {
  const account = useActiveAccount();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  // Bearbeitung
  const [editing, setEditing] = useState(false);
  const [igHandle, setIgHandle] = useState('');
  const [ttHandle, setTtHandle] = useState('');
  const [fbHandle, setFbHandle] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!account?.address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube-quests/profile?wallet=${account.address}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setIgHandle(d.profile.instagramHandle ?? '');
        setTtHandle(d.profile.tiktokHandle ?? '');
        setFbHandle(d.profile.facebookHandle ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    if (!account?.address) return;
    setSaving(true);
    try {
      await fetch('/api/youtube-quests/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: account.address,
          instagramHandle: igHandle.trim() || null,
          tiktokHandle: ttHandle.trim() || null,
          facebookHandle: fbHandle.trim() || null,
        }),
      });
      await loadProfile();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!account?.address) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center mb-5">
          <FaLock size={28} className="text-zinc-500" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Dein Profil</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verbinde deine Wallet um dein Profil, Level und Quests zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-16 space-y-5">

      {/* ── Profil-Header ─────────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 flex items-center justify-center shrink-0 text-white font-bold text-2xl">
            {account.address.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">
              {shortenAddress(account.address)}
            </p>
            <p className="text-zinc-500 text-xs font-mono truncate">{account.address}</p>

            {/* Credits */}
            <div className="flex items-center gap-1.5 mt-2">
              <FaCoins className="text-yellow-400" size={13} />
              <span className="text-yellow-300 font-bold text-sm">
                {loading ? '–' : (data?.credits ?? 0)} DFAITH Credits
              </span>
            </div>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-zinc-500 hover:text-white transition-colors p-2 shrink-0"
            title="Profil bearbeiten"
          >
            {editing ? <FaTimes size={16} /> : <FaPencilAlt size={14} />}
          </button>
        </div>
      </div>

      {/* ── Level / XP ────────────────────────────────────────── */}
      {data && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaStar className="text-yellow-400" size={16} />
              <span className="text-white font-bold text-base">Level {data.level}</span>
            </div>
            <span className="text-zinc-400 text-xs">{data.xp} XP gesamt</span>
          </div>
          {/* XP-Balken */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>{data.currentXp} XP</span>
              <span>{data.nextLevelXp} XP bis Level {data.level + 1}</span>
            </div>
            <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-700"
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>
          <p className="text-zinc-600 text-xs">
            XP werden durch abgeschlossene Quests gesammelt (1 DFAITH Reward = 10 XP)
          </p>
        </div>
      )}

      {/* ── Soziale Profile ───────────────────────────────────── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base">Soziale Profile</h3>
          {editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {saving
                ? <div className="border-2 border-white/30 border-t-white rounded-full w-3 h-3 animate-spin" />
                : <FaSave size={11} />
              }
              Speichern
            </button>
          )}
        </div>

        {/* YouTube */}
        <SocialRow
          icon={<FaYoutube className="text-red-500" size={18} />}
          label="YouTube"
          handle={data?.profile.youtubeChannelName ?? null}
          verified={data?.profile.youtubeVerified ?? false}
          editing={false}
          placeholder="Noch nicht verknüpft"
          hint={!data?.profile.youtubeVerified ? 'Im Quest Board verknüpfen' : undefined}
          thumbnail={data?.profile.youtubeChannelThumbnail ?? null}
        />

        {/* Instagram */}
        <SocialRow
          icon={<FaInstagram className="text-pink-500" size={18} />}
          label="Instagram"
          handle={data?.profile.instagramHandle ?? null}
          verified={false}
          editing={editing}
          editValue={igHandle}
          onEditChange={setIgHandle}
          placeholder="@username"
        />

        {/* TikTok */}
        <SocialRow
          icon={<FaTiktok className="text-zinc-200" size={17} />}
          label="TikTok"
          handle={data?.profile.tiktokHandle ?? null}
          verified={false}
          editing={editing}
          editValue={ttHandle}
          onEditChange={setTtHandle}
          placeholder="@username"
        />

        {/* Facebook */}
        <SocialRow
          icon={<FaFacebook className="text-blue-500" size={18} />}
          label="Facebook"
          handle={data?.profile.facebookHandle ?? null}
          verified={false}
          editing={editing}
          editValue={fbHandle}
          onEditChange={setFbHandle}
          placeholder="Profil-URL oder Name"
        />
      </div>

      {/* ── Quest Board ────────────────────────────────────────── */}
      <div className="mt-2">
        <QuestBoardTab language={_language} />
      </div>
    </div>
  );
}

// ─── Hilfskomponente: eine Zeile pro sozialem Netzwerk ───────────────────────

interface SocialRowProps {
  icon: React.ReactNode;
  label: string;
  handle: string | null;
  verified: boolean;
  editing: boolean;
  editValue?: string;
  onEditChange?: (v: string) => void;
  placeholder?: string;
  hint?: string;
  thumbnail?: string | null;
}

function SocialRow({
  icon, label, handle, verified, editing, editValue, onEditChange, placeholder, hint, thumbnail,
}: SocialRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 flex justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        {editing && onEditChange !== undefined ? (
          <input
            value={editValue ?? ''}
            onChange={(e) => onEditChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-1.5 border border-zinc-700 focus:border-red-500 focus:outline-none text-sm placeholder-zinc-600"
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {thumbnail && (
              <Image src={thumbnail} alt={label} width={20} height={20} unoptimized className="w-5 h-5 rounded-full" />
            )}
            <span className={`text-sm truncate ${handle ? 'text-white' : 'text-zinc-600 italic'}`}>
              {handle ?? (hint ?? 'Nicht hinterlegt')}
            </span>
            {verified && (
              <span className="shrink-0 flex items-center gap-1 text-green-400 text-xs font-semibold bg-green-900/30 px-1.5 py-0.5 rounded-full">
                <FaCheck size={9} /> Verifiziert
              </span>
            )}
          </div>
        )}
      </div>
      <span className="text-zinc-600 text-xs shrink-0">{label}</span>
    </div>
  );
}
