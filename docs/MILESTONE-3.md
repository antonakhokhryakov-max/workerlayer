# Milestone 3

After the worker finishes, a person reviews the delivery score. That is not a chat.

## What you can do

- **Accept** — the assignment is done. The temporary worker identity expires. Outputs and the audit remain.
- **Request one fix** — pick a structured target (consistency, uncertainty, citations, or slides). The worker runs one correction pass, re-scores, and asks again.
- **Reject** — stop. The identity expires. That counts as a human intervention.

Each requested fix increments `userInterventions`. Accepting a pack that needed no fix keeps that number at zero.

## What this is not

Not a prompt box. Not SSO. The quality loop, opened desk files, task identity, and the live deny stay in place.
