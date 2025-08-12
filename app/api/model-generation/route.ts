import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, ModelGeneration } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id,
      prompt,
      generation_type,
      task_id,
      original_image_path,
      original_image_url,
      file_sizes
    } = body

    // Insert new model generation record
    const { data, error } = await supabaseAdmin
      .from('model_generations')
      .insert({
        session_id,
        prompt,
        generation_type,
        task_id,
        original_image_path,
        original_image_url,
        file_sizes,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Database insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create model generation record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, generation: data })

  } catch (error) {
    console.error('Model generation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      status,
      enhanced_image_path,
      enhanced_image_url,
      enhancement_prompt,
      stl_file_path,
      stl_file_url,
      model_url,
      file_sizes,
      error_message
    } = body

    const updateData: Partial<ModelGeneration> = { status }
    
    if (enhanced_image_path) updateData.enhanced_image_path = enhanced_image_path
    if (enhanced_image_url) updateData.enhanced_image_url = enhanced_image_url
    if (enhancement_prompt) updateData.enhancement_prompt = enhancement_prompt
    if (stl_file_path) updateData.stl_file_path = stl_file_path
    if (stl_file_url) updateData.stl_file_url = stl_file_url
    if (model_url) updateData.model_url = model_url
    if (file_sizes) updateData.file_sizes = file_sizes
    if (error_message) updateData.error_message = error_message
    if (status === 'completed') updateData.completed_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('model_generations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database update error:', error)
      return NextResponse.json(
        { error: 'Failed to update model generation record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, generation: data })

  } catch (error) {
    console.error('Model generation update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const generationId = searchParams.get('id')

    if (generationId) {
      // Get specific generation
      const { data, error } = await supabaseAdmin
        .from('model_generations')
        .select('*')
        .eq('id', generationId)
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Generation not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ generation: data })
    } else if (sessionId) {
      // Get all generations for a session
      const { data, error } = await supabaseAdmin
        .from('model_generations')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database query error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch generations' },
          { status: 500 }
        )
      }

      return NextResponse.json({ generations: data })
    } else {
      return NextResponse.json(
        { error: 'Missing sessionId or id parameter' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Model generation GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}