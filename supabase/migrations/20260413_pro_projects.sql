-- ============================================================
-- Migración: Tabla de proyectos profesionales
-- Cada proyecto agrupa múltiples configuraciones de un cliente
-- Fecha: 2026-04-13
-- ============================================================

CREATE TABLE IF NOT EXISTS pro_projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  client_name     TEXT,
  client_phone    TEXT,
  client_email    TEXT,
  client_address  TEXT,
  client_nif      TEXT,
  notes           TEXT,
  status          TEXT        DEFAULT 'draft',
  items           JSONB       DEFAULT '[]'::jsonb,
  budget_number   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pro_projects
  DROP CONSTRAINT IF EXISTS pro_projects_status_check;

ALTER TABLE pro_projects
  ADD CONSTRAINT pro_projects_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected'));

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS pro_projects_user_id_idx ON pro_projects (user_id);

-- RLS
ALTER TABLE pro_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_projects" ON pro_projects;
CREATE POLICY "users_manage_own_projects" ON pro_projects
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Estructura del array items (JSONB) ──────────────────────
-- Cada elemento del array tiene la forma:
-- {
--   "item_id":       "uuid local",
--   "config_id":     "uuid | null",
--   "description":   "Ventana salón",
--   "blind_type":    "laminada",
--   "mechanism":     "motor",
--   "motor_type":    "mando_distancia | null",
--   "guide_type":    "none | v25 | h25",
--   "width":         1000,
--   "height":        1200,
--   "box_color_name": "Marfil",
--   "slat_color_name": "Marfil",
--   "cost_price":    160.92,
--   "client_price":  200.00
-- }

-- ── Verificación ──
-- SELECT id, name, client_name, status, jsonb_array_length(items) AS num_items FROM pro_projects LIMIT 5;
