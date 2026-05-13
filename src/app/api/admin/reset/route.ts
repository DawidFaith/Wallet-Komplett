import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const sql = getDb();
    await sql`TRUNCATE TABLE
      quest_completions,
      pending_rewards,
      creator_deposits,
      quests,
      creator_balances,
      youtube_bindings,
      tiktok_engagement_verifications,
      facebook_like_verifications,
      instagram_like_verifications,
      instagram_mentions,
      facebook_mentions,
      user_xp,
      dfaith_credits,
      solana_accounts,
      hedera_accounts,
      user_profiles
    CASCADE`;
    return NextResponse.json({ success: true, message: 'Alle Daten gelöscht' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
