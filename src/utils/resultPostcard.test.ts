import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPostcardFile, createPostcardSvg, sharePostcard } from './resultPostcard'

afterEach(() => vi.unstubAllGlobals())

const result = {
  score: 0, maxScore: 1500, rank: 'Rookie Eye',
  blurb: 'A promising start. Keep training that instinct.',
  mode: 'Progressive', missions: 10,
}

describe('result postcard', () => {
  it.each([0, 725, 1500])('includes the exact result for a score of %i', (score) => {
    const svg = createPostcardSvg({ ...result, score })
    expect(svg).toContain(`>${score.toLocaleString('en-US')}</text>`)
    expect(svg).toContain('of 1,500 possible')
    expect(svg).toContain('Rookie Eye')
    expect(svg).toContain('Progressive mode &#183; 10 missions explored')
    expect(svg).toContain('width="1200" height="800"')
    expect(svg).not.toMatch(/<image|foreignObject|https?:\/\/(?!www.w3.org)/)
  })

  it('escapes dynamic text rather than treating it as SVG markup', () => {
    const svg = createPostcardSvg({ ...result, rank: '<script>&"\'', mode: 'A&B' })
    expect(svg).toContain('&lt;script&gt;&amp;&quot;&apos;')
    expect(svg).toContain('A&amp;B mode')
  })

  it('creates a 1200 x 800 PNG file from the graphic', async () => {
    const drawImage = vi.fn()
    const canvas = {
      width: 0, height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(new Blob(['png'], { type: 'image/png' }))),
    }
    vi.stubGlobal('Image', class { src = ''; decode = vi.fn().mockResolvedValue(undefined) })
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
    const file = await createPostcardFile(createPostcardSvg(result))
    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(800)
    expect(drawImage).toHaveBeenCalledOnce()
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(file.name).toBe('spotquest-postcard.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBeGreaterThan(0)
  })

  it('surfaces export failures', async () => {
    vi.stubGlobal('Image', class { src = ''; decode = vi.fn().mockResolvedValue(undefined) })
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    await expect(createPostcardFile('<svg/>')).rejects.toThrow('could not create')
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: (blob: Blob | null) => void) => callback(null),
      }),
    })
    await expect(createPostcardFile('<svg/>')).rejects.toThrow('could not export')
  })
})

describe('postcard sharing', () => {
  const file = new File(['png'], 'spotquest-postcard.png', { type: 'image/png' })

  it('shares the actual image file through the native share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { share, canShare })
    await expect(sharePostcard(file)).resolves.toBe('shared')
    expect(canShare).toHaveBeenCalledWith({ files: [file] })
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'My SpotQuest postcard' })
  })

  it.each([{}, { share: vi.fn() }, { share: vi.fn(), canShare: () => false }])('signals download fallback when file sharing is unavailable', async (navigator) => {
    vi.stubGlobal('navigator', navigator)
    await expect(sharePostcard(file)).resolves.toBe('unsupported')
  })

  it('treats cancellation as a non-error without a fallback download', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
    })
    await expect(sharePostcard(file)).resolves.toBe('cancelled')
  })

  it('surfaces genuine share failures', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new Error('Permission denied')),
    })
    await expect(sharePostcard(file)).rejects.toThrow('Permission denied')
  })
})
