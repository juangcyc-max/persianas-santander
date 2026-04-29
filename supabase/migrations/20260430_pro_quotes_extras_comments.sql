ALTER TABLE pro_purchase_quotes
  ADD COLUMN IF NOT EXISTS extras_amount   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_comments TEXT;
