-- Migration: Add sheet_row_index to operational_matches for exact sequential Google Sheets order
ALTER TABLE operational_matches ADD COLUMN IF NOT EXISTS sheet_row_index INTEGER;
CREATE INDEX IF NOT EXISTS idx_operational_matches_sheet_row_index ON operational_matches(sheet_row_index);
