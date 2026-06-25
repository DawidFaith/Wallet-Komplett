/**
 * GET /api/solana/nfts?solanaAddress=...
 * Gibt alle NFTs einer Solana-Adresse zurück via Helius DAS getAssetsByOwner.
 * Unterstützt Token-Metadata NFTs (Shop) + mpl-core Assets (Collectibles) + externe.
 */
import { NextRequest, NextResponse } from 'next/server';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

function resolveImage(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith('ar://')) return `https://arweave.net/${url.slice(5)}`;
  if (url.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  return url;
}

export interface WalletNft {
  mint:         string;
  name:         string;
  image:        string | null;
  collection:   string | null;
  isDfaith:     boolean;
  interface:    string;
  attributes:   { trait_type: string; value: string }[];
}

export async function GET(req: NextRequest) {
  const solanaAddress = new URL(req.url).searchParams.get('solanaAddress');
  if (!solanaAddress) return NextResponse.json({ error: 'solanaAddress fehlt' }, { status: 400 });

  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      'get-nfts',
        method:  'getAssetsByOwner',
        params: {
          ownerAddress: solanaAddress,
          page:         1,
          limit:        1000,
          sortBy:       { sortBy: 'created', sortDirection: 'desc' },
          options: {
            showUnverifiedCollections: true,
            showCollectionMetadata:    true,
            showFungible:              false,
            showNativeBalance:         false,
          },
        },
      }),
    });

    if (!res.ok) return NextResponse.json({ error: `Helius Fehler: ${res.status}` }, { status: 502 });

    const json = await res.json() as {
      result?: {
        items: Array<{
          id: string;
          interface: string;
          burnt?: boolean;
          content?: {
            metadata?: { name?: string; description?: string; attributes?: { trait_type: string; value: string }[] };
            links?: { image?: string };
            files?: { uri?: string; mime?: string }[];
            json_uri?: string;
          };
          grouping?: { group_key: string; group_value: string }[];
        }>;
      };
      error?: { message: string };
    };

    if (json.error) return NextResponse.json({ error: json.error.message }, { status: 502 });

    const items = json.result?.items ?? [];

    const nfts: WalletNft[] = items
      .filter(a => ['V1_NFT', 'ProgrammableNFT', 'MplCoreAsset'].includes(a.interface) && !a.burnt)
      .map(a => {
        const meta       = a.content?.metadata;
        const links      = a.content?.links;
        const attributes = meta?.attributes ?? [];
        const isDfaith   = attributes.some(
          attr => attr.trait_type === 'Platform' && attr.value === 'D.FAITH'
        );
        const collection = a.grouping?.find(g => g.group_key === 'collection')?.group_value ?? null;

        // Bild: links.image → files[0].uri → null
        const rawImage = links?.image
          ?? a.content?.files?.find(f => f.mime?.startsWith('image/'))?.uri
          ?? null;

        return {
          mint:       a.id,
          name:       meta?.name ?? 'Unbekannt',
          image:      resolveImage(rawImage),
          collection,
          isDfaith,
          interface:  a.interface,
          attributes,
        };
      });

    return NextResponse.json(nfts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
