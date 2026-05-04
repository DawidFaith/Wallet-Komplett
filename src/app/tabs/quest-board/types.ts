// ─── Gemeinsame Typen für das Quest Board ────────────────────────────────────

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook';
export type QuestType = 'comment' | 'like' | 'secret' | 'engagement';

export const DFAITH_TOKEN = '0x69eFD833288605f320d77eB2aB99DDE62919BbC1';
export const DFAITH_DECIMALS = 2;

export interface QuestIndexEntry {
  id: string;
  platform: Platform;
  type: QuestType;
  creatorWallet: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  videoUrl: string;
  description?: string;
  rewardAmount: number;
  maxCompletions: number;
  completions: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

export interface YouTubeBinding {
  walletAddress: string;
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  verifiedAt: string;
}

export interface VerifyResult {
  success: boolean;
  message: string;
  comment?: string;
  rewardAmount?: number;
}

export interface ClaimResult {
  success: boolean;
  message: string;
  txHash?: string;
}

export type QuestBoardView = 'fan' | 'creator';
