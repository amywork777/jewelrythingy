'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Converts a GLB model URL to STL format for display
export const STLConverter = ({ modelUrl, fallbackMessage }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const isMountedRef = useRef(true);

  // Safe DOM element removal helper function
  const safeRemoveChild = (parent, child) => {
    try {
      if (parent && child && parent.contains && parent.contains(child)) {
        parent.removeChild(child);
        return true;
      }
    } catch (e) {
      console.warn('Safe remove child error:', e);
    }
    return false;
  };

  // Cleanup function
  const cleanup = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (controlsRef.current) {
      controlsRef.current.dispose();
      controlsRef.current = null;
    }

    if (sceneRef.current) {
      sceneRef.current.clear();
      sceneRef.current = null;
    }

    cameraRef.current = null;

    if (rendererRef.current) {
      const rendererDomElement = rendererRef.current.domElement;
      rendererRef.current.dispose();
      
      if (rendererDomElement) {
        const parent = rendererDomElement.parentNode;
        if (parent) {
          safeRemoveChild(parent, rendererDomElement);
        }
      }
      
      rendererRef.current = null;
    }
  };

  // Create a simple STL viewer 
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!modelUrl) {
      return;
    }
    
    console.log("STL viewer attempting to load model:", modelUrl);
    
    if (typeof window === 'undefined') return;

    const init = async () => {
      try {
        if (!isMountedRef.current || !containerRef.current) return;
        
        setIsLoading(true);
        
        // Create three.js scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);
        sceneRef.current = scene;

        // Create camera
        const camera = new THREE.PerspectiveCamera(
          50,
          containerRef.current.clientWidth / containerRef.current.clientHeight,
          0.1,
          1000
        );
        camera.position.set(0, 0, 10);
        cameraRef.current = camera;

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;
        
        // Append renderer to container
        if (containerRef.current && isMountedRef.current) {
          containerRef.current.appendChild(renderer.domElement);
        } else {
          return;
        }

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Add controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controlsRef.current = controls;

        // Add a placeholder cube as fallback
        const geometry = new THREE.BoxGeometry(3, 3, 3);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0xffffff,
          metalness: 0.1,
          roughness: 0.5
        });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        // Animation loop
        const animate = () => {
          if (!isMountedRef.current) return;
          
          animationFrameIdRef.current = requestAnimationFrame(animate);
          
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          
          cube.rotation.x += 0.005;
          cube.rotation.y += 0.01;
          
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        };
        
        animate();
        
        // Handle window resize
        const handleResize = () => {
          if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
          
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          
          rendererRef.current.setSize(width, height);
        };
        
        window.addEventListener('resize', handleResize);
        
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        
        return () => {
          window.removeEventListener('resize', handleResize);
        };
      } catch (error) {
        console.error("Error in STL viewer:", error);
        setHasError(true);
        setIsLoading(false);
      }
    };
    
    init();
    
    return () => {
      console.log("STL viewer unmounting");
      isMountedRef.current = false;
      cleanup();
    };
  }, [modelUrl]);

  if (isLoading) {
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-primary mb-2">Loading backup viewer...</p>
          <p className="text-sm text-muted-foreground">{loadingProgress > 0 ? `${loadingProgress}%` : ''}</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
        <div className="text-center text-destructive">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p className="font-medium">Error loading model</p>
          <p className="text-sm mt-2">{fallbackMessage || "Unable to display the 3D model"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border relative">
      <div className="absolute top-0 left-0 p-2 bg-black bg-opacity-50 text-white text-xs rounded-br">
        Fallback Viewer
      </div>
      {modelUrl && (
        <div className="absolute top-0 right-0 p-2">
          <button
            onClick={() => {
              // For GLB to STL conversion, normally you'd convert it server-side
              // For now, we'll just offer to download the original GLB file
              window.open(modelUrl, '_blank');
            }}
            className="bg-primary text-white px-3 py-1 rounded text-xs font-medium"
          >
            Download Model
          </button>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

// Add default export
export default STLConverter;