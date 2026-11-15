// Material Symbols (Apache 2.0), drawn on a 24 x 24 grid. The plain name is the filled icon; "-outline" is the outlined one. Filled marks a selected state.
// Not exported from ./index.ts on purpose (see T116 and T117 in docs/TICKETS.md): import it by path.
const paths = {
  'home-outline': 'M6 19h3v-6h6v6h3v-9l-6-4.5L6 10zm-2 2V9l8-6l8 6v12h-7v-6h-2v6z',
  home: 'M4 21V9l8-6l8 6v12h-6v-7h-4v7z',
  'school-outline': 'm12 21l-7-3.8v-6L1 9l11-6l11 6v8h-2v-6.9l-2 1.1v6zm0-8.3L18.85 9L12 5.3L5.15 9zm0 6.025l5-2.7V12.25L12 15l-5-2.75v3.775z',
  school: 'M21 17v-6.9L12 15L1 9l11-6l11 6v8zm-9 4l-7-3.8v-5l7 3.8l7-3.8v5z',
  'headphones-outline': 'M9 21H5q-.825 0-1.412-.587T3 19v-7q0-1.875.713-3.512t1.924-2.85t2.85-1.925T12 3t3.513.713t2.85 1.924t1.925 2.85T21 12v7q0 .825-.587 1.413T19 21h-4v-8h4v-1q0-2.925-2.037-4.962T12 5T7.038 7.038T5 12v1h4zm-2-6H5v4h2zm10 0v4h2v-4z',
  headphones: 'M9 21H5q-.825 0-1.412-.587T3 19v-7q0-1.875.713-3.512t1.924-2.85t2.85-1.925T12 3t3.513.713t2.85 1.924t1.925 2.85T21 12v7q0 .825-.587 1.413T19 21h-4v-8h4v-1q0-2.925-2.037-4.962T12 5T7.038 7.038T5 12v1h4z',
  'difference-outline': 'M12.5 11h2V9h2V7h-2V5h-2v2h-2v2h2zm-2 4h6v-2h-6zM8 19q-.825 0-1.412-.587T6 17V3q0-.825.588-1.412T8 1h7l6 6v10q0 .825-.587 1.413T19 19zm0-2h11V8l-5-5H8zm-4 6q-.825 0-1.412-.587T2 21V7h2v14h11v2z',
  difference: 'M12.5 11h2V9h2V7h-2V5h-2v2h-2v2h2zm-2 4h6v-2h-6zM8 19q-.825 0-1.412-.587T6 17V3q0-.825.588-1.412T8 1h7l6 6v10q0 .825-.587 1.413T19 19zm-4 4q-.825 0-1.412-.587T2 21V7h2v14h11v2z',
  'info-outline': 'M11 17h2v-6h-2zm1.713-8.287Q13 8.425 13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9t.713-.288M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20',
  info: 'M11 17h2v-6h-2zm1.713-8.287Q13 8.425 13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9t.713-.288M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22',
  mic: 'M9.875 13.125Q9 12.25 9 11V5q0-1.25.875-2.125T12 2t2.125.875T15 5v6q0 1.25-.875 2.125T12 14t-2.125-.875M11 21v-3.075q-2.6-.35-4.3-2.325T5 11h2q0 2.075 1.463 3.538T12 16t3.538-1.463T17 11h2q0 2.625-1.7 4.6T13 17.925V21z',
  'mic-off': 'M17.75 14.95L16.3 13.5q.35-.575.525-1.2T17 11h2q0 1.1-.325 2.088t-.925 1.862m-2.95-3L9 6.15V5q0-1.25.875-2.125T12 2t2.125.875T15 5v6q0 .275-.062.5t-.138.45M11 21v-3.1q-2.6-.35-4.3-2.312T5 11h2q0 2.075 1.463 3.538T12 16q.85 0 1.613-.262T15 15l1.425 1.425q-.725.575-1.588.963T13 17.9V21zm8.8 1.6L1.4 4.2l1.4-1.4l18.4 18.4z',
  play: 'M8 19V5l11 7z',
  pause: 'M14 19V5h4v14zm-8 0V5h4v14z',
  stop: 'M6 18V6h12v12z',
  replay: 'M8.488 21.288q-1.638-.713-2.85-1.925t-1.925-2.85T3 13h2q0 2.925 2.038 4.963T12 20t4.963-2.037T19 13t-2.037-4.962T12 6h-.15l1.55 1.55L12 9L8 5l4-4l1.4 1.45L11.85 4H12q1.875 0 3.513.713t2.85 1.925t1.925 2.85T21 13t-.712 3.513t-1.925 2.85t-2.85 1.925T12 22t-3.512-.712',
  close: 'M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z',
  send: 'M3 20v-6l8-2l-8-2V4l19 8z',
  sun: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.22 5.64l1.42-1.42l2.12 2.12l-1.42 1.42zM16.24 17.66l1.42-1.42l2.12 2.12l-1.42 1.42zM16.24 6.34l2.12-2.12l1.42 1.42l-2.12 2.12zM4.22 18.36l2.12-2.12l1.42 1.42l-2.12 2.12z',
  volume: 'M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16',
} as const

export type IconName = keyof typeof paths

/** A decorative icon: hidden from screen readers, so the control around it must carry the label. */
export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  )
}
