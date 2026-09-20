#!/usr/bin/env python3
"""test_cross_principal_404 — Bob cannot see Alice's Task (404, not 403).

Alice's own CapabilityManifest still ALLOW notes.read, ALLOW notes.write,
DENY notes.export. The API key is identity only — never a grant.

    python3 clients/python/test_cross_principal_404.py

Needs AETHER_API_KEY (Alice) and AETHER_API_KEYS (Bob), or the harness
passes explicit keys. See docs/ALPHA.md.
"""

from __future__ import annotations

import json
import os
import sys

from aether import ApiError, Client

BASE = os.environ.get("AETHER_BASE_URL", "http://127.0.0.1:43147")
ALICE_KEY = os.environ.get("AETHER_API_KEY", "")
BOB_KEY = os.environ.get("AETHER_BOB_KEY") or (os.environ.get("AETHER_API_KEYS", "").split(",")[0].strip())


def _status_on_error(fn) -> int:
    try:
        fn()
        return 200
    except ApiError as error:
        return error.status


def test_cross_principal_404(
    base: str = BASE,
    alice_key: str = ALICE_KEY,
    bob_key: str = BOB_KEY,
) -> dict:
    if not alice_key or not bob_key or alice_key == bob_key:
        raise ApiError(
            400,
            "Set AETHER_API_KEY (Alice) and AETHER_API_KEYS or AETHER_BOB_KEY (Bob).",
        )
    alice = Client(base, api_key=alice_key)
    bob = Client(base, api_key=bob_key)
    env = alice.create_environment(
        worker="dock-notes",
        tools=[
            {"name": "notes.read", "capability": "notes:read", "policy": "allow"},
            {"name": "notes.write", "capability": "notes:write", "policy": "allow"},
            {"name": "notes.export", "capability": "notes:export", "policy": "deny"},
        ],
    )
    task = alice.create_task(env["id"], "Read, write, do not export.")
    alice.attach_file(task["id"], "slip.txt", "North dock is closed. Synthetic only.")
    ran = alice.run(
        task["id"],
        [
            {"tool": "notes.read", "args": {"path": "slip.txt"}},
            {"tool": "notes.write", "args": {"path": "hold.txt", "text": "Hold."}},
            {"tool": "notes.export", "args": {"destination": "https://not-authorized.example"}},
        ],
    )
    audit = alice.audit(task["id"])
    own = alice.status(task["id"])
    bob_task = _status_on_error(lambda: bob.status(task["id"]))
    bob_env = _status_on_error(lambda: bob.get_environment(env["id"]))
    bob_audit = _status_on_error(lambda: bob.audit(task["id"]))
    created = next((event for event in audit if event.get("action") == "environment.created"), {})
    return {
        "allowRead": any(e.get("tool") == "notes.read" and e.get("decision") == "allow" for e in audit),
        "allowWrite": any(e.get("tool") == "notes.write" and e.get("decision") == "allow" for e in audit),
        "denyExport": any(e.get("tool") == "notes.export" and e.get("decision") == "deny" for e in audit),
        "aliceStatus": own.get("status"),
        "bobTask": bob_task,
        "bobEnv": bob_env,
        "bobAudit": bob_audit,
        "provider": (created.get("details") or {}).get("provider") or (ran.get("environment") or {}).get("computeProvider"),
        "granted": env.get("granted"),
        "principalInGranted": alice_key in (env.get("granted") or []),
    }


def main() -> int:
    try:
        payload = test_cross_principal_404()
    except ApiError as error:
        print(error.message, file=sys.stderr)
        return 1
    print(json.dumps(payload, indent=2))
    if not payload["allowRead"] or not payload["allowWrite"] or not payload["denyExport"]:
        return 1
    if payload["bobTask"] != 404 or payload["bobEnv"] != 404 or payload["bobAudit"] != 404:
        return 1
    if payload["bobTask"] == 403:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
