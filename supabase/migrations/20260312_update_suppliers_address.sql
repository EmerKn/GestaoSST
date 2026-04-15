-- Add new address fields to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS state text;
