import { useEffect, useReducer, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import { CHALLENGES, difficultyLabel } from './data/challenges'
import type { Difficulty } from './data/challenges'
import { useCamera } from './hooks/useCamera'
import { ServerJevClient, ResponseValidationError, fetchJevAvailability } from './services/jev'
import type { MatchBand } from './services/jev'
import { MATCH_BANDS } from './services/jev/types'
import {
  initialInvestigationState,
  investigationReducer,
  isInvestigationRunning,
} from './utils/investigationMachine'
import type { InvestigationState } from './utils/investigationMachine'
import {
  captureVideoFrame,
  validateImageFile,
} from './utils/captureFrame'
import type { CapturedFrame } from './utils/captureFrame'
import { toBoxPercentages } from './utils/boxCoordinates'
import { calculatePoints, evaluatePresence } from './utils/scoring'
import { createRound, GAME_MODES, maximumRoundScore, ROUND_LENGTH } from './utils/gameRound'
import type { GameMode } from './utils/gameRound'
import { ResultPostcard } from './components/ResultPostcard'
import {
  JEV_MODEL,
  MIRROR_CAPTURED_FRAME,
  MIRROR_LIVE_PREVIEW,
  PROTOTYPE_PRESENCE_THRESHOLD,
} from './config'
import './App.css'

const matchBandLabel: Record<MatchBand, string> = {
  no_match: 'No match',
  weak_match: 'Weak match',
  reasonable_match: 'Reasonable match',
  strong_match: 'Strong match',
  unmistakable_match: 'Unmistakable match',
}

const levelTagClass: Record<Difficulty, string> = {
  easy: 'tag tag-neutral',
  medium: 'tag tag-accent-2',
  hard: 'tag tag-outline',
}

const isBusy = (state: InvestigationState): boolean =>
  isInvestigationRunning(state)

function currentFrame(state: InvestigationState): CapturedFrame | undefined {
  return 'frame' in state ? state.frame : undefined
}

function humanizeCategory(value: string): string {
  return value.replaceAll('_', ' ')
}

function rankFor(score: number, maxScore: number): { rank: string; blurb: string } {
  const ratio = maxScore ? score / maxScore : 0
  if (ratio >= 0.85) {
    return { rank: 'Master of Common Sense', blurb: 'Unmistakable instincts. Jev is taking notes on you.' }
  }
  if (ratio >= 0.6) {
    return { rank: 'Keen Detective', blurb: 'Sharp eye for evidence. Few things slip past you.' }
  }
  if (ratio >= 0.33) {
    return { rank: 'Field Investigator', blurb: 'Solid work in the field. A few leads got away.' }
  }
  return { rank: 'Rookie Eye', blurb: 'A promising start. Keep training that instinct.' }
}

function Icon({ children, size = 16, strokeWidth = 1.7 }: { children: ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  )
}

const SearchIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
)

