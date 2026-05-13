import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

const TABLES = [
  'quest_completions',
  'pending_rewards',
  'creator_deposits',
  'quests',
  'creator_balances',
  'youtube_bindings',
  'tiktok_engagement_verifications',
  'facebook_like_verifications',
  'instagram_like_verifications',
  'instagram_mentions',
  'facebook_mentions',
  'user_xp',
  'dfaith_credits',
  'solana_accounts',
  'hedera_accounts',
  'user_profiles',
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const sql = getDb();
    const skipped: string[] = [];

    for (const table of TABLES) {
      try {
        await sql.unsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch {
        skipped.push(table);
      }
    }

    const msg = skipped.length
      ? `Alle Daten gelöscht. Nicht gefunden: ${skipped.join(', ')}`
      : 'Alle Daten gelöscht';
    return NextResponse.json({ success: true, message: msg });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
