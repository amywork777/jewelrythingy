import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - node-fetch types may not match exactly
import fetch from 'node-fetch';

// Add export config to make the route dynamic
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Proxy endpoint for loading 3D models from external sources like Tripo3D
 * Helps overcome CORS restrictions that prevent direct browser fetching
 */
export async function GET(request: NextRequest) {
  try {
    // Get the model URL from the query parameters
    const { searchParams } = new URL(request.url);
    let modelUrl = searchParams.get('url');

    // Return error if no URL provided
    if (!modelUrl) {
      return NextResponse.json({ error: 'No model URL provided' }, { status: 400 });
    }

    console.log('Proxying model from URL:', modelUrl);
    
    // Custom user agent and headers to mimic a browser request
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Add extra headers specifically for Tripo3D URLs
    if (modelUrl.includes('tripo-data.rg1.data.tripo3d.com') || 
        modelUrl.includes('tripo3d.com')) {
      headers['Origin'] = 'https://magic.taiyaki.ai';
      headers['Referer'] = 'https://magic.taiyaki.ai/';
    }

    // Fetch the model with retry logic
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        response = await fetch(modelUrl, {
          headers,
          timeout: 60000, // 1 minute timeout
        });
        
        // If successful, break out of the retry loop
        if (response.ok) break;
        
        console.warn(`Retry ${retryCount + 1}/${maxRetries}: Failed with status ${response.status}`);
        retryCount++;
        
        // If we're going to retry, wait a bit
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      } catch (fetchError) {
        console.error(`Fetch error (retry ${retryCount + 1}/${maxRetries}):`, fetchError);
        retryCount++;
        
        // If we're going to retry, wait a bit
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          throw fetchError; // Re-throw the last error
        }
      }
    }

    // Check if the request was successful after retries
    if (!response || !response.ok) {
      console.error('Error fetching model after retries:', 
                   response ? `${response.status} ${response.statusText}` : 'No response');
      return NextResponse.json(
        { error: `Failed to fetch model: ${response ? response.status : 'Network error'}` }, 
        { status: response ? response.status : 500 }
      );
    }

    // Get the model data
    const modelData = await response.arrayBuffer();
    const buffer = Buffer.from(modelData);

    // Determine content type based on URL (default to GLB)
    let contentType = 'model/gltf-binary';
    let filename = 'model.glb';
    
    if (modelUrl.toLowerCase().endsWith('.stl')) {
      contentType = 'application/octet-stream';
      filename = 'model.stl';
    }

    // Return the model data with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'public, max-age=31536000', // 1 year (these are signed URLs that expire anyway)
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in model proxy:', error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Origin, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}