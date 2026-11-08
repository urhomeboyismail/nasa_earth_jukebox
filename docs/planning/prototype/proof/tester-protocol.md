# Blind and low-vision tester session: protocol (T10)

TL;DR: A 30-minute session, one facilitator and one note-taker, one tester on their own device and screen reader. We test the website, not the person. We write down what happened and never round up.
Source: FINAL §13. Bookings live in `brainstorm/t0-lockin.md` §D. Results go in `proof/results-note.md`.

## Before the session (facilitator)
- [ ] Public link works logged-out on a fresh device (T9 check).
- [ ] Tester's device and screen reader noted (for example TalkBack on Android, VoiceOver on iPhone, NVDA on Windows).
- [ ] Phone volume checked with "Test sound". A backup laptop with NVDA is ready.
- [ ] Recording method agreed with the tester (audio and screen-reader output). No video of the person unless they ask.
- [ ] Note-taker has the observer sheet below.
- [ ] Say nothing about how the app works. No hints in the first 2 minutes of any task.

## Consent (read aloud; record the spoken "yes")
1. "We are testing the website, not you. You cannot do anything wrong."
2. "You can stop at any time, for any reason, and you do not have to say why."
3. "With your permission we will record the audio and what your screen reader says. Is that OK?"
4. "We may quote you. We would use only your first name, or no name, whichever you choose. Do you give permission for a quote, and how should we name you?"
5. "You can change your mind and ask us to remove your data within 7 days."
6. "Do you have questions before we start?"

Record: name or alias, date, yes/no for each of 3 and 4, device, screen reader, how long they have used it.

## Tasks (10). Time each. Count every "I'm lost".
| # | Task | Pass means | Time | Lost? | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Open the page unaided | Reaches the first heading in under 30 s | | | |
| 2 | Choose a story | The chosen story is confirmed by the screen reader | | | |
| 3 | Start the sound | Hears the sound; if the story has a baseline, hears the reference tone | | | |
| 4 | Say what the reference tone means | Says "the starting level" or similar, in their own words | | | |
| 5 | Find the steps with no data | Names them after hearing the click through the gap and reading the one message | | | |
| 6 | Switch to Strict data mode, press Play, say which mode is on | Correct mode named | | | |
| 7 | Move to a named step | In under 60 s | | | |
| 8 | Ask one listed question and one leading question | Gets a sourced answer, and a refusal for the leading one | | | |
| 9 | Say which "What the sound hides" version hid the change | Correct, without being told | | | |
| 10 | Retell the biggest change, then rate clarity, effort and trust 1 to 5 | Retelling matches the story's numbers | | | |

Rules: no hint before 2 minutes on a task. After 2 minutes you may give one hint and mark the task "passed with a hint". After 5 minutes, stop the task and mark "not passed". Never mark a pass the tester did not earn.

## Agent questions (6) if the Ask section is used
1. Did you trust the answer? Why or why not?
2. How did you check it?
3. What happened when you asked something it cannot know?
4. Was the answer too long or too short?
5. Did the app ever speak when you did not expect it?
6. Could you tell the short answer from "Read more"?

## Voice input
Buttons first. If voice input is ever shipped: the tester says 5 listed questions. If more than 1 is misheard, drop voice input from the demo.

## Observer sheet (note-taker fills in live)
- Time of each "lost" moment and what the screen reader said just before.
- Any time the app made sound or text the tester did not expect.
- Any time the screen reader and the live message talked over each other.
- Words the tester used for things (to fix labels).
- One quote worth keeping (with permission).

## After the session
- [ ] Thank the tester. Tell them what will happen with their words.
- [ ] Within 24 hours: fill in `proof/results-note.md` from the sheet, not from memory.
- [ ] File each problem as a fix with the task number.
- [ ] Do not change numbers in the pitch until the results note is updated.

## What we never say
- Never say "tested with blind users" unless a session happened with n shown next to it.
- Never use a sighted teammate's result as a tester result.
- Never reuse example numbers from earlier files.
