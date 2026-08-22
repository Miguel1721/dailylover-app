/**
 * ============================================================================
 * DAILY LOVER MATCHMAKING — APPS SCRIPT AUTOMATION v2 (SPEC REAL SSOT CORREGIDA)
 * ============================================================================
 * Archivo: Copia final de Daily Lover MATCHMAKING
 * 
 * CORRECCIONES & MEJORAS IMPLEMENTADAS:
 * 1. DISPARADOR INSTALABLE: Función principal `onEditInstallable(e)` para evitar
 *    límites de permisos y fallos silenciosos de CacheService/LockService.
 * 2. REVISAR POR SI TOCA OTRO MATCH: Excluido de la creación de filas de reintento.
 *    Solo NOT APPROVED y TROUBLEMAKER generan nuevas filas.
 * 3. PRESERVACIÓN DE HIPERVÍNCULOS CRM: Se lee y escribe el `RichTextValue` completo
 *    y/o fórmula `=HYPERLINK(...)` de Persona A y Persona B para no perder links.
 * 4. CONTROL DE CONCURRENCIA: `LockService.getScriptLock()` con timeout de 30s
 *    para evitar que múltiples psicólogas calculen la misma fila al mismo tiempo.
 * 5. MÓDULO DE REFUNDS PARA LINA: Pestaña dedicada "REFUNDS PENDIENTES" con registro
 *    automático al marcar REFUND y flujo de aprobación hacia REFUND DONE.
 * 6. PESTAÑA "VUELVE A PAGAR": Nombre exacto SSOT "VUELVE A PAGAR".
 * 7. VALIDACIÓN DE PLANES: Si el PLAN viene vacío o no reconocido en Vuelve a Pagar,
 *    NO se asume plan por defecto; se marca visiblemente como ERROR para revisión.
 * 8. BÚSQUEDA ROBUSTA DE PESTAÑAS: `findPsychologistSheet()` maneja espacios extras
 *    (ej: "MATCHES ANA ") y registra avisos visibles si la pestaña no existe.
 * 9. DIFERENCIACIÓN: DESCALIFICADO (bloqueo permanente sin reintento) vs REFUND (contable, reutilizable).
 * ============================================================================
 */

// ─── CONFIGURACIÓN GLOBAL & CONSTANTES ───────────────────────────────────────

var CONFIG = {
  PSYCHOLOGIST_SHEET_PREFIX: "MATCHES ",
  TROUBLE_SHEET_NAME: "TROUBLE MATCHES",
  REFUNDS_SHEET_NAME: "REFUNDS PENDIENTES",
  VUELVE_A_PAGAR_SHEET_NAME: "VUELVE A PAGAR",
  TIMEZONE: "America/Bogota",
  LOCK_TIMEOUT_MS: 30000,
  PLAN_SLOTS_MAP: {
    "BÁSICO 40K (1 CITA)": 2,
    "BÁSICO 40K": 2,
    "BASICO 40K": 2,
    "BÁSICO": 2,
    "BASICO": 2,
    "ESTÁNDAR 65K (2 CITAS)": 3,
    "ESTANDAR 65K (2 CITAS)": 3,
    "ESTÁNDAR 65K (1 CITA)": 3,
    "ESTANDAR 65K (1 CITA)": 3,
    "ESTÁNDAR 65K": 3,
    "ESTANDAR 65K": 3,
    "ESTÁNDAR PLUS 98K": 3,
    "ESTANDAR PLUS 98K": 3,
    "ESTÁNDAR": 3,
    "ESTANDAR": 3,
    "VIP 195K": 4,
    "VIP 295K": 4,
    "VIP ORO": 4,
    "VIP": 4
  }
};

// ─── 1. DISPARADOR PRINCIPAL INSTALABLE ─────────────────────────────────────

/**
 * Función principal para el disparador instalable:
 * Configuración en Google Sheets:
 * Triggers (icono de reloj) -> Agregar disparador -> Función: onEditInstallable -> Evento: Al editar
 */
