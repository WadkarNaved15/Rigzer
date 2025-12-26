// src/utils/canvasAPI.ts

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000'

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

export interface SceneQueryOptions {
  page?: number
  limit?: number
  search?: string
  tags?: string[]
}

export interface SaveCanvasOptions {
  title?: string
  description?: string
  isPublic?: boolean
  tags?: string[]
  sceneId?: string
}

import type { CanvasObject, SceneState } from '../types/canvas'

/* ------------------------------------------------------------------ */
/* Canvas API */
/* ------------------------------------------------------------------ */

class CanvasAPI {
  private userId: string | null = null

  /* ------------------ Auth ------------------ */

  setUserId(userId: string) {
    this.userId = userId
  }

  private requireUserId() {
    if (!this.userId) {
      throw new Error('CanvasAPI: userId not set')
    }
    return this.userId
  }

  /* ------------------ Upload ------------------ */

async uploadFile(
  data: Blob,
  objectType: string = 'misc',
  fileName = 'upload.bin'
): Promise<string> {
  const contentType = data.type || 'application/octet-stream'

  const uploadUrlResponse = await fetch(
    `${API_BASE_URL}/api/canvas/getUploadUrl?` +
      new URLSearchParams({
        fileName,
        fileType: contentType,
        objectType,
      })
  )

  if (!uploadUrlResponse.ok) {
    throw new Error('Failed to get upload URL')
  }

  const { uploadUrl, key } = await uploadUrlResponse.json()

  await fetch(uploadUrl, {
    method: 'PUT',
    body: data,
    headers: {
      'Content-Type': contentType,
    },
  })

  return key
}


  /* ------------------ Scenes ------------------ */

