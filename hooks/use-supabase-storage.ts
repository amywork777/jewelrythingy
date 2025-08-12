import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

export function useSupabaseStorage() {
  const [sessionId, setSessionId] = useState<string>('')

  // Generate or retrieve session ID
  useEffect(() => {
    const existingSessionId = localStorage.getItem('magicai-session-id')
    if (existingSessionId) {
      setSessionId(existingSessionId)
    } else {
      const newSessionId = uuidv4()
      localStorage.setItem('magicai-session-id', newSessionId)
      setSessionId(newSessionId)
    }
  }, [])

  // Upload file to Supabase Storage
  const uploadFile = async (file: File, bucket: string) => {
    if (!sessionId) throw new Error('Session not initialized')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    formData.append('sessionId', sessionId)

    const response = await fetch('/api/supabase-upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    return await response.json()
  }

  // Create model generation record
  const createModelGeneration = async (data: {
    prompt?: string
    generation_type: 'text' | 'image' | 'image-text'
    task_id?: string
    original_image_path?: string
    original_image_url?: string
    file_sizes?: any
  }) => {
    if (!sessionId) throw new Error('Session not initialized')

    const response = await fetch('/api/model-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        ...data
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create generation record')
    }

    return await response.json()
  }

  // Update model generation record
  const updateModelGeneration = async (id: string, updates: any) => {
    const response = await fetch('/api/model-generation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        ...updates
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update generation record')
    }

    return await response.json()
  }

  // Get model generations for current session
  const getModelGenerations = async () => {
    if (!sessionId) return []

    const response = await fetch(`/api/model-generation?sessionId=${sessionId}`)
    
    if (!response.ok) {
      console.error('Failed to fetch generations')
      return []
    }

    const data = await response.json()
    return data.generations || []
  }

  // Upload STL file
  const uploadSTL = async (blob: Blob, filename: string = 'model.stl') => {
    if (!sessionId) throw new Error('Session not initialized')

    const file = new File([blob], filename, { type: 'application/octet-stream' })
    return await uploadFile(file, 'models')
  }

  return {
    sessionId,
    uploadFile,
    uploadSTL,
    createModelGeneration,
    updateModelGeneration,
    getModelGenerations
  }
}