function onEditInstallable(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Ignorar fila 1 de encabezados
  if (row <= 1) return;

  var upperSheetName = sheetName.trim().toUpperCase();

  // A. Pestañas de psicólogas ("MATCHES SILVI", "MATCHES JENN", "MATCHES ANA ", etc.)
  if (upperSheetName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upperSheetName !== "MATCHES") {
    handlePsychologistSheetEdit(sheet, row, col, e.value, e.oldValue);
  }

  // B. Pestaña oficial "VUELVE A PAGAR"
  if (upperSheetName === CONFIG.VUELVE_A_PAGAR_SHEET_NAME) {
    handleVuelveAPagarEdit(sheet, row, col, e.value, e.oldValue);
  }

  // C. Pestaña de Refunds de Lina ("REFUNDS PENDIENTES")
  if (upperSheetName === CONFIG.REFUNDS_SHEET_NAME) {
    handleRefundsSheetEdit(sheet, row, col, e.value, e.oldValue);
  }
}

// ─── 2. GESTIÓN DE PESTAÑAS DE PSICÓLOGAS ───────────────────────────────────

function handlePsychologistSheetEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var statusCol = headers["STATUS"];
  if (!statusCol || col !== statusCol) return;

  var statusVal = (newValue || sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase();
  if (!statusVal) return;

  var fechaCol = headers["FECHA"];
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"];
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || headers["CANDIDATO"] || headers["MATCH"];
  var cityCol = headers["CITY"] || headers["CIUDAD"];
  var prefCol = headers["PREF"] || headers["PREFERENCIA"];
  var planCol = headers["PLAN"] || headers["PLAN TIER"];
  var obsCol = headers["OBSERVACIONES"] || headers["OBSERVACION"] || headers["NOTAS"];

  var personACell = personACol ? getCellData(sheet, row, personACol) : null;
  var personBCell = personBCol ? getCellData(sheet, row, personBCol) : null;
  var personAName = personACell ? personACell.text : "";
  var personBName = personBCell ? personBCell.text : "";

  var city = cityCol ? sheet.getRange(row, cityCol).getValue().toString().trim() : "";
  var pref = prefCol ? sheet.getRange(row, prefCol).getValue().toString().trim() : "";
  var plan = planCol ? sheet.getRange(row, planCol).getValue().toString().trim() : "";
  var obs = obsCol ? sheet.getRange(row, obsCol).getValue().toString().trim() : "";

  // ── A. DISPARADOR DE FECHA: Únicamente al pasar a HECHO o HECHO POR MAPE ──
  if (statusVal === "HECHO" || statusVal === "HECHO POR MAPE") {
    if (fechaCol) {
      var currentFecha = sheet.getRange(row, fechaCol).getValue();
      if (!currentFecha || currentFecha.toString().trim() === "") {
        var now = new Date();
        var formattedDate = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
        sheet.getRange(row, fechaCol).setValue(formattedDate);
      }
    }
  }

  // ── B. NOT APPROVED / TROUBLEMAKER: Fila intacta + Nueva fila al final ───
  // NOTA: "REVISAR POR SI TOCA OTRO MATCH" está explícitamente EXCLUIDO de esta acción
  if (statusVal === "NOT APPROVED" || statusVal === "TROUBLEMAKER") {
    if (personAName && personAName !== "") {
      var cacheKey = "retry_created_" + sheet.getName() + "_" + row + "_" + statusVal;
      var cache = CacheService.getScriptCache();
      if (!cache.get(cacheKey)) {
        cache.put(cacheKey, "true", 45); // Deduplicación 45s

        withScriptLock(function() {
          appendNewRetryRow(sheet, headers, {
            city: city,
            pref: pref,
            plan: plan,
            personACell: personACell,
            personBCell: null,
            fecha: "",
            status: "Listo para match",
            observaciones: "Reintento automático tras " + statusVal + (personBName ? " (ex: " + personBName + ")" : "")
          });
        });
      }
    }
  }

  // ── C. TROUBLEMAKER: Copiado hacia pestaña TROUBLE MATCHES ───────────────
  if (statusVal === "TROUBLEMAKER") {
    withScriptLock(function() {
      copyToTroubleMatches(sheet.getName(), {
        city: city,
        pref: pref,
        plan: plan,
        personACell: personACell,
        personBCell: personBCell,
        fecha: fechaCol ? sheet.getRange(row, fechaCol).getValue() : "",
        status: statusVal,
        observaciones: obs
      });
    });
  }

  // ── D. REFUND: Enviar automáticamente a la cola de Lina (REFUNDS PENDIENTES) ─
  if (statusVal === "REFUND") {
    withScriptLock(function() {
      syncToRefundsQueue(sheet.getName(), row, {
        personACell: personACell,
        plan: plan,
        observaciones: obs
      });
    });
  }

  // ── E. DESCALIFICADO vs REFUND: Registro y bloqueo permanente ────────────
  if (statusVal === "DESCALIFICADO") {
    if (obsCol) {
      var currentObs = sheet.getRange(row, obsCol).getValue().toString();
      if (currentObs.indexOf("[DESCALIFICADO - BLOQUEO PERMANENTE]") === -1) {
        sheet.getRange(row, obsCol).setValue((currentObs ? currentObs + " | " : "") + "[DESCALIFICADO - BLOQUEO PERMANENTE]");
      }
    }
  }
}

