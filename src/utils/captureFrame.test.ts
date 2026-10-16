import { afterEach, describe, expect, it, vi } from 'vitest'
import { MIRROR_CAPTURED_FRAME, MIRROR_LIVE_PREVIEW } from '../config'
import { captureVideoFrame } from './captureFrame'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('camera orientation', () => {
  it('keeps the live preview and captured photo unmirrored', async () => {
    expect(MIRROR_LIVE_PREVIEW).toBe(false)
    expect(MIRROR_CAPTURED_FRAME).toBe(false)

    const video = Object.assign(Object.create(null) as HTMLVideoElement, {
      readyState: 2,
      videoWidth: 1280,
      videoHeight: 720,
    })
    const context = {
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    }
    const blob = new Blob(['frame'], { type: 'image/jpeg' })
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(blob)),
    }
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 })
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:camera-frame') })

    const frame = await captureVideoFrame(video, MIRROR_CAPTURED_FRAME)

    expect(context.translate).not.toHaveBeenCalled()
    expect(context.scale).not.toHaveBeenCalled()
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720)
    expect(frame).toEqual({
      blob,
      url: 'blob:camera-frame',
      width: 1280,
      height: 720,
      mirrored: false,
      name: 'Camera frame',
    })
  })
})
