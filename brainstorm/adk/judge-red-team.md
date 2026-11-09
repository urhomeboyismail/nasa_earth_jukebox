# Judge red team: will ADK help or hurt?

TL;DR: ADK helps only when the listener never depends on it and the judge can see the evidence: offline drafting plus a blocking audit. A free-roaming chatbot lowers Validity and Relevance and adds stage risk.
Ranking: (i) offline build and audit > (ii) grounded runtime Narrator > (iii) runtime multi-agent crew.

## 1. Criteria (up / down)

- **Influence.** Up: new layers can get cited Q&A fast. Down: a runtime agent needs network and a key, so offline blind users lose it.
- **Creativity.** Up: "an agent that tries to break its own claims" is rare. Down: "LLM chatbot" is the most common add-on.
- **Validity.** Up: an audit log catches invented numbers. Down: every generated sentence is a new thing to verify, and an LLM cannot check pixel decoding.
- **Relevance.** Up: "ask it questions" fits the brief. Down: the challenge is frames to sound, and the agent adds nothing to the sound.
- **Presentation.** Up: a live refusal is memorable. Down: dead air or a slow reply wrecks a 30 s video.

## 2. Five attacks and the best honest defence

1. **Hallucination.** The runtime path can only return fact IDs. Uncited text is never rendered (ADR-0003). Show a refusal.
2. **"Why not a static page?"** For the core, it is static, on purpose. Say so. Agents draft and audit before the event. The static page is the safe product.
3. **Latency.** Answer text is local. The agent, if it runs at all, only picks IDs. It is never in the sound path. On timeout, fall back to the local Q&A list.
4. **Reproducibility.** Model output varies. Ship the reviewed answers as files. Log model, prompt and date. The product never needs a rerun. Do not claim determinism.
5. **Hype.** State what agents did and did not do. Never write "AI-powered". The headline is NASA pixels and silence.

## 3. Three designs, ranked

1. **(i) Offline build and audit, visible log.** Strongest. Zero stage risk, matches "truth first", and the log is evidence judges can open. Add a *code* checker as the blocker (every number and name in an answer must exist in `facts.json`). Weakness: invisible in a 30 s demo unless we surface it.
2. **(ii) Grounded runtime Narrator, code-enforced citations.** Gives a live "ask it" moment, and ADK is visibly used. Costs: network, latency, a second failure point. Keep it as an optional stretch on top of (i).
3. **(iii) Runtime crew with Fact-Checker.** Weakest. More hops, more latency, and an LLM checking an LLM is not independent. Judges will read it as hype. Run the checker offline, inside (i).

**Story:** "Every sentence has a source, and a machine tried to break it." In the 30 s video, spend about 3 s at the 21-26 s end-card slot: a log line "[N] drafted, [M] blocked, [K] human-edited" (all to-be-measured) and one refusal ("Not in this record"). Put the full log on slide 7.

## 4. Proving it is not making things up

- Commit the audit log: claim, fact ID, source URL, checker verdict, human sign-off, edit diff.
- Three refusal examples: an unlisted question, a leading question ("did X cause 2012?"), a number outside the record.
- Adversarial eval set. The red team writes the questions before running anything. Report "[to be measured] of [N] passed", including failures. Never round up.
- Show the data path: agents never touch `story.json` values. Pixels set the pitch, not a model.
- Count blocked drafts and human edits. A zero-block log looks fake.

## 5. AI-disclosure wording (draft)

"AI helped us write and check the words. It did not create any data value, pitch or sound. Every value comes from NASA GIBS pixels decoded by script. Every sentence in the app is tied to a source ID and was checked by a person. Tools: Claude (Anthropic) for planning and documents; [Google ADK with Gemini, if used] to draft and audit Q&A, with the log at [path]. Code written with AI help: [list]. AI-made audio or images: [none, confirm]."

It helps because it is specific, bounded and checkable. Vague "AI-powered" and silent omission both hurt.

Weakest point of my own review: I assume judges reward restraint over a live agent. Some may prefer a visible runtime ADK demo. I did not verify ADK details or the 2026 AI-use rules, which are expected around 13 Nov [unverified].
