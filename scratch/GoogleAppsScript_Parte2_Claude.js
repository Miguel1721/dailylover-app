/**
 * ============================================================================
 * DAILY LOVER MATCHMAKING — PARTE 2 (CLAUDE): BLOQUEO, CRM AUTOCOMPLETE, COLORES
 * ============================================================================
 * Archivo: Copia final de Daily Lover MATCHMAKING
 * Se instala junto al script de Antigravity (Parte 1), como un trigger
 * instalable ADICIONAL — no reemplaza ni edita las funciones de ellos.
 *
 * INSTALACIÓN:
 * 1. Pega esto en un archivo NUEVO dentro del mismo proyecto de Apps Script
 *    (Extensiones > Apps Script > el ícono "+" al lado de "Archivos" > Script).
 * 2. Activadores → + Agregar activador:
 *    - Función: onEditClaude
 *    - Evento: Al editar
 *    - Fuente: De una hoja de cálculo
 * 3. Guardar y aceptar permisos (incluye acceso a URLs externas, para
 *    consultar el backend).
 * ============================================================================
 */

var CLAUDE_CONFIG = {
  PSYCHOLOGIST_SHEET_PREFIX: "MATCHES ",
  BACKEND_RESOLVE_URL: "https://prueba-daily.agentesia.cloud/api/v1/matchmaking/resolve-profile",
  LOCK_TIMEOUT_MS: 30000,
  MARIA_EMAIL: "agente.col.bot@gmail.com", // María (admin absoluto — el único que edita filas bloqueadas)
  STATUS_COLORS: {
    "APROBADO": "#B6D7A8",
    "HECHO": "#A2C4C9",
    "HECHO POR MAPE": "#A2C4C9",
    "LISTO PARA MATCH": "#FFE599",
    "TROUBLE": "#FF6B35",
    "TROUBLEMAKER": "#FF6B35",
    "DESCALIFICADO": "#CCCCCC",
    "REFUND": "#EA9999",
    "REFUND DONE": "#F9CB9C",
    "NOT APPROVED": "#F4CCCC",
    "REVISAR": "#D5A6BD",
    "REVISAR POR SI TOCA OTRO MATCH": "#D5A6BD",
    "NO HAY GENTE": "#E69138",
    "REQUEST PROFILE UPDATE": "#C9DAF8",
    "PENDIENTE": "#FFF2CC",
    "URGENTE": "#FF0000",
    "RESUELTO": "#D9EAD3"
  },
  PREF_COLORS: {
    "HETERO": "#CFE2F3",
    "GAY": "#FCE5CD",
    "LESB": "#D9D2E9",
    "BI": "#D9D9D9"
  },
  PLAN_COLORS: {
    "BÁSICO 40K": "#F3F3F3",
    "BASICO 40K": "#F3F3F3",
    "ESTÁNDAR 65K (2 CITAS)": "#D9EAD3",
    "ESTANDAR 65K (2 CITAS)": "#D9EAD3",
    "ESTÁNDAR 65K (1 CITA)": "#B6D7A8",
    "ESTANDAR 65K (1 CITA)": "#B6D7A8",
    "VIP 195K": "#FFE599"
  }
};

// ─── DISPARADOR PRINCIPAL (independiente del de Antigravity) ────────────────
function onEditClaude(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName().trim().toUpperCase();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row <= 1) return;

  if (sheetName.indexOf(CLAUDE_CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sheetName !== "MATCHES") {
    handleClaudePsychologistSheetEdit(sheet, row, col, e.value);
  } else if (sheetName === "PERSONAS DÍFICILES" || sheetName === "PERSONAS DIFICILES" || sheetName === "MATCHES QUE HACEN FALTA") {
    handleClaudePersonasDificilesEdit(sheet, row, col, e.value);
  }
}

