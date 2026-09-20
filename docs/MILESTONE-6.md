# Milestone 6

The effort board reports **current 0-fix performance**, not leftover corpses.

## What the board includes

- **Accepted** and **rejected** runs — those are real human decisions.
- The **latest** assignment in that pack if it is still **waiting for review**. An older awaiting-review run behind a newer accept is a leftover and is left out.

## What the board leaves out

Older unfinished or pre-review leftovers (`completed` without a review, superseded awaiting-review runs). They stay under **Recent tasks** and on their task pages. History is not rewritten. The average just does not use them.

`pnpm aether effort` prints the same rule.

## What this is not

Not a new screen. The quality loop, accept / one fix / reject, desk opens, task identity, real denies, and the audit stay as they were.
