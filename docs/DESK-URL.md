# Durable public desk URL (Alpha)

**Alpha — not for sensitive production workloads.** Synthetic files only.

## Architecture (locked)

```
laptop browser  →  lasting public URL (Vercel control surface only)
                         │
                         │  WORKERLAYER_HOST_URL  (proxy /api, fetch desk state)
                         ▼
              one Node process on an always-on HOST
              (Ant’s Mac mini / dogfood machine)
              cursor worker start + pnpm start
                         │
                         ▼
         WorkerEnvironment + sticky compute + tear-down
         (unshare-mount / Docker / process-filesystem)
```

- **Origin** stays engineering **source of truth**. Agents commit and push here first.
- **GitHub** is a **Vercel-import mirror only**. GitHub is not the product SoT. Vercel Import does not speak Origin git, so we mirror `main` to GitHub after Origin. Do not pretend GitHub is where the product lives.
- **Vercel** is the **desk control surface** only. It must **not** run `startTask` / WorkerEnvironment / Manifest exec. Naive Next API would run Workers on Vercel — we refuse that. `VERCEL=1` without `WORKERLAYER_HOST_URL` returns 503 `missing_host_url` on `/api`. With `WORKERLAYER_HOST_URL`, `/api` proxies to the Mac mini. Compute is **not in the browser**.
- **`AETHER_API_KEY`** is identity only, host `.env` only — never a client grant. Desk Grant selected stays `desk-session`. No SSO. Alpha banner stays.

This is the same fork as before: **Fork Host** (lasting URL in front of the mini process) versus **Fork Split** (Vercel control surface + companion host). One product fork — do not mix them. Alpha is **Fork Split**. Importing this app into Vercel without `WORKERLAYER_HOST_URL` would run Workers on Vercel. The code now refuses that.

## Dual remotes (honest)

