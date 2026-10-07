/** Helpers for Google Sheets A1 notation. Columns are 1-based, rows are 1-based. */

export function columnLetter(index: number): string {
  if (index < 1) throw new Error(`Invalid column index ${index}`);
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export interface A1Range {
  sheet: string;
  startCol: number;
  startRow: number | null;
  endCol: number | null;
  endRow: number | null;
}

/** Build `'Sheet'!A1:F10`; omit rows for whole-column ranges (`'Sheet'!A:F`). */
export function a1(
  sheet: string,
  startCol: number,
  startRow: number | null,
  endCol?: number,
  endRow?: number | null,
): string {
  const start = `${columnLetter(startCol)}${startRow ?? ''}`;
  if (endCol === undefined) return `${quoteSheetTitle(sheet)}!${start}`;
  const end = `${columnLetter(endCol)}${endRow ?? ''}`;
  return `${quoteSheetTitle(sheet)}!${start}:${end}`;
}

const RANGE_RE = /^(?:'((?:[^']|'')+)'|([^'!]+))!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/i;

export function parseA1(range: string): A1Range {
  const match = RANGE_RE.exec(range.trim());
  if (!match) throw new Error(`Unsupported A1 range: ${range}`);
  const [, quoted, bare, sc, sr, ec, er] = match;
  return {
    sheet: (quoted ?? bare ?? '').replace(/''/g, "'"),
    startCol: columnIndex(sc ?? 'A'),
    startRow: sr ? Number(sr) : null,
    endCol: ec ? columnIndex(ec) : null,
    endRow: er ? Number(er) : null,
  };
}

/** Extract the first row number from a range like `'Sheet'!A12:J12`. */
export function firstRowOf(range: string): number | null {
  return parseA1(range).startRow;
}
