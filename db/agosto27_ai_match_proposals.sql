-- ============================================================================
-- MIGRACIÓN: august27_ai_match_proposals & august27_unmatched_clients
-- Pipeline de Matching con IA Clínica NVIDIA para casos pendientes Agosto 27
-- ============================================================================

CREATE TABLE IF NOT EXISTS august27_ai_match_proposals (
    id SERIAL PRIMARY KEY,
    sheet_row INT,
    client_name TEXT,
    client_user_id INT,
    client_crm_id TEXT,
    dates_pend TEXT,
    responsable TEXT,
    candidate_name TEXT,
    candidate_user_id INT,
    candidate_crm_id TEXT,
    punctuation TEXT,
    status TEXT,
    points_to_consider TEXT,
    strong_points TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aug27_client_uid ON august27_ai_match_proposals(client_user_id);
CREATE INDEX IF NOT EXISTS idx_aug27_sheet_row ON august27_ai_match_proposals(sheet_row);

CREATE TABLE IF NOT EXISTS august27_unmatched_clients (
    id SERIAL PRIMARY KEY,
    sheet_row INT,
    sheet_name TEXT,
    clean_name TEXT,
    dates_pend TEXT,
    responsable TEXT,
    nota TEXT,
    reason TEXT DEFAULT 'No encontrado en base de datos',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aug27_unmatched_row ON august27_unmatched_clients(sheet_row);
