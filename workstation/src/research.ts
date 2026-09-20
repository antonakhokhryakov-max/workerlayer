import type { ResearchReview } from "@aether/contracts";
import { readWorkspaceFile } from "./files";
import type { TaskWorkspace } from "./workspace";

/**
 * Stage 2 research scaffolding: review attached/approved materials only.
 * This is not open-web or browser research (Stage 4).
 */
export function reviewAttachedSources(workspace: TaskWorkspace): ResearchReview {
  const files = workspace.listFiles().filter((file) => file.path.startsWith("sources/"));
  const texts = files.map((file) => {
    try {
      const read = readWorkspaceFile(workspace, file.path);
      return { path: file.path, bytes: file.bytes, text: read.content ?? "" };
    } catch {
      return { path: file.path, bytes: file.bytes, text: "" };
    }
  });
  const corpus = texts.map((item) => item.text).join("\n").toLowerCase();

  const coverage: string[] = [];
  if (/company|founded|headquarters|headcount/.test(corpus)) coverage.push("Company profile");
  if (/product|collection|lantern|furniture|goods/.test(corpus)) coverage.push("Products");
  if (/revenue|growth|headcount|million|mix/.test(corpus)) coverage.push("Selected metrics");
  if (/risk|freight|season|supply|lead time/.test(corpus)) coverage.push("Stated risks");
  if (/customer|retailer|wholesale|direct/.test(corpus)) coverage.push("Customers and channels");

  const gaps: string[] = [
    "No independent third-party sources — analysis is limited to the attached pack.",
    "The open web is not enabled. An allowlisted destination may be requested only if this assignment granted it.",
  ];
  if (!/revenue|million/.test(corpus)) {
    gaps.push("Attached materials do not include a clear revenue figure.");
  }
  if (!/competitor|competitive/.test(corpus)) {
    gaps.push("No competitor comparison is present in the attached materials.");
  }
  if (!/audit|10-k|balance sheet/.test(corpus)) {
    gaps.push("No audited financial statements are in the pack.");
  }
  if (!/payroll|compensation|salary/.test(corpus)) {
    gaps.push("Figures that are not in the attached pack cannot be filled from another assignment.");
  }

  return {
    method: "attached-materials-only",
    sources: files.map((file) => ({
      path: file.path,
      bytes: file.bytes,
      kind: file.path.toLowerCase().endsWith(".pdf") ? "pdf" : "text",
    })),
    coverage,
    gaps,
    notes: [
      "Treat forward-looking statements (plans, expansions, lead times) as uncertain unless corroborated.",
      "Cite the specific attached file for every finding.",
      ...(/https?:\/\//i.test(corpus)
        ? [
            "Attached materials name a destination. Request it only if this assignment granted allowlisted fetch.",
          ]
        : []),
    ],
  };
}
