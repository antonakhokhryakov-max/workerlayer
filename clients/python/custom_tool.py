#!/usr/bin/env python3
"""Outsider sample: register a tiny custom tool and see a real DENY.

You name the tools. WorkerLayer does not compile them. Policy still decides.
Thin /api/v1 only — not Harbor, not an EnvironmentCompiler.

    python3 clients/python/custom_tool.py
    # or: pnpm example:custom

See docs/ALPHA.md. Alpha — not for sensitive production workloads.
"""

from __future__ import annotations

import json
import os
import sys

from aether import ApiError, Client

BASE = os.environ.get("AETHER_BASE_URL", "http://127.0.0.1:43147")


def main() -> int:
    client = Client(BASE)
    try:
        env = client.create_environment(
            worker="wharf-stamp",
            tools=[
                {"name": "wharf.stamp", "capability": "wharf:stamp", "policy": "allow"},
                {"name": "wharf.payroll", "capability": "wharf:payroll", "policy": "deny"},
            ],
        )
        task = client.create_task(
            env["id"],
            "Stamp the slip. Do not read payroll.",
        )
        client.attach_file(task["id"], "slip.txt", "South ladder is open. Keep the north dock dark.")
        ran = client.run(
            task["id"],
            [
                {
                    "tool": "wharf.stamp",
                    "args": {
                        "path": "stamp.txt",
                        "text": "Stamped: south ladder open. Synthetic only.",
                    },
                },
                {"tool": "wharf.payroll", "args": {"path": "payroll.csv"}},
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
        if event.get("decision") == "deny" and event.get("tool") == "wharf.payroll"
    ]
    identity = after.get("identity") or {}
    environment = ran.get("environment") or {}

    print("Alpha — not for sensitive production workloads")
    print("Custom tools — you named them; WorkerLayer did not compile them.")
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
    if not any(event.get("tool") == "wharf.stamp" for event in allows):
        return 1
    if not denials:
        return 1
    if environment.get("status") != "destroyed" or identity.get("status") != "expired":
        return 1
    if not any(file.get("name") == "stamp.txt" for file in outputs.get("files") or []):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
