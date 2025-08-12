import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all model generations
    const { data, error, count } = await supabaseAdmin
      .from('model_generations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get storage file counts
    const storageStats = {}
    const buckets = ['uploads', 'enhanced', 'models']
    
    for (const bucket of buckets) {
      try {
        const { data: files } = await supabaseAdmin.storage
          .from(bucket)
          .list('', { limit: 1000 })
        
        storageStats[bucket] = files?.length || 0
      } catch (err) {
        storageStats[bucket] = 'error'
      }
    }

    return NextResponse.json({
      success: true,
      database: {
        totalRecords: count || 0,
        recentRecords: data || []
      },
      storage: storageStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database check error:', error)
    return NextResponse.json(
      { error: 'Failed to check database' },
      { status: 500 }
    )
  }
}