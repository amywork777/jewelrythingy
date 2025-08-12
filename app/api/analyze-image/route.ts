import { NextResponse } from "next/server"
import OpenAI from "openai"

// Function to get OpenAI client only when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, 
  });
}

// Remove the domain detection function as we want consistent behavior everywhere
// function isDeploymentDomain(hostname: string) {
//   return hostname === 'magic.taiyaki.ai' || 
//          hostname.includes('vercel.app') || 
//          hostname.includes('taiyaki.ai');
// }

export async function POST(request: Request) {
  console.log("[SERVER] /api/analyze-image endpoint called");
  
  try {
    // Add CORS headers for all responses to ensure this works when embedded on fishcad.com
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    const url = new URL(request.url);
    console.log(`[SERVER] Request from hostname: ${url.hostname}`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ [SERVER] OPENAI_API_KEY not found in environment variables");
      return NextResponse.json(
        { 
          error: "OpenAI API key not configured",
          description: "Create a 3D model based on the uploaded image. Please add your OPENAI_API_KEY to the environment variables."
        },
        { 
          status: 200,
          headers: corsHeaders 
        }
      );
    }
    
    console.log("✅ [SERVER] OPENAI_API_KEY is available");
    
    let formData;
    try {
      formData = await request.formData();
      console.log("✅ [SERVER] FormData parsed successfully");
    } catch (error) {
      console.error("❌ [SERVER] Error parsing FormData:", error);
      return NextResponse.json(
        { 
          error: "Failed to parse form data",
          description: "Error processing the uploaded image. Please try again."
        },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const imageFile = formData.get("image") as File;
    const textPrompt = formData.get("prompt") as string;
    
    if (!imageFile) {
      console.error("❌ [SERVER] No image file in request");
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`✅ [SERVER] Received image: ${imageFile.name}, size: ${Math.round(imageFile.size/1024)}KB, type: ${imageFile.type}`);
    console.log(`✅ [SERVER] Text prompt: "${textPrompt || "[No additional prompt]"}"`);
    
    // Convert the file to base64
    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString("base64");
      const dataUri = `data:${imageFile.type};base64,${base64Image}`;
      
      console.log(`✅ [SERVER] Image converted to base64 (${Math.round(base64Image.length/1024)}KB)`);
      
      // Construct prompt for Vision API - optimized for accurate 3D modeling
      const userPrompt = textPrompt 
        ? `Analyze this image in detail and create a comprehensive description for generating an exact 3D model replica. Include specific details about shape, proportions, materials, textures, colors, and any unique features. ${textPrompt}` 
        : "Analyze this image in detail and create a comprehensive description for generating an exact 3D model replica. Describe the object's exact shape, proportions, surface details, materials, textures, colors, and any distinctive features. Be as specific and detailed as possible to ensure the 3D model matches the image precisely.";
      
      console.log("[SERVER] Calling OpenAI Vision API...");
      
      // Call OpenAI Vision API with instructions for a concise description
      try {
        const openai = getOpenAIClient();
        if (!openai) {
          throw new Error("OpenAI client not available");
        }
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert 3D modeling specialist who creates highly detailed, accurate descriptions for generating precise 3D models. Your goal is to capture every important visual detail that would make the 3D model look exactly like the image. Include specific information about: shape and geometry, proportions and scale, surface textures and materials, colors and patterns, fine details and features, structural elements, and any distinctive characteristics. Be descriptive and thorough - the 3D model should be as close to the original image as possible. Use clear, technical language that a 3D modeling AI can understand and implement accurately."
            },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUri,
                  },
                },
              ],
            },
          ],
          max_tokens: 800,
        });
        
        // Extract the generated description
        const description = response.choices[0]?.message?.content || "";
        
        console.log("✅ [SERVER] OpenAI API response received");
        console.log(`✅ [SERVER] Generated description: "${description}"`);
        
        return NextResponse.json({ description }, { headers: corsHeaders });
      } catch (openaiError) {
        console.error("❌ [SERVER] OpenAI API error:", openaiError);
        return NextResponse.json(
          { 
            error: "OpenAI API error",
            message: openaiError instanceof Error ? openaiError.message : "Unknown OpenAI error",
            description: "Create a 3D model based on the uploaded image. The AI analysis service encountered an error."
          },
          { status: 200, headers: corsHeaders }
        );
      }
    } catch (processingError) {
      console.error("❌ [SERVER] Error processing image:", processingError);
      return NextResponse.json(
        { 
          error: "Image processing error",
          message: processingError instanceof Error ? processingError.message : "Failed to process image",
          description: "Create a 3D model based on the uploaded image."
        },
        { status: 200, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error("❌ [SERVER] Unexpected error in analyze-image route:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to analyze image",
        description: "Create a 3D model based on the uploaded image." 
      },
      { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// Keep the OPTIONS method handler for CORS preflight requests
export async function OPTIONS(request: Request) {
  console.log("[SERVER] /api/analyze-image OPTIONS request received");
  return NextResponse.json(
    { success: true },
    { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    }
  );
} 