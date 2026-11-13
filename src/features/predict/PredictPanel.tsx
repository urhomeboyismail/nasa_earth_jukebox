// The Predict panel (ticket IX05), under the sound map. A "Predict" button appears on a date that has a question; pressing it plays that date and shows the
// question as buttons. The answer is not on the page until the two later dates have played. All buttons: keyboard, touch and screen readers work with no
// single-key shortcut. The reveal is announced once by the hook, so the line here is not a live region.

import { Button } from '../../components'
import type { Predict } from './usePredict'
import './predict.css'

type Props = {
  predict: Pick<Predict, 'phase' | 'questionAt' | 'ask' | 'choose' | 'cancel'>
  /** The date on screen. */
  index: number
}

export function PredictPanel({ predict, index }: Props) {
  const { phase } = predict
  const question = predict.questionAt(index)
  const busy = phase.status === 'asking' || phase.status === 'revealing'
  if (!busy && !question && phase.status !== 'done') return null

  return (
    <div className="predict" role="group" aria-label="Predict">
      {!busy && question && <Button onClick={() => predict.ask(index)}>{phase.status === 'done' ? 'Predict again' : 'Predict'}</Button>}
      {phase.status === 'asking' && (
        <>
          <p className="predict__question" id="predict-question">{phase.question.text}</p>
          <div className="predict__choices" role="group" aria-labelledby="predict-question">
            {phase.question.choices.map(choice => (
              <Button key={choice.id} onClick={() => predict.choose(choice.id)}>{choice.label}</Button>
            ))}
          </div>
        </>
      )}
      {busy && <Button onClick={predict.cancel}>Stop the question</Button>}
      {phase.status === 'revealing' && <p className="predict__line">Listen to the next two dates.</p>}
      {phase.status === 'done' && <p className="predict__line predict__line--answer">{phase.text}</p>}
    </div>
  )
}
