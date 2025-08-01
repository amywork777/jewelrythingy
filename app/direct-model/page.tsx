"use client"

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

// Main component that uses searchParams, wrapped in suspense
function ModelViewerContent() {
  const searchParams = useSearchParams()
  const modelUrlParam = searchParams.get('url')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proxiedUrl, setProxiedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!modelUrlParam) {
      setError('No model URL provided')
      setLoading(false)
      return
    }

    // Create a proxied URL for the model
    const encodedUrl = encodeURIComponent(modelUrlParam)
    setProxiedUrl(`/api/download-tripo?url=${encodedUrl}`)
    
    // Pre-fetch the model to ensure it's cached
    fetch(`/api/download-tripo?url=${encodedUrl}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load model: ${response.status} ${response.statusText}`)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error pre-fetching model:', err)
        setError(err.message || 'Failed to load model')
        setLoading(false)
      })
  }, [modelUrlParam])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full mb-4"></div>
          <div>Loading model... This may take a minute for large models.</div>
        </div>
      </div>
    )
  }

  if (error || !proxiedUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center text-red-500">
          <div className="mb-4">⚠️ Error</div>
          <div>{error || 'Unknown error'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen">
      <iframe
        src={`/model-viewer.html?url=${encodeURIComponent(proxiedUrl)}`}
        className="w-full h-full border-0"
        allow="autoplay; camera; microphone; xr-spatial-tracking"
      />
    </div>
  )
}

// Loader component for suspense fallback
function ModelLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full mb-4"></div>
        <div>Initializing viewer...</div>
      </div>
    </div>
  )
}

// Main component with suspense boundary
export default function DirectModelViewer() {
  return (
    <Suspense fallback={<ModelLoading />}>
      <ModelViewerContent />
    </Suspense>
  )
} 