# ADK agents from a blind user's side (accessibility-lead)

TL;DR: An agent is allowed only when it produces short, cited text that the user asked for, and code (not the prompt) enforces the limits.
Best use: route questions to pre-written facts and write descriptions offline. Worst use: free talk during playback.

## 1. Eight rules for agent speech and text

1. **Text first.** Every agent output is text in the one polite live region; it never takes focus [verified: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html]. App TTS stays off.
2. **User-initiated only.** The agent writes nothing unless a button or question triggers it. Key moments come from `story.json`, not the agent.
3. **Answer first, then detail.** First sentence answers, 140 characters max (FINAL §2); detail sits behind "Read more".
4. **Say the source.** Every answer ends "Source: [fact ID, name]".
5. **Say how sure.** One fixed tag from code: "From data", "From a cited fact", "Description, not measured".
6. **Admit "I don't know."** One fixed line when no fact ID matches. No guessing.
7. **Neutral words.** No "alarming", "sadly", metaphors. Numbers carry units from the file.
8. **One voice at a time.** Sound fades only when the text is ready, and resumes only on Continue (FINAL §2).

## 2. Three roles

| Role | Text output | Braille route | Trigger | Failure that hurts |
| --- | --- | --- | --- | --- |
| **Guide** ("where am I / what changed") | "Step 12, Sept 2012. Ice seen: lower than step 11. Source: story file." Template fills numbers from app state; the model only routes. | Same live line, plus a read-only "Log" list to re-read | Button or typed question | Wrong step or stale value after the slider moved |
| **Describer** (alt text, orientation) | Runs offline in the pipeline; a human checks; stored in `story.json` | Alt text, data table, "Describe picture" button | Button; never at runtime | Describes cloud as ice, or invents a feature |
| **Teacher** (verbosity 1/2/3) | L1 one sentence (default); L2 a paragraph; L3 glossary. Only from `facts.json`. | Same live region; level is a labelled radio group | User picks level | Over-explaining; an unsourced "because..." |

## 3. Harms and code-level guardrails

| Harm | Guardrail |
| --- | --- |
| Hallucinated confidence | Output schema requires `fact_ids[]`. Code checks every number in the text against the story/facts files; any mismatch replaces the answer with the "I don't know" line. |
| Flooding the live region | One queue in code: max one message per user action, none during Play, 2 s minimum gap, hard length cut with "Read more" (matches WCAG 2.2.2 control of updates [verified: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html]). |
| Voice collisions | No TTS by default; no agent output while Play runs; sound pause is code-driven, not asked of the model. |
| Latency dead air | Sound keeps playing until the answer arrives. After 1 s, one text line "Working." After 6 s, abort: "No answer. Try a listed question." Listed Q&A work offline with no agent. |
| Over-description | Level 1 default; length cap in code; Describer text frozen at build time. |
| Agent moves focus or edits the DOM | Agent can only append to the live region and the Log list. |

## 4. Test script for the blind tester (agent only)

1. "Ask where you are. Did you trust the answer? What made you trust or doubt it?"
2. "How did you check it? Which control or source did you use?"
3. "Ask something the app cannot know. What did it say? Was that useful?"
4. "Was any answer too long, too short or too many? Tell me which."
5. "Did the agent ever speak or write when you did not expect it? When?"
6. "Switch the detail level. Could you tell the difference? Which level would you keep?"
Record words, not scores only. Report n.

## 5. Voice input

- Chrome's speech recognition may send audio to a server and fail offline [verified: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition]. Our app is offline-first, so voice cannot be required.
- Mauritian-accented English accuracy: [assumption] lower than for US English; no data. Test it: the tester speaks 5 listed questions; if more than 1 is misheard, drop voice from the demo.
- Rule: buttons and the filter box are primary. Voice, if shipped, is a push-to-talk button that echoes "I heard: ..." as text and asks to confirm before answering. Sound must be paused while listening (the mic would hear the sonification).
- Worth it only for free-text questions on a phone. Not worth it for navigation: the slider and buttons are faster. Screen readers already offer OS dictation [assumption].

Weakest point of my own proposal: the number-matching check catches wrong figures but not a wrong claim made with right numbers, and the 6 s timeout and 140-character cap are untested guesses that a real tester may reject.
