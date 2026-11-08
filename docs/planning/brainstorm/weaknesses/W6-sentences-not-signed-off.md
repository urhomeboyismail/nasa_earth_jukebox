# W6: No person has signed off the sentences, and the tests were written by the author

TL;DR: Every sentence the app says as fact (13 facts, 13 answers, key moments, gap messages) was written by code templates or by an AI. The audit log shows 0 of 13 answers signed by a person. The eval questions were written by the same AI that wrote the answer aliases.
Status: **open**. Found in: T5, T6, T2. Owner: red team + one named reader.

## Why it matters
- Rule 5 says everything spoken as fact must be grounded. The code checker proves each number exists in the data files. It cannot prove a sentence is fair, clear or not misleading.
- Scores from tests written by the author are optimistic.
- The AI-use text says "a person reads every sentence". That is not yet true.

## How to fix
1. A named person reads all 13 facts, 13 answers, 4 key moments and the gap message, and edits or approves each. Record sign-off in `agent/audit-log.jsonl`.
2. The red team writes a new, independent set of at least 15 questions (the 7 real types and the adversarial types) **without** looking at the aliases. Run them once. Report the result as it is.
3. Do not tune the matcher on that second set.

## Done when
The audit summary line reads "13 drafted, 0 blocked, [K] human-edited, 13 signed", with a real name or initials against each, and the independent question set has been run.
