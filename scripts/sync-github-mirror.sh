#!/usr/bin/env bash
# Push Origin host tree to GitHub branch origin-host (Mac mini clone target).
# GitHub is not the product SoT. Do not commit here first.
# Do not overwrite GitHub main (desk-only Vercel control surface) unless asked.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git remote get-url github >/dev/null 2>&1; then
  git remote add github https://github.com/antonakhokhryakov-max/workerlayer.git
fi

if ! git push github HEAD:origin-host; then
  cat <<'EOF'
GitHub origin-host push failed (this Cloud Agent has no GH_TOKEN).

Repo exists: https://github.com/antonakhokhryakov-max/workerlayer
GitHub main is the desk-only Vercel control surface — not the host.
Origin stays engineering source of truth.
Mini path: unpack workerlayer-host.tgz into ~/Developer/workerlayer-origin
then: pnpm install && pnpm fixtures && pnpm test && pnpm dev
Paste a repo-scoped PAT as GH_TOKEN, then re-run:
  bash scripts/sync-github-mirror.sh
EOF
  exit 1
fi

echo "Pushed this tree to GitHub origin-host. Origin remains source of truth."
echo "Mini: git clone -b origin-host https://github.com/antonakhokhryakov-max/workerlayer.git ~/Developer/workerlayer-origin"
