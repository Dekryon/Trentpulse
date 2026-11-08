import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import type { StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { bbox, centroidsById, type Buildings } from '../lib/geo'
import { HEAT_EXPR, heatColor } from '../lib/colors'
import { CAMPUS_CENTER, SPACE_BY_ID } from '../lib/spaces'

// When labels would overlap, the less important ones shrink to a dot.
// Places students sit in come first; lecture halls give way first.
const LABEL_PRIORITY: Record<string, number> = { study: 0, social: 1, college: 2, gym: 3, lecture: 4 }
// Two label sizes. Widths are measured from the real text; the extra covers
// padding, the colour dot, gaps and a little breathing room.
const FULL = { font: '600 11px "IBM Plex Sans", ui-sans-serif, sans-serif', extra: 44, height: 30 }
const SMALL = { font: '600 9.5px "IBM Plex Sans", ui-sans-serif, sans-serif', extra: 24, height: 22 }
type LabelPlace = { size: 'full' | 'small'; dx: number; dy: number } // shift in px: dx left (-) or right (+), dy up (-) or down (+)

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

// Satellite base map. MapTiler if you add a key, otherwise free Esri imagery.
// Both need the attribution text, which MapLibre shows bottom right.
const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    sat: MAPTILER_KEY
      ? {
          type: 'raster',
          tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`],
          tileSize: 256,
          maxzoom: 20,
          attribution: '© MapTiler © OpenStreetMap contributors',
        }
      : {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics · Buildings © OpenStreetMap contributors',
        },
  },
  layers: [{ id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25, 'raster-brightness-max': 0.85 } }],
}

interface Props {
  buildings: Buildings
  scores: Record<string, number>
  selectedId: string | null
  is3D: boolean
  onSelect: (id: string | null) => void
}

export function CampusMap({ buildings, scores, selectedId, is3D, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null)
  const centers = useMemo(() => centroidsById(buildings), [buildings])

  // Keep the map on campus: panning stops about 1 km beyond the outermost
  // buildings, so nobody can drag or zoom their way out to the rest of the world.
  const campusLimits = useMemo<[number, number, number, number]>(() => {
    const [[w, s], [e, n]] = bbox(buildings)
    const padLng = 0.013, padLat = 0.009 // roughly 1 km at Trent's latitude
    return [w - padLng, s - padLat, e + padLng, n + padLat] // west, south, east, north
  }, [buildings])

  // Put the live score on every building so the map can colour it
  const data = useMemo<Buildings>(() => ({
    ...buildings,
    features: buildings.features.map((f) => ({ ...f, properties: { ...f.properties, score: scores[f.properties.id] ?? 0 } })),
  }), [buildings, scores])

  // One point per building for the soft heat glow
  const glow = useMemo<FeatureCollection<Point, { score: number }>>(() => ({
    type: 'FeatureCollection',
    features: Object.entries(centers).map(([id, c]) => ({
      type: 'Feature', properties: { score: scores[id] ?? 0 }, geometry: { type: 'Point', coordinates: c },
    })),
  }), [centers, scores])

  // Zoom to fit campus once the outlines are loaded
  useEffect(() => {
    const map = mapRef.current
    if (!map || !buildings.features.length) return
    map.fitBounds(bbox(buildings), { padding: { top: 120, bottom: 140, left: 40, right: 40 }, duration: 0, maxZoom: 17 })
  }, [buildings])

  // Tilt into 3D and back
  useEffect(() => {
    mapRef.current?.easeTo({ pitch: is3D ? 60 : 0, bearing: is3D ? -25 : 0, duration: 900 })
  }, [is3D])

  const vis = (show: boolean) => ({ visibility: show ? 'visible' : 'none' }) as const

  // Label decluttering, done the way paper maps do it. After every move, place
  // labels one by one (selected building first, places to sit before lecture
  // halls). Each label tries, in order: full size at the building; smaller and
  // name-only at the building; then smaller just above, below, right, left. If none
  // fits it stays small at the building, so every building always shows its name.
  const [places, setPlaces] = useState<Record<string, LabelPlace>>({})
  const textWidth = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    return (text: string, font: string) => {
      if (!ctx) return text.length * 6.5
      ctx.font = font
      return ctx.measureText(text).width
    }
  }, [])
  const declutter = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const order = Object.keys(centers).sort((a, b) =>
      (a === selectedId ? -1 : 0) - (b === selectedId ? -1 : 0) ||
      (LABEL_PRIORITY[SPACE_BY_ID[a]?.type] ?? 9) - (LABEL_PRIORITY[SPACE_BY_ID[b]?.type] ?? 9))
    type Box = { x1: number; y1: number; x2: number; y2: number }
    // One placement pass. `allowFull` false means every label except the selected
    // one is small, which frees room when the wide labels crowd everything else.
    const run = (allowFull: boolean) => {
      const placed: Box[] = []
      const overlaps = (box: Box) => placed.some((b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2))
      const result: Record<string, LabelPlace> = {}
      let clean = true
      for (const id of order) {
        const p = map.project(centers[id])
        const name = buildings.features.find((x) => x.properties.id === id)?.properties.name ?? id
        const fullW = textWidth(name, FULL.font) + textWidth(String(scores[id] ?? 0), FULL.font) + FULL.extra
        const smallW = textWidth(name, SMALL.font) + SMALL.extra
        const step = SMALL.height + 2
        const side = smallW / 2 + 8
        const full: LabelPlace & { w: number; h: number } = { size: 'full', dx: 0, dy: 0, w: fullW, h: FULL.height }
        const smalls: (LabelPlace & { w: number; h: number })[] = [
          { size: 'small', dx: 0, dy: 0, w: smallW, h: SMALL.height },
          { size: 'small', dx: 0, dy: -step, w: smallW, h: SMALL.height },
          { size: 'small', dx: 0, dy: step, w: smallW, h: SMALL.height },
          { size: 'small', dx: side, dy: 0, w: smallW, h: SMALL.height },
          { size: 'small', dx: -side, dy: 0, w: smallW, h: SMALL.height },
        ]
        const options = allowFull ? [full, ...smalls] : smalls
        const boxOf = (o: LabelPlace & { w: number; h: number }) =>
          ({ x1: p.x + o.dx - o.w / 2, x2: p.x + o.dx + o.w / 2, y1: p.y + o.dy - o.h / 2, y2: p.y + o.dy + o.h / 2 })
        let fit = id === selectedId ? full : options.find((o) => !overlaps(boxOf(o)))
        if (!fit) { fit = smalls[0]; clean = false }
        placed.push(boxOf(fit))
        result[id] = { size: fit.size, dx: fit.dx, dy: fit.dy }
      }
      return { result, clean }
    }
    // Prefer full labels; if that leaves any label without a free spot, go all-small.
    const first = run(true)
    const next = first.clean ? first.result : run(false).result
    setPlaces((prev) => {
      const same = Object.keys(next).length === Object.keys(prev).length &&
        Object.entries(next).every(([k, v]) => prev[k]?.size === v.size && prev[k]?.dx === v.dx && prev[k]?.dy === v.dy)
      return same ? prev : next
    })
  }, [centers, selectedId, buildings, scores, textWidth])
  useEffect(() => { declutter() }, [declutter])

  // The imagery and OpenStreetMap credits must stay reachable, but not cover the app.
  // Compact mode shows a small "i" button. MapLibre expands it (class
  // maplibregl-compact-show) once the credit text arrives, which can be after the
  // first render. So on each "idle", wait until that class exists, remove it once
  // (exactly what MapLibre itself does when you drag the map), then stop, so a
  // viewer who taps "i" later keeps it open.
  const creditsCollapsed = useRef(false)
  function collapseCredits() {
    if (creditsCollapsed.current) return
    const el = mapRef.current?.getContainer().querySelector('.maplibregl-ctrl-attrib.maplibregl-compact')
    if (!el) return
    el.classList.remove('maplibregl-compact-show')
    creditsCollapsed.current = true
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: CAMPUS_CENTER[0], latitude: CAMPUS_CENTER[1], zoom: 16 }}
      mapStyle={satelliteStyle}
      attributionControl={{ compact: true }}
      onSourceData={collapseCredits}
      onIdle={collapseCredits}
      onLoad={declutter}
      onMove={declutter}
      maxPitch={70}
      maxBounds={campusLimits}
      minZoom={14}   // whole campus and its surroundings, no further out
      maxZoom={19}   // the sharpest satellite detail available
      interactiveLayerIds={['bld-fill', 'bld-3d']}
      onClick={(e) => onSelect((e.features?.[0]?.properties?.id as string | undefined) ?? null)}
      cursor="pointer"
      style={{ position: 'absolute', inset: 0 }}
    >
      <NavigationControl position="top-right" visualizePitch />

      <Source id="glow" type="geojson" data={glow}>
        <Layer
          id="glow-heat"
          type="heatmap"
          layout={vis(!is3D)}
          paint={{
            'heatmap-weight': ['/', ['get', 'score'], 100],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 14, 30, 18, 140],
            'heatmap-intensity': 0.9,
            'heatmap-opacity': 0.55,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)', 0.25, 'rgba(47,158,106,0.55)', 0.55, 'rgba(224,165,38,0.65)', 0.85, 'rgba(217,71,43,0.8)',
            ],
          }}
        />
      </Source>

      <Source id="bld" type="geojson" data={data}>
        <Layer id="bld-fill" type="fill" layout={vis(!is3D)} paint={{ 'fill-color': HEAT_EXPR, 'fill-opacity': 0.62 }} />
        <Layer id="bld-line" type="line" layout={vis(!is3D)} paint={{ 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 1 }} />
        <Layer
          id="bld-3d"
          type="fill-extrusion"
          layout={vis(is3D)}
          paint={{
            'fill-extrusion-color': HEAT_EXPR,
            'fill-extrusion-height': ['+', 6, ['*', ['coalesce', ['get', 'score'], 0], 0.9]],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
          }}
        />
        <Layer
          id="bld-selected"
          type="line"
          filter={['==', ['get', 'id'], selectedId ?? '']}
          paint={{ 'line-color': '#ffffff', 'line-width': 3, 'line-dasharray': [2, 1.5] }}
        />
      </Source>

      {/* Name + score labels */}
      {Object.entries(centers).map(([id, c]) => {
        const f = buildings.features.find((x) => x.properties.id === id)!
        const s = scores[id] ?? 0
        const place = places[id] ?? { size: 'full', dx: 0, dy: 0 }
        const small = place.size === 'small'
        return (
          <Marker key={id} longitude={c[0]} latitude={c[1]} anchor="center" offset={[place.dx, place.dy]}
            onClick={(e) => { e.originalEvent.stopPropagation(); onSelect(id) }}>
            <button
              type="button"
              aria-label={`${f.properties.name}, score ${s}`}
              className={`glass flex items-center rounded-full font-semibold text-white shadow-lg transition hover:scale-105 ${small ? 'gap-1 px-1.5 py-0.5 text-[9.5px]' : 'gap-1.5 px-2.5 py-1 text-[11px]'} ${selectedId === id ? 'ring-2 ring-white' : ''}`}
              title={f.properties.approx ? 'Approximate location: no outline found in OpenStreetMap' : f.properties.osmName}
            >
              <span aria-hidden="true" className={`inline-block rounded-full ${small ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} style={{ background: heatColor(s) }} />
              {f.properties.name}
              {!small && <span className="tabular-nums opacity-70">{s}</span>}
            </button>
          </Marker>
        )
      })}
    </Map>
  )
}
