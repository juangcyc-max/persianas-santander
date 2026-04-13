-- ============================================================
-- Migración: Renombrar tipos de persiana en la base de datos
-- Fecha: 2026-04-13
-- ============================================================

-- ── 1. blind_configurations ──────────────────────────────────

-- Quitar restricción CHECK existente (si la hay) en blind_type
ALTER TABLE blind_configurations
  DROP CONSTRAINT IF EXISTS blind_configurations_blind_type_check;

-- Renombrar valores en registros existentes
UPDATE blind_configurations
  SET blind_type = 'sistema_mini_cajon_pvc'
  WHERE blind_type = 'sistema_mini_pvc';

UPDATE blind_configurations
  SET blind_type = 'sistema_mini_cajon_aluminio'
  WHERE blind_type = 'sistema_mini_aluminio';

-- Añadir nueva restricción CHECK con todos los tipos válidos
ALTER TABLE blind_configurations
  ADD CONSTRAINT blind_configurations_blind_type_check
  CHECK (blind_type IN (
    'laminada',
    'autoblocante',
    'blocking',
    'sistema_mini_cajon_pvc',
    'sistema_mini_cajon_aluminio',
    'sistema_mini_autoblocante',
    'solo_guias',
    'solo_motor',
    'mosquitera_enrollable',
    -- legacy (mantener para datos históricos)
    'sistema_mini_pvc',
    'sistema_mini_aluminio',
    'motor_mas_guias',
    'pano_mas_guias',
    'normal',
    'sistema_mini'
  ));

-- ── 2. mechanism column ───────────────────────────────────────
-- Por si acaso existe un CHECK en mechanism:
ALTER TABLE blind_configurations
  DROP CONSTRAINT IF EXISTS blind_configurations_mechanism_check;

ALTER TABLE blind_configurations
  ADD CONSTRAINT blind_configurations_mechanism_check
  CHECK (mechanism IN ('muelle', 'cinta', 'motor'));

-- ── 3. orders.items (JSONB array) ────────────────────────────
-- Los items se guardan como JSON dentro de orders.items.
-- Hacemos replace sobre el texto del JSON (seguro porque buscamos
-- strings con comillas, únicos en el JSON).

UPDATE orders
  SET items = replace(
    items::text,
    '"sistema_mini_pvc"',
    '"sistema_mini_cajon_pvc"'
  )::jsonb
  WHERE items::text LIKE '%"sistema_mini_pvc"%';

UPDATE orders
  SET items = replace(
    items::text,
    '"sistema_mini_aluminio"',
    '"sistema_mini_cajon_aluminio"'
  )::jsonb
  WHERE items::text LIKE '%"sistema_mini_aluminio"%';

-- ── 4. budgets ───────────────────────────────────────────────

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_blind_type_check;

UPDATE budgets
  SET blind_type = 'sistema_mini_cajon_pvc'
  WHERE blind_type = 'sistema_mini_pvc';

UPDATE budgets
  SET blind_type = 'sistema_mini_cajon_aluminio'
  WHERE blind_type = 'sistema_mini_aluminio';

ALTER TABLE budgets
  ADD CONSTRAINT budgets_blind_type_check
  CHECK (blind_type IN (
    'laminada',
    'autoblocante',
    'blocking',
    'sistema_mini_cajon_pvc',
    'sistema_mini_cajon_aluminio',
    'sistema_mini_autoblocante',
    'solo_guias',
    'solo_motor',
    'mosquitera_enrollable',
    'sistema_mini_pvc',
    'sistema_mini_aluminio',
    'motor_mas_guias',
    'pano_mas_guias',
    'normal',
    'sistema_mini'
  ));

-- ── Verificación (ejecutar manualmente para comprobar) ───────
-- SELECT blind_type, COUNT(*) FROM blind_configurations GROUP BY blind_type ORDER BY blind_type;
-- SELECT blind_type, COUNT(*) FROM budgets GROUP BY blind_type ORDER BY blind_type;
-- SELECT COUNT(*) FROM orders WHERE items::text LIKE '%sistema_mini_pvc%';