function handleClaudePsychologistSheetEdit(sheet, row, col, newValue) {
  var headers = claudeGetSheetHeaders(sheet);
  var statusCol = headers["STATUS"];
  var personACol = headers["PERSON A"] || headers["PERSONA A"];
  var personBCol = headers["PERSON B"] || headers["PERSONA B"];
  var cityCol = headers["CITY"] || headers["CIUDAD"];
  var prefCol = headers["PREF"];
  var planCol = headers["PLAN"];

  // ── A. AUTOCOMPLETADO CRM: al editar Persona A o Persona B ──────────────
  if ((personACol && col === personACol) || (personBCol && col === personBCol)) {
    var isPersonA = (col === personACol);
    var pastedValue = (newValue || sheet.getRange(row, col).getValue() || "").toString().trim();
    if (pastedValue) {
      var profile = claudeResolveProfile(pastedValue);
      var personName = (profile && profile.found) ? profile.name : pastedValue;
      var cellRange = sheet.getRange(row, col);

      if (profile && profile.found) {
        // Reemplazar el texto plano por el nombre oficial, preservando el link nativo
        if (pastedValue.indexOf("http") === 0) {
          var richText = SpreadsheetApp.newRichTextValue()
            .setText(profile.name)
            .setLinkUrl(pastedValue)
            .build();
          cellRange.setRichTextValue(richText);
        } else if (profile.name) {
          cellRange.setValue(profile.name);
        }

        // Solo autocompletar CITY/PREF/PLAN si es Persona A (así se define el intake)
        if (isPersonA) {
          if (cityCol && !sheet.getRange(row, cityCol).getValue()) {
            sheet.getRange(row, cityCol).setValue(profile.city || "");
          }
          if (prefCol && !sheet.getRange(row, prefCol).getValue()) {
            sheet.getRange(row, prefCol).setValue(profile.pref || "hetero");
          }
          if (planCol && !sheet.getRange(row, planCol).getValue()) {
            sheet.getRange(row, planCol).setValue(profile.plan_tier || "");
          }
        }
      }

      // Si es Persona B: detectar automáticamente la PSICÓLOGA DE B
      if (!isPersonA) {
        var psycBCol = headers["PSICÓLOGA DE B"] || headers["PSICOLOGA DE B"] || headers["PSICOLOGA B"] || headers["PSICÓLOGA B"];
        if (!psycBCol && typeof ensurePsycBColumn === "function") {
          psycBCol = ensurePsycBColumn(sheet, headers, personBCol);
        }
        if (psycBCol) {
          var bCellData = {
            text: personName,
            link: pastedValue.indexOf("http") === 0 ? pastedValue : "",
            crmId: (profile && profile.crm_id) ? profile.crm_id : ""
          };
          var ownerPsyc = "";
          if (typeof findPsychologistForPersonA === "function") {
            ownerPsyc = findPsychologistForPersonA(bCellData, sheet);
          }
          // Si no se encontró en las pestañas pero el CRM tiene responsable
          if (!ownerPsyc && profile && profile.psychologist) {
            ownerPsyc = profile.psychologist;
          }
          sheet.getRange(row, psycBCol).setValue(ownerPsyc);
        }
      }
    } else if (!isPersonA) {
      // Si se borró Persona B, limpiar PSICÓLOGA DE B
      var psycBCol = headers["PSICÓLOGA DE B"] || headers["PSICOLOGA DE B"];
      if (psycBCol) sheet.getRange(row, psycBCol).setValue("");
    }
  }

  // ── B. BLOQUEO DE FILA AL APROBAR ────────────────────────────────────────
  if (statusCol && col === statusCol) {
    var statusVal = (newValue || sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase();
    if (statusVal === "APROBADO") {
      claudeWithLock(function() {
        claudeBloquearFila(sheet, row, headers);
      });
    }
  }

  // ── C. COLORES FIJOS (se aplican en cualquier edición de PREF/PLAN/STATUS) ─
  claudeAplicarColorFijo(sheet, row, statusCol, "STATUS_COLORS");
  claudeAplicarColorFijo(sheet, row, prefCol, "PREF_COLORS");
  claudeAplicarColorFijo(sheet, row, planCol, "PLAN_COLORS");
}

// ─── AUTOCOMPLETADO CRM VÍA BACKEND ──────────────────────────────────────────
function claudeResolveProfile(urlOrQuery) {
  try {
    var response = UrlFetchApp.fetch(CLAUDE_CONFIG.BACKEND_RESOLVE_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ url_or_query: urlOrQuery }),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log("resolve-profile: código " + code + " para '" + urlOrQuery + "'");
      return null;
    }
    return JSON.parse(response.getContentText());
  } catch (err) {
    Logger.log("Error consultando resolve-profile: " + err.message);
    return null;
  }
}

