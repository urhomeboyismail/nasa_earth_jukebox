const STEPS = [
  { short: 'NASA video', long: 'A NASA Scientific Visualization Studio video or image series.' },
  { short: 'Frames', long: 'It is cut into one picture for each date.' },
  { short: 'Colour → value', long: 'Each colour is matched to the legend to read a value.' },
  { short: 'Sound engine', long: 'Values become notes, rhythm and space in your browser.' },
  { short: 'Words', long: 'Every sound is also described in words for screen readers.' },
]

const BOX = 120
const GAP = 28

/** The path from a NASA image to sound, as a diagram with the same steps as a list below it. */
export function HowItWorks() {
  const width = STEPS.length * BOX + (STEPS.length - 1) * GAP
  return (
    <>
      <svg viewBox={`0 0 ${width} 70`} className="about__pipeline" role="img" aria-label={`From NASA image to sound: ${STEPS.map(step => step.short).join(', then ')}.`}>
        {STEPS.map((step, i) => {
          const x = i * (BOX + GAP)
          return (
            <g key={step.short}>
              <rect x={x} y={10} width={BOX} height={50} rx={12} style={{ fill: 'var(--md-sys-color-surface-container-high)', stroke: 'var(--md-sys-color-primary)', strokeWidth: 2 }} />
              <text x={x + BOX / 2} y={40} textAnchor="middle" style={{ fill: 'var(--md-sys-color-on-surface)', fontSize: 14 }}>{step.short}</text>
              {i < STEPS.length - 1 && <path d={`M ${x + BOX + 4} 35 l ${GAP - 12} 0 m -6 -5 l 6 5 l -6 5`} style={{ fill: 'none', stroke: 'var(--md-sys-color-on-surface-variant)', strokeWidth: 2 }} />}
            </g>
          )
        })}
      </svg>
      <ol>
        {STEPS.map(step => <li key={step.short}><strong>{step.short}.</strong> {step.long}</li>)}
      </ol>
    </>
  )
}
