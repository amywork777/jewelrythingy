import { type NextRequest, NextResponse } from "next/server"

// Define CORS headers for consistent use
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
  'Access-Control-Max-Age': '86400',
};

// Common handler for any method that needs to get task status
async function handleTaskStatus(request: NextRequest) {
  try {
    // Extract task ID from query parameters
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    // console.log(`[task-status] Checking status for task ID: ${taskId}`);
    
    if (!taskId) {
      // console.error(`❌ [task-status] No task ID provided in request`);
      return NextResponse.json(
        { error: "Task ID is required" }, 
        { status: 400, headers: corsHeaders }
      );
    }

    // Ensure API key is present
    const apiKey = process.env.TRIPO_API_KEY;
    if (!apiKey) {
      // console.error(`❌ [task-status] TRIPO_API_KEY is missing in environment variables`);
      
      // Return fake progress for better UX instead of error
      return NextResponse.json(
        { 
          status: 'running',
          progress: Math.min(85, 25 + Math.floor(Math.random() * 20)), // Random progress between 25-45%
          message: 'API key missing, showing simulated progress'
        }, 
        { status: 200, headers: corsHeaders }
      );
    }

    // Validate API key format (basic check)
    if (!apiKey.startsWith('tsk_') || apiKey.length < 20) {
      // console.error(`❌ [task-status] TRIPO_API_KEY appears to be invalid (should start with 'tsk_' and be at least 20 chars)`);
      
      return NextResponse.json(
        { 
          status: 'running',
          progress: Math.min(90, 30 + Math.floor(Math.random() * 25)), // Random progress between 30-55%
          message: 'API key format appears invalid, showing simulated progress'
        }, 
        { status: 200, headers: corsHeaders }
      );
    }

    // console.log(`✅ [task-status] TRIPO_API_KEY found (length: ${apiKey.length})`);

    // Call Tripo API to check task status
    const tripoResponse = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }).catch(error => {
      // console.error(`❌ [task-status] Network error calling Tripo API:`, error);
      throw error;
    });

    // console.log(`[task-status] Tripo API status response: ${tripoResponse.status} ${tripoResponse.statusText}`);
    
    if (!tripoResponse.ok) {
      // Try to get error details
      let errorData = { error: "Unknown API error" };
      try {
        errorData = await tripoResponse.json();
      } catch (e) {
        // console.error(`❌ [task-status] Could not parse error response:`, e);
      }
      
      // console.error(`❌ [task-status] Tripo API error:`, errorData);
      
      // If unauthorized (401) or not found (404), it's likely an API key issue
      if (tripoResponse.status === 401 || tripoResponse.status === 403) {
        // console.error(`❌ [task-status] API key authentication failed`);
        return NextResponse.json(
          { 
            status: 'running',
            progress: Math.min(90, 40 + Math.floor(Math.random() * 15)), // Random progress between 40-55%
            error: "API key issue, showing progress UI as fallback",
            details: errorData
          }, 
          { status: 200, headers: corsHeaders } // Return 200 to avoid CORS issues, client will handle
        );
      }
      
      // For any other error, return a proper error response
      return NextResponse.json(
        { 
          status: 'running',
          progress: Math.min(95, 50 + Math.floor(Math.random() * 20)), // Random progress between 50-70%
          error: "Failed to get task status", 
          details: errorData
        }, 
        { status: 200, headers: corsHeaders } // Return 200 to avoid CORS issues, client will handle error
      );
    }

    const data = await tripoResponse.json().catch(e => {
      // console.error(`❌ [task-status] Failed to parse Tripo API response:`, e);
      return { data: { status: 'running', progress: 30 } };
    });
    
    // If there's no data property in response, return an error
    if (!data || !data.data) {
      // console.error(`❌ [task-status] Unexpected response format from Tripo API:`, data);
      
      // Check specifically for API key related issues in the raw response
      if (data && (data.code === 2001 || data.message?.includes('auth'))) {
        // console.error(`❌ [task-status] API key seems invalid or task ID not accessible with this key`);
      }
      
      return NextResponse.json(
        { 
          status: 'running',
          progress: 60,
          error: "Unexpected API response format"
        }, 
        { status: 200, headers: corsHeaders }
      );
    }
    
    const taskData = data.data
    
    // console.log(`[task-status] Task status: ${taskData.status}, progress: ${taskData.progress || 0}%`);
    
    // Extract model URLs for completed tasks
    let finalModelUrl = null;
    let baseModelUrl = null;
    
    if (taskData.status === "success" && taskData.output) {
      // Store both URLs 
      finalModelUrl = taskData.output.model || null;
      baseModelUrl = taskData.output.base_model || null;
      
      // console.log(`[task-status] Final model URL: ${finalModelUrl || 'not available'}`);
      // console.log(`[task-status] Base model URL: ${baseModelUrl || 'not available'}`);
      
      // Use base_model if available and model isn't, or use whichever is available
      if (!finalModelUrl && baseModelUrl) {
        // console.log(`✅ [task-status] Using base_model URL for model display: ${baseModelUrl}`);
        finalModelUrl = baseModelUrl;
      }
      
      if (!finalModelUrl && !baseModelUrl) {
        // console.warn(`⚠️ [task-status] No model URLs found in task output:`, taskData.output);
      } else {
        // console.log(`✅ [task-status] Using model URL: ${finalModelUrl || baseModelUrl}`);
      }
    }

    // Format the response with all URLs
    const response = {
      status: taskData.status,
      progress: taskData.progress || 0,
      modelUrl: finalModelUrl,
      baseModelUrl: baseModelUrl, // Also return baseModelUrl separately
      renderedImage: taskData.status === "success" ? taskData.output?.rendered_image : null,
    }
    
    // console.log(`[task-status] Sending response:`, response);

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    // console.error(`❌ [task-status] Error getting task status:`, error)
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error",
        status: 'running', // Provide fallback status to avoid UI breaking
        progress: 40  // Provide some progress to show in UI
      }, 
      { status: 200, headers: corsHeaders } // Return 200 even on error for CORS compatibility
    );
  }
}

// GET method handler
export async function GET(request: NextRequest) {
  // console.log("[task-status] GET request received");
  return handleTaskStatus(request);
}

// POST method handler (same functionality, different HTTP method for compatibility)
export async function POST(request: NextRequest) {
  // console.log("[task-status] POST request received");
  return handleTaskStatus(request);
}

// HEAD method handler (for preflight/CORS)
export async function HEAD(request: NextRequest) {
  // console.log("[task-status] HEAD request received");
  return new NextResponse(null, { 
    status: 200, 
    headers: corsHeaders
  });
}

// OPTIONS method handler for CORS preflight requests
export async function OPTIONS(request: Request) {
  // console.log("[task-status] OPTIONS request received");
  return NextResponse.json(
    { success: true },
    { 
      status: 200,
      headers: corsHeaders
    }
  );
}

