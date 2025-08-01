'use client'

import React, { useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Loader2, AlertCircle } from 'lucide-react'
import * as THREE from 'three'

// Define the props interface
interface ThreeViewerProps {
  modelUrl: string | null
  status: "idle" | "uploading" | "generating" | "completed" | "error" 
  progress: number
}

// The actual 3D Model component
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const modelRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  useEffect(() => {
    if (!scene) return

    // Apply white material to all meshes
    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
    })

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Apply white material
        child.material = whiteMaterial
      }
    })

    // Center camera on model
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // Adjust camera position based on model size
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const cameraZ = Math.abs(maxDim / Math.sin(fov / 2))

    // Set camera position
    camera.position.set(center.x, center.y, center.z + cameraZ * 1.5)
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    // Add the model to our ref
    if (modelRef.current) {
      modelRef.current.clear()
      modelRef.current.add(scene.clone())
    }
  }, [scene, camera])

  return <group ref={modelRef} />
}

// Custom scene setup component
function SceneSetup() {
  const { scene } = useThree()

  useEffect(() => {
    // Set background color
    scene.background = new THREE.Color(0xf5f5f5)
  }, [scene])

  return null
}

// Error boundary for Three.js errors
class ErrorBoundary extends React.Component<{
  children: React.ReactNode
  fallback: React.ReactNode
}> {
  state = { hasError: false }
  
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// The main viewer component
export default function ThreeViewer({ modelUrl, status, progress }: ThreeViewerProps) {
  const [loadError, setLoadError] = React.useState(false)

  // Reset error state when model URL changes
  useEffect(() => {
    if (modelUrl) {
      setLoadError(false)
    }
  }, [modelUrl])

  return (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border">
      {status === "completed" && modelUrl && !loadError ? (
        <div className="w-full h-full">
          <ErrorBoundary fallback={<div className="w-full h-full flex items-center justify-center text-destructive">Error loading 3D model</div>}>
            <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
              <SceneSetup />
              <ambientLight intensity={0.8} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-5, 10, 5]} intensity={0.8} />
              <directionalLight position={[0, -10, 0]} intensity={0.3} />
              {modelUrl && <Model url={modelUrl} />}
              <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
            </Canvas>
          </ErrorBoundary>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
          {status === "idle" ? (
            <div className="text-center p-6 max-w-md">
              <img
                src="/placeholder.svg?height=120&width=120"
                alt="3D model placeholder"
                className="mx-auto mb-4 opacity-20"
              />
              <p className="text-muted-foreground text-lg">Your 3D model will appear here</p>
              <p className="text-muted-foreground text-sm mt-2">
                Enter a description or upload an image to generate a 3D model
              </p>
            </div>
          ) : status === "error" || loadError ? (
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
      )}
    </div>
  )
} 