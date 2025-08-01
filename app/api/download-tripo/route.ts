import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Cache directory 
const CACHE_DIR = path.join(process.cwd(), 'model-cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Add export config to make the route dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // URL for the specific Tripo model that's causing problems
    const tripoUrl = request.nextUrl.searchParams.get('url');
    
    if (!tripoUrl) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }
    
    console.log('Downloading Tripo model:', tripoUrl);
    
    // Generate a filename based on the URL's hash
    const filename = `tripo-model-${Date.now()}.glb`;
    const filePath = path.join(CACHE_DIR, filename);
    
    // Check if we've already downloaded this file (approximation)
    const files = fs.readdirSync(CACHE_DIR);
    const existingFile = files.find(file => 
      file.startsWith('tripo-model-') && 
      fs.statSync(path.join(CACHE_DIR, file)).size > 1000000
    );
    
    if (existingFile) {
      console.log('Using existing Tripo model file:', existingFile);
      const fileBuffer = fs.readFileSync(path.join(CACHE_DIR, existingFile));
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Content-Disposition': 'attachment; filename="model.glb"',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }
    
    // Download the file using special browser-like headers
    const response = await fetch(tripoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://magic.taiyaki.ai',
        'Referer': 'https://magic.taiyaki.ai/',
      },
      timeout: 120000, // 2 minute timeout for large files
    });
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to download model: ${response.status} ${response.statusText}`
      }, { status: response.status });
    }
    
    // Get the model binary data
    const modelData = await response.arrayBuffer();
    const buffer = Buffer.from(modelData);
    
    // Save to file system
    fs.writeFileSync(filePath, buffer);
    console.log(`Tripo model saved to ${filePath}`);
    
    // Return the model
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': 'attachment; filename="model.glb"',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error downloading Tripo model:', error);
    return NextResponse.json({ 
      error: `Server error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 