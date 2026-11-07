import type { ExpressionSpecification } from 'maplibre-gl'
import type { Level } from './types'

export const LEVEL_LABEL: Record<Level, string> = {
  quiet: 'Quiet', moderate: 'Moderate', busy: 'Busy', packed: 'Packed',
}

// Same scale the map uses: 0 green -> 50 amber -> 100 red
const STOPS = [[47, 158, 106], [224, 165, 38], [217, 71, 43]]
export function heatColor(score: number) {
  const t = Math.max(0, Math.min(100, score)) / 100
  const [a, b, u] = t < 0.5 ? [STOPS[0], STOPS[1], t / 0.5] : [STOPS[1], STOPS[2], (t - 0.5) / 0.5]
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// MapLibre expression version of heatColor
export const HEAT_EXPR: ExpressionSpecification = [
  'interpolate', ['linear'], ['coalesce', ['get', 'score'], 0],
  0, '#2f9e6a', 50, '#e0a526', 100, '#d9472b',
]