const CameraIcon = ({ size = 17 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
    <circle cx="12" cy="13" r="3.2" />
  </Icon>
)

const WarningIcon = ({ size = 16 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
)

const ResetIcon = ({ size = 14 }: { size?: number }) => (
  <Icon size={size}><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /></Icon>
)

function Modal({
  title,
  children,
  onKeyDown,
  onBackdrop,
  dialogRef,
}: {
  title: string
  children: ReactNode
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onBackdrop: () => void
  dialogRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={onBackdrop}>
      <div
        aria-labelledby="developer-dialog-title"
        aria-modal="true"
        className="dialog jvq-dialog"
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="jvq-dialog-head">
          <div className="jvq-dialog-mark"><SearchIcon size={16} /></div>
          <div className="dialog-title" id="developer-dialog-title">{title}</div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="jvq-stat-label">{label}</div>
      {children}
    </div>
  )
}

function ResultPanel({
  state,
  score,
  isLastMission,
  onNext,
  onRetry,
  onReturn,
}: {
  state: InvestigationState
  score: number
  isLastMission: boolean
  onNext: () => void
  onRetry: () => void
  onReturn: () => void
}) {
  if (state.status === 'success' || state.status === 'uncertain') {
    const { judgment } = state
    const isSuccess = state.status === 'success'
    const noMatch = state.status === 'uncertain' && state.outcome === 'no-match'
    const confidence = judgment.boxConfidence
    const bandIndex = MATCH_BANDS.indexOf(judgment.matchBand)
    const variant = isSuccess ? 'success' : noMatch ? 'nomatch' : 'inconclusive'
    const title = isSuccess
      ? 'Target acquired'
      : noMatch
        ? 'The scene needs another look'
        : 'We need a clearer clue'
    const body = isSuccess
      ? 'Nice work, detective — that fits the brief.'
      : noMatch
        ? 'No convincing match detected. Try a different object, or bring the item into the center of the frame.'
        : 'Evidence inconclusive. Try repositioning the object, improving the lighting, or moving a little closer.'

    return (
      <section className={`jvq-result jvq-result--${variant} jvq-fade`} aria-live="polite">
        <div className="jvq-result-head">
          <div className="jvq-result-icon">
            {isSuccess ? (
              <Icon size={17} strokeWidth={2.2}><path d="M20 6 9 17l-5-5" /></Icon>
            ) : noMatch ? (
              <Icon size={15} strokeWidth={2.2}><path d="M18 6 6 18M6 6l12 12" /></Icon>
            ) : (
              <Icon size={17} strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Icon>
            )}
          </div>
          <div className="jvq-result-text">
            <h3>{title}</h3>
            <p className="text-muted">{body}</p>
          </div>
          {isSuccess && (
            <div className="jvq-points">
              <div className="jvq-points-value">+{state.points}</div>
              <div className="jvq-kicker">points</div>
            </div>
          )}
        </div>

        <div className="jvq-stats">
          <Stat label="Presence probability">
            <div className="jvq-stat-value">{Math.round(judgment.presenceProbability * 100)}%</div>
            <div className="jvq-bar"><span style={{ width: `${Math.round(judgment.presenceProbability * 100)}%` }} /></div>
            {!isSuccess && (
              <div className="jvq-stat-note">Gate {Math.round(PROTOTYPE_PRESENCE_THRESHOLD * 100)}%</div>
            )}
          </Stat>
          <Stat label="Match quality">
            <div className="jvq-pips" aria-hidden="true">
              {MATCH_BANDS.map((band, index) => (
                <span className={`jvq-pip ${index <= bandIndex && bandIndex > 0 ? 'jvq-pip--on' : ''}`} key={band} />
              ))}
            </div>
            <div className="jvq-quality-label">{matchBandLabel[judgment.matchBand]}</div>
          </Stat>
          <Stat label="Box confidence">
            <div className="jvq-stat-value">
              {confidence === null ? 'Not reported' : `${Math.round(confidence * 100)}%`}
            </div>
            {isSuccess && confidence !== null && confidence < 0.6 && (
              <div className="jvq-warn">
                <WarningIcon size={12} />
                <span>Box is approximate</span>
              </div>
            )}
          </Stat>
          <Stat label="Evidence type">
            <div className="jvq-stat-value jvq-stat-value--text">{humanizeCategory(judgment.category)}</div>
            <div className="jvq-stat-note">Total {score} pts</div>
          </Stat>
        </div>

        <div className="jvq-result-actions">
          {isSuccess ? (
            <button className="btn btn-primary" onClick={onNext} type="button">
              {isLastMission ? 'See the verdict' : 'Next mission'}
            </button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={onRetry} type="button">Try again</button>
              <button className="btn btn-secondary" onClick={onNext} type="button">Skip mission</button>
            </>
          )}
        </div>
      </section>
    )
  }

  if (state.status === 'api-error' || state.status === 'failed') {
    return (
      <section className="jvq-result jvq-result--error jvq-fade" aria-live="polite">
        <div className="jvq-result-head">
          <div className="jvq-result-icon"><WarningIcon /></div>
          <div className="jvq-result-text">
            <h3>Your snapshot is still here</h3>
            <p className="text-muted">{state.message}</p>
          </div>
        </div>
        <div className="jvq-result-actions">
          <button className="btn btn-primary" onClick={onRetry} type="button">Retry</button>
          <button className="btn btn-secondary" onClick={onReturn} type="button">Back to camera</button>
        </div>
      </section>
    )
  }
  return null
}

function App() {
  const {
    stream: cameraStream,
    videoRef: cameraVideoRef,
    isRequesting: cameraIsRequesting,
    hasMultipleCameras,
    start: startCamera,
    stop: stopCamera,
    switchCamera: switchCameraDevice,
  } = useCamera()
  const [investigation, dispatch] = useReducer(investigationReducer, initialInvestigationState)
  const [challengeIndex, setChallengeIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [mode, setMode] = useState<GameMode>('progressive')
  const [round, setRound] = useState(() => createRound('progressive'))
  const [gameStarted, setGameStarted] = useState(false)
  const [jevReady, setJevReady] = useState(false)
  const [hasConsent, setHasConsent] = useState(false)
  const [consentDeclined, setConsentDeclined] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const frameUrl = useRef<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const challenge = round[challengeIndex]
  const maxScore = maximumRoundScore(round)
  const frame = currentFrame(investigation)
  const busy = isBusy(investigation)
  const isLastMission = challengeIndex >= round.length - 1

  const client = new ServerJevClient()

  useEffect(() => {
    dialogRef.current?.focus()
  }, [hasConsent])

  useEffect(() => {
    let active = true
    void fetchJevAvailability().then((available) => {
      if (active) setJevReady(available)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => () => {
    if (frameUrl.current) URL.revokeObjectURL(frameUrl.current)
  }, [])

  const disposeFrame = () => {
    if (frameUrl.current) URL.revokeObjectURL(frameUrl.current)
    frameUrl.current = null
  }

  const setFrame = (nextFrame: CapturedFrame) => {
    disposeFrame()
    frameUrl.current = nextFrame.url
    dispatch({ type: 'FRAME_CAPTURED', frame: nextFrame })
  }

  const analyze = async (nextFrame: CapturedFrame) => {
    dispatch({ type: 'ANALYSIS_STARTED' })
    setAnnouncement('Snapshot captured. Jev is analyzing the evidence.')
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120))
      const judgment = await client.analyze(nextFrame.blob, challenge)
      const presenceOutcome = evaluatePresence(
        judgment.presenceProbability,
        PROTOTYPE_PRESENCE_THRESHOLD,
      )
      if (presenceOutcome === 'success') {
        const points = calculatePoints(challenge.basePoints, judgment)
        setScore((current) => current + points)
        dispatch({ type: 'SUCCESS', judgment, points })
        setAnnouncement(`Target acquired. ${points} points earned.`)
      } else {
        dispatch({ type: 'UNCERTAIN', judgment, outcome: presenceOutcome })
        setAnnouncement(presenceOutcome === 'no-match' ? 'No convincing match detected.' : 'Evidence inconclusive.')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected analysis error occurred.'
      if (error instanceof ResponseValidationError) {
        dispatch({ type: 'FAILED', message, frame: nextFrame })
      } else {
        dispatch({ type: 'API_FAILED', message })
      }
      setAnnouncement('The analysis could not be completed. The captured image is preserved.')
    }
  }

  const beginInvestigation = async (nextFrame: CapturedFrame) => {
    if (busy) {
      URL.revokeObjectURL(nextFrame.url)
      return
    }
    dispatch({ type: 'CAPTURE_STARTED' })
    setFrame(nextFrame)
    await new Promise((resolve) => window.setTimeout(resolve, 100))
    await analyze(nextFrame)
  }

  const investigateFromCamera = async () => {
    const video = cameraVideoRef.current
    if (!video) {
      dispatch({ type: 'FAILED', message: 'The camera preview is not ready. Enable the camera or upload an image.' })
      return
    }
    dispatch({ type: 'CAPTURE_STARTED' })
    try {
      const nextFrame = await captureVideoFrame(video, MIRROR_CAPTURED_FRAME)
      await beginInvestigation(nextFrame)
    } catch (error) {
      dispatch({
        type: 'FAILED',
        message: error instanceof Error ? error.message : 'The camera frame could not be captured.',
      })
    }
  }

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    dispatch({ type: 'CAPTURE_STARTED' })
    try {
      const uploadedFrame = await validateImageFile(file)
      await beginInvestigation(uploadedFrame)
    } catch (error) {
      dispatch({
        type: 'FAILED',
        message: error instanceof Error ? error.message : 'The selected image could not be used.',
      })
    }
  }

  const enableCamera = async () => {
    dispatch({ type: 'CAMERA_REQUESTED' })
    try {
      await startCamera()
      dispatch({ type: 'CAMERA_READY' })
      setAnnouncement('Camera is ready. Frame capture starts only when you investigate.')
    } catch (error) {
      dispatch({
        type: 'CAMERA_FAILED',
        message: error instanceof Error ? error.message : 'The camera could not be started.',
      })
    }
  }

  const switchCamera = async () => {
    dispatch({ type: 'CAMERA_REQUESTED' })
    try {
      await switchCameraDevice()
      dispatch({ type: 'CAMERA_READY' })
    } catch (error) {
      dispatch({
        type: 'CAMERA_FAILED',
        message: error instanceof Error ? error.message : 'The camera could not be switched.',
      })
    }
  }

  const retryInvestigation = async () => {
    if (frame) {
      const retryFrame = { ...frame, url: URL.createObjectURL(frame.blob) }
      await beginInvestigation(retryFrame)
    } else {
      await investigateFromCamera()
    }
  }

  const returnToCamera = () => {
    disposeFrame()
    dispatch({ type: 'RESET', cameraReady: cameraStream !== null })
  }

  const nextMission = () => {
    disposeFrame()
    if (isLastMission) {
      stopCamera()
      dispatch({ type: 'RESET', cameraReady: false })
      setIsFinished(true)
      setAnnouncement('Quest complete. See your final score.')
      return
    }
    setChallengeIndex((index) => index + 1)
    dispatch({ type: 'RESET', cameraReady: cameraStream !== null })
    setAnnouncement('Next mission ready.')
  }

  const resetGame = () => {
    disposeFrame()
    stopCamera()
    setScore(0)
    setChallengeIndex(0)
    setIsFinished(false)
    setGameStarted(false)
    dispatch({ type: 'RESET', cameraReady: false })
    setAnnouncement('Choose a mode to start a new quest.')
  }

  const startGame = () => {
    setRound(createRound(mode))
    setChallengeIndex(0)
    setScore(0)
    setIsFinished(false)
    setGameStarted(true)
    setAnnouncement(`New ${mode} quest ready. Mission one of ${ROUND_LENGTH}.`)
  }

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const controls = dialogRef.current.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled), select:not(:disabled), [href]',
    )
    if (!controls.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const showLivePreview =
    !frame &&
    (investigation.status === 'idle' ||
      investigation.status === 'camera-ready' ||
      investigation.status === 'requesting-camera' ||
      investigation.status === 'camera-error')
  const boxStyle =
    investigation.status === 'success'
      ? toBoxPercentages(investigation.judgment.box, frame?.mirrored ?? false)
      : null
  const lowConfidenceBox =
    investigation.status === 'success' &&
    investigation.judgment.boxConfidence !== null &&
    investigation.judgment.boxConfidence < 0.6
  const cameraConnected = cameraStream !== null
  const isAnalysisState =
    investigation.status === 'capturing' ||
    investigation.status === 'frozen' ||
    investigation.status === 'analyzing'
  const isRequestingCamera = investigation.status === 'requesting-camera'
  const showIdleOverlay = !frame && !cameraConnected && !isRequestingCamera && investigation.status !== 'camera-error'
  const hasResult =
    investigation.status === 'success' ||
    investigation.status === 'uncertain' ||
    investigation.status === 'api-error' ||
    (investigation.status === 'failed' && !!frame)
  const viewportLabel = frame ? 'Frozen evidence' : cameraConnected || isRequestingCamera ? 'Live view' : 'Viewport idle'
  const statusDotClass = frame
    ? 'jvq-status-dot--frozen'
    : cameraConnected
      ? 'jvq-status-dot--live'
      : ''
  const rank = rankFor(score, maxScore)
  const gatePct = `${Math.round(PROTOTYPE_PRESENCE_THRESHOLD * 100)}%`

  return (
    <div className="jvq-shell">
      <div aria-live="polite" className="jvq-vh" role="status">{announcement}</div>

      <header className="nav jvq-nav">
        <div className="jvq-brand">
          <span className="nav-brand">SpotQuest</span>
          <span className="jvq-brand-sub">An AI-powered scavenger hunt</span>
        </div>
        <div className="jvq-pill jvq-navextra">
          <span className={`jvq-dot ${jevReady ? 'jvq-dot--on' : ''}`} />
          <span>{jevReady ? 'Jev online' : 'Jev offline'}</span>
        </div>
        <div
          className="jvq-gate jvq-navextra"
          title="Prototype threshold: points are only awarded above the presence gate"
        >
          <Icon size={13}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>
          <span>Presence gate {gatePct}</span>
        </div>
        <div className="jvq-score">
          <span className="jvq-kicker">Score</span>
          <span className="jvq-score-value">{score.toLocaleString('en-US')}</span>
        </div>
      </header>

      {!gameStarted ? (
        <main className="jvq-setup">
          <div className="jvq-kicker">Everyday objects. Unexpected missions.</div>
          <h1>What will you spot today?</h1>
          <p>Find an object that fits the mission, take a photo or upload an image, and let Jev judge the match.</p>
          <fieldset className="jvq-modes">
            <legend>Choose your mode</legend>
            {GAME_MODES.map((option) => (
              <label className="jvq-mode" key={option.value}>
                <input
                  checked={mode === option.value}
                  name="game-mode"
                  onChange={() => setMode(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="jvq-setup-note">{ROUND_LENGTH} random missions per quest. {CHALLENGES.length.toLocaleString()} challenges to explore. No repeats within a quest.</p>
          <button className="btn btn-primary" disabled={!hasConsent} onClick={startGame} type="button">
            Start quest
          </button>
        </main>
      ) : isFinished ? (
        <section className="jvq-end jvq-fade">
          <div className="jvq-end-kicker">Quest complete</div>
          <h1>Nice work, detective.</h1>
          <p className="text-muted">You explored every mission. Here&rsquo;s how your eye for everyday objects measures up.</p>
          <ResultPostcard
            score={score}
            maxScore={maxScore}
            rank={rank.rank}
            blurb={rank.blurb}
            mode={mode === 'progressive' ? 'Progressive' : difficultyLabel(mode)}
            missions={round.length}
          />
          <button className="btn btn-primary" onClick={resetGame} type="button">
            <ResetIcon size={17} />
            Play again
          </button>
        </section>
      ) : (
        <main className="jvq-main">
          <section aria-label="Current mission" className="jvq-mission">
            <div className="jvq-mission-top">
              <span className="jvq-round-mode">{mode === 'progressive' ? 'Progressive' : difficultyLabel(mode)} mode</span>
              <span className={levelTagClass[challenge.difficulty]}>{difficultyLabel(challenge.difficulty)}</span>
              <span className="jvq-case">
                Mission {String(challengeIndex + 1).padStart(2, '0')} / {String(round.length).padStart(2, '0')}
              </span>
            </div>
            <div
              aria-label={`Mission ${challengeIndex + 1} of ${round.length}`}
              className="jvq-progress"
              role="img"
            >
              <span style={{ width: `${Math.round((challengeIndex / round.length) * 100)}%` }} />
            </div>

            <h1 className="jvq-title">{challenge.title}</h1>
            <p className="jvq-prompt">{challenge.mission}</p>

            <div className="jvq-tip">
              <div className="jvq-kicker">Hint</div>
              <p className="text-muted">{challenge.hint}</p>
            </div>

            <div className="jvq-actions">
              <div className="jvq-actions-row">
                <button
                  className="btn btn-secondary"
                  disabled={busy || !jevReady}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Icon>
                    <path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                    <path d="M16 19h6M19 16v6" />
                  </Icon>
                  Use an image
                </button>
                <button
                  className="btn btn-ghost jvq-quiet"
                  disabled={busy || !jevReady}
                  onClick={nextMission}
                  type="button"
                >
                  Skip mission
                </button>
              </div>
              <input
                accept="image/jpeg,image/png"
                aria-label="Upload a JPG or PNG image instead of using a camera"
                disabled={busy || !jevReady}
                hidden
                onChange={onUpload}
                ref={fileInputRef}
                type="file"
              />
              {investigation.status === 'failed' && !frame && (
                <p className="jvq-error" role="alert">{investigation.message}</p>
              )}
            </div>

            <hr className="hr" />
            <div className="jvq-privacy">
              <Icon size={15} strokeWidth={1.6}>
                <rect height="11" rx="2" width="18" x="3" y="11" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Icon>
              <p>
                The camera only starts when you ask it to. On <em>Investigate</em>, a single still frame is sent
                to Jev. Nothing is recorded or stored.
              </p>
            </div>
            <button className="btn btn-ghost jvq-reset" disabled={busy} onClick={resetGame} type="button">
              <ResetIcon />
              Reset game
            </button>
          </section>

          <section aria-label="Camera and investigation result" className="jvq-viewport">
            <div className="jvq-viewport-head">
              <div className="jvq-status">
                <span className={`jvq-status-dot ${statusDotClass}`} />
                <span>{viewportLabel}</span>
              </div>
              <div className="jvq-cam-controls">
                <button
                  aria-label="Switch camera"
                  className="btn btn-secondary btn-icon"
                  disabled={!cameraConnected || !hasMultipleCameras || cameraIsRequesting || busy || !!frame}
                  onClick={switchCamera}
                  title="Switch camera"
                  type="button"
                >
                  <Icon size={17}>
                    <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2-3h2l2 3h5a2 2 0 0 1 2 2v3" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M18 22l3-3-3-3M21 19h-7" />
                  </Icon>
                </button>
                <button
                  aria-label="Stop camera"
                  className="btn btn-secondary btn-icon"
                  disabled={!cameraConnected || busy || !!frame}
                  onClick={() => {
                    stopCamera()
                    dispatch({ type: 'RESET', cameraReady: false })
                  }}
                  title="Stop camera"
                  type="button"
                >
                  <Icon size={17}><rect height="12" rx="1.5" width="12" x="6" y="6" /></Icon>
                </button>
              </div>
            </div>

            <div className="jvq-stage">
              <video
                aria-label="Live camera preview. Video is not sent continuously."
                autoPlay
                className={`jvq-video ${MIRROR_LIVE_PREVIEW ? 'jvq-video--mirrored' : ''}`}
                hidden={!showLivePreview || !cameraConnected}
                muted
                playsInline
                ref={cameraVideoRef}
              />

              {cameraConnected && !frame && !isRequestingCamera && investigation.status !== 'camera-error' && (
                <div className="jvq-capture-controls">
                  <button
                    className="jvq-investigate"
                    disabled={busy || !jevReady}
                    onClick={investigateFromCamera}
                    title={jevReady ? 'Capture a photo and investigate' : 'Jev is offline'}
                    type="button"
                  >
                    <span className="jvq-shutter" aria-hidden="true"><CameraIcon size={26} /></span>
                    <span>{busy ? 'Analyzing…' : 'Investigate'}</span>
                  </button>
                </div>
              )}

              {showIdleOverlay && (
                <div className="jvq-overlay jvq-fade">
                  <svg aria-hidden="true" fill="none" height="44" stroke="var(--color-accent-300)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24" width="44">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
                    <circle cx="12" cy="13" r="3.2" />
                  </svg>
                  <h3>The evidence awaits</h3>
                  <p>Point your camera at something that fits the mission, or upload a photo from your files.</p>
                  <button className="btn btn-primary" disabled={cameraIsRequesting} onClick={enableCamera} type="button">
                    <CameraIcon />
                    Enable camera
                  </button>
                </div>
              )}

              {isRequestingCamera && !cameraConnected && (
                <div className="jvq-overlay">
                  <div className="jvq-spinner" aria-hidden="true" />
                  <p className="jvq-wait-title">Waiting for camera permission</p>
                  <p className="jvq-wait-sub">Allow access in your browser to begin.</p>
                </div>
              )}

              {investigation.status === 'camera-error' && (
                <div className="jvq-overlay jvq-fade" role="alert">
                  <svg aria-hidden="true" fill="none" height="38" stroke="var(--color-accent-300)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="38">
                    <path d="M10.5 5h3L16 8h4a2 2 0 0 1 2 2v7" />
                    <path d="M2 8.5V18a2 2 0 0 0 2 2h13" />
                    <path d="m2 2 20 20" />
                  </svg>
                  <h3>The camera&rsquo;s gone dark</h3>
                  <p>{investigation.message}</p>
                  <div className="jvq-overlay-actions">
                    <button className="btn btn-primary" onClick={enableCamera} type="button">Try camera again</button>
                    <button
                      className="btn btn-secondary"
                      disabled={!jevReady}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Use an image
                    </button>
                  </div>
                </div>
              )}

              {frame && (
                <div className="jvq-frozen">
                  <img
                    alt={`${frame.name}, frozen image used for the current visual investigation`}
                    height={frame.height}
                    src={frame.url}
                    width={frame.width}
                  />
                  <div className="jvq-frozen-layer">
                    {isAnalysisState && (
                      <>
                        <div className="jvq-scrim" />
                        <div className="jvq-scanline" />
                        <div className="jvq-analyzing" role="status">
                          <span className="jvq-spinner jvq-spinner--small" aria-hidden="true" />
                          <span>Analyzing frame…</span>
                        </div>
                      </>
                    )}
                    {boxStyle && investigation.status === 'success' && (
                      <div
                        aria-label="Detected target bounding box"
                        className={`jvq-box jvq-fade ${lowConfidenceBox ? 'jvq-box--approx' : ''}`}
                        role="img"
                        style={{
                          left: `${boxStyle.left}%`,
                          top: `${boxStyle.top}%`,
                          width: `${boxStyle.width}%`,
                          height: `${boxStyle.height}%`,
                        }}
                      >
                        <span className="jvq-box-label">
                          ⌖ Target acquired · {humanizeCategory(investigation.judgment.category)}
                        </span>
                        <i className="jvq-corner jvq-corner--tl" />
                        <i className="jvq-corner jvq-corner--tr" />
                        <i className="jvq-corner jvq-corner--bl" />
                        <i className="jvq-corner jvq-corner--br" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {hasResult && (
              <ResultPanel
                isLastMission={isLastMission}
                onNext={nextMission}
                onRetry={retryInvestigation}
                onReturn={returnToCamera}
                score={score}
                state={investigation}
              />
            )}
          </section>
        </main>
      )}

      <footer className="jvq-footer">
        <span>SpotQuest · Powered by Jev</span>
        <span>Jev treats every probability as a hint, never a certainty. · Model {JEV_MODEL}</span>
      </footer>

      {!hasConsent && (
        <Modal
          dialogRef={dialogRef}
          onBackdrop={() => {}}
          onKeyDown={onDialogKeyDown}
          title="Before you start: image data & privacy"
        >
          <p className="dialog-body">
            SpotQuest sends the photos you capture or upload to TypeSafe servers for processing.
            TypeSafe does not reuse your images for training, but may store them temporarily for
            security reasons.
          </p>
          <p className="dialog-body">
            <a href="https://docs.typesafe.ai/legal" rel="noopener noreferrer" target="_blank">
              Legal - TypeSafe
            </a>
          </p>

          {consentDeclined && (
            <p className="jvq-error" role="alert">
              Consent is required to use this app because images must be processed by TypeSafe.
            </p>
          )}

          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setConsentDeclined(true)} type="button">
              Decline
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setHasConsent(true)
                setConsentDeclined(false)
              }}
              type="button"
            >
              I agree
            </button>
          </div>
        </Modal>
      )}

    </div>
  )
}

export default App
