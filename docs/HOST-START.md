# WorkerLayer host start (Mac mini)

**Alpha — not for sensitive production workloads.** Synthetic files only.

This is the locked host contract. Origin is engineering source of truth. The process below is the WorkerEnvironment / runtime that listens for the desk proxy. It is **not** the GitHub Vercel desk mirror.

## Where this tree lives

| Path | What it is | Run the host here? |
| --- | --- | --- |
| `~/Developer/workerlayer-origin` | Full Origin tree (this repo) | **Yes** |
| `~/Developer/workerlayer` | GitHub desk-only Next control surface | **No** |

Do not clone or pull [github.com/antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer) `main` into the host path. That tree is the Vercel control surface. Its local desk / mock listen (`:8787`) is **not** the host.

## Exact start

Cwd: **Origin root** (`~/Developer/workerlayer-origin` on the Mac mini).

`pnpm fixtures` rasters diligence scans with `pdftoppm` and `ffmpeg`. Harbor OCR tests use `tesseract`. On the mini:

```bash
brew install pnpm poppler ffmpeg tesseract
```

Node 22 + pnpm 10 match `package.json` `packageManager`. Python 3 is already on macOS for `pnpm example`.

```bash
cd ~/Developer/workerlayer-origin
cp -n .env.example .env
# Set AETHER_API_KEY to a string only you know.
# Identity only — never a grant. Desk Grant selected uses desk-session.
# Do NOT set WORKERLAYER_HOST_URL on this machine.

pnpm install && pnpm fixtures && pnpm test && pnpm dev
```

`package.json` `dev` is:

```text
next dev -p 43147 --hostname 127.0.0.1
```

## Listen

**http://127.0.0.1:43147**

That process runs Workers / `startTask` / Manifest exec / sticky compute / tear-down.

- Desk `:8787` is **not** the host (GitHub desk mock / control surface only).
- Vercel must **not** run Workers / `startTask` / Manifest exec. `VERCEL=1` without `WORKERLAYER_HOST_URL` returns 503 `missing_host_url`. With `WORKERLAYER_HOST_URL`, `/api` proxies here.
- Never set `WORKERLAYER_HOST_URL` on the mini. That flag marks a process as control surface and forbids compute.

Optional production-style listen on the **same** port after compile: `pnpm build && pnpm start` (`next start -p 43147 --hostname 127.0.0.1`). The locked dogfood command is still `pnpm dev`.

## How the mini gets this tree

1. **Preferred (if `origin-host` exists on GitHub):**
   ```bash
   git clone -b origin-host https://github.com/antonakhokhryakov-max/workerlayer.git ~/Developer/workerlayer-origin
   ```
   That branch must be the **full Origin host**, not GitHub `main` desk-only.
2. **If GitHub push is unavailable:** unpack `workerlayer-host.tgz` into `~/Developer/workerlayer-origin`, then run the exact start above. The tarball is the Origin host tree (`pnpm install && pnpm fixtures && pnpm test && pnpm dev`).
3. **Origin SoT** remains this repo. Agents land here first. GitHub is a Vercel-import mirror, not product SoT.

## Product contracts (do not weaken)

- **Propose-only.** `POST /api/v1/propose` is a sketch / suggested tools. It does not grant and does not write a Manifest. `grantFromProposal` throws. Grant selected is selected tools + `confirm: true`, Task-scoped.
- **Identity ≠ auth.** `AETHER_API_KEY` is who you are, not what you may do. Missing key → 401 `missing_api_key`. Wrong key → 401 `invalid_api_key`. Cross-principal lookup → 404, not 403. The key is not a frontend grant. Desk Grant selected uses grantor `desk-session`. No SSO.
- **Sticky compute.** Docker when `docker info` succeeds and the image exists, else unshare-mount, else process-filesystem. The kind is sticky per Task. OEM and `/api/v1` do not choose. `computeProvider` / `substrate` on `create_environment` are ignored. The audit records the provider.

## After it is listening

Leave `pnpm dev` running. In another terminal, from the same Origin root:

```bash
pnpm example
```

Expect ALLOW `notes.read` → ALLOW `notes.write` → DENY `notes.export`, then environment destroyed and identity expired.

`pnpm example` itself does not need OCR. The locked start chain still runs `pnpm fixtures` and `pnpm test`, so install `poppler`, `ffmpeg`, and `tesseract` first (see Exact start).

## Stable public host URL

`WORKERLAYER_HOST_URL=https://khokhryakov.net` (named Cloudflare tunnel → Mac mini :43147).
