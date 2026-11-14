// The Home page's moving globe: a small low-poly Earth that wanders by itself while Echo runs to stay on top of it, and stops to wave
// when the planet rests. Drag pulls the planet (orbitMotion.ts). Decoration only: the page says everything in words.
// three.js is the copy the robot already loads (public/robot/vendor), so the browser fetches it once for both.
import { ROBOT_THREE } from '../mascot/robot'
import { clamp, createPlanetMotion, damp, dragPlanet, poseAt, smoothstep, stepPlanet, turn } from './orbitMotion'

type Three = typeof import('three')
type Group = InstanceType<Three['Group']>

const R = 2
/** The robot's size on the planet, and the ground it covers in one stride (for the pace of its arms). */
const ECHO_SCALE = 1.5
const STRIDE = 0.44

/** A smooth, repeatable bumpiness over the unit sphere: above 0.15 is land. */
export function landHeight(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 2.1 + Math.sin(y * 2.7)) * Math.cos(z * 1.9 + Math.sin(x * 1.3)) +
    0.55 * Math.sin(y * 3.4 + z * 2.6) * Math.cos(x * 3.1 - y) +
    0.25 * Math.sin(x * 6.3 + z * 5.1)
  )
}

const isIce = (y: number) => Math.abs(y) > 0.86

function buildPlanet(THREE: Three): Group {
  const planet = new THREE.Group()
  const geo = new THREE.IcosahedronGeometry(R, 5).toNonIndexed()
  const pos = geo.getAttribute('position')
  const colours = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i += 3) {
    // One colour a face, from its middle, so the facets read as low-poly.
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / (3 * R)
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / (3 * R)
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / (3 * R)
    const h = landHeight(x, y, z)
    if (isIce(y)) c.set(0xeef6fb)
    else if (h > 0.75) c.set(0x3d8a46)
    else if (h > 0.15) c.set(0x5fbf5a)
    else if (h > 0) c.set(0x58b3e6)
    else c.set(0x2f7fd3)
    for (let k = 0; k < 3; k++) colours.set([c.r, c.g, c.b], (i + k) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3))
  planet.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 })))

  // Trees on the land, from a fixed seed so the planet looks the same on every visit.
  const treeGeo = new THREE.ConeGeometry(0.045, 0.14, 6).translate(0, 0.07, 0)
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2e6e35, flatShading: true })
  const up = new THREE.Vector3(0, 1, 0)
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let placed = 0, tries = 0; placed < 60 && tries < 2000; tries++) {
    const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
    if (landHeight(dir.x, dir.y, dir.z) < 0.3 || isIce(dir.y)) continue
    const tree = new THREE.Mesh(treeGeo, treeMat)
    tree.position.copy(dir).multiplyScalar(R * 0.995)
    tree.quaternion.setFromUnitVectors(up, dir)
    tree.scale.setScalar(0.7 + rand() * 0.6)
    planet.add(tree)
    placed++
  }

  // A thin glow of air around it.
  planet.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.06, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.35, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  ))
  return planet
}

function buildClouds(THREE: Three): Group {
  const clouds = new THREE.Group()
  const geo = new THREE.IcosahedronGeometry(0.11, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 })
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Group()
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(geo, mat)
      m.position.set((k - 1) * 0.12, k === 1 ? 0.04 : 0, 0)
      m.scale.setScalar(k === 1 ? 1.25 : 0.95)
      puff.add(m)
    }
    const lat = (((i * 53) % 120) - 60) * (Math.PI / 180)
    const lon = i * 0.9
    const dir = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
    puff.position.copy(dir).multiplyScalar(R + 0.42)
    puff.quaternion.setFromUnitVectors(up, dir)
    clouds.add(puff)
  }
  return clouds
}

type Rig = { root: Group; facing: Group; hover: Group; head: Group; armL: Group; armR: Group; shadow: InstanceType<Three['Mesh']> }

