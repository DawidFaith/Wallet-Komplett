/**
 * Manuelle Identitätsverifizierung (Ausweis + Selfie) gegen Multi-Accounts.
 *
 * Ausweis-/Selfie-Bilder werden AES-256-GCM-verschlüsselt (gleicher Mechanismus
 * wie für Solana Private Keys, siehe solanaCrypto.ts) in Postgres gespeichert —
 * NICHT über Vercel Blob, da dort nur öffentliche URLs möglich sind. Nach der
 * Admin-Entscheidung (approved/rejected) werden die Bilder sofort gelöscht;
 * dauerhaft bleibt nur ein HMAC-Hash der Ausweisnummer zur Duplikat-Erkennung.
 */
import { createHmac } from 'crypto';
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from './db';
import { encryptKey, decryptKey } from './solanaCrypto';
import { sendIdentityVerificationAdminEmail, sendIdentityVerificationResultEmail } from './email';

async function getUserEmail(walletAddress: string): Promise<string | null> {
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(walletAddress);
    return user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  } catch {
    return null;
  }
}

const HASH_SECRET = process.env.IDENTITY_HASH_SECRET;

function hashIdNumber(idNumber: string): string {
  if (!HASH_SECRET) throw new Error('IDENTITY_HASH_SECRET nicht gesetzt');
  const normalized = idNumber.trim().toUpperCase().replace(/\s+/g, '');
  return createHmac('sha256', HASH_SECRET).update(normalized).digest('hex');
}

