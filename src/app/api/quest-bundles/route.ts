import { NextRequest, NextResponse } from 'next/server';
import {
  createQuestBundle,
  getBundlesWithProgressForFan,
  getDfaithCredits,
  lockQuestBudget,
  getPlatformUserCount,
  DEFAULT_REACH_WEIGHTS,
  type Platform,
  type QuestType,
} from '../../lib/questDb';

export const dynamic = 'force-dynamic';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

// ─── GET: Bundles für Fan (mit Fortschritt) ──────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet         = searchParams.get('wallet');
  const filterCreator  = searchParams.get('creator') ?? undefined;

  if (!wallet) return NextResponse.json({ error: 'wallet fehlt' }, { status: 400 });

  try {
    const bundles = await getBundlesWithProgressForFan(wallet.toLowerCase(), filterCreator);
    return NextResponse.json({ bundles });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST: Neues Bundle erstellen (Creator) ──────────────────────────────────
export async function POST(req: NextRequest) {
  let body: {
    creatorWallet?: string;
    platform?: string;
    videoUrl?: string;
    description?: string;
    rewardPoolPerFan?: number;
    bundleCompletionBonus?: number;
    maxParticipants?: number;
    durationHours?: number;
    items?: Array<{ questType: string; reachWeight: number }>;
    // Für nicht-YouTube-Plattformen: manuelle Angaben
    videoTitle?: string;
    videoThumbnail?: string;
    // Optionaler Graph Media ID (z.B. Instagram) – überschreibt die URL-Extraktion
    videoId?: string;
    // Level-Bonus-Budget (vom Creator vorberechnet, max. 100%)
    levelBonusBudget?: number;
    // Geheim-Codes pro Quest-Typ (nur für 'secret')
    secretCodes?: Record<string, string>;
    // Optionaler Story-Token für dm_share (vorher im Modal erzeugt)
    storyToken?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 }); }

  const {
    creatorWallet, platform, videoUrl, description,
    rewardPoolPerFan, bundleCompletionBonus, maxParticipants,
    durationHours, items,
    videoTitle: manualTitle, videoThumbnail: manualThumbnail,
    videoId: providedVideoId,
    levelBonusBudget, secretCodes, storyToken,
  } = body;

  if (!creatorWallet || !platform || !videoUrl || !items?.length) {
    return NextResponse.json({ error: 'creatorWallet, platform, videoUrl und items sind erforderlich' }, { status: 400 });
  }

  const VALID_PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook'];
  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: 'Ungültige Plattform' }, { status: 400 });
  }

  const VALID_TYPES = Object.keys(DEFAULT_REACH_WEIGHTS) as QuestType[];
  for (const item of items) {
    if (!VALID_TYPES.includes(item.questType as QuestType)) {
      return NextResponse.json({ error: `Ungültiger Quest-Typ: ${item.questType}` }, { status: 400 });
    }
    if (item.reachWeight < 1 || item.reachWeight > 10) {
      return NextResponse.json({ error: 'Reichweiten-Gewicht muss zwischen 1 und 10 liegen' }, { status: 400 });
    }
  }

  const poolNum  = Math.max(0.01, Math.round((Number(rewardPoolPerFan)      || 0) * 100) / 100);
  const bonusNum = Math.max(0,    Math.round((Number(bundleCompletionBonus) || 0) * 100) / 100);
  const maxNum   = Math.max(1,    Math.round(Number(maxParticipants)       || 10));

  // Abschluss-Bonus: unveräändert bonusNum × maxNum (jeder der max. Teilnehmer kann den Bonus bekommen)
  const abschlussBonusPool = Math.round(bonusNum * maxNum * 100) / 100;

  // Level-Bonus-Reserve: min(maxTeilnehmer, Platform-Nutzer) × 1.02 Puffer
  const platformUserCount = await getPlatformUserCount(platform as Platform);
  const effectiveParticipants = Math.min(maxNum, platformUserCount > 0 ? platformUserCount : maxNum);
  const levelBonus = Math.max(0, Math.round(
    (Number(levelBonusBudget) > 0
      ? Number(levelBonusBudget)
      : poolNum * effectiveParticipants * 1.02
    ) * 100) / 100);

  const totalBudget = Math.round((poolNum * maxNum + abschlussBonusPool + levelBonus) * 100) / 100;

  // Guthaben prüfen
  const credits = await getDfaithCredits(creatorWallet.toLowerCase());
  if (credits < totalBudget) {
    return NextResponse.json({
      error: `Nicht genug Credits. Du brauchst ${totalBudget.toFixed(2)} D.FAITH (${poolNum.toFixed(2)} × ${maxNum} Reward + ${abschlussBonusPool.toFixed(2)} Abschluss-Bonus + ${levelBonus.toFixed(2)} Level-Bonus-Reserve [${effectiveParticipants} Nutzer × 1.02]), hast aber nur ${credits.toFixed(2)}.`,
    }, { status: 400 });
  }

  // Video-Daten ermitteln
  let finalTitle     = manualTitle     ?? '';
  let finalThumbnail = manualThumbnail ?? '';
  let finalVideoId   = '';
  let finalVideoUrl  = videoUrl;

  if (platform === 'youtube') {
    if (!YT_API_KEY) {
      return NextResponse.json({ error: 'YouTube API key fehlt (YOUTUBE_DATA_API_KEY)' }, { status: 500 });
    }
    // Video-ID aus URL extrahieren
    const { extractShortsVideoId, buildShortsUrl } = await import('../../lib/questDb');
    const videoId = extractShortsVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json({ error: 'Ungültige YouTube Shorts URL' }, { status: 400 });
    }
    finalVideoId = videoId;
    finalVideoUrl = buildShortsUrl(videoId);

    if (!finalTitle) {
      const ytRes  = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`,
      );
      const ytData = await ytRes.json() as { items?: { snippet: { title: string; thumbnails?: { medium?: { url: string } } } }[] };
      if (!ytData.items?.length) {
        return NextResponse.json({ error: 'YouTube-Video nicht gefunden' }, { status: 404 });
      }
      finalTitle     = ytData.items[0].snippet.title;
      finalThumbnail = ytData.items[0].snippet.thumbnails?.medium?.url
        ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } else {
    // Für andere Plattformen: Graph Media ID bevorzugen, sonst URL-Extraktion
    if (providedVideoId?.trim()) {
      finalVideoId = providedVideoId.trim();
    } else {
      finalVideoId = videoUrl.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || crypto.randomUUID();
    }
    if (!finalTitle) {
      return NextResponse.json({ error: 'videoTitle ist für diese Plattform erforderlich' }, { status: 400 });
    }
  }

  // Budget sperren
  const locked = await lockQuestBudget(creatorWallet.toLowerCase(), totalBudget);
  if (!locked) {
    return NextResponse.json({ error: 'Budget konnte nicht gesperrt werden. Bitte Seite neu laden.' }, { status: 400 });
  }

  // Ablaufzeit berechnen
  let expiresAt: string | null = null;
  if (durationHours && durationHours > 0) {
    expiresAt = new Date(Date.now() + durationHours * 3_600_000).toISOString();
  }

  try {
    const { bundleId, storyToken: createdStoryToken } = await createQuestBundle(
      {
        creatorWallet: creatorWallet.toLowerCase(),
        platform: platform as Platform,
        videoId:       finalVideoId,
        videoTitle:    finalTitle,
        videoThumbnail: finalThumbnail,
        videoUrl:      finalVideoUrl,
        description:   description?.trim() ?? '',
        rewardPoolPerFan: poolNum,
        bundleCompletionBonus: bonusNum,
        maxParticipants: maxNum,
        expiresAt,
        levelBonusBudget: levelBonus,
        secretCodes: secretCodes ?? {},
        storyToken: storyToken?.trim() || null,
      },
      items.map((i) => ({
        questType:   i.questType   as QuestType,
        reachWeight: i.reachWeight,
      })),
    );

    return NextResponse.json({ success: true, bundleId, storyToken: createdStoryToken ?? null });
  } catch (e) {
    // Budget zurückerstatten wenn Bundle-Erstellung fehlschlägt
    const { addDfaithCredits } = await import('../../lib/questDb');
    await addDfaithCredits(creatorWallet.toLowerCase(), totalBudget);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Fehler beim Erstellen: ${msg}` }, { status: 500 });
  }
}
