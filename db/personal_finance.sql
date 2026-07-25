-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150) NOT NULL,
    role            VARCHAR(100) NOT NULL,           -- cargo: logistica, comunicaciones, etc.
    phone           VARCHAR(20),
    email           VARCHAR(150),
    base_salary     NUMERIC(12,2) NOT NULL,
    contract_type   VARCHAR(30) DEFAULT 'nomina',     -- nomina / prestacion_servicios
    hire_date       DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'active',     -- active / inactive
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Commission rules table
CREATE TABLE IF NOT EXISTS commission_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
    commission_type VARCHAR(20) NOT NULL,             -- percentage / fixed
    value           NUMERIC(10,2) NOT NULL,           -- % o valor fijo segun commission_type
    applies_to      VARCHAR(30) DEFAULT 'event',       -- por ahora solo 'event'
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Employee event commissions table
CREATE TABLE IF NOT EXISTS employee_event_commissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     UUID REFERENCES employees(id),
    event_id        INTEGER REFERENCES events(id),     -- Consistente con el tipo de events.id (INTEGER)
    amount          NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',     -- pending / paid
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Payroll runs table
CREATE TABLE IF NOT EXISTS payroll_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_month    INTEGER NOT NULL,
    period_year     INTEGER NOT NULL,
    status          VARCHAR(20) DEFAULT 'draft',       -- draft / liquidated
    total_base      NUMERIC(14,2),
    total_commissions NUMERIC(14,2),
    total_deductions   NUMERIC(14,2),
    total_paid      NUMERIC(14,2),
    liquidated_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Payroll items table
CREATE TABLE IF NOT EXISTS payroll_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id  UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id     UUID REFERENCES employees(id),
    base_salary     NUMERIC(12,2),
    commissions     NUMERIC(12,2) DEFAULT 0,
    deductions      NUMERIC(12,2) DEFAULT 0,           -- salud + pension colombiano
    total           NUMERIC(12,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Income records table
CREATE TABLE IF NOT EXISTS income_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        INTEGER REFERENCES events(id),     -- Consistente con el tipo de events.id (INTEGER)
    category        VARCHAR(50) NOT NULL,               -- inscripcion / membresia / otro
    description     VARCHAR(255),
    amount          NUMERIC(12,2) NOT NULL,
    payment_method  VARCHAR(30),                        -- efectivo / transferencia / nequi / tarjeta
    received_at     DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Expense records table
CREATE TABLE IF NOT EXISTS expense_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        INTEGER REFERENCES events(id),     -- Consistente con el tipo de events.id (INTEGER)
    category        VARCHAR(50) NOT NULL,               -- logistica / marketing / nomina / arriendo / comision_aliado / otro
    description     VARCHAR(255),
    amount          NUMERIC(12,2) NOT NULL,
    payment_method  VARCHAR(30),
    paid_at         DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);
