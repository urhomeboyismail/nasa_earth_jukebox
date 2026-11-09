# R3 Critique — Accessibility Lead

TL;DR: Options 1 and 3 are the most accessible by design because they rely on screen-reader-native controls (sliders, buttons, live text). Option 0 and the free-touch parts of 2 and 3 break for our primary user (TalkBack on).
Laptop + NVDA is a good second platform but a bad only platform: the primary persona is on Android TalkBack.

| Option | Influence | Creativity | Validity | Relevance | Presentation | Feasibility | Accessibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Baseline | 4 | 3 | 2 | 4 | 3 | 1 | 2 |
| 1 One Story, Two Ears | 4 | 4 | 5 | 5 | 5 | 5 | 5 |
| 2 Frame Jukebox | 3 | 3 | 4 | 4 | 4 | 4 | 3 |
| 3 Time Under Your Finger | 5 | 5 | 3 | 5 | 4 | 3 | 4 |
| 4 Hold the Ocean | 4 | 4 | 3 | 4 | 5 | 3 | 3 |
| 5 Tune Your Own Earth | 3 | 4 | 3 | 3 | 3 | 3 | 4 |

## Per option

**0 Baseline.** Fatal flaw: ten features, and the headline (touch the planet, multi-finger, five voices) depends on gestures TalkBack captures. TalkBack touch exploration turns one-finger drags into focus movement and remaps multi-finger gestures [verified: https://support.google.com/accessibility/android/answer/6151827]; WebKit role=application bug noted in pool. Fix: button/slider equivalents first; cut free touch and five voices to one.
- Blind SR: cannot start the headline feature unaided. Five voices plus drone plus haptics is overload.
- Low vision: unknown contrast on the frame view; no stated zoom plan.
- Deaf-blind: haptic language is Android-only and not text; needs text mirror of every event.

**1 One Story, Two Ears.** Fatal flaw: a single story could feel thin, and Side A/B toggle must be a plain two-state button, not a gesture. Fix: `role=switch` labelled "Musical / Strict", plus "Where am I" and "Replay from start" buttons. Home-pitch drone must be mutable and off by default when the screen reader speaks.
- Blind SR: Play, Side switch, and a step slider using `aria-valuetext` ("2012, September, extent 3.6 million km2" only if sourced). Starts in under 30 s.
- Low vision: needs a high-contrast frame with a text overlay at 200% zoom; WCAG 1.4.4 and 1.4.11 [verified: https://www.w3.org/TR/WCAG22/].
- Deaf-blind: silence map is meaningless without sound, so mirror it as a text line "no data, not zero" in an `aria-live=polite` region that braille displays can read.

**2 Frame Jukebox.** Fatal flaw: the visible sweeping bar is meaningless to a blind user, and an auto-playing sweep competes with the screen reader. Fix: sweep is opt-in; the main control is arrow-key and button column stepping (Previous/Next column) with a spoken value; sweep pauses on any SR focus change.
- Blind SR: keyboard stepping works; touch stepping needs on-screen buttons of 44 px or more (WCAG 2.5.8 requires 24 px minimum) [verified: https://www.w3.org/TR/WCAG22/].
- Low vision: the moving bar needs a pause control (WCAG 2.2.2).
- Deaf-blind: column values must be text, not only tones. Crossfade glide has no text equivalent unless the narrator-free caption says "rising, +X".

**3 Time Under Your Finger.** Fatal flaw: Aim the Earth uses device orientation, which is hard for a blind user to calibrate and unavailable on a laptop. Optional free-touch canvas hits the TalkBack conflict. Fix: lead with Planet Dial sliders and Find-the-change; make Aim the Earth a bonus with a "snap to Mauritius" button. Cap warmer/colder pings so they never overlap speech.
- Blind SR: sliders with spoken `aria-valuetext` are the best-supported pattern in TalkBack and NVDA. Strong.
- Low vision: map view must not be the only way to see place; give a text list of regions.
- Deaf-blind: live text line is the right idea; make sure it updates on slider commit, not each tick, so braille does not flood.

**4 Hold the Ocean.** Fatal flaw: "held to the ear like a shell" is a sighted-natural gesture that conflicts with TalkBack's earpiece routing and proximity sensor behaviour [assumption]. It also puts the phone speaker near ears with no on-screen control reachable. Fix: normal Play button; the shell pose is a pitch image, not the interaction. Coast duet needs a stereo-off mono fallback.
- Blind SR: one dial is simple, which is good. Data is Amber (login), so sound may be hollow.
- Low vision: QR postcards need a short URL and text caption.
- Deaf-blind: the two voices must be described as a text difference ("offshore warmer by X") sourced from data.

**5 Tune Your Own Earth.** Fatal flaw: an editor adds many controls; a blind user must hold state (what is high, which scale) in memory. Fix: three presets with names, then one "swap high/low" button; A/B compare with a "Which is clearer?" prompt. Strong for agency, but it shifts risk from the sound to the UI.
- Blind SR: form controls are fully native, so SR support is easy if labelled.
- Low vision: fine with standard form contrast.
- Deaf-blind: saved mapping needs a plain text description (already in the pitch).

## Facilitator idea: laptop + NVDA primary

Verdict: good as the judges' demo and testing platform, bad as the sole claim.
- For: keyboard operability is the best-supported screen-reader path; NVDA is free and widely used by blind students [assumption: no Mauritius data]; it dodges gesture capture. WebAIM's survey reports desktop/laptop use is common for blind users, with JAWS and NVDA leading [verified: https://webaim.org/projects/screenreadersurvey10/].
- Against: the persona and the Mauritius angle use Android TalkBack, and mobile screen readers are widely used by blind users too [verified: same WebAIM survey]. Judges will ask "does it work on her phone?". The laptop-only demo hides the exact risk.
- Recommendation: build for keyboard and sliders first (works on both), demo on laptop with NVDA for reliability, and record one 10 s TalkBack clip as proof. The first tester task: unaided, start Option 1 on her own phone and tell us the biggest change.

## Biggest risk and first test

Risk: custom touch and sound-only cues that a screen reader or braille display never receives. Fix: every cue has a button and a live-region text twin. First test: a real blind student uses TalkBack to find the biggest change in under 30 s.

Weakest point of my own proposal: Scores are from a desk review with no blind tester; WebAIM figures and the TalkBack gesture claims are not checked on our actual build, and I rated Option 1 a 5 partly because it is simplest, which could reward dullness.
