// Finds the tracked building nearest to a GPS position, entirely on the device.
// Nothing here is sent anywhere: the check-in still carries only the building and level.
import { SPACES } from './spaces'

// Further than this from every tracked building counts as off campus
export const OFF_CAMPUS_METERS = 600
// GPS fixes vaguer than this are only used to suggest a building, never to block
export const TRUSTED_ACCURACY_METERS = 500

function meters(a: [number, number], b: [number, number]) {
  const R = 6_371_000, r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 +
    Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function nearestSpace(lng: number, lat: number) {
  let best = { id: SPACES[0].id, name: SPACES[0].name, distance: Infinity }
  for (const s of SPACES) {
    const d = meters([lng, lat], s.approx)
    if (d < best.distance) best = { id: s.id, name: s.name, distance: d }
  }
  return best
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}
