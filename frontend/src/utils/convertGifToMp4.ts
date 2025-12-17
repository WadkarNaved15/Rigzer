import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()
let loading: Promise<boolean> | null = null

async function loadFFmpeg() {
  if (ffmpeg.loaded) return
  if (!loading) {
    loading = ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
    })
  }
  await loading
}

export async function convertGifToMp4(file: File): Promise<Blob> {
  await loadFFmpeg()

  await ffmpeg.writeFile('input.gif', await fetchFile(file))

  await ffmpeg.exec([
    '-i', 'input.gif',
    '-movflags', 'faststart',
    '-pix_fmt', 'yuv420p',
    'out.mp4',
  ])

  const data = await ffmpeg.readFile('out.mp4')

  if (typeof data === 'string') {
    throw new Error('Unexpected ffmpeg output')
  }

  // ✅ FORCE real ArrayBuffer (no SharedArrayBuffer)
  const uint8 = new Uint8Array(data)
  const buffer = uint8.buffer.slice(0)

  return new Blob([buffer], { type: 'video/mp4' })
}
