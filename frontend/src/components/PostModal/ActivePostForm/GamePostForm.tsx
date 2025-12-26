import React, { useState, useRef, ChangeEvent } from 'react'
import { X, Upload, FileArchive } from 'lucide-react'

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
  /* ---------------- Core State ---------------- */
  const [gameName, setGameName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')

  const [platform, setPlatform] = useState<'windows'>('windows')
  const [buildType, setBuildType] =
    useState<'windows_exe' | 'windows_zip' >('windows_exe')
  const [startPath, setStartPath] = useState('')
  const [engine, setEngine] = useState('')

  /* -------- System Requirements (Optional) -------- */
  const [ramGB, setRamGB] = useState('')
  const [cpuCores, setCpuCores] = useState('')
  const [requiresGPU, setRequiresGPU] = useState(false)

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
    if (!asset || !gameName || !startPath || isSubmitting) return
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
          game: {
            gameName,
            version,
            description,
            platform,
            buildType,
            startPath,
            engine,
            runMode: 'sandboxed',
            price: Number(price),
            systemRequirements: {
              ramGB: ramGB ? Number(ramGB) : null,
              cpuCores: cpuCores ? Number(cpuCores) : null,
              gpuRequired: requiresGPU
            },
            file: {
              name: asset.name,
              url: uploadedUrl,
              size: asset.size
            }
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
    <div className="w-full max-w-xl mx-auto bg-black min-h-[75vh] rounded-2xl border border-zinc-800 flex flex-col overflow-hidden text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xl font-bold">Upload Game</h2>
        <button
          onClick={handlePostSubmit}
          disabled={!asset || !startPath || !gameName || isSubmitting}
          className="bg-sky-500 px-5 py-1.5 rounded-full text-white font-bold disabled:opacity-50"
        >
          {isSubmitting ? 'Publishing...' : 'Publish'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <input
          placeholder="Game Name"
          value={gameName}
          onChange={e => setGameName(e.target.value)}
          className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg border border-zinc-700 focus:border-sky-500 outline-none"
        />

        <input
          placeholder="Version (e.g. 1.0.0)"
          value={version}
          onChange={e => setVersion(e.target.value)}
          className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg border border-zinc-700 focus:border-sky-500 outline-none"
        />

        <textarea
          placeholder="Game description..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg resize-none border border-zinc-700 focus:border-sky-500 outline-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value as any)}
            className="bg-zinc-900 text-zinc-100 p-2 rounded-lg border border-zinc-700 focus:border-sky-500 outline-none"
          >
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
          </select>

          <select
            value={buildType}
            onChange={e => setBuildType(e.target.value as any)}
            className="bg-zinc-900 text-zinc-100 p-2 rounded-lg border border-zinc-700 focus:border-sky-500 outline-none"
          >
            <option value="windows_exe">Windows EXE</option>
            <option value="windows_zip">Windows ZIP</option>
            <option value="html5">HTML5</option>
          </select>
        </div>


       <input
  placeholder="Game Start File (e.g. Game.exe or Build/MyGame.exe)"
  value={startPath}
  onChange={e => setStartPath(e.target.value)}
  className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg border border-sky-500 outline-none"
/>
<p className="text-xs text-zinc-400">
  Relative path to the file that starts your game after extraction
</p>


        <input
          placeholder="Game Engine (Unity / Unreal / Godot)"
          value={engine}
          onChange={e => setEngine(e.target.value)}
          className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg border border-zinc-700 focus:border-sky-500 outline-none"
        />

        {/* System Requirements */}
        <div className="border border-zinc-700 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-zinc-300">
            Minimum System Requirements (Optional)
          </p>

          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="RAM (GB)"
              value={ramGB}
              onChange={e => setRamGB(e.target.value)}
              className="bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg border border-zinc-700"
            />
            <input
              placeholder="CPU Cores"
              value={cpuCores}
              onChange={e => setCpuCores(e.target.value)}
              className="bg-zinc-900 text-zinc-100 placeholder-zinc-500 p-2 rounded-lg border border-zinc-700"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={requiresGPU}
              onChange={e => setRequiresGPU(e.target.checked)}
            />
            Requires GPU
          </label>
        </div>

        {/* File Upload */}
        {asset ? (
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700">
            <div className="flex items-center gap-3">
              <FileArchive className="text-sky-500" />
              <div className="flex-1">
                <p className="text-sm font-bold">{asset.name}</p>
                <p className="text-xs text-zinc-400">
                  {(asset.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <X className="cursor-pointer" onClick={() => setAsset(null)} />
            </div>

            {asset.status === 'uploading' && (
              <div className="mt-3 h-1 bg-zinc-800 rounded">
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${asset.progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-700 rounded-xl py-10 flex flex-col items-center cursor-pointer"
          >
            <Upload className="text-sky-500" />
            <p className="text-sm text-zinc-400 mt-2">
              Upload Game Build (ZIP / EXE)
            </p>
          </div>
        )}
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
