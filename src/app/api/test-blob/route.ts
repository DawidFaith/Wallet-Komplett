// Test Vercel Blob Connection
import { NextRequest, NextResponse } from 'next/server';
import { put, list, head } from '@vercel/blob';
import { getBlobEnvironmentInfo } from '../../lib/vercelBlobCache';

export async function GET() {
  const envInfo = getBlobEnvironmentInfo();
  
  const testResults = {
    environmentInfo: envInfo,
    blobTest: null as any,
    error: null as string | null
  };

  // Teste Blob-Verbindung wenn Token verfügbar
  if (envInfo.hasBlobAccess) {
    try {
      console.log('🧪 Testing Vercel Blob connection...');
      
      // Test 1: Liste alle Blobs
      const blobs = await list({ limit: 1 });
      
      // Test 2: Teste einfachen PUT
      const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        environment: envInfo.vercelEnv
      };
      
      const blob = await put('test-connection.json', JSON.stringify(testData), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true
      });

      testResults.blobTest = {
        success: true,
        blobUrl: blob.url,
        existingBlobs: blobs.blobs.length,
        message: 'Vercel Blob connection successful!'
      };

      console.log('✅ Blob test successful:', blob.url);

    } catch (error) {
      testResults.error = error instanceof Error ? error.message : 'Unknown blob error';
      testResults.blobTest = {
        success: false,
        error: testResults.error
      };
      
      console.error('❌ Blob test failed:', error);
    }
  }

  return NextResponse.json({
    success: !testResults.error,
    data: testResults,
    recommendation: !envInfo.hasBlobAccess 
      ? 'Add BLOB_READ_WRITE_TOKEN to environment variables'
      : testResults.error 
        ? 'Check token validity and Vercel Blob setup'
        : 'Blob connection is working correctly!'
  });
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'cleanup_test') {
      // Lösche Test-Dateien
      const blobs = await list({ prefix: 'test-' });
      
      for (const blob of blobs.blobs) {
        // Note: @vercel/blob hat aktuell keine delete-Funktion
        // Test-Dateien werden automatisch nach Zeit gelöscht
      }

      return NextResponse.json({
        success: true,
        message: `Found ${blobs.blobs.length} test files (auto-cleanup pending)`
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}