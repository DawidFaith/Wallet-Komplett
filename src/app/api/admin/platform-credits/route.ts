/**
 * GET /api/admin/platform-credits
 * Gibt Platform-Credits-Guthaben + Transaktionshistorie zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getTreasuryKeypair } from '../../../lib/solanaOperator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const sql            = getDb();
    const treasuryWallet = getTreasuryKeypair().publicKey.toBase58().toLowerCase();

    // Sicherstellen dass Tabelle existiert
    await sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        from_wallet  TEXT        NOT NULL,
        to_wallet    TEXT        NOT NULL,
        amount       NUMERIC(20,2) NOT NULL,
        type         TEXT        NOT NULL,
        reference_id TEXT,
        note         TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_credit_tx_to   ON credit_transactions(to_wallet, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_credit_tx_from ON credit_transactions(from_wallet, created_at DESC)`;

    // Platform-Credits-Guthaben
    const balRows = await sql`
      SELECT balance FROM dfaith_credits WHERE wallet_address = ${treasuryWallet} LIMIT 1
    `;
    const platformCredits = balRows.length ? Number(balRows[0].balance) : 0;

    // Gesamtstatistik
    const statsRows = await sql`
      SELECT
        type,
        COUNT(*)::int       AS count,
        SUM(amount)::float  AS total
      FROM credit_transactions
      WHERE to_wallet = ${treasuryWallet}
      GROUP BY type
      ORDER BY total DESC
    `;

    // Letzte 100 Transaktionen die an die Platform gingen
    const txRows = await sql`
      SELECT
        ct.*,
        p.name AS from_name
      FROM credit_transactions ct
      LEFT JOIN user_profiles p ON LOWER(p.wallet_address) = ct.from_wallet
      WHERE ct.to_wallet = ${treasuryWallet}
      ORDER BY ct.created_at DESC
      LIMIT 100
    `;

    // Alle Transaktionen (auch von Platform) für vollständiges Bild
    const allTxRows = await sql`
      SELECT
        ct.*,
        pf.name AS from_name,
        pt.name AS to_name
      FROM credit_transactions ct
      LEFT JOIN user_profiles pf ON LOWER(pf.wallet_address) = ct.from_wallet
      LEFT JOIN user_profiles pt ON LOWER(pt.wallet_address) = ct.to_wallet
      ORDER BY ct.created_at DESC
      LIMIT 200
    `;

    return NextResponse.json({
      treasuryWallet,
      platformCredits,
      stats: statsRows,
      platformInflow: txRows,
      allTransactions: allTxRows,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
