import { z } from 'zod';
import { createTransactionSchema } from './transaction';

/** One parsed spreadsheet row, ready to become a transaction. */
export const importRowSchema = createTransactionSchema
  .omit({ clientId: true, isRecurring: true, recurringRuleId: true })
  .extend({
    /** 1-based row number in the uploaded file. */
    sourceRow: z.number().int().positive(),
    /** True when an identical transaction (date, name, amount, type) already exists in the sheet. */
    duplicate: z.boolean().default(false),
  });
export type ImportRow = z.infer<typeof importRowSchema>;

export interface ImportWarning {
  sourceRow: number;
  message: string;
}

export type ImportSuggestionSource = 'exact' | 'saved' | 'keyword';

/** A category as it appears in the uploaded file, with a proposed 1:1 mapping to an app category. */
export interface ImportCategoryInfo {
  name: string;
  count: number;
  /** Majority sign of the rows using it. */
  type: 'INCOME' | 'EXPENSE';
  /** Proposed app category name, or null to create it as a new category. */
  suggested: string | null;
  source: ImportSuggestionSource | null;
}

export interface ImportPreview {
  fileName: string;
  sheetName: string;
  rows: ImportRow[];
  skippedRows: number;
  duplicates: number;
  income: number;
  expenses: number;
  minDate: string | null;
  maxDate: string | null;
  /** Category names found in the file that are not in the Categories sheet yet. */
  newCategories: string[];
  /** Every category in the file with its mapping proposal (exact match, remembered mapping, keyword). */
  categories: ImportCategoryInfo[];
  warnings: ImportWarning[];
}

export const importCommitSchema = z.object({
  rows: z
    .array(importRowSchema)
    .min(1, 'Nothing to import')
    .max(10_000, 'At most 10,000 rows per import'),
  skipDuplicates: z.boolean().default(true),
  /** Create categories that appear in the file but not in the Categories sheet. */
  createCategories: z.boolean().default(true),
  /** file category → app category. Missing entries keep the file's name (created when createCategories). */
  categoryMap: z.record(z.string().trim().min(1), z.string().trim().min(1).max(100)).default({}),
});

/** Clients send big imports in chunks of this many rows to stay well under body-size limits. */
export const IMPORT_CHUNK_SIZE = 400;
export type ImportCommitInput = z.infer<typeof importCommitSchema>;

export interface ImportResult {
  imported: number;
  skipped: number;
  categoriesCreated: string[];
}

/** Column map used by the parser; fixed for the user's legacy export layout. */
export const IMPORT_LAYOUT = {
  firstDataRow: 3,
  columns: { name: 1, amount: 2, payment: 3, date: 4, time: 5, category: 6 },
} as const;

/**
 * Export mapping: app category → name written to the Excel file. Many app categories may share
 * one Excel name (many-to-one). Unmapped categories keep their app name.
 */
export const exportCategoryMapSchema = z.record(
  z.string().trim().min(1).max(100),
  z.string().trim().min(1).max(100),
);
export type ExportCategoryMap = z.infer<typeof exportCategoryMapSchema>;

export interface ExportCategorySettings {
  /** Saved mapping, pre-filled from the remembered import mapping (inverted) when nothing is saved yet. */
  map: ExportCategoryMap;
  /** Every app category the user has (Categories sheet plus names found on transactions). */
  categories: { name: string; type: 'INCOME' | 'EXPENSE' }[];
  /** Excel names seen before (from imports and the saved mapping), offered as quick picks. */
  fileNames: string[];
}
