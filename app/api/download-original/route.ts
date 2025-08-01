import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "Model URL is required" }, { status: 400 })
    }

    // Fetch the model file
    const modelResponse = await fetch(url)

    if (!modelResponse.ok) {
      return NextResponse.json({ error: "Failed to download model from source" }, { status: modelResponse.status })
    }

    // Get the model data as a buffer
    const modelData = await modelResponse.arrayBuffer()

    // Return the model file
    return new NextResponse(modelData, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=original_model.glb`,
      },
    })
  } catch (error) {
    console.error("Error downloading model:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

