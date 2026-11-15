// The moving globe on Home: Echo running on a small spinning Earth (src/features/home/orbitScene.ts). It is a picture only, hidden
// from screen readers; where WebGL or the script is missing it simply stays empty.
import { useEffect, useRef } from 'react'
import type { OrbitVoice } from './orbitScene'

/** `talking`: Echo's voice is speaking, so its mouth moves. */
export default function OrbitGlobe({ talking = false }: { talking?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const voice = useRef<OrbitVoice>({ talking })
  useEffect(() => { voice.current.talking = talking }, [talking])

  useEffect(() => {
    const el = canvas.current
    // No WebGL (old browsers, tests): skip fetching three.js at all.
    if (!el || typeof WebGLRenderingContext === 'undefined') return
    let live = true
    let stop: (() => void) | undefined
    import('./orbitScene')
      .then(scene => scene.startOrbit(el, voice.current))
      .then(end => { if (live) stop = end; else end() })
      .catch(() => { /* No WebGL: the page reads the same without the picture. */ })
    return () => {
      live = false
      stop?.()
    }
  }, [])

  return <canvas ref={canvas} className="orbit-globe" aria-hidden="true" />
}
