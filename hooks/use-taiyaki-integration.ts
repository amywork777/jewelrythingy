"use client";

import { useEffect } from 'react';
import { initializeTaiyakiIntegration } from '@/lib/taiyaki-integration';

/**
 * React hook to initialize and clean up the Taiyaki integration
 * 
 * This hook can be used in any React component that needs to
 * integrate with FISHCAD by adding "Add to FISHCAD" buttons
 * next to STL links.
 * 
 * Usage:
 * ```
 * import { useTaiyakiIntegration } from '@/hooks/use-taiyaki-integration';
 * 
 * function MyComponent() {
 *   useTaiyakiIntegration();
 *   // ...
 * }
 * ```
 */
export function useTaiyakiIntegration() {
  useEffect(() => {
    // Initialize Taiyaki integration
    const cleanup = initializeTaiyakiIntegration();
    
    // Return cleanup function to be called on component unmount
    return cleanup;
  }, []);
}

export default useTaiyakiIntegration; 