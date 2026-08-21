/**
 * ============================================================================
 * DAILY LOVER MATCHMAKING — APPS SCRIPT AUTOMATION v2 (SPEC REAL SSOT)
 * ============================================================================
 * Archivo: Copia final de Daily Lover MATCHMAKING
 * 
 * Funcionalidades implementadas:
 * 1. Disparador de FECHA automático únicamente al pasar STATUS a HECHO / HECHO POR MAPE.
 * 2. Flujo post-aprobación / rechazo:
 *    - NOT APPROVED o TROUBLEMAKER: La fila original queda INTACTA. Se crea una fila
 *      NUEVA al final de la pestaña de la psicóloga para reintentar con la misma Persona A.
 *    - TROUBLEMAKER: Se copia además la fila hacia la pestaña "TROUBLE MATCHES".
 * 3. Flujo de Refunds (Lina - Servicio al Cliente):
 *    - Control de estados REFUND -> REFUND DONE.
 * 4. Integración de tabla "Vuelve a Pagar" / Reasignación (Profile Prioritario):
 *    - Generación de slots según plan: Básico 40k -> 2 | Estándar 65k -> 3 | VIP 195k -> 4.
 * 5. Búsqueda dinámica de columnas por encabezado de texto (tolerante a variaciones).
 * 6. Cálculo seguro de última fila real (no afectado por checkboxes vacíos).
 * ============================================================================
 */

// ─── CONFIGURACIÓN GLOBAL & CONSTANTES ───────────────────────────────────────

var PSYCHOLOGIST_SHEET_PREFIX = "MATCHES ";
var TROUBLE_SHEET_NAME = "TROUBLE MATCHES";
var REASSIGNMENT_SHEET_NAMES = ["VUELVE A PAGAR", "REASIGNACIONES", "PROFILE PRIORITARIO", "REASIGNACION"];

// Slots por plan activo (SSOT v2)
var PLAN_SLOTS_MAP = {
  "Básico 40k": 2,
  "Básico 40k (1 cita)": 2,
  "Básico": 2,
  "Estándar 65k (2 citas)": 3,
  "Estándar 65k (1 cita)": 3,
  "Estándar 65k": 3,
  "Estándar Plus 98k": 3,
  "Estándar": 3,
  "VIP 195k": 4,
  "VIP 295k": 4,
  "VIP": 4,
  "VIP Oro": 4
};

// ─── DISPARADOR PRINCIPAL ONEDIT ────────────────────────────────────────────

/**
 * Evento onEdit principal de Google Sheets.
 * Soporta edición manual y disparador instalable.
 */
function onEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Ignorar edición en fila de encabezados
  if (row <= 1) return;

  // 1. Manejo de pestañas de psicólogas ("MATCHES JENN", "MATCHES SILVI", etc.)
  if (sheetName.toUpperCase().indexOf(PSYCHOLOGIST_SHEET_PREFIX) === 0 && sheetName.toUpperCase() !== "MATCHES") {
    handlePsychologistSheetEdit(sheet, row, col, e.value, e.oldValue);
  }

  // 2. Manejo de pestaña "Vuelve a pagar" / Reasignaciones
  for (var i = 0; i < REASSIGNMENT_SHEET_NAMES.length; i++) {
    if (sheetName.toUpperCase().indexOf(REASSIGNMENT_SHEET_NAMES[i]) !== -1) {
      handleReassignmentSheetEdit(sheet, row, col, e.value, e.oldValue);
      break;
    }
  }
}

