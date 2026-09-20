/**
 * Tools the agent may REQUEST. Requesting is not authorization.
 * The control plane decides; the workstation executes.
 */
export const TOOL_CATALOG = [
  {
    name: "workspace.list_files",
    description: "List files in the current task environment.",
  },
  {
    name: "workspace.ingest_sources",
    description: "Read every attached source file in one governed pass.",
  },
  {
    name: "workspace.read_file",
    description: "Read a text source file attached to this task.",
  },
  {
    name: "pdf.extract_text",
    description: "Extract text from an attached PDF.",
  },
  {
    name: "pdf.open",
    description: "Open an attached PDF in the governed workstation and read it.",
  },
  {
    name: "pdf.ocr",
    description:
      "OCR an attached image-only PDF when it has no usable text layer. Returns text plus confidence. Does not invent low-confidence numbers.",
  },
  {
    name: "spreadsheet.open",
    description: "Open an attached or task spreadsheet in the governed workstation.",
  },
  {
    name: "research.review_sources",
    description:
      "Review attached/approved materials only. Note coverage, gaps, and uncertainty. Not browser research.",
  },
  {
    name: "analysis.record_findings",
    description: "Store structured findings, citations, and uncertainty flags.",
  },
  {
    name: "spreadsheet.create",
    description: "Create a spreadsheet artifact summarizing the work.",
  },
  {
    name: "spreadsheet.update",
    description: "Modify an existing spreadsheet artifact.",
  },
  {
    name: "presentation.create",
    description: "Create a short presentation artifact.",
  },
  {
    name: "document.create",
    description: "Create a short written summary or report.",
  },
  {
    name: "artifact.inspect",
    description: "Inspect rendered artifacts for completeness and visual defects.",
  },
  {
    name: "quality.check",
    description: "Run deterministic quality checks across artifacts and sources.",
  },
  {
    name: "artifact.validate",
    description: "Validate that a task artifact is complete.",
  },
  {
    name: "export.send_external",
    description:
      "Request sending an artifact outside the task. Usually denied or needs approval.",
  },
  {
    name: "network.fetch",
    description:
      "Request a network fetch. Off-list and open-web destinations are denied. Allowlisted destinations may run if this assignment granted that capability.",
  },
  {
    name: "python.execute",
    description:
      "Request isolated python in this assignment's sandbox. The control plane decides. The agent does not run code itself.",
  },
] as const;
