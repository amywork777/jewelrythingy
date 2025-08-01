import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create form data for Tripo API
    const tripoFormData = new FormData()
    const blob = new Blob([buffer], { type: file.type })
    tripoFormData.append("file", blob, file.name)

    // Upload to Tripo API
    const tripoResponse = await fetch("https://api.tripo3d.ai/v2/openapi/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TRIPO_API_KEY}`,
      },
      body: tripoFormData,
    })

    if (!tripoResponse.ok) {
      const errorData = await tripoResponse.json()
      console.error("Tripo API error:", errorData)
      return NextResponse.json({ error: "Failed to upload image to Tripo API" }, { status: tripoResponse.status })
    }

    const data = await tripoResponse.json()

    return NextResponse.json({
      imageToken: data.data.image_token,
    })
  } catch (error) {
    console.error("Error uploading image:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

