import { type NextRequest, NextResponse } from "next/server"

// Cache to store prefetched models
const modelCache = new Map<string, ArrayBuffer>()

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")
    const format = request.nextUrl.searchParams.get("format") || "glb"

    if (!url) {
      return NextResponse.json({ error: "Model URL is required" }, { status: 400 })
    }

    let modelData: ArrayBuffer

    // Check if the model is in the cache
    if (modelCache.has(url)) {
      console.log("Using cached model data")
      modelData = modelCache.get(url)!
    } else {
      // Fetch the model file
      console.log("Fetching model data from source")
      const modelResponse = await fetch(url)

      if (!modelResponse.ok) {
        return NextResponse.json({ error: "Failed to download model from source" }, { status: modelResponse.status })
      }

      // Get the model data as a buffer
      modelData = await modelResponse.arrayBuffer()

      // Store in cache for future use
      modelCache.set(url, modelData)
    }

    // Return the model file
    return new NextResponse(modelData, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=model.${format}`,
      },
    })
  } catch (error) {
    console.error("Error downloading model:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