// ─── 3. GESTIÓN DE TABLA "VUELVE A PAGAR" (SSOT EXACTO) ──────────────────────

function handleVuelveAPagarEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var statusCol = headers["STATUS"];
  if (!statusCol || col !== statusCol) return;

  var statusVal = (newValue || sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase();
  if (!statusVal) return;

  var personaCol = headers["PERSONA"] || headers["PERSON A"] || headers["CLIENTE"];
  var psychologistCol = headers["HECHO POR"] || headers["PSICOLOGA"] || headers["PSICÓLOGA"];
  var planCol = headers["PLAN"] || headers["PLAN TIER"];
  var csObsCol = headers["COMENTARIO CUSTOMER SERVICE"] || headers["OBSERVACIONES"] || headers["COMENTARIO"];

  var personACell = personaCol ? getCellData(sheet, row, personaCol) : null;
  var personAName = personACell ? personACell.text : "";
  var psychologist = psychologistCol ? sheet.getRange(row, psychologistCol).getValue().toString().trim() : "";
  var rawPlan = planCol ? sheet.getRange(row, planCol).getValue().toString().trim() : "";

  if (!personAName) return;

  // 7. VALIDACIÓN DE PLAN: NO asumir silenciosamente
  var cleanPlanKey = rawPlan.toUpperCase().replace(/\s+/g, " ");
  var numSlots = CONFIG.PLAN_SLOTS_MAP[cleanPlanKey];

  if (!numSlots) {
    // Marcar visiblemente como error en la celda de plan y observación
    if (planCol) {
      sheet.getRange(row, planCol).setBackground("#F4CCCC").setNote("PLAN NO ESPECIFICADO O NO VÁLIDO. Especifique: Básico 40k, Estándar 65k o VIP 195k.");
    }
    if (csObsCol) {
      var existingObs = sheet.getRange(row, csObsCol).getValue().toString();
      if (existingObs.indexOf("[ERROR: PLAN REQUERIDO]") === -1) {
        sheet.getRange(row, csObsCol).setValue((existingObs ? existingObs + " | " : "") + "[ERROR: PLAN REQUERIDO PARA CREAR SLOTS]");
      }
    }
    SpreadsheetApp.getActiveSpreadsheet().toast("Error: El plan '" + rawPlan + "' no es válido. No se crearon slots.", "Plan Requerido", 6);
    return;
  }

  // 8. BÚSQUEDA ROBUSTA DE PESTAÑA DE PSICÓLOGA
  if (statusVal === "NOT APPROVED" || statusVal === "TROUBLEMAKER" || statusVal === "APROBADO") {
    if (!psychologist) {
      if (psychologistCol) {
        sheet.getRange(row, psychologistCol).setBackground("#FFF2CC").setNote("Indique la psicóloga responsable en 'Hecho por'.");
      }
      return;
    }

    var psycSheet = findPsychologistSheet(psychologist);
    if (!psycSheet) {
      // Aviso visible de que la psicóloga no tiene pestaña
      if (psychologistCol) {
        sheet.getRange(row, psychologistCol).setBackground("#F4CCCC").setNote("No se encontró la pestaña 'MATCHES " + psychologist + "'. Verifique el nombre.");
      }
      Logger.log("ERROR: Pestaña no encontrada para psicóloga: " + psychologist);
      SpreadsheetApp.getActiveSpreadsheet().toast("No se encontró la pestaña de " + psychologist, "Error de Psicóloga", 6);
      return;
    }

    // Crear fila de reasignación con preservación de CRM Link
    withScriptLock(function() {
      var psycHeaders = getSheetHeaders(psycSheet);
      appendNewRetryRow(psycSheet, psycHeaders, {
        city: "",
        pref: "hetero",
        plan: rawPlan,
        personACell: personACell,
        personBCell: null,
        fecha: "",
        status: "Listo para match",
        observaciones: "Vuelve a Pagar / Reasignación (" + statusVal + ")"
      });
    });
  }
}

