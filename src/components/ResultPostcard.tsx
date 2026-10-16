import { useEffect, useState } from 'react'
import { createPostcardFile, createPostcardSvg, sharePostcard } from '../utils/resultPostcard'
import type { PostcardResult } from '../utils/resultPostcard'

export function ResultPostcard(result: PostcardResult) {
  const svg = createPostcardSvg(result)
  const [postcard, setPostcard] = useState<{ file: File; url: string } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sharing, setSharing] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let url: string | undefined
    void createPostcardFile(svg).then((file) => {
      if (!active) return
      url = URL.createObjectURL(file)
      setPostcard({ file, url })
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'The postcard could not be created. Please try again.')
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [svg, attempt])

  const share = async () => {
    if (!postcard) return
    setSharing(true)
    setError('')
    setMessage('')
    try {
      const outcome = await sharePostcard(postcard.file)
      if (outcome === 'unsupported') {
        const link = document.createElement('a')
        link.href = postcard.url
        link.download = postcard.file.name
        link.click()
        setMessage('Image sharing is not supported in this browser. Your postcard download has started; share the saved PNG anywhere you like.')
      } else if (outcome === 'shared') {
        setMessage('Postcard shared.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? `Could not share the postcard: ${cause.message}. You can try again or download it instead.` : 'Could not share the postcard. Try again or download it instead.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="jvq-postcard">
      <img
        alt={`SpotQuest quest complete. Total score: ${result.score.toLocaleString('en-US')} of ${result.maxScore.toLocaleString('en-US')}. Rank: ${result.rank}. ${result.blurb} ${result.mode} mode, ${result.missions} missions explored.`}
        className="jvq-postcard-image"
        height={800}
        src={postcard?.url ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        width={1200}
      />
      <div aria-label="Postcard actions" className="jvq-postcard-actions">
        <button className="btn btn-primary" disabled={!postcard || sharing} onClick={() => void share()} type="button">
          {sharing ? 'Sharing...' : 'Share postcard'}
        </button>
        {postcard && (
          <a className="btn btn-secondary" download={postcard.file.name} href={postcard.url} onClick={() => setMessage('Postcard download started.')}>
            Download PNG
          </a>
        )}
        {!postcard && !error && <span role="status">Preparing your postcard...</span>}
        {!postcard && error && (
          <button className="btn btn-secondary" onClick={() => {
            setError('')
            setAttempt((value) => value + 1)
          }} type="button">Retry postcard</button>
        )}
      </div>
      <p className="jvq-postcard-note">A keepsake for every score. Only your quest results are included, never your photos.</p>
      <p role="status">{message}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
