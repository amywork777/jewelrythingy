import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-ignore - node-fetch types may not match exactly
import fetch from 'node-fetch';
import crypto from 'crypto';

// Directory for caching models
const CACHE_DIR = path.join(process.cwd(), 'model-cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Generate a safe filename from a URL
function getSafeFilename(url: string): string {
  // Create MD5 hash of the URL to use as filename
  return crypto.createHash('md5').update(url).digest('hex') + '.glb';
}

// Check if a file is cached
function isFileCached(filename: string): boolean {
  const filePath = path.join(CACHE_DIR, filename);
  return fs.existsSync(filePath);
}

// Add export config to make the route dynamic
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Get common response headers for model data
function getModelResponseHeaders(contentLength: number): Record<string, string> {
  return {
    'Content-Type': 'model/gltf-binary',
    'Content-Disposition': 'attachment; filename="model.glb"',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, Origin, Accept, X-Requested-With',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cache-Control': 'public, max-age=31536000',
    'Content-Length': contentLength.toString(),
  };
}

// Main proxy function
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

    // Generate a safe filename for caching
    const safeFilename = getSafeFilename(modelUrl);
    const cacheFilePath = path.join(CACHE_DIR, safeFilename);

    // If the file is already cached, serve it from cache
    if (isFileCached(safeFilename)) {
      console.log('Serving model from cache:', safeFilename);
      const cachedFile = fs.readFileSync(cacheFilePath);
      
      return new NextResponse(cachedFile, {
        headers: getModelResponseHeaders(cachedFile.length),
      });
    }

    // Special handling for Tripo URLs with complex signatures
    const isTripoUrl = modelUrl.includes('tripo-data.rg1.data.tripo3d.com');
    
    // Fetch the model from the source URL
    const response = await fetch(modelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://magic.taiyaki.ai',
        'Referer': 'https://magic.taiyaki.ai/',
      },
      // Add a longer timeout for large models
      timeout: 60000,
    });

    // Check if the request was successful
    if (!response.ok) {
      console.error('Error fetching model:', response.status, response.statusText);
      
      // For Tripo URLs specifically, try an alternative approach
      if (isTripoUrl) {
        console.log('Attempting alternative fetch for Tripo URL');
        
        try {
          // Create a more browser-like fetch
          const alternativeResponse = await fetch(modelUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': '*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'cross-site',
              'Pragma': 'no-cache',
              'Cache-Control': 'no-cache',
            },
            timeout: 60000,
          });
          
          if (alternativeResponse.ok) {
            const modelData = await alternativeResponse.arrayBuffer();
            const buffer = Buffer.from(modelData);
            
            // Save the model to cache
            fs.writeFileSync(cacheFilePath, buffer);
            console.log('Model cached successfully (alternative method):', safeFilename);
            
            return new NextResponse(buffer, {
              headers: getModelResponseHeaders(buffer.length),
            });
          }
        } catch (altError) {
          console.error('Alternative fetch also failed:', altError);
        }
      }
      
      return NextResponse.json(
        { error: `Failed to fetch model: ${response.status} ${response.statusText}` }, 
        { status: response.status }
      );
    }

    // Get the model data
    const modelData = await response.arrayBuffer();
    const buffer = Buffer.from(modelData);

    // Save the model to cache
    fs.writeFileSync(cacheFilePath, buffer);
    console.log('Model cached successfully:', safeFilename);

    // Return the model data
    return new NextResponse(buffer, {
      headers: getModelResponseHeaders(buffer.length),
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
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Origin, Accept, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
} 