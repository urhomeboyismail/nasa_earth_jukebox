// Echo's head in a small badge (JB08): a still picture of the 3D robot (public/robot/echo-head.png), for buttons and captions where a live robot
// would cost a second 3D scene. Decoration only: the control beside it carries the words.

type Props = {
  /** Width and height in CSS pixels. Default 32. */
  size?: number
  className?: string
}

export function RobotBadge({ size = 32, className }: Props) {
  return <img src={`${import.meta.env.BASE_URL}robot/echo-head.png`} alt="" width={size} height={size} className={className} decoding="async" draggable={false} />
}
