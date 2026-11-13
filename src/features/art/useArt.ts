// Art mode's state (ticket IX12): whether it is on, the four choices, the saved presets, and the files it makes. The page passes `preset` to the
// Symphony; it is null while art mode is off, so the manifest's own preset plays and nothing is kept without a save.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAnnounce } from '../../components'
import type { Visualization } from '../../data'
import { presetFor } from '../../sonify'
import type { Preset } from '../../sonify/types'
import { renderSequence, type RenderDeps, type RenderOutput } from '../playlist/renderSequence'
import { applyChoice, choiceOf, presetFromArt, slug, type ArtChoice, type ArtField } from './presets'
import { parsePresetFile, presetFileText } from './schema'
import { deletePreset, readPresets, renamePreset, savePreset, writePresets } from './store'

export type ArtDeps = {
  /** For tests: replaces the offline render. */
  render?: (visualization: Visualization, deps: RenderDeps) => Promise<RenderOutput>
}

export type ArtFile = { href: string; name: string; label: string }

export type Art = {
  on: boolean
  toggle: () => void
  choice: ArtChoice
  set: <K extends ArtField>(field: K, value: ArtChoice[K]) => void
  /** The preset the Symphony plays: null while art mode is off. */
  preset: Preset | null
  name: string
  setName: (name: string) => void
  saved: { name: string; choice: ArtChoice }[]
  save: () => void
  load: (name: string) => void
  rename: (name: string) => void
  remove: (name: string) => void
  exportFile: () => void
  importFile: (file: File) => void
  record: () => void
  recording: boolean
  /** The latest link made by Export or Record, for the listener to download. */
  files: ArtFile[]
  /** One sentence on the last thing that happened, always shown as text. */
  status: string
}

/** jsdom's File has no text(), so a file is read with a FileReader. */
const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function useArt(visualization: Visualization, deps: ArtDeps = {}): Art {
  const announce = useAnnounce()
  const base = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization])
  const [on, setOn] = useState(false)
  const [choice, setChoice] = useState<ArtChoice>(() => choiceOf(base))
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(readPresets)
  const [files, setFiles] = useState<ArtFile[]>([])
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('')
  const urls = useRef<string[]>([])
  const render = deps.render ?? renderSequence

  const say = useCallback((text: string) => {
    setStatus(text)
    announce(text)
  }, [announce])

  const release = useCallback(() => {
    urls.current.forEach(url => URL.revokeObjectURL(url))
    urls.current = []
    setFiles([])
  }, [])
  // The links are blob URLs: free them when the panel goes away.
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), [])

  // Only the four chosen fields make a new preset, so typing a name never builds a new ensemble.
  const preset = useMemo(() => (on ? applyChoice(base, choice) : null), [on, base, choice])

  const toggle = useCallback(() => {
    if (on) {
      setOn(false)
      setChoice(choiceOf(base))
      setName('')
      release()
      say('Art mode is off. The data set\'s own sound is back.')
    } else {
      setOn(true)
      say('Art mode is on. The sound choices are yours; the data mapping does not change.')
    }
  }, [on, base, release, say])

  const set = useCallback(<K extends ArtField>(field: K, value: ArtChoice[K]) => {
    setChoice(current => choiceOf(applyChoice(base, { ...current, [field]: value })))
  }, [base])

  const remember = (list: typeof saved) => {
    setSaved(list)
    writePresets(list)
  }

  const save = () => {
    const result = savePreset(saved, { name, ...choice })
    if (!result.ok) return say(result.message)
    remember(result.list)
    say(`Saved the preset ${name.trim()}.`)
  }

  const load = (target: string) => {
    const found = saved.find(item => item.name === target)
    if (!found) return
    const { name: loaded, ...chosen } = found
    setChoice(chosen)
    setName(loaded)
    setOn(true)
    say(`Loaded the preset ${loaded}.`)
  }

  const rename = (from: string) => {
    const result = renamePreset(saved, from, name)
    if (!result.ok) return say(result.message)
    remember(result.list)
    say(`Renamed ${from} to ${name.trim()}.`)
  }

  const remove = (target: string) => {
    remember(deletePreset(saved, target))
    say(`Deleted the preset ${target}.`)
  }

  const addFile = (blob: Blob, fileName: string, label: string) => {
    release()
    const href = URL.createObjectURL(blob)
    urls.current.push(href)
    setFiles([{ href, name: fileName, label }])
  }

  const exportFile = () => {
    const title = name.trim() || 'Art mode'
    addFile(new Blob([presetFileText({ name: title, ...choice })], { type: 'application/json' }), `${slug(title)}.preset.json`, `Download the preset ${title} as a file`)
    say(`The preset ${title} is ready to download.`)
  }

  const importFile = (file: File) => {
    void readText(file).then(text => {
      const result = parsePresetFile(text)
      if (!result.ok) return say(`${result.message} Nothing was changed.`)
      const { name: imported, ...chosen } = result.preset
      setChoice(chosen)
      setName(imported)
      setOn(true)
      say(`Loaded the preset ${imported} from the file.`)
    }, () => say('That file could not be read. Nothing was changed.'))
  }

  const record = () => {
    if (recording) return
    const title = name.trim() || 'Art mode'
    setRecording(true)
    release()
    say('Recording this art. This can take a little while.')
    render(visualization, { preset: presetFromArt(base, { name: title, ...choice }) }).then(output => {
      addFile(output.wav, `${slug(title)}-${visualization.id}.wav`, `Download the recording of ${title} as a WAV file`)
      say(`The recording of ${title} is ready to download.`)
    }, error => say(`The recording could not be made. ${messageOf(error)}`)).finally(() => setRecording(false))
  }

  return {
    on, toggle, choice, set, preset, name, setName,
    saved: saved.map(({ name: savedName, ...chosen }) => ({ name: savedName, choice: chosen })),
    save, load, rename, remove, exportFile, importFile, record, recording, files, status,
  }
}
