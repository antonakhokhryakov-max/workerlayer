import { NextResponse } from "next/server";
import { downloadContentType } from "@/lib/content-type";
import { getStore } from "@/lib/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await params;
  if (name.includes("/") || name.includes("..")) {
    return NextResponse.json({ error: "Invalid source name." }, { status: 400 });
  }
  const bytes = getStore().readSource(id, name);
  if (!bytes) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": downloadContentType(name),
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