// ─── 4. FLUJO DE REFUNDS DE LINA (REFUNDS PENDIENTES) ─────────────────────────

function syncToRefundsQueue(sourceSheetName, sourceRow, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var refundSheet = ss.getSheetByName(CONFIG.REFUNDS_SHEET_NAME);

  if (!refundSheet) {
    refundSheet = ss.insertSheet(CONFIG.REFUNDS_SHEET_NAME);
    var headerRow = [
      "FECHA REPORTE", "ORIGEN (PESTAÑA)", "FILA ORIGEN", "PERSONA A", "PLAN", "OBSERVACIONES / MOTIVO", "ESTADO REFUND", "FECHA PROCESADO", "LINA NOTAS"
    ];
    refundSheet.appendRow(headerRow);
    refundSheet.getRange(1, 1, 1, headerRow.length).setFontWeight("bold").setBackground("#D9D2E9");
    refundSheet.setFrozenRows(1);
  }

  var headers = getSheetHeaders(refundSheet);
  var trueLastRow = getTrueLastRow(refundSheet, headers["PERSONA A"] || 4);
  var targetRow = trueLastRow + 1;

  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");

  if (headers["FECHA REPORTE"]) refundSheet.getRange(targetRow, headers["FECHA REPORTE"]).setValue(nowStr);
  if (headers["ORIGEN (PESTAÑA)"]) refundSheet.getRange(targetRow, headers["ORIGEN (PESTAÑA)"]).setValue(sourceSheetName);
  if (headers["FILA ORIGEN"]) refundSheet.getRange(targetRow, headers["FILA ORIGEN"]).setValue(sourceRow);
  if (headers["PLAN"]) refundSheet.getRange(targetRow, headers["PLAN"]).setValue(data.plan || "");
  if (headers["OBSERVACIONES / MOTIVO"]) refundSheet.getRange(targetRow, headers["OBSERVACIONES / MOTIVO"]).setValue(data.observaciones || "");
  if (headers["ESTADO REFUND"]) refundSheet.getRange(targetRow, headers["ESTADO REFUND"]).setValue("PENDIENTE LINA");

  if (headers["PERSONA A"] && data.personACell) {
    setCellData(refundSheet, targetRow, headers["PERSONA A"], data.personACell);
  }
}

function handleRefundsSheetEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var estadoCol = headers["ESTADO REFUND"];
  if (!estadoCol || col !== estadoCol) return;

  var val = (newValue || sheet.getRange(row, estadoCol).getValue() || "").toString().trim().toUpperCase();

  if (val === "REFUND DONE" || val === "APROBADO" || val === "PROCESADO") {
    var origenCol = headers["ORIGEN (PESTAÑA)"];
    var filaOrigenCol = headers["FILA ORIGEN"];
    var fechaProcCol = headers["FECHA PROCESADO"];

    var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
    if (fechaProcCol) sheet.getRange(row, fechaProcCol).setValue(nowStr);

    var sourceSheetName = origenCol ? sheet.getRange(row, origenCol).getValue().toString().trim() : "";
    var sourceRow = filaOrigenCol ? parseInt(sheet.getRange(row, filaOrigenCol).getValue(), 10) : 0;

    if (sourceSheetName && sourceRow > 1) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sourceSheet = ss.getSheetByName(sourceSheetName);
      if (sourceSheet) {
        var sourceHeaders = getSheetHeaders(sourceSheet);
        var sourceStatusCol = sourceHeaders["STATUS"];
        if (sourceStatusCol) {
          sourceSheet.getRange(sourceRow, sourceStatusCol).setValue("REFUND DONE");
        }
      }
    }
  }
}

// ─── 5. AGREGAR NUEVA FILA DE REINTENTO (PRESERVA LINKS CRM) ────────────────

function appendNewRetryRow(sheet, headers, data) {
  var checkCol = headers["PERSON A"] || headers["PERSONA A"] || 1;
  var trueLastRow = getTrueLastRow(sheet, checkCol);
  var newRow = trueLastRow + 1;

  if (headers["CITY"]) sheet.getRange(newRow, headers["CITY"]).setValue(data.city);
  if (headers["CIUDAD"]) sheet.getRange(newRow, headers["CIUDAD"]).setValue(data.city);

  if (headers["PREF"]) sheet.getRange(newRow, headers["PREF"]).setValue(data.pref);
  if (headers["PREFERENCIA"]) sheet.getRange(newRow, headers["PREFERENCIA"]).setValue(data.pref);

  if (headers["PLAN"]) sheet.getRange(newRow, headers["PLAN"]).setValue(data.plan);
  if (headers["PLAN TIER"]) sheet.getRange(newRow, headers["PLAN TIER"]).setValue(data.plan);

  // 3. PRESERVAR HIPERVÍNCULO CRM DE PERSONA A
  if (headers["PERSON A"] && data.personACell) {
    setCellData(sheet, newRow, headers["PERSON A"], data.personACell);
  } else if (headers["PERSONA A"] && data.personACell) {
    setCellData(sheet, newRow, headers["PERSONA A"], data.personACell);
  }

  if (headers["PERSON B"]) sheet.getRange(newRow, headers["PERSON B"]).setValue("");
  if (headers["PERSONA B"]) sheet.getRange(newRow, headers["PERSONA B"]).setValue("");

  if (headers["FECHA"]) sheet.getRange(newRow, headers["FECHA"]).setValue("");
  if (headers["STATUS"]) sheet.getRange(newRow, headers["STATUS"]).setValue(data.status);

  if (headers["OBSERVACIONES"]) sheet.getRange(newRow, headers["OBSERVACIONES"]).setValue(data.observaciones);
  if (headers["OBSERVACION"]) sheet.getRange(newRow, headers["OBSERVACION"]).setValue(data.observaciones);
}

// ─── 6. COPIAR A TROUBLE MATCHES (PRESERVA LINKS CRM) ────────────────────────

