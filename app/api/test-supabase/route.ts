import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Test environment variables
    const envCheck = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      actualUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }

    // Test database connection
    let dbTest = null
    try {
      const { data, error, count } = await supabaseAdmin
        .from('model_generations')
        .select('*', { count: 'exact' })
        .limit(1)
      
      dbTest = {
        success: !error,
        error: error?.message || null,
        hasTable: true,
        recordCount: count || 0,
        sampleData: data || []
      }
    } catch (err) {
      dbTest = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        hasTable: false,
        recordCount: 0
      }
    }

    // Test storage connection
    let storageTest = null
    try {
      const { data, error } = await supabaseAdmin.storage.listBuckets()
      
      storageTest = {
        success: !error,
        error: error?.message || null,
        buckets: data?.map(b => b.name) || []
      }
    } catch (err) {
      storageTest = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        buckets: []
      }
    }

    return NextResponse.json({
      environment: envCheck,
      database: dbTest,
      storage: storageTest,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Supabase test error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}