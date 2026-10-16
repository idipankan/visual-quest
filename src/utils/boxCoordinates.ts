import type { BoxCoordinates } from '../services/jev/types'

export type BoxPercentages = {
  left: number
  top: number
  width: number
  height: number
}

export function toBoxPercentages(
  box: BoxCoordinates,
  mirrored = false,
): BoxPercentages {
  const left = mirrored ? 1 - box.right : box.left
  const right = mirrored ? 1 - box.left : box.right

  return {
    left: left * 100,
    top: box.top * 100,
    width: (right - left) * 100,
    height: (box.bottom - box.top) * 100,
  }
}
