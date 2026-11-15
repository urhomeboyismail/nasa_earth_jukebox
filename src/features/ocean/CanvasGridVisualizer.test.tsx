import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { CanvasGridVisualizer, ThermalScale } from './CanvasGridVisualizer'
import type { GridCell } from './schema'

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('../../motion', () => ({ reducedMotion: () => motion.reduced }))

const calibration = { temp_min_c: 0, temp_max_c: 32 }
// 20 °C everywhere (0.625 of 0 to 32), with a wind of speed 0.5.
const cell: GridCell = [0.625, 0.5, 0.875]
const grid: GridCell[][] = Array.from({ length: 8 }, () => Array.from({ length: 16 }, () => cell))
const label = 'Mauritius Weather, a map of temperature.'

/** jsdom cannot draw: this records what the component asks a 2D canvas to do. */
function fakeContext() {
  return {
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    lineCap: '',
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
  }
}

let ctx: ReturnType<typeof fakeContext>
let frames: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  motion.reduced = false
  ctx = fakeContext()
  // The fake has only the methods the component calls, so it is not a whole CanvasRenderingContext2D.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as CanvasRenderingContext2D)
  // A frame is requested but never run, so a test sees what is asked for without a loop going.
  frames = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('CanvasGridVisualizer', () => {
  it('is a labelled picture, and passes the accessibility check', async () => {
    const { container } = render(<CanvasGridVisualizer grid={grid} calibration={calibration} playing={false} label={label} />)
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('paints the grid as a thermal map: a 20 °C cell is green', () => {
    render(<CanvasGridVisualizer grid={grid} calibration={calibration} playing={false} label={label} />)
    const image = ctx.createImageData.mock.results[0].value
    expect(ctx.putImageData).toHaveBeenCalled()
    expect([...image.data.slice(0, 4)]).toEqual([46, 170, 70, 255])
    expect(ctx.drawImage).toHaveBeenCalled()
  })

  it('shows the wind as still ticks, and asks for no animation frame, while not playing', () => {
    render(<CanvasGridVisualizer grid={grid} calibration={calibration} playing={false} label={label} />)
    expect(ctx.stroke).toHaveBeenCalledTimes(4 * 8 * 2) // a tick for every other cell, a dark line under a light one
    expect(ctx.arc).toHaveBeenCalledTimes(4 * 8 * 2) // and a dot at its head, so the way the air goes can be read
    expect(frames).not.toHaveBeenCalled()
  })

  it('drifts streaks on animation frames while playing, and stops when taken down', () => {
    const { unmount } = render(<CanvasGridVisualizer grid={grid} calibration={calibration} playing label={label} />)
    expect(frames).toHaveBeenCalled()
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('never animates under reduced motion, even while playing, and still shows the ticks', () => {
    motion.reduced = true
    render(<CanvasGridVisualizer grid={grid} calibration={calibration} playing label={label} />)
    expect(frames).not.toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('eases towards the next step by `mix`', () => {
    const warmer: GridCell[][] = grid.map(row => row.map((): GridCell => [0.9375, 0.5, 0.875])) // 30 °C
    render(<CanvasGridVisualizer grid={grid} next={warmer} mix={0.5} calibration={calibration} playing={false} label={label} />)
    const [r, g] = [...ctx.createImageData.mock.results[0].value.data.slice(0, 2)]
    expect([r, g]).not.toEqual([46, 170]) // no longer the 20 °C green
  })

  it('draws nothing, and does not fail, with no grid or no drawing context', () => {
    render(<CanvasGridVisualizer grid={null} calibration={calibration} playing={false} label={label} />)
    expect(ctx.putImageData).not.toHaveBeenCalled()
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => null)
    expect(() => render(<CanvasGridVisualizer grid={grid} calibration={calibration} playing label={label} />)).not.toThrow()
  })
})

describe('ThermalScale', () => {
  it('names the three anchor temperatures', () => {
    render(<ThermalScale />)
    expect(screen.getByText('0 °C')).toBeInTheDocument()
    expect(screen.getByText('20 °C')).toBeInTheDocument()
    expect(screen.getByText('32 °C and above')).toBeInTheDocument()
  })
})
