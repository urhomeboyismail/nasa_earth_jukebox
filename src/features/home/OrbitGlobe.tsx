// The moving globe on Home: Echo running on a small spinning Earth (src/features/home/orbitScene.ts). It is a picture only, hidden
// from screen readers; where WebGL or the script is missing it simply stays empty.
import { useEffect, useRef } from 'react'

export default function OrbitGlobe() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    // No WebGL (old browsers, tests): skip fetching three.js at all.
    if (!el || typeof WebGLRenderingContext === 'undefined') return
    let live = true
    let stop: (() => void) | undefined
    import('./orbitScene')
      .then(scene => scene.startOrbit(el))
      .then(end => { if (live) stop = end; else end() })
      .catch(() => { /* No WebGL: the page reads the same without the picture. */ })
    return () => {
      live = false
      stop?.()
    }
  }, [])

  return <canvas ref={canvas} className="orbit-globe" aria-hidden="true" />
}
