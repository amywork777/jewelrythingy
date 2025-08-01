"use client";

import { useTaiyakiIntegration } from "@/hooks/use-taiyaki-integration";

/**
 * TaiyakiProvider Component
 * 
 * This component initializes the Taiyaki integration for FISHCAD.
 * It should be included in the application layout to add "Add to FISHCAD"
 * buttons to all STL links throughout the application.
 * 
 * This component doesn't render anything visible; it only sets up
 * the integration functionality.
 */
export function TaiyakiProvider() {
  // Use the Taiyaki integration hook
  useTaiyakiIntegration();
  
  // This component doesn't render anything
  return null;
}

export default TaiyakiProvider; 