function copyToTroubleMatches(sourcePsychologistSheet, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var troubleSheet = ss.getSheetByName(CONFIG.TROUBLE_SHEET_NAME);
  if (!troubleSheet) {
    var allSheets = ss.getSheets();
    for (var i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getName().toUpperCase().indexOf("TROUBLE") !== -1) {
        troubleSheet = allSheets[i];
        break;
      }
    }
  }
  if (!troubleSheet) return;

  var headers = getSheetHeaders(troubleSheet);
  var checkCol = headers["PERSON A"] || headers["PERSONA A"] || 1;
  var trueLastRow = getTrueLastRow(troubleSheet, checkCol);
  var targetRow = trueLastRow + 1;

  if (headers["PSICOLOGA"] || headers["PSICÓLOGA"] || headers["HECHO POR"]) {
    var pCol = headers["PSICOLOGA"] || headers["PSICÓLOGA"] || headers["HECHO POR"];
    troubleSheet.getRange(targetRow, pCol).setValue(sourcePsychologistSheet.replace(CONFIG.PSYCHOLOGIST_SHEET_PREFIX, "").trim());
  }

  if (headers["CITY"] || headers["CIUDAD"]) {
    troubleSheet.getRange(targetRow, headers["CITY"] || headers["CIUDAD"]).setValue(data.city);
  }
  if (headers["PREF"]) troubleSheet.getRange(targetRow, headers["PREF"]).setValue(data.pref);
  if (headers["PLAN"]) troubleSheet.getRange(targetRow, headers["PLAN"]).setValue(data.plan);

  // 3. PRESERVAR HIPERVÍNCULOS CRM
  if ((headers["PERSON A"] || headers["PERSONA A"]) && data.personACell) {
    setCellData(troubleSheet, targetRow, headers["PERSON A"] || headers["PERSONA A"], data.personACell);
  }
  if ((headers["PERSON B"] || headers["PERSONA B"] || headers["MATCH"]) && data.personBCell) {
    setCellData(troubleSheet, targetRow, headers["PERSON B"] || headers["PERSONA B"] || headers["MATCH"], data.personBCell);
  }

  if (headers["FECHA"]) troubleSheet.getRange(targetRow, headers["FECHA"]).setValue(data.fecha || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd"));
  if (headers["STATUS"]) troubleSheet.getRange(targetRow, headers["STATUS"]).setValue(data.status);
  if (headers["OBSERVACIONES"] || headers["OBSERVACION"]) {
    troubleSheet.getRange(targetRow, headers["OBSERVACIONES"] || headers["OBSERVACION"]).setValue(data.observaciones);
  }
}

// ─── 7. FUNCIONES UTILITARIAS Y DE SEGURIDAD ────────────────────────────────

/**
 * Ejecuta una acción protegida por LockService para evitar concurrencia y sobreescrituras.
 */
function withScriptLock(actionFn) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      Logger.log("No se pudo obtener el bloqueo de concurrencia en " + CONFIG.LOCK_TIMEOUT_MS + "ms.");
      return false;
    }
    actionFn();
    return true;
  } catch (err) {
    Logger.log("Error en operación con bloqueo: " + err.message);
    return false;
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * 8. Búsqueda tolerante de la pestaña de psicóloga (maneja espacios extras como 'MATCHES ANA ')
 */
function findPsychologistSheet(psycName) {
  if (!psycName) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cleanName = psycName.toString().trim().toUpperCase();
  var targetPrefix = CONFIG.PSYCHOLOGIST_SHEET_PREFIX + cleanName;

  var direct = ss.getSheetByName(targetPrefix);
  if (direct) return direct;

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().trim().toUpperCase();
    if (sName === targetPrefix || sName.replace(/\s+/g, " ") === targetPrefix.replace(/\s+/g, " ")) {
      return sheets[i];
    }
  }
  return null;
}

/**
 * Extrae texto, RichTextValue y fórmula de una celda para preservar hipervínculos.
 */
function getCellData(sheet, row, col) {
  if (!col) return null;
  var range = sheet.getRange(row, col);
  var formula = range.getFormula();
  var richText = range.getRichTextValue();
  var value = range.getValue();
  var text = richText ? richText.getText() : (value !== null && value !== undefined ? value.toString().trim() : "");

  return {
    text: text,
    value: value,
    richText: richText,
    formula: formula
  };
}

