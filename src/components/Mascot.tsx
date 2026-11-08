// The Earth Jukebox mascot (concept, docs/design/mascot-concepts.html): an astronaut who listens to Earth.
// Echo is the full body that stands beside the voice guide; Sonny is the head in a badge, for small places.
// Both are decoration (aria-hidden): the voice guide says its state in text.
import { useId } from 'react'

export type MascotPose = 'idle' | 'listening' | 'talking' | 'thinking'

const C = {
  primary: '#802cc9',
  primaryContainer: '#c384ff',
  shellShade: '#dce3eb',
  visor: '#0f2233',
  ocean: '#1f5f8a',
  land: '#4f9b74',
  glow: '#7fe7ff',
}

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

function Face({ cx, cy, s, pose }: { cx: number; cy: number; s: number; pose: MascotPose }) {
  const ex = 14 * s, ey = -4 * s
  const ry = pose === 'listening' ? 9.5 : 8
  const lookX = pose === 'thinking' ? 3 : 0, lookY = pose === 'thinking' ? -4 : 0
  return (
    <g fill={C.glow} stroke={C.glow} strokeLinecap="round">
      <ellipse cx={cx - ex + lookX * s} cy={cy + ey + lookY * s} rx={6 * s} ry={ry * s} stroke="none" />
      <ellipse cx={cx + ex + lookX * s} cy={cy + ey + lookY * s} rx={6 * s} ry={ry * s} stroke="none" />
      {pose === 'talking' && <ellipse className="mascot__mouth" cx={cx} cy={cy + 13 * s} rx={6 * s} ry={4.5 * s} stroke="none" />}
      {pose === 'thinking' && <path d={`M${cx - 5 * s} ${cy + 13 * s} L${cx + 5 * s} ${cy + 12 * s}`} strokeWidth={3 * s} fill="none" />}
      {(pose === 'idle' || pose === 'listening') &&
        <path d={`M${cx - 8 * s} ${cy + 10 * s} Q${cx} ${cy + 18 * s} ${cx + 8 * s} ${cy + 10 * s}`} strokeWidth={3 * s} fill="none" />}
    </g>
  )
}

/** Earth seen as a reflection low in the visor. */
function Earth({ clip, cx, cy, r }: { clip: string; cx: number; cy: number; r: number }) {
  return (
    <g clipPath={`url(#${clip})`} opacity={0.85}>
      <circle cx={cx} cy={cy} r={r} fill={C.ocean} />
      <path fill={C.land} d={`M${cx - r * .7} ${cy - r * .62} q${r * .3} ${-r * .3} ${r * .6} ${-r * .12} q${r * .15} ${r * .2} ${-r * .05} ${r * .35} q${-r * .35} ${r * .08} ${-r * .55} ${-r * .23}z`} />
      <path fill={C.land} d={`M${cx + r * .05} ${cy - r * .9} q${r * .35} ${-r * .05} ${r * .5} ${r * .2} q${-r * .05} ${r * .3} ${-r * .35} ${r * .32} q${-r * .2} ${-r * .2} ${-r * .15} ${-r * .52}z`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.glow} strokeWidth={2} opacity={0.5} />
    </g>
  )
}

function Waves({ x, y, dir, color }: { x: number; y: number; dir: 1 | -1; color: string }) {
  return (
    <g className="mascot__waves" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none">
      {[1, 2, 3].map(i => {
        const r = (8 + i * 7) * 0.8
        return <path key={i} opacity={1 - i * 0.25} transform={`translate(${dir * i * 4} 0)`}
          d={`M${x} ${y - r * .7} A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${x} ${y + r * .7}`} />
      })}
    </g>
  )
}

