"""
PDF Generation Service for Daily Lover Admin Panel
Uses fpdf2 (pure Python, no OS dependencies)

NOTE: Uses Helvetica core font (Latin-1 safe).
All text must be ASCII/Latin-1. No emojis or special Unicode symbols.
"""
from fpdf import FPDF
from datetime import datetime
from typing import List, Dict, Any, Optional

# ─── Brand Colors (RGB) ──────────────────────────────────────────────────────
BRAND_PRIMARY = (220, 20, 80)       # #DC1450 — Daily Lover magenta-red
TEXT_DARK     = (40, 20, 50)
TEXT_MUTED    = (120, 100, 130)
WHITE         = (255, 255, 255)
LIGHT_GRAY    = (245, 240, 248)
BRAND_LIGHT   = (255, 235, 245)
BORDER_COLOR  = (220, 200, 230)


def fmt_cop(amount: float) -> str:
    """Format number as Colombian Peso (ASCII safe)."""
    try:
        # Build manually to avoid locale issues inside container
        n = int(round(amount))
        s = f"{n:,}".replace(",", ".")
        return f"$ {s} COP"
    except Exception:
        return "$ - COP"


def safe(text: str) -> str:
    """Convert a string to Latin-1 safe version for fpdf2 Helvetica font.
    Replaces common Spanish/special chars that are Latin-1 safe,
    and strips anything outside cp1252 range."""
    if not text:
        return ""
    # Ensure it's a string
    text = str(text)
    # Encode to latin-1, replacing unencodable chars with '?'
    return text.encode("latin-1", errors="replace").decode("latin-1")


class DailyLoverPDF(FPDF):
    """Base PDF class with Daily Lover branding."""

    def __init__(self, title: str = "Reporte Daily Lover"):
        super().__init__()
        self.report_title = title
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(15, 15, 15)

    def header(self):
        """Draw branded header on every page."""
        self.set_fill_color(*BRAND_PRIMARY)
        self.rect(0, 0, 210, 18, style="F")

        self.set_y(4)
        self.set_x(8)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*WHITE)
        self.cell(60, 8, "Daily Lover", ln=False)

        self.set_font("Helvetica", "", 10)
        self.set_x(60)
        self.cell(90, 8, safe(self.report_title), align="C", ln=False)

        self.set_x(150)
        self.set_font("Helvetica", "I", 8)
        self.cell(50, 8, f"Pag. {self.page_no()}", align="R")

        self.set_text_color(*TEXT_DARK)
        self.ln(12)

    def footer(self):
        """Draw branded footer on every page."""
        self.set_y(-14)
        self.set_draw_color(*BRAND_PRIMARY)
        self.set_line_width(0.4)
        self.line(15, self.get_y(), 195, self.get_y())

        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*TEXT_MUTED)
        self.set_x(15)
        generated = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(100, 6, safe(f"Generado el {generated}  |  Sistema Admin Daily Lover"), ln=False)
        self.set_x(115)
        self.cell(80, 6, safe("Confidencial - Solo uso interno"), align="R")

    def section_title(self, title: str):
        """Draw a styled section heading (ASCII/Latin-1 safe)."""
        self.ln(3)
        self.set_fill_color(*BRAND_LIGHT)
        self.set_draw_color(*BRAND_PRIMARY)
        self.set_line_width(0.3)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*BRAND_PRIMARY)
        self.cell(0, 8, safe(f"  {title}"), ln=True, fill=True, border="LB")
        self.set_text_color(*TEXT_DARK)
        self.ln(2)

    def kpi_row(self, items: List[tuple]):
        """Draw a row of KPI boxes. items = [(label, value), ...] max 4."""
        n = len(items)
        box_w = 180 / n
        y_start = self.get_y()

        for label, value in items:
            x = self.get_x()
            y = self.get_y()
            self.set_fill_color(*LIGHT_GRAY)
            self.set_draw_color(*BORDER_COLOR)
            self.rect(x, y, box_w - 2, 22, style="FD")

            self.set_xy(x + 2, y + 2)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*TEXT_MUTED)
            self.cell(box_w - 4, 5, safe(label), ln=True)

            self.set_xy(x + 2, y + 8)
            self.set_font("Helvetica", "B", 10)
            self.set_text_color(*BRAND_PRIMARY)
            self.cell(box_w - 4, 10, safe(str(value)), ln=False)

            self.set_xy(x + box_w, y)

        self.set_xy(15, y_start + 24)
        self.set_text_color(*TEXT_DARK)

    def table_header(self, cols: List[tuple]):
        """Draw styled table header. cols = [(label, width), ...]"""
        self.set_fill_color(*BRAND_PRIMARY)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 8)
        for label, w in cols:
            self.cell(w, 7, safe(label), border=0, fill=True, align="C")
        self.ln()
        self.set_text_color(*TEXT_DARK)

    def table_row(self, data: List[tuple], cols: List[tuple], bg_alt: bool = False):
        """Draw a styled table row. data = [(value, align), ...]"""
        self.set_font("Helvetica", "", 8)
        if bg_alt:
            self.set_fill_color(*LIGHT_GRAY)
        else:
            self.set_fill_color(*WHITE)
        for (val, align), (label, w) in zip(data, cols):
            self.cell(w, 6, safe(str(val)), border=0, fill=True, align=align)
        self.ln()


