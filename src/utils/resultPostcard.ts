export interface PostcardResult {
  score: number
  maxScore: number
  rank: string
  blurb: string
  mode: string
  missions: number
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character]!)
}

export function createPostcardSvg(result: PostcardResult): string {
  const score = result.score.toLocaleString('en-US')
  const maximum = result.maxScore.toLocaleString('en-US')
  const lines = result.blurb.split(' ').reduce<string[]>((wrapped, word) => {
    const last = wrapped.length - 1
    if (last >= 0 && `${wrapped[last]} ${word}`.length <= 42) wrapped[last] += ` ${word}`
    else wrapped.push(word)
    return wrapped
  }, [])
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#f8f4ed"/>
  <rect x="24" y="24" width="1152" height="752" rx="4" fill="none" stroke="#b68235" stroke-width="2"/>
  <rect x="40" y="40" width="1120" height="720" rx="2" fill="none" stroke="#dfd0b7"/>
  <g font-family="Georgia, serif" fill="#201f1d">
    <text x="80" y="112" font-size="40">SpotQuest</text>
    <text x="80" y="149" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#7d5411">EVERYDAY OBJECTS. EXTRAORDINARY INSTINCTS.</text>
    <g transform="translate(1014 75) rotate(8 48 55)" fill="none" stroke="#7d5411">
      <rect width="96" height="110" stroke-width="2" stroke-dasharray="5 5"/>
      <circle cx="48" cy="48" r="28" stroke-width="2"/>
      <path d="M48 25 55 48 48 71 41 48Z" fill="#b68235"/>
      <path d="M25 48h46M48 20v56" stroke-width="1"/>
      <text x="48" y="94" text-anchor="middle" fill="#7d5411" stroke="none" font-family="Arial, sans-serif" font-size="10" letter-spacing="2">FIELD NOTES</text>
    </g>
    <path d="M80 214h1040" stroke="#dfd0b7"/>
    <rect x="80" y="254" width="390" height="356" rx="195" fill="#eee4d3"/>
    <circle cx="275" cy="432" r="160" fill="none" stroke="#b68235"/>
    <text x="275" y="358" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#7d5411">TOTAL SCORE</text>
    <text x="275" y="470" text-anchor="middle" font-size="100">${score}</text>
    <text x="275" y="519" text-anchor="middle" font-size="24" fill="#605d5d">of ${maximum} possible</text>
    <text x="535" y="311" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#7d5411">QUEST COMPLETE</text>
    <text x="535" y="377" font-size="44">Nice work, detective.</text>
    <text x="535" y="435" font-size="39" fill="#7d5411">${escapeXml(result.rank)}</text>
    <text font-size="24" fill="#605d5d">${lines.map((line, index) => `<tspan x="535" y="${491 + index * 36}">${escapeXml(line)}</tspan>`).join('')}</text>
    <text x="535" y="595" font-family="Arial, sans-serif" font-size="20" fill="#605d5d">${escapeXml(result.mode)} mode &#183; ${result.missions} missions explored</text>
    <path d="M80 654h1040" stroke="#dfd0b7"/>
    <text x="80" y="709" font-size="25" font-style="italic">A little curiosity goes a long way.</text>
    <text x="1120" y="709" text-anchor="end" font-family="Arial, sans-serif" font-size="15" letter-spacing="3" fill="#7d5411">MY QUEST POSTCARD</text>
  </g>
</svg>`
}

export async function createPostcardFile(svg: string): Promise<File> {
  const image = new Image()
  // A self-contained data URL keeps the exported canvas origin-clean.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create the postcard image.')
  context.drawImage(image, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error('Your browser could not export the postcard image.'))
    }, 'image/png')
  })
  return new File([blob], 'spotquest-postcard.png', { type: 'image/png' })
}

export async function sharePostcard(file: File): Promise<'shared' | 'unsupported' | 'cancelled'> {
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file], title: 'My SpotQuest postcard' })
    return 'shared'
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}
