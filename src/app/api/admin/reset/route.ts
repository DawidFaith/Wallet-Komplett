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

    // DO-Block: trunciert nur Tabellen die tatsächlich existieren (CASCADE)
    await sql`
      DO $body$
      DECLARE t TEXT;
      BEGIN
        FOR t IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = ANY(ARRAY[
            'quest_completions','pending_rewards','creator_deposits','quests',
            'creator_balances','youtube_bindings','tiktok_engagement_verifications',
            'facebook_like_verifications','instagram_like_verifications',
            'instagram_mentions','facebook_mentions','user_xp','dfaith_credits',
            'solana_accounts','hedera_accounts','user_profiles'
          ])
        LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(t) || ' CASCADE';
        END LOOP;
      END $body$
    `;

    return NextResponse.json({ success: true, message: 'Alle Daten gelöscht' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
