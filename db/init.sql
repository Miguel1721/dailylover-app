-- ============================================================================
-- Daily Lover — Schema Completo de Base de Datos
-- Última actualización: 2026-07-25
-- ============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DOMINIO 1: MATCHMAKING (Core del Negocio)
-- ============================================================================

-- Users table (basic contact info + identification)
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    phone       VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100),
    email       VARCHAR(150),
    client_code VARCHAR(20) UNIQUE,          -- Código visible DL-0001, DL-0042, etc.
    id_number   VARCHAR(30) UNIQUE,          -- Cédula / documento de identidad
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Trigger: Auto-asignar client_code al insertar
CREATE OR REPLACE FUNCTION assign_client_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.client_code IS NULL THEN
        NEW.client_code := 'DL-' || LPAD(NEW.id::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_client_code ON users;
CREATE TRIGGER trigger_assign_client_code
BEFORE INSERT ON users
FOR EACH ROW EXECUTE FUNCTION assign_client_code();

-- Índice para búsqueda fuzzy por nombre
CREATE INDEX IF NOT EXISTS idx_users_name_trgm
    ON users USING gin (lower(name) gin_trgm_ops);


-- Profiles table (psychographic dimensions + clinical data)
CREATE TABLE IF NOT EXISTS profiles (
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    -- Datos demográficos (importados de Excel y formularios)
    age                 INTEGER,
    gender              VARCHAR(20),               -- Masculino / Femenino / Otro
    city                VARCHAR(100),              -- Bogotá, Medellín, etc.
    estatura            VARCHAR(20),               -- Altura ("1.72", "172cm")
    occupation          VARCHAR(150),              -- Profesión
    education           VARCHAR(200),              -- Universidad / nivel educativo
    religion            VARCHAR(50),               -- Religión
    photo_url           VARCHAR(500),              -- URL de foto de perfil
    -- Perfil psicológico (22 dimensiones)
    ocean               JSONB,                     -- {apertura, responsabilidad, extroversion, amabilidad, neuroticismo}
    apego               JSONB,                     -- {estilo: seguro|ansioso|evitativo, intensidad: 0-1}
    motivacion          VARCHAR(50),               -- exploracion|conexion_profunda|validacion|diversion
    rol_social          VARCHAR(30),               -- lider|mediador|oyente|dinamizador
    energia_social      FLOAT,                     -- 0.0 - 1.0
    momento_vital       VARCHAR(30),               -- explorando|listo_vinculo|consolidado|transitando
    love_language        VARCHAR(100),             -- Lenguaje del amor (Actos de Servicio, Tiempo de Calidad, etc.)
    -- Datos clínicos extendidos
    bio_notes           TEXT,                      -- Notas clínicas de la psicóloga
    lifestyle           JSONB,                     -- Hábitos: hijos, ejercicio, mascotas, rumba, fumar, bebida, photos[]
    search_preferences  JSONB,                     -- Preferencias de búsqueda: rango_edad, ubicacion, valores_clave
    plan_tier           VARCHAR(30),               -- Plan contratado (básico, premium, VIP)
    responsable         VARCHAR(50),               -- Psicóloga asignada (SILVI, STEFFY, MANU, ANA)
    -- Datos originales del cuestionario
    intereses           TEXT[],
    valores             TEXT[],
    raw_answers         TEXT[],                    -- Respuestas originales del usuario
    version             INTEGER DEFAULT 1,
    updated_at          TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

-- Índices para filtros comunes
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_responsable ON profiles(responsable);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);


-- Embeddings table (Vector storage for K-means clustering)
CREATE TABLE IF NOT EXISTS embeddings (
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    vector      vector(1536),      -- text-embedding-3-small
    created_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_cosine_idx ON embeddings 
    USING ivfflat (vector vector_cosine_ops)
    WITH (lists = 100);


-- Historical Matches table (matches importados de Excel + creados en el sistema)
CREATE TABLE IF NOT EXISTS historical_matches (
    id              SERIAL PRIMARY KEY,
    person_a        VARCHAR(200),              -- Nombre de persona A (legacy, texto)
    person_b        VARCHAR(200),              -- Nombre de persona B (legacy, texto)
    user_id_a       INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- FK a users (nuevo)
    user_id_b       INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- FK a users (nuevo)
    matchmaker      VARCHAR(50),               -- "MATCHES SILVI", "SILVI", etc.
    match_date      VARCHAR(50),               -- ⚠️ Tipo texto por datos legacy de Excel
    city            VARCHAR(100),
    status          VARCHAR(50) DEFAULT 'PENDIENTE',  -- PENDIENTE, APROBADO, RECHAZADO, CANCELADO
    venue           VARCHAR(200),              -- Lugar de la cita
    observations    TEXT,                      -- Notas de la psicóloga
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_hm_user_a ON historical_matches(user_id_a);
CREATE INDEX IF NOT EXISTS idx_hm_user_b ON historical_matches(user_id_b);
CREATE INDEX IF NOT EXISTS idx_hm_status ON historical_matches(status);
CREATE INDEX IF NOT EXISTS idx_hm_matchmaker ON historical_matches(matchmaker);
CREATE INDEX IF NOT EXISTS idx_hm_person_a_lower ON historical_matches(lower(person_a));
CREATE INDEX IF NOT EXISTS idx_hm_person_b_lower ON historical_matches(lower(person_b));


-- Events table
CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    date            TIMESTAMP NOT NULL,
    location        VARCHAR(200),
    format          VARCHAR(100),
    capacity        INTEGER,
    price           DECIMAL(10,2),
    budget_income   DECIMAL(14,2),             -- Presupuesto estimado de ingresos
    budget_expenses DECIMAL(14,2),             -- Presupuesto estimado de gastos
    status          VARCHAR(30) DEFAULT 'upcoming', -- upcoming, active, PUBLICADO, completed
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Event Attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
    event_id    INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(30) DEFAULT 'pending', -- pending|confirmed|cancelled|attended|no_show
    created_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- Post-Event Feedback table (Claude processed feedback)
CREATE TABLE IF NOT EXISTS post_event_feedback (
    id                      SERIAL PRIMARY KEY,
    event_id                INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id                 INTEGER REFERENCES users(id) ON DELETE CASCADE,
    satisfaccion            INTEGER, -- 0-10
    conexiones_positivas    JSONB,   -- Array of {descripcion, intensidad, tipo}
    conexiones_negativas    TEXT[],
    momento_destaque        TEXT,
    friccion_detectada      TEXT,
    probabilidad_retorno    FLOAT,
    raw_text                TEXT,    -- Original WhatsApp voice transcript / text
    created_at              TIMESTAMP DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

-- Match Requests table
CREATE TABLE IF NOT EXISTS match_requests (
    id          SERIAL PRIMARY KEY,
    event_id    INTEGER REFERENCES events(id) ON DELETE CASCADE,
    from_user   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    to_user     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(30) DEFAULT 'pending', -- pending|accepted|rejected
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (event_id, from_user, to_user)
);

-- Reminders / Priority Tasks table
CREATE TABLE IF NOT EXISTS reminders (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    client_name     VARCHAR(255),
    client_phone    VARCHAR(50),
    priority        VARCHAR(20) DEFAULT 'ALTA',    -- URGENTE, ALTA, MEDIA, BAJA
    matchmaker      VARCHAR(50),                   -- SILVI, STEFFY, MANU, MARÍA PAULA
    due_date        VARCHAR(50),
    completed       BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);


-- ============================================================================
-- DOMINIO 2: FINANZAS Y OPERACIONES
-- ============================================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150) NOT NULL,
    role            VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(150),
    base_salary     NUMERIC(12,2) NOT NULL,
    contract_type   VARCHAR(30) DEFAULT 'nomina',
    hire_date       DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Commission rules table
CREATE TABLE IF NOT EXISTS commission_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
    commission_type VARCHAR(20) NOT NULL,
    value           NUMERIC(10,2) NOT NULL,
    applies_to      VARCHAR(30) DEFAULT 'event',
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Employee event commissions table
CREATE TABLE IF NOT EXISTS employee_event_commissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     UUID REFERENCES employees(id),
    event_id        INTEGER REFERENCES events(id),
    amount          NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Payroll runs table
CREATE TABLE IF NOT EXISTS payroll_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month        INTEGER NOT NULL,
    period_year         INTEGER NOT NULL,
    status              VARCHAR(20) DEFAULT 'draft',
    total_base          NUMERIC(14,2),
    total_commissions   NUMERIC(14,2),
    total_deductions    NUMERIC(14,2),
    total_paid          NUMERIC(14,2),
    liquidated_at       TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Payroll items table
CREATE TABLE IF NOT EXISTS payroll_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id  UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id     UUID REFERENCES employees(id),
    base_salary     NUMERIC(12,2),
    commissions     NUMERIC(12,2) DEFAULT 0,
    deductions      NUMERIC(12,2) DEFAULT 0,
    total           NUMERIC(12,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Income records table
CREATE TABLE IF NOT EXISTS income_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        INTEGER REFERENCES events(id),
    category        VARCHAR(50) NOT NULL,
    description     VARCHAR(255),
    amount          NUMERIC(12,2) NOT NULL,
    payment_method  VARCHAR(30),
    received_at     DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Expense records table
CREATE TABLE IF NOT EXISTS expense_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        INTEGER REFERENCES events(id),
    category        VARCHAR(50) NOT NULL,
    description     VARCHAR(255),
    amount          NUMERIC(12,2) NOT NULL,
    payment_method  VARCHAR(30),
    paid_at         DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Vendors table (Proveedores / aliados)
CREATE TABLE IF NOT EXISTS vendors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    category        VARCHAR(50) NOT NULL,         -- restaurante, logistica, fotografia, musica, etc.
    contact_name    VARCHAR(150),
    phone           VARCHAR(20),
    email           VARCHAR(150),
    agreed_rate     NUMERIC(12,2),
    rate_type       VARCHAR(30),                  -- por_evento, por_hora, fijo_mensual
    internal_rating INTEGER CHECK (internal_rating BETWEEN 1 AND 5),
    notes           TEXT,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Vendor history (historial de eventos con cada proveedor)
CREATE TABLE IF NOT EXISTS vendor_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id           UUID REFERENCES vendors(id) ON DELETE CASCADE,
    event_id            INTEGER REFERENCES events(id),
    amount_paid         NUMERIC(12,2),
    performance_note    TEXT,
    would_rehire        BOOLEAN,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Accounts Receivable (Cuentas por cobrar a clientes)
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         INTEGER REFERENCES users(id),
    concept         VARCHAR(255) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, paid, overdue
    due_date        DATE,
    paid_at         DATE,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);


-- ============================================================================
-- DOMINIO 3: CONTROL DE ACCESO (RBAC)
-- ============================================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) UNIQUE NOT NULL,
    description     VARCHAR(255),
    is_system       BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module          VARCHAR(50) NOT NULL,
    action          VARCHAR(20) NOT NULL,
    label           VARCHAR(150) NOT NULL,
    UNIQUE(module, action)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User Accounts (for admin panel access)
CREATE TABLE IF NOT EXISTS user_accounts (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id           UUID REFERENCES employees(id) ON DELETE CASCADE,
    email                 VARCHAR(150) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    role_id               UUID REFERENCES roles(id),
    status                VARCHAR(20) DEFAULT 'active',
    must_change_password  BOOLEAN DEFAULT true,
    last_login_at         TIMESTAMP,
    created_at            TIMESTAMP DEFAULT NOW()
);
