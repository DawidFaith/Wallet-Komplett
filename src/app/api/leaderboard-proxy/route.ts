import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_URL = "https://leaderboard-pi-liard.vercel.app/api/leaderboard";

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(EXTERNAL_URL, {
      // Ensure fresh data and avoid caching issues
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        // Prevent caching at the edge/client to keep it live
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Proxy fetch failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
