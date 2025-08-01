import { type NextRequest, NextResponse } from "next/server"

// Function to clean up and shorten the OpenAI-generated description
const cleanDescription = (description: string): string => {
  // Remove markdown formatting
  let cleanedText = description
    .replace(/#+\s/g, '') // Remove heading markers
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/\n+/g, ' ') // Replace multiple newlines with a single space
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim();
  
  // Limit to 500 characters to ensure it works with Tripo API
  if (cleanedText.length > 500) {
    cleanedText = cleanedText.substring(0, 497) + '...';
  }
  
  return cleanedText;
};

export async function POST(request: NextRequest) {
  try {
    console.log("[generate-model] Received model generation request");
    
    const { type, prompt, imageToken } = await request.json();
    
    console.log(`[generate-model] Request type: ${type}, imageToken: ${imageToken ? "provided" : "not provided"}`);
    console.log(`[generate-model] Prompt: "${prompt}"`);
    
    // Clean and process the prompt
    const cleanPrompt = (text: string): string => {
      if (!text) return "";
      return text.replace(/undefined/g, "").trim();
    };
    
    const processedPrompt = cleanPrompt(prompt);
    console.log(`[generate-model] Original prompt length: ${prompt?.length || 0}`);
    console.log(`[generate-model] Processed prompt length: ${processedPrompt?.length || 0}`);
    console.log(`[generate-model] Processed prompt: "${processedPrompt}"`);
    
    if (processedPrompt !== prompt) {
      console.log(`[generate-model] Prompt was processed/cleaned`);
    }
    
    let requestBody

    // Prioritize text-to-model generation when possible
    // Only use image-to-model if explicitly requested AND no valid text prompt is available
    if (type === "text" || (processedPrompt && processedPrompt.length > 10)) {
      // Text to model - without textures
      requestBody = {
        type: "text_to_model",
        prompt: processedPrompt,
        model_version: "v2.5-20250123",
        texture: false, // Disable textures
        pbr: false, // Disable PBR
        auto_size: true, // Enable auto-sizing for better proportions
      }
      console.log(`[generate-model] Using text-to-model generation strategy with prompt: "${processedPrompt}"`);
    } else if (type === "image" && imageToken) {
      // Image to model - without textures - only if explicitly requested and no good text prompt
      requestBody = {
        type: "image_to_model",
        model_version: "v2.5-20250123",
        file: {
          type: "jpg",
          file_token: imageToken,
        },
        texture: false, // Disable textures
        pbr: false, // Disable PBR
        auto_size: true, // Enable auto-sizing for better proportions
      }
      console.log(`[generate-model] Using image-to-model generation strategy with token: ${imageToken}`);
    } else {
      console.error(`❌ [generate-model] Invalid generation type or missing required parameters: type=${type}, promptLength=${processedPrompt?.length || 0}, imageToken=${imageToken ? "exists" : "missing"}`);
      return NextResponse.json({ error: "Invalid generation type or missing required parameters" }, { status: 400 })
    }

    console.log(`[generate-model] Sending request to Tripo API:`, requestBody);

    // Call Tripo API to start model generation
    const tripoResponse = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TRIPO_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    console.log(`[generate-model] Tripo API response status: ${tripoResponse.status} ${tripoResponse.statusText}`);

    if (!tripoResponse.ok) {
      const errorData = await tripoResponse.json()
      console.error(`❌ [generate-model] Tripo API error:`, errorData)
      return NextResponse.json({ error: "Failed to start model generation" }, { status: tripoResponse.status })
    }

    const data = await tripoResponse.json()
    console.log(`✅ [generate-model] Tripo API success response:`, data);
    
    let responseData;
    
    if (data.data?.task_id) {
      responseData = { taskId: data.data.task_id };
      console.log(`✅ [generate-model] Task created with ID: ${data.data.task_id}`);
    } else {
      console.error(`❌ [generate-model] No task ID in response:`, data);
      return NextResponse.json({ error: "No task ID returned from Tripo API" }, { status: 500 })
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error(`❌ [generate-model] Error generating model:`, error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

