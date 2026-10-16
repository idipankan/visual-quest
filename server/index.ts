import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { CHALLENGES } from '../src/data/challenges'
import { parseJevResponse, ResponseValidationError } from '../src/services/jev/responseParser'
import { buildJevRequest, IMAGES_HEADER } from '../src/services/jev/requestBuilder'

// Local development convenience: real environment variables (e.g. Azure settings) always win.
if (existsSync('.env')) process.loadEnvFile('.env')

const PORT = Number(process.env.PORT ?? 8787)
const TYPESAFE_URL = process.env.TYPESAFE_API_URL ?? 'https://api.typesafe.ai/v1/systemone'
const UPSTREAM_TIMEOUT_MS = 30_000
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const RATE_LIMIT_PER_MINUTE = Number(process.env.JEV_RATE_LIMIT_PER_MINUTE ?? 20)
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

// Works from both server/ (tsx) and dist-server/ (bundled): dist is a sibling of each.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

// Never log or return this value.
const getApiKey = (): string | undefined => process.env.TYPESAFE_API_KEY?.trim() || undefined

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()')
  next()
})

// In-memory per-instance limiter; use a shared limiter or gateway if you scale out.
const hits = new Map<string, { count: number; resetAt: number }>()
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now()
  const ip = req.ip ?? 'unknown'
  const entry = hits.get(ip)
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 })
    next()
    return
  }
  entry.count += 1
  if (entry.count > RATE_LIMIT_PER_MINUTE) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
    res.status(429).json({ error: 'Too many analysis requests. Wait a moment, then retry.' })
    return
  }
  next()
}
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip)
}, 60_000).unref()

app.get('/api/health', (_req, res) => {
  res.json({ jevConfigured: getApiKey() !== undefined })
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 4, parts: 6 },
})

app.post('/api/jev', rateLimit, upload.single('image'), async (req, res) => {
  const apiKey = getApiKey()
  if (!apiKey) {
    res.status(503).json({ error: 'Jev is not configured on the server (TYPESAFE_API_KEY is missing).' })
    return
  }

  const challenge = CHALLENGES.find((item) => item.id === req.body?.challengeId)
  if (!challenge) {
    res.status(400).json({ error: 'Unknown challenge.' })
    return
  }
  const image = req.file
  if (!image || !ALLOWED_IMAGE_TYPES.has(image.mimetype)) {
    res.status(415).json({ error: 'Upload a JPG or PNG image.' })
    return
  }

  const { request, imagePartName } = buildJevRequest(challenge)
  const form = new FormData()
  form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  const extension = image.mimetype === 'image/png' ? 'png' : 'jpg'
  form.append(
    imagePartName,
    new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }),
    `vision-frame.${extension}`,
  )

  let upstream: globalThis.Response
  try {
    upstream = await fetch(TYPESAFE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, [IMAGES_HEADER]: 'true' },
      body: form,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    res.status(504).json({
      error: timedOut ? 'The analysis timed out. Try again.' : 'The server could not reach TypeSafe.',
    })
    return
  }

  if (!upstream.ok) {
    console.error(`TypeSafe returned HTTP ${upstream.status}`)
    if (upstream.status === 429 || upstream.status === 529) {
      res.status(upstream.status).json({ error: 'TypeSafe is busy or rate limited. Wait briefly, then retry.' })
    } else if (upstream.status === 401 || upstream.status === 403) {
      res.status(502).json({ error: "The server's TypeSafe credentials were rejected. Contact the app owner." })
    } else {
      res.status(502).json({ error: `TypeSafe could not process this request (HTTP ${upstream.status}).` })
    }
    return
  }

  try {
    const payload: unknown = await upstream.json()
    parseJevResponse(payload)
    res.json(payload)
  } catch (error) {
    const detail = error instanceof ResponseValidationError ? error.message : 'The response was not valid JSON.'
    res.status(502).json({ error: `TypeSafe returned an unexpected response. ${detail}` })
  }
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error)
    return
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'The image is too large. Try a smaller image.' : 'Invalid upload.',
    })
    return
  }
  console.error('Unhandled error', error instanceof Error ? error.message : error)
  res.status(500).json({ error: 'Unexpected server error.' })
})

app.listen(PORT, () => {
  console.log(`Jev Vision Quest listening on port ${PORT}`)
  if (!getApiKey()) console.warn('TYPESAFE_API_KEY is not set; /api/jev will return 503.')
})
