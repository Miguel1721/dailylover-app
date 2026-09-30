"""
Suite de pruebas y verificador independiente para `backend/app/services/shift_generator.py`.

Ejecuta:
  1. Los 10 casos deterministas requeridos en `antigravity_encargo_generador.md`.
  2. La batería de 200 semillas aleatorias de disponibilidad, permisos e inactivas,
     validando cada salida con el verificador independiente `check_week`.

Termina con código 0 únicamente si todas las pruebas y las 200 semillas pasan.
"""

from __future__ import annotations

import os
import random
import sys
import time
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.services.shift_generator import (
    DEFAULT_WINDOW,
    SLOTS_PER_DAY,
    generate_week,
    slot_to_time,
    time_to_slot,
)

REFERENCE_MONDAY = date(2026, 10, 5)


def reference_people() -> List[Dict[str, Any]]:
    """Equipo real de referencia (total 117 h: 78 h entrevistas + 39 h matches)."""
    return [
        {"name": "Estefania Rodriguez", "weekly_hours": 20.0, "active": True},
        {"name": "Ana Maria Tolosa", "weekly_hours": 20.0, "active": True},
        {"name": "Isabela Marquez", "weekly_hours": 17.0, "active": True},
        {"name": "Jennifer Pimiento", "weekly_hours": 15.0, "active": True},
        {"name": "Silvana Manrique", "weekly_hours": 15.0, "active": True},
        {"name": "Maria Pia Cottrino", "weekly_hours": 15.0, "active": True},
        {"name": "Mara Paula de la Espriella", "weekly_hours": 15.0, "active": True},
    ]


def all_day_week_availability(people: List[Dict[str, Any]]) -> Dict[str, Dict[int, Dict[str, Any]]]:
    """Disponibilidad ALL_DAY de lunes (0) a sábado (5) para todas las personas."""
    return {
        p["name"].lower(): {d: {"mode": "ALL_DAY"} for d in range(6)}
        for p in people
    }


def _has_defined_avail_independent(day_map: Optional[Dict[Any, Any]]) -> bool:
    if not day_map or not isinstance(day_map, dict):
        return False
    for d in range(7):
        info = day_map.get(d) or day_map.get(str(d))
        if not isinstance(info, dict):
            continue
        mode = str(info.get("mode") or "UNSET").strip().upper()
        if mode in ("ALL_DAY", "UNAVAILABLE"):
            return True
        if mode == "RANGES":
            for r in info.get("ranges") or []:
                if isinstance(r, (tuple, list)) and len(r) >= 2:
                    if time_to_slot(str(r[0])) < time_to_slot(str(r[1])):
                        return True
                elif isinstance(r, dict):
                    s = r.get("start") or r.get("start_time")
                    e = r.get("end") or r.get("end_time")
                    if s and e and time_to_slot(str(s)) < time_to_slot(str(e)):
                        return True
    return False