/**
 * Escribe en una celda preservando fórmulas de hipervínculo o RichTextValue con URL.
 */
function setCellData(sheet, row, col, cellData) {
  if (!col || !cellData) return;
  var range = sheet.getRange(row, col);

  if (cellData.formula && cellData.formula.indexOf("=HYPERLINK") !== -1) {
    range.setFormula(cellData.formula);
  } else if (cellData.richText && cellData.richText.getLinkUrl()) {
    range.setRichTextValue(cellData.richText);
  } else if (cellData.richText && cellData.richText.getText()) {
    range.setRichTextValue(cellData.richText);
  } else {
    range.setValue(cellData.value !== undefined ? cellData.value : cellData.text);
  }
}

/**
 * Lee los encabezados de la fila 1 y devuelve un mapa { "HEADER_TEXT": col_index (1-based) }
 */
function getSheetHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var title = (headerRow[c] || "").toString().trim().toUpperCase();
    if (title) {
      map[title] = c + 1;
    }
  }
  return map;
}

/**
 * Encuentra la verdadera última fila con datos reales en una columna dada.
 */
function getTrueLastRow(sheet, checkColIndex) {
  var col = checkColIndex || 1;
  var maxRows = sheet.getMaxRows();
  var values = sheet.getRange(1, col, maxRows, 1).getValues();

  for (var r = values.length - 1; r >= 0; r--) {
    var val = values[r][0];
    if (val !== null && val !== undefined && val.toString().trim() !== "") {
      return r + 1;
    }
  }
  return 1;
}

// ─── 8. VISTA DINÁMICA: REVISIÓN MARÍA ─────────────────────────────────────

/**
 * Reconstruye la pestaña 'REVISIÓN MARÍA' consolidando todos los matches con
 * STATUS = HECHO o HECHO POR MAPE de todas las psicólogas para revisión de María.
 *
 * Columnas oficiales:
 * PSICÓLOGA | CITY | PREF | PLAN | PERSON A | PERSON B | FECHA | OBSERVACIONES | ORIGEN (PESTAÑA) | FILA ORIGEN | APROBAR
 */
