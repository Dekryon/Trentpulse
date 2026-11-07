import type { Feature, FeatureCollection, Polygon, Position } from 'geojson'
import { CAMPUS_CENTER, SPACES } from './spaces'

export type BuildingProps = { id: string; name: string; osmName?: string; approx?: boolean }
export type Buildings = FeatureCollection<Polygon, BuildingProps>

// 1. Try the saved file (public/buildings.json, made by `npm run fetch:buildings`).
// 2. Otherwise ask OpenStreetMap (Overpass API) live from the browser.
// 3. Otherwise draw small squares at approximate spots so the app still works.
export async function loadBuildings(): Promise<Buildings> {
  try {
    const r = await fetch('/buildings.json')
    if (r.ok) {
      const fc = (await r.json()) as Buildings
      if (fc.features?.length) return fillMissing(fc)
    }
  } catch { /* fall through */ }

  try {
    const fc = await fetchFromOverpass()
    if (fc.features.length) return fillMissing(fc)
  } catch { /* fall through */ }

  return fillMissing({ type: 'FeatureCollection', features: [] })
}

export const OVERPASS_QUERY = `[out:json][timeout:25];
(
  way["building"](around:1100,${CAMPUS_CENTER[1]},${CAMPUS_CENTER[0]});
  relation["building"](around:1100,${CAMPUS_CENTER[1]},${CAMPUS_CENTER[0]});
);
out geom;`

type OsmEl = {
  type: 'way' | 'relation'
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
  members?: { role: string; geometry?: { lat: number; lon: number }[] }[]
}

export async function fetchFromOverpass(): Promise<Buildings> {
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!r.ok) throw new Error('Overpass ' + r.status)
  const json = (await r.json()) as { elements: OsmEl[] }
  return osmToBuildings(json.elements)
}

export function osmToBuildings(elements: OsmEl[]): Buildings {
  const features: Feature<Polygon, BuildingProps>[] = []
  for (const el of elements) {
    const name = el.tags?.name
    if (!name) continue
    const space = SPACES.find((s) => s.match.test(name))
    if (!space) continue
    let ring: Position[] | undefined
    if (el.type === 'way' && el.geometry) ring = el.geometry.map((p) => [p.lon, p.lat])
    if (el.type === 'relation') {
      const outer = el.members?.find((m) => m.role === 'outer' && m.geometry)
      ring = outer?.geometry?.map((p) => [p.lon, p.lat])
    }
    if (!ring || ring.length < 4) continue
    features.push({
      type: 'Feature',
      properties: { id: space.id, name: space.name, osmName: name },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
  }
  return { type: 'FeatureCollection', features }
}

function square([lng, lat]: [number, number], meters = 35): Position[] {
  const dLat = meters / 111_320
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180))
  return [
    [lng - dLng, lat - dLat], [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat],
  ]
}

// Any space with no real outline gets a placeholder square (marked approx).
function fillMissing(fc: Buildings): Buildings {
  const have = new Set(fc.features.map((f) => f.properties.id))
  const extra = SPACES.filter((s) => !have.has(s.id)).map<Feature<Polygon, BuildingProps>>((s) => ({
    type: 'Feature',
    properties: { id: s.id, name: s.name, approx: true },
    geometry: { type: 'Polygon', coordinates: [square(s.approx)] },
  }))
  return { type: 'FeatureCollection', features: [...fc.features, ...extra] }
}

// Centre of a building (average of its outline points) for labels and the glow layer.
export function centroid(f: Feature<Polygon>): [number, number] {
  const ring = f.geometry.coordinates[0]
  let x = 0, y = 0
  const n = ring.length - 1
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1] }
  return [x / n, y / n]
}

export function centroidsById(fc: Buildings): Record<string, [number, number]> {
  const groups: Record<string, [number, number][]> = {}
  for (const f of fc.features) (groups[f.properties.id] ??= []).push(centroid(f))
  const out: Record<string, [number, number]> = {}
  for (const [id, pts] of Object.entries(groups)) {
    out[id] = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
  }
  return out
}

export function bbox(fc: Buildings): [[number, number], [number, number]] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  for (const f of fc.features) for (const [x, y] of f.geometry.coordinates[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return [[minX, minY], [maxX, maxY]]
}

export function metersBetween(a: [number, number], b: [number, number]): number {
  const R = 6_371_000, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
