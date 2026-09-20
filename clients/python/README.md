# Tiny WorkerLayer Python client

One module, stdlib only. Not an SDK. You are an outsider: you do not edit the assignment desk.

**Alpha — not for sensitive production workloads.** Synthetic files only. Success is ALLOW / ALLOW / DENY.

## 15-minute path

```bash
cp .env.example .env
# set AETHER_API_KEY to a string only you know
pnpm install
pnpm dev          # leave running
pnpm example      # other terminal, repo root
```

Or `python3 clients/python/example.py`. You should see:

```
WorkerLayer — Alpha — not for sensitive production workloads
WorkerLayer Alpha — compute <docker|unshare-mount> (sticky per Task; you do not choose). Success is ALLOW / ALLOW / DENY in the audit, not only finished work. POST /api/v1/propose does not grant.
ALLOW  notes.read
ALLOW  notes.write
DENY   notes.export
environment destroyed
identity expired
```

Missing key → 401 `missing_api_key`. Wrong key → 401 `invalid_api_key`. Two keys (`AETHER_API_KEY` plus `AETHER_API_KEYS`) are two principals: `test_cross_principal_404` — Bob gets **404** on Alice’s task, not 403. Alice’s own Manifest still ALLOW / ALLOW / DENY. The key does not grant tools.

```python
from aether import Client
c = Client("http://127.0.0.1:43147")  # host running pnpm example — not a laptop URL
c.health()  # stranger line: sticky compute + ALLOW/ALLOW/DENY; propose does not grant
# proposal = c.propose("Stamp the slip. Do not read payroll.")  # sketch — granted stays false
# c.grant("wharf", chosen_tools, confirm=True, proposal=proposal)  # Grant selected, Task-scoped; API key does not grant
```

A second sample registers tools WorkerLayer has never heard of:

```bash
pnpm example:custom
```

`ALLOW wharf.stamp`, `DENY wharf.payroll`. See [docs/ALPHA.md](../../docs/ALPHA.md). `pnpm example` talks to the host on this machine (`127.0.0.1:43147`). The founder desk is [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) (temporary tunnel). Keyed `/api/v1` still requires `AETHER_API_KEY`.
