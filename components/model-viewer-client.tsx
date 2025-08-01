"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Define the properties for ModelViewer component
interface ModelViewerProps {
  modelUrl?: string;
  status?: 'idle' | 'uploading' | 'generating' | 'completed' | 'error';
  progress?: number;
  onError?: (error: any) => void;
}

// Main ModelViewer component
export default function ModelViewer({ 
  modelUrl, 
  status = 'idle',
  progress = 0,
  onError
}: ModelViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [isTripoUrl, setIsTripoUrl] = useState(false);

  // Determine if we're using direct fetch or proxy route
  const [useDirectFetch, setUseDirectFetch] = useState(true);

  // Check if this is a Tripo URL
  useEffect(() => {
    if (modelUrl) {
      const isTripo = modelUrl.includes('tripo-data.rg1.data.tripo3d.com');
      setIsTripoUrl(isTripo);
    }
  }, [modelUrl]);

  // Function to handle error events
  const handleError = (error: any) => {
    console.error('Error in ModelViewer:', error, 'Model URL:', modelUrl);
    setLoadError(true);
    if (onError) {
      onError(error);
    }
    
    // Try alternating between direct fetch and proxy
    if (useDirectFetch) {
      console.log('Switching to proxy');
      setUseDirectFetch(false);
    } else if (!useFallback) {
      console.log('Switching to fallback viewer');
      setUseFallback(true);
    }
  };

  // Reset error state when model URL changes
  useEffect(() => {
    if (modelUrl) {
      setLoadError(false);
    }
  }, [modelUrl]);

  // Generate HTML content for model viewer
  const generateModelViewerHtml = () => {
    if (!modelUrl) return '';

    // Create a script element to preload our model fetcher
    const preloadScript = `
      <script src="/model-fetcher.js"></script>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin-allow-popups">
          <meta http-equiv="Cross-Origin-Embedder-Policy" content="credentialless">
          ${preloadScript}
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            model-viewer {
              width: 100%;
              height: 100%;
              background-color: #f5f5f5;
            }
            .error {
              display: flex;
              justify-content: center;
              align-items: center;
              color: #e11d48;
              height: 100%;
              text-align: center;
              padding: 1rem;
            }
            .loading {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background-color: rgba(0,0,0,0.5);
              color: white;
              z-index: 1000;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-radius: 50%;
              border-top-color: #06b6d4;
              animation: spin 1s linear infinite;
              margin-bottom: 1rem;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js" crossorigin="anonymous"></script>
        </head>
        <body>
          <div id="loading" class="loading">
            <div class="spinner"></div>
            <div>Loading 3D model...</div>
          </div>
          
          <model-viewer
            id="viewer"
            camera-controls
            auto-rotate
            shadow-intensity="1" 
            shadow-softness="0.5"
            exposure="0.8"
            ar
            ar-modes="webxr scene-viewer"
            orientation="0 0 0"
            environment-image="neutral"
            crossorigin="anonymous"
            loading="eager"
            reveal="auto"
            onerror="handleModelError(event)"
          >
            <div class="error" id="error" style="display: none;">
              Error loading 3D model.
            </div>
          </model-viewer>
          
          <script>
            // Custom error handler
            function handleModelError(event) {
              console.error('Model viewer error:', event);
              document.getElementById('error').style.display = 'flex';
              parent.postMessage({type: 'error', message: 'Failed to load model'}, '*');
            }
            
            // Preload model function
            async function loadModelWithFetcher() {
              const modelUrl = '${modelUrl}';
              const loading = document.getElementById('loading');
              const viewer = document.getElementById('viewer');
              
              try {
                // Check if we have the fetchModel function from model-fetcher.js
                if (typeof window.fetchModel === 'function') {
                  console.log('Using model fetcher for:', modelUrl);
                  
                  // Use our custom fetcher to get around CORS
                  const response = await window.fetchModel(modelUrl);
                  const blob = await response.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  
                  // Set the model viewer source to our local blob URL
                  viewer.setAttribute('src', objectUrl);
                  console.log('Model set to object URL');
                  
                  // Hide loading when the model is loaded
                  viewer.addEventListener('load', function onLoad() {
                    loading.style.display = 'none';
                    console.log('Model loaded successfully');
                    viewer.removeEventListener('load', onLoad);
                  });
                } else {
                  // Fallback to direct loading if fetcher isn't available
                  console.log('Model fetcher not available, trying direct load');
                  viewer.setAttribute('src', modelUrl);
                  
                  // Hide loading when the model is loaded
                  viewer.addEventListener('load', function onLoad() {
                    loading.style.display = 'none';
                    console.log('Model loaded successfully (direct)');
                    viewer.removeEventListener('load', onLoad);
                  });
                }
              } catch (error) {
                console.error('Error loading model:', error);
                handleModelError(error);
              }
            }
            
            // Start loading the model once the page is loaded
            window.addEventListener('DOMContentLoaded', loadModelWithFetcher);
          </script>
        </body>
      </html>
    `;
  };

  // Handle message events from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'error') {
        handleError(event.data.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Get direct fetcher URL for the fallback
  const directFetchUrl = modelUrl ? `/direct-fetch.html?url=${encodeURIComponent(modelUrl)}` : '';

  // Determine what to render based on status
  const renderContent = () => {
    if (status === 'idle') {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-6 text-center">
          Waiting for model generation to begin...
        </div>
      );
    }

    if (status === 'uploading') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="text-muted-foreground">
            Uploading... {progress > 0 ? `${Math.round(progress)}%` : ''}
          </div>
        </div>
      );
    }

    if (status === 'generating') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="text-muted-foreground">
            Generating 3D model... {progress > 0 ? `${Math.round(progress)}%` : ''}
          </div>
        </div>
      );
    }

    if (status === 'error' || loadError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive p-6 text-center gap-4">
          <AlertCircle className="h-8 w-8" />
          <div>Error loading 3D model. Please try again.</div>
          {modelUrl && (
            <Button 
              variant="outline" 
              onClick={() => {
                setLoadError(false);
                setUseDirectFetch(!useDirectFetch);
              }}
            >
              Try Alternative Loader
            </Button>
          )}
          {modelUrl && (
            <Button 
              variant="outline" 
              onClick={() => {
                window.open(directFetchUrl, '_blank');
              }}
            >
              Open in New Window
            </Button>
          )}
        </div>
      );
    }

    if (status === 'completed' && modelUrl) {
      // If we're using direct fetch solution
      if (useDirectFetch) {
        return (
          <iframe
            ref={iframeRef}
            src={directFetchUrl}
            className="w-full h-full border-0"
            allow="autoplay; camera; microphone; xr-spatial-tracking"
            loading="eager"
            onError={() => handleError("Failed to load direct fetch viewer")}
          />
        );
      }
      
      // Otherwise use the original iframe method
      return (
        <iframe
          ref={iframeRef}
          srcDoc={generateModelViewerHtml()}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="autoplay; camera; microphone; xr-spatial-tracking"
          loading="eager"
          onError={() => handleError("Failed to load iframe")}
        />
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-6 text-center">
        Waiting for model...
      </div>
    );
  };

  return (
    <Card className="w-full h-[500px] overflow-hidden">
      {renderContent()}
    </Card>
  );
} 