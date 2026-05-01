-- Añade número y estado de presupuesto de cliente a las cotizaciones de compra
ALTER TABLE pro_purchase_quotes
  ADD COLUMN IF NOT EXISTS budget_number text,
  ADD COLUMN IF NOT EXISTS budget_status text DEFAULT 'borrador'
    CHECK (budget_status IN ('borrador', 'enviado', 'aceptado', 'facturado'));
