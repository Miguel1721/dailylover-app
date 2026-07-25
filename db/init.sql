-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (basic contact info)
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    phone       VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Profiles table (psychographic 22 dimensions, OCEAN, attachment theory, etc.)
CREATE TABLE IF NOT EXISTS profiles (
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ocean           JSONB,          -- {apertura, responsabilidad, extroversion, amabilidad, neuroticismo}
    apego           JSONB,          -- {estilo: seguro|ansioso|evitativo, intensidad: 0-1}
    motivacion      VARCHAR(50),    -- exploracion|conexion_profunda|validacion|diversion
    rol_social      VARCHAR(30),    -- lider|mediador|oyente|dinamizador
    energia_social  FLOAT,          -- 0.0 - 1.0
    momento_vital   VARCHAR(30),    -- explorando|listo_vinculo|consolidado|transitando
    intereses       TEXT[],
    valores         TEXT[],
    raw_answers     TEXT[],        -- original user answers
    version         INTEGER DEFAULT 1,
    updated_at      TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

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

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    date        TIMESTAMP NOT NULL,
    location    VARCHAR(200),
    format      VARCHAR(100),
    capacity    INTEGER,
    price       DECIMAL(10,2),
    created_at  TIMESTAMP DEFAULT NOW()
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
