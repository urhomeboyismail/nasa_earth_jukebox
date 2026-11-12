// The Earth Jukebox mascot (docs/design/mascot-concepts.html): Echo, drawn as Juke-Bot, a small robot who listens to Earth.
// Echo is the full body that stands beside the voice guide; Sonny is the helmet head in a badge, for small places.
// Both are decoration (aria-hidden): the voice guide and the places that show Echo say its state in text.
// Expression, motion and the chest bars are props (mascotTypes.ts); the colours are --mascot-* variables with fallbacks.
import { useId, type CSSProperties } from 'react'
import './mascot.css'
import { clamp01, expressionForPose, RESTING_LEVELS, type EchoProps, type MascotExpression } from './mascotTypes'

export type { EchoProps, MascotExpression, MascotMotion, MascotPose } from './mascotTypes'

/** Each colour is a variable with today's value as the fallback, so JB04 can recolour the accent per data set. */
const C = {
  shell: 'var(--mascot-shell, #ffffff)',
  shellShade: 'var(--mascot-shell-shade, #dce3eb)',
  visor: 'var(--mascot-visor, #0f2233)',
  accent: 'var(--mascot-accent, #802cc9)',
  accentSoft: 'var(--mascot-accent-soft, #c384ff)',
  glow: 'var(--mascot-glow, #7fe7ff)',
  ocean: 'var(--mascot-ocean, #1f5f8a)',
  land: 'var(--mascot-land, #4f9b74)',
  flame: 'var(--mascot-flame, #ffb347)',
  alert: 'var(--mascot-alert, #ff9a3c)',
  trail: 'var(--mascot-trail, #7fe7ff)',
}

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

/** One drawing per expression, each a different shape (not only a different colour), centred on 0,0 in a visor about 84 wide. */
function VisorFace({ expression }: { expression: MascotExpression }) {
  const line = { stroke: C.glow, strokeWidth: 4, strokeLinecap: 'round' as const, fill: 'none' }
  switch (expression) {
    case 'searching':
      return (
        <g data-part="visor-searching">
          <path className="mascot__sweep" d="M-34 0 H34" {...line} />
          <g fill={C.glow}><circle cx="-10" cy="16" r="3" /><circle cx="0" cy="16" r="3" /><circle cx="10" cy="16" r="3" /></g>
        </g>
      )
    case 'eq_active':
      return (
        <g data-part="visor-eq_active" className="mascot__mouth" fill={C.glow}>
          {[10, 22, 30, 18, 8].map((h, i) => <rect key={i} x={-24 + i * 10} y={-h / 2} width="6" height={h} rx="3" />)}
        </g>
      )
    case 'alert':
      return (
        <g data-part="visor-alert">
          <path d="M0 -22 L24 20 H-24 Z" fill={C.alert} stroke={C.alert} strokeWidth="4" strokeLinejoin="round" />
          <rect x="-2.5" y="-8" width="5" height="16" rx="2.5" fill={C.visor} />
          <circle cx="0" cy="14" r="3" fill={C.visor} />
        </g>
      )
    case 'resting':
      return (
        <g data-part="visor-resting">
          {/* Slight curves, not flat lines: a glow filter draws nothing for a shape with no height. */}
          <path d="M-22 0 Q-15 5 -8 0" {...line} /><path d="M8 0 Q15 5 22 0" {...line} />
        </g>
      )
    default:
      return (
        <g data-part="visor-happy">
          <path d="M-22 -4 Q-15 -14 -8 -4" {...line} /><path d="M8 -4 Q15 -14 22 -4" {...line} />
          <path d="M-9 8 Q0 17 9 8" {...line} strokeWidth={3} />
        </g>
      )
  }
}

