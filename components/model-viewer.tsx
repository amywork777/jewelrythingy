"use client"

import React, { useEffect, useState, useRef, Suspense } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF } from "@react-three/drei"
import { Loader2, AlertCircle } from "lucide-react"
import * as THREE from "three"

interface ModelViewerProps {
  modelUrl: string | null
  status: "idle" | "uploading" | "generating" | "completed" | "error"
  progress: number
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const modelRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  // Apply white material to all meshes
  useEffect(() => {
    if (!scene) return

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

// Create a client-side only canvas component
const ThreeCanvas = ({ children }: { children: React.ReactNode }) => {
  return (
    <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
      {children}
    </Canvas>
  )
}

// This is a server-side safe version that just displays a placeholder
// The actual Three.js components are loaded dynamically client-side only
export function ModelViewer({ status }: ModelViewerProps) {
  return (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
      <div className="text-center p-6 max-w-md">
        <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-md"></div>
        <p className="text-muted-foreground text-lg">3D Model Viewer</p>
        <p className="text-muted-foreground text-sm mt-2">
          {status === "idle" 
            ? "Enter a description or upload an image to generate a 3D model" 
            : "Loading viewer..."}
        </p>
      </div>
    </div>
  )
}

// ErrorBoundary component to catch errors in the Three.js rendering
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

