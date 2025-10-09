// Debug Environment Variables API
import { NextResponse } from 'next/server';

export async function GET() {
  const envDebug = {
    // Vercel Environment
    VERCEL: !!process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    
    // Blob Token Detection
    BLOB_READ_WRITE_TOKEN_exists: !!process.env.BLOB_READ_WRITE_TOKEN,
    BLOB_READ_WRITE_TOKEN_length: process.env.BLOB_READ_WRITE_TOKEN?.length || 0,
    BLOB_READ_WRITE_TOKEN_prefix: process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 20),
    
    // Alternative Token Names (falls falsch konfiguriert)
    NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN_exists: !!process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN,
    
    // Alle Environment Variables mit "BLOB" im Namen
    allBlobVars: Object.keys(process.env).filter(key => 
      key.toLowerCase().includes('blob')
    ).map(key => ({
      name: key,
      exists: !!process.env[key],
      length: process.env[key]?.length || 0,
      prefix: process.env[key]?.substring(0, 20)
    })),
    
    // Timestamp
    timestamp: new Date().toISOString()
  };

  return NextResponse.json({
    success: true,
    debug: envDebug
  });
}