// ─── BLOQUEO DE FILA (protege toda la fila, requiere MARIA_EMAIL configurado) ─
function claudeBloquearFila(sheet, row, headers) {
  var lastCol = sheet.getLastColumn();
  var range = sheet.getRange(row, 1, 1, lastCol);
  var protection = range.protect().setDescription("Fila aprobada — bloqueada");
  protection.removeEditors(protection.getEditors());
  if (CLAUDE_CONFIG.MARIA_EMAIL) {
    protection.addEditor(CLAUDE_CONFIG.MARIA_EMAIL);
  }
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}

// ─── COLORES FIJOS ────────────────────────────────────────────────────────
function claudeAplicarColorFijo(sheet, row, col, mapName) {
  if (!col) return;
  var cell = sheet.getRange(row, col);
  var val = cell.getValue().toString().trim().toUpperCase();
  if (!val) return;
  var map = CLAUDE_CONFIG[mapName];
  var color = map[val];
  if (color) {
    cell.setBackground(color);
  }
}

// ─── UTILITARIOS (independientes de los de Antigravity, mismo comportamiento) ─
function claudeGetSheetHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var title = (headerRow[c] || "").toString().trim().toUpperCase();
    if (title) map[title] = c + 1;
  }
  return map;
}

function claudeWithLock(actionFn) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(CLAUDE_CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      Logger.log("Claude: no se pudo obtener el lock a tiempo.");
      return;
    }
    actionFn();
  } catch (err) {
    Logger.log("Claude error con lock: " + err.message);
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

// ─── PROFILE PRIORITARIO: AUTOCOMPLETADO CRM EN PERSONAS DÍFICILES ─────────
function handleClaudePersonasDificilesEdit(sheet, row, col, newValue) {
  var headers = claudeGetSheetHeaders(sheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"] || 1;
  var planCol = headers["PLAN"] || headers["PLAN TIER"] || 3;
  var ciudadCol = headers["CIUDAD"] || headers["CITY"] || 4;
  var prefCol = headers["PREF"] || headers["PREFERENCIA"] || 5;
  var fechaIngresoCol = headers["FECHA INGRESO"] || headers["FECHA"] || 6;

  if (personACol && col === personACol) {
    var pastedValue = (newValue || sheet.getRange(row, col).getValue() || "").toString().trim();
    if (pastedValue) {
      var profile = claudeResolveProfile(pastedValue);
      if (profile && profile.found) {
        var cellRange = sheet.getRange(row, col);
        if (pastedValue.indexOf("http") === 0) {
          var richText = SpreadsheetApp.newRichTextValue()
            .setText(profile.name)
            .setLinkUrl(pastedValue)
            .build();
          cellRange.setRichTextValue(richText);
        } else if (profile.name) {
          cellRange.setValue(profile.name);
        }

        if (ciudadCol && !sheet.getRange(row, ciudadCol).getValue()) {
          sheet.getRange(row, ciudadCol).setValue(profile.city || "");
        }
        if (prefCol && !sheet.getRange(row, prefCol).getValue()) {
          sheet.getRange(row, prefCol).setValue(profile.pref || "hetero");
        }
        if (planCol && !sheet.getRange(row, planCol).getValue()) {
          sheet.getRange(row, planCol).setValue(profile.plan_tier || "");
        }
        if (fechaIngresoCol && !sheet.getRange(row, fechaIngresoCol).getValue()) {
          sheet.getRange(row, fechaIngresoCol).setValue(Utilities.formatDate(new Date(), "America/Bogota", "yyyy-MM-dd HH:mm"));
        }

        // Si ya hay psicóloga y plan válidos, disparar generación de slots
        if (typeof handlePersonasDificilesEdit === "function") {
          handlePersonasDificilesEdit(sheet, row, col);
        }
      }
    }
  }
}
