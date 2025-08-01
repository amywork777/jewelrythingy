'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

// ThreeViewerComponent as a proper React component
const ThreeViewerComponent = (props) => {
  const { modelUrl, status, progress } = props
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const animationFrameIdRef = useRef(null)
  const isMountedRef = useRef(true)  // Track mounting state with a ref
  const unmountingRef = useRef(false) // Track when unmounting for safer cleanup

  // Safe DOM element removal helper function
  const safeRemoveChild = (parent, child) => {
    try {
      // Safety checks
      if (!parent || !child) {
        return false;
      }
      
      // Use the safer innerHTML approach rather than removeChild
      if (parent.contains && parent.contains(child)) {
        parent.innerHTML = '';
        return true;
      }
    } catch (e) {
      console.warn('Safe remove child error:', e);
    }
    return false;
  };

  // Safe cleanup function with better logging
  const cleanup = () => {
    console.log("ThreeViewerComponent cleanup called");
    
    // Track unmounting status
    unmountingRef.current = true;
    
    // Cancel animation frame first
    if (animationFrameIdRef.current) {
      console.log("Canceling animation frame");
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // Dispose of controls
    if (controlsRef.current) {
      console.log("Disposing orbit controls");
      controlsRef.current.dispose();
      controlsRef.current = null;
    }

    // Clean up scene objects
    if (sceneRef.current) {
      console.log("Clearing scene");
      sceneRef.current.clear();
      sceneRef.current = null;
    }

    // Clean up camera
    cameraRef.current = null;

    // Clean up renderer and its DOM element - this is critical for the removeChild error
    if (rendererRef.current) {
      console.log("Disposing renderer");
      
      // First dispose the renderer resources
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Clear container using innerHTML - safer than removeChild
    if (containerRef.current) {
      console.log("Clearing container with innerHTML");
      try {
        containerRef.current.innerHTML = '';
      } catch (e) {
        console.warn('Error clearing container:', e);
      }
    }
  };

  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    unmountingRef.current = false;
    
    // Don't attempt to render if we don't have a completed model URL
    if (status !== "completed" || !modelUrl) {
      console.log("Not loading model - status or modelUrl not ready:", { status, modelUrl });
      return;
    }
    
    console.log("ThreeViewerComponent attempting to load model:", modelUrl);
    
    // Only run in browser
    if (typeof window === 'undefined') return;

    let isComponentMounted = true;
    let controlsInstance = null;
    let rendererInstance = null;
    let animationFrameId = null;

    const init = async () => {
      try {
        if (!isComponentMounted || !containerRef.current || unmountingRef.current) return;
        
        setIsLoading(true);
        setLoadingProgress(0);

        // Dynamically import Three.js
        console.log("Importing Three.js libraries...");
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        // Log successful imports
        console.log("Three.js libraries loaded successfully");

        if (!isComponentMounted || !containerRef.current || unmountingRef.current) return;

        // Safely clear the container first
        if (containerRef.current) {
          // Use a safer method to clear children
          containerRef.current.innerHTML = '';
        }

        // Create scene
        console.log("Creating Three.js scene");
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);
        sceneRef.current = scene;

        // Initialize container dimensions
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        console.log("Container dimensions:", { width: containerWidth, height: containerHeight });

        // Create camera with corrected aspect ratio
        const camera = new THREE.PerspectiveCamera(
          50, 
          containerWidth / containerHeight, 
          0.1, 
          2000
        );
        camera.position.set(0, 5, 10);
        cameraRef.current = camera;

        // Create renderer with proper size
        const renderer = new THREE.WebGLRenderer({ 
          antialias: true,
          alpha: true
        });
        
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(containerWidth, containerHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;
        rendererInstance = renderer;

        // Only append if component is still mounted
        if (!isComponentMounted || !containerRef.current || unmountingRef.current) return;
        
        containerRef.current.appendChild(renderer.domElement);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        
        // Adjust shadow camera for better quality
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        // Add controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 0.5;
        controls.minDistance = 1;
        controls.maxDistance = 100;
        controlsRef.current = controls;
        controlsInstance = controls;

        // Setup GLTF loader with progress tracking
        const loader = new GLTFLoader();
        
        console.log("Starting to load GLB model:", modelUrl);
        
        // Set initial loading state
        setLoadingProgress(10); 
        
        // Use a try-catch around the load operation for better error handling
        try {
          loader.load(
            modelUrl,
            (gltf) => {
              if (!isComponentMounted || unmountingRef.current) return;
              
              // Handle successful model loading
              console.log("GLB model loaded successfully");
              
              const model = gltf.scene;
              
              // Calculate bounding box for centering
              const bbox = new THREE.Box3().setFromObject(model);
              const center = new THREE.Vector3();
              const size = new THREE.Vector3();
              
              bbox.getCenter(center);
              bbox.getSize(size);
              
              // Center model
              model.position.x = -center.x;
              model.position.y = -center.y;
              model.position.z = -center.z;

              scene.add(model);

              // Adjust camera to fit the model
              const maxDim = Math.max(size.x, size.y, size.z);
              const fov = camera.fov * (Math.PI / 180);
              const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;
              
              camera.position.set(0, 0, cameraZ);
              camera.lookAt(0, 0, 0);
              
              // Set the controls target to the center of the model
              controls.target.set(0, 0, 0);
              controls.update();

              if (isComponentMounted && !unmountingRef.current) {
                setIsLoading(false);
                setLoadingProgress(100);
              }
            },
            // Progress callback
            (xhr) => {
              if (!isComponentMounted || unmountingRef.current) return;
              
              const progress = Math.round((xhr.loaded / xhr.total) * 90) + 10; // Scale from 10-100%
              console.log(`Loading model: ${progress}%`);
              setLoadingProgress(progress);
            },
            // Error callback
            (error) => {
              if (!isComponentMounted || unmountingRef.current) return;
              
              console.error("Error loading GLB model:", error);
              setHasError(true);
              setIsLoading(false);
            }
          );
        } catch (loaderError) {
          console.error("Exception during GLB loader setup:", loaderError);
          if (isComponentMounted && !unmountingRef.current) {
            setHasError(true);
            setIsLoading(false);
          }
        }

        // Animation loop
        const animate = () => {
          if (!isComponentMounted || unmountingRef.current) return;
          
          animationFrameId = requestAnimationFrame(animate);
          animationFrameIdRef.current = animationFrameId;
          
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        };

        // Handle window resize
        const handleResize = () => {
          if (!isComponentMounted || !containerRef.current || !cameraRef.current || !rendererRef.current || unmountingRef.current) return;
          
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          
          if (cameraRef.current) {
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
          }
          
          if (rendererRef.current) {
            rendererRef.current.setSize(width, height);
          }
        };

        // Add resize listener
        window.addEventListener('resize', handleResize);
        
        // Start animation
        animate();

      } catch (error) {
        console.error("Error in Three.js initialization:", error);
        if (isComponentMounted && !unmountingRef.current) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    // Initialize the 3D scene
    init();

    // Cleanup function - we need to be very careful here to avoid memory leaks and DOM errors
    return () => {
      console.log("ThreeViewerComponent unmounting, cleaning up");
      isComponentMounted = false;
      isMountedRef.current = false;
      unmountingRef.current = true;
      
      // Call the main cleanup function
      cleanup();
    };
  }, [modelUrl, status]);

  // If status is not completed or no modelUrl, show the FallbackViewer
  if (status !== "completed" || !modelUrl) {
    return <FallbackViewer status={status} progress={progress} />;
  }

  if (hasError) {
    return (
      <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
        <div className="text-center text-destructive">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p className="font-medium">Error loading model</p>
          <p className="text-sm mt-2">There was a problem displaying the 3D model</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ position: 'relative' }}
      >
        {isLoading && (
          <div 
            className="absolute inset-0 flex items-center justify-center z-10 bg-gray-100 bg-opacity-90"
            style={{ pointerEvents: 'none' }} // This prevents mouse events from conflicting
          >
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-primary">Loading 3D model... {loadingProgress}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Loading state component
const LoadingViewer = () => (
  <div className="w-full h-[450px] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
      <p className="text-muted-foreground">Loading 3D viewer...</p>
    </div>
  </div>
);

// Fallback viewer for when 3D isn't available
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
  );
};

// Export the component properly
export default ThreeViewerComponent; 