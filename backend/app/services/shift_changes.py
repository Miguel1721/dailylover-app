"""Reglas puras (sin base de datos) de los cambios de horario entre personas (Fase 5).

Dos operaciones:
1. Mover una franja de MATCHES propia a otro momento de la misma semana (sin aprobación, máx. 2 por persona y día).
2. Intercambiar una franja con otra persona (misma clase y misma duración): entra en vigor cuando la otra acepta.

Las funciones devuelven una lista de errores legibles en español (vacía = permitido). No lanzan excepciones.

Formatos:
  shift = {"id": int, "name": str, "date": date, "start": time, "end": time, "type": "ENTREVISTAS" | "MATCHMAKING"}
  availability = {nombre_en_minúscula: {0..6: {"mode": "ALL_DAY"|"RANGES"|"UNAVAILABLE"|"UNSET", "ranges": [("HH:MM", "HH:MM")]}}}
  time_off = [{"name": str, "start": date, "end": date}]   # solo aprobados
"""
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

# Ventana en la que puede haber turnos (minutos desde 00:00). Domingo sin turnos.
WINDOWS = {0: (540, 1200), 1: (540, 1200), 2: (540, 1200), 3: (540, 1200), 4: (540, 1200), 5: (540, 780)}
MAX_MOVES_PER_DAY = 2
DAY_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _m(t: time) -> int:
    return t.hour * 60 + t.minute


def _hm(s: str) -> int:
    return int(s[:2]) * 60 + int(s[3:5])


def _fmt(mins: int) -> str:
    h, m = divmod(mins, 60)
    suf = "am" if h < 12 else "pm"
    return f"{(h % 12) or 12}{suf}" if m == 0 else f"{(h % 12) or 12}:{m:02d}{suf}"


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _dur(s: Dict[str, Any]) -> int:
    return _m(s["end"]) - _m(s["start"])


def _starts_at(d: date, mins: int) -> datetime:
    return datetime.combine(d, time(0, 0)) + timedelta(minutes=mins)


def _in_availability(av: Optional[dict], weekday: int, a: int, b: int) -> bool:
    day = (av or {}).get(weekday)
    if not day or day.get("mode") in (None, "UNSET", "UNAVAILABLE"):
        return False
    if day["mode"] == "ALL_DAY":
        return True
    return any(_hm(x) <= a and b <= _hm(y) for x, y in day.get("ranges", []))


def _on_leave(time_off: List[dict], name: str, d: date) -> bool:
    return any(o["name"].lower() == name.lower() and o["start"] <= d <= o["end"] for o in (time_off or []))


def _overlaps(shifts: List[dict], name: str, d: date, a: int, b: int, ignore_ids=()) -> bool:
    return any(s["name"].lower() == name.lower() and s["date"] == d and s["id"] not in ignore_ids
               and _m(s["start"]) < b and a < _m(s["end"]) for s in shifts)


def _slot_problems(name: str, d: date, a: int, b: int, *, shifts, availability, time_off, ignore_ids=()) -> List[str]:
    """Problemas de poner a `name` en [a, b) el día d."""
    errs: List[str] = []
    wd = d.weekday()
    win = WINDOWS.get(wd)
    lbl = f"{DAY_ES[wd]} {d.day}/{d.month} {_fmt(a)}–{_fmt(b)}"
    if not win or a < win[0] or b > win[1]:
        errs.append(f"{lbl} queda fuera del horario permitido.")
    if a % 30 or b % 30:
        errs.append(f"{lbl}: las horas deben ser en punto o y media.")
    if _on_leave(time_off, name, d):
        errs.append(f"{name} tiene un permiso aprobado el {DAY_ES[wd]} {d.day}/{d.month}.")
    if not _in_availability(availability.get(name.lower()), wd, a, b):
        errs.append(f"{lbl} está fuera de la disponibilidad de {name}.")
    if _overlaps(shifts, name, d, a, b, ignore_ids):
        errs.append(f"{lbl} se cruza con otro turno de {name}.")
    return errs


