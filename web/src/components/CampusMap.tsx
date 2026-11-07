import { useEffect, useMemo, useRef } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre'
import type { StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { bbox, centroidsById, type Buildings } from '../lib/geo'
import { HEAT_EXPR, heatColor } from '../lib/colors'
import { CAMPUS_CENTER } from '../lib/spaces'

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

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: CAMPUS_CENTER[0], latitude: CAMPUS_CENTER[1], zoom: 16 }}
      mapStyle={satelliteStyle}
      maxPitch={70}
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
        return (
          <Marker key={id} longitude={c[0]} latitude={c[1]} anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); onSelect(id) }}>
            <button
              type="button"
              className={`glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg transition hover:scale-105 ${selectedId === id ? 'ring-2 ring-white' : ''}`}
              title={f.properties.approx ? 'Approximate location: no outline found in OpenStreetMap' : f.properties.osmName}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: heatColor(s) }} />
              {f.properties.name}
              <span className="tabular-nums opacity-70">{s}</span>
            </button>
          </Marker>
        )
      })}
    </Map>
  )
}
