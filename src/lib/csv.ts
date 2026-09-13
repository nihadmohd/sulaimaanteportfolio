/**
 * CSV toolkit (Task 11-b) — RFC-4180-correct, dependency-free, isomorphic.
 *
 * Powers GET /api/export (server → CSV attachment) and the Import & Export
 * console (client-side validate/preview) plus POST /api/import CSV mode.
 * Kept 100% pure (no db imports) so it is safe in the client bundle.
 *
 * Conventions:
 *  · Fields containing commas, quotes or line breaks are double-quoted,
 *    inner quotes escaped as "" (RFC-4180).
 *  · Line endings: CRLF on output; CR / LF / CRLF all accepted on input.
 *  · A leading BOM (Excel export artifact) is stripped on input.
 *  · The parser never throws — weird input degrades to its literal text.
 */

/** Cell value accepted by {@link toCsv}. */
export type CsvCell = string | number | boolean | null | undefined;

const BOM = "\uFEFF";

/**
 * Parse CSV text into a matrix of raw field strings (row 0 = headers).
 * Handles quoted fields, escaped quotes ("" → "), newlines inside quotes,
 * CRLF/CR/LF endings, a trailing newline, and a UTF-8 BOM. Blank trailing
 * rows are dropped; interior blank lines are preserved (callers skip them).
 */
export function parseCsv(text: string): string[][] {
  if (typeof text !== "string" || text.length === 0) return [];
  const src = text.startsWith(BOM) ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1; // consume the escaped quote pair
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1; // CRLF counts as one break
      pushRow();
      continue;
    }
    field += ch;
  }
  // Final row when the text does not end with a line break (or a quoted
  // field was left unterminated — its content is kept rather than thrown).
  if (field !== "" || row.length > 0 || inQuotes) pushRow();

  // Drop blank trailing rows (trailing newlines / empty final lines).
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 0 || last.every((cell) => cell === "")) rows.pop();
    else break;
  }
  return rows;
}

/** Escape one field per RFC-4180 (quote only when required). */
function escapeField(value: CsvCell): string {
  let s: string;
  if (value === null || value === undefined) s = "";
  else if (typeof value === "boolean") s = value ? "true" : "false";
  else s = String(value);
  if (s !== "" && /[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize a header row + data rows into CSV text (CRLF line endings,
 * trailing newline, minimal quoting). Null/undefined become empty cells.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines: string[] = [headers.map((h) => escapeField(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeField(cell)).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Parse CSV text into row objects keyed by the (whitespace-trimmed) header
 * names. Empty text → []. Interior blank lines are skipped. Rows with more
 * cells than headers keep them out of the object (extras ignored); missing
 * trailing cells read as "".
 */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const objects: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((cell) => cell.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      const header = headers[c];
      if (header) obj[header] = row[c] ?? "";
    }
    objects.push(obj);
  }
  return objects;
}

/**
 * Parse a CSV cell that should contain a JSON array of strings
 * (the format /api/export writes for tags/gallery/pros/cons/...).
 * Falls back to a friendlier `a | b | c` pipe-separated format for
 * hand-edited spreadsheets. Empty/invalid input → [].
 */
export function jsonArrayCell(value: string | null | undefined): string[] {
  const cell = (value ?? "").trim();
  if (!cell) return [];
  try {
    const parsed: unknown = JSON.parse(cell);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean);
    }
  } catch {
    // fall through to the pipe-separated fallback
  }
  return cell
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);
}
