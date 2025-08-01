"use client";

/**
 * Browser-specific utility functions
 * 
 * These utilities help with common browser operations needed
 * for the Taiyaki integration.
 */

/**
 * Safely checks if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Extracts a filename from a URL path
 * @param url The URL to extract the filename from
 * @returns The extracted filename or a fallback name
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const filename = segments[segments.length - 1];
    
    // Remove any query parameters
    return filename.split('?')[0] || 'model.stl';
  } catch (error) {
    // If URL parsing fails, try a simpler approach
    const segments = url.split('/');
    const lastSegment = segments[segments.length - 1];
    return lastSegment.split('?')[0] || 'model.stl';
  }
}

/**
 * Extracts metadata from the page for the STL file
 * @returns Metadata object with available information
 */
export function extractPageMetadata() {
  if (!isBrowser()) return {};
  
  // Get page title
  const title = document.title || '';
  
  // Get page URL
  const url = window.location.href;
  
  // Try to get meta description
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  
  // Try to get meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
  const keywords = metaKeywords.split(',').map(k => k.trim()).filter(Boolean);
  
  return {
    title,
    source: url,
    description: metaDescription,
    tags: keywords.length > 0 ? keywords : ['magicfish-ai'],
  };
}

/**
 * Debounces a function to prevent excessive calls
 * @param func The function to debounce
 * @param wait Wait time in milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Creates an observer that watches for DOM changes
 * @param callback Function to call when changes are detected
 * @param targetNode Node to observe (defaults to document.body)
 * @param config MutationObserver configuration
 * @returns The created MutationObserver
 */
export function createDomObserver(
  callback: MutationCallback,
  targetNode: Node = document.body,
  config: MutationObserverInit = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'data-file-type'],
  }
): MutationObserver {
  if (!isBrowser()) {
    throw new Error('DOM observer can only be created in browser environment');
  }
  
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  return observer;
}

/**
 * Safely adds a window event listener with automatic cleanup
 * @param eventType Event type to listen for
 * @param handler Event handler function
 * @returns Cleanup function to remove the event listener
 */
export function addWindowListener<K extends keyof WindowEventMap>(
  eventType: K,
  handler: (event: WindowEventMap[K]) => void
): () => void {
  if (!isBrowser()) {
    return () => {};
  }
  
  window.addEventListener(eventType, handler);
  return () => window.removeEventListener(eventType, handler);
} 