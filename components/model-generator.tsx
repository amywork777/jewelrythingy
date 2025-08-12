"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, Wand2, RefreshCw, Camera, Repeat } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useDropzone } from "react-dropzone"
import { convertGlbToStl } from "@/lib/stl-utils"
import { useSupabaseStorage } from "@/hooks/use-supabase-storage"
import * as THREE from "three"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

// Add type definitions for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: {
    item(index: number): {
      item(index: number): {
        transcript: string;
      };
    };
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

// Define configuration message interface
interface ConfigMessage {
  type: string;
  config?: {
    limits?: {
      free?: number;
      pro?: number;
    };
    userId?: string;
    userTier?: string;
    usageCount?: number;
  };
}

// Define window type
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

type ModelGenerationStatus = "idle" | "uploading" | "generating" | "completed" | "error"

export function ModelGenerator() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedStlFile, setSelectedStlFile] = useState<File | null>(null)
  const [modelWeight, setModelWeight] = useState<number>(0)
  const [modelDimensions, setModelDimensions] = useState<{width: number, height: number, depth: number} | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<'silver' | 'gold'>('silver')
  const [targetDimensions, setTargetDimensions] = useState<{width: number, height: number, depth: number} | null>(null)
  const [baseDimensions, setBaseDimensions] = useState<{width: number, height: number, depth: number} | null>(null)
  const { toast } = useToast()

  // Supabase integration
  const { 
    sessionId, 
    uploadFile, 
    uploadSTL, 
    createModelGeneration, 
    updateModelGeneration 
  } = useSupabaseStorage()
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)

  const [status, setStatus] = useState<ModelGenerationStatus>("idle")
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [stlBlob, setStlBlob] = useState<Blob | null>(null)
  const [isConvertingStl, setIsConvertingStl] = useState(false)
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [stlViewerRef, setStlViewerRef] = useState<HTMLDivElement | null>(null)
  const [scaledGeometry, setScaledGeometry] = useState<THREE.BufferGeometry | null>(null)
  
  // Manufacturability Enhancement states
  const [useAiEnhancement, setUseAiEnhancement] = useState<boolean>(false)
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null)
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false)
  const [enhancementPrompt, setEnhancementPrompt] = useState<string | null>(null)

  const [userConfig, setUserConfig] = useState<{
    limits?: {
      free?: number;
      pro?: number;
    };
    userId?: string;
    userTier?: string;
    usageCount?: number;
  }>({})

  // Check iframe communication for user configuration
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ConfigMessage>) => {
      if (event.data && event.data.type === 'USER_CONFIG') {
        console.log('Received user configuration:', event.data.config);
        if (event.data.config) {
          setUserConfig(event.data.config);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Function to recalculate weight based on current dimensions and material
  const recalculateWeight = useCallback(() => {
    if (!modelDimensions) return;
    
    // Calculate volume in cubic millimeters
    const volumeMm3 = modelDimensions.width * modelDimensions.height * modelDimensions.depth;
    
    // Material densities
    const materialDensities = {
      silver: 0.01049, // Sterling silver: 10.49 g/cm³ = 0.01049 g/mm³
      gold: 0.01307    // 14k gold: 13.07 g/cm³ = 0.01307 g/mm³
    };
    
    const density = materialDensities[selectedMaterial];
    const weightInGrams = Math.round(volumeMm3 * density * 100) / 100;
    
    setModelWeight(weightInGrams);
  }, [modelDimensions, selectedMaterial]);

  // Recalculate weight when material changes
  useEffect(() => {
    recalculateWeight();
  }, [recalculateWeight]);

  // Manufacturability Image Enhancement function
  const enhanceImageWithAI = useCallback(async (imageFile: File): Promise<string | null> => {
    if (!imageFile) return null;
    
    setIsEnhancing(true);
    
    try {
      // Convert image file to base64 for OpenAI
      const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      };

      const base64Image = await convertToBase64(imageFile);
      
      // Enhance the image using GPT with base64 data
      const enhanceResponse = await fetch("/api/enhance-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData: base64Image,
          material: selectedMaterial,
          enhancementType: 'jewelry'
        }),
      });
      
      if (!enhanceResponse.ok) {
        const errorData = await enhanceResponse.json();
        throw new Error(errorData.error || "Failed to enhance image");
      }
      
      const enhanceData = await enhanceResponse.json();
      
      if (enhanceData.success && enhanceData.enhancedImageUrl) {
        setEnhancedImageUrl(enhanceData.enhancedImageUrl);
        setEnhancementPrompt(enhanceData.prompt);
        
        return enhanceData.enhancedImageUrl;
      } else {
        throw new Error("Enhancement failed");
      }
      
    } catch (error) {
      console.error("Error enhancing image:", error);
      toast({
        title: "Enhancement Failed",
        description: error instanceof Error ? error.message : "Failed to enhance image for manufacturability. You can still generate with the original image.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsEnhancing(false);
    }
  }, [selectedMaterial, toast]);

  // Function to apply dimension changes in real-time
  const applyDimensionChanges = useCallback(() => {
    if (!stlUrl || !stlViewerRef || !baseDimensions || !targetDimensions) return;
    
    // Calculate new weight based on target dimensions
    const volumeMm3 = targetDimensions.width * targetDimensions.height * targetDimensions.depth;
    const materialDensities = {
      silver: 0.01049, // Sterling silver: 10.49 g/cm³ = 0.01049 g/mm³
      gold: 0.01307    // 14k gold: 13.07 g/cm³ = 0.01307 g/mm³
    };
    const density = materialDensities[selectedMaterial];
    const weightInGrams = Math.round(volumeMm3 * density * 100) / 100;
    
    setModelWeight(weightInGrams);
    setModelDimensions(targetDimensions);
  }, [stlUrl, stlViewerRef, baseDimensions, targetDimensions, selectedMaterial]);

  // Apply dimension changes when target dimensions change
  useEffect(() => {
    applyDimensionChanges();
  }, [applyDimensionChanges]);

  const resetState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedStlFile(null);
    setStatus("idle");
    setModelUrl(null);
    setTaskId(null);
    setProgress(0);
    setIsGenerating(false);
    setIsDownloading(false);
    setStlBlob(null);
    setStlUrl(null);
    setModelWeight(0);
    setModelDimensions(null);
    setTargetDimensions(null);
    setBaseDimensions(null);
    setScaledGeometry(null);
    setEnhancedImageUrl(null);
    setEnhancementPrompt(null);
    setUseAiEnhancement(false);
    setIsEnhancing(false);
    
    toast({
      title: "Reset Complete",
      description: "Ready to generate a new 3D model!",
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }, [])

  const onStlDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedStlFile(file)
      const url = URL.createObjectURL(file)
      setStlUrl(url)
      setStatus("completed") // Set status to completed so viewer shows
      toast({
        title: "STL Uploaded",
        description: "Your STL file is ready to view!",
      })
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
    },
    maxFiles: 1,
    disabled: status === "uploading" || status === "generating",
  })

  const { getRootProps: getStlRootProps, getInputProps: getStlInputProps, isDragActive: isStlDragActive } = useDropzone({
    onDrop: onStlDrop,
    accept: {
      "model/stl": [".stl"],
      "application/octet-stream": [".stl"],
    },
    maxFiles: 1,
    disabled: status === "uploading" || status === "generating",
  })

  // Check if we can generate (updated for auto-trigger workflow)
  const canGenerate = selectedFile !== null

  // Optional: Handle user limits based on configuration
  const checkUserLimits = (): boolean => {
    if (!userConfig.limits) return true; // No limits configured
    
    const { userTier, usageCount, limits } = userConfig;
    const limit = userTier === 'pro' ? limits.pro : limits.free;
    
    if (limit && usageCount !== undefined && usageCount >= limit) {
      toast({
        title: "Usage Limit Reached",
        description: `You've reached your ${userTier} plan limit of ${limit} generations.`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  // Set up generation tracking
  useEffect(() => {
    const setupGenerationTracking = () => {
      // Find all generate buttons in the component
      const generateButtons = document.querySelectorAll('button, .button, [role="button"]');
      
      generateButtons.forEach(button => {
        // Check if this looks like a generate button
        const text = button.textContent?.toLowerCase() || '';
        if (text.includes('generate') && 
          (text.includes('model') || text.includes('3d'))) {
          
          console.log('Found generate button:', button);
          
          // Add click listener if not already tracked
          if (!(button as any)._trackingAdded) {
            (button as any)._trackingAdded = true;
            
            button.addEventListener('click', function() {
              console.log('Generate 3D Model clicked');
              
              // Notify the parent (FISHCAD) about the generation
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: 'fishcad_model_generated',
                  timestamp: new Date().toISOString()
                }, '*');
              }
            });
          }
        }
      });
    };

    // Run when component mounts
    setupGenerationTracking();
    
    // Also run periodically to catch dynamically added buttons
    const intervalId = setInterval(setupGenerationTracking, 2000);
    
    // Add a global click listener as backup
    const handleGlobalClick = (event: MouseEvent) => {
      let target = event.target as HTMLElement | null;
      
      // Look through clicked element and parents
      for (let i = 0; i < 5 && target; i++) {
        const text = target.textContent?.toLowerCase() || '';
        
        // Check if this is a generation button
        if (text.includes('generate') && 
          (text.includes('model') || text.includes('3d'))) {
          
          console.log('Generate button clicked via global handler');
          
          // Notify parent
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'fishcad_model_generated',
              element: target.tagName,
              text: target.textContent
            }, '*');
          }
          
          break;
        }
        
        target = target.parentElement;
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    // Clean up listeners when component unmounts
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Also add direct tracking to our submit handlers
  const notifyParentAboutGeneration = () => {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'fishcad_model_generated',
        source: 'magic.taiyaki.ai',
        method: "image",
        timestamp: new Date().toISOString()
      }, '*');
      console.log('Notified parent about model generation initiation');
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      toast({
        title: "No Image",
        description: "Please upload an image to generate a model.",
        variant: "destructive",
      })
      return
    }
    
    // Check if user has reached their limit
    if (!checkUserLimits()) return;
    
    // Notify parent about generation initiation
    notifyParentAboutGeneration();
    
    setStatus("uploading")
    setProgress(0)
    
    try {
      let imageToUse: string | null = null;
      
      // Step 1: Handle Manufacturability Enhancement if enabled
      if (useAiEnhancement && !enhancedImageUrl) {
        const enhanced = await enhanceImageWithAI(selectedFile);
        if (enhanced) {
          imageToUse = enhanced;
          // Auto-trigger 3D generation after enhancement
          setTimeout(() => {
            generateFrom3DModel(enhanced);
          }, 500);
          return; // Exit here, let the auto-trigger handle 3D generation
        } else {
          // Enhancement failed, ask user if they want to continue with original
          if (confirm(
            "Image enhancement for manufacturability failed. Would you like to continue with the original image?"
          )) {
            setStatus("idle");
            return;
          }
        }
      } else if (useAiEnhancement && enhancedImageUrl) {
        // Use existing enhanced image
        imageToUse = enhancedImageUrl;
      }
      
      await generateFrom3DModel(imageToUse);
      
    } catch (error) {
      console.error("Error generating model:", error)
      setStatus("error")
      setIsGenerating(false)
      toast({
        title: "Error",
        description: "Failed to generate model. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Separate function for 3D model generation
  const generateFrom3DModel = async (imageToUse: string | null) => {
    try {
      // Step 2: Upload the image (original or enhanced)
      setStatus("generating")
      setProgress(0)
      setIsGenerating(true)
      // Reset STL state when generating a new model
      setStlBlob(null)
      setStlUrl(null)

      let imageToken: string;
      
      if (imageToUse) {
        // If we have an enhanced image URL (data URL), we need to upload it
        if (imageToUse.startsWith('data:')) {
          // Convert data URL back to File for upload
          const response = await fetch(imageToUse);
          const blob = await response.blob();
          const file = new File([blob], 'enhanced-image.png', { type: 'image/png' });
          
          const formData = new FormData()
          formData.append("file", file)

          const uploadResponse = await fetch("/api/upload-image", {
            method: "POST",
            body: formData,
          })

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload enhanced image")
          }

          const uploadData = await uploadResponse.json()
          imageToken = uploadData.imageToken;
        } else {
          // Use enhanced image URL directly
          imageToken = imageToUse;
        }
      } else {
        // Upload original image
        const formData = new FormData()
        formData.append("file", selectedFile!)

        const uploadResponse = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image")
        }

        const uploadData = await uploadResponse.json()
        imageToken = uploadData.imageToken;
      }

      // Save to Supabase Storage and create database record
      let supabaseUpload = null;
      let generationRecord = null;
      
      try {
        // Upload original image to Supabase
        if (selectedFile) {
          supabaseUpload = await uploadFile(selectedFile, 'uploads');
          
          // Create database record
          generationRecord = await createModelGeneration({
            prompt: `Image-based 3D model generation`,
            generation_type: 'image',
            original_image_path: supabaseUpload.path,
            original_image_url: supabaseUpload.url,
            file_sizes: {
              original: selectedFile.size
            }
          });
          
          setCurrentGenerationId(generationRecord.generation.id);
          
          toast({
            title: "Saved to Database",
            description: "Image uploaded and generation record created.",
          });
        }
      } catch (error) {
        console.error('Supabase upload error:', error);
        // Don't fail the whole process, just log the error
        toast({
          title: "Database Warning",
          description: "Model generation continues, but may not be saved to history.",
          variant: "destructive",
        });
      }

      // Step 3: Generate 3D model from the image
      setStatus("generating")
      const response = await fetch("/api/generate-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "image",
          imageToken: imageToken,
          enhanced: useAiEnhancement && enhancedImageUrl !== null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to start model generation")
      }

      const data = await response.json()
      setTaskId(data.taskId)

      // Start polling for task status
      pollTaskStatus(data.taskId)
    } catch (error) {
      console.error("Error in 3D generation:", error)
      setStatus("error")
      setIsGenerating(false)
      toast({
        title: "Error",
        description: "Failed to generate 3D model. Please try again.",
        variant: "destructive",
      })
    }
  }

  const convertToStl = async (url: string) => {
    try {
      setIsConvertingStl(true)
      
      // Convert GLB to STL
      const blob = await convertGlbToStl(url)
      setStlBlob(blob)
      
      // Create a URL for the STL blob
      const blobUrl = URL.createObjectURL(blob)
      setStlUrl(blobUrl)
      
      // Save STL to Supabase
      try {
        const stlUpload = await uploadSTL(blob, 'generated-model.stl');
        
        // Update database record with STL info
        if (currentGenerationId) {
          await updateModelGeneration(currentGenerationId, {
            status: 'completed',
            stl_file_path: stlUpload.path,
            stl_file_url: stlUpload.url,
            model_url: url,
            file_sizes: {
              original: selectedFile?.size || 0,
              stl: blob.size
            }
          });
          
          toast({
            title: "STL Saved",
            description: "STL file has been saved to your storage.",
          });
        }
      } catch (error) {
        console.error('Supabase STL upload error:', error);
        toast({
          title: "STL Storage Warning",
          description: "STL created but may not be saved to cloud storage.",
          variant: "destructive",
        });
      }
      
      toast({
        title: "Conversion complete",
        description: "Your model has been converted to STL format.",
      })
      
      return blob
    } catch (error) {
      // console.error("Error converting to STL:", error)
      toast({
        title: "Error",
        description: "Failed to convert model to STL format. You can still try downloading.",
        variant: "destructive",
      })
      return null
    } finally {
      setIsConvertingStl(false)
    }
  }

  const pollTaskStatus = async (taskId: string, retryCount = 0, maxRetries = 3) => {
    try {
      // console.log(`Polling task status for taskId: ${taskId} (attempt: ${retryCount + 1}/${maxRetries + 1})`);
      
      // Get the current origin for constructing absolute URLs
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const apiUrl = `${origin}/api/task-status?taskId=${taskId}`;
      
      // console.log(`Using API URL: ${apiUrl}`);
      
      // Try POST method first on retry attempts since GET might be having CORS issues
      const method = retryCount > 0 ? 'POST' : 'GET';
      // console.log(`Using HTTP method: ${method}`);
      
      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        // For POST requests, include the taskId in the body as well
        ...(method === 'POST' && { 
          body: JSON.stringify({ taskId }) 
        }),
        credentials: 'same-origin'
      }).catch(err => {
        // console.error(`❌ Network error fetching task status:`, err);
        throw err;
      });

      // console.log(`📥 Task status response:`, {
      //   status: response.status,
      //   statusText: response.statusText,
      //   ok: response.ok
      // });

      if (!response.ok) {
        // For 405 Method Not Allowed specifically (CORS or server config issue)
        if (response.status === 405) {
          // console.warn(`⚠️ API returned 405 Method Not Allowed - trying alternative approach`);
          
          // If GET failed with 405, try POST immediately
          if (method === 'GET') {
            // console.log(`🔄 Switching from GET to POST method immediately`);
            // Call ourselves but with retryCount+0.5 to indicate we're doing an immediate method switch
            setTimeout(() => pollTaskStatus(taskId, retryCount + 0.5, maxRetries), 100);
            return;
          }
          
          if (retryCount < maxRetries) {
            // console.log(`🔄 Retrying in 3 seconds... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => pollTaskStatus(taskId, retryCount + 1, maxRetries), 3000);
            return;
          }
        }
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(err => {
        // console.error(`❌ Error parsing JSON response:`, err);
        throw new Error("Failed to parse task status response");
      });

      // console.log(`📄 Task status data:`, data);

      // Even if we get an error response, if it has status and progress we can still use it
      if (data.error || data.message) {
        const errorMsg = data.error || data.message;
        // console.warn(`⚠️ API returned error/message with 200 status:`, errorMsg);
        
        // If the server returned a status and progress, we can use those to update the UI
        if (data.status === 'running' && typeof data.progress === 'number') {
          // console.log(`⚠️ Using fallback progress data from API error response:`, data.progress);
          setProgress(data.progress);
          
          // For API key issues, show a toast only on the first retry
          if (errorMsg?.includes('API key') && retryCount === 0) {
            toast({
              title: "API Configuration Issue",
              description: "There may be an issue with the API configuration. Your model is still being processed.",
              duration: 5000,
            });
          }
          
          // Continue polling with slightly longer delay for simulated progress
          setTimeout(() => pollTaskStatus(taskId, retryCount + 1, maxRetries), 4000);
          return;
        }
        
        // Only throw if no useful data is provided
        if (!data.status) {
          throw new Error(errorMsg);
        }
      }

      if (data.status === "success") {
        setStatus("completed")
        
        // Enhanced model URL handling with validation and logging
        let finalModelUrl: string | null = null;
        
        if (data.modelUrl) {
          // Just set the URL without logging it
          finalModelUrl = data.modelUrl;
        } else {
          if (data.baseModelUrl) {
            finalModelUrl = data.baseModelUrl;
          } else {
            toast({
              title: "Warning",
              description: "Model generated but the viewer URL may not be available.",
              variant: "destructive",
            });
          }
        }
        
        setModelUrl(finalModelUrl);
        setProgress(100);
        setIsGenerating(false);
        
        // Automatically start STL conversion when model is ready
        if (finalModelUrl) {
          // Start STL conversion
          convertToStl(finalModelUrl)
            .then(blob => {
              if (blob) {
                // STL conversion completed successfully
              }
            })
            .catch(() => {
              // Error is already handled in convertToStl
            });
        }
        
        toast({
          title: "Success!",
          description: "Your 3D model has been generated successfully.",
        });

        // Send generation completion message to parent window if in iframe
        if (window !== window.parent) {
          const modelInfo = {
            modelUrl: data.modelUrl || data.baseModelUrl,
            prompt: "Image-based 3D model",
            generationMethod: "image-to-3d",
            timestamp: new Date().toISOString(),
            taskId: taskId,
            fileType: 'glb'
          };
          
          window.parent.postMessage({
            type: 'model-generated',
            source: 'magic.taiyaki.ai',
            modelInfo
          }, '*');
          
          // Replace detailed log with generic message
          console.log("Model generation completed and notified parent window");
        }
      } else if (data.status === "failed" || data.status === "cancelled" || data.status === "unknown") {
        setStatus("error")
        setIsGenerating(false)
        toast({
          title: "Error",
          description: "Model generation failed. Please try again.",
          variant: "destructive",
        })
      } else {
        // Still in progress or using fake/fallback progress
        setProgress(data.progress || 0)
        
        // If we've reached max retries but still getting progress updates,
        // implement a "simulated progress" mechanism that will never reach 100%
        if (retryCount >= maxRetries && data.progress) {
          // Ensure progress keeps moving slightly but never reaches 100%
          const simulatedProgress = Math.min(98, data.progress + 3 + Math.floor(Math.random() * 5));
          // console.log(`⚠️ Using simulated progress after max retries:`, simulatedProgress);
          setProgress(simulatedProgress);
          
          // Every 10 seconds, we should check if the real API is back
          setTimeout(() => pollTaskStatus(taskId, 0, maxRetries), 10000);
          return;
        }
        
        // Regular polling
        setTimeout(() => pollTaskStatus(taskId, retryCount + 1, maxRetries), 3000)
      }
    } catch (error) {
      // console.error("Error polling task status:", error);
      
      // Show a fake success after max retries for better UX (will at least show the model generation is in progress)
      if (retryCount >= maxRetries) {
        // console.log("Maximum retries reached. Showing placeholder progress UI.");
        // Simulate progress without actual data
        setStatus("generating");
        const fakeProgress = 25 + (retryCount * 10); // Gradually increase fake progress
        setProgress(Math.min(fakeProgress, 98)); // Never reach 100% with fake progress
        
        // Keep retrying in background but show fake progress to user
        setTimeout(() => pollTaskStatus(taskId, retryCount + 1, maxRetries + 5), 3000);
        return;
      }
      
      // Implement retry logic for errors
      if (retryCount < maxRetries) {
        // console.log(`🔄 Error occurred, retrying in 3 seconds... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => pollTaskStatus(taskId, retryCount + 1, maxRetries), 3000);
        return;
      }
      
      // Only show error to user after max retries (which should never happen now thanks to the fake progress handling)
      setStatus("error");
      setIsGenerating(false);
      toast({
        title: "Error",
        description: "Failed to check model status. The model may still be generating.",
        variant: "destructive",
      });
    }
  }

  // Function to export scaled geometry as STL
  const exportScaledGeometryAsSTL = useCallback(async (): Promise<Blob | null> => {
    if (!scaledGeometry) {
      console.error('No scaled geometry available for export');
      return null;
    }

    try {
      // Create a temporary scene with the scaled geometry
      const tempScene = new THREE.Scene();
      const tempMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.1,
      });
      
      // Clone the geometry to avoid modifying the original
      const geometryClone = scaledGeometry.clone();
      const tempMesh = new THREE.Mesh(geometryClone, tempMaterial);
      tempScene.add(tempMesh);

      // Use STLExporter to export the scaled geometry
      const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
      const exporter = new STLExporter();
      const stlData = exporter.parse(tempScene, { binary: true });
      
      // Create blob from STL data
      const blob = new Blob([stlData], { type: "application/octet-stream" });
      
      // Clean up
      tempMaterial.dispose();
      geometryClone.dispose();
      
      return blob;
    } catch (error) {
      console.error('Error exporting scaled geometry as STL:', error);
      return null;
    }
  }, [scaledGeometry]);

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      let blobToDownload: Blob | null = null;
      let fileName = "jewelry-model.stl";

      // For both uploaded STL files and generated models, 
      // use the scaled geometry from the 3D viewer
      if (scaledGeometry) {
        console.log('Exporting scaled geometry with actual dimensions shown in UI');
        blobToDownload = await exportScaledGeometryAsSTL();
        
        // Create filename with dimensions
        if (modelDimensions) {
          const { width, height, depth } = modelDimensions;
          fileName = `jewelry-${width}x${height}x${depth}mm-${selectedMaterial}.stl`;
        }
      } else if (selectedStlFile && !stlBlob) {
        // Fallback: if no scaled geometry available, use original uploaded file
        console.warn('No scaled geometry available, using original uploaded STL file');
        blobToDownload = selectedStlFile;
        fileName = selectedStlFile.name;
      } else if (stlBlob) {
        // Fallback: use generated STL blob
        console.warn('No scaled geometry available, using generated STL blob');
        blobToDownload = stlBlob;
      }

      if (!blobToDownload) {
        toast({
          title: "No STL Available",
          description: "Please generate or upload a model first.",
          variant: "destructive",
        });
        return;
      }

      // Download the STL file
      const downloadUrl = URL.createObjectURL(blobToDownload);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the STL file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Update the STL viewer when the STL URL changes
  useEffect(() => {
    if (!stlUrl || !stlViewerRef) return;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;
    let material: THREE.Material;
    let mesh: THREE.Mesh;
    let animationId: number;

    // Set up the scene
    const setupScene = () => {
      // Create scene with dark background for contrast
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222222); // Dark gray background

      const width = stlViewerRef.clientWidth;
      const height = stlViewerRef.clientHeight;
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0, 10);

      // Create renderer with balanced settings
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Balanced tone mapping
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0; // Normal exposure
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      
      if (stlViewerRef.firstChild) {
        stlViewerRef.removeChild(stlViewerRef.firstChild);
      }
      stlViewerRef.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.2;
      controls.rotateSpeed = 0.7;
      controls.enableZoom = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;

      // Bright lighting for shiny jewelry visibility
      const directionalLight = new THREE.DirectionalLight(0xffffff, 4.5);
      directionalLight.position.set(1, 1, 1);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
      scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0xffffff, 3.0);
      pointLight1.position.set(-5, 5, 5);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xffffff, 3.0);
      pointLight2.position.set(5, -5, 5);
      scene.add(pointLight2);

      // Add a few more lights for jewelry sparkle
      const pointLight3 = new THREE.PointLight(0xffffff, 2.5);
      pointLight3.position.set(0, 8, -8);
      scene.add(pointLight3);

      const pointLight4 = new THREE.PointLight(0xffffff, 2.5);
      pointLight4.position.set(-8, -8, 0);
      scene.add(pointLight4);

      // Add rim lighting for edge highlights
      const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
      rimLight.position.set(-1, 0, 1);
      scene.add(rimLight);

      // Load the STL model
      const loader = new STLLoader();
      loader.load(stlUrl, (geometry) => {
        // Center the geometry
        geometry.center();
        geometry.computeVertexNormals();

        // Calculate original bounding box
        const tempMesh1 = new THREE.Mesh(geometry);
        const originalBox = new THREE.Box3().setFromObject(tempMesh1);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        
        // Find the tallest dimension
        const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z);
        
        // Scale to make tallest dimension 15mm
        const targetSizeInMeters = 0.015; // 15mm in meters
        const scaleFactorTo15mm = targetSizeInMeters / maxDimension;
        geometry.scale(scaleFactorTo15mm, scaleFactorTo15mm, scaleFactorTo15mm);
        
        // Calculate base dimensions after 15mm scaling
        const tempMesh2 = new THREE.Mesh(geometry);
        const baseBox = new THREE.Box3().setFromObject(tempMesh2);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const baseDimensionsInMm = {
          width: Math.round(baseSize.x * 1000 * 100) / 100,
          height: Math.round(baseSize.y * 1000 * 100) / 100,
          depth: Math.round(baseSize.z * 1000 * 100) / 100
        };
        
        // Set base dimensions and initialize target dimensions if not set
        setBaseDimensions(baseDimensionsInMm);
        if (!targetDimensions) {
          setTargetDimensions(baseDimensionsInMm);
        }
        
        // Apply custom scaling if target dimensions are different from base
        const currentTargets = targetDimensions || baseDimensionsInMm;
        const scaleX = currentTargets.width / baseDimensionsInMm.width;
        const scaleY = currentTargets.height / baseDimensionsInMm.height;
        const scaleZ = currentTargets.depth / baseDimensionsInMm.depth;
        
        geometry.scale(scaleX, scaleY, scaleZ);
        
        // Calculate final dimensions in mm
        const tempMesh3 = new THREE.Mesh(geometry);
        const finalBox = new THREE.Box3().setFromObject(tempMesh3);
        const finalSize = finalBox.getSize(new THREE.Vector3());
        const dimensionsInMm = {
          width: Math.round(finalSize.x * 1000 * 100) / 100,
          height: Math.round(finalSize.y * 1000 * 100) / 100,
          depth: Math.round(finalSize.z * 1000 * 100) / 100
        };
        
        // Calculate volume (in cubic meters) and estimate weight
        const volumeM3 = finalSize.x * finalSize.y * finalSize.z;
        const volumeMm3 = volumeM3 * 1e9; // Convert to cubic millimeters
        
        // Material densities
        const materialDensities = {
          silver: 0.01049, // Sterling silver: 10.49 g/cm³ = 0.01049 g/mm³
          gold: 0.01307    // 14k gold: 13.07 g/cm³ = 0.01307 g/mm³
        };
        
        const density = materialDensities[selectedMaterial];
        const weightInGrams = Math.round(volumeMm3 * density * 100) / 100;
        
        // Update state with calculations
        setModelDimensions(dimensionsInMm);
        setModelWeight(weightInGrams);

        // CRITICAL: Store the scaled geometry for STL export
        // Clone the geometry at this point (after all scaling but before viewer scaling)
        const scaledGeometryForExport = geometry.clone();
        setScaledGeometry(scaledGeometryForExport);

        // Scale for viewing in the 3D scene (separate from the 15mm scaling)
        const boundingBox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const viewerScale = 5 / maxDim;
        geometry.scale(viewerScale, viewerScale, viewerScale);

        // Create pure white shiny material
        material = new THREE.MeshStandardMaterial({
          color: 0xFFFFFF, // Pure white
          metalness: 0.9,
          roughness: 0.1,
          envMapIntensity: 1.5,
          flatShading: false,
        });

        // Create the mesh and add it to the scene
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // Position camera to view the model
        const boundingSphere = geometry.boundingSphere;
        if (boundingSphere) {
          const center = boundingSphere.center;
          const radius = boundingSphere.radius;
          camera.position.set(center.x, center.y, center.z + radius * 2.5);
          controls.target.set(center.x, center.y, center.z);
          controls.update();
        }
      });
    };

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    // Handle window resize
    const handleResize = () => {
      if (!stlViewerRef) return;
      const width = stlViewerRef.clientWidth;
      const height = stlViewerRef.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    setupScene();
    animate();
    window.addEventListener('resize', handleResize);

    // Clean up on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationId) cancelAnimationFrame(animationId);
      if (scene && mesh) scene.remove(mesh);
      if (material) {
        if ('dispose' in material) material.dispose();
      }
      if (controls) controls.dispose();
      if (renderer) renderer.dispose();
    };
  }, [stlUrl, stlViewerRef, targetDimensions]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="flex gap-6">
            {/* Left Column - Upload Areas (Smaller) */}
            <div className="w-1/3 space-y-4">
              {/* Image Upload Area */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Generate from Image:</p>
                
                {/* Manufacturability Enhancement Toggle */}
                <div className="mb-3 p-2 bg-blue-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-blue-800">Manufacturability Enhancement</p>
                      <p className="text-xs text-blue-600">Optimize image for jewelry 3D conversion</p>
                    </div>
                    <Button
                      type="button"
                      variant={useAiEnhancement ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setUseAiEnhancement(!useAiEnhancement);
                        if (!useAiEnhancement) {
                          setEnhancedImageUrl(null);
                          setEnhancementPrompt(null);
                        }
                      }}
                      className="text-xs"
                    >
                      {useAiEnhancement ? "ON" : "OFF"}
                    </Button>
                  </div>
                </div>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:bg-gray-50"
                  } ${status === "uploading" || status === "generating" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input {...getInputProps()} />
                  {previewUrl ? (
                    <div className="flex flex-col items-center gap-1">
                      {/* Show both original and enhanced images if enhancement is used */}
                      {useAiEnhancement && enhancedImageUrl ? (
                        <div className="w-full space-y-2">
                          <div className="text-xs text-gray-500 font-medium">Original:</div>
                          <img
                            src={previewUrl}
                            alt="Original"
                            className="max-h-[60px] max-w-full object-contain rounded-lg border"
                          />
                          <div className="text-xs text-green-600 font-medium">Manufacturing Enhanced:</div>
                          <img
                            src={enhancedImageUrl}
                            alt="Enhanced"
                            className="max-h-[80px] max-w-full object-contain rounded-lg border-2 border-green-300"
                          />
                        </div>
                      ) : useAiEnhancement && isEnhancing ? (
                        <div className="w-full space-y-2">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-h-[60px] max-w-full object-contain rounded-lg opacity-50"
                          />
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-blue-600">Enhancing...</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-[80px] max-w-full object-contain rounded-lg"
                        />
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex gap-1 mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setPreviewUrl(null);
                            setModelWeight(0);
                            setModelDimensions(null);
                            setTargetDimensions(null);
                            setBaseDimensions(null);
                            setScaledGeometry(null);
                            setEnhancedImageUrl(null);
                            setEnhancementPrompt(null);
                            // Clear the 3D viewer
                            if (stlViewerRef) {
                              while (stlViewerRef.firstChild) {
                                stlViewerRef.removeChild(stlViewerRef.firstChild);
                              }
                            }
                          }}
                          className="text-xs h-6 px-2"
                        >
                          <Repeat className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3">
                      <Camera className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs font-medium">Upload Image</p>
                      <p className="text-xs text-gray-500">JPG, PNG</p>
                    </div>
                  )}
                </div>
              </div>

              {/* STL Upload Area */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Or View Existing STL:</p>
                <div
                  {...getStlRootProps()}
                  className={`border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-colors ${
                    isStlDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:bg-gray-50"
                  } ${status === "uploading" || status === "generating" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input {...getStlInputProps()} />
                  {selectedStlFile ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Upload className="h-4 w-4 text-gray-500" />
                      <span className="text-xs text-gray-700 truncate">{selectedStlFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStlFile(null);
                          setStlUrl(null);
                          setStatus("idle");
                          setModelWeight(0);
                          setModelDimensions(null);
                          setTargetDimensions(null);
                          setBaseDimensions(null);
                          setScaledGeometry(null);
                          setEnhancedImageUrl(null);
                          setEnhancementPrompt(null);
                          // Clear the 3D viewer
                          if (stlViewerRef) {
                            while (stlViewerRef.firstChild) {
                              stlViewerRef.removeChild(stlViewerRef.firstChild);
                            }
                          }
                        }}
                        className="h-5 w-5 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ) : (
                    <div className="py-3">
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs font-medium">Upload STL</p>
                      <p className="text-xs text-gray-500">STL files</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bars */}
              {(status === "generating" || status === "uploading") && (
                <div className="space-y-2">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-center text-xs text-gray-500">
                    {status === "uploading" ? "Uploading image" : "Generating 3D model"}: {progress}%
                  </p>
                </div>
              )}

              {/* Generate button */}
              {(status !== "completed" || !modelUrl) && !selectedStlFile && (
                <Button
                  className="w-full flex items-center justify-center"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={
                    isGenerating || 
                    !selectedFile ||
                    isEnhancing
                  }
                >
                  {isGenerating ? (
                    <>
                      <span className="text-xs mr-2">Generating</span>
                      <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    </>
                  ) : isEnhancing ? (
                    <>
                      <span className="text-xs mr-2">Enhancing Image</span>
                      <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3 w-3 mr-2" />
                      <span className="text-xs">
                        {useAiEnhancement ? 
                          (enhancedImageUrl ? "Generate from Enhanced Image" : "Enhance & Generate 3D Model") : 
                          "Generate 3D Model"
                        }
                      </span>
                    </>
                  )}
                </Button>
              )}

              {/* Model Info Display */}
              {status === "completed" && (modelWeight > 0 || modelDimensions) && (
                <div className="space-y-3 bg-blue-50 p-3 rounded-lg border">
                  <p className="text-sm font-medium text-gray-700">Model Information:</p>
                  
                  {/* Material Selection */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Material:</p>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedMaterial === 'silver' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedMaterial('silver')}
                        className="flex-1 text-xs"
                      >
                        🥈 Sterling Silver
                      </Button>
                      <Button
                        variant={selectedMaterial === 'gold' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedMaterial('gold')}
                        className="flex-1 text-xs"
                      >
                        🥇 14K Gold
                      </Button>
                    </div>
                  </div>

                  {/* Custom Dimensions */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Custom Dimensions (mm):</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-600">Width:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="200"
                          value={targetDimensions?.width || 0}
                          onChange={(e) => {
                            const newWidth = parseFloat(e.target.value) || 0;
                            setTargetDimensions(prev => prev ? {...prev, width: newWidth} : {width: newWidth, height: 0, depth: 0});
                          }}
                          className="w-full text-xs p-1 border rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Height:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="200"
                          value={targetDimensions?.height || 0}
                          onChange={(e) => {
                            const newHeight = parseFloat(e.target.value) || 0;
                            setTargetDimensions(prev => prev ? {...prev, height: newHeight} : {width: 0, height: newHeight, depth: 0});
                          }}
                          className="w-full text-xs p-1 border rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Depth:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="200"
                          value={targetDimensions?.depth || 0}
                          onChange={(e) => {
                            const newDepth = parseFloat(e.target.value) || 0;
                            setTargetDimensions(prev => prev ? {...prev, depth: newDepth} : {width: 0, height: 0, depth: newDepth});
                          }}
                          className="w-full text-xs p-1 border rounded"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {modelWeight > 0 && (
                    <div className="text-xs text-gray-600">
                      <p><strong>Estimated Weight:</strong> {modelWeight}g ({selectedMaterial === 'silver' ? 'Sterling Silver' : '14K Gold'})</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons when model is ready */}
              {status === "completed" && (modelUrl || selectedStlFile) && (
                <div className="space-y-2">
                  <Button 
                    className="w-full flex items-center justify-center" 
                    variant="outline"
                    onClick={handleDownload}
                    disabled={isDownloading || isConvertingStl}
                    size="sm"
                  >
                    {isDownloading ? (
                      <>
                        <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-xs">Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3 mr-2" />
                        <span className="text-xs">Download STL</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Right Column - 3D Viewer (Bigger and Focused) */}
            <div className="w-2/3">
              {status === "completed" ? (
                <div className="bg-gray-100 rounded-lg overflow-hidden border" style={{ height: "500px", minHeight: "500px" }}>
                  {isConvertingStl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-gray-600">Converting to STL format...</p>
                    </div>
                  ) : !stlUrl && !stlBlob && !selectedStlFile ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm text-gray-600">Preparing 3D model...</p>
                    </div>
                  ) : (
                    <div 
                      ref={setStlViewerRef} 
                      className="w-full h-full"
                    ></div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 flex items-center justify-center" style={{ height: "500px" }}>
                  <div className="text-center text-gray-500">
                    <Camera className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">3D Model Viewer</p>
                    <p className="text-sm">Upload an image or STL file to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optionally add UI to show usage limits if configured */}
      {userConfig.limits && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          {userConfig.userTier === 'free' ? (
            <p>
              {userConfig.usageCount || 0} / {userConfig.limits.free} models generated 
              {userConfig.usageCount && userConfig.limits.free && userConfig.usageCount >= userConfig.limits.free && 
                " - Limit reached! Upgrade for more."}
            </p>
          ) : userConfig.userTier === 'pro' ? (
            <p>Pro account: {userConfig.usageCount || 0} / {userConfig.limits.pro} models generated</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

