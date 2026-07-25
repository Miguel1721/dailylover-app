-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create accounts_receivable table
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    due_date        DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending', -- pending / paid
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 2. Create event_incidents table
CREATE TABLE IF NOT EXISTS event_incidents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        INTEGER REFERENCES events(id) ON DELETE CASCADE,
    reported_by     UUID REFERENCES employees(id) ON DELETE SET NULL,
    category        VARCHAR(30) NOT NULL,          -- logistica / seguridad / proveedor / cliente / otro
    severity        VARCHAR(20) DEFAULT 'low',      -- low / medium / high
    description     TEXT NOT NULL,
    resolved        BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 3. Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(150) NOT NULL,
    category            VARCHAR(30) NOT NULL,       -- venue / dj / seguridad / catering / transporte / otro
    contact_name        VARCHAR(100),
    phone               VARCHAR(20),
    email               VARCHAR(150),
    agreed_rate         NUMERIC(12,2),               -- tarifa acordada, puede ser null si varia
    rate_type           VARCHAR(20),                 -- fijo / por_evento / porcentaje
    internal_rating     INTEGER,                      -- 1-5, calificacion interna del equipo
    notes               TEXT,
    status              VARCHAR(20) DEFAULT 'active', -- active / inactive
    created_at          TIMESTAMP DEFAULT NOW()
);

-- 4. Create vendor_event_history table
CREATE TABLE IF NOT EXISTS vendor_event_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id       UUID REFERENCES vendors(id) ON DELETE CASCADE,
    event_id        INTEGER REFERENCES events(id) ON DELETE SET NULL,
    amount_paid     NUMERIC(12,2),
    performance_note TEXT,
    would_rehire    BOOLEAN,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 5. Add budget columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS budget_income NUMERIC(12,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS budget_expenses NUMERIC(12,2);

-- 6. Add is_recurring column to expense_records table
ALTER TABLE expense_records ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- 7. Create executive_reports table
CREATE TABLE IF NOT EXISTS executive_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month    INTEGER NOT NULL,
    period_year     INTEGER NOT NULL,
    summary_text    TEXT NOT NULL,
    generated_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(period_month, period_year)
);

-- Seed accounts receivable data if empty
INSERT INTO accounts_receivable (user_id, amount, due_date, status)
SELECT id, 150000, CURRENT_DATE - INTERVAL '5 days', 'pending' 
FROM users 
WHERE NOT EXISTS (SELECT 1 FROM accounts_receivable)
ORDER BY id LIMIT 1;

INSERT INTO accounts_receivable (user_id, amount, due_date, status)
SELECT id, 120000, CURRENT_DATE - INTERVAL '10 days', 'pending' 
FROM users 
WHERE NOT EXISTS (SELECT 1 FROM accounts_receivable WHERE amount = 120000)
ORDER BY id OFFSET 1 LIMIT 1;

INSERT INTO accounts_receivable (user_id, amount, due_date, status)
SELECT id, 180000, CURRENT_DATE + INTERVAL '2 days', 'pending' 
FROM users 
WHERE NOT EXISTS (SELECT 1 FROM accounts_receivable WHERE amount = 180000)
ORDER BY id OFFSET 2 LIMIT 1;
