import { useState } from 'react'
import { Button, useAnnounce } from '../../components'
import { recordUndo } from '../../interaction/history'
import type { VoiceId } from '../../data'
import type { Symphony } from './symphonyState'
import { DEFAULT_MIX, cleanMix, hasMyMix, readMyMix, saveMyMix } from './mySoundMix'

type Props = Pick<Symphony, 'voices' | 'muted' | 'solo' | 'setMix'>

/** "My mix": save which voices are muted and which is solo, bring them back later, or put every voice back on. Kept on this device. */
export function MyMixControls({ voices, muted, solo, setMix }: Props) {
  const announce = useAnnounce()
  const [saved, setSaved] = useState(hasMyMix)

  function save() {
    // Only the voices on the mixer are kept, so a mix saved at one level of detail does not mute a voice that is not there.
    const kept = cleanMix({ muted: [...muted].filter(voice => voices.includes(voice)), solo: solo !== null && voices.includes(solo) ? solo : null })
    if (saveMyMix(kept)) {
      setSaved(true)
      announce('My mix saved.')
    } else {
      announce('My mix could not be saved on this device.')
    }
  }

  /** A change that Ctrl+Z puts back. */
  function change(next: { muted: readonly VoiceId[]; solo: VoiceId | null }) {
    const before = { muted, solo }
    setMix(new Set(next.muted), next.solo)
    recordUndo('mix', () => setMix(before.muted, before.solo))
  }

  function recall() {
    change(readMyMix())
    announce('My mix recalled.')
  }

  function reset() {
    change(DEFAULT_MIX)
    announce('The mix is reset. Every voice is on.')
  }

  return (
    <div className="symphony__mymix" role="group" aria-label="My mix">
      <Button onClick={save}>Save my mix</Button>
      <Button disabled={!saved} onClick={recall}>Recall my mix</Button>
      <Button onClick={reset}>Reset the mix</Button>
    </div>
  )
}
