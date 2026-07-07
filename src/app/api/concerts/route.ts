import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import {
  getConcertEvents,
  getActiveConcertEvents,
  getConcertCheckins,
  createConcertEvent,
  updateConcertEventStatus,
} from '@/app/lib/questDb';

/** GET /api/concerts?artistWallet=...&manage=true */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get('artistWallet');
  const manage = searchParams.get('manage') === 'true';
  if (!artistWallet) return NextResponse.json({ error: 'artistWallet fehlt' }, { status: 400 });

  try {
    const events = manage
      ? await getConcertEvents(artistWallet)
      : await getActiveConcertEvents(artistWallet);

    if (!manage) return NextResponse.json(events);

    // Artist-View: Checkins + Clerk-Namen für jeden Event laden
    const clerk = await clerkClient();
    const eventsWithCheckins = await Promise.all(events.map(async (ev) => {
      const checkins = await getConcertCheckins(ev.id);
      const wallets = checkins.map(c => c.walletAddress);
      const clerkNames: Record<string, { name: string; imageUrl: string }> = {};
      if (wallets.length > 0) {
        try {
          const idSet = new Set(wallets.map(w => w.toLowerCase()));
          let offset = 0;
          while (true) {
            const { data: batch, totalCount } = await clerk.users.getUserList({ limit: 100, offset });
            for (const u of batch) {
              const lcId = u.id.toLowerCase();
              if (idSet.has(lcId)) {
                const name = u.fullName ?? u.username ?? u.firstName ?? u.emailAddresses[0]?.emailAddress?.split('@')[0] ?? null;
                if (name) clerkNames[lcId] = { name, imageUrl: u.imageUrl };
              }
            }
            if (batch.length < 100 || offset + batch.length >= totalCount) break;
            offset += 100;
          }
        } catch { /* Clerk optional */ }
      }
      return {
        ...ev,
        checkins: checkins.map(c => ({
          ...c,
          displayName: clerkNames[c.walletAddress.toLowerCase()]?.name ?? null,
          imageUrl: clerkNames[c.walletAddress.toLowerCase()]?.imageUrl ?? null,
        })),
      };
    }));

    return NextResponse.json(eventsWithCheckins);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}

/** POST /api/concerts — Event erstellen */
export async function POST(req: NextRequest) {
  try {
    const { artistWallet, title, eventDate, venue, address, creditReward, shardReward, repReward, imageUrl } = await req.json();
    if (!artistWallet || !title) return NextResponse.json({ error: 'artistWallet und title erforderlich' }, { status: 400 });
    const id = await createConcertEvent(
      artistWallet, title,
      eventDate || null, venue || null, address || null,
      Math.max(0, Number(creditReward) || 0),
      Math.max(0, Number(shardReward) || 0),
      Math.max(0, Number(repReward) || 0),
      imageUrl || null,
    );
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('[concerts POST]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}

/** PATCH /api/concerts — Status ändern (active/done) */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    // Support both `id` and `eventId` for backwards compatibility
    const eventId = body.eventId ?? body.id;
    const { artistWallet, status } = body;
    if (!eventId || !artistWallet || !status) return NextResponse.json({ error: 'eventId, artistWallet, status erforderlich' }, { status: 400 });
    await updateConcertEventStatus(eventId, artistWallet, status);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