/** A small Echo in the robot's colours (public/robot/robot-companion.js): pearl shell, blue trim, dark visor, aqua eyes. It hovers, so no legs. */
function buildRobot(THREE: Three): Rig {
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf1f3f8, roughness: 0.3, clearcoat: 0.6 })
  const trim = new THREE.MeshPhysicalMaterial({ color: 0x1a168c, roughness: 0.34, metalness: 0.18, clearcoat: 0.5 })
  const visor = new THREE.MeshPhysicalMaterial({ color: 0x0b0a2c, emissive: 0x100c5c, emissiveIntensity: 0.55, roughness: 0.12, clearcoat: 1 })
  const glow = new THREE.MeshStandardMaterial({ color: 0xa5ecf3, emissive: 0x34cfe0, emissiveIntensity: 1.4 })

  // root sits on the ground, upright to it; facing turns it the way it runs; hover bobs.
  const root = new THREE.Group()
  const facing = new THREE.Group()
  const hover = new THREE.Group()
  root.add(facing)
  facing.add(hover)

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.1, 6, 16), shell)
  body.position.y = 0.2
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.018, 8, 32), trim)
  belt.rotation.x = Math.PI / 2
  belt.position.y = 0.17
  hover.add(body, belt)

  const head = new THREE.Group()
  head.position.y = 0.42
  hover.add(head)
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), shell))
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), visor)
  face.scale.set(1, 0.78, 0.62)
  face.position.z = 0.07
  head.add(face)
  for (const x of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), glow)
    eye.scale.set(1, 1.4, 0.5)
    eye.position.set(x, 0.01, 0.152)
    head.add(eye)
  }
  for (const x of [-0.15, 0.15]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), trim)
    ear.rotation.z = Math.PI / 2
    ear.position.x = x
    head.add(ear)
  }
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), trim)
  stalk.position.y = 0.18
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), glow)
  tip.position.y = 0.23
  head.add(stalk, tip)

  const arm = (x: number) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(x, 0.27, 0)
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.09, 4, 10), shell)
    limb.position.y = -0.07
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), trim)
    hand.position.y = -0.15
    shoulder.add(limb, hand)
    hover.add(shoulder)
    return shoulder
  }

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.01
  root.add(shadow)

  return { root, facing, hover, head, armL: arm(-0.155), armR: arm(0.155), shadow }
}

/** Starts the scene in `canvas` and returns a function that stops it and frees the GPU. Throws when WebGL is missing. */
export async function startOrbit(canvas: HTMLCanvasElement): Promise<() => void> {
  // A full URL: Vite's dev server refuses a root-relative import of a public/ file.
  const THREE: Three = await import(/* @vite-ignore */ new URL(ROBOT_THREE, location.href).href)
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(0, 2.9, 5.6)
  camera.lookAt(0, 1.75, 0)

  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x30406a, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(3, 5, 4)
  scene.add(sun)

  // The planet turns as a whole (orientation); the clouds drift on it.
  const planet = buildPlanet(THREE)
  const clouds = buildClouds(THREE)
  planet.add(clouds)
  scene.add(planet)
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.5, 0))

  const echo = buildRobot(THREE)
  echo.root.scale.setScalar(ECHO_SCALE)
  scene.add(echo.root)

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
  let activity = 0
  let phase = 0
  let heading = 0
  let wave = 0

  /** One small step: the planet turns, and Echo runs (on a spring) for the point at the top of the planet as the camera sees it. */
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
    if (!still) clouds.rotation.y += 0.05 * elapsed

    // Upright on the ground under it.
    echo.root.position.copy(ground.current).applyQuaternion(orientation).multiplyScalar(R)
    echo.root.quaternion.setFromUnitVectors(UP, look.copy(echo.root.position).normalize())
    toLocal.copy(echo.root.quaternion).invert()

    // Facing the way it runs; once it has stopped, it turns to the viewer and waves.
    const greeting = !m.dragging && activity < 0.06
    let target = heading
    if (greeting) {
      look.copy(camera.position).sub(echo.root.position).applyQuaternion(toLocal)
      target = Math.atan2(look.x, look.z)
    } else if (ground.velocity.lengthSq() > 1e-4) {
      look.copy(ground.velocity).applyQuaternion(orientation).applyQuaternion(toLocal)
      target = Math.atan2(look.x, look.z)
    }
    heading += turn(heading, target) * (1 - Math.exp(-(still ? 20 : 8) * elapsed))
    wave = damp(wave, greeting && Math.abs(turn(heading, target)) < 0.3 ? 1 : 0, 5, elapsed)

    const t = still ? 0 : (now - start) / 1000
    const p = poseAt(t, phase, activity * (1 - wave), wave)
    echo.facing.rotation.y = heading
    echo.hover.position.y = p.lift
    echo.hover.rotation.x = p.lean
    echo.head.rotation.x = -p.lean * 0.6
    echo.armL.rotation.x = p.armL
    echo.armR.rotation.x = p.armR
    echo.armR.rotation.z = p.raise
    echo.shadow.scale.setScalar(1 - p.lift * 1.5)

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
      const mats: unknown[] = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) if (m instanceof THREE.Material) m.dispose()
    })
    renderer.dispose()
  }
}
