import { type NextRequest, NextResponse } from "next/server"

// Cache to store prefetched models
const modelCache = new Map<string, ArrayBuffer>()

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "Model URL is required" }, { status: 400 })
    }

    // Check if the model is already in the cache
    if (modelCache.has(url)) {
      return NextResponse.json({ success: true, cached: true })
    }

    // Fetch the model file
    const modelResponse = await fetch(url)

    if (!modelResponse.ok) {
      return NextResponse.json({ error: "Failed to download model from source" }, { status: modelResponse.status })
    }

    // Get the model data as a buffer and store in cache
    const modelData = await modelResponse.arrayBuffer()
    modelCache.set(url, modelData)

    return NextResponse.json({ success: true, cached: false })
  } catch (error) {
    console.error("Error prefetching model:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

