"""Tiny WorkerLayer client — not an SDK.

Talks to the local developer API. You declare a worker, tools, and policy.
WorkerLayer composes one assignment → one identity → one WorkerEnvironment.

Send AETHER_API_KEY as Authorization: Bearer or X-Api-Key. The key is a
principal, not a capability grant. The assignment desk does not use this key.
Alpha — not for sensitive production workloads.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


class ApiError(RuntimeError):
    def __init__(self, status: int, message: str, code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


def load_api_key() -> str:
    """Env wins. Otherwise read AETHER_API_KEY from .env in cwd or repo root."""
    if "AETHER_API_KEY" in os.environ:
        return os.environ["AETHER_API_KEY"].strip()
    for candidate in (Path.cwd() / ".env", Path(__file__).resolve().parents[2] / ".env"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or "=" not in stripped:
                continue
            name, value = stripped.split("=", 1)
            if name.strip() == "AETHER_API_KEY":
                return value.strip().strip("'").strip('"')
    return ""


class Client:
    def __init__(self, base_url: str = "http://127.0.0.1:43147", api_key: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = (api_key if api_key is not None else load_api_key()).strip()

    def create_environment(
        self,
        worker: str,
        tools: list[dict[str, str]] | None = None,
        capabilities: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"worker": worker}
        if tools is not None:
            body["tools"] = tools
        if capabilities is not None:
            body["capabilities"] = capabilities
        return self._request("POST", "/api/v1/environments", body)["environment"]

    def register_tools(self, environment_id: str, tools: list[dict[str, str]]) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/environments/{environment_id}/tools",
            {"tools": tools},
        )["environment"]

    def declare_capabilities(
        self,
        environment_id: str,
        granted: list[str] | None = None,
        denied: list[str] | None = None,
        require_approval: list[str] | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/environments/{environment_id}/capabilities",
            {
                "granted": granted or [],
                "denied": denied or [],
                "require_approval": require_approval or [],
            },
        )["environment"]

    def get_environment(self, environment_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/environments/{environment_id}")["environment"]

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1")

    def propose(self, goal: str) -> dict[str, Any]:
        """Sketch tools from goal text. Nothing is granted."""
        return self._request("POST", "/api/v1/propose", {"goal": goal})["proposal"]

    def grant(
        self,
        worker: str,
        tools: list[dict[str, str]],
        *,
        confirm: bool = False,
        proposal: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Human grant-review. Requires tools you chose and confirm=True. Task-scoped. Does not copy a sketch."""
        body: dict[str, Any] = {"worker": worker, "tools": tools, "confirm": confirm}
        if proposal is not None:
            body["proposal"] = proposal
        return self._request("POST", "/api/v1/grant", body)

    def create_task(self, environment_id: str, goal: str) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/tasks",
            {"environmentId": environment_id, "goal": goal},
        )["task"]

    def attach_file(self, task_id: str, name: str, content: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/files",
            {"name": name, "content": content},
        )

    def run(self, task_id: str, requests: list[dict[str, Any]]) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/run",
            {"requests": requests},
        )["task"]

    def status(self, task_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/tasks/{task_id}")["task"]

    def audit(self, task_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/api/v1/tasks/{task_id}/audit")["audit"]

    def outputs(self, task_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/tasks/{task_id}/outputs")

    def destroy_environment(self, environment_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/environments/{environment_id}/destroy",
            {},
        )["environment"]

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        if not self.api_key:
            raise ApiError(
                401,
                "Set AETHER_API_KEY (same value the host uses). Copy .env.example to .env. See docs/ALPHA.md.",
            )
        data = None if body is None or method == "GET" else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        try:
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            payload = error.read().decode("utf-8")
            code = None
            try:
                parsed = json.loads(payload)
                message = parsed.get("error") or payload
                code = parsed.get("code")
            except json.JSONDecodeError:
                message = payload or str(error)
            raise ApiError(error.code, str(message), str(code) if code else None) from error
        except urllib.error.URLError as error:
            raise ApiError(
                0,
                f"Cannot reach {self.base_url}. Start the host with `pnpm dev` "
                f"(http://127.0.0.1:43147). ({error.reason})",
            ) from error
