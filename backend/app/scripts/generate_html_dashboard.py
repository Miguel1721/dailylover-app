import json
import os

def create_dashboard():
    json_path = 'backend/ronda5_full_120_evaluations.json'
    if not os.path.exists(json_path):
        json_path = '/app/ronda5_full_120_evaluations.json'
        
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    output_html_path = "ronda5_evaluaciones_120_dashboard.html"

    data_json_str = json.dumps(data, ensure_ascii=False)

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ronda 5: Dashboard de 120 Evaluaciones Empíricas (Motor Octagonal)</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }}
    .score-badge {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      border-radius: 9999px;
      padding: 0.25rem 0.75rem;
      font-size: 0.875rem;
    }}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4 sm:p-6 antialiased">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- HEADER -->
    <header class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="bg-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-rose-500/30">Motor Clínico 8 Ejes</span>
          <span class="text-xs text-slate-400">DailyLover Octagonal Engine v2.0</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Ronda 5: Auditoría Empírica de 120 Parejas</h1>
        <p class="text-sm text-slate-400 mt-1">Evaluaciones clínicas cruzadas de 6 Clientes Ancla vs Candidatos reales en PostgreSQL.</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div class="text-2xl font-black text-rose-400">{data['total_evaluaciones']}</div>
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Parejas</div>
        </div>
        <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div class="text-2xl font-black text-emerald-400">{data['verdict_counts'].get('RECOMENDADO ALTO', 0)}</div>
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Altos</div>
        </div>
        <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div class="text-2xl font-black text-amber-400">{data['verdict_counts'].get('VIABLE CON RESERVAS', 0)}</div>
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Con Reservas</div>
        </div>
        <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div class="text-2xl font-black text-red-500">{data['verdict_counts'].get('NO RECOMENDADO', 0)}</div>
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Bloqueados</div>
        </div>
      </div>
    </header>

    <!-- CLIENT SELECTOR TABS -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" id="clientTabs">
      <!-- Tabs injected by JS -->
    </div>

    <!-- ACTIVE CLIENT SUMMARY CARD -->
    <div id="activeClientSummary" class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
      <!-- Content injected by JS -->
    </div>

    <!-- CONTROLS & FILTER -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800/80 rounded-xl p-3 px-4">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-slate-400 font-medium">Filtrar por Veredicto:</span>
        <select id="verdictFilter" class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-rose-500 focus:outline-none">
          <option value="ALL">Todos los Veredictos (20)</option>
          <option value="RECOMENDADO ALTO">🟢 Recomendado Alto (Score ≥ 80%)</option>
          <option value="VIABLE CON RESERVAS">🟡 Viable con Reservas (Score 50-79%)</option>
          <option value="NO RECOMENDADO">🔴 No Recomendado / Bloqueado (Score < 50%)</option>
        </select>
      </div>

      <div class="text-xs text-slate-400 font-medium" id="matchCounter">
        Mostrando 20 candidatas/os
      </div>
    </div>

    <!-- EVALUATION CARDS LIST -->
    <div class="space-y-4" id="evaluationsContainer">
      <!-- Injected by JS -->
    </div>

  </div>

  <script>
    const reportData = {data_json_str};
    let currentClientIndex = 0;

    function renderTabs() {{
      const tabsContainer = document.getElementById('clientTabs');
      tabsContainer.innerHTML = '';

      reportData.clientes.forEach((c, idx) => {{
        const btn = document.createElement('button');
        const isActive = idx === currentClientIndex;
        btn.className = `px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-200 border flex items-center gap-2 ${{
          isActive 
            ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-900/40 ring-2 ring-rose-400/20' 
            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
        }}`;
        btn.innerHTML = `
          <span>${{c.cliente_nombre}}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full ${{isActive ? 'bg-rose-700 text-rose-100' : 'bg-slate-800 text-slate-400'}}">${{c.cliente_edad}}a</span>
        `;
        btn.onclick = () => {{
          currentClientIndex = idx;
          renderAll();
        }};
        tabsContainer.appendChild(btn);
      }});
    }}

    function renderClientSummary() {{
      const c = reportData.clientes[currentClientIndex];
      const container = document.getElementById('activeClientSummary');
      const p = c.perfil_resumen;

      container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-white">${{c.cliente_nombre}}</h2>
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">UID ${{c.cliente_id}}</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">${{c.cliente_edad}} años</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">${{c.cliente_ciudad}}</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">${{c.cliente_genero}}</span>
            </div>
            <p class="text-xs text-slate-400 mt-1">Perfil clínico destilado en 8 dimensiones clave para calibrar compatibilidad con el pool.</p>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1 text-xs">
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-semibold">1. Logística</div>
            <div class="text-slate-200 font-medium truncate mt-0.5" title="${{p.logistica}}">${{p.logistica}}</div>
          </div>
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-semibold">2. Timing</div>
            <div class="text-slate-200 font-medium truncate mt-0.5" title="${{p.timing}}">${{p.timing}}</div>
          </div>
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-semibold">3. Vasectomía / Hijos</div>
            <div class="text-slate-200 font-medium truncate mt-0.5">${{p.vasectomia ? '✂️ Vasectomía Sí' : 'Vasectomía No'}} | ${{p.hijos ? 'Con Hijos' : 'Sin Hijos'}}</div>
          </div>
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-semibold">4. Conflicto</div>
            <div class="text-slate-200 font-medium truncate mt-0.5" title="${{p.conflicto}}">${{p.conflicto}}</div>
          </div>
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-semibold">6. Ritmo Vital</div>
            <div class="text-slate-200 font-medium truncate mt-0.5" title="${{p.ritmo_vital}}">${{p.ritmo_vital}}</div>
          </div>
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <div class="text-[10px] text-slate-400 uppercase font-semibold">7. Polaridad</div>
            <div class="text-slate-200 font-medium truncate mt-0.5" title="${{p.polaridad}}">${{p.polaridad}}</div>
          </div>
        </div>
      `;
    }}

    function renderEvaluations() {{
      const c = reportData.clientes[currentClientIndex];
      const container = document.getElementById('evaluationsContainer');
      const filter = document.getElementById('verdictFilter').value;

      let evals = c.evaluaciones;
      if (filter !== 'ALL') {{
        evals = evals.filter(e => e.veredicto === filter);
      }}

      document.getElementById('matchCounter').innerText = `Mostrando ${{evals.length}} de ${{c.evaluaciones.length}} candidatos`;

      if (evals.length === 0) {{
        container.innerHTML = `
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
            No se encontraron candidatos con el filtro seleccionado para este cliente.
          </div>
        `;
        return;
      }}

      container.innerHTML = evals.map((e, idx) => {{
        const isAlto = e.veredicto === 'RECOMENDADO ALTO';
        const isReserva = e.veredicto === 'VIABLE CON RESERVAS';
        const isBloqueado = e.veredicto.includes('NO RECOMENDADO');

        const scoreColor = isAlto 
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
          : isReserva 
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
            : 'bg-red-500/15 text-red-400 border border-red-500/30';

        const cardBorder = isAlto 
          ? 'border-slate-800 hover:border-emerald-500/40' 
          : isReserva 
            ? 'border-amber-900/40 hover:border-amber-500/40' 
            : 'border-red-950/60 hover:border-red-500/40 bg-red-950/10';

        const ejes = e.desglose_8_ejes || {{}};

        return `
          <div class="bg-slate-900/80 border ${{cardBorder}} rounded-2xl p-5 shadow-md transition-all duration-200 space-y-4">
            
            <!-- HEADER EVALUACION -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div class="flex items-center gap-3">
                <span class="text-sm font-bold text-slate-500 w-6">#${{idx+1}}</span>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-base font-bold text-white">${{e.candidato_nombre}}</h3>
                    <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">${{e.candidato_edad}}a</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">${{e.candidato_ciudad || 'Sin ciudad'}}</span>
                    <span class="text-[11px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">UID ${{e.candidato_id}}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span class="score-badge ${{scoreColor}}">
                  ${{e.veredicto}} · ${{e.score_global}}%
                </span>
              </div>
            </div>

            <!-- DESGLOSE DE 8 EJES (GRID BAR) -->
            <div class="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Desglose de los 8 Ejes Clínicos:</div>
              <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-xs">
                ${{renderEjeCell('Logística', ejes['1_logistica'])}}
                ${{renderEjeCell('Timing', ejes['2_timing'])}}
                ${{renderEjeCell('Axiología', ejes['3_axiologia'])}}
                ${{renderEjeCell('Conflicto', ejes['4_conflicto'])}}
                ${{renderEjeCell('Autonomía', ejes['5_autonomia'])}}
                ${{renderEjeCell('Ritmo Vital', ejes['6_ritmo_vital'])}}
                ${{renderEjeCell('Polaridad', ejes['7_polaridad'])}}
                ${{renderEjeCell('Estética', ejes['8_estetica'])}}
              </div>
            </div>

            <!-- ALERTAS Y HALLAZGOS (DEALBREAKERS, FRICCIONES, SINERGIAS) -->
            <div class="space-y-2 text-xs">
              ${{e.deal_breakers && e.deal_breakers.length > 0 ? `
                <div class="bg-red-950/40 border border-red-800/40 rounded-xl p-2.5 text-red-200">
                  <div class="font-bold text-red-400 flex items-center gap-1.5 mb-1">
                    <span>🛑 Incompatibilidad Bloqueante (Dealbreaker):</span>
                  </div>
                  <ul class="list-disc list-inside space-y-0.5">
                    ${{e.deal_breakers.map(d => `<li>${{d}}</li>`).join('')}}
                  </ul>
                </div>
              ` : ''}}

              ${{e.puntos_friccion && e.puntos_friccion.length > 0 ? `
                <div class="bg-amber-950/30 border border-amber-800/40 rounded-xl p-2.5 text-amber-200">
                  <div class="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                    <span>⚠️ Zonas de Fricción Preventiva:</span>
                  </div>
                  <ul class="list-disc list-inside space-y-0.5">
                    ${{e.puntos_friccion.map(f => `<li>${{f}}</li>`).join('')}}
                  </ul>
                </div>
              ` : ''}}

              ${{e.sinergias_fuertes && e.sinergias_fuertes.length > 0 ? `
                <div class="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-2.5 text-emerald-200">
                  <div class="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                    <span>✨ Sinergias Detectadas:</span>
                  </div>
                  <ul class="list-disc list-inside space-y-0.5">
                    ${{e.sinergias_fuertes.map(s => `<li>${{s}}</li>`).join('')}}
                  </ul>
                </div>
              ` : ''}}
            </div>

            <!-- CONSEJO CLINICO PARA LA PSICOLOGA -->
            <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
              <span class="text-rose-400 font-bold text-sm leading-none">💡</span>
              <div>
                <span class="font-bold text-slate-200">Recomendación para la Psicóloga:</span>
                <span class="text-slate-300 ml-1">${{e.recomendacion_psicologa}}</span>
              </div>
            </div>

          </div>
        `;
      }}).join('');
    }}

    function renderEjeCell(nombre, score) {{
      const sc = score !== undefined ? score : '-';
      let colorClass = 'text-slate-400';
      let barBg = 'bg-slate-800';

      if (sc !== '-') {{
        if (sc >= 80) {{ colorClass = 'text-emerald-400'; barBg = 'bg-emerald-500'; }}
        else if (sc >= 60) {{ colorClass = 'text-amber-400'; barBg = 'bg-amber-500'; }}
        else {{ colorClass = 'text-rose-400'; barBg = 'bg-rose-500'; }}
      }}

      return `
        <div class="bg-slate-900 border border-slate-800/60 rounded-lg p-2 flex flex-col justify-between">
          <div class="text-[10px] text-slate-400 font-medium truncate" title="${{nombre}}">${{nombre}}</div>
          <div class="text-sm font-bold ${{colorClass}} my-1">${{sc}}%</div>
          <div class="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div class="${{barBg}} h-full" style="width: ${{sc !== '-' ? sc : 0}}%"></div>
          </div>
        </div>
      `;
    }}

    function renderAll() {{
      renderTabs();
      renderClientSummary();
      renderEvaluations();
    }}

    document.getElementById('verdictFilter').addEventListener('change', renderEvaluations);
    renderAll();
  </script>
</body>
</html>
"""

    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"✓ Dashboard HTML interactivo creado con éxito en:\n  {output_html_path}")

if __name__ == '__main__':
    create_dashboard()
