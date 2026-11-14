import type { WakeState } from './hooks/useWakeWord'

const TEXT: Partial<Record<WakeState, string>> = {
  listening: 'Listening for “Hey Echo”',
  waiting: '“Hey Echo” starts after you click or press a key',
  blocked: '“Hey Echo” is off: the browser refused the microphone. Allow it for this site, then turn it on again',
}

/**
 * Always in view while the page may be listening for "Hey Echo", so listening is never hidden. Says nothing while it is off,
 * and nothing during a conversation (the voice panel shows that).
 */
export function WakeIndicator({ state, onTurnOff }: { state: WakeState; onTurnOff: () => void }) {
  const text = TEXT[state]
  return (
    <div className="app-wake" hidden={!text}>
      <p className="app-wake__text" role="status">{text ?? ''}</p>
      {text && <button type="button" className="app-wake__off" onClick={onTurnOff}>Turn off “Hey Echo”</button>}
    </div>
  )
}
