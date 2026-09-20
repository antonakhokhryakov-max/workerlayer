# Milestone 13 — execution isolation foundations

This is the first real slice of the governed workstation boundary. It is not Kubernetes, not Docker-in-Docker, and not an enterprise control.

## What you can do

- Each assignment gets a **task-scoped environment**. Consequential workstation file work happens there, not against the whole host store.
- When the run finishes, that environment is **torn down**. The spreadsheet, slides, originals, and audit stay on the desk.
- Task identity and capabilities still decide what may run. An undeclared capability and a cross-task payroll read are still **denied**.
- From inside the environment, a host path such as `/etc/passwd` and a sibling secret next to the task are **not readable**.

On this development host the default provider is Docker when `docker info` succeeds, else a user + mount namespace (`unshare-mount`) with only the task workspace bound in. If that is not available, WorkerLayer falls back to a process + filesystem jail. The kind is sticky per Task. Customers do not choose.

## What this is not

Not SSO. Not SIEM. Not a VPC. Not a cluster. Harbor, Ironwharf, the quality loop, OCR diligence, the review surface, and the effort board stay as they are.