// ─── 1. GESTIÓN DE PESTAÑAS DE PSICÓLOGAS ───────────────────────────────────

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

  var personA = personACol ? sheet.getRange(row, personACol).getValue().toString().trim() : "";
  var personB = personBCol ? sheet.getRange(row, personBCol).getValue().toString().trim() : "";
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
        var formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd HH:mm");
        sheet.getRange(row, fechaCol).setValue(formattedDate);
      }
    }
  }

  // ── B. NOT APPROVED / TROUBLEMAKER: Fila intacta + Nueva fila al final ───
  if (statusVal === "NOT APPROVED" || statusVal === "TROUBLEMAKER" || statusVal === "REVISAR POR SI TOCA OTRO MATCH") {
    if (personA && personA !== "") {
      // Evitar duplicación accidental si ya existe una fila idéntica pendiente creada en los últimos segundos
      var cacheKey = "retry_created_" + sheet.getName() + "_" + row + "_" + statusVal;
      var cache = CacheService.getScriptCache();
      if (!cache.get(cacheKey)) {
        cache.put(cacheKey, "true", 60); // 60 segundos de deduplicación

        appendNewRetryRow(sheet, headers, {
          city: city,
          pref: pref,
          plan: plan,
          personA: personA,
          personB: "",
          fecha: "",
          status: "Listo para match",
          observaciones: "Reintento automático tras: " + statusVal + (personB ? " (ex: " + personB + ")" : "")
        });
      }
    }
  }

  // ── C. TROUBLEMAKER / TROUBLE: Copiado hacia pestaña TROUBLE MATCHES ────
  if (statusVal === "TROUBLEMAKER" || statusVal === "TROUBLE") {
    copyToTroubleMatches(sheet.getName(), {
      city: city,
      pref: pref,
      plan: plan,
      personA: personA,
      personB: personB,
      fecha: fechaCol ? sheet.getRange(row, fechaCol).getValue() : "",
      status: statusVal,
      observaciones: obs
    });
  }

  // ── D. FLUJO DE REFUND: REFUND -> REFUND DONE ───────────────────────────
  if (statusVal === "REFUND DONE") {
    // Si Lina finalizó el reembolso, dejamos constancia en observaciones sin crear nuevos slots
    if (obsCol) {
      var currentObs = sheet.getRange(row, obsCol).getValue().toString();
      if (currentObs.indexOf("[REFUND PROCESADO]") === -1) {
        var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd");
        sheet.getRange(row, obsCol).setValue((currentObs ? currentObs + " | " : "") + "[REFUND PROCESADO POR LINA " + nowStr + "]");
      }
    }
  }
}

// ─── 2. AGREGAR NUEVA FILA DE REINTENTO AL FINAL ────────────────────────────

function appendNewRetryRow(sheet, headers, data) {
  var trueLastRow = getTrueLastRow(sheet, headers["PERSON A"] || headers["PERSONA A"] || 1);
  var newRow = trueLastRow + 1;

  if (headers["CITY"]) sheet.getRange(newRow, headers["CITY"]).setValue(data.city);
  if (headers["CIUDAD"]) sheet.getRange(newRow, headers["CIUDAD"]).setValue(data.city);

  if (headers["PREF"]) sheet.getRange(newRow, headers["PREF"]).setValue(data.pref);
  if (headers["PREFERENCIA"]) sheet.getRange(newRow, headers["PREFERENCIA"]).setValue(data.pref);

  if (headers["PLAN"]) sheet.getRange(newRow, headers["PLAN"]).setValue(data.plan);
  if (headers["PLAN TIER"]) sheet.getRange(newRow, headers["PLAN TIER"]).setValue(data.plan);

  if (headers["PERSON A"]) sheet.getRange(newRow, headers["PERSON A"]).setValue(data.personA);
  if (headers["PERSONA A"]) sheet.getRange(newRow, headers["PERSONA A"]).setValue(data.personA);

  if (headers["PERSON B"]) sheet.getRange(newRow, headers["PERSON B"]).setValue("");
  if (headers["PERSONA B"]) sheet.getRange(newRow, headers["PERSONA B"]).setValue("");

  if (headers["FECHA"]) sheet.getRange(newRow, headers["FECHA"]).setValue("");

  if (headers["STATUS"]) sheet.getRange(newRow, headers["STATUS"]).setValue(data.status);

  if (headers["OBSERVACIONES"]) sheet.getRange(newRow, headers["OBSERVACIONES"]).setValue(data.observaciones);
  if (headers["OBSERVACION"]) sheet.getRange(newRow, headers["OBSERVACION"]).setValue(data.observaciones);
}

// ─── 3. COPIAR A TROUBLE MATCHES (DESTINO EXCLUSIVO) ─────────────────────────

