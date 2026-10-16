import type { CapturedFrame } from './captureFrame'
import type { VisionJudgment } from '../services/jev/types'

export type InvestigationState =
  | { status: 'idle' }
  | { status: 'requesting-camera' }
  | { status: 'camera-ready' }
  | { status: 'capturing' }
  | { status: 'frozen'; frame: CapturedFrame }
  | { status: 'analyzing'; frame: CapturedFrame }
  | { status: 'success'; frame: CapturedFrame; judgment: VisionJudgment; points: number }
  | { status: 'uncertain'; frame: CapturedFrame; judgment: VisionJudgment; outcome: 'no-match' | 'inconclusive' }
  | { status: 'failed'; message: string; frame?: CapturedFrame }
  | { status: 'camera-error'; message: string }
  | { status: 'api-error'; frame: CapturedFrame; message: string }

export type InvestigationAction =
  | { type: 'CAMERA_REQUESTED' }
  | { type: 'CAMERA_READY' }
  | { type: 'CAMERA_FAILED'; message: string }
  | { type: 'CAPTURE_STARTED' }
  | { type: 'FRAME_CAPTURED'; frame: CapturedFrame }
  | { type: 'ANALYSIS_STARTED' }
  | { type: 'SUCCESS'; judgment: VisionJudgment; points: number }
  | { type: 'UNCERTAIN'; judgment: VisionJudgment; outcome: 'no-match' | 'inconclusive' }
  | { type: 'API_FAILED'; message: string }
  | { type: 'FAILED'; message: string; frame?: CapturedFrame }
  | { type: 'RESET'; cameraReady: boolean }

export const initialInvestigationState: InvestigationState = { status: 'idle' }

const isRunning = (state: InvestigationState): boolean =>
  state.status === 'capturing' || state.status === 'frozen' || state.status === 'analyzing'

export function investigationReducer(
  state: InvestigationState,
  action: InvestigationAction,
): InvestigationState {
  switch (action.type) {
    case 'CAMERA_REQUESTED':
      return isRunning(state) ? state : { status: 'requesting-camera' }
    case 'CAMERA_READY':
      return isRunning(state) ? state : { status: 'camera-ready' }
    case 'CAMERA_FAILED':
      return { status: 'camera-error', message: action.message }
    case 'CAPTURE_STARTED':
      return isRunning(state) ? state : { status: 'capturing' }
    case 'FRAME_CAPTURED':
      return state.status === 'capturing' ? { status: 'frozen', frame: action.frame } : state
    case 'ANALYSIS_STARTED':
      return state.status === 'frozen' ? { status: 'analyzing', frame: state.frame } : state
    case 'SUCCESS':
      return state.status === 'analyzing'
        ? { status: 'success', frame: state.frame, judgment: action.judgment, points: action.points }
        : state
    case 'UNCERTAIN':
      return state.status === 'analyzing'
        ? { status: 'uncertain', frame: state.frame, judgment: action.judgment, outcome: action.outcome }
        : state
    case 'API_FAILED':
      return state.status === 'analyzing'
        ? { status: 'api-error', frame: state.frame, message: action.message }
        : state
    case 'FAILED':
      return action.frame
        ? { status: 'failed', message: action.message, frame: action.frame }
        : { status: 'failed', message: action.message }
    case 'RESET':
      return action.cameraReady ? { status: 'camera-ready' } : { status: 'idle' }
  }
}

export const isInvestigationRunning = isRunning
