import React, { useState, useRef, ChangeEvent } from 'react'
import { X, Upload, DollarSign, FileArchive } from 'lucide-react'

interface PostModalProps {
  onCancel: () => void
}

interface GameAsset {
  id: string
  file: File
  uploadedUrl?: string
  name: string
  size: number
  progress?: number
  status?: 'pending' | 'uploading' | 'done' | 'error'
}

const GamePostForm: React.FC<PostModalProps> = ({ onCancel }) => {
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [asset, setAsset] = useState<GameAsset | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingMetadata, setIsSavingMetadata] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

  /* ---------------- File Select ---------------- */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAsset({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending'
    })

    e.target.value = ''
  }

  /* ---------------- Upload ---------------- */
const uploadGameToS3 = (
  asset: GameAsset,
  onProgress: (p: number) => void
): Promise<string> => {
  return fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: asset.file.name,
      fileType: asset.file.type
    })
  })
    .then(res => {
      if (!res.ok) throw new Error('Presign failed')
      return res.json()
    })
    .then(({ uploadUrl, fileUrl }) => {
      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', asset.file.type)

        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () =>
          xhr.status === 200
            ? resolve(fileUrl)
            : reject(new Error('Upload failed'))

        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(asset.file)
      })
    })
}


  /* ---------------- Submit ---------------- */
  const handlePostSubmit = async () => {
    if (!asset || isSubmitting) return
    setIsSubmitting(true)

    try {
      asset.status = 'uploading'
      setAsset({ ...asset })

      const uploadedUrl = await uploadGameToS3(asset, p => {
        asset.progress = p
        setAsset({ ...asset })
      })

      asset.uploadedUrl = uploadedUrl
      asset.status = 'done'
      setAsset({ ...asset })

      setIsSavingMetadata(true)

      const res = await fetch(`${BACKEND_URL}/api/allposts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'game_post',
          description,
          price: Number(price),
          game: {
            name: asset.name,
            url: uploadedUrl,
            size: asset.size
          }
        })
      })

      if (!res.ok) throw new Error('Post failed')
      onCancel()
    } catch (err) {
      console.error(err)
      setIsSubmitting(false)
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-black min-h-[70vh] rounded-2xl border border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xl font-bold">Upload Game</h2>
        <button
          onClick={handlePostSubmit}
          disabled={!description || !asset || isSubmitting}
          className="bg-sky-500 px-5 py-1.5 rounded-full text-white font-bold disabled:opacity-50"
        >
          {isSubmitting ? 'Publishing...' : 'Publish'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        <textarea
          placeholder="Describe your game..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full bg-transparent text-lg outline-none resize-none min-h-[100px]"
        />

        {/* Game File */}
        {asset ? (
          <div className="relative p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setAsset(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <FileArchive className="text-sky-500" />
              <div className="flex-1">
                <p className="text-sm font-bold">{asset.name}</p>
                <p className="text-xs text-gray-500">
                  {(asset.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            {asset.status === 'uploading' && (
              <div className="mt-3">
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all"
                    style={{ width: `${asset.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 rounded-2xl py-14 flex flex-col items-center gap-3 cursor-pointer hover:bg-zinc-900/40"
          >
            <Upload size={32} className="text-sky-500" />
            <p className="text-gray-500 font-medium">
              Upload Game Build (ZIP / EXE / APK)
            </p>
          </div>
        )}

        {isSavingMetadata && (
          <div className="text-center text-sky-400 text-sm animate-pulse">
            Finalizing game post…
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3 bg-zinc-900 px-3 py-1.5 rounded-full">
          <DollarSign size={16} />
          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="bg-transparent outline-none text-sm w-20"
          />
        </div>
        <div className="text-xs text-gray-500">1 Game File</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".zip,.exe,.apk"
        onChange={handleFileChange}
      />
    </div>
  )
}

export default GamePostForm
