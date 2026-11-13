import { Dialog } from '../../components'
import { variableWords, type Visualization } from '../../data'
import { listedShortcuts, type Shortcut } from '../../interaction/shortcuts'

const TABLES: { caption: string; includes: (shortcut: Shortcut) => boolean }[] = [
  { caption: 'Anywhere on Listen', includes: shortcut => shortcut.device === 'keyboard' && shortcut.scope !== 'map' },
  { caption: 'On the sound map (open it with "Explore the map")', includes: shortcut => shortcut.device === 'keyboard' && shortcut.scope === 'map' },
  { caption: 'Touch and mouse on the sound map', includes: shortcut => shortcut.device === 'touch' || shortcut.device === 'mouse' },
  { caption: 'Gamepad', includes: shortcut => shortcut.device === 'gamepad' },
]

/** F41: every key on Listen, made from the list the input layer reads (src/interaction/shortcuts.ts), so it cannot say anything the keys do not do. */
export function ShortcutsDialog({ open, onClose, visualization }: { open: boolean; onClose: () => void; visualization: Visualization }) {
  const words = variableWords(visualization.variable)
  const shown = listedShortcuts()
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <p>
        The single-letter keys (R, L, T and the question mark) work only while the sound map has focus. They never act anywhere else on
        the page.
      </p>
      {TABLES.map(({ caption, includes }) => {
        const rows = shown.filter(includes)
        if (rows.length === 0) return null
        return (
          <div className="shortcuts" key={caption}>
            <table>
              <caption>{caption}</caption>
              <thead>
                <tr><th scope="col">Key</th><th scope="col">What it does</th></tr>
              </thead>
              <tbody>
                {rows.map(shortcut => (
                  <tr key={shortcut.id}>
                    <td><kbd>{shortcut.keys}</kbd></td>
                    <td>{shortcut.does(words)}{shortcut.note && ` ${shortcut.note}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </Dialog>
  )
}
