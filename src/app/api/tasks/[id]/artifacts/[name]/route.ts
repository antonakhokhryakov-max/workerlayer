import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { downloadContentType } from "@/lib/content-type";
import { getStore } from "@/lib/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await params;
  const store = getStore();
  const task = store.get(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  const artifact = task.artifacts.find((item) => item.name === name);
  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }
  const abs = join(store.workspaceRoot(id), artifact.relativePath);
  if (!existsSync(abs)) {
    return NextResponse.json({ error: "File missing." }, { status: 404 });
  }
  const bytes = new Uint8Array(readFileSync(abs));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": downloadContentType(artifact.name),
      "Content-Disposition": `attachment; filename="${artifact.name}"`,
    },
  });
}