# ────────────────────────────────────────────────────────────────────────────
# PDF BUILDERS
# ────────────────────────────────────────────────────────────────────────────

def build_payroll_pdf(run: dict, employees: List[dict]) -> bytes:
    """Generate a payroll run PDF report."""
    period = f"{run.get('period_month', '?'):02d}/{run.get('period_year', '?')}"
    pdf = DailyLoverPDF(title=f"Nomina {period}")
    pdf.add_page()

    pdf.section_title("Resumen de Nomina")
    total_base = sum(float(e.get("base_salary", 0)) for e in employees)
    total_commissions = sum(float(e.get("commissions", 0)) for e in employees)
    total_paid = float(run.get("total_paid", total_base + total_commissions))

    pdf.kpi_row([
        ("Periodo", period),
        ("Empleados", str(len(employees))),
        ("Total Salarios Base", fmt_cop(total_base)),
        ("Total Comisiones", fmt_cop(total_commissions)),
    ])
    pdf.kpi_row([
        ("TOTAL NETO PAGADO", fmt_cop(total_paid)),
        ("Estado", str(run.get("status") or "borrador").capitalize()),
        ("Ejecutado por", str(run.get("executed_by_name") or "Sistema")[:20]),
        ("Fecha Ejecucion", str(run.get("executed_at", "Pendiente"))[:10]),
    ])
    pdf.ln(3)

    pdf.section_title("Detalle por Empleado")
    cols = [
        ("Nombre", 60), ("Cargo", 38), ("Salario Base", 34), ("Comisiones", 30), ("Total", 30)
    ]
    pdf.table_header(cols)
    for i, emp in enumerate(employees):
        base = float(emp.get("base_salary", 0))
        comm = float(emp.get("commissions", 0))
        total = base + comm
        pdf.table_row([
            (str(emp.get("full_name") or emp.get("name", "—"))[:28], "L"),
            (str(emp.get("position", "—"))[:20], "L"),
            (fmt_cop(base), "R"),
            (fmt_cop(comm), "R"),
            (fmt_cop(total), "R"),
        ], cols, bg_alt=(i % 2 == 1))

    # Totals row
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(*BRAND_LIGHT)
    pdf.cell(98, 7, "TOTALES", border=0, fill=True, align="L")
    pdf.cell(34, 7, fmt_cop(total_base), border=0, fill=True, align="R")
    pdf.cell(30, 7, fmt_cop(total_commissions), border=0, fill=True, align="R")
    pdf.cell(30, 7, fmt_cop(total_paid), border=0, fill=True, align="R")
    pdf.ln()

    return bytes(pdf.output())


def build_cashflow_pdf(monthly_summary: List[dict], current_balance: float, period_label: str = "") -> bytes:
    """Generate a cash flow summary PDF report."""
    title = f"Flujo de Caja {period_label}".strip()
    pdf = DailyLoverPDF(title=title)
    pdf.add_page()

    pdf.section_title("Balance Actual")
    total_income = sum(m.get("income", 0) for m in monthly_summary) if monthly_summary else 0.0
    total_expense = sum(m.get("expenses", 0) for m in monthly_summary) if monthly_summary else 0.0
    avg_net = (total_income - total_expense) / max(len(monthly_summary), 1) if monthly_summary else 0.0

    pdf.kpi_row([
        ("Saldo Actual", fmt_cop(current_balance)),
        ("Ingresos Historicos", fmt_cop(total_income)),
        ("Gastos Historicos", fmt_cop(total_expense)),
        ("Promedio Neto Mensual", fmt_cop(avg_net)),
    ])
    pdf.ln(3)

    pdf.section_title("Resumen Mensual")
    cols = [("Mes/Anio", 45), ("Ingresos", 45), ("Gastos", 45), ("Neto", 45)]
    pdf.table_header(cols)

    for i, row in enumerate(monthly_summary):
        month_label = f"{int(row.get('month', 0)):02d}/{int(row.get('year', 0))}"
        income = float(row.get("income", 0))
        expenses = float(row.get("expenses", 0))
        net = income - expenses
        pdf.table_row([
            (month_label, "C"),
            (fmt_cop(income), "R"),
            (fmt_cop(expenses), "R"),
            (fmt_cop(net), "R"),
        ], cols, bg_alt=(i % 2 == 1))

    return bytes(pdf.output())


