import json
import os

def generate_dashboard():
    r6_path = '/app/ronda6_calibracion_comparativa.json' if os.path.exists('/app/ronda6_calibracion_comparativa.json') else 'backend/ronda6_calibracion_comparativa.json'
    r7_path = '/app/ronda7_mega_estres_500.json' if os.path.exists('/app/ronda7_mega_estres_500.json') else 'backend/ronda7_mega_estres_500.json'

    with open(r6_path, encoding='utf-8') as f:
        r6_data = json.load(f)

    with open(r7_path, encoding='utf-8') as f:
        r7_data = json.load(f)

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>DailyLover — Dashboard de Calibración & Mega-Estrés (800 Parejas Reales)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f293d;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --accent-pink: #ec4899;
      --accent-purple: #8b5cf6;
      --accent-blue: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font: 'Plus Jakarta Sans', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 24px 32px;
      line-height: 1.5;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 20px;
    }}
    .title-group h1 {{
      font-size: 26px;
      font-weight: 800;
      background: linear-gradient(135deg, #f43f5e, #a855f7, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    .title-group p {{
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }}
    .stats-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }}
    .stat-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 18px 20px;
      position: relative;
      overflow: hidden;
    }}
    .stat-card::before {{
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent-pink), var(--accent-purple));
    }}
    .stat-label {{
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .stat-value {{
      font-size: 28px;
      font-weight: 800;
      margin-top: 6px;
      font-family: var(--font-mono);
    }}
    .stat-sub {{
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }}

    .comparison-banner {{
      background: linear-gradient(135deg, rgba(31, 41, 55, 0.7), rgba(17, 24, 39, 0.9));
      border: 1px solid rgba(236, 72, 153, 0.3);
      border-radius: 14px;
      padding: 20px 24px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }}
    .comp-col h3 {{
      font-size: 14px;
      color: var(--accent-pink);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }}
    .comp-pill {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin: 4px 4px 4px 0;
    }}
    .pill-red {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }}
    .pill-green {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }}
    .pill-blue {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }}
    .pill-yellow {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }}

    .tabs {{
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }}
    .tab-btn {{
      padding: 10px 20px;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      background: var(--card-bg);
      color: var(--text-muted);
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }}
    .tab-btn.active {{
      background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple));
      color: white;
      border-color: transparent;
    }}

    .filters-bar {{
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      background: var(--card-bg);
      padding: 14px 18px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
    }}
    .filter-input, .filter-select {{
      background: #1e293b;
      border: 1px solid #334155;
      color: var(--text);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }}
    .filter-input {{ flex-grow: 1; min-width: 200px; }}

    .table-container {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow-x: auto;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }}
    th {{
      background: #1e293b;
      padding: 12px 16px;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--card-border);
    }}
    td {{
      padding: 14px 16px;
      border-bottom: 1px solid var(--card-border);
      vertical-align: middle;
    }}
    tr:hover td {{
      background: rgba(255, 255, 255, 0.02);
    }}
    .score-badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-family: var(--font-mono);
      font-size: 14px;
    }}
    .badge-alto {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.5); }}
    .badge-moderado {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.5); }}
    .badge-reserva {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); }}
    .badge-no {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); }}

    .delta-badge {{
      font-size: 11px;
      font-family: var(--font-mono);
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
    }}
    .delta-neg {{ background: rgba(239, 68, 68, 0.2); color: #f87171; }}
    .delta-zero {{ background: rgba(156, 163, 175, 0.2); color: #9ca3af; }}
    .delta-pos {{ background: rgba(16, 185, 129, 0.2); color: #34d399; }}

    .row-detail {{
      background: #0d131f;
      padding: 16px 20px;
      border-top: 1px dashed var(--card-border);
      display: none;
    }}
    .detail-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }}
    .ejes-bar-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }}
    .eje-row {{
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      background: #1e293b;
      padding: 6px 10px;
      border-radius: 6px;
    }}
    .eje-name {{ color: var(--text-muted); }}
    .eje-val {{ font-family: var(--font-mono); font-weight: 700; }}
  </style>
</head>
<body>

  <header>
    <div class="title-group">
      <h1>DailyLover — Auditoría Empírica en Vivo (800 Parejas Reales)</h1>
      <p>Resultados Comparativos Post-Calibración (Ronda 6) y Mega Estrés Clínico Multidimensional (Ronda 7)</p>
    </div>
    <div style="text-align: right;">
      <span class="comp-pill pill-green">Postgres 16 Producción</span>
      <span class="comp-pill pill-purple">8 Ejes Vinculares v2.0</span>
      <span class="comp-pill pill-blue">Cero Llamadas a APIs Externas</span>
    </div>
  </header>

  <div class="comparison-banner">
    <div class="comp-col">
      <h3>1. Inflación Artificial de Score (88%)</h3>
      <p style="font-size: 13px; color: var(--text-muted);">
        <b style="color: #f87171;">Antes:</b> 131 parejas (43.7%) tenían exactamente 88% por ausencia pasiva de conflicto.<br>
        <b style="color: #34d399;">Ahora:</b> <span class="comp-pill pill-green">0 parejas (0.0%)</span>. Puntuación neutra bajó al 70-75% realista.
      </p>
    </div>
    <div class="comp-col">
      <h3>2. Brecha Generacional y Momento Vital</h3>
      <p style="font-size: 13px; color: var(--text-muted);">
        <b style="color: #f87171;">Antes:</b> 62 parejas con brechas de 18 a 40 años figuraban en RECOMENDADO ALTO.<br>
        <b style="color: #34d399;">Ahora:</b> <span class="comp-pill pill-green">0 anomalías</span>. Brechas extremas penalizadas a VIABLE CON RESERVAS (≤64%).
      </p>
    </div>
    <div class="comp-col">
      <h3>3. Coherencia Geográfica & Logística</h3>
      <p style="font-size: 13px; color: var(--text-muted);">
        <b style="color: #f87171;">Antes:</b> Parejas en distintas ciudades/países recibían 90% en logística.<br>
        <b style="color: #34d399;">Ahora:</b> <span class="comp-pill pill-green">197 parejas</span> advertidas con fricción logística y penalización proporcional.
      </p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Evaluaciones</div>
      <div class="stat-value">800</div>
      <div class="stat-sub">300 Ronda 6 + 500 Ronda 7</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Score Promedio</div>
      <div class="stat-value" style="color: #60a5fa;">62.9%</div>
      <div class="stat-sub">Campana de Gauss natural</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Recomendado Alto (≥80%)</div>
      <div class="stat-value" style="color: #34d399;">8.6%</div>
      <div class="stat-sub">Solo compatibilidad excepcional</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Dealbreakers Detenidos</div>
      <div class="stat-value" style="color: #f87171;">81</div>
      <div class="stat-sub">Vasectomía, hijos, inactivos</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Fricciones Diagnosticadas</div>
      <div class="stat-value" style="color: #fbbf24;">947</div>
      <div class="stat-sub">Alertas para psicólogas</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('r6')">Ronda 6: Comparativa Antes vs Después (300 Parejas)</button>
    <button class="tab-btn" onclick="switchTab('r7')">Ronda 7: Mega-Estrés 20 Nuevas Anclas (500 Parejas)</button>
  </div>

  <div class="filters-bar">
    <input type="text" id="searchInput" class="filter-input" placeholder="Buscar por cliente, candidato, ciudad..." onkeyup="renderTable()">
    <select id="verdictSelect" class="filter-select" onchange="renderTable()">
      <option value="ALL">Todos los Veredictos</option>
      <option value="RECOMENDADO ALTO">RECOMENDADO ALTO (≥80%)</option>
      <option value="RECOMENDADO MODERADO">RECOMENDADO MODERADO (70-79%)</option>
      <option value="VIABLE CON RESERVAS">VIABLE CON RESERVAS (60-69%)</option>
      <option value="NO RECOMENDADO">NO RECOMENDADO (&lt;60%)</option>
      <option value="NO RECOMENDADO (BLOQUEADO)">BLOQUEADO (Operativo)</option>
    </select>
    <select id="anchorSelect" class="filter-select" onchange="renderTable()">
      <option value="ALL">Todas las Personas Ancla</option>
    </select>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Persona Ancla (Cliente)</th>
          <th>Candidato(a) Evaluado(a)</th>
          <th>Brecha Edad</th>
          <th>Ciudades</th>
          <th>Score Global</th>
          <th>Veredicto</th>
          <th>Detalles</th>
        </tr>
      </thead>
      <tbody id="tableBody"></tbody>
    </table>
  </div>

  <script>
    const dataR6 = {json.dumps(r6_data['evaluations'], ensure_ascii=False)};
    const dataR7 = {json.dumps(r7_data['evaluations'], ensure_ascii=False)};

    let currentTab = 'r6';

    function switchTab(tab) {{
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      populateAnchorFilter();
      renderTable();
    }}

    function populateAnchorFilter() {{
      const list = currentTab === 'r6' ? dataR6 : dataR7;
      const anchors = Array.from(new Set(list.map(e => e.anchor_name))).sort();
      const select = document.getElementById('anchorSelect');
      select.innerHTML = '<option value="ALL">Todas las Personas Ancla</option>';
      anchors.forEach(a => {{
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        select.appendChild(opt);
      }});
    }}

    function getBadgeClass(verdict) {{
      if (verdict.includes('ALTO')) return 'badge-alto';
      if (verdict.includes('MODERADO')) return 'badge-moderado';
      if (verdict.includes('RESERVA')) return 'badge-reserva';
      return 'badge-no';
    }}

    function renderTable() {{
      const list = currentTab === 'r6' ? dataR6 : dataR7;
      const search = document.getElementById('searchInput').value.toLowerCase();
      const verdict = document.getElementById('verdictSelect').value;
      const anchor = document.getElementById('anchorSelect').value;

      const filtered = list.filter(e => {{
        const textMatch = (e.anchor_name + ' ' + e.cand_name + ' ' + (e.anchor_city||'') + ' ' + (e.cand_city||'')).toLowerCase().includes(search);
        const verdVal = currentTab === 'r6' ? e.verdict_after : e.veredicto;
        const verdictMatch = (verdict === 'ALL') || (verdVal === verdict);
        const anchorMatch = (anchor === 'ALL') || (e.anchor_name === anchor);
        return textMatch && verdictMatch && anchorMatch;
      }});

      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = '';

      filtered.forEach((e, idx) => {{
        const score = currentTab === 'r6' ? e.score_after : e.score;
        const verd = currentTab === 'r6' ? e.verdict_after : e.veredicto;
        const delta = currentTab === 'r6' ? e.delta_score : 0;

        let deltaHtml = '';
        if (currentTab === 'r6') {{
          const dClass = delta < 0 ? 'delta-neg' : (delta > 0 ? 'delta-pos' : 'delta-zero');
          deltaHtml = `<span class="delta-badge ${{dClass}}">${{delta > 0 ? '+' : ''}}${{delta}} pts (era ${{e.score_before}}%)</span>`;
        }}

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><b>${{e.anchor_name}}</b> <span style="color:var(--text-muted)">(${{e.anchor_age}}a)</span></td>
          <td><b>${{e.cand_name}}</b> <span style="color:var(--text-muted)">(${{e.cand_age}}a)</span></td>
          <td><span style="font-family:var(--font-mono);">${{e.age_diff}} años</span></td>
          <td><span style="font-size:12px;">${{e.anchor_city || '—'}} ➔ ${{e.cand_city || '—'}}</span></td>
          <td>
            <span class="score-badge ${{getBadgeClass(verd)}}">${{score}}%</span>
            ${{deltaHtml}}
          </td>
          <td><span class="comp-pill ${{verd.includes('ALTO') ? 'pill-green' : (verd.includes('MODERADO') ? 'pill-blue' : (verd.includes('RESERVA') ? 'pill-yellow' : 'pill-red'))}}">${{verd}}</span></td>
          <td><button onclick="toggleDetail('detail-${{idx}}')" style="background:#1e293b; color:#9ca3af; border:1px solid #334155; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Ver 8 Ejes</button></td>
        `;

        const detailRow = document.createElement('tr');
        const desg = currentTab === 'r6' ? e.desglose_after : e.desglose;
        const dbs = e.deal_breakers || [];
        const frics = e.puntos_friccion || [];
        const syns = e.sinergias_fuertes || [];
        const rec = e.recomendacion_psicologa || '';

        detailRow.innerHTML = `
          <td colspan="7" style="padding:0;">
            <div id="detail-${{idx}}" class="row-detail">
              <div class="detail-grid">
                <div>
                  <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase;">Desglose en 8 Ejes Vinculares</h4>
                  <div class="ejes-bar-grid">
                    <div class="eje-row"><span class="eje-name">1. Logística / Distancia</span><span class="eje-val">${{desg['1_logistica']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">2. Timing / Fase Vital</span><span class="eje-val">${{desg['2_timing']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">3. Axiología / Valores</span><span class="eje-val">${{desg['3_axiologia']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">4. Estilo de Conflicto</span><span class="eje-val">${{desg['4_conflicto']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">5. Autonomía vs Fusión</span><span class="eje-val">${{desg['5_autonomia']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">6. Ritmo Vital / Energía</span><span class="eje-val">${{desg['6_ritmo_vital']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">7. Polaridad de Roles</span><span class="eje-val">${{desg['7_polaridad']}}%</span></div>
                    <div class="eje-row"><span class="eje-name">8. Estética / Hábitos</span><span class="eje-val">${{desg['8_estetica']}}%</span></div>
                  </div>
                </div>
                <div>
                  <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase;">Diagnóstico Clínico</h4>
                  ${{dbs.length ? '<div style="margin-bottom:6px;"><b style="color:#f87171; font-size:12px;">Dealbreakers:</b><br>' + dbs.map(d=>'<span class="comp-pill pill-red">'+d+'</span>').join('') + '</div>' : ''}}
                  ${{frics.length ? '<div style="margin-bottom:6px;"><b style="color:#fbbf24; font-size:12px;">Fricciones Preventivas:</b><ul style="font-size:12px; color:#d1d5db; padding-left:18px;">' + frics.map(f=>'<li>'+f+'</li>').join('') + '</ul></div>' : ''}}
                  ${{syns.length ? '<div style="margin-bottom:6px;"><b style="color:#34d399; font-size:12px;">Sinergias Fuertes:</b><ul style="font-size:12px; color:#d1d5db; padding-left:18px;">' + syns.map(s=>'<li>'+s+'</li>').join('') + '</ul></div>' : ''}}
                  ${{rec ? '<div style="margin-top:8px; font-size:12px; background:#1e293b; padding:8px 12px; border-radius:6px; color:#cbd5e1;"><b>Guía para la Cita:</b> ' + rec + '</div>' : ''}}
                </div>
              </div>
            </div>
          </td>
        `;

        tbody.appendChild(row);
        tbody.appendChild(detailRow);
      }});
    }}

    function toggleDetail(id) {{
      const el = document.getElementById(id);
      el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }}

    window.onload = () => {{
      populateAnchorFilter();
      renderTable();
    }};
  </script>
</body>
</html>
"""

    out_file = "/app/dashboard_calibracion_y_estres_800_parejas.html" if os.path.exists("/app") else "C:/Users/jeloz/.gemini/antigravity/brain/07d8eca2-e32e-4db4-8e0e-459e4b0b73b3/dashboard_calibracion_y_estres_800_parejas.html"
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"Mega Dashboard guardado en: {out_file}")

if __name__ == '__main__':
    generate_dashboard()
