import type { TaskBrief, WorkPlan } from "@aether/contracts";

export function draftKnowledgeWorkPlan(task: TaskBrief): WorkPlan {
  return {
    summary: `Complete the assignment with a review-and-correction cycle: ${task.goal}`,
    steps: [
      {
        id: "list",
        title: "Inventory attached sources",
        detail: "List files in the governed task environment.",
        status: "pending",
      },
      {
        id: "read",
        title: "Read source materials",
        detail: "Read documents and extract text from PDFs.",
        status: "pending",
      },
      {
        id: "desk",
        title: "Open files on the workstation",
        detail: "Open attached PDFs and spreadsheets in the governed task environment.",
        status: "pending",
      },
      {
        id: "ocr",
        title: "Read scanned pages",
        detail:
          "If a PDF has no usable text layer, request OCR. Keep confidence. Do not invent unread numbers.",
        status: "pending",
      },
      {
        id: "research",
        title: "Review the research pack",
        detail: "Note coverage, gaps, and uncertainty from attached materials only.",
        status: "pending",
      },
      {
        id: "scope",
        title: "Work only with granted access",
        detail:
          "Fill research gaps only with capabilities this assignment granted. The control plane — not the agent — decides what is permitted.",
        status: "pending",
      },
      {
        id: "analyze",
        title: "Structured analysis",
        detail: "Turn source material into cited findings and a company comparison.",
        status: "pending",
      },
      {
        id: "spreadsheet",
        title: "Create spreadsheet",
        detail: "Write the first comparison or findings workbook (DIRECT_TOOL).",
        status: "pending",
      },
      {
        id: "sandbox",
        title: "Verify in the sandbox",
        detail: "Request isolated python to count recorded companies. The control plane decides.",
        status: "pending",
      },
      {
        id: "presentation",
        title: "Create presentation",
        detail: "Write the first deck summarizing the landscape or subject.",
        status: "pending",
      },
      {
        id: "document",
        title: "Write the short summary",
        detail: "Produce a written brief with citations and uncertainty flags.",
        status: "pending",
      },
      {
        id: "inspect",
        title: "Inspect the draft",
        detail: "Render and inspect the artifacts for gaps and visual defects.",
        status: "pending",
      },
      {
        id: "review",
        title: "Check quality",
        detail: "Run deterministic checks: citations, consistency, slide count, conflicts.",
        status: "pending",
      },
      {
        id: "correct",
        title: "Correct problems",
        detail: "Fix the issues the check found without asking the operator.",
        status: "pending",
      },
      {
        id: "reinspect",
        title: "Inspect again",
        detail: "Re-render and confirm the correction before delivery.",
        status: "pending",
      },
      {
        id: "validate",
        title: "Validate and deliver",
        detail: "Final validation of spreadsheet, deck, and summary.",
        status: "pending",
      },
    ],
  };
}

export function markStep(
  plan: WorkPlan,
  id: string,
  status: WorkPlan["steps"][number]["status"],
): WorkPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) =>
      step.id === id ? { ...step, status } : step,
    ),
  };
}
