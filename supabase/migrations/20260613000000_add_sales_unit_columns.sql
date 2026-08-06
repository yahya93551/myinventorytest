-- Add unit metadata to sales so converted-unit sales can be tracked and reported.
ALTER TABLE IF EXISTS sales
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS quantity_unit text;
