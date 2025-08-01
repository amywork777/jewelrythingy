import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Function to get OpenAI client only when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      throw new Error("OpenAI client not available - API key missing");
    }

    const body = await request.json()
    const { imageData, material = 'silver', enhancementType = 'jewelry' } = body

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    // Enhanced prompt based on Taiyaki's jewelry generation system
    const materialMap = {
      'silver': 'ultra-shiny, mirror-polished sterling silver with brilliant reflections',
      'gold': 'lustrous 14K gold with warm, rich reflections and premium finish'
    };

    const selectedMaterial = materialMap[material as keyof typeof materialMap] || materialMap.silver;

    const enhancementPrompt = `Create a beautiful, detailed custom charm that captures the unique character and essence of the subject in the reference photo.

🎯 **APPROACH: Detailed Character Capture with Manufacturing Focus**
Transform any photo into a charming, detailed yet manufacturable representation that truly captures the unique character and essence of the subject. Never reject - always find a way to create something beautiful and castable.

**TRANSPARENT BACKGROUND REQUIREMENT - CRITICAL:**
- Create the charm with a COMPLETELY TRANSPARENT BACKGROUND
- NO background elements, colors, or textures
- The charm should appear to float with nothing behind it
- Only the charm itself should be visible
- Perfect transparency around all edges
- Clean cutout with transparent background for jewelry use

**3D CHARM REQUIREMENTS - MUST BE FULLY 3D:**
- Create a FULLY 3D sculptural charm with significant depth and dimension
- NOT 2.5D or relief - must be a complete 3D sculpture
- Show clear depth, volume, and dimensional form from all angles
- Make it look like a miniature 3D sculpture, not a flat medallion
- Ensure it's manufacturable as true 3D jewelry

**CHARACTER CAPTURE PHILOSOPHY:**
- Capture the subject's unique characteristics and individual traits
- Include distinctive features that make this specific subject recognizable
- Show their expression, mood, pose, and what makes them special
- Be detailed enough to capture their essence while staying manufacturable
- Focus on defining characteristics (facial features, posture, distinctive elements, etc.)
- Works with any subject: people, animals, objects, vehicles, etc.

**IMPORTANT: DO NOT PUT WHISKERS OR FINE HAIR DETAILS**
- Never add whiskers to any pet charm (cats, dogs, or any animals)
- Do not include facial hair, fur texture, or fine hair details
- Do not add thin protruding elements like whiskers or antenna
- Focus on major features like face shape, eyes, ears, nose, body form instead
- Keep all details thick enough to be manufacturable in metal
- Avoid any thin, delicate elements that would break in jewelry

**SINGLE COLOR REQUIREMENT - CRITICAL:**
- Use ONLY light gold color (#FFE55C) throughout the ENTIRE charm
- NO other colors, materials, or finishes ANYWHERE
- NO silver, bronze, copper, or any other metals
- NO colored gems, stones, or accents
- NO multi-colored elements or details
- Uniform light gold color across ALL surfaces and details
- No color variations, gradients, or mixed materials
- EVERY part of the charm must be the same light gold color
- If you see any other colors in your design, change them to light gold
- This is a SINGLE COLOR charm - only light gold (#FFE55C)
- Make the gold surface SHINY, POLISHED, and REFLECTIVE like premium jewelry
- Show highlights and reflections on the gold surface for a luxurious appearance
- The charm should look like polished, mirror-finish gold jewelry

**MANUFACTURABILITY GUIDELINES:**
- Convert complex patterns into simple raised or recessed areas when needed
- Simplify intricate details into basic geometric forms while preserving character
- Use dimensional changes to suggest features and characteristics
- Keep designs clean and castable but detailed enough to show character
- Ensure all details can be cast in metal

**COMPLETENESS:**
- Show the complete 3D charm design
- Nothing should be cut off or cropped
- Full composition within the charm boundaries
- Display the charm as a complete 3D object

**CHARM SPECIFICATIONS:**
- Material: Beautiful light gold metal only
- Color: Light gold (#FFE55C) throughout - NO OTHER COLORS
- Finish: SHINY, POLISHED, MIRROR-LIKE gold surface with reflections and highlights
- Style: Detailed 3D custom jewelry charm that captures character
- Hardware: Simple hanging loop at top
- Background: Clean white background
- Size: Perfect for jewelry wear
- Appearance: Premium polished gold jewelry with luxurious shine

**CREATIVE APPROACH:**
- Capture the subject's unique characteristics and individual traits
- Include their most distinctive features in detailed but manufacturable way
- Make it recognizable as this specific subject
- Focus on what makes them special and unique
- Create something beautiful, detailed, and wearable
- Always find a solution - never give up on a photo
- Show their character through pose, expression, and distinctive features
- Adapt approach based on subject type (person, animal, object, etc.)

🎯 **GOAL**: Create a detailed, fully 3D charm that captures this specific subject's unique character and essence while being manufacturable. Always succeed - transform any photo into beautiful, characterful jewelry.

**IMPORTANT**: Never reject a photo. Always simplify complex features into manufacturable forms while preserving character. Focus on creating beautiful, detailed, fully 3D, single-color gold jewelry that celebrates the subject's unique essence.`;

    console.log('Enhancing image with gpt-image-1 via Image API...');

    // Convert base64 data URL to buffer for gpt-image-1
    console.log('Original imageData length:', imageData.length);
    console.log('imageData starts with:', imageData.substring(0, 50));
    
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    console.log('Extracted base64 length:', base64Data.length);
    
    const imageBuffer = Buffer.from(base64Data, 'base64');
    console.log('Buffer size:', imageBuffer.length, 'bytes');

    // Create proper File object for gpt-image-1
    const imageFile = new File([imageBuffer], 'input-image.png', { 
      type: 'image/png',
      lastModified: Date.now()
    });
    
    console.log('File object created:', imageFile.name, imageFile.type, imageFile.size);

    // Use gpt-image-1 with images.edit endpoint with type assertion for newer parameters
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: enhancementPrompt,
      size: "1024x1024",
      n: 1,
      quality: "high",             // High quality for best transparency results
      background: "transparent"    // Enable transparent background
    } as any);

    console.log('gpt-image-1 Response keys:', Object.keys(response));
    console.log('Response data length:', response.data?.length);
    console.log('First response item keys:', response.data[0] ? Object.keys(response.data[0]) : 'no data');

    const enhancedImageUrl = response.data[0]?.url;
    const enhancedImageB64 = response.data[0]?.b64_json;
    const revisedPrompt = response.data[0]?.revised_prompt;
    
    console.log('Enhanced image URL type:', typeof enhancedImageUrl);
    console.log('Enhanced image URL length:', enhancedImageUrl?.length);
    console.log('Enhanced image b64 type:', typeof enhancedImageB64);
    console.log('Enhanced image b64 length:', enhancedImageB64?.length);
    
    let finalImageUrl: string;
    
    if (enhancedImageUrl) {
      console.log('Using URL response:', enhancedImageUrl.substring(0, 100));
      finalImageUrl = enhancedImageUrl;
    } else if (enhancedImageB64) {
      console.log('Converting base64 to data URL, length:', enhancedImageB64.length);
      finalImageUrl = `data:image/png;base64,${enhancedImageB64}`;
    } else {
      console.error('No image data in response:', response.data);
      throw new Error(`gpt-image-1 failed to generate enhanced image. Response: ${JSON.stringify(response.data)}`);
    }

    return NextResponse.json({
      success: true,
      originalImageData: "base64 data processed with gpt-image-1",
      enhancedImageUrl: finalImageUrl,
      revisedPrompt: revisedPrompt || enhancementPrompt,
      prompt: enhancementPrompt,
      material: material,
      model: "gpt-image-1",
      size: "1024x1024",
      responseType: enhancedImageUrl ? "url" : "base64",
      background: "transparent",
      quality: "high",
      format: "png",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error with gpt-image-1:', error)
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('billing')) {
        return NextResponse.json(
          { error: 'OpenAI billing issue. Please check your OpenAI account.' },
          { status: 402 }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        )
      }
      if (error.message.includes('content_policy')) {
        return NextResponse.json(
          { error: 'Image content not suitable for enhancement. Please try a different image.' },
          { status: 400 }
        )
      }
      if (error.message.includes('organization verification')) {
        return NextResponse.json(
          { error: 'Organization verification required for gpt-image-1. Please complete verification in your OpenAI console.' },
          { status: 403 }
        )
      }
      if (error.message.includes('unknown_parameter') || error.message.includes('invalid_request')) {
        return NextResponse.json(
          { error: 'gpt-image-1 model may not be available for your account. Please check your OpenAI organization verification.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to enhance image with gpt-image-1. Please try again.' },
      { status: 500 }
    )
  }
} 