"""
Generador automático del horario semanal (Fase 3).

Módulo puro (sin base de datos ni red) que recibe el equipo activo,
su disponibilidad semanal, los permisos aprobados y la configuración de
ventana de cobertura, y devuelve un borrador de turnos (ENTREVISTAS y
MATCHMAKING) junto con un reporte detallado de factibilidad, cobertura y
cumplimiento de horas por persona.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

SLOT_MINUTES = 30
SLOTS_PER_DAY = (24 * 60) // SLOT_MINUTES  # 48 medias horas (00:00 .. 24:00)

DEFAULT_WINDOW: Dict[int, Optional[Tuple[str, str]]] = {
    0: ("09:00", "20:00"),  # Lunes
    1: ("09:00", "20:00"),  # Martes
    2: ("09:00", "20:00"),  # Miércoles
    3: ("09:00", "20:00"),  # Jueves
    4: ("09:00", "20:00"),  # Viernes
    5: ("09:00", "13:00"),  # Sábado
    6: None,                # Domingo (sin cobertura)
}

DAY_NAMES_ES = [
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo",
]

DAY_KEY_ALIASES = {
    "mon": 0, "monday": 0, "lunes": 0, "0": 0,
    "tue": 1, "tuesday": 1, "martes": 1, "1": 1,
    "wed": 2, "wednesday": 2, "miercoles": 2, "miércoles": 2, "2": 2,
    "thu": 3, "thursday": 3, "jueves": 3, "3": 3,
    "fri": 4, "friday": 4, "viernes": 4, "4": 4,
    "sat": 5, "saturday": 5, "sabado": 5, "sábado": 5, "5": 5,
    "sun": 6, "sunday": 6, "domingo": 6, "6": 6,
}


def time_to_slot(hhmm: str) -> int:
    """Convierte 'HH:MM' al índice de media hora [0..48]."""
    parts = hhmm.strip().split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return (hours * 60 + minutes) // SLOT_MINUTES


def slot_to_time(slot: int) -> str:
    """Convierte un índice de media hora [0..48] a 'HH:MM'."""
    total_minutes = slot * SLOT_MINUTES
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _normalize_day_dict(raw_days: Optional[Dict[Any, Any]]) -> Dict[int, Dict[str, Any]]:
    """Normaliza las claves de día (0..6 o alias) a enteros 0..6."""
    if not raw_days or not isinstance(raw_days, dict):
        return {}
    out: Dict[int, Dict[str, Any]] = {}
    for k, v in raw_days.items():
        if isinstance(k, int) and 0 <= k <= 6:
            day_idx = k
        else:
            day_idx = DAY_KEY_ALIASES.get(str(k).strip().lower(), -1)
        if 0 <= day_idx <= 6 and isinstance(v, dict):
            out[day_idx] = v
    return out


def _extract_range_tuple(r: Any) -> Optional[Tuple[str, str]]:
    """Extrae ('HH:MM', 'HH:MM') desde una tupla/lista o diccionario."""
    if isinstance(r, (tuple, list)) and len(r) >= 2:
        return str(r[0]), str(r[1])
    if isinstance(r, dict):
        start = r.get("start") or r.get("start_time")
        end = r.get("end") or r.get("end_time")
        if start and end:
            return str(start), str(end)
    return None


def _person_has_defined_availability(day_map: Dict[int, Dict[str, Any]]) -> bool:
    """
    Regla 9b: devuelve True si la persona tiene al menos un día con modo distinto de UNSET.
    Si un día es RANGES pero no tiene ningún tramo válido, cuenta como UNSET.
    """
    if not day_map:
        return False
    for d in range(7):
        info = day_map.get(d)
        if not info:
            continue
        mode = str(info.get("mode") or "UNSET").strip().upper()
        if mode in ("ALL_DAY", "UNAVAILABLE"):
            return True
        if mode == "RANGES":
            ranges = info.get("ranges") or []
            for r in ranges:
                pair = _extract_range_tuple(r)
                if pair and time_to_slot(pair[0]) < time_to_slot(pair[1]):
                    return True
    return False


def _contiguous_runs(slots_bool: List[bool]) -> List[Tuple[int, int]]:
    """Devuelve los tramos contiguos [start, end) donde slots_bool[s] es True."""
    runs: List[Tuple[int, int]] = []
    n = len(slots_bool)
    i = 0
    while i < n:
        if slots_bool[i]:
            j = i + 1
            while j < n and slots_bool[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    return runs


def _can_add_interview_block(
    e_day: List[bool],
    avail_day: List[bool],
    b_start: int,
    b_end: int,
    max_contiguous_e: int = 8,
    min_gap_between_e: int = 2,
) -> bool:
    """
    Verifica si agregar [b_start, b_end) como ENTREVISTAS en el día:
    1) Cae 100% dentro de avail_day y no pisa slots ya en e_day.
    2) No produce ninguna racha contigua de ENTREVISTAS > max_contiguous_e (4.0 h = 8 slots).
    3) Si hay más de una racha de ENTREVISTAS en el mismo día, deja al menos
       min_gap_between_e (1.0 h = 2 slots) de separación entre ellas.
    """
    if b_start < 0 or b_end > SLOTS_PER_DAY or b_start >= b_end:
        return False
    for s in range(b_start, b_end):
        if not avail_day[s] or e_day[s]:
            return False

    trial = list(e_day)
    for s in range(b_start, b_end):
        trial[s] = True

    runs = _contiguous_runs(trial)
    for r_start, r_end in runs:
        if (r_end - r_start) > max_contiguous_e:
            return False
    for idx in range(len(runs) - 1):
        gap = runs[idx + 1][0] - runs[idx][1]
        if gap < min_gap_between_e:
            return False
    return True


def _max_additional_e_for_person_day(
    e_day: List[bool],
    avail_day: List[bool],
    max_contiguous_e: int = 8,
    min_gap_between_e: int = 2,
) -> int:
    """Cota superior rápida de cuántos slots adicionales de E caben en un día."""
    free_count = sum(1 for s in range(SLOTS_PER_DAY) if avail_day[s] and not e_day[s])
    return free_count


def generate_week(
    week_monday: date,
    people: List[Dict[str, Any]],
    availability: Dict[str, Any],
    time_off: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Genera el borrador del horario semanal cumpliendo las reglas 1–10.
    Nunca lanza excepciones ante falta de disponibilidad o huecos imposibles:
    devuelve el mejor horario factible y detalla cualquier incumplimiento en `report`.
    """
    cfg = dict(config or {})
    # Regla 9: matches_inside_window=True fijo, sin opción para cambiarlo.
    cfg["matches_inside_window"] = True
    min_coverage: int = int(cfg.get("min_coverage", 1))
    max_interview_slots: int = int(round(float(cfg.get("max_interview_hours", 4.0)) * 2))
    std_interview_slots: int = int(round(float(cfg.get("standard_interview_hours", 2.0)) * 2))
    std_matches_slots: int = int(round(float(cfg.get("standard_matches_hours", 1.0)) * 2))

    raw_window = cfg.get("window", DEFAULT_WINDOW)
    window_slots_by_day: Dict[int, Tuple[int, int]] = {}
    for d in range(7):
        w = raw_window.get(d) if isinstance(raw_window, dict) else DEFAULT_WINDOW.get(d)
        if d not in (raw_window or {}) and str(d) in (raw_window or {}):
            w = raw_window[str(d)]
        if w and isinstance(w, (tuple, list)) and len(w) >= 2 and w[0] and w[1]:
            ws, we = time_to_slot(str(w[0])), time_to_slot(str(w[1]))
            if 0 <= ws < we <= SLOTS_PER_DAY:
                window_slots_by_day[d] = (ws, we)

    # Normalizar mapa de disponibilidad por nombre en minúsculas
    norm_avail_map: Dict[str, Dict[int, Dict[str, Any]]] = {}
    for k, v in (availability or {}).items():
        norm_avail_map[str(k).strip().lower()] = _normalize_day_dict(v)

    # Regla 10: ignorar por completo a las personas inactivas (active=False)
    active_people: List[Dict[str, Any]] = [
        p for p in (people or []) if p.get("active", True) is True
    ]

    # Regla 9b: comprobar antes de cualquier cálculo si alguna persona activa no definió disponibilidad
    blocked_missing: List[str] = []
    for p in active_people:
        p_name = str(p["name"]).strip()
        p_days = norm_avail_map.get(p_name.lower(), {})
        if not _person_has_defined_availability(p_days):
            blocked_missing.append(p_name)

    if blocked_missing:
        per_person_blocked = {
            str(p["name"]).strip(): {
                "assigned_hours": 0.0,
                "interview_hours": 0.0,
                "matches_hours": 0.0,
                "target_hours": round(float(p.get("weekly_hours", 0.0)), 2),
                "shortfall": round(float(p.get("weekly_hours", 0.0)), 2),
            }
            for p in active_people
        }
        return {
            "shifts": [],
            "report": {
                "feasible": False,
                "blocked_by_missing_availability": blocked_missing,
                "uncovered": [],
                "per_person": per_person_blocked,
                "warnings": [
                    f"No se generó el horario porque falta disponibilidad de: {', '.join(blocked_missing)}."
                ],
            },
        }

    # Normalizar permisos aprobados (time_off)
    time_off_list = time_off or []
    off_dates_by_person: Dict[str, set] = {
        str(p["name"]).strip().lower(): set() for p in active_people
    }
    for item in time_off_list:
        if not isinstance(item, dict):
            continue
        # Si trae campo status, considerar solo aprobados; si no trae status, asumir aprobado
        status = str(item.get("status", "APPROVED")).strip().upper()
        if status not in ("APPROVED", "APROBADO", "APROBADA", "TRUE", "1"):
            continue
        who = str(item.get("name") or item.get("employee_name") or "").strip().lower()
        start_d = item.get("start") or item.get("start_date")
        end_d = item.get("end") or item.get("end_date") or start_d
        if who in off_dates_by_person and isinstance(start_d, date) and isinstance(end_d, date):
            cur = start_d
            while cur <= end_d:
                off_dates_by_person[who].add(cur)
                cur += timedelta(days=1)

    num_people = len(active_people)
    # Construcción de la matriz de disponibilidad efectiva dentro de la ventana: avail[p_idx][d][s]
    avail: List[List[List[bool]]] = [
        [[False] * SLOTS_PER_DAY for _ in range(7)] for _ in range(num_people)
    ]

    for p_idx, p in enumerate(active_people):
        p_name_lower = str(p["name"]).strip().lower()
        p_days = norm_avail_map.get(p_name_lower, {})
        p_off = off_dates_by_person.get(p_name_lower, set())

        for d in range(7):
            if d not in window_slots_by_day:
                continue
            day_date = week_monday + timedelta(days=d)
            if day_date in p_off:
                continue
            w_start, w_end = window_slots_by_day[d]
            d_info = p_days.get(d)
            if not d_info:
                continue
            mode = str(d_info.get("mode") or "UNSET").strip().upper()
            if mode in ("UNSET", "UNAVAILABLE"):
                continue
            elif mode == "ALL_DAY":
                for s in range(w_start, w_end):
                    avail[p_idx][d][s] = True
            elif mode == "RANGES":
                for r in d_info.get("ranges") or []:
                    pair = _extract_range_tuple(r)
                    if not pair:
                        continue
                    rs = max(w_start, time_to_slot(pair[0]))
                    re_ = min(w_end, time_to_slot(pair[1]))
                    for s in range(rs, re_):
                        avail[p_idx][d][s] = True

    # Metas de slots (medias horas) por persona
    target_slots: List[int] = []
    total_avail_slots: List[int] = []
    s_cap: List[int] = []
    m_target: List[int] = []
    e_target: List[int] = []

    for p_idx, p in enumerate(active_people):
        t_sl = int(round(float(p.get("weekly_hours", 0.0)) * 2))
        u_sl = sum(sum(1 for s in range(SLOTS_PER_DAY) if avail[p_idx][d][s]) for d in range(7))
        cap = min(t_sl, u_sl)
        # 1/3 matches y 2/3 entrevistas
        m_sl = int(cap / 3.0 + 0.5)
        e_sl = cap - m_sl
        target_slots.append(t_sl)
        total_avail_slots.append(u_sl)
        s_cap.append(cap)
        m_target.append(m_sl)
        e_target.append(e_sl)

    # Estado de asignación: e_grid[p_idx][d][s] y m_grid[p_idx][d][s]
    e_grid: List[List[List[bool]]] = [
        [[False] * SLOTS_PER_DAY for _ in range(7)] for _ in range(num_people)
    ]
    m_grid: List[List[List[bool]]] = [
        [[False] * SLOTS_PER_DAY for _ in range(7)] for _ in range(num_people)
    ]
    assigned_e: List[int] = [0] * num_people

    def coverage_at(d: int, s: int) -> int:
        return sum(1 for p_idx in range(num_people) if e_grid[p_idx][d][s])

    def has_post_match_space(p_idx: int, d: int, b_end: int) -> bool:
        """Comprueba si tras b_end hay 1h (2 slots) disponible y libre de E para poner Matches."""
        if b_end + std_matches_slots > SLOTS_PER_DAY:
            return False
        for s in range(b_end, b_end + std_matches_slots):
            if not avail[p_idx][d][s] or e_grid[p_idx][d][s]:
                return False
        return True

    def overwrites_reserved_post_match(p_idx: int, d: int, b_start: int, b_end: int) -> bool:
        """
        Evita pisar los 2 slots posteriores a un bloque existente de 2h E del mismo día
        si esos 2 slots estaban disponibles para su hora obligatoria de Matches.
        """
        existing_runs = _contiguous_runs(e_grid[p_idx][d])
        for r_s, r_e in existing_runs:
            if (r_e - r_s) == std_interview_slots:
                if r_e + std_matches_slots <= SLOTS_PER_DAY and all(
                    avail[p_idx][d][x] for x in range(r_e, r_e + std_matches_slots)
                ):
                    if max(b_start, r_e) < min(b_end, r_e + std_matches_slots):
                        return True
        return False

    # =========================================================================
    # FASE A1: CUBRIR LA VENTANA DE ENTREVISTAS (al menos min_coverage en cada slot)
    # =========================================================================
    # Ordenamos los días priorizando aquellos con menor disponibilidad relativa,
    # para que las personas disponibles en días difíciles (p.ej. sábado) no gasten
    # todas sus horas antes de cubrir esos días.
    active_days = sorted(
        window_slots_by_day.keys(),
        key=lambda d: (
            sum(
                1
                for p_idx in range(num_people)
                if any(avail[p_idx][d][s] for s in range(*window_slots_by_day[d]))
            ),
            d,
        ),
    )

    for cov_level in range(1, min_coverage + 1):
        for d in active_days:
            w_start, w_end = window_slots_by_day[d]
            while True:
                # Buscar el primer slot de la ventana con cobertura < cov_level
                target_slot: Optional[int] = None
                for s in range(w_start, w_end):
                    if coverage_at(d, s) < cov_level:
                        target_slot = s
                        break
                if target_slot is None:
                    break

                # Generar todos los candidatos (p_idx, b_start, b_end) que cubran target_slot
                best_cand: Optional[Tuple[Tuple[float, ...], int, int, int]] = None

                for p_idx in range(num_people):
                    rem_e = e_target[p_idx] - assigned_e[p_idx]
                    if rem_e <= 0 or not avail[p_idx][d][target_slot] or e_grid[p_idx][d][target_slot]:
                        continue

                    # Límites del tramo disponible continuo que contiene target_slot
                    seg_start = target_slot
                    while seg_start > w_start and avail[p_idx][d][seg_start - 1] and not e_grid[p_idx][d][seg_start - 1]:
                        seg_start -= 1
                    seg_end = target_slot + 1
                    while seg_end < w_end and avail[p_idx][d][seg_end] and not e_grid[p_idx][d][seg_end]:
                        seg_end += 1

                    max_len = min(max_interview_slots, rem_e, seg_end - seg_start)
                    if max_len <= 0:
                        continue

                    # Alturas de bloque preferidas: 4..8 slots (2h..4h); solo usar <4 si no cabe >=4
                    possible_lengths = [L for L in range(4, max_len + 1)]
                    if not possible_lengths:
                        possible_lengths = [max_len]

                    # Escasez de la persona: cuánta cuota E le falta respecto a su disponibilidad restante
                    rem_avail_future = sum(
                        1
                        for d2 in range(7)
                        for s2 in range(SLOTS_PER_DAY)
                        if avail[p_idx][d2][s2] and not e_grid[p_idx][d2][s2]
                    )
                    scarcity = rem_e / max(1, rem_avail_future)
                    already_working_today = 1 if any(e_grid[p_idx][d]) else 0

                    for length in possible_lengths:
                        # Posibles inicios b_start tales que b_start <= target_slot < b_start + length
                        min_b_start = max(seg_start, target_slot - length + 1)
                        max_b_start = min(target_slot, seg_end - length)
                        for b_start in range(min_b_start, max_b_start + 1):
                            b_end = b_start + length
                            if overwrites_reserved_post_match(p_idx, d, b_start, b_end):
                                continue
                            if not _can_add_interview_block(
                                e_grid[p_idx][d], avail[p_idx][d], b_start, b_end, max_interview_slots
                            ):
                                continue

                            # Cuántos slots descubiertos (< cov_level) cubre este bloque
                            newly_covered = sum(
                                1 for s in range(b_start, b_end) if coverage_at(d, s) < cov_level
                            )
                            starts_at_target = 1 if b_start == target_slot else 0

                            # ¿Deja otro compañero disponible en b_end si b_end < w_end?
                            handoff_ok = 1
                            if b_end < w_end:
                                handoff_ok = (
                                    1
                                    if any(
                                        p2 != p_idx
                                        and (e_target[p2] - assigned_e[p2]) > 0
                                        and avail[p2][d][b_end]
                                        for p2 in range(num_people)
                                    )
                                    else 0
                                )

                            # Preferencia por bloque estándar de 2h (4 slots) seguido de espacio para 1h M,
                            # o bloque de cierre de ventana (b_end == w_end) de 2h a 4h.
                            is_std_with_m = (
                                1
                                if (length == std_interview_slots and has_post_match_space(p_idx, d, b_end))
                                else 0
                            )
                            closes_window = 1 if (b_end == w_end and (w_end - b_start) <= max_interview_slots) else 0
                            # Si faltan <= 8 slots para cerrar la ventana y un bloque de 6..8 la cierra de una vez
                            clean_finish = (
                                1
                                if (b_end == w_end and newly_covered == length)
                                else 0
                            )
                            no_overlap_waste = 1 if newly_covered == length else 0

                            score = (
                                1 if length >= std_interview_slots else 0,
                                handoff_ok,
                                no_overlap_waste,
                                clean_finish or is_std_with_m or closes_window,
                                starts_at_target,
                                -already_working_today,
                                round(scarcity, 6),
                                newly_covered,
                                -p_idx,
                                -b_start,
                            )
                            if best_cand is None or score > best_cand[0]:
                                best_cand = (score, p_idx, b_start, b_end)

                if best_cand is None:
                    # Nadie puede cubrir target_slot sin violar reglas duras; avanzamos buscando el siguiente
                    # Para no ciclar infinitamente, marcamos que avanzamos a partir de target_slot + 1
                    found_later = False
                    for s_next in range(target_slot + 1, w_end):
                        if coverage_at(d, s_next) < cov_level:
                            # Intentar cubrir s_next directamente en una pasada lineal
                            for p_idx in range(num_people):
                                rem_e = e_target[p_idx] - assigned_e[p_idx]
                                if rem_e <= 0 or not avail[p_idx][d][s_next] or e_grid[p_idx][d][s_next]:
                                    continue
                                seg_end = s_next + 1
                                while seg_end < w_end and avail[p_idx][d][seg_end] and not e_grid[p_idx][d][seg_end]:
                                    seg_end += 1
                                max_len = min(max_interview_slots, rem_e, seg_end - s_next)
                                for length in ([L for L in range(4, max_len + 1)] or ([max_len] if max_len > 0 else [])):
                                    b_end = s_next + length
                                    if not overwrites_reserved_post_match(p_idx, d, s_next, b_end) and _can_add_interview_block(
                                        e_grid[p_idx][d], avail[p_idx][d], s_next, b_end, max_interview_slots
                                    ):
                                        for x in range(s_next, b_end):
                                            e_grid[p_idx][d][x] = True
                                        assigned_e[p_idx] += length
                                        found_later = True
                                        break
                                if found_later:
                                    break
                        if found_later:
                            break
                    if not found_later:
                        break
                else:
                    _, win_p, b_s, b_e = best_cand
                    for x in range(b_s, b_e):
                        e_grid[win_p][d][x] = True
                    assigned_e[win_p] += b_e - b_s

    # =========================================================================
    # FASE A1.5: REPARACIÓN DE HUECOS (SWAP DE PRESUPUESTO ENTRE PERSONAS)
    # =========================================================================
    # Si algún slot (d, s) quedó sin cubrir porque las únicas personas disponibles
    # en (d, s) agotaron su presupuesto E_target en otro día d_other donde había
    # otra persona con presupuesto E sobrante, cedemos ese bloque en d_other.
    for d in active_days:
        w_start, w_end = window_slots_by_day[d]
        for s in range(w_start, w_end):
            if coverage_at(d, s) >= min_coverage:
                continue
            # Buscar persona p_busy disponible en (d, s) que haya agotado su E_target
            for p_busy in range(num_people):
                if not avail[p_idx := p_busy][d][s] or e_grid[p_busy][d][s]:
                    continue
                if assigned_e[p_busy] < e_target[p_busy]:
                    continue
                # Buscar un bloque de p_busy en otro día d_other que pueda ser tomado por p_free
                swapped = False
                for d_other in range(7):
                    if d_other == d:
                        continue
                    for r_s, r_e in _contiguous_runs(e_grid[p_busy][d_other]):
                        r_len = r_e - r_s
                        for p_free in range(num_people):
                            if p_free == p_busy or (e_target[p_free] - assigned_e[p_free]) < r_len:
                                continue
                            if overwrites_reserved_post_match(p_free, d_other, r_s, r_e):
                                continue
                            if _can_add_interview_block(
                                e_grid[p_free][d_other], avail[p_free][d_other], r_s, r_e, max_interview_slots
                            ):
                                # Probar si al liberar r_s..r_e en p_busy ahora p_busy puede cubrir (d, s)
                                seg_end = s + 1
                                while seg_end < w_end and avail[p_busy][d][seg_end] and not e_grid[p_busy][d][seg_end]:
                                    seg_end += 1
                                new_len = min(r_len, seg_end - s, max_interview_slots)
                                if new_len > 0 and _can_add_interview_block(
                                    e_grid[p_busy][d], avail[p_busy][d], s, s + new_len, max_interview_slots
                                ):
                                    for x in range(r_s, r_e):
                                        e_grid[p_busy][d_other][x] = False
                                        e_grid[p_free][d_other][x] = True
                                    assigned_e[p_busy] -= r_len
                                    assigned_e[p_free] += r_len
                                    for x in range(s, s + new_len):
                                        e_grid[p_busy][d][x] = True
                                    assigned_e[p_busy] += new_len
                                    swapped = True
                                    break
                        if swapped:
                            break
                    if swapped:
                        break
                if swapped and coverage_at(d, s) >= min_coverage:
                    break

    # =========================================================================
    # FASE A2: COMPLETAR LA CUOTA DE ENTREVISTAS (E_target) DE CADA PERSONA
    # =========================================================================
    for p_idx in range(num_people):
        while assigned_e[p_idx] < e_target[p_idx]:
            rem = e_target[p_idx] - assigned_e[p_idx]
            placed = False

            # 1) Si rem < 4 (1..3 slots), primero intentar EXTENDER un bloque existente de E
            #    de esta persona sin pasar de 8 slots (4.0 h), para evitar bloques sueltos < 2h.
            if rem < std_interview_slots:
                best_ext: Optional[Tuple[Tuple[int, ...], int, int, int]] = None
                for d in range(7):
                    if d not in window_slots_by_day:
                        continue
                    runs = _contiguous_runs(e_grid[p_idx][d])
                    for r_s, r_e in runs:
                        cur_len = r_e - r_s
                        max_add = min(rem, max_interview_slots - cur_len)
                        for add_len in range(max_add, 0, -1):
                            # Intentar extender hacia la derecha [r_e, r_e + add_len)
                            if _can_add_interview_block(
                                e_grid[p_idx][d], avail[p_idx][d], r_e, r_e + add_len, max_interview_slots
                            ):
                                cov_sum = sum(coverage_at(d, x) for x in range(r_e, r_e + add_len))
                                sc = (add_len, -cov_sum, -d, -r_e)
                                if best_ext is None or sc > best_ext[0]:
                                    best_ext = (sc, d, r_e, r_e + add_len)
                            # Intentar extender hacia la izquierda [r_s - add_len, r_s)
                            if _can_add_interview_block(
                                e_grid[p_idx][d], avail[p_idx][d], r_s - add_len, r_s, max_interview_slots
                            ):
                                cov_sum = sum(coverage_at(d, x) for x in range(r_s - add_len, r_s))
                                sc = (add_len, -cov_sum, -d, -(r_s - add_len))
                                if best_ext is None or sc > best_ext[0]:
                                    best_ext = (sc, d, r_s - add_len, r_s)
                if best_ext is not None:
                    _, d_ext, s_ext, e_ext = best_ext
                    for x in range(s_ext, e_ext):
                        e_grid[p_idx][d_ext][x] = True
                    assigned_e[p_idx] += e_ext - s_ext
                    continue

            # 2) Intentar colocar un nuevo bloque de E (preferiblemente de 4 slots = 2h con espacio para 1h M,
            #    o de 4..min(8, rem) slots).
            desired_lengths = [L for L in [4, 6, 5, 7, 8] if L <= rem]
            if not desired_lengths:
                desired_lengths = list(range(min(rem, max_interview_slots), 0, -1))

            best_new: Optional[Tuple[Tuple[int, ...], int, int, int]] = None
            for length in desired_lengths:
                for d in range(7):
                    if d not in window_slots_by_day:
                        continue
                    w_start, w_end = window_slots_by_day[d]
                    has_e_today = 1 if any(e_grid[p_idx][d]) else 0
                    for b_start in range(w_start, w_end - length + 1):
                        b_end = b_start + length
                        if overwrites_reserved_post_match(p_idx, d, b_start, b_end):
                            continue
                        if not _can_add_interview_block(
                            e_grid[p_idx][d], avail[p_idx][d], b_start, b_end, max_interview_slots
                        ):
                            continue
                        post_m = 1 if (length == std_interview_slots and has_post_match_space(p_idx, d, b_end)) else 0
                        cov_sum = sum(coverage_at(d, x) for x in range(b_start, b_end))
                        sc = (
                            1 if length >= std_interview_slots else 0,
                            post_m,
                            -has_e_today,
                            -cov_sum,
                            length,
                            -d,
                            -b_start,
                        )
                        if best_new is None or sc > best_new[0]:
                            best_new = (sc, d, b_start, b_end)
                if best_new is not None:
                    break

            if best_new is not None:
                _, d_new, s_new, e_new = best_new
                for x in range(s_new, e_new):
                    e_grid[p_idx][d_new][x] = True
                assigned_e[p_idx] += e_new - s_new
                placed = True
            else:
                # 3) Si no cupo un bloque nuevo, intentar extender cualquier bloque existente hasta donde quepa
                for d in range(7):
                    if d not in window_slots_by_day:
                        continue
                    for r_s, r_e in _contiguous_runs(e_grid[p_idx][d]):
                        if (r_e - r_s) >= max_interview_slots:
                            continue
                        if _can_add_interview_block(
                            e_grid[p_idx][d], avail[p_idx][d], r_e, r_e + 1, max_interview_slots
                        ):
                            e_grid[p_idx][d][r_e] = True
                            assigned_e[p_idx] += 1
                            placed = True
                            break
                        if _can_add_interview_block(
                            e_grid[p_idx][d], avail[p_idx][d], r_s - 1, r_s, max_interview_slots
                        ):
                            e_grid[p_idx][d][r_s - 1] = True
                            assigned_e[p_idx] += 1
                            placed = True
                            break
                    if placed:
                        break

                # 4) Último recurso si quedan slots sueltos disponibles y rem > 0
                if not placed:
                    for length in range(min(rem, 3), 0, -1):
                        for d in range(7):
                            if d not in window_slots_by_day:
                                continue
                            w_start, w_end = window_slots_by_day[d]
                            for b_start in range(w_start, w_end - length + 1):
                                b_end = b_start + length
                                if _can_add_interview_block(
                                    e_grid[p_idx][d], avail[p_idx][d], b_start, b_end, max_interview_slots
                                ):
                                    for x in range(b_start, b_end):
                                        e_grid[p_idx][d][x] = True
                                    assigned_e[p_idx] += length
                                    placed = True
                                    break
                            if placed:
                                break
                        if placed:
                            break

            if not placed:
                break

    # =========================================================================
    # FASE B: ASIGNAR HORAS DE MATCHMAKING (M) PARA CADA PERSONA
    # =========================================================================
    for p_idx in range(num_people):
        e_cnt = assigned_e[p_idx]
        free_avail = sum(
            1
            for d in range(7)
            for s in range(SLOTS_PER_DAY)
            if avail[p_idx][d][s] and not e_grid[p_idx][d][s]
        )
        if e_cnt == e_target[p_idx]:
            desired_m = min(m_target[p_idx], free_avail)
        else:
            # Mantener proporción 1/3 matches respecto al total asignado
            desired_m = min(m_target[p_idx], free_avail, int(e_cnt / 2.0 + 0.5))

        m_rem = desired_m
        if m_rem <= 0:
            continue

        # Prioridad 1: 1h obligatoria de MATCHMAKING (2 slots) justo después de cada bloque de 2h (4 slots) de ENTREVISTAS
        for d in range(7):
            if m_rem <= 0:
                break
            runs = _contiguous_runs(e_grid[p_idx][d])
            for r_s, r_e in runs:
                if m_rem <= 0:
                    break
                if (r_e - r_s) == std_interview_slots:
                    for s in range(r_e, min(SLOTS_PER_DAY, r_e + std_matches_slots)):
                        if m_rem > 0 and avail[p_idx][d][s] and not e_grid[p_idx][d][s] and not m_grid[p_idx][d][s]:
                            m_grid[p_idx][d][s] = True
                            m_rem -= 1

        # Prioridad 2: Hasta 2h de MATCHMAKING después de cualquier otro bloque de ENTREVISTAS (p. ej. bloques de 2.5h–4h)
        for d in range(7):
            if m_rem <= 0:
                break
            runs = _contiguous_runs(e_grid[p_idx][d])
            for r_s, r_e in runs:
                if m_rem <= 0:
                    break
                max_post = std_matches_slots * 2 if (r_e - r_s) > std_interview_slots else std_matches_slots
                for s in range(r_e, min(SLOTS_PER_DAY, r_e + max_post)):
                    if m_rem > 0 and avail[p_idx][d][s] and not e_grid[p_idx][d][s] and not m_grid[p_idx][d][s]:
                        m_grid[p_idx][d][s] = True
                        m_rem -= 1

        # Prioridad 3: Justo antes de un bloque de ENTREVISTAS (pegado a r_s, de derecha a izquierda)
        for d in range(7):
            if m_rem <= 0:
                break
            runs = _contiguous_runs(e_grid[p_idx][d])
            for r_s, _ in runs:
                if m_rem <= 0:
                    break
                for s in range(r_s - 1, max(-1, r_s - std_matches_slots - 1), -1):
                    if m_rem > 0 and avail[p_idx][d][s] and not e_grid[p_idx][d][s] and not m_grid[p_idx][d][s]:
                        m_grid[p_idx][d][s] = True
                        m_rem -= 1

        # Prioridad 4: Bloques contiguos de al menos 1h (2 slots) en días disponibles
        for d in range(7):
            if m_rem < 2:
                break
            for s in range(SLOTS_PER_DAY - 1):
                if m_rem < 2:
                    break
                if (
                    avail[p_idx][d][s]
                    and avail[p_idx][d][s + 1]
                    and not e_grid[p_idx][d][s]
                    and not e_grid[p_idx][d][s + 1]
                    and not m_grid[p_idx][d][s]
                    and not m_grid[p_idx][d][s + 1]
                ):
                    m_grid[p_idx][d][s] = True
                    m_grid[p_idx][d][s + 1] = True
                    m_rem -= 2

        # Prioridad 5: Cualquier slot disponible restante hasta completar desired_m
        for d in range(7):
            if m_rem <= 0:
                break
            for s in range(SLOTS_PER_DAY):
                if m_rem <= 0:
                    break
                if avail[p_idx][d][s] and not e_grid[p_idx][d][s] and not m_grid[p_idx][d][s]:
                    m_grid[p_idx][d][s] = True
                    m_rem -= 1

    # =========================================================================
    # CONSTRUCCIÓN DE LA LISTA DE TURNOS Y DEL REPORTE
    # =========================================================================
    shifts: List[Dict[str, Any]] = []
    per_person_report: Dict[str, Dict[str, float]] = {}
    warnings: List[str] = []

    for p_idx, p in enumerate(active_people):
        p_name = str(p["name"]).strip()
        e_slots_count = 0
        m_slots_count = 0

        for d in range(7):
            day_date = week_monday + timedelta(days=d)
            s = 0
            while s < SLOTS_PER_DAY:
                cell_type: Optional[str] = None
                if e_grid[p_idx][d][s]:
                    cell_type = "ENTREVISTAS"
                elif m_grid[p_idx][d][s]:
                    cell_type = "MATCHMAKING"

                if cell_type is not None:
                    end_s = s + 1
                    while end_s < SLOTS_PER_DAY:
                        next_type = (
                            "ENTREVISTAS"
                            if e_grid[p_idx][d][end_s]
                            else ("MATCHMAKING" if m_grid[p_idx][d][end_s] else None)
                        )
                        if next_type == cell_type:
                            end_s += 1
                        else:
                            break
                    shifts.append(
                        {
                            "name": p_name,
                            "date": day_date,
                            "start": slot_to_time(s),
                            "end": slot_to_time(end_s),
                            "type": cell_type,
                        }
                    )
                    if cell_type == "ENTREVISTAS":
                        e_slots_count += end_s - s
                    else:
                        m_slots_count += end_s - s
                    s = end_s
                else:
                    s += 1

        interview_h = round(e_slots_count * 0.5, 2)
        matches_h = round(m_slots_count * 0.5, 2)
        assigned_h = round(interview_h + matches_h, 2)
        target_h = round(float(p.get("weekly_hours", 0.0)), 2)
        shortfall_h = round(max(0.0, target_h - assigned_h), 2)

        per_person_report[p_name] = {
            "assigned_hours": assigned_h,
            "interview_hours": interview_h,
            "matches_hours": matches_h,
            "target_hours": target_h,
            "shortfall": shortfall_h,
        }

        if shortfall_h > 0:
            warnings.append(
                f"{p_name}: quedaron {assigned_h:.1f} h asignadas de {target_h:.1f} h "
                f"(faltaron {shortfall_h:.1f} h por disponibilidad o permisos)."
            )

    # Ordenar turnos cronológicamente por fecha, hora de inicio y nombre
    shifts.sort(key=lambda x: (x["date"], x["start"], x["name"], x["type"]))

    # Calcular tramos descubiertos (uncovered) dentro de la ventana de cada día
    uncovered: List[Dict[str, Any]] = []
    for d in sorted(window_slots_by_day.keys()):
        w_start, w_end = window_slots_by_day[d]
        day_date = week_monday + timedelta(days=d)
        uncov_bool = [False] * SLOTS_PER_DAY
        for s in range(w_start, w_end):
            if coverage_at(d, s) < min_coverage:
                uncov_bool[s] = True
        for u_s, u_e in _contiguous_runs(uncov_bool):
            st_str = slot_to_time(u_s)
            en_str = slot_to_time(u_e)
            uncovered.append({"date": day_date, "start": st_str, "end": en_str})
            warnings.append(
                f"Sin cobertura de entrevistas el {DAY_NAMES_ES[d]} {day_date.isoformat()} "
                f"de {st_str} a {en_str}."
            )

    feasible = len(uncovered) == 0 and len(blocked_missing) == 0

    return {
        "shifts": shifts,
        "report": {
            "feasible": feasible,
            "blocked_by_missing_availability": blocked_missing,
            "uncovered": uncovered,
            "per_person": per_person_report,
            "warnings": warnings,
        },
    }
