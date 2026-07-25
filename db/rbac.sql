-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) UNIQUE NOT NULL,
    description     VARCHAR(255),
    is_system       BOOLEAN DEFAULT false,        -- true para el rol "Admin" que no se puede borrar
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Catalog of modules and actions available
CREATE TABLE IF NOT EXISTS permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module          VARCHAR(50) NOT NULL,          -- 'clientes', 'eventos', 'nomina', 'finanzas', 'matching', etc.
    action          VARCHAR(20) NOT NULL,          -- 'view', 'create', 'edit', 'delete', 'export'
    label           VARCHAR(150) NOT NULL,         -- readable text
    UNIQUE(module, action)
);

-- Relationship: which permissions each role has
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Access accounts for employees
CREATE TABLE IF NOT EXISTS user_accounts (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id           UUID REFERENCES employees(id) ON DELETE CASCADE,
    email                 VARCHAR(150) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    role_id               UUID REFERENCES roles(id),
    status                VARCHAR(20) DEFAULT 'active',   -- active / suspended
    must_change_password  BOOLEAN DEFAULT true,
    last_login_at         TIMESTAMP,
    created_at            TIMESTAMP DEFAULT NOW()
);