function reconstruirRevisionMaria() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "REVISIÓN MARÍA";
  var revisionSheet = ss.getSheetByName(sheetName) || ss.getSheetByName("REVISION MARIA");

  var headers = [
    "PSICÓLOGA", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "OBSERVACIONES", "ORIGEN (PESTAÑA)", "FILA ORIGEN", "APROBAR"
  ];

  if (!revisionSheet) {
    revisionSheet = ss.insertSheet(sheetName);
    revisionSheet.setTabColor("#D5A6BD");
  }

  // Asegurar encabezados en fila 1
  revisionSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  revisionSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#D5A6BD")
    .setFontColor("#000000");
  revisionSheet.setFrozenRows(1);

  // Limpiar contenido anterior (desde fila 2 hasta la última fila existente)
  var lastRow = revisionSheet.getLastRow();
  if (lastRow > 1) {
    revisionSheet.getRange(2, 1, lastRow - 1, headers.length).clear({ contentsOnly: false });
  }

  var allSheets = ss.getSheets();
  var collectedRows = [];
  var collectedRichTextsA = [];
  var collectedRichTextsB = [];

  for (var s = 0; s < allSheets.length; s++) {
    var curSheet = allSheets[s];
    var curName = curSheet.getName().trim();
    var upperCurName = curName.toUpperCase();

    // Solo pestañas de psicólogas (ej. "MATCHES JENN", "MATCHES ANA ", etc.)
    if (upperCurName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upperCurName !== "MATCHES" && upperCurName !== "MATCHES COMPLETED") {
      var psycName = curName.substring(CONFIG.PSYCHOLOGIST_SHEET_PREFIX.length).trim();
      var sHeaders = getSheetHeaders(curSheet);

      var statusCol = sHeaders["STATUS"];
      var personACol = sHeaders["PERSON A"] || sHeaders["PERSONA A"] || sHeaders["CLIENTE"];
      var personBCol = sHeaders["PERSON B"] || sHeaders["PERSONA B"] || sHeaders["CANDIDATO"] || sHeaders["MATCH"];
      var cityCol = sHeaders["CITY"] || sHeaders["CIUDAD"];
      var prefCol = sHeaders["PREF"] || sHeaders["PREFERENCIA"];
      var planCol = sHeaders["PLAN"] || sHeaders["PLAN TIER"];
      var fechaCol = sHeaders["FECHA"];
      var obsCol = sHeaders["OBSERVACIONES"] || sHeaders["OBSERVACION"] || sHeaders["NOTAS"];

      if (!statusCol || !personACol) continue;

      var trueLast = getTrueLastRow(curSheet, personACol);
      if (trueLast <= 1) continue;

      var numRows = trueLast - 1;
      var statusVals = curSheet.getRange(2, statusCol, numRows, 1).getValues();

      for (var r = 0; r < statusVals.length; r++) {
        var st = (statusVals[r][0] || "").toString().trim().toUpperCase();
        if (st === "HECHO" || st === "HECHO POR MAPE") {
          var realRow = r + 2;

          var cityVal = cityCol ? curSheet.getRange(realRow, cityCol).getValue().toString().trim() : "";
          var prefVal = prefCol ? curSheet.getRange(realRow, prefCol).getValue().toString().trim() : "";
          var planVal = planCol ? curSheet.getRange(realRow, planCol).getValue().toString().trim() : "";
          var fechaVal = fechaCol ? curSheet.getRange(realRow, fechaCol).getValue() : "";
          var obsVal = obsCol ? curSheet.getRange(realRow, obsCol).getValue().toString().trim() : "";

          var cellDataA = getCellData(curSheet, realRow, personACol);
          var cellDataB = personBCol ? getCellData(curSheet, realRow, personBCol) : null;

          collectedRows.push([
            psycName,
            cityVal,
            prefVal,
            planVal,
            cellDataA ? (cellDataA.value !== undefined ? cellDataA.value : cellDataA.text) : "",
            cellDataB ? (cellDataB.value !== undefined ? cellDataB.value : cellDataB.text) : "",
            fechaVal,
            obsVal,
            curName,
            realRow,
            "" // Columna APROBAR (gestionada por la función de Claude)
          ]);

          collectedRichTextsA.push(cellDataA);
          collectedRichTextsB.push(cellDataB);
        }
      }
    }
  }

  // Escribir todas las filas recopiladas
  if (collectedRows.length > 0) {
    if (revisionSheet.getMaxRows() < collectedRows.length + 1) {
      revisionSheet.insertRowsAfter(revisionSheet.getMaxRows(), (collectedRows.length + 1) - revisionSheet.getMaxRows() + 5);
    }

    var targetRange = revisionSheet.getRange(2, 1, collectedRows.length, headers.length);
    targetRange.setValues(collectedRows);

    // Preservar hipervínculos RichText nativos en PERSON A (Col 5) y PERSON B (Col 6)
    for (var i = 0; i < collectedRows.length; i++) {
      var rowNum = i + 2;
      if (collectedRichTextsA[i]) {
        setCellData(revisionSheet, rowNum, 5, collectedRichTextsA[i]);
      }
      if (collectedRichTextsB[i]) {
        setCellData(revisionSheet, rowNum, 6, collectedRichTextsB[i]);
      }
    }
  }

  Logger.log("✅ Pestaña 'REVISIÓN MARÍA' reconstruida exitosamente con " + collectedRows.length + " filas.");
}

/**
 * Instala el disparador periódico para reconstruir REVISIÓN MARÍA cada 15 minutos
 */
function instalarTriggerRevisionMaria() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "reconstruirRevisionMaria") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("reconstruirRevisionMaria")
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("✅ Disparador de REVISIÓN MARÍA configurado para ejecutarse cada 15 minutos.");
}
