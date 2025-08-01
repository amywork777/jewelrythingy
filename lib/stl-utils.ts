import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js"

/**
 * Custom loader function to handle CORS issues with Tripo3D models
 * Will first try to load directly, then fallback to proxy
 */
function loadGLBWithProxy(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    const isTripoUrl = url.includes('tripo-data.rg1.data.tripo3d.com') || 
                       url.includes('tripo3d.com')
    
    // For Tripo URLs, try proxy first since they often have CORS issues
    if (isTripoUrl) {
      const proxyUrl = `/api/proxy-model?url=${encodeURIComponent(url)}`
      console.log('STL Converter: Using proxy for Tripo URL')
      
      loader.load(
        proxyUrl,
        (gltf) => resolve(gltf.scene),
        (xhr) => console.log(`${(xhr.loaded / xhr.total) * 100}% loaded via proxy`),
        (error) => {
          console.warn('Proxy loading failed, trying direct:', error)
          // If proxy fails, try direct as fallback
          loader.load(
            url,
            (gltf) => resolve(gltf.scene),
            (xhr) => console.log(`${(xhr.loaded / xhr.total) * 100}% loaded directly`),
            (directError) => reject(directError)
          )
        }
      )
    } else {
      // For non-Tripo URLs, try direct first
      console.log('STL Converter: Using direct load first')
      loader.load(
        url,
        (gltf) => resolve(gltf.scene),
        (xhr) => console.log(`${(xhr.loaded / xhr.total) * 100}% loaded directly`),
        (error) => {
          console.warn('Direct loading failed, trying proxy:', error)
          // Try proxy as fallback
          const proxyUrl = `/api/proxy-model?url=${encodeURIComponent(url)}`
          loader.load(
            proxyUrl,
            (gltf) => resolve(gltf.scene),
            (xhr) => console.log(`${(xhr.loaded / xhr.total) * 100}% loaded via proxy`),
            (proxyError) => reject(proxyError)
          )
        }
      )
    }
  })
}

/**
 * Function to download a GLB model and convert it to STL
 * Uses custom loader with proxy fallback to handle CORS issues
 */
export async function convertGlbToStl(glbUrl: string): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a scene to load the GLB into
      const scene = new THREE.Scene()
      
      // Load the GLB model with our custom loader that handles proxying
      const modelScene = await loadGLBWithProxy(glbUrl)
      
      // Add the model to the scene
      scene.add(modelScene)
      
      // Apply white material to all meshes
      modelScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Create a new white material
          child.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.1,
          })
          
          // Ensure geometry is properly disposed
          if (child.geometry) {
            child.geometry.computeBoundingBox()
            child.geometry.computeBoundingSphere()
          }
        }
      })
      
      // Create STL exporter
      const exporter = new STLExporter()
      
      // Export the scene to STL binary format
      const stlData = exporter.parse(scene, { binary: true })
      
      // Create a blob from the STL data
      const blob = new Blob([stlData], { type: "application/octet-stream" })
      resolve(blob)
    } catch (error) {
      console.error("Error exporting STL:", error)
      reject(error)
    }
  })
}

/**
 * Backup method to download STL via server if client-side conversion fails
 * Directly uses the proxy endpoint that can serve STL
 */
export async function downloadStlViaServer(modelUrl: string): Promise<Blob> {
  // Use proxy endpoint to download and convert
  const proxyUrl = `/api/convert-to-stl?url=${encodeURIComponent(modelUrl)}`
  
  const response = await fetch(proxyUrl)
  
  if (!response.ok) {
    throw new Error(`Server STL conversion failed: ${response.status} ${response.statusText}`)
  }
  
  return await response.blob()
}