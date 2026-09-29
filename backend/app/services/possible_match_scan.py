"""
Aviso de "posible match" para las personas que están en 'NO HAY GENTE'.

Idea (reunión de capacitación): si hoy no hay nadie para una persona pero mañana se registra alguien que podría
servirle, la psicóloga debe enterarse sin tener que volver a revisar cada pocos días.

Cómo funciona (pre-filtro BÁSICO, no es el motor de compatibilidad ni un porcentaje):
  · Toma a cada persona cuya fila más reciente está en 'NO HAY GENTE' y que no tiene ya otra fila viva.
  · Busca perfiles NUEVOS (registrados después de que quedó en 'No hay gente', máx. `window_days`) que cumplan:
    orientación/género, misma ciudad, rango de edad que ella/él pidió, ficha con datos, disponibles y sin historial previo.
  · Por cada pareja nueva deja un evento POSIBLE_MATCH en person_history (sale en las alertas en vivo del admin).
    Una misma pareja se avisa una sola vez.
La psicóloga decide con 'Analizar con IA'; aquí nunca se inventa un porcentaje.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MAX_CANDIDATES_PER_PERSON = 3   # tope TOTAL de candidatos avisados por persona
MAX_PERSONS_PER_RUN = 15        # máximo de personas avisadas por corrida (el resto en la siguiente)
MAX_PERSONS_PER_CANDIDATE = 3   # una misma persona nueva se sugiere como máximo a 3 personas


def _gender_key(raw: Optional[str]) -> str:
    g = (raw or "").strip().lower()
    if g.startswith(("hombre", "masc", "male", "man", "varon", "varón")) or g == "h":
        return "M"
    if g.startswith(("mujer", "fem", "female", "woman")) or g == "f":
        return "F"
    return ""


def _target_genders(pref: str, a_gender: str) -> Optional[set]:
    """Géneros de candidatos que sirven según la orientación de la persona. None = no se puede decidir."""
    p = (pref or "").strip().lower()
    if not a_gender:
        return None
    other = "F" if a_gender == "M" else "M"
    if not p:
        return None  # sin orientación registrada no se adivina
    if "hetero" in p:
        return {other}
    if "gay" in p or "lesb" in p or "homo" in p:
        return {a_gender}
    if "bi" in p:
        return {"M", "F"}
    return None


def _age_bounds(sp: Any) -> tuple:
    if isinstance(sp, str):
        try:
            sp = json.loads(sp)
        except Exception:
            sp = {}
    sp = sp or {}

    def _num(*keys):
        for k in keys:
            v = sp.get(k)
            try:
                if v not in (None, "", 0, "0"):
                    return int(float(str(v).strip()))
            except Exception:
                continue
        return None

    return _num("min_age", "AgeMin"), _num("max_age", "AgeMax")


def _norm_city(c: Optional[str]) -> str:
    return (c or "").strip().lower()


async def scan_possible_matches(db: AsyncSession, window_days: int = 30, dry_run: bool = False) -> List[Dict[str, Any]]:
    """Devuelve la lista de avisos generados (y los guarda en person_history salvo dry_run)."""
    people = (await db.execute(text("""
        SELECT DISTINCT ON (LOWER(TRIM(m.person_a)))
               m.id, m.person_a, m.psychologist_name, m.pref, m.updated_at,
               u.id AS uid, p.gender, p.city, p.age, p.search_preferences
        FROM operational_matches m
        LEFT JOIN users u ON u.merged_into_id IS NULL AND (
                 (m.user_id_a IS NOT NULL AND u.id = m.user_id_a)
              OR (m.user_id_a IS NULL AND LOWER(TRIM(u.name)) = LOWER(TRIM(m.person_a))))
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE TRIM(COALESCE(m.person_a, '')) <> ''
        ORDER BY LOWER(TRIM(m.person_a)), m.id DESC
    """))).fetchall()

    notices: List[Dict[str, Any]] = []
    persons_notified = 0
    for pa in people:
        if persons_notified >= MAX_PERSONS_PER_RUN:
            break  # el resto se avisa en la siguiente corrida (evita inundar las alertas)
        # solo si su fila más reciente es 'NO HAY GENTE' (si ya tiene otra fila viva, no hace falta avisar)
        latest = (await db.execute(text("""
            SELECT status FROM operational_matches
            WHERE LOWER(TRIM(person_a)) = LOWER(TRIM(:n)) ORDER BY id DESC LIMIT 1
        """), {"n": pa.person_a})).scalar()
        if (latest or "").strip().upper() != "NO HAY GENTE" or not pa.uid:
            continue

        a_gender = _gender_key(pa.gender)
        targets = _target_genders(pa.pref, a_gender)
        a_city = _norm_city(pa.city)
        if not targets or not a_city:
            continue
        min_age, max_age = _age_bounds(pa.search_preferences)

        # tope TOTAL por persona (no por corrida): ya se le avisaron N candidatos en el pasado
        # (un aviso puede llevar varios candidatos: se cuentan las etiquetas, no las filas)
        prefix = f"[POSIBLE_MATCH:{pa.uid}:"
        already_for_person = (await db.execute(text("""
            SELECT COALESCE(SUM((LENGTH(details) - LENGTH(REPLACE(details, :pfx, ''))) / LENGTH(:pfx)), 0)
            FROM person_history WHERE details LIKE :t
        """), {"pfx": prefix, "t": f"%{prefix}%"})).scalar() or 0
        remaining = MAX_CANDIDATES_PER_PERSON - int(already_for_person)
        if remaining <= 0:
            continue

        cands = (await db.execute(text("""
            SELECT u.id, u.name, u.created_at, p.gender, p.city, p.age
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE u.merged_into_id IS NULL AND u.id <> :uid
              AND u.created_at > :since AND u.created_at > NOW() - (:days || ' days')::interval
              AND u.name NOT ILIKE 'Cliente CRM%' AND u.name NOT ILIKE 'Sin nombre%'
              AND LOWER(TRIM(u.name)) <> LOWER(TRIM(:n))
              AND p.age IS NOT NULL AND p.age > 0
              AND (p.bio_notes IS NOT NULL AND LENGTH(TRIM(p.bio_notes)) >= 15)
              AND COALESCE(p.lifestyle->>'availability_status', 'ACTIVO') = 'ACTIVO'
            ORDER BY u.created_at DESC
            LIMIT 60
        """), {"uid": pa.uid, "since": pa.updated_at, "days": str(int(window_days)), "n": pa.person_a})).fetchall()

        picked = []
        for c in cands:
            if len(picked) >= remaining:
                break
            if _gender_key(c.gender) not in targets or _norm_city(c.city) != a_city:
                continue
            if (min_age and c.age < min_age) or (max_age and c.age > max_age):
                continue
            # sin historial previo entre ambos
            prev = (await db.execute(text("""
                SELECT 1 FROM operational_matches
                WHERE (LOWER(TRIM(person_a)) = LOWER(TRIM(:a)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:b)))
                   OR (LOWER(TRIM(person_a)) = LOWER(TRIM(:b)) AND LOWER(TRIM(person_b)) = LOWER(TRIM(:a)))
                LIMIT 1
            """), {"a": pa.person_a, "b": c.name})).fetchone()
            if prev:
                continue
            # esta pareja ya se avisó (en cualquier corrida o si el aviso fue archivado)
            tag = f"[POSIBLE_MATCH:{pa.uid}:{c.id}]"
            already = (await db.execute(text("SELECT 1 FROM person_history WHERE details LIKE :t LIMIT 1"),
                                        {"t": f"%{tag}%"})).fetchone()
            if already:
                continue
            # no ofrecer siempre a la misma persona nueva a todo el mundo (queja de la reunión: se reutiliza la misma gente)
            exposure = (await db.execute(text("SELECT COUNT(*) FROM person_history WHERE details LIKE :t"),
                                         {"t": f"%[POSIBLE_MATCH:%:{c.id}]%"})).scalar() or 0
            if int(exposure) >= MAX_PERSONS_PER_CANDIDATE:
                continue
            picked.append((c, tag))

        if not picked:
            continue
        # UN solo aviso por persona y corrida, con todos sus candidatos
        tags = "".join(t for _, t in picked)
        lista = "; ".join(f"{c.name} ({c.age} años, {c.city})" for c, _ in picked)
        detail = (
            f"{tags} Posibles matches nuevos para {pa.person_a} (en 'No hay gente'): {lista}. "
            f"Se registraron después de que quedó sin opciones. Pre-filtro básico (orientación, ciudad, edad): "
            f"revisa con 'Analizar con IA'."
        )
        for c, _ in picked:
            notices.append({
                "person": pa.person_a, "psychologist": pa.psychologist_name,
                "candidate": c.name, "candidate_user_id": c.id, "candidate_age": c.age, "candidate_city": c.city,
                "details": detail,
            })
        if not dry_run:
            await db.execute(text("""
                INSERT INTO person_history (person_name, event_type, details, created_at)
                VALUES (:n, 'POSIBLE_MATCH', :d, NOW())
            """), {"n": pa.person_a, "d": detail})
        persons_notified += 1
    if notices and not dry_run:
        await db.commit()
    return notices