/** Earth seen as a reflection low in the visor. */
function Earth({ clip, cx, cy, r }: { clip: string; cx: number; cy: number; r: number }) {
  return (
    <g clipPath={`url(#${clip})`} opacity={0.6}>
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

type CssVars = CSSProperties & Record<`--${string}`, number>

const BAR_BASE = 174, BAR_MIN = 3, BAR_RANGE = 22

/** Echo: the full-body Juke-Bot. */
export function Echo({ pose = 'idle', expression, motion = 'idle', thrust = 0.7, levels, globeSpin = 0, className }: EchoProps) {
  const id = safeId(useId())
  const look = expression ?? expressionForPose(pose)
  const listening = pose === 'listening', talking = pose === 'talking'
  const burning = motion === 'boosting' || motion === 'retro'
  const spin = clamp01(globeSpin)
  const bars = RESTING_LEVELS.map((rest, i) => {
    const v = levels?.[i]
    return typeof v === 'number' && Number.isFinite(v) ? v : rest
  })
  const glowFilter = `url(#f${id})`
  const style: CssVars = { '--thrust': clamp01(thrust), '--globe-spin': spin }
  return (
    <svg className={className} viewBox="0 0 200 240" aria-hidden="true" focusable="false"
      data-expression={look} data-motion={motion} data-trail="spark" data-globe={spin > 0 ? 'spinning' : 'still'} style={style}>
      <defs>
        <clipPath id={`v${id}`}><rect x="56" y="46" width="88" height="62" rx="28" /></clipPath>
        <radialGradient id={`g${id}`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor={C.shell} /><stop offset="1" stopColor={C.shellShade} /></radialGradient>
        <filter id={`f${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="234" rx="46" ry="6" fill="#000" opacity=".15" />
      <g className="mascot__body">
        {/* Boots: chunky, with a nozzle. The flames show only while boosting or in a retro burn. */}
        {[84, 116].map(x => (
          <g key={x}>
            <rect x={x - 16} y="196" width="32" height="26" rx="10" fill={C.accent} />
            <rect x={x - 11} y="214" width="22" height="8" rx="4" fill={C.accentSoft} />
            <rect x={x - 7} y="222" width="14" height="5" rx="2.5" fill={C.visor} />
            {burning && (
              <g data-part="flame" filter={glowFilter}>
                <path className="mascot__flame" d={`M${x - 6} 227 Q${x} 262 ${x + 6} 227 Z`} fill={C.flame} />
                <circle data-part="trail" cx={x} cy="258" r="2.5" fill={C.trail} opacity=".8" />
              </g>
            )}
          </g>
        ))}
        {/* Torso with the chest screen: four EQ bars and a mini globe. */}
        <rect x="62" y="124" width="76" height="82" rx="26" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="2" />
        <rect x="76" y="140" width="48" height="40" rx="9" fill={C.visor} />
        {bars.map((v, i) => {
          const h = BAR_MIN + BAR_RANGE * clamp01(v / 255)
          return <rect key={i} data-part="eq-bar" x={81 + i * 6.5} y={BAR_BASE - h} width="4" height={h} rx="2" fill={C.glow} />
        })}
        <g data-part="globe" stroke={C.glow} strokeWidth="1.4" fill="none">
          <circle cx="114" cy="160" r="8" />
          <g className="mascot__globe-lines"><ellipse cx="114" cy="160" rx="4" ry="8" /><path d="M106 160 H122" /></g>
        </g>
        <rect x="88" y="190" width="24" height="6" rx="3" fill={C.accentSoft} />
        {/* Arms and rounded gloves. */}
        <g>
          <path d="M66 146 Q50 160 52 176" stroke={C.shellShade} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="52" cy="180" r="11" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="2" />
        </g>
        <g className="mascot__arm--right" data-part="arm-right">
          <path d="M138 146 Q154 160 152 176" stroke={C.shellShade} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="152" cy="180" r="11" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="2" />
        </g>
        {/* Helmet head with the LED visor. */}
        <rect x="44" y="30" width="112" height="90" rx="38" fill={`url(#g${id})`} stroke={C.shellShade} strokeWidth="3" />
        <rect x="56" y="46" width="88" height="62" rx="28" fill={C.visor} />
        <Earth clip={`v${id}`} cx={116} cy={132} r={38} />
        <path d="M66 62 Q72 54 88 53" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".35" />
        <g transform="translate(100 78)" filter={glowFilter}><VisorFace expression={look} /></g>
        {/* Headphones: a band and two ear cups with LEDs, lit while listening. */}
        <path d="M40 78 A60 56 0 0 1 160 78" stroke={C.accent} strokeWidth="8" strokeLinecap="round" fill="none" />
        <rect x="30" y="62" width="20" height="42" rx="10" fill={C.accent} />
        <rect x="150" y="62" width="20" height="42" rx="10" fill={C.accent} />
        <circle data-part="led" data-lit={listening} cx="40" cy="83" r="4" fill={listening ? C.glow : C.accentSoft} filter={listening ? glowFilter : undefined} />
        <circle data-part="led" data-lit={listening} cx="160" cy="83" r="4" fill={listening ? C.glow : C.accentSoft} filter={listening ? glowFilter : undefined} />
        {listening && <><Waves x={24} y={83} dir={-1} color={C.glow} /><Waves x={176} y={83} dir={1} color={C.glow} /></>}
        {talking && <Waves x={160} y={150} dir={1} color={C.accentSoft} />}
        {pose === 'thinking' && <g fill={C.accentSoft}><circle cx="156" cy="30" r="4" /><circle cx="168" cy="20" r="5" /><circle cx="182" cy="12" r="6" /></g>}
      </g>
    </svg>
  )
}

/** Sonny: Echo's helmet head in a round badge, for buttons and headers. */
export function Sonny({ size = 32, expression = 'happy', className }: { size?: number; expression?: MascotExpression; className?: string }) {
  const id = safeId(useId())
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" data-expression={expression}>
      <defs>
        <clipPath id={`s${id}`}><rect x="25" y="32" width="50" height="40" rx="17" /></clipPath>
        <filter id={`f${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="50" fill={C.accentSoft} />
      <rect x="18" y="20" width="64" height="60" rx="24" fill={C.shell} />
      <rect x="25" y="32" width="50" height="40" rx="17" fill={C.visor} />
      <Earth clip={`s${id}`} cx={58} cy={88} r={26} />
      <g transform="translate(50 52) scale(.55)" filter={`url(#f${id})`}><VisorFace expression={expression} /></g>
      <path d="M14 52 A36 34 0 0 1 86 52" stroke={C.accent} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="8" y="40" width="12" height="26" rx="6" fill={C.accent} />
      <rect x="80" y="40" width="12" height="26" rx="6" fill={C.accent} />
    </svg>
  )
}
