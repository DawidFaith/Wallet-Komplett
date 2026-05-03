import { NextRequest, NextResponse } from 'next/server';
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { getDfaithCredits, redeemDfaithCredits } from '@/app/lib/questDb';

const DFAITH_TOKEN = '0x69eFD833288605f320d77eB2aB99DDE62919BbC1';
const DFAITH_DECIMALS = 2;

// POST: Dfaith Credits einlösen → echte DFAITH-Tokens senden
export async function POST(req: NextRequest) {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerKey) {
    return NextResponse.json(
      { error: 'Auszahlung nicht verfügbar (RELAYER_PRIVATE_KEY nicht konfiguriert)' },
      { status: 500 },
    );
  }

  let body: { walletAddress?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { walletAddress, amount } = body;
  if (!walletAddress || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'walletAddress und amount sind erforderlich' },
      { status: 400 },
    );
  }

  // Guthaben prüfen
  const currentBalance = await getDfaithCredits(walletAddress);
  if (currentBalance < amount) {
    return NextResponse.json(
      { error: `Nicht genug Dfaith Credits. Verfügbar: ${currentBalance}` },
      { status: 400 },
    );
  }

  // Credits atomisch reduzieren (wirft wenn zwischenzeitlich zu wenig)
  await redeemDfaithCredits(walletAddress, amount);

  // Echten DFAITH-Transfer via Hot Wallet senden
  try {
    const thirdwebClient = createThirdwebClient({
      secretKey: process.env.THIRDWEB_SECRET_KEY || '',
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '',
    });
    const relayerAccount = privateKeyToAccount({
      client: thirdwebClient,
      privateKey: relayerKey as `0x${string}`,
    });
    const contract = getContract({
      client: thirdwebClient,
      chain: base,
      address: DFAITH_TOKEN,
    });
    const tx = prepareContractCall({
      contract,
      method: 'function transfer(address,uint256) returns (bool)',
      params: [
        walletAddress as `0x${string}`,
        BigInt(Math.round(amount * Math.pow(10, DFAITH_DECIMALS))),
      ],
    });
    const result = await sendTransaction({ transaction: tx, account: relayerAccount });
    return NextResponse.json({
      success: true,
      txHash: result.transactionHash,
      sentAmount: amount,
    });
  } catch (e: any) {
    // Credits wiederherstellen wenn Transfer fehlschlägt
    const { addDfaithCredits } = await import('@/app/lib/questDb');
    await addDfaithCredits(walletAddress, amount);
    console.error('[claim POST] Transfer fehlgeschlagen:', e);
    return NextResponse.json(
      { error: 'Token-Transfer fehlgeschlagen. Deine Credits wurden zurückgegeben.' },
      { status: 500 },
    );
  }
}
