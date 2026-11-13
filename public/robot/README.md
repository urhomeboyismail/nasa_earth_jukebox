# Echo's robot (JB08)

Echo, the app's guide, is drawn by the 3D robot companion from the myt Learning Hub (https://learninghub.myt.mu, where it is called Ixia). It is used here with the permission of myt (Mauritius Telecom), given to the team in November 2026. Credit: robot companion by the myt Learning Hub.

The app drives it from `src/features/mascot/Ixia.tsx`. The robot's own chat, tips and greetings are off, and Echo's words, voice and buttons are the app's.

## Files

Copied byte for byte from https://learninghub.myt.mu/robot/ on 13 Nov 2026. Do not edit them: drive the robot through its API instead (`say`, `face`, `gesture`, `hush`, `configure`; see the comment at the top of `robot-companion.js`).

| File | What | sha256 |
|---|---|---|
| `robot-companion.js` | The `<robot-companion>` element | `d747e12530a1e6e5f30df0f530c48c3a1e65bccb1c410f3ffbdb2123e0624710` |
| `robot-fx.js` | Its effects, loaded by it on demand | `cea6a09a0d207fbd32eeb11ad113442afe70518da0337e7db929b6a13ec01c01` |
| `vendor/three.module.min.js` | three.js r184 (MIT, © three.js authors) | `d58eb29e87e57583b6cdcfdd6b1823b82ad1024256c6dde07d4947f02e9cd465` |
| `vendor/three.core.min.js` | three.js r184, imported by the module above | `36c9439657066258e6ec370343ef97d2a723f2958ca50a4f23240a4108e1d5a1` |

Made for this app:

| File | What |
|---|---|
| `echo-logo.png` | "echo" on the robot's chest, in place of the myt logo (Atkinson Hyperlegible Bold, OFL; 512 by 256, transparent). |
| `echo-head.png` | A still of the robot's head (256 by 256, transparent), for the small badges (`src/components/RobotBadge.tsx`). Rendered from the robot with Playwright and cropped. |

The app loads three.js from here (the element's `three` attribute), never from a CDN, and the script only after the first render. Lint skips this folder (`.oxlintrc.json`).