  // CHANGED: typed sceneData as Record<string, any> to allow spreading
  async createScene(sceneData: Record<string, any>) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...sceneData }),
    })

    if (!res.ok) throw new Error('Failed to create scene')
    return res.json()
  }

  // CHANGED: typed sceneData as Record<string, any>
  async updateScene(sceneId: string, sceneData: Record<string, any>) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...sceneData }),
    })

    if (!res.ok) throw new Error('Failed to update scene')
    return res.json()
  }

  async deleteScene(sceneId: string) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}?userId=${userId}`, {
      method: 'DELETE',
    })

    if (!res.ok) throw new Error('Failed to delete scene')
    return res.json()
  }

  async duplicateScene(sceneId: string) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    if (!res.ok) throw new Error('Failed to duplicate scene')
    return res.json()
  }

  async updateThumbnail(sceneId: string, thumbnailKey: string) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}/thumbnail`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, thumbnailKey }),
    })

    if (!res.ok) throw new Error('Failed to update thumbnail')
    return res.json()
  }

  async getScene(sceneId: string) {
    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}`)
    if (!res.ok) throw new Error('Failed to fetch scene')
    return res.json()
  }

  async getUserScenes(options: SceneQueryOptions = {}) {
    const userId = this.requireUserId()

    const params = new URLSearchParams({
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 20),
    })

    if (options.search) params.set('search', options.search)
    if (options.tags?.length) params.set('tags', options.tags.join(','))

    const res = await fetch(`${API_BASE_URL}/api/canvas/user/${userId}?${params}`)

    if (!res.ok) throw new Error('Failed to fetch user scenes')
    return res.json()
  }

  async getPublicScenes(options: SceneQueryOptions = {}) {
    const params = new URLSearchParams({
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 20),
    })

    if (options.search) params.set('search', options.search)
    if (options.tags?.length) params.set('tags', options.tags.join(','))

    const res = await fetch(`${API_BASE_URL}/api/canvas/public?${params}`)
    if (!res.ok) throw new Error('Failed to fetch public scenes')
    return res.json()
  }

  /* ------------------ New Flow ------------------ */

  async uploadCanvasOnly(
    sceneState: SceneState,
    onProgress?: (percent: number, stage?: string) => void
  ) {
    const userId = this.requireUserId()
    let finished = false

    const safeProgress = (p: number, stage?: string) => {
      if (finished) return
      onProgress?.(p, stage)
    }

    const objects = await this.processObjectsForUpload(sceneState, safeProgress)

    const res = await fetch(`${API_BASE_URL}/api/canvas/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        objects,
        cameraX: sceneState.cameraX,
        cameraY: sceneState.cameraY,
        cameraZoom: sceneState.cameraZoom,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Upload failed (${res.status})`)
    }

    finished = true
    const data = await res.json()
    console.log('Scene Id:', data.sceneId)
    return data
  }

  async updateSceneMeta(
    sceneId: string,
    meta: {
      title: string
      description: string
      tags: string[]
      isPublic: boolean
    }
  ) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...meta }),
    })

    if (!res.ok) throw new Error('Failed to update metadata')
  }

  async publishScene(sceneId: string, thumbnailKey: string) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, thumbnailKey }),
    })

    if (!res.ok) throw new Error('Failed to publish scene')

    return res.json()
  }

 private async processObjectsForUpload(
  sceneState: SceneState,
  onProgress?: (percent: number, stage?: string) => void
): Promise<CanvasObject[]> {
  const processedObjects: CanvasObject[] = []
  const uploadTasks: (() => Promise<void>)[] = []

  for (const obj of sceneState.objects) {
    const processed: CanvasObject = { ...obj }

    /* IMAGE / VIDEO */
    if (obj.source?.startsWith('blob:')) {
      const blob = await fetch(obj.source).then((r) => r.blob())
      // Pass blob directly, and use the name as the 3rd argument
      uploadTasks.push(async () => {
        processed.source = await this.uploadFile(blob, obj.type, `${obj.type}_${obj.id}`)
      })
    }

    /* FILE */
    if (obj.type === 'file' && obj.file?.url?.startsWith('blob:')) {
      const blob = await fetch(obj.file.url).then((r) => r.blob())
      const fileName = obj.file.name;

      uploadTasks.push(async () => {
        processed.file = {
          ...obj.file!,
          name: fileName,
          url: await this.uploadFile(blob, 'file', fileName),
        }
      })
    }

    /* SPRITESHEET */
    if (obj.spritesheet) {
      processed.spritesheet = { ...obj.spritesheet }

      if (obj.spritesheet.jsonUrl?.startsWith('blob:')) {
        const b = await fetch(obj.spritesheet.jsonUrl).then((r) => r.blob())
        uploadTasks.push(async () => {
          processed.spritesheet!.jsonUrl = await this.uploadFile(
            b, 
            'spritesheet', 
            `${obj.id}.json`
          )
        })
      }

      if (obj.spritesheet.imageUrl?.startsWith('blob:')) {
        const b = await fetch(obj.spritesheet.imageUrl).then((r) => r.blob())
        uploadTasks.push(async () => {
          processed.spritesheet!.imageUrl = await this.uploadFile(
            b, 
            'spritesheet', 
            `${obj.id}.png`
          )
        })
      }
    }

    processedObjects.push(processed)
  }

  const total = uploadTasks.length
  let completed = 0

  for (const task of uploadTasks) {
    await task()
    completed++
    onProgress?.(
      Math.round((completed / Math.max(total, 1)) * 90),
      'Uploading assets'
    )
  }

  return processedObjects
}
  /* ------------------ Save Canvas ------------------ */

  async saveCanvas(
    sceneState: SceneState,
    options: SaveCanvasOptions = {},
    onProgress?: (percent: number, stage?: string) => void
  ) {
    const processedObjects: CanvasObject[] = []
    const uploadTasks: (() => Promise<void>)[] = []

    /* ---------- PREPARE UPLOAD TASKS ---------- */

    for (const obj of sceneState.objects) {
      const processed: CanvasObject = { ...obj }

      /* IMAGE / VIDEO */
      if (obj.source?.startsWith('blob:')) {
        const blob = await fetch(obj.source).then((r) => r.blob())
        const file = new File([blob], `${obj.type}_${obj.id}`, {
          type: blob.type || 'application/octet-stream',
        })

        uploadTasks.push(async () => {
          processed.source = await this.uploadFile(file, obj.type)
        })
      }

      /* FILE OBJECT */
      if (obj.type === 'file' && obj.file?.url?.startsWith('blob:')) {
        const blob = await fetch(obj.file.url).then((r) => r.blob())
        const file = new File([blob], obj.file.name, {
          type: obj.file.mimeType || blob.type || 'application/octet-stream',
        })

        uploadTasks.push(async () => {
          const key = await this.uploadFile(file, 'file')
          // FIXED: Ensured name is passed correctly
          processed.file = { 
            ...obj.file!, 
            name: obj.file!.name,
            url: key 
          }
        })
      }

      /* SPRITESHEET */
      if (obj.spritesheet) {
        processed.spritesheet = { ...obj.spritesheet }

        if (obj.spritesheet.jsonUrl?.startsWith('blob:')) {
          const b = await fetch(obj.spritesheet.jsonUrl).then((r) => r.blob())
          uploadTasks.push(async () => {
            processed.spritesheet!.jsonUrl = await this.uploadFile(
              new File([b], `${obj.id}.json`, { type: 'application/json' }),
              'spritesheet'
            )
          })
        }

        if (obj.spritesheet.imageUrl?.startsWith('blob:')) {
          const b = await fetch(obj.spritesheet.imageUrl).then((r) => r.blob())
          uploadTasks.push(async () => {
            processed.spritesheet!.imageUrl = await this.uploadFile(
              new File([b], `${obj.id}.png`, { type: 'image/png' }),
              'spritesheet'
            )
          })
        }
      }

      processedObjects.push(processed)
    }

    const total = uploadTasks.length
    let completed = 0

    for (const task of uploadTasks) {
      await task()
      completed++
      onProgress?.(Math.round((completed / Math.max(total, 1)) * 90), 'Uploading assets')
    }

    onProgress?.(95, 'Saving scene')

    const payload = {
      title: options.title ?? 'Untitled Canvas',
      description: options.description ?? '',
      objects: processedObjects,
      cameraX: sceneState.cameraX,
      cameraY: sceneState.cameraY,
      cameraZoom: sceneState.cameraZoom,
      isPublic: options.isPublic ?? false,
      tags: options.tags ?? [],
    }

    const result = options.sceneId
      ? await this.updateScene(options.sceneId, payload)
      : await this.createScene(payload)

    onProgress?.(100, 'Done')

    return result
  }
}

const canvasAPI = new CanvasAPI()
export default canvasAPI