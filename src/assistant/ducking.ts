// Music never plays over the voice guide. While the guide listens or speaks, the player is paused; nothing here
// resumes it by itself, so the listener decides ("play" to the guide, or the Play button).
//
// This goes through the player's own commands rather than the sound engine's duck(): the engine is created inside
// each page, and pausing it directly would leave the Play/Pause button showing "playing" over silence.

import { useEffect, useRef } from 'react'
import { sendPlayerCommand, type PlayerCommand } from '../features/player/controls'
import type { AssistantStatus } from '../hooks/useVoiceAssistant'

/** Commands that mean "I want to hear sound now". */
const WANTS_SOUND = (command: PlayerCommand) => command !== 'pause' && command !== 'stop'

let wantsSound = false

/** Call for every playback command the guide sends. A listener who just asked for sound keeps it while the guide confirms. */
export function noteGuidePlaybackCommand(command: PlayerCommand) {
  wantsSound = WANTS_SOUND(command)
}

/** For tests: forget what the guide last asked for. */
export function resetDucking() {
  wantsSound = false
}

export function useDucking(status: AssistantStatus) {
  const previous = useRef<AssistantStatus>('idle')
  useEffect(() => {
    const before = previous.current
    previous.current = status
    if (status === 'listening' && before !== 'speaking') {
      // The guide has just opened (or reconnected): quiet the music so the microphone hears the listener.
      sendPlayerCommand('pause')
    } else if (status === 'speaking' && !wantsSound) {
      sendPlayerCommand('pause')
    } else if (status === 'listening' && before === 'speaking') {
      // The guide finished its turn. A request for sound has been answered; the next turn starts fresh.
      wantsSound = false
    }
  }, [status])
}
