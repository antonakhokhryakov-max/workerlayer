import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
const workers = [{ id: "mini-1", name: "mac-mini", status: "idle" }];
const tasks = [];

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { raw };
  }

  res.setHeader("content-type", "application/json");
  res.setHeader("x-workerlayer-host", "mock-mini");

  if (url.pathname === "/workers" || url.pathname === "/workers/") {
    res.end(JSON.stringify({ workers }));
    return;
  }
  if (url.pathname === "/tasks" || url.pathname === "/tasks/") {
    res.end(JSON.stringify({ tasks }));
    return;
  }
  if (url.pathname === "/manifest" || url.pathname === "/manifest/") {
    res.end(JSON.stringify({ manifest: { version: 1, source: "mini" } }));
    return;
  }
  if (url.pathname === "/startTask") {
    const task = {
      id: `t-${tasks.length + 1}`,
      title: body.title || "untitled",
      status: "queued-on-mini",
    };
    tasks.unshift(task);
    res.statusCode = 202;
    res.end(JSON.stringify({ ok: true, ranOn: "mini", task }));
    return;
  }
  if (url.pathname === "/manifest/exec") {
    res.statusCode = 202;
    res.end(JSON.stringify({ ok: true, ranOn: "mini", exec: "manifest" }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock mini host on http://127.0.0.1:${port}`);
});
