-- ==============================================================================
-- DAILY LOVER - SCHEMA DE ONBOARDING & PERFILES AMPLIADOS (FASE 1)
-- Rama: feature/client-onboarding-v1
-- Nota: Esta migración NO se ejecuta en producción antes del 12 de octubre.
-- ==============================================================================

-- 1. TABLA: client_onboarding_responses
-- Almacena las respuestas directas de auto-registro del cliente (Self-Report)
-- Completado inmediatamente después del pago en Stripe.
CREATE TABLE IF NOT EXISTS client_onboarding_responses (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    onboarding_token VARCHAR(100) UNIQUE,
    status VARCHAR(30) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'REVIEWED_BY_PSYCHOLOGIST'

    -- Paso 1: Identidad & Datos Personales
    full_name VARCHAR(150),
    preferred_name VARCHAR(100),
    gender VARCHAR(30),
    birth_date DATE,
    age INT,
    city VARCHAR(100),
    neighborhood_zone VARCHAR(150),       -- Barrio / Sector de vivienda
    height_cm INT,                        -- Estatura exacta en cm (para matching)
    instagram_handle VARCHAR(100),
    linkedin_url VARCHAR(250),

    -- Paso 2: Educación, Profesión & Estatus Socioeconómico
    education_level_declared VARCHAR(50), -- 'Bachillerato', 'Pregrado', 'Especialización', 'Maestría', 'Doctorado'
    university_name VARCHAR(150),         -- Universidad de egreso
    high_school_name VARCHAR(150),        -- Colegio de egreso
    profession_career VARCHAR(150),       -- Título / Profesión
    company_industry VARCHAR(150),        -- Empresa / Sector económico
    monthly_income_bracket VARCHAR(50),   -- '< 5M', '5M - 10M', '10M - 20M', '20M - 40M', '> 40M COP'
    social_clubs_places TEXT[],           -- Clubes / Sitios frecuentes en Bogotá

    -- Paso 3: Estilo de Vida, Ritmo & Hábitos
    physical_activity_frequency VARCHAR(50), -- 'Sedentario', '1-2 veces/semana', '3-4 veces/semana', '5+ veces/semana (Intenso)'
    sports_disciplines TEXT[],               -- ['Gimnasio/Pesas', 'Pádel', 'Running', 'Yoga', 'Ciclismo', 'Tenis', 'Natación']
    weekend_lifestyle TEXT[],                -- ['Casero/Películas', 'Cultura/Restaurantes', 'Naturaleza/Senderismo', 'Rumba/Social', 'Deporte matutino']
    smoking_habit VARCHAR(50),               -- 'No fuma', 'Social/Ocasional', 'Fuma diario / Vaper'
    alcohol_habit VARCHAR(50),               -- 'Abstemio', 'Ocasional / Vino o coctel', 'Frecuente / Fines de semana'
    cannabis_habit VARCHAR(50),              -- 'No consume', 'Ocasional', 'Habitual'
    pets_relationship VARCHAR(100),          -- 'Tiene perro(s)', 'Tiene gato(s)', 'Ama animales', 'No le gustan / Alergia'
    dietary_preferences VARCHAR(100),        -- 'Sin restricción', 'Vegetariano', 'Vegano', 'Keto / Fitness'

    -- Paso 4: Proyecto de Vida, Familia & Convicciones
    current_children_status VARCHAR(100),    -- 'No tiene hijos', 'Tiene hijos con custodia compartida', 'Hijos independientes'
    future_children_desire VARCHAR(100),     -- 'Desea tener hijos sí o sí', 'No desea hijos', 'Abierto / Depende de la pareja'
    marital_status_legal VARCHAR(50),        -- 'Soltero(a) nunca casado', 'Divorciado(a) legalmente', 'En proceso de separación', 'Viudo(a)'
    religion_faith_declared VARCHAR(100),    -- 'Católica', 'Cristiana', 'Espiritual sin religión', 'Agnóstico / Ateo', 'Judía', 'Otra'
    religion_importance_score INT,           -- 1 a 10 (Relevancia de compartir la fe en pareja)
    political_orientation VARCHAR(50),       -- 'Apolítico / Sin interés', 'Centro / Moderado', 'Derecha / Conservador', 'Izquierda / Progresista'

    -- Paso 5: Dinámica Vinculante & Afectiva (Quiz de Auto-Reporte)
    attachment_quiz_answers JSONB,           -- Respuestas a 5 reactivos breves de apego
    attachment_self_style VARCHAR(50),       -- 'Seguro', 'Ansioso', 'Evitativo', 'Desorganizado'
    love_languages_ranked TEXT[],            -- Orden de 1 a 5 de los 5 lenguajes del amor
    primary_love_language_give VARCHAR(50),  -- Lenguaje predilecto para expresar afecto
    primary_love_language_receive VARCHAR(50),-- Lenguaje predilecto para recibir afecto

    -- Paso 6: Búsqueda de Pareja, Límites & Innegociables
    target_min_age INT,
    target_max_age INT,
    target_min_height_cm INT,
    target_max_height_cm INT,
    target_cities TEXT[],
    dealbreakers_must_have TEXT[],           -- Top 3 indispensables (ej: profesional, deportista, quiera hijos)
    dealbreakers_never_accept TEXT[],        -- Top 3 intolerables (ej: fumador, sin ambición profesional, hijos de relaciones previas)
    ideal_partner_free_text TEXT,            -- Descripción en sus propias palabras de la pareja ideal

    -- Metadatos
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON client_onboarding_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_token ON client_onboarding_responses(onboarding_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON client_onboarding_responses(status);


-- 2. AMPLIACIÓN DE client_extended_profile (Formulario 1 & Formulario 2)
-- Para almacenar las sub-dimensiones de Grupo Social, la validación clínica de la psicóloga
-- y evitar que salgan campos vacíos ('Pendiente F2').

ALTER TABLE client_extended_profile
    -- Sub-dimensiones del Social Group Classifier (SGC)
    ADD COLUMN IF NOT EXISTS sgc_zone_score NUMERIC(3,1),          -- 30% Barrio / Zona (1.0 - 10.0)
    ADD COLUMN IF NOT EXISTS sgc_income_score NUMERIC(3,1),        -- 25% Ingresos / Capacidad económica (1.0 - 10.0)
    ADD COLUMN IF NOT EXISTS sgc_university_score NUMERIC(3,1),    -- 20% Pregrado / Alma Mater (1.0 - 10.0)
    ADD COLUMN IF NOT EXISTS sgc_school_score NUMERIC(3,1),        -- 15% Colegio de egreso (1.0 - 10.0)
    ADD COLUMN IF NOT EXISTS sgc_lifestyle_score NUMERIC(3,1),     -- 10% Clubes, ocio y lugares (1.0 - 10.0)

    -- Actividad Física Ampliada
    ADD COLUMN IF NOT EXISTS fitness_frequency_days INT,           -- Días por semana (0 a 7)
    ADD COLUMN IF NOT EXISTS fitness_category VARCHAR(50),         -- 'Sedentario', 'Casual', 'Regular', 'Deportista Comprometido', 'Atleta'

    -- Nivel Educativo Estandarizado
    ADD COLUMN IF NOT EXISTS education_degree VARCHAR(50),         -- 'Bachiller', 'Profesional', 'Especialista', 'Magister', 'Doctor'

    -- Validación Clínica de la Psicóloga (F2 Percepción Clínica)
    ADD COLUMN IF NOT EXISTS clinical_attachment_validated VARCHAR(50), -- Apego validado en sesión clínica ('Seguro', 'Ansioso', 'Evitativo', 'Desorganizado')
    ADD COLUMN IF NOT EXISTS emotional_availability_score INT,          -- 1 a 10: Disponibilidad real (duelo resuelto vs atado a ex)
    ADD COLUMN IF NOT EXISTS conflict_resolution_style VARCHAR(50),     -- 'Asertivo', 'Evitativo', 'Explosivo', 'Pasivo-Agresivo'
    ADD COLUMN IF NOT EXISTS authenticity_score INT,                    -- 1 a 5: Coherencia lenguaje verbal/no verbal (Anti-deseabilidad social)
    ADD COLUMN IF NOT EXISTS private_matchmaker_notes TEXT;             -- Notas estrictamente confidenciales para la matchmaker

COMMENT ON TABLE client_onboarding_responses IS 'Respuestas directas del cliente tras pagar en Stripe (Auto-registro Fase 2)';
COMMENT ON TABLE client_extended_profile IS 'Ficha clínica y objetiva evaluada y validada por la psicóloga (Fases 1 y 2)';
