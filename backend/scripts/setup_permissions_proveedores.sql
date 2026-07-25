-- Insert permissions for proveedores
INSERT INTO permissions (module, action, label)
VALUES 
  ('proveedores', 'view', 'Ver Proveedores'),
  ('proveedores', 'create', 'Crear Proveedores'),
  ('proveedores', 'edit', 'Editar Proveedores'),
  ('proveedores', 'delete', 'Eliminar Proveedores')
ON CONFLICT (module, action) DO NOTHING;

-- Associate new permissions to the Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.module = 'proveedores'
ON CONFLICT (role_id, permission_id) DO NOTHING;
