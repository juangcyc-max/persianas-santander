-- ============================================================
-- Migración: Añadir campos de comentarios y estado a presupuestos
-- Fecha: 2026-04-13
-- ============================================================

-- Añadir columna de comentarios del cliente
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS client_notes TEXT DEFAULT NULL;

-- Añadir columna de notas internas del administrador
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL;

-- Añadir columna de estado del presupuesto
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS budget_status TEXT DEFAULT 'pending';

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_budget_status_check;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_budget_status_check
  CHECK (budget_status IN ('pending', 'reviewed', 'sent', 'accepted', 'rejected'));

-- Añadir columna de precio modificado por el admin
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS admin_price NUMERIC DEFAULT NULL;

-- ── Verificación ──
-- SELECT id, budget_number, client_notes, admin_notes, budget_status FROM budgets LIMIT 5;
