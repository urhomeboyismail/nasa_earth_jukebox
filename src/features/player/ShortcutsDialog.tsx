import { Fragment } from 'react'
import { Dialog } from '../../components'
import { variableWords, type Visualization } from '../../data'
import { keyName, SHORTCUTS, type Scope } from './shortcuts'

const TABLES: { scope: Scope; caption: string }[] = [
  { scope: 'player', caption: 'Anywhere in the player' },
  { scope: 'map', caption: 'On the sound map (open it with "Explore the map")' },
]

/** F41: every key on Listen, made from the list the keyboard handlers read, so it cannot say anything they do not do. */
export function ShortcutsDialog({ open, onClose, visualization }: { open: boolean; onClose: () => void; visualization: Visualization }) {
  const words = variableWords(visualization.variable)
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <p>
        The single-letter keys (T, L and the question mark) work only while focus is in the player or on the sound map. They never act
        anywhere else on the page.
      </p>
      {TABLES.map(({ scope, caption }) => (
        <div className="shortcuts" key={scope}>
          <table>
            <caption>{caption}</caption>
            <thead>
              <tr><th scope="col">Key</th><th scope="col">What it does</th></tr>
            </thead>
            <tbody>
              {SHORTCUTS.filter(shortcut => shortcut.scope === scope).map(shortcut => (
                <tr key={shortcut.id}>
                  <td>
                    {shortcut.keys.map((key, i) => (
                      <Fragment key={key}>{i > 0 && ' or '}<kbd>{keyName(key)}</kbd></Fragment>
                    ))}
                  </td>
                  <td>{shortcut.does(words)}{shortcut.note && ` ${shortcut.note}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Dialog>
  )
}