function copyToTroubleMatches(sourcePsychologistSheet, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var troubleSheet = ss.getSheetByName(TROUBLE_SHEET_NAME);
  if (!troubleSheet) {
    // Si tiene otro nombre similar buscar tolerante
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
  var trueLastRow = getTrueLastRow(troubleSheet, headers["PERSON A"] || headers["PERSONA A"] || 1);
  var targetRow = trueLastRow + 1;

  if (headers["PSICOLOGA"] || headers["PSICÓLOGA"] || headers["HECHO POR"]) {
    var pCol = headers["PSICOLOGA"] || headers["PSICÓLOGA"] || headers["HECHO POR"];
    troubleSheet.getRange(targetRow, pCol).setValue(sourcePsychologistSheet.replace(PSYCHOLOGIST_PREFIX, "").trim());
  }

  if (headers["CITY"] || headers["CIUDAD"]) {
    troubleSheet.getRange(targetRow, headers["CITY"] || headers["CIUDAD"]).setValue(data.city);
  }
  if (headers["PREF"]) troubleSheet.getRange(targetRow, headers["PREF"]).setValue(data.pref);
  if (headers["PLAN"]) troubleSheet.getRange(targetRow, headers["PLAN"]).setValue(data.plan);

  if (headers["PERSON A"] || headers["PERSONA A"]) {
    troubleSheet.getRange(targetRow, headers["PERSON A"] || headers["PERSONA A"]).setValue(data.personA);
  }
  if (headers["PERSON B"] || headers["PERSONA B"] || headers["MATCH"]) {
    troubleSheet.getRange(targetRow, headers["PERSON B"] || headers["PERSONA B"] || headers["MATCH"]).setValue(data.personB);
  }
  if (headers["FECHA"]) troubleSheet.getRange(targetRow, headers["FECHA"]).setValue(data.fecha || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd"));
  if (headers["STATUS"]) troubleSheet.getRange(targetRow, headers["STATUS"]).setValue(data.status);
  if (headers["OBSERVACIONES"] || headers["OBSERVACION"]) {
    troubleSheet.getRange(targetRow, headers["OBSERVACIONES"] || headers["OBSERVACION"]).setValue(data.observaciones);
  }
}

// ─── 4. GESTIÓN DE TABLA "VUELVE A PAGAR" / REASIGNACIONES ───────────────────

function handleReassignmentSheetEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var statusCol = headers["STATUS"];
  if (!statusCol || col !== statusCol) return;

  var statusVal = (newValue || sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase();
  if (!statusVal) return;

  var personaCol = headers["PERSONA"] || headers["PERSON A"] || headers["CLIENTE"];
  var psychologistCol = headers["HECHO POR"] || headers["PSICOLOGA"] || headers["PSICÓLOGA"];
  var planCol = headers["PLAN"] || headers["PLAN TIER"];

  var persona = personaCol ? sheet.getRange(row, personaCol).getValue().toString().trim() : "";
  var psychologist = psychologistCol ? sheet.getRange(row, psychologistCol).getValue().toString().trim() : "";
  var plan = planCol ? sheet.getRange(row, planCol).getValue().toString().trim() : "Estándar 65k (2 citas)";

  if (!persona || !psychologist) return;

  // Si María aprueba o marca para reintento en Vuelve a Pagar
  if (statusVal === "NOT APPROVED" || statusVal === "TROUBLEMAKER") {
    // Abrir la pestaña de la psicóloga y agregar fila de reintento
    var psycSheetName = "MATCHES " + psychologist.toUpperCase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var psycSheet = ss.getSheetByName(psycSheetName);
    if (psycSheet) {
      var psycHeaders = getSheetHeaders(psycSheet);
      appendNewRetryRow(psycSheet, psycHeaders, {
        city: "",
        pref: "hetero",
        plan: plan,
        personA: persona,
        personB: "",
        fecha: "",
        status: "Listo para match",
        observaciones: "Reasignación / Vuelve a Pagar (" + statusVal + ")"
      });
    }
  }
}

/**
 * Función pública para crear los slots correspondientes según el plan del cliente.
 * Básico 40k -> 2 slots | Estándar 65k -> 3 slots | VIP 195k -> 4 slots
 */
function createSlotsForClient(psychologistName, clientData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var psycSheetName = "MATCHES " + psychologistName.toUpperCase().trim();
  var psycSheet = ss.getSheetByName(psycSheetName);
  if (!psycSheet) return false;

  var headers = getSheetHeaders(psycSheet);
  var plan = clientData.plan || "Estándar 65k (2 citas)";
  var numSlots = PLAN_SLOTS_MAP[plan] || 3;

  for (var i = 0; i < numSlots; i++) {
    appendNewRetryRow(psycSheet, psycHeaders, {
      city: clientData.city || "",
      pref: clientData.pref || "hetero",
      plan: plan,
      personA: clientData.personA || clientData.name,
      personB: "",
      fecha: "",
      status: "Listo para match",
      observaciones: "Slot " + (i + 1) + " de " + numSlots + " (" + plan + ")"
    });
  }
  return true;
}

// ─── 5. FUNCIONES UTILITARIAS Y DE SEGURIDAD ────────────────────────────────

/**
 * Lee los encabezados de la fila 1 y devuelve un mapa { "HEADER_TEXT": col_index (1-based) }
 * Cumple la Regla de Seguridad #5: "Verificar encabezados reales de la fila 1 por texto".
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
 * Cumple la Regla de Seguridad #4: "getLastRow() no es confiable con checkboxes o filas vacías".
 */
function getTrueLastRow(sheet, checkColIndex) {
  var col = checkColIndex || 1;
  var maxRows = sheet.getMaxRows();
  var values = sheet.getRange(1, col, maxRows, 1).getValues();

  for (var r = values.length - 1; r >= 0; r--) {
    var val = values[r][0];
    if (val !== null && val !== undefined && val.toString().trim() !== "") {
      return r + 1; // 1-based index
    }
  }
  return 1;
}
