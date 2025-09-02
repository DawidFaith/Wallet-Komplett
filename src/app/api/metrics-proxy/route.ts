import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log("🔄 Fetching metrics from external API...");
    
    const response = await fetch(
      'https://dex-liquidity-3kf8hv241-dawid-faiths-projects.vercel.app/api/metrics?token=0x69eFD833288605f320d77eB2aB99DDE62919BbC1&chainId=8453',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ External API Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'External API Error', status: response.status },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log("✅ Metrics data fetched successfully");
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error("❌ Proxy Error:", error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
