import type { VisionChallenge } from '../../data/challenges'
import { parseJevResponse, ResponseValidationError } from './responseParser'
import type { JevClient } from './types'

const ENDPOINT = '/api/jev'
const HEALTH_ENDPOINT = '/api/health'
const REQUEST_TIMEOUT_MS = 35_000

export class JevRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JevRequestError'
  }
}

export async function fetchJevAvailability(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_ENDPOINT)
    if (!response.ok) return false
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null && (body as { jevConfigured?: unknown }).jevConfigured === true
  } catch {
    return false
  }
}

async function readServerError(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json()
    const message = (body as { error?: unknown } | null)?.error
    return typeof message === 'string' ? message : undefined
  } catch {
    return undefined
  }
}

export class ServerJevClient implements JevClient {
  async analyze(image: Blob, challenge: VisionChallenge) {
    const body = new FormData()
    body.append('challengeId', challenge.id)
    const extension = image.type === 'image/png' ? 'png' : 'jpg'
    body.append('image', image, `vision-frame.${extension}`)

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(ENDPOINT, { method: 'POST', body, signal: controller.signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new JevRequestError('The analysis timed out. Try again with a smaller or clearer image.')
      }
      throw new JevRequestError('The SpotQuest server could not be reached. Check your connection and retry.')
    } finally {
      window.clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new JevRequestError(
        (await readServerError(response)) ??
          `The server returned an unexpected HTTP ${response.status} error.`,
      )
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new ResponseValidationError('The server returned a response that was not valid JSON.')
    }
    return parseJevResponse(payload)
  }
}
