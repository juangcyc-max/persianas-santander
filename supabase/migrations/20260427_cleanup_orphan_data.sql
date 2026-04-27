-- Limpia registros huérfanos de usuarios eliminados antes del fix de admin_delete_user
DELETE FROM pro_purchase_quotes  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM pro_messages         WHERE professional_user_id IS NOT NULL AND professional_user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM pro_projects         WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM cart_items           WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM invoices             WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM orders               WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM budgets              WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM blind_configurations WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM client_data          WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM professional_data    WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
