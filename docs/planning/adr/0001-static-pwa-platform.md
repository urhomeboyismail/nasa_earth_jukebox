# ADR-0001: Static offline-first web app; laptop + NVDA primary demo rig

**Date**: 2026-11-06
**Status**: proposed
**Deciders**: brainstorm team (tech-architect draft, facilitator), human checkpoint 2026-11-06

## Context

Six students, ~48 h. The primary user is blind and uses a screen reader. With TalkBack/VoiceOver on, custom drags and multi-finger gestures do not reliably reach a web page [verified: https://support.google.com/accessibility/android/answer/6151827]. The submission needs a public link with no login. The stage may have no internet.

## Decision

We ship one installable static web app (service worker, cached JSON and frames). It has no required backend and uses only native controls (buttons, switch, range slider). The primary demo rig is a laptop with NVDA and keyboard; an Android phone with TalkBack is the second rig, shown in a short recorded clip.

## Alternatives Considered

### Alternative 1: Native Android/iOS app
- **Pros**: direct touch, haptics on iOS, full audio control.
- **Cons**: two codebases or one platform only; store install; no public no-login link.
- **Why not**: doubles the work in 48 h and breaks the submission-link rule.

### Alternative 2: Mobile-first web app with a touch-map canvas
- **Pros**: the "touch the planet" feel.
- **Cons**: screen readers capture the gestures; the WebKit `role=application` direct-touch bug [verified: https://lists.webkit.org/pipermail/webkit-unassigned/2023-August/1117814.html].
- **Why not**: fails the primary user.

## Consequences

### Positive
- One codebase runs on NVDA, TalkBack and VoiceOver; nothing to install.
- The demo works in airplane mode; GIBS outages don't matter at runtime.

### Negative
- No iOS haptics (the Vibration API is Android Chrome only [verified: https://caniuse.com/mdn-api_navigator_vibrate]), so haptics are never core.
- Less "spatial" feel than a touch map.

### Risks
- Audio unlock and the iOS silent switch: Play creates the AudioContext, a "Test sound" button is added, and a pre-rendered clip is kept as backup.
- Revisit if the demo phone can't install the app or lacks a required API.