def check_week(
    result: Dict[str, Any],
    week_monday: date,
    people: List[Dict[str, Any]],
    availability: Dict[str, Any],
    time_off: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Verificador independiente de las reglas 1 a 10.
    Devuelve una lista de errores encontrados (vacía si cumple todas las reglas).
    """
    errors: List[str] = []
    if not isinstance(result, dict) or "shifts" not in result or "report" not in result:
        return ["Estructura de salida inválida: faltan 'shifts' o 'report'."]

    shifts = result["shifts"]
    report = result["report"]
    for req_key in ("feasible", "blocked_by_missing_availability", "uncovered", "per_person", "warnings"):
        if req_key not in report:
            errors.append(f"Falta clave '{req_key}' en report.")
    if errors:
        return errors

    active_people = {str(p["name"]).strip(): p for p in people if p.get("active", True) is True}
    inactive_names = {str(p["name"]).strip().lower() for p in people if p.get("active", True) is False}
    avail_lower = {str(k).strip().lower(): v for k, v in (availability or {}).items()}

    # Regla 9b: comprobar personas activas sin disponibilidad definida
    expected_blocked = [
        name
        for name in active_people
        if not _has_defined_avail_independent(avail_lower.get(name.lower()))
    ]
    if expected_blocked:
        if shifts:
            errors.append(f"Regla 9b violada: se generaron {len(shifts)} turnos habiendo personas sin disponibilidad ({expected_blocked}).")
        if report["feasible"] is not False:
            errors.append("Regla 9b violada: feasible debe ser False cuando falta disponibilidad.")
        if set(report["blocked_by_missing_availability"]) != set(expected_blocked):
            errors.append(
                f"Regla 9b violada: blocked_by_missing_availability={report['blocked_by_missing_availability']} "
                f"!= esperado={expected_blocked}."
            )
        return errors
    else:
        if report["blocked_by_missing_availability"]:
            errors.append(f"Falso positivo en blocked_by_missing_availability: {report['blocked_by_missing_availability']}.")

    # Ventana de cobertura (Reglas 1 y 9: nada fuera de la ventana)
    raw_win = (config or {}).get("window", DEFAULT_WINDOW)
    min_cov = int((config or {}).get("min_coverage", 1))
    win_by_day: Dict[int, Optional[Tuple[int, int]]] = {}
    for d in range(7):
        w = raw_win.get(d) if isinstance(raw_win, dict) else DEFAULT_WINDOW.get(d)
        if w and len(w) >= 2 and w[0] and w[1]:
            win_by_day[d] = (time_to_slot(str(w[0])), time_to_slot(str(w[1])))
        else:
            win_by_day[d] = None

    # Permisos aprobados por persona
    off_by_person: Dict[str, set] = {name.lower(): set() for name in active_people}
    for item in time_off or []:
        status = str(item.get("status", "APPROVED")).strip().upper()
        if status not in ("APPROVED", "APROBADO", "APROBADA", "TRUE", "1"):
            continue
        who = str(item.get("name") or item.get("employee_name") or "").strip().lower()
        sd = item.get("start") or item.get("start_date")
        ed = item.get("end") or item.get("end_date") or sd
        if who in off_by_person and isinstance(sd, date) and isinstance(ed, date):
            c = sd
            while c <= ed:
                off_by_person[who].add(c)
                c += timedelta(days=1)

    # Mapa de ocupación por persona, día y slot: person_slots[name][d][s] -> type
    person_slots: Dict[str, List[List[Optional[str]]]] = {
        name: [[None] * SLOTS_PER_DAY for _ in range(7)] for name in active_people
    }

    for idx, sh in enumerate(shifts):
        name = str(sh.get("name", "")).strip()
        sh_date = sh.get("date")
        st_str = str(sh.get("start", ""))
        en_str = str(sh.get("end", ""))
        sh_type = str(sh.get("type", ""))

        # Regla 10: personas inactivas ignoradas
        if name.lower() in inactive_names:
            errors.append(f"Regla 10 violada: turno #{idx} asignado a persona inactiva '{name}'.")
            continue
        if name not in active_people:
            errors.append(f"Turno #{idx} asignado a persona desconocida '{name}'.")
            continue
        if sh_type not in ("ENTREVISTAS", "MATCHMAKING"):
            errors.append(f"Turno #{idx} con tipo inválido '{sh_type}'.")
            continue
        if not isinstance(sh_date, date):
            errors.append(f"Turno #{idx} con fecha inválida '{sh_date}'.")
            continue
        day_idx = (sh_date - week_monday).days
        if not (0 <= day_idx <= 6):
            errors.append(f"Turno #{idx} fuera de la semana ({sh_date}).")
            continue

        # Regla 6: granularidad de 30 min
        for t_str in (st_str, en_str):
            parts = t_str.split(":")
            if len(parts) != 2 or int(parts[1]) not in (0, 30):
                errors.append(f"Regla 6 violada: hora '{t_str}' no es múltiplo de 30 min.")
        s_slot = time_to_slot(st_str)
        e_slot = time_to_slot(en_str)
        if not (0 <= s_slot < e_slot <= SLOTS_PER_DAY):
            errors.append(f"Turno #{idx} con rango horario inválido {st_str}-{en_str}.")
            continue

        # Regla 1 y Regla 9: NADA fuera de la ventana (ni entrevistas ni matches)
        w_bounds = win_by_day.get(day_idx)
        if w_bounds is None:
            errors.append(f"Regla 9 violada: turno #{idx} ({name}, {sh_type}) en día sin ventana (día {day_idx}).")
            continue
        w_s, w_e = w_bounds
        if s_slot < w_s or e_slot > w_e:
            errors.append(
                f"Regla 9 violada: turno #{idx} ({name}, {sh_type} {st_str}-{en_str}) "
                f"cae fuera de la ventana {slot_to_time(w_s)}-{slot_to_time(w_e)}."
            )

        # Regla 7: nunca en días de permiso ni fuera de su disponibilidad
        if sh_date in off_by_person.get(name.lower(), set()):
            errors.append(f"Regla 7 violada: turno #{idx} de '{name}' en día de permiso ({sh_date}).")

        p_day_map = avail_lower.get(name.lower(), {})
        d_info = p_day_map.get(day_idx) or p_day_map.get(str(day_idx)) or {"mode": "UNSET"}
        mode = str(d_info.get("mode") or "UNSET").strip().upper()
        if mode in ("UNSET", "UNAVAILABLE"):
            errors.append(f"Regla 7 violada: turno #{idx} de '{name}' en día {day_idx} con modo {mode}.")
        elif mode == "RANGES":
            allowed = [False] * SLOTS_PER_DAY
            for r in d_info.get("ranges") or []:
                if isinstance(r, (tuple, list)) and len(r) >= 2:
                    rs, re_ = time_to_slot(str(r[0])), time_to_slot(str(r[1]))
                elif isinstance(r, dict):
                    rs = time_to_slot(str(r.get("start") or r.get("start_time")))
                    re_ = time_to_slot(str(r.get("end") or r.get("end_time")))
                else:
                    continue
                for s in range(max(0, rs), min(SLOTS_PER_DAY, re_)):
                    allowed[s] = True
            for s in range(s_slot, e_slot):
                if not allowed[s]:
                    errors.append(
                        f"Regla 7 violada: turno #{idx} de '{name}' ({st_str}-{en_str}) "
                        f"sale de sus RANGES en slot {slot_to_time(s)}."
                    )
                    break

        # Regla 8: sin solapamientos de turnos para la misma persona
        for s in range(s_slot, e_slot):
            if person_slots[name][day_idx][s] is not None:
                errors.append(
                    f"Regla 8 violada: solapamiento para '{name}' el {sh_date} en {slot_to_time(s)}."
                )
                break
            person_slots[name][day_idx][s] = sh_type

    # Reglas 3, 4 y 5 por persona
    for name, p in active_people.items():
        e_total_slots = 0
        m_total_slots = 0
        for d in range(7):
            day_arr = person_slots[name][d]
            for s in range(SLOTS_PER_DAY):
                if day_arr[s] == "ENTREVISTAS":
                    e_total_slots += 1
                elif day_arr[s] == "MATCHMAKING":
                    m_total_slots += 1

            # Regla 5: ninguna racha contigua de ENTREVISTAS puede superar 4.0 h (8 slots)
            s = 0
            while s < SLOTS_PER_DAY:
                if day_arr[s] == "ENTREVISTAS":
                    e_end = s + 1
                    while e_end < SLOTS_PER_DAY and day_arr[e_end] == "ENTREVISTAS":
                        e_end += 1
                    run_slots = e_end - s
                    if run_slots > 8:
                        errors.append(
                            f"Regla 5 violada: '{name}' tiene {run_slots * 0.5:.1f} h seguidas "
                            f"de ENTREVISTAS el día {d} (máximo permitido: 4.0 h)."
                        )
                    s = e_end
                else:
                    s += 1

        # Regla 5b: verificar que si tiene bloques de 2h de ENTREVISTAS con espacio disponible
        # justo después y horas de MATCHMAKING asignadas fuera de post-2h, se haya puesto la 1h de M tras los de 2h
        unfulfilled_2h_post = 0
        non_post2h_m_slots = m_total_slots
        p_day_map = avail_lower.get(name.lower(), {})
        for d in range(7):
            w_bounds = win_by_day.get(d)
            if w_bounds is None or (week_monday + timedelta(days=d)) in off_by_person.get(name.lower(), set()):
                continue
            w_s, w_e = w_bounds
            d_info = p_day_map.get(d) or p_day_map.get(str(d)) or {"mode": "UNSET"}
            mode = str(d_info.get("mode") or "UNSET").strip().upper()
            avail_d = [False] * SLOTS_PER_DAY
            if mode == "ALL_DAY":
                for x in range(w_s, w_e):
                    avail_d[x] = True
            elif mode == "RANGES":
                for r in d_info.get("ranges") or []:
                    rs, re_ = time_to_slot(str(r[0])), time_to_slot(str(r[1]))
                    for x in range(max(w_s, rs), min(w_e, re_)):
                        avail_d[x] = True

            day_arr = person_slots[name][d]
            s = 0
            while s < SLOTS_PER_DAY:
                if day_arr[s] == "ENTREVISTAS":
                    e_end = s + 1
                    while e_end < SLOTS_PER_DAY and day_arr[e_end] == "ENTREVISTAS":
                        e_end += 1
                    if (e_end - s) == 4:
                        followed_by_m = sum(
                            1 for x in range(e_end, min(SLOTS_PER_DAY, e_end + 2)) if day_arr[x] == "MATCHMAKING"
                        )
                        non_post2h_m_slots -= followed_by_m
                        if e_end + 2 <= w_e and avail_d[e_end] and avail_d[e_end + 1]:
                            if day_arr[e_end] != "MATCHMAKING" or day_arr[e_end + 1] != "MATCHMAKING":
                                unfulfilled_2h_post += 1
                    s = e_end
                else:
                    s += 1
        if unfulfilled_2h_post > 0 and non_post2h_m_slots >= 2:
            errors.append(
                f"Regla 5 violada: '{name}' tiene {unfulfilled_2h_post} bloque(s) de 2h ENTREVISTAS "
                f"sin la 1h posterior de MATCHMAKING pese a tener espacio y horas de matches disponibles."
            )

        int_h = round(e_total_slots * 0.5, 2)
        mat_h = round(m_total_slots * 0.5, 2)
        asg_h = round(int_h + mat_h, 2)
        tgt_h = round(float(p["weekly_hours"]), 2)
        sht_h = round(max(0.0, tgt_h - asg_h), 2)

        # Regla 3: no pasarse de weekly_hours y coincidir con report["per_person"]
        if asg_h > tgt_h + 1e-6:
            errors.append(f"Regla 3 violada: '{name}' tiene {asg_h} h asignadas > meta {tgt_h} h.")

        rep_p = report["per_person"].get(name)
        if not rep_p:
            errors.append(f"Falta '{name}' en report['per_person'].")
        else:
            if (
                abs(rep_p["assigned_hours"] - asg_h) > 1e-6
                or abs(rep_p["interview_hours"] - int_h) > 1e-6
                or abs(rep_p["matches_hours"] - mat_h) > 1e-6
                or abs(rep_p["target_hours"] - tgt_h) > 1e-6
                or abs(rep_p["shortfall"] - sht_h) > 1e-6
            ):
                errors.append(f"Desajuste en report['per_person']['{name}']: {rep_p}.")

        # Regla 4: ≈ 1/3 de horas en MATCHMAKING y ≈ 2/3 en ENTREVISTAS (tolerancia ±0.5 h)
        if asg_h > 0:
            expected_matches = asg_h / 3.0
            if abs(mat_h - expected_matches) > 0.5 + 1e-6:
                errors.append(
                    f"Regla 4 violada para '{name}': matches_hours={mat_h} h se aleja más de 0.5 h "
                    f"de 1/3 de sus horas asignadas ({expected_matches:.2f} h)."
                )

    # Regla 2: verificar cálculo exacto de tramos sin cobertura (uncovered)
    expected_uncovered: List[Dict[str, Any]] = []
    for d in range(7):
        w_bounds = win_by_day.get(d)
        if w_bounds is None:
            continue
        w_s, w_e = w_bounds
        day_date = week_monday + timedelta(days=d)
        s = w_s
        while s < w_e:
            cov = sum(1 for name in active_people if person_slots[name][d][s] == "ENTREVISTAS")
            if cov < min_cov:
                u_end = s + 1
                while u_end < w_e:
                    cov2 = sum(1 for name in active_people if person_slots[name][d][u_end] == "ENTREVISTAS")
                    if cov2 < min_cov:
                        u_end += 1
                    else:
                        break
                expected_uncovered.append(
                    {"date": day_date, "start": slot_to_time(s), "end": slot_to_time(u_end)}
                )
                s = u_end
            else:
                s += 1

    if report["uncovered"] != expected_uncovered:
        errors.append(
            f"Regla 2 violada: report['uncovered']={report['uncovered']} != esperado={expected_uncovered}."
        )

    expected_feasible = len(expected_uncovered) == 0 and len(expected_blocked) == 0
    if report["feasible"] != expected_feasible:
        errors.append(f"feasible={report['feasible']} != esperado={expected_feasible}.")

    return errors


# =============================================================================
# CASOS DE PRUEBA (1 al 10 + 200 SEMILLAS ALEATORIAS)
# =============================================================================

def test_case_1_full_availability() -> None:
    """1. Las 7 personas con disponibilidad amplia (ALL_DAY lunes–sábado)."""
    people = reference_people()
    avail = all_day_week_availability(people)
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 1 errores de verificador: {errs}"
    assert res["report"]["feasible"] is True, "Caso 1 debe ser feasible=True"
    assert res["report"]["uncovered"] == [], f"Caso 1 no debe tener huecos: {res['report']['uncovered']}"
    total_assigned = sum(v["assigned_hours"] for v in res["report"]["per_person"].values())
    assert abs(total_assigned - 117.0) < 1e-6, f"Caso 1 total asignado={total_assigned} != 117.0"
    for name, stats in res["report"]["per_person"].items():
        assert stats["shortfall"] == 0.0, f"Caso 1 {name} tuvo shortfall={stats['shortfall']}"


def test_case_2_reduced_availability_one_person() -> None:
    """2. Disponibilidad reducida de una persona (solo tardes 14:00–20:00 lun–vie)."""
    people = reference_people()
    avail = all_day_week_availability(people)
    avail["jennifer pimiento"] = {
        0: {"mode": "RANGES", "ranges": [("14:00", "20:00")]},
        1: {"mode": "RANGES", "ranges": [("14:00", "20:00")]},
        2: {"mode": "RANGES", "ranges": [("14:00", "20:00")]},
        3: {"mode": "RANGES", "ranges": [("14:00", "20:00")]},
        4: {"mode": "RANGES", "ranges": [("14:00", "20:00")]},
        5: {"mode": "UNAVAILABLE"},
    }
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 2 errores de verificador: {errs}"
    assert res["report"]["feasible"] is True, "Caso 2 debe cubrir toda la ventana con el resto del equipo"
    assert res["report"]["per_person"]["Jennifer Pimiento"]["assigned_hours"] == 15.0


def test_case_3_full_week_time_off() -> None:
    """3. Una persona con permiso aprobado toda la semana."""
    people = reference_people()
    avail = all_day_week_availability(people)
    time_off = [
        {
            "name": "Silvana Manrique",
            "start": REFERENCE_MONDAY,
            "end": REFERENCE_MONDAY + timedelta(days=6),
        }
    ]
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=time_off)
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=time_off)
    assert not errs, f"Caso 3 errores de verificador: {errs}"
    assert res["report"]["feasible"] is True, "Caso 3 debe seguir cubriendo las 59 h con las otras 6 personas"
    silvana_stats = res["report"]["per_person"]["Silvana Manrique"]
    assert silvana_stats["assigned_hours"] == 0.0
    assert silvana_stats["shortfall"] == 15.0
    assert all(s["name"] != "Silvana Manrique" for s in res["shifts"])


def test_case_4_inactive_person() -> None:
    """4. Una persona inactiva (debe ignorarse por completo y repartir con las demás)."""
    people = reference_people()
    people[3]["active"] = False  # Jennifer Pimiento inactiva
    avail = all_day_week_availability(people)
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 4 errores de verificador: {errs}"
    assert "Jennifer Pimiento" not in res["report"]["per_person"]
    assert all(s["name"] != "Jennifer Pimiento" for s in res["shifts"])
    assert res["report"]["feasible"] is True


def test_case_5_saturday_morning_gap() -> None:
    """5. Todas las personas con vacío de disponibilidad en la mañana del sábado (09:00–11:00)."""
    people = reference_people()
    avail = all_day_week_availability(people)
    for k in avail:
        avail[k][5] = {"mode": "RANGES", "ranges": [("11:00", "13:00")]}
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 5 errores de verificador: {errs}"
    assert res["report"]["feasible"] is False
    expected_gap = {"date": REFERENCE_MONDAY + timedelta(days=5), "start": "09:00", "end": "11:00"}
    assert expected_gap in res["report"]["uncovered"], f"Hueco esperado no reportado: {res['report']['uncovered']}"


def test_case_6_unset_or_missing_day() -> None:
    """6. Día ausente / UNSET: no asigna nada ese día a esa persona."""
    people = reference_people()
    avail = all_day_week_availability(people)
    # Ana Maria Tolosa tiene lunes ausente y martes explícitamente UNSET
    del avail["ana maria tolosa"][0]
    avail["ana maria tolosa"][1] = {"mode": "UNSET"}
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 6 errores de verificador: {errs}"
    mon_date = REFERENCE_MONDAY
    tue_date = REFERENCE_MONDAY + timedelta(days=1)
    for sh in res["shifts"]:
        if sh["name"] == "Ana Maria Tolosa":
            assert sh["date"] not in (mon_date, tue_date), f"Asignó turno en día UNSET/ausente: {sh}"


def test_case_7_split_shift_availability() -> None:
    """7. Disponibilidad fragmentada en dos tramos por día (turno partido real)."""
    people = reference_people()
    avail = all_day_week_availability(people)
    for d in range(5):
        avail["estefania rodriguez"][d] = {
            "mode": "RANGES",
            "ranges": [("09:00", "12:30"), ("15:30", "20:00")],
        }
        avail["isabela marquez"][d] = {
            "mode": "RANGES",
            "ranges": [("09:00", "13:00"), ("16:00", "20:00")],
        }
    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 7 errores de verificador: {errs}"
    assert res["report"]["feasible"] is True


def test_case_9_determinism() -> None:
    """9. Determinismo: misma entrada produce exactamente el mismo resultado."""
    people = reference_people()
    avail = all_day_week_availability(people)
    avail["maria pia cottrino"][2] = {"mode": "RANGES", "ranges": [("10:00", "14:00"), ("16:00", "19:30")]}
    r1 = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    r2 = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    assert r1 == r2, "Caso 9 falló: dos ejecuciones con la misma entrada dieron resultados distintos."


def test_case_10_missing_availability_and_window_lock() -> None:
    """
    10. Persona activa sin disponibilidad (regla 9b) y bloqueo estricto de ventana (regla 9).
    """
    people = reference_people()
    avail = all_day_week_availability(people)
    # Mara Paula tiene todos los días en UNSET
    avail["mara paula de la espriella"] = {d: {"mode": "UNSET"} for d in range(7)}
    # Y Silvana ni siquiera está en el diccionario
    del avail["silvana manrique"]

    res = generate_week(REFERENCE_MONDAY, people, avail, time_off=[])
    errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=[])
    assert not errs, f"Caso 10a errores de verificador: {errs}"
    assert res["shifts"] == []
    assert res["report"]["feasible"] is False
    assert set(res["report"]["blocked_by_missing_availability"]) == {
        "Silvana Manrique",
        "Mara Paula de la Espriella",
    }

    # Además, comprobar que aunque una persona declare RANGES fuera de la ventana (07:00-22:00)
    # y se pase matches_inside_window=False en config, NINGUNA franja sale de 09:00-20:00 / 09:00-13:00
    avail_wide = all_day_week_availability(people)
    for d in range(6):
        avail_wide["ana maria tolosa"][d] = {"mode": "RANGES", "ranges": [("07:00", "22:00")]}
    res_wide = generate_week(
        REFERENCE_MONDAY,
        people,
        avail_wide,
        time_off=[],
        config={"matches_inside_window": False},
    )
    errs_wide = check_week(res_wide, REFERENCE_MONDAY, people, avail_wide, time_off=[])
    assert not errs_wide, f"Caso 10b errores de verificador (ventana): {errs_wide}"


def _random_scenario(seed: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
    """Genera un escenario aleatorio reproducible de disponibilidad, permisos y estado activo."""
    rng = random.Random(seed)
    people = reference_people()

    # En ~15% de las semillas desactivar 1 persona al azar
    if rng.random() < 0.15:
        idx_inact = rng.randrange(len(people))
        people[idx_inact]["active"] = False

    # En ~8% de las semillas dejar 1 persona activa sin disponibilidad (para ejercitar 9b también en aleatorio)
    leave_one_unset = rng.random() < 0.08
    unset_idx = rng.randrange(len(people)) if leave_one_unset else -1

    avail: Dict[str, Dict[int, Dict[str, Any]]] = {}
    for idx, p in enumerate(people):
        name_l = p["name"].lower()
        if idx == unset_idx and p["active"]:
            avail[name_l] = {d: {"mode": "UNSET"} for d in range(7)}
            continue

        day_dict: Dict[int, Dict[str, Any]] = {}
        has_any_defined = False
        for d in range(6):
            w_start_slot, w_end_slot = (18, 40) if d < 5 else (18, 26)
            roll = rng.random()
            if roll < 0.45:
                day_dict[d] = {"mode": "ALL_DAY"}
                has_any_defined = True
            elif roll < 0.80:
                # Generar 1 o 2 tramos dentro (o parcialmente fuera) de la ventana
                num_ranges = 1 if (d == 5 or rng.random() < 0.45) else 2
                ranges: List[Tuple[str, str]] = []
                if num_ranges == 1:
                    s1 = rng.randint(w_start_slot - 2, w_end_slot - 4)
                    e1 = rng.randint(max(s1 + 2, w_start_slot + 2), w_end_slot + 2)
                    ranges.append((slot_to_time(s1), slot_to_time(e1)))
                else:
                    mid = (w_start_slot + w_end_slot) // 2
                    s1 = rng.randint(w_start_slot, mid - 3)
                    e1 = rng.randint(s1 + 2, mid)
                    s2 = rng.randint(e1 + 1, w_end_slot - 3)
                    e2 = rng.randint(s2 + 2, w_end_slot)
                    ranges.append((slot_to_time(s1), slot_to_time(e1)))
                    ranges.append((slot_to_time(s2), slot_to_time(e2)))
                day_dict[d] = {"mode": "RANGES", "ranges": ranges}
                has_any_defined = True
            elif roll < 0.90:
                day_dict[d] = {"mode": "UNAVAILABLE"}
                has_any_defined = True
            else:
                day_dict[d] = {"mode": "UNSET"}

        if not has_any_defined:
            day_dict[0] = {"mode": "ALL_DAY"}
        avail[name_l] = day_dict

    # Permisos aleatorios (0 a 2 permisos cortos)
    time_off: List[Dict[str, Any]] = []
    for p in people:
        if rng.random() < 0.20:
            off_start_d = rng.randint(0, 5)
            off_len = rng.randint(0, 2)
            time_off.append(
                {
                    "name": p["name"],
                    "start": REFERENCE_MONDAY + timedelta(days=off_start_d),
                    "end": REFERENCE_MONDAY + timedelta(days=min(6, off_start_d + off_len)),
                }
            )

    return people, avail, time_off


def test_case_8_200_random_availabilities() -> Tuple[int, float, int]:
    """
    8. Corre el generador y el verificador independiente `check_week` sobre
       200 disponibilidades aleatorias (seed = 0..199).
    """
    num_seeds = 200
    feasible_count = 0
    t0 = time.perf_counter()
    for seed in range(num_seeds):
        people, avail, time_off = _random_scenario(seed)
        res = generate_week(REFERENCE_MONDAY, people, avail, time_off=time_off)
        errs = check_week(res, REFERENCE_MONDAY, people, avail, time_off=time_off)
        assert not errs, f"Fallo en semilla aleatoria {seed}: {errs}"
        if res["report"]["feasible"]:
            feasible_count += 1
    elapsed = time.perf_counter() - t0
    return num_seeds, elapsed, feasible_count


def main() -> int:
    t_start = time.perf_counter()
    tests = [
        ("Caso 1: 7 personas ALL_DAY (cobertura total, 117 h exactas, 1/3 matches)", test_case_1_full_availability),
        ("Caso 2: Disponibilidad reducida de 1 persona (solo tardes)", test_case_2_reduced_availability_one_person),
        ("Caso 3: 1 persona con permiso toda la semana", test_case_3_full_week_time_off),
        ("Caso 4: 1 persona inactiva (ignorada por completo)", test_case_4_inactive_person),
        ("Caso 5: Vacío compartido en sábado por la mañana (reporta uncovered)", test_case_5_saturday_morning_gap),
        ("Caso 6: Día ausente / UNSET (no asigna nada ese día)", test_case_6_unset_or_missing_day),
        ("Caso 7: Disponibilidad fragmentada en dos tramos por día (turno partido)", test_case_7_split_shift_availability),
        ("Caso 9: Determinismo (misma entrada -> misma salida)", test_case_9_determinism),
        ("Caso 10: Persona activa sin disponibilidad (9b) y candado de ventana (9)", test_case_10_missing_availability_and_window_lock),
    ]

    print("=" * 72)
    print(" EJECUTANDO PRUEBAS DEL GENERADOR AUTOMÁTICO DE HORARIOS (FASE 3)")
    print("=" * 72)

    passed = 0
    for label, fn in tests:
        t0 = time.perf_counter()
        fn()
        dt_ms = (time.perf_counter() - t0) * 1000.0
        print(f"  [OK] {label} ({dt_ms:.1f} ms)")
        passed += 1

    # Caso 8: 200 semillas aleatorias
    num_seeds, rand_elapsed, feasible_count = test_case_8_200_random_availabilities()
    avg_ms = (rand_elapsed / num_seeds) * 1000.0
    print(
        f"  [OK] Caso 8: Verificador check_week en {num_seeds}/{num_seeds} disponibilidades aleatorias "
        f"({rand_elapsed * 1000.0:.1f} ms total, {avg_ms:.2f} ms/semana, {feasible_count} con cobertura 100%)"
    )
    passed += 1

    total_ms = (time.perf_counter() - t_start) * 1000.0
    print("=" * 72)
    print(f" RESULTADO FINAL: {passed}/{len(tests) + 1} suites pasadas + {num_seeds}/{num_seeds} semillas aleatorias OK ({total_ms:.1f} ms)")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
