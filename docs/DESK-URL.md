# Desk URL

WorkerLayer has one lasting topology and one temporary public URL. Do not collapse them.

## Lasting

- **Desk (control surface):** this Next.js app, imported to Vercel from the GitHub mirror.
- **Host (compute):** the Mac mini. Vercel must set `WORKERLAYER_HOST_URL` to that host.
- Vercel never runs Workers, `startTask`, or Manifest exec. Those stay on the mini. The desk only proxies.

The lasting public desk URL is the Vercel deployment of this repo — not a tunnel hostname.

## Interim

Until Vercel Import is live **and** `WORKERLAYER_HOST_URL` points at the mini, the public desk may be a **temporary Cloudflare interim** (tunnel / CF in front of the mini or a short-lived CF hostname).

That CF URL is stopgap only. It is not the product home and it is not the lasting desk.

## Operator note

Set on the Vercel project (Production + Preview as needed):

```
WORKERLAYER_HOST_URL=https://<mac-mini-host>
```

Optional Stage 2 identity (not a compute credential):

```
WORKERLAYER_IDENTITY_KEY=<identity-only>
WORKERLAYER_GRANT_ID=alpha-stage-2
```

GitHub is the Vercel-import mirror. Origin remains engineering source of truth.
