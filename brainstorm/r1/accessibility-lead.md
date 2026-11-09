# Accessibility lead, Round 1

TL;DR: With TalkBack/VoiceOver on, free one- and two-finger drags do NOT reliably reach a web page. Build "touch the planet" on screen-reader-native controls first, and make free-drag an opt-in extra.
Cut all multi-finger gestures. Radical option: aim the phone like a pointer, which no screen reader intercepts.

## Evidence on the key question

- TalkBack turns most one-finger gestures into two-finger ones, and users can remap them [verified: https://support.google.com/accessibility/android/answer/6151827?hl=en]. Two-finger gestures are screen-reader commands, not ours.
- Chromium describes a "passthrough" mode that sends touch to the page as if accessibility were off [verified: https://www.chromium.org/user-experience/touch-access/]. That page covers the Chromium/ChromeOS layer. Whether Android TalkBack in Chrome offers it on a web canvas is [unverified], as is the claim that Explore by Touch delivers hover events.
- A WebKit bug says VoiceOver does not allow direct touch on `role="application"` [verified: https://lists.webkit.org/pipermail/webkit-unassigned/2023-August/1117814.html]. Fixed since? [unverified]. Direct Touch is native-app only [unverified].
- Real options: hover/pointer events (Android, maybe), slider or application roles (weak on iOS), button lists, voice, keyboard/switch, device motion.

## Upgrade: "Planet Dial"

Replace free 2D drag as the core with:
1. **Place** slider: 36 stops on a spiral from Mauritius outward. Swipe up/down (the screen reader's "adjust") changes the stop, plays its pitch and sets `aria-valuetext`: "Greenland, 2023, 1.8 degrees above normal."
2. **Year** slider: same pattern. Replaces two-finger time travel.
3. **Find the change** button, plus warmer/colder pings as you step the Place slider.
4. Optional **"Free touch" toggle**: a canvas with pointer events, announced honestly ("works best with TalkBack off").

Every stop's text lands in a visible `aria-live="polite"` line, which also feeds braille. Our own speech is off when a screen reader is detected, so we never talk over it.

- **Blind user:** swipes to the Place slider, adjusts, hears pitch and value in under 30 s.
- **Low vision:** large thumb track, 7:1 contrast, colour-blind-safe ramp, text to 200%, finger drag on the map still works.
- **Deaf-blind braille:** slider value text and the live line arrive on the display; vibration marks stops on Android only.

## Radical: "Aim the Earth"

Hold the phone like a torch. Heading picks longitude, tilt picks latitude (`deviceorientation`), and the sound plays what you point at. No on-screen gesture exists, so nothing conflicts. Risks: indoor magnetometer drift; iOS permission prompt [unverified].

## Cut, and the biggest risk

Cut every multi-finger gesture: hold-and-slide time travel, two-finger split stereo, edge swipes. They collide with screen-reader commands and fail WCAG 2.5.1 without alternatives. Keep compare as two buttons.

Biggest risk: the headline gesture silently fails for the primary user. Fix: a Day-1 spike on a real Android with TalkBack, testing hover events and double-tap-and-hold on a canvas. First tester task: "Find the place that changed most."

Weakest point of my own proposal: Sliders turn a map into a list and lose the spatial feel that is the soul of "touch the planet". The spiral order is my guess, untested.
