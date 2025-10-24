import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_URL = "https://leaderboard-pi-liard.vercel.app/api/leaderboard";

export async function GET(_req: NextRequest) {
  try {
    // Add timestamp to force fresh request
    const timestamp = Date.now();
    const url = `${EXTERNAL_URL}?_t=${timestamp}`;
    
    console.log('📊 Fetching leaderboard data from:', url);
    
    const res = await fetch(url, {
      // Ensure fresh data and avoid caching issues
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error('❌ Leaderboard API error:', res.status, res.statusText);
      return NextResponse.json(
        { error: "Upstream error", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    console.log('✅ Leaderboard data fetched successfully');
    
    return NextResponse.json(data, {
      headers: {
        // Prevent caching at all levels
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Proxy fetch failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
