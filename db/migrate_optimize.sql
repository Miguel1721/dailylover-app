-- ============================================================================
-- Daily Lover — Migración de Optimización de BD
-- Ejecutar una sola vez en producción (idempotente con IF NOT EXISTS)
-- ============================================================================

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Columnas faltantes en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_code VARCHAR(20);

-- 3. Poblar client_code existentes
UPDATE users SET client_code = 'DL-' || LPAD(id::text, 4, '0') WHERE client_code IS NULL;

-- 4. Constraints UNIQUE (ignorar si ya existen)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_id_number_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_id_number_key UNIQUE (id_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_client_code_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_client_code_key UNIQUE (client_code);
  END IF;
END $$;

-- 5. Trigger auto-asignar client_code
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
BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION assign_client_code();

-- 6. Columnas fantasma en profiles (agregar las que falten)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS estatura VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation VARCHAR(150);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education VARCHAR(200);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS religion VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS love_language VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lifestyle JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_preferences JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(30);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS responsable VARCHAR(50);

-- 7. Columnas faltantes en events
ALTER TABLE events ADD COLUMN IF NOT EXISTS budget_income DECIMAL(14,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS budget_expenses DECIMAL(14,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'upcoming';

-- 8. ★ PRIORIDAD 1: Agregar user_id_a / user_id_b a historical_matches
ALTER TABLE historical_matches ADD COLUMN IF NOT EXISTS user_id_a INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE historical_matches ADD COLUMN IF NOT EXISTS user_id_b INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE historical_matches ADD COLUMN IF NOT EXISTS venue VARCHAR(200);

-- 9. ★ Migrar datos: vincular person_a → user_id_a (por nombre)
UPDATE historical_matches hm
SET user_id_a = u.id
FROM users u
WHERE unaccent(lower(trim(u.name))) = unaccent(lower(trim(hm.person_a)))
  AND hm.user_id_a IS NULL
  AND hm.person_a IS NOT NULL;

-- 10. ★ Migrar datos: vincular person_b → user_id_b (por nombre)
UPDATE historical_matches hm
SET user_id_b = u.id
FROM users u
WHERE unaccent(lower(trim(u.name))) = unaccent(lower(trim(hm.person_b)))
  AND hm.user_id_b IS NULL
  AND hm.person_b IS NOT NULL;

-- 11. Normalizar status inconsistentes
UPDATE historical_matches SET status = 'APROBADO'
WHERE status ILIKE '%aprobado%' OR status ILIKE '%hecho%' OR status ILIKE '%accepted%';

UPDATE historical_matches SET status = 'RECHAZADO'
WHERE status ILIKE '%rechazado%' OR status ILIKE '%not approved%' OR status ILIKE '%no match%' OR status ILIKE '%descalificado%';

UPDATE historical_matches SET status = 'CANCELADO'
WHERE status ILIKE '%refund%' OR status ILIKE '%cancelado%';

UPDATE historical_matches SET status = 'PENDIENTE'
WHERE status IS NULL OR status = '' OR status ~ '^[0-9.]+$';

-- 12. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_hm_user_a ON historical_matches(user_id_a);
CREATE INDEX IF NOT EXISTS idx_hm_user_b ON historical_matches(user_id_b);
CREATE INDEX IF NOT EXISTS idx_hm_status ON historical_matches(status);
CREATE INDEX IF NOT EXISTS idx_hm_matchmaker ON historical_matches(matchmaker);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_responsable ON profiles(responsable);

-- 13. Tabla reminders (crear si no existe)
CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'ALTA',
    matchmaker VARCHAR(50),
    due_date VARCHAR(50),
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 14. ★ Purga de usuarios ficticios de prueba en la BD (Test No Terms, Prueba Consentimiento, etc.)
DELETE FROM users
WHERE unaccent(lower(COALESCE(name, ''))) ILIKE '%test%'
   OR unaccent(lower(COALESCE(name, ''))) ILIKE '%prueba%'
   OR unaccent(lower(COALESCE(name, ''))) ILIKE '%consentimiento%'
   OR unaccent(lower(COALESCE(name, ''))) ILIKE '%no terms%'
   OR unaccent(lower(COALESCE(name, ''))) ILIKE '%dummy%'
   OR unaccent(lower(COALESCE(name, ''))) ILIKE '%demo%';

-- 15. ★ Poblar columna gender en profiles si está nula (inferir por nombres comunes)
UPDATE profiles p
SET gender = 'Masculino'
FROM users u
WHERE p.user_id = u.id
  AND (p.gender IS NULL OR p.gender = '')
  AND (
    unaccent(lower(u.name)) ILIKE 'wilson%' OR
    unaccent(lower(u.name)) ILIKE 'andres%' OR
    unaccent(lower(u.name)) ILIKE 'juan%' OR
    unaccent(lower(u.name)) ILIKE 'mauricio%' OR
    unaccent(lower(u.name)) ILIKE 'santiago%' OR
    unaccent(lower(u.name)) ILIKE 'carlos%' OR
    unaccent(lower(u.name)) ILIKE 'diego%' OR
    unaccent(lower(u.name)) ILIKE 'felipe%' OR
    unaccent(lower(u.name)) ILIKE 'mateo%' OR
    unaccent(lower(u.name)) ILIKE 'sebastian%' OR
    unaccent(lower(u.name)) ILIKE 'daniel%' OR
    unaccent(lower(u.name)) ILIKE 'miguel%' OR
    unaccent(lower(u.name)) ILIKE 'nicolas%' OR
    unaccent(lower(u.name)) ILIKE 'matthew%' OR
    unaccent(lower(u.name)) ILIKE 'julian%'
  );

UPDATE profiles p
SET gender = 'Femenino'
FROM users u
WHERE p.user_id = u.id
  AND (p.gender IS NULL OR p.gender = '')
  AND (
    unaccent(lower(u.name)) ILIKE 'fiorella%' OR
    unaccent(lower(u.name)) ILIKE 'maria%' OR
    unaccent(lower(u.name)) ILIKE 'andrea%' OR
    unaccent(lower(u.name)) ILIKE 'paola%' OR
    unaccent(lower(u.name)) ILIKE 'camila%' OR
    unaccent(lower(u.name)) ILIKE 'valentina%' OR
    unaccent(lower(u.name)) ILIKE 'nathalia%' OR
    unaccent(lower(u.name)) ILIKE 'genesis%' OR
    unaccent(lower(u.name)) ILIKE 'catalina%' OR
    unaccent(lower(u.name)) ILIKE 'laura%' OR
    unaccent(lower(u.name)) ILIKE 'sofia%' OR
    unaccent(lower(u.name)) ILIKE 'daniela%' OR
    unaccent(lower(u.name)) ILIKE 'isabella%' OR
    unaccent(lower(u.name)) ILIKE 'carolina%'
  );

-- 17. ★ Módulo de Agendamiento de Entrevistas y Disponibilidad de Psicólogas
CREATE TABLE IF NOT EXISTS psychologist_availability (
    id SERIAL PRIMARY KEY,
    psychologist_name VARCHAR(100) NOT NULL,
    day_of_week INT NOT NULL, -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 45,
    max_simultaneous INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_appointments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    psychologist_name VARCHAR(100) NOT NULL,
    appointment_date TIMESTAMP NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMADA',
    meet_link VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psyc_avail ON psychologist_availability(psychologist_name, day_of_week);
CREATE INDEX IF NOT EXISTS idx_interview_app ON interview_appointments(appointment_date, psychologist_name);

-- 18. ★ Enlace automático masivo de user_id_a y user_id_b en historical_matches
UPDATE historical_matches hm
SET user_id_a = u.id
FROM users u
WHERE hm.user_id_a IS NULL
  AND unaccent(lower(trim(hm.person_a))) = unaccent(lower(trim(u.name)));

-- 19. ★ Evaluación Post-Cita Obligatoria & Control de Retroalimentación
ALTER TABLE historical_matches ADD COLUMN IF NOT EXISTS feedback_completed_a BOOLEAN DEFAULT FALSE;
ALTER TABLE historical_matches ADD COLUMN IF NOT EXISTS feedback_completed_b BOOLEAN DEFAULT FALSE;
ALTER TABLE historical_matches ADD COLUMN IF NOT EXISTS feedback_email_sent_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS match_evaluations (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES historical_matches(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluator_name VARCHAR(255),
    venue_rating INTEGER CHECK (venue_rating BETWEEN 1 AND 5),
    punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    chemistry_rating INTEGER CHECK (chemistry_rating BETWEEN 1 AND 5),
    would_repeat BOOLEAN DEFAULT FALSE,
    feedback_comments TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_match_user_eval UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_match_id ON match_evaluations(match_id);
CREATE INDEX IF NOT EXISTS idx_eval_user_id ON match_evaluations(user_id);

-- 20. ★ Normalización de Asignaciones de Psicólogas según Excel e Historial
UPDATE profiles p
SET responsable = sub.matchmaker
FROM (
    SELECT hm.user_id_a AS uid, hm.matchmaker
    FROM historical_matches hm
    WHERE hm.user_id_a IS NOT NULL AND hm.matchmaker IS NOT NULL AND length(trim(hm.matchmaker)) > 2
    UNION
    SELECT hm.user_id_b AS uid, hm.matchmaker
    FROM historical_matches hm
    WHERE hm.user_id_b IS NOT NULL AND hm.matchmaker IS NOT NULL AND length(trim(hm.matchmaker)) > 2
) sub
WHERE p.user_id = sub.uid AND (p.responsable IS NULL OR p.responsable = '' OR p.responsable = 'Sin Asignar');