def validate_match_move(shift: dict, new_date: date, new_start: time, *, week_shifts: List[dict], availability: dict,
                        time_off: List[dict], moves_today: int, now: datetime) -> List[str]:
    """¿Puede la dueña mover esta franja de MATCHES a otro momento (misma duración, misma semana)?"""
    errs: List[str] = []
    if shift["type"] != "MATCHMAKING":
        return ["Solo se pueden mover las horas de matches. Las entrevistas no se mueven por tu cuenta."]
    if _starts_at(shift["date"], _m(shift["start"])) <= now:
        errs.append("Esa franja ya empezó o ya pasó.")
    if moves_today >= MAX_MOVES_PER_DAY:
        errs.append(f"Ya hiciste {MAX_MOVES_PER_DAY} cambios hoy. Mañana puedes hacer más.")
    if _monday(new_date) != _monday(shift["date"]):
        errs.append("El cambio debe quedar dentro de la misma semana.")
    a = _m(new_start)
    b = a + _dur(shift)
    if new_date == shift["date"] and a == _m(shift["start"]):
        errs.append("Elegiste el mismo horario que ya tienes.")
    if _starts_at(new_date, a) <= now:
        errs.append("El nuevo horario ya pasó.")
    errs += _slot_problems(shift["name"], new_date, a, b, shifts=week_shifts, availability=availability,
                           time_off=time_off, ignore_ids=(shift["id"],))
    return errs


def validate_swap(a_shift: dict, b_shift: dict, *, all_shifts: List[dict], availability: dict, time_off: List[dict],
                  now: datetime) -> List[str]:
    """¿Pueden A y B intercambiar estas dos franjas (A queda con la de B y B con la de A)?"""
    errs: List[str] = []
    if a_shift["name"].lower() == b_shift["name"].lower():
        return ["No puedes intercambiar contigo misma."]
    if a_shift["type"] != b_shift["type"]:
        errs.append("Solo se intercambian franjas de la misma clase (entrevistas con entrevistas, matches con matches).")
    if _dur(a_shift) != _dur(b_shift):
        errs.append("Las dos franjas deben durar lo mismo para que las horas de cada una no cambien.")
    if _monday(a_shift["date"]) != _monday(b_shift["date"]):
        errs.append("El intercambio debe ser dentro de la misma semana.")
    for s in (a_shift, b_shift):
        if _starts_at(s["date"], _m(s["start"])) <= now:
            errs.append("Una de las franjas ya empezó o ya pasó.")
            break
    ign = (a_shift["id"], b_shift["id"])
    # A pasa a la franja de B y B a la de A
    errs += _slot_problems(a_shift["name"], b_shift["date"], _m(b_shift["start"]), _m(b_shift["end"]),
                           shifts=all_shifts, availability=availability, time_off=time_off, ignore_ids=ign)
    errs += _slot_problems(b_shift["name"], a_shift["date"], _m(a_shift["start"]), _m(a_shift["end"]),
                           shifts=all_shifts, availability=availability, time_off=time_off, ignore_ids=ign)
    # sin duplicar el mismo mensaje
    seen, out = set(), []
    for e in errs:
        if e not in seen:
            seen.add(e); out.append(e)
    return out


def apply_swap(shifts: List[dict], a_id: int, b_id: int) -> List[dict]:
    """Devuelve una copia con los nombres de las dos franjas intercambiados (la hora de cada franja no cambia)."""
    out = [dict(s) for s in shifts]
    a = next(s for s in out if s["id"] == a_id)
    b = next(s for s in out if s["id"] == b_id)
    a["name"], b["name"] = b["name"], a["name"]
    return out


def apply_move(shifts: List[dict], shift_id: int, new_date: date, new_start: time) -> List[dict]:
    """Devuelve una copia con la franja movida (misma duración)."""
    out = [dict(s) for s in shifts]
    s = next(x for x in out if x["id"] == shift_id)
    dur = _dur(s)
    a = _m(new_start)
    s["date"] = new_date
    s["start"] = time(a // 60, a % 60)
    s["end"] = time((a + dur) // 60, (a + dur) % 60)
    return out
