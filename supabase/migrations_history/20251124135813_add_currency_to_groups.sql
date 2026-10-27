-- Add currency column to groups table
ALTER TABLE groups
ADD COLUMN currency VARCHAR(3) DEFAULT 'CLP';

-- Create index for currency lookups (optional but good for performance)
CREATE INDEX idx_groups_currency ON groups(currency);

-- Add comment to document the column
COMMENT ON COLUMN groups.currency IS 'ISO 4217 currency code (e.g., CLP, USD, EUR, MXN, ARS, COP)';
