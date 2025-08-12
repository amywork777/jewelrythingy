import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check if it's an accepted image type
    const acceptedTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      'image/x-icon',
      'image/heic',
      'image/avif',
      'image/jxl'
    ]

    const isAccepted = acceptedTypes.includes(file.type)

    return NextResponse.json({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      isAccepted,
      supportedTypes: acceptedTypes,
      message: isAccepted ? 'File type is supported!' : 'File type is not supported'
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}