async function ensureTable(sql: ReturnType<typeof getDb>) {
  await sql`
    CREATE TABLE IF NOT EXISTS identity_verifications (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address    TEXT NOT NULL,
      id_type           TEXT NOT NULL,
      id_number_hint    TEXT,
      doc_image_enc     TEXT,
      selfie_image_enc  TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      rejection_reason  TEXT,
      submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at       TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_identity_verifications_wallet ON identity_verifications(wallet_address)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON identity_verifications(status)`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS identity_id_hash TEXT`;
}

export async function submitVerification(params: {
  walletAddress: string;
  idType: string;
  idNumber: string;
  docImageBase64: string;
  selfieImageBase64: string;
}): Promise<void> {
  const sql = getDb();
  await ensureTable(sql);
  const wallet = params.walletAddress.toLowerCase();

  // Vorherige unentschiedene/abgelehnte Anträge löschen, damit ein Resubmit sauber funktioniert.
  await sql`DELETE FROM identity_verifications WHERE wallet_address = ${wallet} AND status IN ('pending', 'rejected')`;

  const docEnc = encryptKey(params.docImageBase64);
  const selfieEnc = encryptKey(params.selfieImageBase64);
  await sql`
    INSERT INTO identity_verifications (wallet_address, id_type, id_number_hint, doc_image_enc, selfie_image_enc, status)
    VALUES (${wallet}, ${params.idType}, ${params.idNumber.trim()}, ${docEnc}, ${selfieEnc}, 'pending')
  `;

  sendIdentityVerificationAdminEmail({ walletAddress: wallet, idType: params.idType }).catch(err => {
    console.error('[identityVerification] Admin-Benachrichtigung fehlgeschlagen:', err instanceof Error ? err.message : err);
  });
}

export interface VerificationStatus {
  verified: boolean;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

export async function getVerificationStatus(walletAddress: string): Promise<VerificationStatus> {
  const sql = getDb();
  await ensureTable(sql);
  const wallet = walletAddress.toLowerCase();

  const profileRows = await sql`SELECT identity_verified FROM user_profiles WHERE wallet_address = ${wallet} LIMIT 1`;
  if (profileRows[0]?.identity_verified) {
    return { verified: true, status: 'approved' };
  }

  const rows = await sql`
    SELECT status, rejection_reason FROM identity_verifications
    WHERE wallet_address = ${wallet}
    ORDER BY submitted_at DESC LIMIT 1
  `;
  if (!rows.length) return { verified: false, status: 'none' };
  return {
    verified: false,
    status: rows[0].status as 'pending' | 'rejected',
    rejectionReason: (rows[0].rejection_reason as string | null) ?? undefined,
  };
}

export async function isIdentityVerified(walletAddress: string): Promise<boolean> {
  const sql = getDb();
  await ensureTable(sql);
  const rows = await sql`SELECT identity_verified FROM user_profiles WHERE wallet_address = ${walletAddress.toLowerCase()} LIMIT 1`;
  return Boolean(rows[0]?.identity_verified);
}

export interface PendingVerification {
  id: string;
  walletAddress: string;
  idType: string;
  idNumberHint: string | null;
  docImageDataUrl: string | null;
  selfieImageDataUrl: string | null;
  submittedAt: string;
}

export async function listPendingForAdmin(): Promise<PendingVerification[]> {
  const sql = getDb();
  await ensureTable(sql);

  // Housekeeping: Anträge, die 30 Tage lang nie geprüft wurden, automatisch ablehnen
  // und Bilder löschen (opportunistisch bei ~5% der Aufrufe, kein Cron nötig).
  if (Math.random() < 0.05) {
    sql`
      UPDATE identity_verifications
      SET status = 'rejected',
          rejection_reason = 'Automatisch abgelaufen (30 Tage nicht geprüft)',
          doc_image_enc = NULL, selfie_image_enc = NULL, id_number_hint = NULL,
          reviewed_at = NOW()
      WHERE status = 'pending' AND submitted_at < NOW() - INTERVAL '30 days'
    `.catch(() => {});
  }

  const rows = await sql`
    SELECT id, wallet_address, id_type, id_number_hint, doc_image_enc, selfie_image_enc, submitted_at
    FROM identity_verifications
    WHERE status = 'pending'
    ORDER BY submitted_at ASC
  `;
  return rows.map(r => ({
    id: r.id as string,
    walletAddress: r.wallet_address as string,
    idType: r.id_type as string,
    idNumberHint: (r.id_number_hint as string | null) ?? null,
    docImageDataUrl: r.doc_image_enc ? `data:image/jpeg;base64,${decryptKey(r.doc_image_enc as string)}` : null,
    selfieImageDataUrl: r.selfie_image_enc ? `data:image/jpeg;base64,${decryptKey(r.selfie_image_enc as string)}` : null,
    submittedAt: (r.submitted_at as Date).toISOString(),
  }));
}

export interface VerifiedUser {
  walletAddress: string;
  email: string | null;
  verifiedAt: string | null;
}

export async function listVerifiedForAdmin(): Promise<VerifiedUser[]> {
  const sql = getDb();
  await ensureTable(sql);

  const rows = await sql`
    SELECT wallet_address FROM user_profiles WHERE identity_verified = TRUE ORDER BY wallet_address
  `;
  const wallets = rows.map(r => r.wallet_address as string);
  if (!wallets.length) return [];

  const reviewedRows = await sql`
    SELECT DISTINCT ON (wallet_address) wallet_address, reviewed_at
    FROM identity_verifications
    WHERE status = 'approved'
    ORDER BY wallet_address, reviewed_at DESC
  `;
  const reviewedAtByWallet = new Map<string, string>();
  for (const r of reviewedRows) {
    if (r.reviewed_at) reviewedAtByWallet.set(r.wallet_address as string, (r.reviewed_at as Date).toISOString());
  }

  // DB speichert wallet_address als lowercase, Clerk-IDs können Großbuchstaben enthalten →
  // getUserList({ userId: [...] }) findet nichts. Deshalb alle User paginiert laden und
  // per lowercase-Vergleich matchen (gleiches Muster wie reputation/leaderboard/route.ts).
  const emailByWallet = new Map<string, string | null>();
  try {
    const clerk = await clerkClient();
    const idSet = new Set(wallets);
    let offset = 0;
    const pageSize = 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: batch, totalCount } = await clerk.users.getUserList({ limit: pageSize, offset });
      for (const u of batch) {
        const lcId = u.id.toLowerCase();
        if (idSet.has(lcId)) {
          emailByWallet.set(lcId, u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? null);
        }
      }
      if (batch.length < pageSize || offset + batch.length >= totalCount) break;
      offset += pageSize;
    }
  } catch { /* Emails bleiben null falls Clerk-Abruf fehlschlägt */ }

  return wallets.map(w => ({
    walletAddress: w,
    email: emailByWallet.get(w) ?? null,
    verifiedAt: reviewedAtByWallet.get(w) ?? null,
  }));
}

export type ReviewResult =
  | { ok: true }
  | { ok: false; error: string; conflictWallet?: string };

export async function reviewVerification(params: {
  id: string;
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
  confirmedIdNumber?: string;
  force?: boolean;
}): Promise<ReviewResult> {
  const sql = getDb();
  await ensureTable(sql);

  const rows = await sql`
    SELECT wallet_address, id_number_hint, status FROM identity_verifications WHERE id = ${params.id} LIMIT 1
  `;
  if (!rows.length) return { ok: false, error: 'Antrag nicht gefunden' };
  if ((rows[0].status as string) !== 'pending') return { ok: false, error: 'Antrag wurde bereits bearbeitet' };
  const wallet = rows[0].wallet_address as string;

  if (params.decision === 'rejected') {
    await sql`
      UPDATE identity_verifications
      SET status = 'rejected', rejection_reason = ${params.rejectionReason ?? null},
          doc_image_enc = NULL, selfie_image_enc = NULL, id_number_hint = NULL, reviewed_at = NOW()
      WHERE id = ${params.id}
    `;
    getUserEmail(wallet).then(email => {
      if (email) sendIdentityVerificationResultEmail({ toEmail: email, approved: false, rejectionReason: params.rejectionReason });
    }).catch(() => {});
    return { ok: true };
  }

  const idNumber = params.confirmedIdNumber ?? (rows[0].id_number_hint as string | null);
  if (!idNumber) return { ok: false, error: 'Ausweisnummer fehlt' };
  const hash = hashIdNumber(idNumber);

  if (!params.force) {
    const conflict = await sql`
      SELECT wallet_address FROM user_profiles
      WHERE identity_id_hash = ${hash} AND identity_verified = TRUE AND wallet_address != ${wallet}
      LIMIT 1
    `;
    if (conflict.length) {
      return {
        ok: false,
        error: 'Diese Ausweisnummer ist bereits einem anderen Account zugeordnet',
        conflictWallet: conflict[0].wallet_address as string,
      };
    }
  }

  await sql`
    INSERT INTO user_profiles (wallet_address, identity_verified, identity_id_hash)
    VALUES (${wallet}, TRUE, ${hash})
    ON CONFLICT (wallet_address) DO UPDATE SET identity_verified = TRUE, identity_id_hash = ${hash}
  `;
  await sql`
    UPDATE identity_verifications
    SET status = 'approved', doc_image_enc = NULL, selfie_image_enc = NULL, id_number_hint = NULL, reviewed_at = NOW()
    WHERE id = ${params.id}
  `;
  getUserEmail(wallet).then(email => {
    if (email) sendIdentityVerificationResultEmail({ toEmail: email, approved: true });
  }).catch(() => {});
  return { ok: true };
}