| Remote | Role |
| --- | --- |
| `origin` | Origin — engineering source of truth. FE lands here. |
| `github` | [https://github.com/antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer) — Vercel-import mirror only. **Not** product SoT. Repo exists. This agent cannot push (`gh` logged out). |

This run: `gh auth status` is still **logged out**. Public API `GET /repos/antonakhokhryakov-max/workerlayer` is **200**. `git ls-remote` sees `main`. `git push` failed: `fatal: could not read Username for 'https://github.com': No such device or address`. Connecting GitHub in Cursor Desktop does not inject `GH_TOKEN` into this Origin-backed Cloud Agent. The Vercel MCP connector is `needsAuth` — **do not block on it**. Anton Imports `antonakhokhryakov-max/workerlayer` in the Vercel **dashboard** after Origin `main` is mirrored there.

## This stretch — both lasting ships blocked

**Live today:** [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) — **temporary** Cloudflare quick tunnel to *this* build host, not the Mac mini. If it dies, Founding Engineer keeps `pnpm dev` running, restarts `cloudflared tunnel --url` against that desk, and updates `src/lib/public-desk.ts` (quick tunnels mint a **new hostname** each start). Compute is still host-side on that process. Temporary CF remains until a lasting URL is live. We did **not** invent a Vercel URL. **Vercel is not connected.**

| Path | Status | Why |
| --- | --- | --- |
| GitHub mirror | **Blocked on push** | Repo [antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer) exists. This VM has no GitHub credentials. |
| Vercel project | Prepared, not live | `vercel.json` + control-surface split are in the repo. Vercel MCP `needsAuth` ignored. Anton Imports in the dashboard. No production hostname. |
| Mac mini host | Runbook ready | Origin tree at `~/Developer/workerlayer-origin`. `pnpm install && pnpm fixtures && pnpm test && pnpm dev` → `:43147`. `cursor worker start` + compiled `pnpm start` on the same port. This run still sees **zero** self-hosted workers. |

**One next Anton click (mirror only — desk is already live):** Reply here with a GitHub PAT (`repo` scope) as `GH_TOKEN` so FE can `git push github main` to [https://github.com/antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer). The repo already exists. Cursor “GitHub connected” is not a token for this agent. If you would rather create a second empty repo, [github.com/new](https://github.com/new) still works — we will not invent a URL.

## Anton — Import the desk in the Vercel dashboard (control surface only)

Do this **after** `github.com/antonakhokhryakov-max/workerlayer` has Origin `main` (the mirror). Do **not** wait on the Vercel MCP connector. Workers never run on Vercel.

1. Open [https://vercel.com/dashboard](https://vercel.com/dashboard) and sign in.
2. Top right: **Add New** → **Project**.
3. Under **Import Git Repository**, pick **GitHub**. If GitHub is not listed, click **Adjust GitHub App Permissions** (or **Connect GitHub**) and grant access to `workerlayer` only.
4. Find `antonakhokhryakov-max/workerlayer` → **Import**.
5. On the configure screen:
   - **Project Name:** `workerlayer` (or leave the default).
   - **Framework Preset:** Next.js (Vercel should detect it).
   - **Root Directory:** `./` (this repo root).
   - **Build Command / Install Command:** leave the `vercel.json` values (`pnpm build` / `pnpm install`).
6. **Environment Variables** (add **before** Deploy). Key `WORKERLAYER_HOST_URL`, value = the Mac mini’s reachable `pnpm start` URL (paid tunnel or equivalent on the mini — not this cloud-agent trycloudflare, not a `*.vercel.app` URL). Apply to Production, Preview, and Development. Do **not** add `AETHER_API_KEY` on Vercel (identity stays on the host). Do **not** add `NEXT_PUBLIC_` copies of the key.
7. Click **Deploy**.
8. When the site is up: it is the **desk control surface only**. If `WORKERLAYER_HOST_URL` is missing, `/api` returns 503 `missing_host_url` and the desk shows “host not pointed”. That is correct — not a Worker on Vercel.
9. Do not publish the `*.vercel.app` hostname as the product URL until the mini is pointed. Temporary Alpha desk stays the Cloudflare tunnel until then.

Never treat a Vercel deployment as the Task host. Manifest / exec / `startTask` stay on the Mac mini. No SSO.

## Prepared in this repo (not a live Vercel site)

- `vercel.json` — Next install/build. No project URL.
- `src/middleware.ts` — on Vercel, `/api` is 503 until `WORKERLAYER_HOST_URL`, then proxies to the mini. Never `startTask` in the Vercel process.
- `src/lib/host-mode.ts` — `getPlatform()` / `getStore()` / `getDeveloperApi()` throw on Vercel or whenever `WORKERLAYER_HOST_URL` is set.
- Desk pages fetch `/api/desk/home` and `/api/desk/tasks/:id` from the host when this process is the control surface.
- `scripts/sync-github-mirror.sh` — push Origin SoT to the GitHub mirror after Anton creates the repo.

Do not set `WORKERLAYER_HOST_URL` on the Mac mini. Do not point it at a Vercel hostname.

## After the GitHub repo exists — FE mirror push

```bash
git remote add github https://github.com/antonakhokhryakov-max/workerlayer.git
git push github main
# or: bash scripts/sync-github-mirror.sh
```

Origin stays source of truth. Then Anton does the Vercel dashboard Import above. Leave the Mac mini on (`cursor worker start` + `pnpm start`). Until Origin `main` is on that GitHub repo, Vercel Import is not this desk. Until `WORKERLAYER_HOST_URL` points at the mini, a Vercel URL would be a product lie — we will not publish one.

## Mac mini host runbook

Locked contract: [HOST-START.md](HOST-START.md). Land the **full Origin tree** at `~/Developer/workerlayer-origin`. Do **not** run the host from the GitHub desk-only mirror at `~/Developer/workerlayer` (Vercel control surface; desk / mock `:8787` is not the host).

On the always-on dogfood machine (never in Vercel, never in the browser):

1. Power the Mac mini. Run `cursor worker start` so Cursor agents can land on this host.
2. Put Origin at `~/Developer/workerlayer-origin` (clone `origin-host` if GitHub has the full host tree, or unpack `workerlayer-host.tgz`). Do not treat GitHub `main` as SoT.
3. `cp .env.example .env`. Set `AETHER_API_KEY` to a string only you know — **identity only**, not a grant. Do **not** set `WORKERLAYER_HOST_URL` here.
4. From Origin root: `pnpm install && pnpm fixtures && pnpm test && pnpm dev` (listens `http://127.0.0.1:43147`). That process runs Workers / startTask / Manifest. Production-style same port: `pnpm build && pnpm start`.
5. Desk Grant selected uses grantor `desk-session`. No SSO. No compute picker.
6. Environment / sticky compute starts **only when a Task exists**, sticky per Task. Tear-down is server-side when the run finishes. Manifest / exec stay in this process.

```bash
cursor worker start
cd ~/Developer/workerlayer-origin
cp .env.example .env   # AETHER_API_KEY=…  (identity only)
pnpm install && pnpm fixtures && pnpm test && pnpm dev
# host runtime — WorkerEnvironment lives here on :43147
# pnpm start is the compiled listen on the same port after pnpm build
```

## Interim (2) — paid tunnel on the same mini

If Vercel is slow after the GitHub click: a **paid reserved tunnel** (ngrok reserved domain or Cloudflare named tunnel) to this same `pnpm start` is better than flaky trycloudflare. Same host-side compute. Paste that hostname as `WORKERLAYER_HOST_URL` once Vercel exists, or use it as Fork Host until Vercel is connected.

No new vertical. Echo is not the product. Stage 2 Grant selected unchanged.

## Stable public host URL

`WORKERLAYER_HOST_URL=https://khokhryakov.net` (named Cloudflare tunnel → Mac mini :43147).
