# WorkerLayer

Alpha desk for **WorkerLayer**. This GitHub repository is the **Vercel-import mirror**. Engineering source of truth is Origin (`anton-khokhryakov/tmp-ad13cedd27d9e252`).

This checkout is a **control surface only**. Vercel must not run Workers, `startTask`, or Manifest exec. Those stay on the Mac mini host.

## Vercel Import

1. Import [https://github.com/antonakhokhryakov-max/workerlayer](https://github.com/antonakhokhryakov-max/workerlayer).
2. Framework preset: Next.js (`npm run build`).
3. **Required env:** `WORKERLAYER_HOST_URL` = `https://khokhryakov.net` (named Cloudflare tunnel to Mac mini :43147).
4. Optional: `WORKERLAYER_IDENTITY_KEY` (identity-only), `WORKERLAYER_GRANT_ID`.

Without `WORKERLAYER_HOST_URL`, the desk still builds and serves UI. Host calls return `503` and never execute locally.

## Stage 2

Grant is selected. The key is identity-only. There is no SSO and no compute picker. The host is the mini, always.

## Desk URL

See [docs/DESK-URL.md](docs/DESK-URL.md). Temporary Cloudflare URLs are interim. Lasting topology is Vercel desk + mini host.

## Local

```bash
npm install
npm test
npm run build
WORKERLAYER_HOST_URL=http://127.0.0.1:8787 npm run dev
```
