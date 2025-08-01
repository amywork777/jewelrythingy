'use client'

import { Suspense, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Import the 3D viewer with SSR disabled
const ModelViewerClient = dynamic(() => import('./three-viewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  )
})

interface DynamicViewerProps {
  modelUrl: string | null
  status: "idle" | "uploading" | "generating" | "completed" | "error"
  progress: number
}

export default function DynamicViewer(props: DynamicViewerProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading viewer...</p>
        </div>
      </div>
    )
  }

  // Use the actual 3D model viewer only on the client side
  return <ModelViewerClient {...props} />
} 