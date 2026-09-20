# 15-minute DX path (WorkerLayer Alpha)

**WorkerLayer — Alpha — not for sensitive production workloads.** Success is ALLOW / ALLOW / DENY.

Open the Alpha desk from a laptop: [https://lauderdale-mar-seemed-circle.trycloudflare.com](https://lauderdale-mar-seemed-circle.trycloudflare.com) — a **temporary** Cloudflare tunnel for Alpha access, not a lasting Vercel or production site. If it dies, Founding Engineer restarts `cloudflared` on the build host and posts the new hostname. Timed rows below are the host `pnpm example` path Founding Engineer runs — not a founder browser URL.

Long-term target: under 15 minutes from a clean checkout to the first useful governed worker action. This is a timed log, not a security claim.

## Path (after the doc fix)

```bash
cp .env.example .env
# set AETHER_API_KEY
pnpm install
pnpm dev
```

In another terminal:

```bash
python3 clients/python/example.py
```

Or `pnpm example`. Public surface: keyed `/api/v1` via [clients/python](../clients/python/README.md). See [ALPHA.md](ALPHA.md). You declare tools. The control plane allows `notes.read` / `notes.write`, denies `notes.export`, tears the environment down, and expires the identity. `pnpm example:custom` registers `wharf.stamp` / `wharf.payroll` the same way.

CLI equivalent (documented, but identity stays active until `pnpm aether accept <id>`):

```bash
pnpm aether echo
```

## Cold start (honest)

Needs: Node 22, pnpm 10, **python3 (stdlib only)**. Harbor fixtures, tesseract, ffmpeg, and `pnpm test` are **not** on this path.

| Step | This machine (measured) | Stranger laptop (estimate) |
| --- | --- | --- |
| `python3 --version` | 3.12.3 present | Hard blocker if missing. `pnpm example` now says so. |
| `pnpm install --frozen-lockfile` | 0.5 s (store already populated; `node_modules` 683 MB) | **2–8 min** download of ~680 MB on residential wifi. Not re-measured blank-disk here (would disrupt the running desk). |
| `cp .env.example .env` + set `AETHER_API_KEY` | seconds | seconds |
| `pnpm dev` to HTTP 200 | 3.6 s after deleting `.next` (Next 16 Turbopack `:43147`) | 15–40 s first compile |
| `pnpm example` / `python3 clients/python/example.py` | <1 s | <1 s |
| Harbor `pnpm fixtures` + OCR apt packages | skip | skip |

**Hard blockers we can name:** no `python3`; no Node/pnpm; host not running (`pnpm dev`); unset `AETHER_API_KEY` (401, not an open port). OCR/`apt-get tesseract` is not a blocker for the first DENY.

`pnpm example` wraps python3 so a missing interpreter prints WorkerLayer’s 15-minute path, not a bare `python3: not found`.

## Review → grant

`POST /api/v1/propose` returns **sketch / suggested tools** (`granted: false`, status `sketch`, reasons). Never a Manifest. **This is a sketch. You still choose what to grant.** `POST /api/v1/grant` needs the **selected** tools and `confirm: true` — not Approve all, not the API key alone. Grant is Task-scoped. Untouched sketch rows stay DENY leftovers. Compute stays sticky per Task; the sketch does not pick Docker vs unshare. Desk card: **Sketch / suggested tools** → **Grant selected**. The 15-minute `pnpm example` path is unchanged: you declare tools, then ALLOW / ALLOW / DENY and tear-down.

## Timed log (this machine)

Host already had `node_modules` and a running `pnpm dev` on `http://127.0.0.1:43147`. That is faster than a stranger’s laptop.

| Pass | Step | Wall clock | Notes |
| --- | --- | --- | --- |
| Before | Read README | ~4 min of confusion | README led with Harbor desk, `apt` OCR tools, `pnpm fixtures`, and `pnpm test`. Python `/api/v1` was not listed. `clients/python/README.md` said the client was paused / not the Milestone 1 story. |
| Before | `pnpm install` | 1 s | Lockfile cached. A cold install would be longer. |
| Before | Find `example.py` | hunt | Not linked from README. |
| Before | `python3 clients/python/example.py` with host up | <1 s | ALLOW + DENY + teardown + expired identity. Worked. JSON dump, no human ALLOW lines. |
| Before | same, host down | fail | urllib `Connection refused` traceback. No hint to `pnpm dev`. |
| Before | `pnpm aether echo` (documented CLI) | 1 s | ALLOW `echo.write`, DENY `echo.secrets`, environment destroyed. Identity still **active** until accept. |
| After | `pnpm install` | 0.57 s | Cached lockfile. |
| After | `python3 clients/python/example.py` | 0.19 s | Exit 0. ALLOW `notes.read` / `notes.write`. DENY `notes.export` (capability not granted). Environment destroyed. Identity expired. Task `tsk_fb2ec3942af2`. |
| After | `pnpm example` | 0.36 s | Same human lines. Task `tsk_9ae30f7bb82c`. |
| After | host down (`AETHER_BASE_URL=http://127.0.0.1:1`) | 0.06 s | Exit 1. Stderr: start the host with `pnpm dev` (`http://127.0.0.1:43147`). No traceback. |

**Honest total on this machine after the fix, host already running:** under 2 minutes including reading the new README section. Measured commands after that: ~1 s.

## Cold path (this machine)

Not a stranger’s empty laptop. `node_modules` was already on disk (683 MB). `.next` was deleted and `pnpm dev` was started again.

| Step | Wall clock | Notes |
| --- | --- | --- |
| `pnpm install` (modules already present) | 0.52 s | Lockfile cached. |
| First `pnpm dev` after deleting `.next` | Ready in 0.29 s | Next 16 Turbopack on `:43147`. |
| First desk GET | 2.0 s | Compile-on-request. |
| Wall clock until HTTP 200 | 3.6 s | No port confusion. `.env` loaded (`AETHER_API_KEY`). |
| Blank-disk download of `node_modules` | **not measured** | That is the unknown. Budget several minutes on residential wifi. Still under 15 if you skip Harbor fixtures / `pnpm test`. |

No hard blocker. `/api/v1` without a key is a 401, not an open port.

**If you also have to start `pnpm dev` with a warm compile:** about 10–20 seconds was the earlier estimate; this re-measure after deleting `.next` was faster.

See the **Cold start** table above for stranger-laptop estimates. Blank-disk `node_modules` download was still not run here — the desk is serving on this VM.

## Friction (before)

1. README’s first commands were install → OCR packages → fixtures → full test suite → desk. That is Harbor dogfood, not the shortest governed action.
2. The Python client existed and already completed allow / deny / teardown, but public docs hid it or called it paused.
3. No `pnpm example` script.
4. Port `43147` was in `package.json` and the client default, not in a 15-minute README recipe.
5. Host-down failure was a stack trace.
6. Example JSON buried ALLOW inside `summary: "2 allowed, 1 denied."`

## What we fixed

- README leads with `pnpm install` / `pnpm dev` / `python3 clients/python/example.py`.
- `pnpm example` script.
- `clients/python/README.md` is a run recipe, not a “paused” disclaimer.
- `example.py` prints ALLOW / DENY / environment / identity, then a short JSON recap.
- Connection refused tells you to start `pnpm dev` on `http://127.0.0.1:43147`.

## What remains

- Harbor / Instinct desk still needs fixtures and (for OCR packs) tesseract. That is a longer path than dock-notes. See [OEM.md](OEM.md) FAQ.
- The `/api/v1` example is you-bring-the-request-list, not an isolated planner loop.
- Same-machine residual risk: [SECURITY.md](SECURITY.md).
- Cold-install **download** of `node_modules` (~680 MB) on a new laptop is still an estimate (2–8 min). Compile after deleting `.next` was 3.6 s to first HTTP 200 here.

## One next step

Pause isolation work. Try this README path, then the North Dock assignment on the desk if you want Instinct-for-X.

## See also

- Outsider keyed path: [ALPHA.md](ALPHA.md)
- Copy Echo / leftover FAQ: [OEM.md](OEM.md)
- Product name is WorkerLayer. Echo is not the product.
- Desk success: DENY in the audit, environment torn down.
