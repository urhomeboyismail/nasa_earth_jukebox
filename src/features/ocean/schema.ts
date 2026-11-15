// EIC06 T4: the ECCO2 "ocean tracks" (public/data/json_output/, made by scripts/ecco2_extract.py and ecco2_narrate.py).
// They sit beside the manifest data sets and are checked here, not by src/data/schema.ts.

import { z } from 'zod'

const unit = z.number().min(0).max(1)
const range = z.tuple([z.number().positive(), z.number().positive()]).refine(([lo, hi]) => lo < hi, 'must go from low to high')

export const indexSchema = z.object({
  datasets: z.array(z.object({
    dataset_id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string(),
    category: z.string(),
    theme_color: z.string(),
    duration_sec: z.number().positive(),
    date_range: z.string(),
    poster_url: z.string().min(1).optional(),
    data_url: z.string().min(1),
    what_you_will_try: z.string(),
  })).min(1),
})

const metrics = z.object({
  sst_celsius_mean: z.number(),
  sst_celsius_min: z.number(),
  sst_celsius_max: z.number(),
  sst_normalized: unit,
  current_velocity_norm: unit,
  eddy_vorticity_norm: unit,
  thermal_anomaly: z.number().min(-1).max(1),
  intensity_marker: unit,
})

/**
 * `[sst_norm, velocity_norm]`, or null where the cell has no ocean. A track made of numbers may add a third value, the direction of
 * the flow as a turn (0 to 1, where the wind blows from, over 360), and the stage draws it as streaks.
 */
const cell = z.tuple([unit, unit]).rest(unit).nullable()

export const trackSchema = z.object({
  dataset_id: z.string().min(1),
  metadata: z.object({
    title: z.string().min(1),
    source: z.string(),
    category: z.string().optional(),
    date_start: z.string(),
    date_end: z.string(),
    what_you_will_try: z.string(),
  }),
  // A track with no video_url is drawn from its numbers (CanvasGridVisualizer) and timed by a clock instead of the video.
  visual_assets: z.object({
    video_url: z.string().min(1).optional(),
    poster_url: z.string().min(1).optional(),
    aspect_ratio: z.string().regex(/^\d+:\d+$/),
  }),
  calibration: z.object({
    temp_min_c: z.number(),
    temp_max_c: z.number(),
    filter_cutoff_hz: range,
    pitch_range_hz: range,
  }),
  timeline: z.array(z.object({
    step: z.number().int().min(0),
    time_sec: z.number().min(0),
    iso_date: z.string().min(1),
    display_date: z.string().min(1),
    metrics: metrics.nullable(),
    spatial_grid: z.array(z.array(cell).min(1)).min(1).nullable(),
    accessibility_text: z.string().min(1),
    echo_callout: z.string().nullable(),
  })).min(1),
})

export type OceanIndex = z.infer<typeof indexSchema>
export type OceanIndexEntry = OceanIndex['datasets'][number]
export type OceanTrack = z.infer<typeof trackSchema>
export type OceanStep = OceanTrack['timeline'][number]
export type OceanMetrics = NonNullable<OceanStep['metrics']>
export type OceanCalibration = OceanTrack['calibration']
export type GridCell = z.infer<typeof cell>

/** The files' URLs start with "/"; the app may be served from a sub-path. */
export const assetUrl = (url: string) => `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`

async function fetchChecked<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(assetUrl(url))
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) throw new Error(`${url}: ${parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; ')}`)
  return parsed.data
}

export const INDEX_URL = '/data/json_output/index.json'
export const loadOceanIndex = () => fetchChecked(INDEX_URL, indexSchema)
export const loadOceanTrack = (dataUrl: string) => fetchChecked(dataUrl, trackSchema)
