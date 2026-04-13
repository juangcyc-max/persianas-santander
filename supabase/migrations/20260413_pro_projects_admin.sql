-- Añade admin_notes a pro_projects y políticas RLS para admin

ALTER TABLE pro_projects ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Política SELECT: el propio usuario O un admin puede ver los proyectos
CREATE POLICY "admins_select_all_pro_projects" ON pro_projects
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Política UPDATE: solo el admin puede actualizar cualquier proyecto
CREATE POLICY "admins_update_all_pro_projects" ON pro_projects
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
