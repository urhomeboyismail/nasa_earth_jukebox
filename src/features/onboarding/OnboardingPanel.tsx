// The first-minute game's panel (ticket IX11): the step's prompt as text, with Skip. Once it is skipped or done, a button offers it again. It is not a live
// region: the hook announces each step change once, and nothing here speaks or sounds by itself.

import { Button } from '../../components'
import type { Onboarding } from './useOnboarding'

export function OnboardingPanel({ onboarding }: { onboarding: Onboarding }) {
  if (!onboarding.visible) {
    return (
      <div className="onboarding">
        <Button onClick={onboarding.restart}>Play the first-minute game</Button>
      </div>
    )
  }
  return (
    <div className="onboarding" role="group" aria-label="First-minute game">
      {!onboarding.finished && <p className="onboarding__step">Step {onboarding.step + 1} of {onboarding.steps}</p>}
      <p className="onboarding__prompt">{onboarding.prompt}</p>
      {onboarding.mapOff && !onboarding.finished && <p className="onboarding__hint">First, press Explore the map to turn on the sound map.</p>}
      {onboarding.finished ? <Button onClick={onboarding.close}>Close</Button> : <Button onClick={onboarding.skip}>Skip</Button>}
    </div>
  )
}
