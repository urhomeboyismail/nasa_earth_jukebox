// The Home page's moving globe: the "whimsical world" planet from Orbit Delivery Hero (public/planet/) wandering by itself, while Echo
// (the real robot model, public/robot/echo-model.js) walks to stay on top of it and turns to wave when it rests. Drag pulls the planet
// (orbitMotion.ts). Decoration only: the page says everything in words. All files come from our own site.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { z } from 'zod'
import { clamp, createPlanetMotion, damp, dragPlanet, poseAt, smoothstep, stepPlanet, turn } from './orbitMotion'

/** The planet's radius in scene units (its model is a unit sphere), Echo's height on it, and the ground one stride covers. */
const R = 2.25
const ECHO_HEIGHT = 0.62
/** Echo's model is about this many of its own units tall (robot-companion.js measures it in px from a drawing). */
const ECHO_MODEL_HEIGHT = 535
const STRIDE = 0.44

const surfaceSchema = z
  .object({ width: z.number().int().positive(), height: z.number().int().min(2), radii: z.array(z.number().positive()) })
  .refine(s => s.radii.length === s.width * s.height, 'radii must have width × height values')
export type Surface = z.infer<typeof surfaceSchema>

/** The planet's ground height (as a fraction of its radius) under the unit direction (x, y, z), from its height map. */
export function surfaceRadius(s: Surface, x: number, y: number, z: number): number {
  const u = ((((Math.atan2(x, z) / (2 * Math.PI)) % 1) + 1) % 1) * s.width
  const v = (Math.acos(clamp(y, -1, 1)) / Math.PI) * (s.height - 1)
  const x0 = Math.floor(u) % s.width
  const x1 = (x0 + 1) % s.width
  const y0 = Math.floor(v)
  const y1 = Math.min(y0 + 1, s.height - 1)
  const tx = u - Math.floor(u)
  const ty = v - y0
  const at = (col: number, row: number) => s.radii[row * s.width + col]
  const a = at(x0, y0) * (1 - tx) + at(x1, y0) * tx
  const b = at(x0, y1) * (1 - tx) + at(x1, y1) * tx
  return a * (1 - ty) + b * ty
}

/** The parts of Echo's rig this scene moves (see public/robot/echo-model.js). */
type EchoRig = {
  root: THREE.Group
  head: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  faces: { L: Record<string, THREE.Mesh>; R: Record<string, THREE.Mesh> }
}
type EchoModel = { buildRobot: (three: typeof THREE) => EchoRig }

// Full URLs: Vite's dev server refuses a root-relative import of a public/ file.
const publicUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, location.href).href

async function fetchOk(path: string): Promise<Response> {
  const response = await fetch(publicUrl(path))
  if (!response.ok) throw new Error(`${path} could not load (${response.status})`)
  return response
}

async function loadPlanet() {
  const [buffer, surface] = await Promise.all([
    fetchOk('planet/whimsical-world.glb').then(r => r.arrayBuffer()),
    fetchOk('planet/surface.json').then(r => r.json()).then(json => surfaceSchema.parse(json)),
  ])
  const gltf = await new GLTFLoader().parseAsync(buffer, publicUrl('planet/'))
  // The component's own material settings: matte, softer bumps.
  gltf.scene.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const materials: unknown[] = Array.isArray(node.material) ? node.material : [node.material]
    for (const mat of materials) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue
      mat.side = THREE.FrontSide
      mat.metalness = 0
      mat.roughness = 0.86
      mat.normalScale.setScalar(0.65)
      if (mat.map) mat.map.anisotropy = 4
    }
  })
  return { planet: gltf.scene, surface }
}

