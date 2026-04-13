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

-- ── 2. cart_items (referencias a blind_configurations) ───────
-- Los cart_items referencian blind_configurations via FK,
-- no almacenan blind_type directamente → no requieren cambio.

-- ── 3. orders / order_items ──────────────────────────────────

-- Quitar restricción CHECK existente en blind_type (si la hay)
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_blind_type_check;

UPDATE order_items
  SET blind_type = 'sistema_mini_cajon_pvc'
  WHERE blind_type = 'sistema_mini_pvc';

UPDATE order_items
  SET blind_type = 'sistema_mini_cajon_aluminio'
  WHERE blind_type = 'sistema_mini_aluminio';

ALTER TABLE order_items
  ADD CONSTRAINT order_items_blind_type_check
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

-- ── 5. mechanism column — añadir 'motor' como valor válido para bloqueantes ─
-- (si existe un CHECK en mechanism, asegurarse de que 'motor' está permitido)
-- Generalmente ya está permitido, pero por si acaso:

ALTER TABLE blind_configurations
  DROP CONSTRAINT IF EXISTS blind_configurations_mechanism_check;

ALTER TABLE blind_configurations
  ADD CONSTRAINT blind_configurations_mechanism_check
  CHECK (mechanism IN ('muelle', 'cinta', 'motor'));

-- ── Verificación (ejecutar manualmente para comprobar) ───────
-- SELECT blind_type, COUNT(*) FROM blind_configurations GROUP BY blind_type ORDER BY blind_type;
-- SELECT blind_type, COUNT(*) FROM order_items GROUP BY blind_type ORDER BY blind_type;
