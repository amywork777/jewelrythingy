"use client"

import { Suspense, lazy, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

// Dynamic import of ModelViewer to prevent SSR issues with Three.js
const ModelViewer = lazy(() => import("./model-viewer-client"))

interface ModelViewerProps {
  modelUrl: string | null
  status: "idle" | "uploading" | "generating" | "completed" | "error"
  progress: number
}

export default function DynamicModelViewer(props: ModelViewerProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Suspense 
      fallback={
        <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ModelViewer {...props} />
    </Suspense>
  )
} 