/** Starts the scene in `canvas` and returns a function that stops it and frees the GPU. Throws when WebGL or a file is missing. */
export async function startOrbit(canvas: HTMLCanvasElement): Promise<() => void> {
  const [{ planet, surface }, model] = await Promise.all([
    loadPlanet(),
    import(/* @vite-ignore */ publicUrl('robot/echo-model.js')).then((m: EchoModel) => m),
  ])
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 3.1, 5.3)
  camera.lookAt(0, 2.2, 0)

  // The component's lights: warm from the front left, cool from behind.
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  scene.add(new THREE.HemisphereLight(0xf1f5ff, 0x8aabc5, 1.4))
  const key = new THREE.DirectionalLight(0xfff8f1, 2.6)
  key.position.set(-3, 5, 5)
  const rim = new THREE.DirectionalLight(0xc5deff, 1.8)
  rim.position.set(3, 2, -2)
  scene.add(key, rim)

  planet.scale.setScalar(R)
  scene.add(planet)
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.5, 0))

  // carrier: on the ground, upright to it > facing: the way Echo goes > hover: bob and lean > Echo's own rig.
  const rig = model.buildRobot(THREE)
  const carrier = new THREE.Group()
  const facing = new THREE.Group()
  const hover = new THREE.Group()
  rig.root.scale.setScalar(ECHO_HEIGHT / ECHO_MODEL_HEIGHT)
  hover.add(rig.root)
  facing.add(hover)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 32),
    new THREE.MeshBasicMaterial({ color: 0x0b1530, transparent: true, opacity: 0.28, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.005
  carrier.add(facing, shadow)
  scene.add(carrier)

  const m = createPlanetMotion()
  let pointer: { id: number; x: number; y: number } | null = null
  const down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return
    canvas.setPointerCapture(e.pointerId)
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }
    m.rollTarget = m.roll
    m.pitchTarget = m.pitch
    m.dragging = true
    m.lastInteraction = m.time
  }
  const move = (e: PointerEvent) => {
    if (pointer?.id !== e.pointerId) return
    dragPlanet(m, e.clientX - pointer.x, e.clientY - pointer.y, canvas.clientWidth)
    pointer.x = e.clientX
    pointer.y = e.clientY
  }
  const up = (e: PointerEvent) => {
    if (pointer?.id !== e.pointerId) return
    pointer = null
    m.dragging = false
    m.lastInteraction = m.time
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)

  const fit = () => {
    const { clientWidth: w, clientHeight: h } = canvas
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const resize = new ResizeObserver(fit)
  resize.observe(canvas)
  fit()

  // Echo's place on the planet, as a point on the unit sphere in the planet's own frame, and how it is moving there.
  const ground = { current: new THREE.Vector3(), target: new THREE.Vector3(), velocity: new THREE.Vector3(), error: new THREE.Vector3() }
  const UP = new THREE.Vector3(0, 1, 0)
  const screenUp = UP.clone().applyQuaternion(camera.quaternion)
  const spinAxis = new THREE.Vector3()
  const spinStep = new THREE.Quaternion()
  const inverse = new THREE.Quaternion()
  const toLocal = new THREE.Quaternion()
  const look = new THREE.Vector3()
  ground.current.copy(screenUp).applyQuaternion(inverse.copy(orientation).invert()).normalize()
  let height = surfaceRadius(surface, ground.current.x, ground.current.y, ground.current.z) * R
  let activity = 0
  let phase = 0
  let heading = 0
  let wave = 0

  /** One small step: the planet turns, and Echo walks (on a spring) for the point at the top of the planet as the camera sees it. */
  const step = (dt: number) => {
    const [x, y, z] = stepPlanet(m, dt, still)
    const speed = spinAxis.set(x, y, z).length()
    if (speed > 1e-8) orientation.premultiply(spinStep.setFromAxisAngle(spinAxis.divideScalar(speed), speed * dt)).normalize()

    const g = ground
    g.target.copy(screenUp).applyQuaternion(inverse.copy(orientation).invert()).normalize()
    const cosine = clamp(g.current.dot(g.target), -1, 1)
    g.error.copy(g.target).addScaledVector(g.current, -cosine)
    if (g.error.lengthSq() > 1e-12) g.error.normalize().multiplyScalar(Math.acos(cosine))
    const stiffness = still ? 110 : 48
    const damping = still ? 21 : 11
    g.velocity.addScaledVector(g.error, stiffness * dt).multiplyScalar(Math.exp(-damping * dt))
    g.velocity.addScaledVector(g.current, -g.velocity.dot(g.current))
    g.current.addScaledVector(g.velocity, dt).normalize()
    g.velocity.addScaledVector(g.current, -g.velocity.dot(g.current))
    const pace = g.velocity.length()
    activity = damp(activity, smoothstep(pace, 4e-3, 0.022), 9, dt)
    phase += ((pace * R) / STRIDE) * Math.PI * 2 * dt
  }

  let frame = 0
  const start = performance.now()
  let prev = start
  const tick = (now: number) => {
    const elapsed = Math.min(0.05, (now - prev) / 1000)
    prev = now
    const count = Math.max(1, Math.ceil(elapsed / (1 / 120)))
    for (let i = 0; i < count; i++) step(elapsed / count)
    planet.quaternion.copy(orientation)

    // On the ground under it (hills and all), upright to it.
    const g = ground.current
    height = damp(height, surfaceRadius(surface, g.x, g.y, g.z) * R + 0.008, 25, elapsed)
    look.copy(g).applyQuaternion(orientation)
    carrier.position.copy(look).multiplyScalar(height)
    carrier.quaternion.setFromUnitVectors(UP, look)
    toLocal.copy(carrier.quaternion).invert()

    // Facing the way it walks; once it has stopped, it turns to the viewer and waves.
    const greeting = !m.dragging && activity < 0.06
    let target = heading
    if (greeting) {
      look.copy(camera.position).sub(carrier.position).applyQuaternion(toLocal)
      target = Math.atan2(look.x, look.z)
    } else if (ground.velocity.lengthSq() > 1e-4) {
      look.copy(ground.velocity).applyQuaternion(orientation).applyQuaternion(toLocal)
      target = Math.atan2(look.x, look.z)
    }
    heading += turn(heading, target) * (1 - Math.exp(-(still ? 20 : 8) * elapsed))
    wave = damp(wave, greeting && Math.abs(turn(heading, target)) < 0.3 ? 1 : 0, 5, elapsed)

    const t = still ? 0 : (now - start) / 1000
    const p = poseAt(t, phase, activity * (1 - wave), wave)
    facing.rotation.y = heading
    hover.position.y = p.lift
    hover.rotation.x = p.lean
    rig.head.rotation.x = p.headX
    // robot-companion.js turns the arms as (x, 0, -z) for the left and (x, 0, z) for the right: z raises an arm, x swings it.
    rig.armL.rotation.set(p.lx, 0, -p.lz)
    rig.armR.rotation.set(p.rx, 0, p.rz)
    // Happy eyes while it waves.
    const happy = wave > 0.5
    for (const eye of [rig.faces.L, rig.faces.R]) {
      eye.dome.visible = !happy
      eye.arc.visible = happy
    }
    shadow.scale.setScalar(1 - p.lift * 4)

    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(frame)
    resize.disconnect()
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.geometry.dispose()
      const materials: unknown[] = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of materials) {
        if (!(mat instanceof THREE.Material)) continue
        for (const value of Object.values(mat)) if (value instanceof THREE.Texture) value.dispose()
        mat.dispose()
      }
    })
    renderer.dispose()
  }
}
