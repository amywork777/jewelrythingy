'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { STLConverter } from './stl-converter'

// Directly import the named ThreeViewerComponent to avoid default export issues
const ThreeViewer = dynamic(() => import('./three-components').then(mod => {
  console.log("ThreeViewer component loaded:", mod);
  return mod;
}), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading 3D viewer...</p>
      </div>
    </div>
  )
})

// Fallback component to use if there's an error loading Three.js
const FallbackViewer = ({ status, progress }) => {
  return (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border">
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        {status === "idle" ? (
          <div className="text-center p-6 max-w-md">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-md"></div>
            <p className="text-muted-foreground text-lg">Your 3D model will appear here</p>
            <p className="text-muted-foreground text-sm mt-2">
              Enter a description or upload an image to generate a 3D model
            </p>
          </div>
        ) : status === "error" ? (
          <div className="text-center text-destructive p-6">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p className="font-medium">Error generating model</p>
            <p className="text-sm mt-2">Please try again with a different prompt or image</p>
          </div>
        ) : (
          <div className="text-center p-6">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-primary font-medium">
              {status === "uploading" ? "Uploading image..." : `Generating 3D model`}
            </p>
            {status === "generating" && (
              <div className="mt-4 w-64 mx-auto">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// The main browser-safe viewer component
const BrowserSafeViewer = (props) => {
  const [hasError, setHasError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [useSTLFallback, setUseSTLFallback] = useState(false);
  const [primaryViewerTried, setPrimaryViewerTried] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadAttempts, setLoadAttempts] = useState(0);
  
  useEffect(() => {
    setIsMounted(true);
    
    // Debug log the model URL
    console.log("BrowserSafeViewer props:", props);
    if (props.modelUrl) {
      console.log("Model URL received in BrowserSafeViewer:", props.modelUrl);
    } else if (props.status === "completed") {
      console.warn("Status is completed but no modelUrl provided to BrowserSafeViewer");
    }
    
    return () => setIsMounted(false);
  }, [props.modelUrl, props.status]);

  // If main viewer fails, switch to STL fallback after a delay
  useEffect(() => {
    if (hasError && primaryViewerTried && !useSTLFallback) {
      console.log("Main viewer failed, switching to fallback viewer automatically");
      const timer = setTimeout(() => {
        setUseSTLFallback(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasError, primaryViewerTried, useSTLFallback]);

  // Attempt reload if error occurs (maximum 2 retries)
  useEffect(() => {
    if (hasError && !useSTLFallback && loadAttempts < 2) {
      const timer = setTimeout(() => {
        console.log(`Retrying viewer load (attempt ${loadAttempts + 1})...`);
        setHasError(false);
        setLoadAttempts(prev => prev + 1);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [hasError, useSTLFallback, loadAttempts]);

  if (!isMounted) {
    return <FallbackViewer {...props} />;
  }

  if (hasError && !useSTLFallback) {
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border">
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p className="font-medium">3D Viewer Error</p>
            <p className="text-sm mt-2">{errorMessage || "There was an issue with the 3D viewer."}</p>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
              onClick={() => setUseSTLFallback(true)}
            >
              Try Fallback Viewer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if modelUrl exists before passing to ThreeViewer
  if (props.status === "completed" && !props.modelUrl) {
    console.warn("Status is 'completed' but modelUrl is missing");
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border">
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p className="font-medium">Model Generated</p>
            <p className="text-sm mt-2">But there was an issue preparing it for display.</p>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
              onClick={() => setUseSTLFallback(true)}
            >
              Try Fallback Viewer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show STL fallback viewer if main viewer fails
  if (useSTLFallback && props.modelUrl) {
    return <STLConverter modelUrl={props.modelUrl} fallbackMessage="Using fallback viewer" />;
  }

  // If status is not completed or no modelUrl, show the FallbackViewer
  if (props.status !== "completed" || !props.modelUrl) {
    return <FallbackViewer {...props} />;
  }

  // Main viewer with error boundary
  return (
    <React.Suspense fallback={
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading 3D viewer...</p>
        </div>
      </div>
    }>
      <ErrorBoundary onError={(error) => {
        console.error("Three.js error caught:", error);
        setPrimaryViewerTried(true);
        setHasError(true);
        setErrorMessage(String(error).substring(0, 100) + "...");
      }} fallback={<FallbackViewer {...props} />}>
        <ThreeViewer {...props} />
      </ErrorBoundary>
    </React.Suspense>
  )
}

// Improved error boundary component with better error reporting
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  
  componentDidCatch(error, errorInfo) {
    console.error("Error in Three.js component:", error);
    console.error("Component stack:", errorInfo?.componentStack);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export default BrowserSafeViewer 