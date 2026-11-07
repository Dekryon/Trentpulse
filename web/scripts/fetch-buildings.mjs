// Downloads Trent building outlines from OpenStreetMap once and saves them to
// public/buildings.json, so the demo never depends on a live map API.
// Run: npm run fetch:buildings
import { writeFileSync } from 'node:fs'

const CENTER = [-78.2905, 44.3575] // keep in sync with src/lib/spaces.ts
const SPACES = [
  ['bata', 'Bata Library', /bata/i],
  ['sc', 'Student Centre', /student cent/i],
  ['ath', 'Athletics Centre', /athletic/i],
  ['cc', 'Champlain College', /champlain/i],
  ['lec', 'Lady Eaton College', /lady eaton/i],
  ['sci', 'Science Complex', /science complex|chemical sci|environmental sci/i],
  ['dna', 'DNA Building', /life (and|&) health|\bdna\b/i],
  ['gz', 'Gzowski College', /gzowski/i],
  ['oc', 'Otonabee College', /otonabee college/i],
]

const query = `[out:json][timeout:25];
(
  way["building"](around:1100,${CENTER[1]},${CENTER[0]});
  relation["building"](around:1100,${CENTER[1]},${CENTER[0]});
);
out geom;`

// Overpass rejects requests without a User-Agent and Accept header (HTTP 406),
// so we send both, and fall back to a second server if the first one fails.
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
let res
for (const url of SERVERS) {
  res = await fetch(url, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'TrentPulse-hackathon/0.1 (HackTrent 2026)',
    },
  })
  if (res.ok) break
  console.warn(`Overpass ${url} returned ${res.status}, trying next server`)
}
if (!res.ok) throw new Error('Overpass error ' + res.status)
const { elements } = await res.json()

const features = []
const allNames = new Set()
for (const el of elements) {
  const name = el.tags?.name
  if (!name) continue
  allNames.add(name)
  const space = SPACES.find(([, , re]) => re.test(name))
  if (!space) continue
  let pts = el.type === 'way' ? el.geometry : el.members?.find((m) => m.role === 'outer' && m.geometry)?.geometry
  if (!pts || pts.length < 4) continue
  features.push({
    type: 'Feature',
    properties: { id: space[0], name: space[1], osmName: name },
    geometry: { type: 'Polygon', coordinates: [pts.map((p) => [p.lon, p.lat])] },
  })
}

writeFileSync('public/buildings.json', JSON.stringify({ type: 'FeatureCollection', features }, null, 1))
const found = new Set(features.map((f) => f.properties.id))
console.log(`Saved ${features.length} outlines to public/buildings.json`)
console.log('Found:', [...found].join(', ') || 'none')
const missing = SPACES.filter(([id]) => !found.has(id)).map(([, n]) => n)
if (missing.length) {
  console.log('Missing (the app will draw a placeholder square):', missing.join(', '))
  console.log('\nNamed buildings nearby, to help you fix the name patterns in spaces.ts and this script:')
  console.log([...allNames].sort().join('\n'))
}
