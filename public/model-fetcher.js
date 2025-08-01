// Enhanced Model Fetcher Script
// Prioritizes proxy for Tripo URLs and handles CORS issues

// Main function to fetch a model with CORS handling
async function fetchModel(url) {
  console.log('Model fetcher: Starting to fetch model from:', url);
  
  // Check if this is a Tripo URL
  const isTripoUrl = url.includes('tripo-data.rg1.data.tripo3d.com') || 
                    url.includes('tripo3d.com');
  
  // For Tripo URLs, always use proxy first (direct fetch tends to fail)
  if (isTripoUrl) {
    console.log('Model fetcher: Detected Tripo URL, using proxy first');
    try {
      const result = await fetchWithProxy(url);
      if (result) return result;
      // If proxy fails, try direct methods as fallback
    } catch (error) {
      console.error('Model fetcher: Proxy method failed:', error);
      // Continue to direct methods
    }
  }
  
  // Try various methods in sequence until one works
  try {
    // Method 1: Standard fetch with credentials
    console.log('Model fetcher: Trying standard fetch');
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': window.location.origin,
        'Referer': window.location.origin
      }
    });
    
    if (response.ok) {
      console.log('Model fetcher: Direct fetch successful');
      return response;
    }
    
    throw new Error(`Standard fetch failed: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.warn('Model fetcher: Standard fetch failed:', error);
    
    try {
      // Method 2: XHR request (works in some cases where fetch fails)
      console.log('Model fetcher: Trying XHR method');
      const xhrResponse = await fetchWithXHR(url);
      if (xhrResponse) {
        console.log('Model fetcher: XHR method successful');
        return xhrResponse;
      }
    } catch (xhrError) {
      console.warn('Model fetcher: XHR method failed:', xhrError);
    }
    
    // Method 3: Try no-cors mode (limited but sometimes works)
    try {
      console.log('Model fetcher: Trying no-cors mode');
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        }
      });
      
      // For no-cors, we can't check response.ok, just check if we got a response
      if (response) {
        console.log('Model fetcher: no-cors mode returned a response');
        return response;
      }
    } catch (noCorsError) {
      console.warn('Model fetcher: no-cors approach failed:', noCorsError);
    }
    
    // Final Method: Use our server proxy
    console.log('Model fetcher: All direct methods failed, trying proxy');
    const proxyResult = await fetchWithProxy(url);
    if (proxyResult) return proxyResult;
    
    // If we get here, nothing worked
    throw new Error('All fetch methods failed. Unable to load model.');
  }
}

// Helper function to fetch with XHR
function fetchWithXHR(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    
    // Add headers that might help
    xhr.setRequestHeader('Accept', '*/*');
    xhr.setRequestHeader('Accept-Language', 'en-US,en;q=0.9');
    
    // Don't set Origin/Referer headers in XHR - browser will handle appropriately
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        // Create a Response object to match fetch API
        const response = new Response(xhr.response, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/octet-stream'
          }
        });
        Object.defineProperty(response, 'ok', { value: true });
        resolve(response);
      } else {
        reject(new Error(`XHR failed with status ${xhr.status}`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error('XHR network error'));
    };
    
    xhr.ontimeout = function() {
      reject(new Error('XHR request timed out'));
    };
    
    // Longer timeout for large models
    xhr.timeout = 60000; // 60 seconds
    
    try {
      xhr.send();
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to fetch using our proxy
async function fetchWithProxy(url) {
  console.log('Model fetcher: Using server proxy');
  const proxyUrl = `/api/proxy-model?url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }
    console.log('Model fetcher: Proxy fetch successful');
    return response;
  } catch (error) {
    console.error('Model fetcher: Proxy fetch failed:', error);
    throw error;
  }
}

// Export the function globally
window.fetchModel = fetchModel;

// Notify that the fetcher is loaded
console.log('Enhanced model fetcher loaded: prioritizes proxy for Tripo URLs');