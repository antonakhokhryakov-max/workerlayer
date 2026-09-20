import { writeFileSync } from "node:fs";
import PptxGenJS from "pptxgenjs";
import { artifactPath } from "./artifacts";
import type { TaskWorkspace } from "./workspace";

export interface SlideSpec {
  title: string;
  bullets: string[];
  footer?: string;
}

export async function createPresentation(
  workspace: TaskWorkspace,
  filename: string,
  title: string,
  slides: SlideSpec[],
): Promise<{ path: string; kind: "presentation"; title: string; slideCount: number }> {
  const relativePath = artifactPath(filename.endsWith(".pptx") ? filename : `${filename}.pptx`);
  const usable = (slides.length > 0 ? slides : [{ title, bullets: ["No slides provided."] }]).map(
    (spec) => ({
      ...spec,
      bullets:
        spec.bullets.filter((bullet) => bullet.trim().length > 0).length > 0
          ? spec.bullets.filter((bullet) => bullet.trim().length > 0)
          : ["See the supporting spreadsheet for detail."],
    }),
  );

  const pptx = new PptxGenJS();
  pptx.author = "WorkerLayer";
  pptx.title = title;
  pptx.subject = "Knowledge-work briefing from attached materials";

  for (const spec of usable) {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.12,
      fill: { color: "2A4A52" },
    });
    slide.addText(spec.title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.7,
      fontSize: 22,
      fontFace: "Calibri",
      color: "1F2A2E",
      bold: true,
    });
    slide.addText(
      spec.bullets.map((bullet) => ({ text: bullet, options: { bullet: true, breakLine: true } })),
      {
        x: 0.6,
        y: 1.2,
        w: 8.8,
        h: 3.8,
        fontSize: 16,
        fontFace: "Calibri",
        color: "2C3336",
        valign: "top",
      },
    );
    slide.addText(spec.footer ?? "WorkerLayer · attached materials only", {
      x: 0.5,
      y: 5.15,
      w: 9,
      h: 0.3,
      fontSize: 10,
      color: "6B7280",
    });
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  workspace.writeBytes(relativePath, buffer);

  const sidecar = relativePath.replace(/\.pptx$/i, ".slides.json");
  writeFileSync(
    workspace.resolve(sidecar),
    JSON.stringify({ title, slides: usable }, null, 2),
  );

  return { path: relativePath, kind: "presentation", title, slideCount: usable.length };
}
