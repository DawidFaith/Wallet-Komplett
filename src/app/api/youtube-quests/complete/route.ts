import { NextRequest, NextResponse } from 'next/server';
import {
  loadBindingByWallet,
  hasWalletCompletedQuest,
  hasChannelCompletedQuest,
  loadQuestDetail,
  saveCompletion,
  savePendingReward,
  addDfaithCredits,
  QuestCompletion,
} from '../../../lib/questDb';

const YT_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

// POST: Kommentar verifizieren und Quest abschließen
export async function POST(req: NextRequest) {
  if (!YT_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API key nicht konfiguriert (YOUTUBE_DATA_API_KEY)' },
      { status: 500 }
    );
  }

  let body: { walletAddress?: string; questId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
  }

  const { walletAddress, questId } = body;
  if (!walletAddress || !questId) {
    return NextResponse.json(
      { error: 'walletAddress und questId sind erforderlich' },
      { status: 400 }
    );
  }

  const normalized = walletAddress.toLowerCase();

  // 1. YouTube-Binding prüfen
  const binding = await loadBindingByWallet(normalized);
  if (!binding) {
    return NextResponse.json(
      { error: 'Kein YouTube-Kanal verknüpft. Verknüpfe zuerst deinen Kanal.' },
      { status: 400 }
    );
  }

  // 2. Quest prüfen
  const quest = await loadQuestDetail(questId);
  if (!quest) {
    return NextResponse.json({ error: 'Quest nicht gefunden' }, { status: 404 });
  }
  if (!quest.isActive) {
    return NextResponse.json({ error: 'Dieser Quest ist nicht mehr aktiv' }, { status: 400 });
  }
  // Ablaufzeit prüfen
  if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Dieser Quest ist abgelaufen' }, { status: 400 });
  }
  if (quest.completions >= quest.maxCompletions) {
    return NextResponse.json(
      { error: 'Dieser Quest ist bereits vollständig abgeschlossen (alle Plätze vergeben)' },
      { status: 400 }
    );
  }

  // 3. Doppelabschluss prüfen – nach Wallet UND nach YouTube-Kanal
  const alreadyDone = await hasWalletCompletedQuest(normalized, questId);
  if (alreadyDone) {
    return NextResponse.json(
      { error: 'Du hast diesen Quest bereits abgeschlossen' },
      { status: 409 }
    );
  }

  const channelAlreadyDone = await hasChannelCompletedQuest(binding.channelId, questId);
  if (channelAlreadyDone) {
    return NextResponse.json(
      { error: 'Dieser YouTube-Kanal hat diesen Quest bereits abgeschlossen.' },
      { status: 409 }
    );
  }

  // 4. Kommentar via YouTube Data API v3 suchen (max. 3 Seiten = ~300 Kommentare)
  let pageToken: string | undefined;
  let foundComment: { id: string; text: string; publishedAt: string } | null = null;

  for (let page = 0; page < 3; page++) {
    const ytUrl = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    ytUrl.searchParams.set('part', 'snippet');
    ytUrl.searchParams.set('videoId', quest.videoId);
    ytUrl.searchParams.set('maxResults', '100');
    ytUrl.searchParams.set('order', 'time');
    ytUrl.searchParams.set('key', YT_API_KEY);
    if (pageToken) ytUrl.searchParams.set('pageToken', pageToken);

    let ytData: {
      items?: {
        snippet: {
          topLevelComment: {
            id: string;
            snippet: {
              authorChannelId?: { value: string };
              authorDisplayName?: string;
              textDisplay: string;
              publishedAt: string;
            };
          };
        };
      }[];
      nextPageToken?: string;
      error?: { message: string; code?: number };
    };

    try {
      const ytRes = await fetch(ytUrl.toString());
      ytData = await ytRes.json();
    } catch {
      return NextResponse.json({ error: 'YouTube API nicht erreichbar' }, { status: 502 });
    }

    if (ytData.error) {
      if (ytData.error.code === 403) {
        return NextResponse.json(
          { error: 'Kommentare für dieses Video sind deaktiviert' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `YouTube API Fehler: ${ytData.error.message}` },
        { status: 502 }
      );
    }

    if (!ytData.items) break;

    for (const item of ytData.items) {
      const comment = item.snippet.topLevelComment;
      const authorName = comment.snippet.authorDisplayName ?? '';
      const authorChannelId = comment.snippet.authorChannelId?.value ?? '';
      // Primär: Channel-ID Vergleich (eindeutig, unabhängig vom Anzeigenamen)
      // Fallback: Anzeigename (Groß-/Kleinschreibung ignorieren)
      const matchById = authorChannelId && authorChannelId === binding.channelId;
      const matchByName = authorName.toLowerCase() === binding.channelName.toLowerCase();
      if (matchById || matchByName) {
        foundComment = {
          id: comment.id,
          text: comment.snippet.textDisplay,
          publishedAt: comment.snippet.publishedAt,
        };
        break;
      }
    }

    if (foundComment || !ytData.nextPageToken) break;
    pageToken = ytData.nextPageToken;
  }

  if (!foundComment) {
    return NextResponse.json(
      {
        error:
          `Kein Kommentar von "${binding.channelName}" (Kanal-ID: ${binding.channelId}) gefunden. ` +
          'Mögliche Ursachen: (1) YouTube hat den Kommentar noch nicht indexiert – warte 1-2 Minuten und versuche es erneut. ' +
          '(2) Der Kommentar wurde unter einem anderen Kanal gepostet. ' +
          '(3) Kommentare sind für dieses Video eingeschränkt.',
      },
      { status: 400 }
    );
  }

  // 5. Completion speichern (questDb.saveCompletion schreibt both by-quest + by-wallet + erhöht Zähler)
  const completion: QuestCompletion = {
    walletAddress: normalized,
    channelId: binding.channelId,
    channelName: binding.channelName,
    questId,
    platform: 'youtube',
    commentId: foundComment.id,
    commentText: foundComment.text,
    rewardAmount: quest.rewardAmount,
    rewardPaid: false,       // wird auf true gesetzt wenn Token tatsächlich transferiert
    completedAt: new Date().toISOString(),
  };

  await saveCompletion(completion);

  // Pending Reward in DB speichern (für Historie)
  await savePendingReward({
    walletAddress: normalized,
    amount: quest.rewardAmount,
    reason: `Quest abgeschlossen: ${quest.videoTitle}`,
    questId: questId,
    createdAt: new Date().toISOString(),
  });

  // Dfaith Credits dem Fan gutschreiben (aus dem beim Quest-Erstellen gesperrten Budget)
  await addDfaithCredits(normalized, quest.rewardAmount);

  return NextResponse.json({
    success: true,
    comment: { text: foundComment.text, publishedAt: foundComment.publishedAt },
    rewardAmount: quest.rewardAmount,
    channelName: binding.channelName,
  });
}
