// src/utils/canvasAPI.ts

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000'

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

export interface CanvasObject {
  id: string
  type: string
  source?: string

    file?: {
    name: string
    url: string
    size?: number
    mimeType?: string
  }

  spritesheet?: {
    jsonUrl?: string
    imageUrl?: string
  }
  lottie?: {
    jsonUrl?: string
  }
  [key: string]: unknown
}

export interface SceneState {
  objects: CanvasObject[]
  cameraX: number
  cameraY: number
  cameraZoom: number
}

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
  file: File,
  objectType: string = 'misc'
): Promise<string> {
  const contentType =
    file.type || 'application/octet-stream'

  const uploadUrlResponse = await fetch(
    `${API_BASE_URL}/api/canvas/getUploadUrl?` +
      new URLSearchParams({
        fileName: file.name,
        fileType: contentType,
        objectType
      })
  )

  if (!uploadUrlResponse.ok) {
    throw new Error('Failed to get upload URL')
  }

  const { uploadUrl, key } =
    await uploadUrlResponse.json()

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': contentType
    }
  })

if (!uploadResponse.ok) {
  const text = await uploadResponse.text()
  throw new Error(
    `S3 upload failed (${uploadResponse.status}): ${text}`
  )
}

  return key
}


  /* ------------------ Scenes ------------------ */

  async createScene(sceneData: unknown) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...sceneData })
    })

    if (!res.ok) throw new Error('Failed to create scene')
    return res.json()
  }

  async updateScene(sceneId: string, sceneData: unknown) {
    const userId = this.requireUserId()

    const res = await fetch(`${API_BASE_URL}/api/canvas/${sceneId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...sceneData })
    })

    if (!res.ok) throw new Error('Failed to update scene')
    return res.json()
  }

  async deleteScene(sceneId: string) {
    const userId = this.requireUserId()

    const res = await fetch(
      `${API_BASE_URL}/api/canvas/${sceneId}?userId=${userId}`,
      { method: 'DELETE' }
    )

    if (!res.ok) throw new Error('Failed to delete scene')
    return res.json()
  }

  async duplicateScene(sceneId: string) {
    const userId = this.requireUserId()

    const res = await fetch(
      `${API_BASE_URL}/api/canvas/${sceneId}/duplicate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      }
    )

    if (!res.ok) throw new Error('Failed to duplicate scene')
    return res.json()
  }

  async updateThumbnail(sceneId: string, thumbnailKey: string) {
    const userId = this.requireUserId()

    const res = await fetch(
      `${API_BASE_URL}/api/canvas/${sceneId}/thumbnail`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, thumbnailKey })
      }
    )

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
      limit: String(options.limit ?? 20)
    })

    if (options.search) params.set('search', options.search)
    if (options.tags?.length) params.set('tags', options.tags.join(','))

    const res = await fetch(
      `${API_BASE_URL}/api/canvas/user/${userId}?${params}`
    )

    if (!res.ok) throw new Error('Failed to fetch user scenes')
    return res.json()
  }

  async getPublicScenes(options: SceneQueryOptions = {}) {
    const params = new URLSearchParams({
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 20)
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

const objects = await this.processObjectsForUpload(
  sceneState,
  safeProgress
)

const res = await fetch(`${API_BASE_URL}/api/canvas/upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    objects,
    cameraX: sceneState.cameraX,
    cameraY: sceneState.cameraY,
    cameraZoom: sceneState.cameraZoom
  })
})

if (!res.ok) {
  const text = await res.text()
  throw new Error(text || `Upload failed (${res.status})`)
}


  finished = true

// ✅ SAFE JSON parsing
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

  const res = await fetch(
    `${API_BASE_URL}/api/canvas/${sceneId}/meta`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...meta })
    }
  )

  if (!res.ok) throw new Error('Failed to update metadata')
}

async publishScene(sceneId: string, thumbnailKey: string) {
  const userId = this.requireUserId()

  const res = await fetch(
    `${API_BASE_URL}/api/canvas/${sceneId}/publish`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, thumbnailKey })
    }
  )

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
      const blob = await fetch(obj.source).then(r => r.blob())
      const file = new File([blob], `${obj.type}_${obj.id}`, {
        type: blob.type || 'application/octet-stream'
      })

      uploadTasks.push(async () => {
        processed.source = await this.uploadFile(file, obj.type)
      })
    }

    /* FILE */
    if (obj.type === 'file' && obj.file?.url?.startsWith('blob:')) {
      const blob = await fetch(obj.file.url).then(r => r.blob())
      const file = new File([blob], obj.file.name, {
        type: obj.file.mimeType || blob.type
      })

      uploadTasks.push(async () => {
        processed.file = {
          ...obj.file,
          url: await this.uploadFile(file, 'file')
        }
      })
    }

    /* SPRITESHEET */
    if (obj.spritesheet) {
      processed.spritesheet = { ...obj.spritesheet }

      if (obj.spritesheet.jsonUrl?.startsWith('blob:')) {
        const b = await fetch(obj.spritesheet.jsonUrl).then(r => r.blob())
        uploadTasks.push(async () => {
          processed.spritesheet!.jsonUrl = await this.uploadFile(
            new File([b], `${obj.id}.json`, { type: 'application/json' }),
            'spritesheet'
          )
        })
      }

      if (obj.spritesheet.imageUrl?.startsWith('blob:')) {
        const b = await fetch(obj.spritesheet.imageUrl).then(r => r.blob())
        uploadTasks.push(async () => {
          processed.spritesheet!.imageUrl = await this.uploadFile(
            new File([b], `${obj.id}.png`, { type: 'image/png' }),
            'spritesheet'
          )
        })
      }
    }

    /* LOTTIE */
    if (obj.lottie?.jsonUrl?.startsWith('blob:')) {
      const b = await fetch(obj.lottie.jsonUrl).then(r => r.blob())
      uploadTasks.push(async () => {
        processed.lottie = {
          jsonUrl: await this.uploadFile(
            new File([b], `${obj.id}.json`, { type: 'application/json' }),
            'lottie'
          )
        }
      })
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
        const blob = await fetch(obj.source).then(r => r.blob())
        const file = new File([blob], `${obj.type}_${obj.id}`, {
          type: blob.type || 'application/octet-stream'
        })

        uploadTasks.push(async () => {
          processed.source = await this.uploadFile(file, obj.type)
        })
      }

      /* FILE OBJECT */
      if (obj.type === 'file' && obj.file?.url?.startsWith('blob:')) {
        const blob = await fetch(obj.file.url).then(r => r.blob())
        const file = new File([blob], obj.file.name, {
          type: obj.file.mimeType || blob.type || 'application/octet-stream'
        })

        uploadTasks.push(async () => {
          const key = await this.uploadFile(file, 'file')
          processed.file = { ...obj.file, url: key }
        })
      }

      /* SPRITESHEET */
      if (obj.spritesheet) {
        processed.spritesheet = { ...obj.spritesheet }

        if (obj.spritesheet.jsonUrl?.startsWith('blob:')) {
          const b = await fetch(obj.spritesheet.jsonUrl).then(r => r.blob())
          uploadTasks.push(async () => {
            processed.spritesheet!.jsonUrl = await this.uploadFile(
              new File([b], `${obj.id}.json`, { type: 'application/json' }),
              'spritesheet'
            )
          })
        }

        if (obj.spritesheet.imageUrl?.startsWith('blob:')) {
          const b = await fetch(obj.spritesheet.imageUrl).then(r => r.blob())
          uploadTasks.push(async () => {
            processed.spritesheet!.imageUrl = await this.uploadFile(
              new File([b], `${obj.id}.png`, { type: 'image/png' }),
              'spritesheet'
            )
          })
        }
      }

      /* LOTTIE */
      if (obj.lottie?.jsonUrl?.startsWith('blob:')) {
        const b = await fetch(obj.lottie.jsonUrl).then(r => r.blob())
        uploadTasks.push(async () => {
          processed.lottie = {
            jsonUrl: await this.uploadFile(
              new File([b], `${obj.id}.json`, {
                type: 'application/json'
              }),
              'lottie'
            )
          }
        })
      }

      processedObjects.push(processed)
    }

    /* ---------- EXECUTE UPLOADS WITH PROGRESS ---------- */

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

    /* ---------- SAVE SCENE ---------- */

    onProgress?.(95, 'Saving scene')

    const payload = {
      title: options.title ?? 'Untitled Canvas',
      description: options.description ?? '',
      objects: processedObjects,
      cameraX: sceneState.cameraX,
      cameraY: sceneState.cameraY,
      cameraZoom: sceneState.cameraZoom,
      isPublic: options.isPublic ?? false,
      tags: options.tags ?? []
    }

    const result = options.sceneId
      ? await this.updateScene(options.sceneId, payload)
      : await this.createScene(payload)

    onProgress?.(100, 'Done')

    return result
  }
}

/* ------------------------------------------------------------------ */

const canvasAPI = new CanvasAPI()
export default canvasAPI
