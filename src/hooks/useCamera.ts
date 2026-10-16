import { useCallback, useEffect, useRef, useState } from 'react'

type FacingMode = 'user' | 'environment'

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No camera was found. Connect a camera or use the image upload option.'
  }
  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return 'The camera is already in use by another app. Close it there and try again.'
  }
  if (error instanceof Error && error.message.startsWith('Camera access is unavailable')) {
    return error.message
  }
  return 'The camera could not be started. Check browser permissions and try again.'
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const facingMode = useRef<FacingMode>('user')
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    setIsRequesting(false)
  }, [])

  const start = useCallback(async (nextFacingMode: FacingMode = facingMode.current) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is unavailable in this browser. Use a secure origin or upload an image.')
    }

    setIsRequesting(true)
    let acquiredStream: MediaStream | null = null
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      acquiredStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: nextFacingMode } },
      })
      streamRef.current = acquiredStream
      facingMode.current = nextFacingMode
      setStream(acquiredStream)
      const devices = await navigator.mediaDevices.enumerateDevices()
      setHasMultipleCameras(devices.filter((device) => device.kind === 'videoinput').length > 1)
    } catch (error) {
      acquiredStream?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
      throw new Error(describeCameraError(error), { cause: error })
    } finally {
      setIsRequesting(false)
    }
  }, [])

  const switchCamera = useCallback(async () => {
    const nextFacingMode = facingMode.current === 'user' ? 'environment' : 'user'
    await start(nextFacingMode)
  }, [start])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    if (stream) {
      void video.play().catch(() => undefined)
    }
  }, [stream])

  useEffect(() => {
    window.addEventListener('pagehide', stop)
    return () => {
      window.removeEventListener('pagehide', stop)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [stop])

  return {
    stream,
    videoRef,
    isRequesting,
    hasMultipleCameras,
    start,
    stop,
    switchCamera,
  }
}
