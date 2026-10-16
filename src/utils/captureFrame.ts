export type CapturedFrame = {
  blob: Blob
  url: string
  width: number
  height: number
  mirrored: boolean
  name: string
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export function captureVideoFrame(video: HTMLVideoElement, mirrored: boolean): Promise<CapturedFrame> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    return Promise.reject(new Error('The camera is not ready yet. Wait for the preview, then try again.'))
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return Promise.reject(new Error('This browser could not prepare a camera frame.'))
  }

  if (mirrored) {
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('The camera frame could not be encoded as JPEG.'))
          return
        }
        resolve({
          blob,
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          mirrored,
          name: 'Camera frame',
        })
      },
      'image/jpeg',
      0.88,
    )
  })
}

export async function validateImageFile(file: File): Promise<CapturedFrame> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Choose a JPG or PNG image.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Choose an image smaller than 12 MB.')
  }

  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  bitmap.close()

  if (!width || !height) {
    throw new Error('The selected image has no readable dimensions.')
  }

  return {
    blob: file,
    url: URL.createObjectURL(file),
    width,
    height,
    mirrored: false,
    name: file.name || 'Uploaded image',
  }
}
