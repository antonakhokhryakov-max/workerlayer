#!/usr/bin/env python3
"""15-minute path: a dock-notes worker on WorkerLayer's environment.

You declare tools and policy. WorkerLayer decides allow / deny, issues an identity,
runs through DIRECT_TOOL, writes an audit, and tears the environment down.

Run from the repo root after copying `.env.example` to `.env`, setting
`AETHER_API_KEY`, and starting `pnpm dev`:

    python3 clients/python/example.py
    # or: pnpm example

See docs/ALPHA.md. Alpha — not for sensitive production workloads.
"""

from __future__ import annotations

import json
import os
import sys

from aether import ApiError, Client

BASE = os.environ.get("AETHER_BASE_URL", "http://127.0.0.1:43147")


def main() -> int:
    health = {}
    client = Client(BASE)
    try:
        health = client.health()
        if not health.get("ok"):
            print(health.get("error") or "Keyed /api/v1 is not ready.", file=sys.stderr)
            return 1
        env = client.create_environment(
            worker="dock-notes",
            tools=[
                {"name": "notes.read", "capability": "notes:read", "policy": "allow"},
                {"name": "notes.write", "capability": "notes:write", "policy": "allow"},
                {"name": "notes.export", "capability": "notes:export", "policy": "deny"},
            ],
        )
        task = client.create_task(
            env["id"],
            "Read the attached slip and write a one-line hold notice. Do not export it.",
        )
        client.attach_file(
            task["id"],
            "slip.txt",
            "North dock is closed Monday. Dinghies may use the south ladder.",
        )
        ran = client.run(
            task["id"],
            [
                {"tool": "notes.read", "args": {"path": "slip.txt"}},
                {
                    "tool": "notes.write",
                    "args": {
                        "path": "hold.txt",
                        "text": "Hold: north dock closed Monday; use the south ladder.",
                    },
                },
                {
                    "tool": "notes.export",
                    "args": {"destination": "https://not-authorized.example"},
                },
            ],
        )
        audit = client.audit(task["id"])
        outputs = client.outputs(task["id"])
        destroyed = client.destroy_environment(env["id"])
        after = client.status(task["id"])
    except ApiError as error:
        print(error.message, file=sys.stderr)
        return 1

    allows = [
        event
        for event in audit
        if event.get("action") == "policy.decide" and event.get("decision") == "allow"
    ]
    denials = [
        event
        for event in audit
        if event.get("decision") == "deny" and event.get("tool") == "notes.export"
    ]
    identity = after.get("identity") or {}
    environment = ran.get("environment") or {}

    print("WorkerLayer — Alpha — not for sensitive production workloads")
    print(
        health.get("stranger")
        or "Success is ALLOW / ALLOW / DENY in the audit, not only finished work"
    )
    for event in allows:
        print(f"ALLOW  {event.get('tool')}")
    for event in denials:
        reason = (event.get("details") or {}).get("reason", "")
        print(f"DENY   {event.get('tool')}  {reason}")
    print(f"environment {(environment.get('status') or '?')}")
    print(f"identity {identity.get('status') or '?'}")
    print(
        json.dumps(
            {
                "worker": env["worker"],
                "environmentId": env["id"],
                "taskId": task["id"],
                "status": ran["status"],
                "summary": ran.get("summary"),
                "identityAfterDestroy": identity.get("status"),
                "environmentStatus": environment.get("status"),
                "destroyed": destroyed["status"],
            },
            indent=2,
        )
    )
    if not allows or not denials:
        return 1
    if environment.get("status") != "destroyed" or identity.get("status") != "expired":
        return 1
    if not any(file.get("name") == "hold.txt" for file in outputs.get("files") or []):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
