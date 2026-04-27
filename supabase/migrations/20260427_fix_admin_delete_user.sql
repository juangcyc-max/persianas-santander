-- Reemplaza admin_delete_user para borrar registros dependientes antes de borrar el usuario
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admins pueden llamar esta función
  IF (SELECT raw_user_meta_data->>'user_type' FROM auth.users WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Borrar registros dependientes en orden (respetando FKs entre tablas)
  DELETE FROM pro_purchase_quotes  WHERE user_id = target_user_id;
  DELETE FROM pro_messages         WHERE professional_user_id = target_user_id;
  DELETE FROM pro_projects         WHERE user_id = target_user_id;
  DELETE FROM cart_items           WHERE user_id = target_user_id;
  DELETE FROM invoices             WHERE user_id = target_user_id;
  DELETE FROM orders               WHERE user_id = target_user_id;
  DELETE FROM budgets              WHERE user_id = target_user_id;
  DELETE FROM blind_configurations WHERE user_id = target_user_id;
  DELETE FROM client_data          WHERE user_id = target_user_id;
  DELETE FROM professional_data    WHERE user_id = target_user_id;
  DELETE FROM profiles             WHERE id      = target_user_id;

  -- Finalmente borrar el usuario de auth
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
