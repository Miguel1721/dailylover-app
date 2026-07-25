-- ═══════════════════════════════════════════════════════════════
-- NightPulse AI — Database Schema
-- Grupo Evedesa: Plataforma de inteligencia operativa nocturna
-- ═══════════════════════════════════════════════════════════════

-- ─── BRANDS (Marcas del grupo) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    genre           VARCHAR(100),           -- vallenato, crossover, electrónica, reggaetón, etc.
    accent_color    VARCHAR(7) DEFAULT '#8B5CF6',
    city            VARCHAR(100) DEFAULT 'Bogotá',
    capacity        INTEGER DEFAULT 500,
    description     TEXT,
    logo_url        VARCHAR(500),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── VENUES (Sedes/Locales) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
    id              SERIAL PRIMARY KEY,
    brand_id        INTEGER REFERENCES brands(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    address         VARCHAR(500),
    city            VARCHAR(100) NOT NULL,
    capacity        INTEGER DEFAULT 500,
    num_bars        INTEGER DEFAULT 2,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── PRODUCT CATEGORIES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) DEFAULT 'licor'  -- licor, coctel, cerveza, sin_alcohol, comida
);

-- ─── PRODUCTS (Licores, Cocteles, etc.) ───────────────────────
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER REFERENCES product_categories(id),
    name            VARCHAR(200) NOT NULL,
    sku             VARCHAR(50) UNIQUE,
    unit            VARCHAR(20) DEFAULT 'botella',    -- botella, trago, unidad
    cost_price      DECIMAL(12,2) DEFAULT 0,
    sell_price      DECIMAL(12,2) DEFAULT 0,
    ml_per_unit     INTEGER DEFAULT 750,              -- ml por botella
    ml_per_serve    INTEGER DEFAULT 45,               -- ml por trago
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── INVENTORY (Stock por sede) ───────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
    bar_number      INTEGER DEFAULT 1,
    stock_bottles   DECIMAL(8,2) DEFAULT 0,
    min_stock       DECIMAL(8,2) DEFAULT 2,
    last_counted_at TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(venue_id, product_id, bar_number)
);

-- ─── INVENTORY MOVEMENTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
    id              SERIAL PRIMARY KEY,
    inventory_id    INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL,    -- entrada, venta, merma, transferencia, ajuste
    quantity        DECIMAL(8,2) NOT NULL,
    reference       VARCHAR(200),            -- factura, POS ticket, etc.
    notes           TEXT,
    recorded_by     VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── NIGHTLY SALES (Ventas por noche) ─────────────────────────
