# R5 Stress Test — Accessibility Lead

TL;DR: The winner is screen-reader-safe if every control is a native button, switch or slider and every sound event has a text twin. Four steps risk breaking: audio start, speech collision, slider chatter, the iOS silent switch.
No blind tester is booked, so all verdicts are a desk review. [assumption] means untested on our build.

## 0. Two rules for every step

**Audio start.** Browsers only start Web Audio after a user gesture [verified: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy]. The first screen is silent. "Play" creates and resumes the AudioContext. TalkBack and VoiceOver double-tap send a real click [assumption]. iOS: the silent switch may mute Web Audio [assumption]; first-run text says so, and a "Test sound" button plays the 2 s reference tone.

**No talking over the screen reader.** No app TTS by default. All words go in one `aria-live="polite"` region, so the user's own screen reader speaks them. For any message: (1) fade sound out in 150 ms, (2) write text, (3) resume only on Play or a "Continue" button, never a timer. Messages cap at 140 characters; more sits behind "Read more". Optional "App voice" is off by default and follows the same pause rule.

## 1. Walkthrough (a) Blind, Android TalkBack

Swipe right/left = next/previous item; double-tap = activate.

1. **Open.** Title "Earth, Out Loud"; focus on h1; "Skip to layers" link. OK.
2. **Choose.** Three radio buttons. Swipe, double-tap. Live text: "Arctic sea ice selected. 2000 to 2025." No map or carousel.
3. **Orientation.** Button "Listen to 20-second orientation": what the sound is, A musical vs B strict, silence means no data. Text twin below. OK.
4. **Play.** Double-tap "Play"; AudioContext starts. 2 s reference tone, then the story. Live text only at the 3-5 key moments.
5. **Silence beat.** Sound stops; text "Years 1990-1992: no data, not zero." Risk: silence feels like a crash. Fix: 300 ms earcon before it, text right after.
6. **Side A/B.** Swipe to "Strict data mode, off"; double-tap; hears "on". Label never changes, only state. Sound restarts at the same year. OK.
7. **Year slider.** Native `input[type=range]`; swipe up/down or volume keys. BREAKS: every step floods speech and retriggers audio. Fix: audio only after 400 ms idle or on "Play this year"; `aria-valuetext` "2012, September, ice extent 3.6 million km2" only if sourced, else "2012, no value loaded" [verified: https://www.w3.org/WAI/ARIA/apg/patterns/slider/].
8. **Ask.** 20-40 question buttons with a filter box. Answer in the live region with its citation ID. Voice input optional.
9. **What the sound hides.** Buttons "Hear hidden version", "Hear revealing version", "Compare". Text says which hides the change and why.
10. **Mauritius close** (if gate passes). Button "Mauritius sea temperature" sets the same slider; text gives range and bin size.

TalkBack one-finger drags move focus, so we rely on no canvas gestures [verified: https://support.google.com/accessibility/android/answer/6151827].

### (b) VoiceOver: differences only
- Radio group must be real inputs so it reads "1 of 3".
- Start audio inside the Play tap handler itself [assumption]. Silent switch can mute everything: BREAKS without the Test sound mitigation.
- `role=switch` reads "switch button" [assumption: check Safari].
- Swipe up/down adjusts the slider; `aria-valuetext` must be on the element.
- Keep focus still during playback; VoiceOver drops polite announcements when focus moves. No role=application.

### (c) Low vision
- Single column at 400% zoom, 200% text (1.4.10, 1.4.4).
- Marker at least 24 px, two-colour outline, with a text label of the sonified position.
- Silence map uses hatching plus the words "No data", never colour alone.
- "Pause motion" button; sticky controls never cover the slider.
- GIBS legend images are tiny: provide a text legend table.

### (d) Deaf-blind, braille display
- Every event is a line in the live region; short, starts with the year, no emoji.
- Slider sends one line on commit, not per tick.
- "Show data table" button (year, value, source) is their main product.
- Every earcon has a text twin.
- Side B's table, not sound, carries the meaning.

## 2. Verdict per core feature

1. Choose menu: **yes**.
2. Side A/B switch: **yes-with-fix** (constant label, role=switch, test Safari).
3. Silence map: **yes-with-fix** (earcon before, text twin, hatching).
4. Reference tone: **yes** (add Test sound for iOS).
5. Year slider and controls: **yes-with-fix** (debounce speech and audio, sourced valuetext only).
6. Cited answers: **yes**.
7. What the sound hides: **yes-with-fix** (explicit text on which is which).
8. Sighted view: **yes-with-fix** (marker aria-hidden, long alt, text legend).

## 3. Blind tester script (30 min, own phone and screen reader)

Consent, read aloud, then record "yes": "We are students testing a website, not testing you. You may stop any time without giving a reason. We will record audio and your screen reader output. May we use short quotes from today in our submission and video, under your first name or anonymously, as you choose? You can withdraw a quote within 7 days. Do you agree?"

| # | Task | Success | Record |
| --- | --- | --- | --- |
| 1 | Open link unaided | First heading in under 30 s | time, route |
| 2 | Choose Arctic sea ice | Correct layer, says so | time, taps |
| 3 | Start sound | Hears reference tone | silence, help needed |
| 4 | Say what the tone was for | Names a baseline | their words |
| 5 | Find the no-data years | Names gap unaided | time, cue used |
| 6 | Switch to Strict | States which side is on | label read, confusion |
| 7 | Move to 2012 | On 2012 in under 60 s | flooding, errors |
| 8 | Ask why ice changed | Cited answer, says source | clarity |
| 9 | Hear the "hides" scene | Explains which hid the change | their words |
| 10 | Retell | "Biggest change?" plus 1-5 for clarity, effort, trust | quote, scores |

Note every "I'm lost". No hints before 2 min per task.

## 4. WCAG 2.2 AA risks [verified: https://www.w3.org/TR/WCAG22/]

- 1.1.1 / 1.4.1 frame and silence map: long alt, hatching plus words, text legend.
- 1.4.10 reflow: single column at 400%.
- 1.4.11 contrast: marker and thumb 3:1 over ice white and ocean blue.
- 2.2.2 / 1.4.2: Pause motion and Pause sound; sound only after Play.
- 2.4.11 focus not obscured: no sticky bar over focus.
- 2.5.8 target size: 24 px minimum, build 44 px.
- 2.5.1 gestures: none custom; all via buttons.
- 3.3.2 labels: all labelled, switch label constant.
- 4.1.3 status: one rate-limited polite region.

Weakest point of my own proposal: Everything about TalkBack, VoiceOver and the iOS silent switch is untested, and leaving speech to the user's screen reader means we cannot control timing, so story pacing may feel off.
