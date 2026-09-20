import ExcelJS from "exceljs";
import type { TaskWorkspace } from "./workspace";

export interface SheetSpec {
  name: string;
  rows: Array<Array<string | number | null>>;
}

export async function createSpreadsheet(
  workspace: TaskWorkspace,
  filename: string,
  title: string,
  sheets: SheetSpec[],
): Promise<{ path: string; sheets: string[] }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WorkerLayer";
  workbook.created = new Date();
  workbook.title = title;

  const usable = sheets.length > 0 ? sheets : [{ name: "Sheet1", rows: [] }];
  for (const spec of usable) {
    const sheet = workbook.addWorksheet(spec.name.slice(0, 31));
    for (const row of spec.rows) {
      sheet.addRow(row);
    }
    sheet.columns.forEach((column) => {
      column.width = 28;
    });
    if (spec.rows[0]) {
      sheet.getRow(1).font = { bold: true };
    }
  }

  const relativePath = filename.startsWith("artifacts/")
    ? filename
    : `artifacts/${filename}`;
  const abs = workspace.resolve(relativePath);
  await workbook.xlsx.writeFile(abs);
  workspace.writeBytes(
    relativePath.replace(/\.xlsx$/i, ".grid.json"),
    JSON.stringify({ title, sheets: usable }, null, 2),
  );
  return { path: relativePath, sheets: usable.map((sheet) => sheet.name) };
}

export async function readSpreadsheetSummary(
  workspace: TaskWorkspace,
  relativePath: string,
): Promise<{
  path: string;
  sheets: Array<{ name: string; rowCount: number; headers: string[] }>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workspace.resolve(relativePath));
  const sheets = workbook.worksheets.map((sheet) => {
    const header = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((value) => String(value ?? ""));
    return {
      name: sheet.name,
      rowCount: sheet.rowCount,
      headers: header,
    };
  });
  return { path: relativePath, sheets };
}

export interface OpenedSheet {
  name: string;
  rowCount: number;
  rows: string[][];
}

export function sheetsToText(sheets: OpenedSheet[]): string {
  const lines: string[] = [];
  for (const sheet of sheets) {
    lines.push(`# ${sheet.name}`);
    const header = sheet.rows[0] ?? [];
    const metricValue =
      header.length >= 2 &&
      /metric|field|label|company/i.test(header[0] ?? "") &&
      /value|funding|amount|note/i.test(header[1] ?? "");
    for (const row of sheet.rows.slice(1)) {
      if (row.every((cell) => !cell)) continue;
      if (metricValue && row[0]) {
        const name = row[0];
        const value = row[1] ?? "";
        if (/company/i.test(header[0] ?? "") && value) {
          lines.push(`# ${name}`);
          lines.push(`${header[1]}: ${value}`);
          continue;
        }
        lines.push(`${name}: ${value}`);
        continue;
      }
      lines.push(row.filter(Boolean).join(" | "));
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export async function openSpreadsheet(
  workspace: TaskWorkspace,
  relativePath: string,
): Promise<{
  path: string;
  opened: true;
  sheets: OpenedSheet[];
  text: string;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workspace.resolve(relativePath));
  const sheets: OpenedSheet[] = workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1).map((value) =>
        value == null ? "" : String(value),
      );
      rows.push(values);
    });
    return { name: sheet.name, rowCount: sheet.rowCount, rows };
  });
  return {
    path: relativePath,
    opened: true,
    sheets,
    text: sheetsToText(sheets),
  };
}