CREATE TABLE IF NOT EXISTS nightly_sales (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    sale_date       DATE NOT NULL,
    product_id      INTEGER REFERENCES products(id),
    quantity_sold   INTEGER DEFAULT 0,
    revenue         DECIMAL(12,2) DEFAULT 0,
    bartender_name  VARCHAR(100),
    bar_number      INTEGER DEFAULT 1,
    hour_sold       INTEGER,                  -- 0-23
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── CASH REGISTER (Cierre de caja) ──────────────────────────
CREATE TABLE IF NOT EXISTS cash_registers (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    register_date   DATE NOT NULL,
    
    -- Ingresos
    cash_total      DECIMAL(12,2) DEFAULT 0,
    card_total      DECIMAL(12,2) DEFAULT 0,
    nequi_total     DECIMAL(12,2) DEFAULT 0,
    rappi_total     DECIMAL(12,2) DEFAULT 0,
    cover_total     DECIMAL(12,2) DEFAULT 0,
    
    -- POS
    pos_total       DECIMAL(12,2) DEFAULT 0,
    
    -- Anomalías
    discrepancy     DECIMAL(12,2) DEFAULT 0,
    void_count      INTEGER DEFAULT 0,
    discount_count  INTEGER DEFAULT 0,
    courtesy_count  INTEGER DEFAULT 0,
    
    -- Estado
    status          VARCHAR(30) DEFAULT 'pending',  -- pending, reviewed, approved, flagged
    anomaly_score   DECIMAL(5,2) DEFAULT 0,         -- 0-100
    ai_notes        TEXT,
    reviewed_by     VARCHAR(100),
    
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(venue_id, register_date)
);

-- ─── CASH ANOMALIES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_anomalies (
    id              SERIAL PRIMARY KEY,
    register_id     INTEGER REFERENCES cash_registers(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,    -- void_excess, discount_unauthorized, courtesy_over_limit, discrepancy
    severity        VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, critical
    amount          DECIMAL(12,2),
    description     TEXT,
    employee_name   VARCHAR(100),
    detected_at     TIMESTAMP DEFAULT NOW()
);

-- ─── EMPLOYEES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(200) NOT NULL,
    document_id     VARCHAR(20) UNIQUE,
    role            VARCHAR(50) NOT NULL,    -- bartender, mesero, seguridad, dj, anfitrion, gerente
    phone           VARCHAR(20),
    email           VARCHAR(200),
    hourly_rate     DECIMAL(10,2) DEFAULT 0,
    is_permanent    BOOLEAN DEFAULT TRUE,    -- vs temporal/evento
    is_active       BOOLEAN DEFAULT TRUE,
    hired_at        DATE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── EMPLOYEE-VENUE (Asignaciones) ────────────────────────────
CREATE TABLE IF NOT EXISTS employee_venues (
    employee_id     INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    is_primary      BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (employee_id, venue_id)
);

-- ─── SHIFTS (Turnos) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    shift_date      DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    
    -- Recargos colombianos
    is_night        BOOLEAN DEFAULT TRUE,     -- Recargo nocturno 35%
    is_sunday       BOOLEAN DEFAULT FALSE,    -- Recargo dominical 75%
    is_holiday      BOOLEAN DEFAULT FALSE,    -- Recargo festivo 100%
    
    hours_worked    DECIMAL(5,2),
    base_pay        DECIMAL(10,2),
    surcharges      DECIMAL(10,2) DEFAULT 0,
    total_pay       DECIMAL(10,2),
    
    status          VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, confirmed, completed, no_show
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── CUSTOMERS (CRM) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(200),
    phone           VARCHAR(20),
    email           VARCHAR(200),
    instagram       VARCHAR(100),
    birth_date      DATE,
    vip_tier        VARCHAR(20) DEFAULT 'regular',   -- regular, silver, gold, platinum
    total_visits    INTEGER DEFAULT 0,
    total_spend     DECIMAL(12,2) DEFAULT 0,
    preferred_drink VARCHAR(200),
    notes           TEXT,
    no_show_score   DECIMAL(5,2) DEFAULT 0,          -- 0-100 probabilidad de no-show
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── CUSTOMER BRAND AFFINITY ─────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_brand_visits (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    brand_id        INTEGER REFERENCES brands(id) ON DELETE CASCADE,
    visit_count     INTEGER DEFAULT 0,
    last_visit      DATE,
    avg_spend       DECIMAL(12,2) DEFAULT 0
);

-- ─── RESERVATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES customers(id),
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL,
    party_size      INTEGER DEFAULT 2,
    type            VARCHAR(50) DEFAULT 'table',     -- table, vip, bottle_service, birthday, event
    status          VARCHAR(30) DEFAULT 'pending',   -- pending, confirmed, arrived, no_show, cancelled
    bottle_package  VARCHAR(200),
    estimated_spend DECIMAL(12,2),
    deposit_paid    DECIMAL(12,2) DEFAULT 0,
    special_notes   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── EVENTS (Artistas / Shows) ────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    event_date      DATE NOT NULL,
    artist_name     VARCHAR(200),
    artist_cost     DECIMAL(12,2) DEFAULT 0,
    cover_price     DECIMAL(10,2) DEFAULT 0,
    expected_attendance INTEGER,
    actual_attendance   INTEGER,
    total_revenue   DECIMAL(12,2),
    total_cost      DECIMAL(12,2),
    roi_percentage  DECIMAL(8,2),
    status          VARCHAR(30) DEFAULT 'scheduled',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── COMPLIANCE CHECKLISTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_items (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    category        VARCHAR(100) NOT NULL,   -- DIAN, Sayco-Acinpro, Bomberos, Aforo, Ley Seca
    item_name       VARCHAR(300) NOT NULL,
    due_date        DATE,
    status          VARCHAR(30) DEFAULT 'pending',  -- pending, completed, overdue, not_applicable
    responsible     VARCHAR(200),
    document_url    VARCHAR(500),
    notes           TEXT,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── AI INSIGHTS LOG ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id),
    brand_id        INTEGER REFERENCES brands(id),
    type            VARCHAR(50) NOT NULL,    -- daily_summary, alert, recommendation, anomaly
    severity        VARCHAR(20) DEFAULT 'info',
    title           VARCHAR(300),
    content         TEXT NOT NULL,
    data_json       JSONB,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── ALERTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              SERIAL PRIMARY KEY,
    venue_id        INTEGER REFERENCES venues(id),
    brand_id        INTEGER REFERENCES brands(id),
    type            VARCHAR(50) NOT NULL,    -- stock_low, anomaly, compliance, forecast
    severity        VARCHAR(20) DEFAULT 'warning',
    title           VARCHAR(300) NOT NULL,
    message         TEXT,
    is_resolved     BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── USERS (Platform Auth) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(200) UNIQUE NOT NULL,
    password_hash   VARCHAR(200) NOT NULL,
    full_name       VARCHAR(200),
    role            VARCHAR(50) DEFAULT 'viewer',   -- superadmin, admin, manager, viewer
    brand_access    INTEGER[],                       -- array of brand IDs they can access
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_nightly_sales_date ON nightly_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_nightly_sales_venue ON nightly_sales(venue_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_date ON cash_registers(register_date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON ai_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_venue ON inventory(venue_id);