/** Echo: the full-body astronaut. */
export function Echo({ pose = 'idle', className }: { pose?: MascotPose; className?: string }) {
  const id = safeId(useId())
  const listening = pose === 'listening', talking = pose === 'talking'
  return (
    <svg className={className} viewBox="0 0 200 240" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`v${id}`}><ellipse cx="100" cy="92" rx="42" ry="34" /></clipPath>
        <radialGradient id={`g${id}`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor={C.shellShade} /></radialGradient>
      </defs>
      <ellipse cx="100" cy="228" rx="46" ry="7" fill="#000" opacity=".15" />
      <rect x="56" y="132" width="88" height="70" rx="20" fill={C.shellShade} />
      <ellipse cx="58" cy="176" rx="12" ry="22" transform="rotate(18 58 176)" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="2" />
      <ellipse cx="142" cy="176" rx="12" ry="22" transform={`rotate(${talking ? -40 : -18} 142 176)`} fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="2" />
      <rect x="64" y="134" width="72" height="88" rx="34" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="2" />
      <ellipse cx="100" cy="140" rx="38" ry="9" fill={C.primaryContainer} />
      <rect x="85" y="160" width="30" height="20" rx="7" fill={C.primary} />
      <g fill={C.primaryContainer}>
        <rect x="91" y="170" width="3" height="6" rx="1.5" /><rect x="97" y="164" width="3" height="12" rx="1.5" />
        <rect x="103" y="167" width="3" height="9" rx="1.5" /><rect x="109" y="171" width="3" height="5" rx="1.5" />
      </g>
      <circle cx="100" cy="88" r="58" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="3" />
      <ellipse cx="100" cy="92" rx="42" ry="34" fill={C.visor} />
      <Earth clip={`v${id}`} cx={112} cy={150} r={46} />
      <path d="M70 76 Q78 62 96 60" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".35" />
      <Face cx={100} cy={94} s={1} pose={pose} />
      <path d="M38 86 A62 62 0 0 1 162 86" stroke={C.primary} strokeWidth="9" strokeLinecap="round" fill="none" />
      <rect x="26" y="70" width="20" height="40" rx="10" fill={C.primary} />
      <rect x="154" y="70" width="20" height="40" rx="10" fill={C.primary} />
      <rect x="30" y="78" width="6" height="24" rx="3" fill={listening ? C.glow : C.primaryContainer} />
      <rect x="164" y="78" width="6" height="24" rx="3" fill={listening ? C.glow : C.primaryContainer} />
      {listening && <><Waves x={22} y={90} dir={-1} color={C.glow} /><Waves x={178} y={90} dir={1} color={C.glow} /></>}
      {talking && <Waves x={150} y={150} dir={1} color={C.primaryContainer} />}
      {pose === 'thinking' && <g fill={C.primaryContainer}><circle cx="150" cy="30" r="4" /><circle cx="162" cy="20" r="5" /><circle cx="176" cy="12" r="6" /></g>}
    </svg>
  )
}

/** Sonny: Echo's head in a round badge, for buttons and headers. */
export function Sonny({ size = 32, className }: { size?: number; className?: string }) {
  const id = safeId(useId())
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs><clipPath id={`s${id}`}><ellipse cx="50" cy="54" rx="24" ry="19" /></clipPath></defs>
      <circle cx="50" cy="50" r="50" fill={C.primaryContainer} />
      <circle cx="50" cy="52" r="34" fill="#fff" />
      <ellipse cx="50" cy="54" rx="24" ry="19" fill={C.visor} />
      <Earth clip={`s${id}`} cx={56} cy={86} r={28} />
      <ellipse cx="42" cy="53" rx="3.5" ry="4.5" fill={C.glow} />
      <ellipse cx="58" cy="53" rx="3.5" ry="4.5" fill={C.glow} />
      <path d="M14 50 A36 36 0 0 1 86 50" stroke="#802cc9" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="8" y="40" width="12" height="24" rx="6" fill="#802cc9" />
      <rect x="80" y="40" width="12" height="24" rx="6" fill="#802cc9" />
    </svg>
  )
}
