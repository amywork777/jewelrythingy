import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Database types
export interface ModelGeneration {
  id: string
  session_id: string
  original_image_path?: string
  original_image_url?: string
  enhanced_image_path?: string
  enhanced_image_url?: string
  enhancement_prompt?: string
  stl_file_path?: string
  stl_file_url?: string
  model_url?: string
  prompt?: string
  generation_type: 'text' | 'image' | 'image-text'
  task_id?: string
  status: 'pending' | 'uploading' | 'generating' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
  file_sizes?: {
    original?: number
    enhanced?: number
    stl?: number
  }
  error_message?: string
}