def build_event_pdf(event: dict, attendees: List[dict], incidents: List[dict], budget_comparison: Optional[dict] = None) -> bytes:
    """Generate an event detail PDF report."""
    event_name = str(event.get("name", "Evento"))
    event_date = str(event.get("date", ""))[:10]
    pdf = DailyLoverPDF(title=f"{event_name[:30]} - {event_date}")
    pdf.add_page()

    pdf.section_title("Informacion del Evento")
    confirmed = sum(1 for a in attendees if a.get("status") in ("confirmed", "attended"))
    pdf.kpi_row([
        ("Nombre", event_name[:22]),
        ("Fecha", event_date),
        ("Formato", str(event.get("format", "—"))[:14]),
        ("Aforo / Confirmados", f"{confirmed}/{event.get('capacity', '?')}"),
    ])

    if budget_comparison:
        pdf.ln(3)
        pdf.section_title("Presupuesto vs. Real")
        bi = float(budget_comparison.get("budget_income", 0))
        be = float(budget_comparison.get("budget_expenses", 0))
        ri = float(budget_comparison.get("real_income", 0))
        re_ = float(budget_comparison.get("real_expenses", 0))
        pdf.kpi_row([
            ("Ingreso Presupuestado", fmt_cop(bi)),
            ("Ingreso Real", fmt_cop(ri)),
            ("Gasto Presupuestado", fmt_cop(be)),
            ("Gasto Real", fmt_cop(re_)),
        ])
        net_budget = bi - be
        net_real = ri - re_
        diff = net_real - net_budget
        diff_str = f"+{fmt_cop(diff)}" if diff >= 0 else fmt_cop(diff)
        verdict = str(budget_comparison.get("verdict", "")).replace("✓", "OK").replace("✗", "X").replace("≈", "~")
        pdf.set_font("Helvetica", "B", 9)
        color = (34, 197, 94) if diff >= 0 else (220, 38, 38)
        pdf.set_text_color(*color)
        pdf.cell(0, 6, safe(f"Varianza neta: {diff_str}  |  {verdict}"), ln=True)
        pdf.set_text_color(*TEXT_DARK)

    pdf.ln(3)
    pdf.section_title(f"Asistentes ({len(attendees)})")
    cols = [("Nombre", 80), ("Estado", 40), ("Tipo Ticket", 40), ("Satisfaccion", 32)]
    pdf.table_header(cols)
    for i, att in enumerate(attendees[:50]):
        pdf.table_row([
            (str(att.get("name", "—"))[:36], "L"),
            (str(att.get("status") or "—").capitalize(), "C"),
            (str(att.get("ticket_type", "—"))[:18], "C"),
            (str(att.get("satisfaccion") or "—"), "C"),
        ], cols, bg_alt=(i % 2 == 1))

    if len(attendees) > 50:
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(*TEXT_MUTED)
        pdf.cell(0, 5, safe(f"... y {len(attendees) - 50} asistentes mas (ver sistema para listado completo)"), ln=True)
        pdf.set_text_color(*TEXT_DARK)

    if incidents:
        pdf.ln(3)
        pdf.section_title(f"Incidencias ({len(incidents)})")
        cols_inc = [("Categoria", 35), ("Severidad", 25), ("Descripcion", 90), ("Resuelto", 22)]
        pdf.table_header(cols_inc)
        for i, inc in enumerate(incidents):
            resolved_label = "Si" if inc.get("resolved") else "No"
            pdf.table_row([
                (str(inc.get("category", "—"))[:16], "C"),
                (str(inc.get("severity", "—"))[:12], "C"),
                (str(inc.get("description") or "—")[:55], "L"),
                (resolved_label, "C"),
            ], cols_inc, bg_alt=(i % 2 == 1))

    return bytes(pdf.output())
