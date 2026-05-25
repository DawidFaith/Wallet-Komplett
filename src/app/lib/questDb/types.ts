// ─── Typen ───────────────────────────────────────────────────────────────────

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';
export type QuestType = 'comment' | 'like' | 'save' | 'secret' | 'engagement' | 'repost' | 'dm_share'; // erweiterbar: | 'subscribe'

export interface QuestIndexEntry {
  id: string;
  platform: Platform;
  type: QuestType;
  creatorWallet: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  videoUrl: string;
  rewardAmount: number;
  reputationReward: number;  // Reputation-Punkte pro Abschluss
  maxCompletions: number;
  completions: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
  creditsLocked: number;
  creditsRefunded: boolean;
  bonusBudget: number;
}

// ─── Reputation-Typen ─────────────────────────────────────────────────────────

export interface ReputationLevel {
  levelNumber: number;
  levelName: string;
  minReputation: number;
  prizeDescription: string;
  creditReward: number;            // D.FAITH Credits die beim Level-Up ausgezahlt werden
  maxRecipients: number;           // Wie viele Fans diesen Reward erhalten können (0 = kein Reward)
  questRewardBonusPercent: number; // Prozentualer Bonus auf Quest-Rewards für dieses Level (0 = kein Bonus)
}

export interface ReputationContest {
  id: string;
  artistWallet: string;
  endDate: string;
  distributed: boolean;
  createdAt: string;
  prizes: { rank: number; creditReward: number }[];
}

export interface UserArtistReputation {
  artistWallet: string;
  reputation: number;
  level: number;
  levelName: string;
  nextLevelRep: number | null;   // null = höchstes Level erreicht
  progress: number;              // 0–100 %
  questRewardBonusPercent: number;
  artistName?: string | null;
  artistPicture?: string | null;
}

export interface ReputationLeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName: string | null;
  reputation: number;
  level: number;
  levelName: string;
}

export interface QuestDetail extends QuestIndexEntry {
  description: string;
  updatedAt: string;
  secretCode?: string | null;
  storyToken?: string | null;
}

export interface YouTubeBinding {
  walletAddress: string;
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  verificationCode: string;
  verifiedAt: string;
}

export interface QuestCompletion {
  walletAddress: string;
  channelId: string;
  channelName: string;
  questId: string;
  platform: Platform;
  commentId: string;
  commentText: string;
  rewardAmount: number;
  rewardPaid: boolean;
  completedAt: string;
}

export interface QuestsByWalletEntry {
  questId: string;
  platform: Platform;
  videoId: string;
  rewardAmount: number;
  rewardPaid: boolean;
  completedAt: string;
}

export interface PendingReward {
  id: string;
  walletAddress: string;
  amount: number;
  reason: string;
  questId: string | null;
  status: 'pending' | 'paid';
  createdAt: string;
  paidAt: string | null;
}

// ─── Bundle-Typen ─────────────────────────────────────────────────────────────

/** Standard-Reichweiten-Gewichtung pro Quest-Typ (Algorythmus-Signalstärke) */
export const DEFAULT_REACH_WEIGHTS: Record<QuestType, number> = {
  comment:    3,  // Kommentar = starkes Signal
  like:       1,  // Like = schwaches Signal
  save:       2,  // Speichern = mittleres Signal
  repost:     3,  // Repost = starkes Signal
  dm_share:   4,  // Story-Share = höchste persönliche Reichweite
  engagement: 2,  // TikTok-Engagement-Paket
  secret:     2,  // Geheimcode = mittleres Signal
};

export interface QuestBundle {
  id: string;
  creatorWallet: string;
  platform: Platform;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  videoUrl: string;
  description: string;
  rewardPoolPerFan: number;       // Pro Fan: Gesamtreward für einzelne Tasks (aufgeteilt nach Gewichten)
  bundleCompletionBonus: number;  // Extra-Bonus wenn Fan ALLE Tasks abschließt
  bonusBudgetRemaining: number;   // Noch verfügbares Bonus-Budget
  maxParticipants: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestBundleItem {
  questId: string;
  questType: QuestType;
  reachWeight: number;
  rewardAmount: number;
  completions: number;
  maxCompletions: number;
  isActive: boolean;
}

export interface QuestBundleWithItems extends QuestBundle {
  items: QuestBundleItem[];
  /** Fan-Fortschritt: abgeschlossene Quest-Typen */
  fanCompletedTypes?: QuestType[];
  /** Fan hat den Abschluss-Bonus bereits eingelöst */
  fanBonusClaimed?: boolean;
  /** Fan hat alle Tasks abgeschlossen (Bonus einlösbar) */
  fanAllCompleted?: boolean;
}
