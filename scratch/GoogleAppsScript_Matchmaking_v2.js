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
  BACKEND_API_URL: "https://prueba-daily.agentesia.cloud",
  PSYCHOLOGIST_SHEET_PREFIX: "MATCHES ",
  TROUBLE_SHEET_NAME: "TROUBLE MATCHES",
  REFUNDS_SHEET_NAME: "REFUNDS PENDIENTES",
  VUELVE_A_PAGAR_SHEET_NAME: "VUELVE A PAGAR",
  REVISION_MARIA_SHEET_NAME: "REVISIÓN MARÍA",
  MATCHES_SHEET_NAME: "MATCHES",
  CONFIG_ESTADOS_SHEET_NAME: "⚙️ CONFIG ESTADOS",
  MARIA_EMAIL: "agente.col.bot@gmail.com",
  PRIORITY_SHEET_NAME: "PERSONAS DÍFICILES",
  PROFILES_SHEET_NAME: "PROFILES",
  TIMEZONE: "America/Bogota",
  LOCK_TIMEOUT_MS: 30000,
  VALID_PSYCHOLOGISTS: [
    "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA"
  ],
  PSYCHOLOGIST_ALIASES: {
    "MAPE": "MAPE D",
    "MAPE D": "MAPE D",
    "MARIA PAULA": "MAPE D",
    "MARÍA PAULA": "MAPE D",
    "STEFF": "STEFFY",
    "STEFFY": "STEFFY",
    "MANU": "MANU",
    "MANU 1": "MANU",
    "MANU 2": "MANU",
    "SILVI": "SILVI",
    "SILVANA": "SILVI",
    "ANA": "ANA",
    "JENN": "JENN",
    "SOFI": "SOFI",
    "ALEJA": "ALEJA",
    "PIA": "PIA",
    "ISA": "ISA",
    "ISABELLA": "ISA"
  },
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

// ─── 1. DISPARADOR PRINCIPAL (SIMPLE & INSTALABLE) ──────────────────────────

function onEdit(e) {
  Logger.log("=== onEdit (Simple Trigger) Disparado ===");
  onEditInstallable(e);
}

function onEditInstallable(e) {
  Logger.log("=== onEditInstallable Disparado ===");
  if (!e || !e.range) {
    Logger.log("AVISO: Evento 'e' o 'e.range' no definido.");
    return;
  }

  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  var editVal = e.value || "";

  Logger.log("Pestaña editada: '" + sheetName + "', Fila: " + row + ", Columna: " + col + ", Valor: '" + editVal + "'");

  // Ignorar fila 1 de encabezados
  if (row <= 1) {
    Logger.log("Ignorando edición en fila 1 (encabezados).");
    return;
  }

  var upperSheetName = sheetName.trim().toUpperCase();

  // A. Pestañas de psicólogas ("MATCHES SILVI", "MATCHES JENN", "MATCHES ANA ", etc.)
  if (upperSheetName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upperSheetName !== "MATCHES") {
    Logger.log("Despachando a handlePsychologistSheetEdit...");
    handlePsychologistSheetEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === CONFIG.VUELVE_A_PAGAR_SHEET_NAME) {
    Logger.log("Despachando a handleVuelveAPagarEdit...");
    handleVuelveAPagarEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === CONFIG.REFUNDS_SHEET_NAME) {
    Logger.log("Despachando a handleRefundsSheetEdit...");
    handleRefundsSheetEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === CONFIG.PRIORITY_SHEET_NAME || upperSheetName === "PERSONAS DIFICILES" || upperSheetName === "MATCHES QUE HACEN FALTA") {
    Logger.log("Despachando a handlePersonasDificilesEdit...");
    handlePersonasDificilesEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === CONFIG.PROFILES_SHEET_NAME || upperSheetName === "PROFILES") {
    Logger.log("Despachando a handleProfilesEdit...");
    handleProfilesEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === (CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA").toUpperCase() || upperSheetName === "REVISION MARIA") {
    Logger.log("Despachando a handleRevisionMariaEdit...");
    handleRevisionMariaEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === (CONFIG.MATCHES_SHEET_NAME || "MATCHES").toUpperCase()) {
    Logger.log("Despachando a handleMatchesEdit...");
    handleMatchesEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === (CONFIG.CONFIG_ESTADOS_SHEET_NAME || "⚙️ CONFIG ESTADOS").toUpperCase() || upperSheetName === "CONFIG ESTADOS") {
    Logger.log("Despachando a handleConfigEstadosEdit...");
    handleConfigEstadosEdit(sheet, row, col);
  } else {
    Logger.log("Pestaña '" + sheetName + "' no requiere procesamiento en disparador.");
  }
}

// ─── 2. GESTIÓN DE PESTAÑAS DE PSICÓLOGAS ───────────────────────────────────

function handlePsychologistSheetEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var statusCol = headers["STATUS"];
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"];
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || headers["CANDIDATO"] || headers["MATCH"];
  var psycBCol = headers["PSICÓLOGA DE B"] || headers["PSICOLOGA DE B"] || headers["PSICOLOGA B"] || headers["PSICÓLOGA B"];

  var currentPsyc = normalizePsychologistName(sheet.getName());

  // ── A. CRUCE AUTOMÁTICO DE PSICÓLOGA DE B AL EDITAR PERSON B ──────────────
  if (personBCol && col === personBCol) {
    var personBCell = getCellData(sheet, row, personBCol);
    if (!psycBCol) {
      psycBCol = ensurePsycBColumn(sheet, headers, personBCol);
    }
    if (psycBCol) {
      if (personBCell && personBCell.text) {
        var ownerPsyc = findPsychologistForPerson(personBCell);
        if (ownerPsyc) {
          if (ownerPsyc === currentPsyc) {
            sheet.getRange(row, psycBCol).setValue(ownerPsyc + " (Interno)").setBackground(null);
          } else {
            sheet.getRange(row, psycBCol).setValue(ownerPsyc).setBackground("#E8EAED");
          }
          Logger.log("✅ Psicóloga de B detectada automáticamente: '" + ownerPsyc + "'");
        } else {
          sheet.getRange(row, psycBCol).setValue("").setBackground("#FFF2CC");
          Logger.log("⚠️ No se encontró psicóloga para Persona B ('" + personBCell.text + "')");
        }
      } else {
        sheet.getRange(row, psycBCol).setValue("").setBackground(null);
      }
    }
    return;
  }

  // ── B. EDICIÓN DE STATUS ──────────────────────────────────────────────────
  if (!statusCol || col !== statusCol) return;

  var statusVal = (newValue || sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase();
  if (!statusVal) return;

  var fechaCol = headers["FECHA"];
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

  // ── C. DISPARADOR DE FECHA: Únicamente al pasar a HECHO o HECHO POR MAPE ──
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

  // ── D. FILA ESPEJO & DOBLE APROBACIÓN ANTES DE MARÍA ───────────────────────
  if (statusVal === "HECHO" || statusVal === "HECHO POR MAPE" || statusVal === "APROBADO") {
    if (personACell && personBCell && personBName) {
      var ownerPsycB = findPsychologistForPerson(personBCell);

      // Si es un match cruzado (Psicóloga A != Psicóloga B)
      if (ownerPsycB && ownerPsycB !== currentPsyc) {
        withScriptLock(function() {
          // 1. Crear o sincronizar fila espejo en la pestaña de Psicóloga B
          crearOActualizarFilaEspejo(sheet, row, currentPsyc, ownerPsycB, personACell, personBCell, city, pref, plan, obs);

          // 2. Sincronizar a REVISIÓN MARÍA con estado de doble aprobación
          syncToRevisionMaria({
            currentPsyc: currentPsyc,
            psycA: currentPsyc,
            psycB: ownerPsycB,
            city: city,
            pref: pref,
            planA: plan,
            personACell: personACell,
            personBCell: personBCell,
            obs: obs,
            origenTab: sheet.getName(),
            origenFila: row,
            statusAprobacion: (statusVal === "APROBADO" ? "APROBADO POR PSICÓLOGAS" : "ESPERANDO APROBACIÓN DE " + ownerPsycB)
          });
        });
      } else {
        // Match interno (misma psicóloga para A y B)
        withScriptLock(function() {
          syncToRevisionMaria({
            currentPsyc: currentPsyc,
            psycA: currentPsyc,
            psycB: currentPsyc,
            city: city,
            pref: pref,
            planA: plan,
            personACell: personACell,
            personBCell: personBCell,
            obs: obs,
            origenTab: sheet.getName(),
            origenFila: row,
            statusAprobacion: "APROBADO POR PSICÓLOGA"
          });
        });
      }
    }
  }

  // ── E. NOT APPROVED / TROUBLEMAKER: Fila intacta + Nueva fila al final ───
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

  // ── F. TROUBLEMAKER: Copiado hacia pestaña TROUBLE MATCHES ───────────────
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

  // ── F. PROFILE PRIORITARIO: Transferencia automática desde EN PAUSA INDEFINIDA y TROUBLEMAKER ──
  if (statusVal === "EN PAUSA INDEFINIDA") {
    withScriptLock(function() {
      syncToPriorityQueue(sheet.getName(), {
        personACell: personACell,
        plan: plan,
        city: city,
        pref: pref,
        status: statusVal,
        observaciones: obs
      });
    });
  }

  if (statusVal === "TROUBLEMAKER") {
    var hasOtherActive = checkActiveMatchesInSheet(sheet, headers, personAName, row);
    if (!hasOtherActive) {
      withScriptLock(function() {
        syncToPriorityQueue(sheet.getName(), {
          personACell: personACell,
          plan: plan,
          city: city,
          pref: pref,
          status: "TROUBLEMAKER (REASIGNAR)",
          observaciones: "Reasignación prioritaria tras TROUBLEMAKER" + (obs ? " | " + obs : "")
        });
      });
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
        pref: "",
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

  var idCol = headers["ID"] || 1;
  sheet.getRange(newRow, idCol).setFormula("=ROW()-1");

  if (headers["PAIS"]) sheet.getRange(newRow, headers["PAIS"]).setValue(data.pais || "");

  var cityCol = headers["CITY"] || headers["CIUDAD"];
  if (cityCol) {
    sheet.getRange(newRow, cityCol).setValue(data.city || "");
    if (!data.city) {
      sheet.getRange(newRow, cityCol).setBackground("#FFF2CC").setNote("Ciudad requerida (sin dato en origen)");
    }
  }

  var prefCol = headers["PREF"] || headers["PREFERENCIA"];
  if (prefCol) {
    sheet.getRange(newRow, prefCol).setValue(data.pref || "");
    if (!data.pref) {
      sheet.getRange(newRow, prefCol).setBackground("#FFF2CC").setNote("Preferencia / Orientación requerida (sin dato en origen)");
    }
  }

  var planCol = headers["PLAN"] || headers["PLAN TIER"];
  if (planCol) {
    sheet.getRange(newRow, planCol).setValue(data.plan || "");
    if (!data.plan) {
      sheet.getRange(newRow, planCol).setBackground("#FFF2CC").setNote("Plan requerido");
    }
  }

  // 3. PRESERVAR HIPERVÍNCULO CRM DE PERSONA A
  if (headers["PERSON A"] && data.personACell) {
    setCellData(sheet, newRow, headers["PERSON A"], data.personACell);
  } else if (headers["PERSONA A"] && data.personACell) {
    setCellData(sheet, newRow, headers["PERSONA A"], data.personACell);
  }

  if (headers["PERSON B"]) sheet.getRange(newRow, headers["PERSON B"]).setValue("");
  if (headers["PERSONA B"]) sheet.getRange(newRow, headers["PERSONA B"]).setValue("");

  if (headers["PSICÓLOGA DE B"]) sheet.getRange(newRow, headers["PSICÓLOGA DE B"]).setValue("");

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
 * Escribe en una celda preservando hipervínculos con RichTextValue nativo.
 * EVITA setFormula('=HYPERLINK(...)') para no generar #ERROR! por configuraciones regionales de coma/punto y coma.
 */
function setCellData(sheet, row, col, cellData) {
  if (!col || !cellData) return;
  var range = sheet.getRange(row, col);

  // 1. Si ya tiene RichTextValue con LinkUrl nativo
  if (cellData.richText && cellData.richText.getLinkUrl()) {
    range.setRichTextValue(cellData.richText);
    return;
  }

  // 2. Si viene de fórmula =HYPERLINK("url", "texto"), convertir a RichTextValue nativo
  if (cellData.formula && cellData.formula.indexOf("HYPERLINK") !== -1) {
    var match = cellData.formula.match(/HYPERLINK\(\s*["']([^"']+)["']\s*[,;]\s*["']([^"']+)["']\s*\)/i);
    if (match) {
      var url = match[1];
      var label = match[2];
      var rtv = SpreadsheetApp.newRichTextValue()
        .setText(label)
        .setLinkUrl(url)
        .build();
      range.setRichTextValue(rtv);
      return;
    }
  }

  // 3. Si tiene RichTextValue con formato de texto
  if (cellData.richText && cellData.richText.getText()) {
    range.setRichTextValue(cellData.richText);
    return;
  }

  // 4. Valor plano por defecto
  range.setValue(cellData.value !== undefined ? cellData.value : cellData.text);
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
  var col = checkColIndex;
  if (!col || col <= 0) {
    var headers = getSheetHeaders(sheet);
    col = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"] || 1;
  }
  var maxRows = sheet.getMaxRows();
  if (maxRows <= 1) return 1;
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
  var sheetName = CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA";
  var revisionSheet = ss.getSheetByName(sheetName) || ss.getSheetByName("REVISION MARIA");

  var headers = [
    "PSICÓLOGA", "CITY", "PREF", "PLAN", "PERSON A", "PERSON B", "FECHA", "OBSERVACIONES", "ORIGEN (PESTAÑA)", "FILA ORIGEN", "APROBAR"
  ];

  if (!revisionSheet) {
    revisionSheet = ss.insertSheet(sheetName);
    revisionSheet.setTabColor("#D5A6BD");
  }

  // Asegurar encabezados
  revisionSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  revisionSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#D5A6BD")
    .setFontColor("#000000");
  revisionSheet.setFrozenRows(1);

  // Limpiar contenido anterior
  var lastRow = revisionSheet.getLastRow();
  if (lastRow > 1) {
    revisionSheet.getRange(2, 1, lastRow - 1, headers.length).clear({ contentsOnly: true });
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

      var lastCol = curSheet.getLastColumn();
      var totalRows = curSheet.getLastRow();
      if (totalRows <= 1 || lastCol < 1) continue;

      // ⚡ LECTURA BATCH ULTRA-RÁPIDA (1 sola llamada RPC por pestaña)
      var sheetValues = curSheet.getRange(1, 1, totalRows, lastCol).getValues();
      var sheetRichTexts = curSheet.getRange(1, 1, totalRows, lastCol).getRichTextValues();

      var statusIdx = statusCol - 1;
      var personAIdx = personACol - 1;
      var personBIdx = personBCol ? personBCol - 1 : -1;
      var cityIdx = cityCol ? cityCol - 1 : -1;
      var prefIdx = prefCol ? prefCol - 1 : -1;
      var planIdx = planCol ? planCol - 1 : -1;
      var fechaIdx = fechaCol ? fechaCol - 1 : -1;
      var obsIdx = obsCol ? obsCol - 1 : -1;

      for (var r = 1; r < sheetValues.length; r++) {
        var rowVal = sheetValues[r];
        var st = (rowVal[statusIdx] || "").toString().trim().toUpperCase();

        if (st === "HECHO" || st === "HECHO POR MAPE") {
          var realRow = r + 1; // 1-indexed row

          var cityVal = cityIdx !== -1 ? (rowVal[cityIdx] || "").toString().trim() : "";
          var prefVal = prefIdx !== -1 ? (rowVal[prefIdx] || "").toString().trim() : "";
          var planVal = planIdx !== -1 ? (rowVal[planIdx] || "").toString().trim() : "";
          var fechaVal = fechaIdx !== -1 ? (rowVal[fechaIdx] || "") : "";
          var obsVal = obsIdx !== -1 ? (rowVal[obsIdx] || "").toString().trim() : "";

          var richTextA = sheetRichTexts[r][personAIdx];
          var richTextB = personBIdx !== -1 ? sheetRichTexts[r][personBIdx] : null;

          var textA = richTextA ? richTextA.getText() : (rowVal[personAIdx] || "").toString().trim();
          var textB = richTextB ? richTextB.getText() : (personBIdx !== -1 ? (rowVal[personBIdx] || "").toString().trim() : "");

          if (!textA) continue;

          collectedRows.push([
            psycName, cityVal, prefVal, planVal, textA, textB, fechaVal, obsVal, curName, realRow, ""
          ]);

          collectedRichTextsA.push(richTextA);
          collectedRichTextsB.push(richTextB);
        }
      }
    }
  }

  // ⚡ ESCRITURA BATCH ULTRA-RÁPIDA
  if (collectedRows.length > 0) {
    if (revisionSheet.getMaxRows() < collectedRows.length + 1) {
      revisionSheet.insertRowsAfter(revisionSheet.getMaxRows(), (collectedRows.length + 1) - revisionSheet.getMaxRows() + 10);
    }

    var targetRange = revisionSheet.getRange(2, 1, collectedRows.length, headers.length);
    targetRange.setValues(collectedRows);

    // Inyectar hipervínculos en batch por columna
    var rangeA = revisionSheet.getRange(2, 5, collectedRows.length, 1);
    var rangeB = revisionSheet.getRange(2, 6, collectedRows.length, 1);

    var richColA = collectedRichTextsA.map(function(rt) { return [rt || SpreadsheetApp.newRichTextValue().setText("").build()]; });
    var richColB = collectedRichTextsB.map(function(rt) { return [rt || SpreadsheetApp.newRichTextValue().setText("").build()]; });

    rangeA.setRichTextValues(richColA);
    rangeB.setRichTextValues(richColB);
  }

  Logger.log("✅ Pestaña 'REVISIÓN MARÍA' reconstruida exitosamente con " + collectedRows.length + " filas en batch.");
  ss.toast("REVISIÓN MARÍA actualizada: " + collectedRows.length + " matches listos.", "Revisión Lista", 5);
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

// ─── 9. PROFILE PRIORITARIO: PESTAÑA 'PERSONAS DÍFICILES' ───────────────────

function resolvePlanSlots(rawPlan) {
  if (!rawPlan) return 0;
  var clean = rawPlan.toString().toUpperCase().trim().replace(/\s+/g, " ");
  if (CONFIG.PLAN_SLOTS_MAP[clean]) return CONFIG.PLAN_SLOTS_MAP[clean];
  if (clean.indexOf("VIP") >= 0 || clean.indexOf("4 DATE") >= 0 || clean.indexOf("4 CITA") >= 0) return 4;
  if (clean.indexOf("ESTANDAR") >= 0 || clean.indexOf("ESTÁNDAR") >= 0 || clean.indexOf("3 DATE") >= 0 || clean.indexOf("3 CITA") >= 0) return 3;
  if (clean.indexOf("BASICO") >= 0 || clean.indexOf("BÁSICO") >= 0 || clean.indexOf("2 DATE") >= 0 || clean.indexOf("2 CITA") >= 0 || clean.indexOf("1 CITA") >= 0) return 2;
  return 0;
}

function handlePersonasDificilesEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"] || 1;
  var psycCol = headers["INTERVIEWED BY:"] || headers["INTERVIEWED BY"] || headers["PSICOLOGA"] || headers["PSICÓLOGA"] || 2;
  var planCol = headers["PLAN"] || headers["PLAN TIER"] || 3;
  var ciudadCol = headers["CIUDAD"] || headers["CITY"] || 4;
  var prefCol = headers["PREF"] || headers["PREFERENCIA"] || 5;
  var fechaIngresoCol = headers["FECHA INGRESO"] || headers["FECHA"] || 6;
  var obsCol = headers["OBSERVACIONES"] || headers["OBSERVACION"] || headers["NOTAS"] || 7;
  var statusCol = headers["STATUS"] || 8;
  var slotsCol = headers["SLOTS CREADOS"] || headers["SLOTS"] || 9;

  var personACell = getCellData(sheet, row, personACol);
  var personAName = personACell ? personACell.text : "";
  if (!personAName) return;

  var rawPsyc = (sheet.getRange(row, psycCol).getValue() || "").toString().trim();
  var rawPlan = (sheet.getRange(row, planCol).getValue() || "").toString().trim();
  var ciudad = ciudadCol ? (sheet.getRange(row, ciudadCol).getValue() || "").toString().trim() : "";
  var pref = prefCol ? (sheet.getRange(row, prefCol).getValue() || "").toString().trim() : "";
  var obs = obsCol ? (sheet.getRange(row, obsCol).getValue() || "").toString().trim() : "";
  var slotsCreados = slotsCol ? (sheet.getRange(row, slotsCol).getValue() || "").toString().trim() : "";

  // 1. DEDUPLICACIÓN: si ya tiene slots creados generados, abortar
  if (slotsCreados && slotsCreados.toUpperCase().indexOf("SLOTS CREADOS") >= 0) return;

  // 2. NORMALIZACIÓN Y VALIDACIÓN DE PSICÓLOGA (Interviewed by:)
  var cleanPsyc = normalizePsychologistName(rawPsyc);
  var psycValida = !!cleanPsyc;

  if (!psycValida) {
    sheet.getRange(row, psycCol)
      .setBackground("#FFF2CC")
      .setNote("Psicóloga pendiente de asignación — Seleccione una de las 10 psicólogas activas: JENN, ANA, SILVI, STEFFY, SOFI, MAPE D, ALEJA, MANU, PIA, ISA.");
    if (slotsCol && (!slotsCreados || slotsCreados.toUpperCase().indexOf("PENDIENTE") >= 0)) {
      sheet.getRange(row, slotsCol).setValue("PENDIENTE PSICÓLOGA").setBackground("#FFF2CC");
    }
  } else {
    // Si era un alias (ej: MAPE -> MAPE D), actualizar celda con nombre oficial
    if (rawPsyc.toUpperCase() !== cleanPsyc) {
      sheet.getRange(row, psycCol).setValue(cleanPsyc);
    }
    sheet.getRange(row, psycCol).setBackground(null).clearNote();
  }

  // 3. VALIDACIÓN DE PLAN (NO BLOQUEANTE: marca en amarillo y espera)
  var numSlots = resolvePlanSlots(rawPlan);
  var planValido = numSlots > 0;

  if (!planValido) {
    sheet.getRange(row, planCol)
      .setBackground("#FFF2CC")
      .setNote("Falta el plan — María o Servicio al Cliente lo completa a mano (Básico 40k = 2 slots, Estándar 65k = 3 slots, VIP 195k = 4 slots)");
    if (slotsCol && psycValida && (!slotsCreados || slotsCreados.toUpperCase().indexOf("PENDIENTE") >= 0)) {
      sheet.getRange(row, slotsCol).setValue("PENDIENTE PLAN").setBackground("#FFF2CC");
    }
  } else {
    sheet.getRange(row, planCol).setBackground(null).clearNote();
  }

  // 4. SI FALTA PSICÓLOGA O PLAN: no crear slots aún (no bloquea el resto del archivo)
  if (!psycValida || !planValido) {
    return;
  }

  // 5. BÚSQUEDA DE PESTAÑA DE PSICÓLOGA
  var psycSheet = findPsychologistSheet(cleanPsyc);
  if (!psycSheet) {
    sheet.getRange(row, psycCol)
      .setBackground("#FFF2CC")
      .setNote("No se encontró la pestaña 'MATCHES " + cleanPsyc + "'.");
    return;
  }

  // 6. GENERACIÓN AUTOMÁTICA DE SLOTS PRIORITARIOS
  withScriptLock(function() {
    // Fecha de ingreso
    if (fechaIngresoCol) {
      var currentFecha = sheet.getRange(row, fechaIngresoCol).getValue();
      if (!currentFecha) {
        var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
        sheet.getRange(row, fechaIngresoCol).setValue(nowStr);
      }
    }

    var psycHeaders = getSheetHeaders(psycSheet);
    for (var i = 1; i <= numSlots; i++) {
      appendPrioritySlotRow(psycSheet, psycHeaders, {
        city: ciudad,
        pref: pref || "",
        plan: rawPlan,
        personACell: personACell,
        slotIndex: i,
        totalSlots: numSlots,
        observaciones: obs
      });
    }

    // Marcar como procesado en PERSONAS DÍFICILES (verde oficial #D9EAD3)
    var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
    if (slotsCol) {
      sheet.getRange(row, slotsCol)
        .setValue(numSlots + " SLOTS CREADOS (" + todayStr + ")")
        .setBackground("#D9EAD3")
        .clearNote();
    }
    if (statusCol) {
      var curSt = sheet.getRange(row, statusCol).getValue();
      if (!curSt || curSt.toString().trim() === "" || curSt.toString().toUpperCase().indexOf("PENDIENTE") >= 0) {
        sheet.getRange(row, statusCol).setValue("SLOTS GENERADOS").setBackground(null).clearNote();
      }
    }
  });
}

function appendPrioritySlotRow(sheet, headers, data) {
  var checkCol = headers["PERSON A"] || headers["PERSONA A"] || 1;
  var trueLastRow = getTrueLastRow(sheet, checkCol);
  var newRow = trueLastRow + 1;

  var idCol = headers["ID"] || 1;
  sheet.getRange(newRow, idCol).setFormula("=ROW()-1");

  if (headers["PAIS"]) sheet.getRange(newRow, headers["PAIS"]).setValue(data.pais || "");

  var cityCol = headers["CITY"] || headers["CIUDAD"];
  if (cityCol) {
    sheet.getRange(newRow, cityCol).setValue(data.city || "");
    if (!data.city) {
      sheet.getRange(newRow, cityCol).setBackground("#FFF2CC").setNote("Ciudad requerida (sin dato en origen)");
    }
  }

  var prefCol = headers["PREF"] || headers["PREFERENCIA"];
  if (prefCol) {
    sheet.getRange(newRow, prefCol).setValue(data.pref || "");
    if (!data.pref) {
      sheet.getRange(newRow, prefCol).setBackground("#FFF2CC").setNote("Preferencia / Orientación requerida (sin dato en origen)");
    }
  }

  var planCol = headers["PLAN"] || headers["PLAN TIER"];
  if (planCol) {
    sheet.getRange(newRow, planCol).setValue(data.plan || "");
    if (!data.plan) {
      sheet.getRange(newRow, planCol).setBackground("#FFF2CC").setNote("Plan requerido");
    }
  }

  if (headers["PERSON A"] && data.personACell) {
    setCellData(sheet, newRow, headers["PERSON A"], data.personACell);
  } else if (headers["PERSONA A"] && data.personACell) {
    setCellData(sheet, newRow, headers["PERSONA A"], data.personACell);
  }

  if (headers["PERSON B"]) sheet.getRange(newRow, headers["PERSON B"]).setValue("");
  if (headers["PERSONA B"]) sheet.getRange(newRow, headers["PERSONA B"]).setValue("");

  if (headers["PSICÓLOGA DE B"]) sheet.getRange(newRow, headers["PSICÓLOGA DE B"]).setValue("");

  if (headers["FECHA"]) sheet.getRange(newRow, headers["FECHA"]).setValue("");
  if (headers["STATUS"]) {
    sheet.getRange(newRow, headers["STATUS"]).setValue("Listo para match");
  }

  var priorityTag = "[PRIORITARIO Slot " + data.slotIndex + "/" + data.totalSlots + "]";
  var finalObs = priorityTag + (data.observaciones ? " " + data.observaciones : "");
  if (headers["OBSERVACIONES"]) sheet.getRange(newRow, headers["OBSERVACIONES"]).setValue(finalObs);
  if (headers["OBSERVACION"]) sheet.getRange(newRow, headers["OBSERVACION"]).setValue(finalObs);

  // Unificar toda la fila con el color prioritario #FFF2CC
  var lastCol = sheet.getLastColumn() || 11;
  sheet.getRange(newRow, 1, 1, lastCol).setBackground("#FFF2CC");
}

function syncToPriorityQueue(sourceSheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PRIORITY_SHEET_NAME || "PERSONAS DÍFICILES";
  var prioritySheet = ss.getSheetByName(sheetName) || ss.getSheetByName("PERSONAS DIFICILES") || ss.getSheetByName("MATCHES QUE HACEN FALTA");
  if (!prioritySheet) return;

  var headers = getSheetHeaders(prioritySheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 1;
  var trueLastRow = getTrueLastRow(prioritySheet, personACol);
  var targetRow = trueLastRow + 1;

  var psycName = sourceSheetName.replace(CONFIG.PSYCHOLOGIST_SHEET_PREFIX, "").trim();
  var cleanPsyc = normalizePsychologistName(psycName) || psycName;

  var psycCol = headers["INTERVIEWED BY:"] || headers["INTERVIEWED BY"] || headers["PSICOLOGA"] || 2;
  var planCol = headers["PLAN"] || headers["PLAN TIER"] || 3;
  var ciudadCol = headers["CIUDAD"] || headers["CITY"] || 4;
  var prefCol = headers["PREF"] || headers["PREFERENCIA"] || 5;
  var fechaIngresoCol = headers["FECHA INGRESO"] || headers["FECHA"] || 6;
  var obsCol = headers["OBSERVACIONES"] || headers["OBSERVACION"] || 7;
  var statusCol = headers["STATUS"] || 8;
  var slotsCol = headers["SLOTS CREADOS"] || headers["SLOTS"] || 9;

  if (personACol && data.personACell) setCellData(prioritySheet, targetRow, personACol, data.personACell);
  if (psycCol) prioritySheet.getRange(targetRow, psycCol).setValue(cleanPsyc);
  if (planCol) prioritySheet.getRange(targetRow, planCol).setValue(data.plan || "");
  if (ciudadCol) prioritySheet.getRange(targetRow, ciudadCol).setValue(data.city || "");
  if (prefCol) prioritySheet.getRange(targetRow, prefCol).setValue(data.pref || "");
  if (fechaIngresoCol) prioritySheet.getRange(targetRow, fechaIngresoCol).setValue(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm"));
  if (obsCol) prioritySheet.getRange(targetRow, obsCol).setValue(data.observaciones || "");
  if (statusCol) prioritySheet.getRange(targetRow, statusCol).setValue(data.status || "PENDIENTE");
  if (slotsCol) prioritySheet.getRange(targetRow, slotsCol).setValue(data.status === "EN PAUSA INDEFINIDA" ? "EN PAUSA" : "");
}

function normalizePsychologistName(rawName) {
  if (!rawName) return null;
  var trimmed = rawName.toString().trim();
  var upper = trimmed.toUpperCase();

  // 1. Coincidencia exacta en lista oficial
  for (var i = 0; i < CONFIG.VALID_PSYCHOLOGISTS.length; i++) {
    if (upper === CONFIG.VALID_PSYCHOLOGISTS[i]) {
      return CONFIG.VALID_PSYCHOLOGISTS[i];
    }
  }

  // 2. Coincidencia en mapa de alias
  if (CONFIG.PSYCHOLOGIST_ALIASES[upper]) {
    return CONFIG.PSYCHOLOGIST_ALIASES[upper];
  }

  var normalized = upper.replace(/\s+/g, " ");
  if (CONFIG.PSYCHOLOGIST_ALIASES[normalized]) {
    return CONFIG.PSYCHOLOGIST_ALIASES[normalized];
  }

  return null; // Inválido (ej: MARI PAZ, LAU, Steff/Manu, vacío)
}

function checkActiveMatchesInSheet(sheet, headers, personAName, currentRow) {
  if (!personAName) return false;
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 1;
  var statusCol = headers["STATUS"];
  if (!statusCol) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var r = i + 2;
    if (r === currentRow) continue;
    var pa = (values[i][personACol - 1] || "").toString().trim().toUpperCase();
    var st = (values[i][statusCol - 1] || "").toString().trim().toUpperCase();
    if (pa === personAName.toUpperCase()) {
      if (st === "LISTO PARA MATCH" || st === "HECHO" || st === "HECHO POR MAPE" || st === "APROBADO") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extrae el ID numérico del cliente a partir de cualquier formato de URL o fórmula de SmartMatchApp.
 * Soporta:
 * - https://dailylover.smartmatchapp.com/client/3935
 * - https://dailylover.smartmatchapp.com/#!/client/4021/
 * - https://dailylover.smartmatchapp.com/client/4021/
 * - =HYPERLINK("https://.../client/3935", "Nombre")
 * - =HYPERLINK("https://.../#!/client/4021/"; "Nombre")
 * - 3935
 * @param {string} urlOrFormula - URL, fórmula o ID
 * @returns {string} - ID numérico extraído o "" si no se encuentra.
 */
function extractCrmIdFromUrl(urlOrFormula) {
  if (!urlOrFormula) return "";
  var str = urlOrFormula.toString().trim();
  if (!str) return "";

  // 1. Si ya es un ID numérico puro
  if (/^\d+$/.test(str)) {
    return str;
  }

  // 2. Regex universal para SmartMatchApp (client/XXXX, client/#!/XXXX, #!/client/XXXX)
  var match = str.match(/client\/(\d+)/i) || str.match(/client\/#!\/(\d+)/i) || str.match(/#!\/client\/(\d+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // 3. Formatos con parámetros ?id=XXXX o terminación numérica /XXXX/
  var matchParam = str.match(/[?&]id=(\d+)/i) || str.match(/\/(\d+)\/?$/);
  if (matchParam && matchParam[1]) {
    return matchParam[1];
  }

  return "";
}

/**
 * Busca si Persona B ya existe como Persona A en alguna de las 10 pestañas de psicólogas.
 * Compara primero por CRM ID (extraído del enlace del perfil) y por nombre normalizado como respaldo.
 * @param {Object} personBCell - Objeto { text, link, crmId }
 * @param {Sheet} currentSheet - Pestaña actual
 * @returns {string} - Nombre oficial de la psicóloga asignada a Persona A o "" si no se encuentra.
 */
function findPsychologistForPersonA(personBCell, currentSheet) {
  if (!personBCell || (!personBCell.text && !personBCell.link)) return "";

  var targetCrmId = personBCell.crmId || extractCrmIdFromUrl(personBCell.link);
  var targetName = (personBCell.text || "").trim().toLowerCase();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var sName = s.getName().trim().toUpperCase();

    // Solo inspeccionar pestañas de psicólogas activas
    if (sName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sName !== "MATCHES") {
      var psycRaw = sName.replace(CONFIG.PSYCHOLOGIST_SHEET_PREFIX, "").trim();
      var psycName = normalizePsychologistName(psycRaw) || psycRaw;

      var headers = getSheetHeaders(s);
      var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"];
      if (!personACol) continue;

      var lastRow = getTrueLastRow(s, personACol);
      if (lastRow < 2) continue;

      var richValues = s.getRange(2, personACol, lastRow - 1, 1).getRichTextValues();

      for (var r = 0; r < richValues.length; r++) {
        var rt = richValues[r][0];
        if (!rt) continue;

        var cellText = rt.getText().trim();
        if (!cellText) continue;

        var cellLink = rt.getLinkUrl() || "";
        var cellCrmId = extractCrmIdFromUrl(cellLink);

        // 1. Comparar por CRM ID si está presente (evita homónimos)
        if (targetCrmId && cellCrmId && targetCrmId === cellCrmId) {
          return psycName;
        }

        // 2. Comparar por nombre normalizado
        if (targetName && cellText.toLowerCase() === targetName) {
          return psycName;
        }
      }
    }
  }

  return "";
}

/**
 * Asegura la existencia de la columna 'PSICÓLOGA DE B' al lado de 'PERSON B'.
 */
function ensurePsycBColumn(sheet, headers, personBCol) {
  var psycBCol = headers["PSICÓLOGA DE B"] || headers["PSICOLOGA DE B"] || headers["PSICOLOGA B"] || headers["PSICÓLOGA B"];
  if (psycBCol) return psycBCol;

  try {
    sheet.insertColumnAfter(personBCol);
    var newCol = personBCol + 1;
    sheet.getRange(1, newCol).setValue("PSICÓLOGA DE B");
    return newCol;
  } catch (e) {
    Logger.log("No se pudo insertar columna PSICÓLOGA DE B: " + e.message);
    return null;
  }
}

// ─── 10. AUTOMATIZACIÓN DE PROFILES (Fanning a Pestañas de Psicólogas) ─────────

/**
 * Consulta el endpoint /resolve-profile del backend de Daily Lover para obtener
 * datos en tiempo real del CRM SmartMatchApp (plan, ciudad, preferencia, CRM ID).
 */
function fetchProfileFromBackend(queryOrUrl) {
  if (!queryOrUrl) return null;
  var apiUrl = (CONFIG.BACKEND_API_URL || "https://prueba-daily.agentesia.cloud") + "/api/v1/matchmaking/resolve-profile";
  
  try {
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ url_or_query: queryOrUrl.toString().trim() }),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(apiUrl, options);
    var code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      Logger.log("Error al consultar resolve-profile (HTTP " + code + "): " + response.getContentText());
      return null;
    }
  } catch (err) {
    Logger.log("Excepción en fetchProfileFromBackend: " + err);
    return null;
  }
}

/**
 * Verifica si una persona ya tiene slots creados en CUALQUIERA de las 10 pestañas de psicóloga
 * o en PERSONAS DÍFICILES (evita duplicados entre psicólogas o por reasignaciones).
 */
function checkExistingSlots(personACell, targetPsycSheet) {
  if (!personACell || !personACell.text) return null;
  var targetName = personACell.text.trim().toLowerCase();
  var targetUrl = (personACell.richText ? personACell.richText.getLinkUrl() : "") || personACell.formula || "";
  var targetCrmId = extractCrmIdFromUrl(targetUrl);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Verificar en PERSONAS DÍFICILES
  var prioritySheet = ss.getSheetByName(CONFIG.PRIORITY_SHEET_NAME || "PERSONAS DÍFICILES") || ss.getSheetByName("PERSONAS DIFICILES") || ss.getSheetByName("MATCHES QUE HACEN FALTA");
  if (prioritySheet) {
    var pHeaders = getSheetHeaders(prioritySheet);
    var pPersonCol = pHeaders["PERSON A"] || pHeaders["PERSONA A"] || 1;
    var pSlotsCol = pHeaders["SLOTS CREADOS"] || pHeaders["SLOTS"] || 9;
    var lastRowP = getTrueLastRow(prioritySheet, pPersonCol);
    if (lastRowP > 1) {
      var pValues = prioritySheet.getRange(2, 1, lastRowP - 1, prioritySheet.getLastColumn()).getValues();
      var pRichValues = prioritySheet.getRange(2, pPersonCol, lastRowP - 1, 1).getRichTextValues();
      for (var i = 0; i < pValues.length; i++) {
        var rowSlots = (pValues[i][pSlotsCol - 1] || "").toString().trim().toUpperCase();
        if (rowSlots.indexOf("SLOTS CREADOS") >= 0) {
          var rt = pRichValues[i][0];
          var cellText = rt ? rt.getText().trim().toLowerCase() : (pValues[i][pPersonCol - 1] || "").toString().trim().toLowerCase();
          var cellLink = rt ? rt.getLinkUrl() || "" : "";
          var cellCrmId = extractCrmIdFromUrl(cellLink);

          if ((targetCrmId && cellCrmId && targetCrmId === cellCrmId) || (targetName && cellText === targetName)) {
            return "YA GENERADO EN PERSONAS DÍFICILES";
          }
        }
      }
    }
  }

  // 2. Verificar a través de TODAS las 10 pestañas de psicólogas activas
  var allSheets = ss.getSheets();
  for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
    var s = allSheets[sIdx];
    var sName = s.getName().trim().toUpperCase();

    if (sName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sName !== "MATCHES") {
      var sHeaders = getSheetHeaders(s);
      var personACol = sHeaders["PERSON A"] || sHeaders["PERSONA A"] || 6;
      var lastRow = getTrueLastRow(s, personACol);
      if (lastRow > 1) {
        var richValues = s.getRange(2, personACol, lastRow - 1, 1).getRichTextValues();
        for (var r = 0; r < richValues.length; r++) {
          var rt = richValues[r][0];
          if (!rt) continue;
          var cellText = rt.getText().trim().toLowerCase();
          if (!cellText) continue;

          var cellLink = rt.getLinkUrl() || "";
          var cellCrmId = extractCrmIdFromUrl(cellLink);

          // Coincidencia por CRM ID (prioritario) o por nombre normalizado
          if ((targetCrmId && cellCrmId && targetCrmId === cellCrmId) || (targetName && cellText === targetName)) {
            var foundTabName = s.getName().trim();
            return "SLOTS YA EXISTEN EN " + foundTabName;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Trigger que procesa filas nuevas añadidas en PROFILES y crea sus slots en la pestaña de la psicóloga.
 */
function handleProfilesEdit(sheet, row, col, newValue, oldValue) {
  Logger.log(">>> Entrando a handleProfilesEdit | Fila: " + row + ", Columna: " + col + ", newValue: '" + (newValue || "") + "'");
  
  var headers = getSheetHeaders(sheet);
  Logger.log("Headers detectados en PROFILES: " + JSON.stringify(headers));

  var fullNameCol = headers["FULLNAME"] || headers["NOMBRE"] || 2;
  var respCol = headers["RESPONSABLE"] || headers["PSICOLOGA"] || 4;
  var slotsCol = headers["SLOTS CREADOS"] || headers["SLOTS"] || headers["STATUS SLOTS"];

  // Si no existe la columna SLOTS CREADOS en PROFILES, crearla en Col F (6)
  if (!slotsCol) {
    slotsCol = 6;
    sheet.getRange(1, slotsCol).setValue("SLOTS CREADOS").setFontWeight("bold").setBackground("#D9D2E9");
    Logger.log("Columna SLOTS CREADOS no existía. Creada en Columna " + slotsCol);
  }

  var personACell = getCellData(sheet, row, fullNameCol);
  var personAName = personACell ? personACell.text.trim() : "";
  Logger.log("FullName (Col " + fullNameCol + "): '" + personAName + "' (RichText Link: " + (personACell && personACell.richText ? personACell.richText.getLinkUrl() : "none") + ")");

  if (!personAName) {
    Logger.log("ABORTADO: FullName está vacío en fila " + row);
    return;
  }

  var cellPsycVal = (sheet.getRange(row, respCol).getValue() || "").toString().trim();
  var rawPsyc = (newValue && col === respCol ? newValue : cellPsycVal).toString().trim();

  // 0. SI PEGARON UNA URL EN FULLNAME, RESOLVER AUTOMÁTICAMENTE NOMBRE, LINK Y PSICÓLOGA
  if (personAName.indexOf("http") >= 0 || personAName.indexOf("smartmatchapp") >= 0) {
    var rawUrl = personAName;
    var crmProfile = fetchProfileFromBackend(rawUrl);
    if (crmProfile && crmProfile.found && crmProfile.name) {
      var richText = SpreadsheetApp.newRichTextValue()
        .setText(crmProfile.name)
        .setLinkUrl(rawUrl)
        .build();
      sheet.getRange(row, fullNameCol).setRichTextValue(richText);
      personAName = crmProfile.name;
      personACell = { text: crmProfile.name, richText: richText, formula: "", crmId: crmProfile.crm_id };
      Logger.log("✅ URL resuelta a Nombre: '" + crmProfile.name + "' con Link");

      if (!rawPsyc && crmProfile.psychologist) {
        rawPsyc = crmProfile.psychologist;
        sheet.getRange(row, respCol).setValue(rawPsyc);
        Logger.log("✅ Psicóloga asignada desde CRM: '" + rawPsyc + "'");
      }
    }
  } else if (!rawPsyc) {
    var checkQuery = (personACell.richText && personACell.richText.getLinkUrl()) ? personACell.richText.getLinkUrl() : personAName;
    var preCrm = fetchProfileFromBackend(checkQuery);
    if (preCrm && preCrm.found && preCrm.psychologist) {
      rawPsyc = preCrm.psychologist;
      sheet.getRange(row, respCol).setValue(rawPsyc);
      Logger.log("Psicóloga autocompletada desde CRM: '" + rawPsyc + "'");
    }
  }

  Logger.log("Responsable (Col " + respCol + "): Raw = '" + rawPsyc + "' (en celda: '" + cellPsycVal + "', newValue: '" + (newValue || "") + "')");

  if (!rawPsyc) {
    Logger.log("Paso intermedio: FullName '" + personAName + "' ingresado. Esperando que se elija psicóloga en Col D.");
    sheet.getRange(row, respCol).setBackground("#FFF2CC").setNote("Seleccione la psicóloga responsable para crear los slots automáticamente.");
    return;
  } else {
    sheet.getRange(row, respCol).clearNote();
  }

  // 1. AUTO-GENERACIÓN DE NO. (ID) Y FECHA EN PROFILES (Dispara cuando FullName y Responsable están completos)
  var noCol = headers["NO."] || headers["NO"] || headers["ID"] || 1;
  var fechaCol = headers["FECHA"] || headers["DATE"] || 3;

  if (noCol) {
    var curNo = sheet.getRange(row, noCol).getValue();
    Logger.log("No. actual en fila " + row + " (Col " + noCol + "): '" + curNo + "'");
    if (curNo === null || curNo === undefined || curNo.toString().trim() === "") {
      var generatedNo = row - 1;
      sheet.getRange(row, noCol).setValue(generatedNo);
      Logger.log("✅ Auto-generado No. = " + generatedNo + " en Columna " + noCol);
    }
  }

  if (fechaCol) {
    var curFecha = sheet.getRange(row, fechaCol).getValue();
    Logger.log("FECHA actual en fila " + row + " (Col " + fechaCol + "): '" + curFecha + "'");
    if (curFecha === null || curFecha === undefined || curFecha.toString().trim() === "") {
      var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
      sheet.getRange(row, fechaCol).setValue(todayStr);
      Logger.log("✅ Auto-generada FECHA = '" + todayStr + "' en Columna " + fechaCol);
    }
  }

  // 2. REGLA ANTI-DUPLICADO: Si ya tiene marca de slots creados o histórico, abortar creación de slots
  var currentSlotsMarker = (sheet.getRange(row, slotsCol).getValue() || "").toString().trim().toUpperCase();
  Logger.log("SlotsCol actual (Col " + slotsCol + "): '" + currentSlotsMarker + "'");
  if (currentSlotsMarker && (currentSlotsMarker.indexOf("SLOTS CREADOS") >= 0 || currentSlotsMarker.indexOf("HISTÓRICO") >= 0 || currentSlotsMarker.indexOf("YA GENERADO") >= 0 || currentSlotsMarker.indexOf("YA EXISTEN") >= 0)) {
    Logger.log("ABORTADO: Fila ya procesada previamente con marca: '" + currentSlotsMarker + "'");
    return;
  }

  // 3. NORMALIZACIÓN DE PSICÓLOGA
  var cleanPsyc = normalizePsychologistName(rawPsyc);
  Logger.log("Psicóloga normalizada: '" + cleanPsyc + "'");

  if (!cleanPsyc) {
    Logger.log("AVISO: Psicóloga no reconocida: '" + rawPsyc + "'. Marcando amarillo #FFF2CC");
    sheet.getRange(row, respCol)
      .setBackground("#FFF2CC")
      .setNote("Psicóloga no reconocida. Seleccione una de las 10 oficiales: JENN, ANA, SILVI, STEFFY, SOFI, MAPE D, ALEJA, MANU, PIA, ISA.");
    sheet.getRange(row, slotsCol).setValue("PENDIENTE PSICÓLOGA").setBackground("#FFF2CC");
    return;
  } else {
    // Si era un alias (ej: Mape -> MAPE D), corregir en celda
    if (rawPsyc.toUpperCase() !== cleanPsyc) {
      sheet.getRange(row, respCol).setValue(cleanPsyc);
    }
    sheet.getRange(row, respCol).setBackground(null).clearNote();
  }

  // 4. BÚSQUEDA DE PESTAÑA DE PSICÓLOGA
  var psycSheet = findPsychologistSheet(cleanPsyc);
  if (!psycSheet) {
    Logger.log("ERROR: Pestaña 'MATCHES " + cleanPsyc + "' no encontrada en el libro.");
    sheet.getRange(row, respCol)
      .setBackground("#FFF2CC")
      .setNote("No se encontró la pestaña 'MATCHES " + cleanPsyc + "'.");
    sheet.getRange(row, slotsCol).setValue("ERROR PESTAÑA PSICÓLOGA").setBackground("#F4CCCC");
    return;
  }
  Logger.log("Pestaña de psicóloga encontrada: '" + psycSheet.getName() + "'");

  // 5. VERIFICACIÓN CRUZADA GLOBAL (Las 10 pestañas de psicóloga + PERSONAS DÍFICILES)
  Logger.log("Ejecutando checkExistingSlots para '" + personAName + "'...");
  var alreadyExistsReason = checkExistingSlots(personACell, psycSheet);
  Logger.log("Resultado de checkExistingSlots: " + (alreadyExistsReason ? "'" + alreadyExistsReason + "'" : "null (limpio)"));

  if (alreadyExistsReason) {
    sheet.getRange(row, slotsCol).setValue(alreadyExistsReason).setBackground("#D9EAD3");
    SpreadsheetApp.getActiveSpreadsheet().toast("Aviso: " + alreadyExistsReason + " para " + personAName, "Detección de Duplicado", 6);
    return;
  }

  // 6. CONSULTA AL CRM VÍA RESOLVE-PROFILE PARA OBTENER EL PLAN
  var queryParam = "";
  if (personACell.richText && personACell.richText.getLinkUrl()) {
    queryParam = personACell.richText.getLinkUrl();
  } else if (personACell.formula && personACell.formula.indexOf("HYPERLINK") !== -1) {
    var matchUrl = personACell.formula.match(/HYPERLINK\(\s*["']([^"']+)["']/i);
    queryParam = matchUrl ? matchUrl[1] : personAName;
  } else {
    queryParam = personAName;
  }
  Logger.log("Consultando CRM resolve-profile con query: '" + queryParam + "'...");

  var crmProfile = fetchProfileFromBackend(queryParam);
  Logger.log("Respuesta recibida de CRM: " + JSON.stringify(crmProfile));

  var planFromCrm = crmProfile && crmProfile.found ? (crmProfile.plan_tier || "") : "";
  var numSlots = resolvePlanSlots(planFromCrm);
  Logger.log("Plan extraído: '" + planFromCrm + "', Slots a generar: " + numSlots);

  // 7. VALIDACIÓN DE PLAN (Sin default: si no viene, fila amarilla y no genera slots)
  if (!crmProfile || !crmProfile.found || !numSlots) {
    Logger.log("AVISO: Perfil sin plan válido en CRM. Marcando fila en amarillo #FFF2CC");
    sheet.getRange(row, slotsCol)
      .setValue("PENDIENTE PLAN (CRM)")
      .setBackground("#FFF2CC")
      .setNote("El perfil en CRM no tiene un plan válido asignado (Básico 40k, Estándar 65k o VIP 195k). No se crearon slots.");
    sheet.getRange(row, fullNameCol).setBackground("#FFF2CC");
    SpreadsheetApp.getActiveSpreadsheet().toast("Cliente " + personAName + " sin plan en CRM. No se crearon slots.", "Plan Requerido", 6);
    return;
  } else {
    sheet.getRange(row, fullNameCol).setBackground(null);
  }

  var ciudad = crmProfile.city || "";
  var pref = crmProfile.pref || ""; // NUNCA default a "hetero"

  // 8. GENERACIÓN DE SLOTS CON LOCK DE SEGURIDAD
  Logger.log("Iniciando creación de " + numSlots + " slots en pestaña '" + psycSheet.getName() + "' con ScriptLock...");
  withScriptLock(function() {
    // Re-chequear anti-duplicado dentro del Lock
    var recheckMarker = (sheet.getRange(row, slotsCol).getValue() || "").toString().trim().toUpperCase();
    if (recheckMarker && (recheckMarker.indexOf("SLOTS CREADOS") >= 0 || recheckMarker.indexOf("HISTÓRICO") >= 0 || recheckMarker.indexOf("YA GENERADO") >= 0 || recheckMarker.indexOf("YA EXISTEN") >= 0)) {
      Logger.log("Recheck dentro del lock detectó marca previa. Abortando.");
      return;
    }

    var psycHeaders = getSheetHeaders(psycSheet);
    for (var i = 1; i <= numSlots; i++) {
      appendPrioritySlotRow(psycSheet, psycHeaders, {
        city: ciudad,
        pref: pref,
        plan: planFromCrm,
        personACell: personACell,
        slotIndex: i,
        totalSlots: numSlots,
        observaciones: "[PROFILES] Sincronizado desde CRM"
      });
      Logger.log("Slot " + i + "/" + numSlots + " insertado en '" + psycSheet.getName() + "'");
    }

    // 9. MARCAR COMO COMPLETADO EN PROFILES (Verde oficial #D9EAD3)
    var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
    sheet.getRange(row, slotsCol)
      .setValue(numSlots + " SLOTS CREADOS (" + todayStr + " - " + cleanPsyc + ")")
      .setBackground("#D9EAD3")
      .clearNote();
    
    Logger.log("✅ PROFILES!F marcado con éxito: '" + numSlots + " SLOTS CREADOS (" + todayStr + " - " + cleanPsyc + ")'");
    SpreadsheetApp.getActiveSpreadsheet().toast("Se crearon " + numSlots + " slots para " + personAName + " en " + cleanPsyc, "Slots Generados", 5);
  });
  Logger.log("<<< handleProfilesEdit FINALIZADO CON ÉXITO >>>");
}

// ─── 11. MENÚ PERSONALIZADO & HISTORIAL DE PERSONA (SIDEBAR INTERACTIVO) ────

/**
 * Crea el menú '🔎 Daily Lover' en la barra superior al abrir la hoja de cálculo.
 */
function onOpen(e) {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🔎 Daily Lover")
      .addItem("Historial de persona", "mostrarHistorialPersona")
      .addSeparator()
      .addItem("Generar 🔒 Panel de Supervisión María", "generarPanelSupervisionMaria")
      .addItem("Actualizar Desplegables desde ⚙️ CONFIG ESTADOS", "actualizarDesplegablesDinamicos")
      .addItem("Proteger ⚙️ CONFIG ESTADOS (Solo María)", "protegerConfigEstados")
      .addItem("Configurar Dropdown Responsable", "configurarDropdownResponsable")
      .addToUi();
  } catch (err) {
    Logger.log("No se pudo crear menú en onOpen: " + err);
  }
}

// ─── 12. SISTEMA CENTRAL DE ESTADOS (⚙️ CONFIG ESTADOS) ─────────────────────

/**
 * Lee los estados agrupados por etapa desde '⚙️ CONFIG ESTADOS'.
 */
function getEstadosPorEtapa() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.CONFIG_ESTADOS_SHEET_NAME || "⚙️ CONFIG ESTADOS");
  
  var result = {
    PSICOLOGA: [],
    SERVICIO_CLIENTE: [],
    RESULTADO_CITA: [],
    REFUND: [],
    COLOR_MAP: {}
  };

  if (!sheet) {
    Logger.log("AVISO: No se encontró la pestaña '⚙️ CONFIG ESTADOS'. Usando estados por defecto.");
    return result;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;

  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    var estado = (data[i][0] || "").toString().trim();
    var color = (data[i][1] || "").toString().trim();
    var etapa = (data[i][2] || "").toString().trim().toUpperCase();

    if (!estado) continue;

    if (color) {
      result.COLOR_MAP[estado.toUpperCase()] = color;
    }

    if (etapa === "PSICOLOGA") {
      result.PSICOLOGA.push(estado);
    } else if (etapa === "SERVICIO_CLIENTE") {
      result.SERVICIO_CLIENTE.push(estado);
    } else if (etapa === "RESULTADO_CITA") {
      result.RESULTADO_CITA.push(estado);
    } else if (etapa === "REFUND") {
      result.REFUND.push(estado);
    }
  }

  return result;
}

/**
 * Actualiza dinámicamente las validaciones de datos (desplegables) en todas las pestañas
 * leyendo exclusivamente los estados configurados en '⚙️ CONFIG ESTADOS'.
 */
function actualizarDesplegablesDinamicos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var estadosData = getEstadosPorEtapa();

  // 1. Regla para Etapa PSICOLOGA
  var psycList = estadosData.PSICOLOGA.length > 0 ? estadosData.PSICOLOGA : [
    "Llenar perfil", "Listo para match", "HECHO", "APROBADO", "NOT APPROVED", "DESCALIFICADO",
    "NO HAY GENTE", "REVISAR", "TROUBLEMAKER", "HECHO POR MAPE", "REQUEST PROFILE UPDATE",
    "PSIC. URG", "MUJER +50", "REFUND"
  ];
  var psycRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(psycList, true)
    .setAllowInvalid(true)
    .build();

  // 2. Regla para Etapa SERVICIO_CLIENTE + RESULTADO_CITA (Pestaña MATCHES)
  var matchesList = [].concat(estadosData.SERVICIO_CLIENTE, estadosData.RESULTADO_CITA);
  if (matchesList.length === 0) {
    matchesList = [
      "pendiente", "agendando", "por confirmar", "esperar", "de viaje", "problemas personales",
      "no contestan", "reprogramar", "esperar que salgan con su date", "TROUBLEMAKER",
      "cita confirmada", "DATE PROGRAMADO", "cita realizada", "match", "MATCH DONE",
      "no match (él rechazó)", "no match (ella rechazó)", "sin química (mutuo)"
    ];
  }
  var matchesRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(matchesList, true)
    .setAllowInvalid(true)
    .build();

  // 3. Regla para Etapa REFUND
  var refundList = estadosData.REFUND.length > 0 ? estadosData.REFUND : [
    "REFUND DONE", "REFUND PENDIENTE – NEQUI", "REFUND PENDIENTE – DATOS",
    "REFUND PENDIENTE – STRIPE", "REFUND PARCIAL PENDIENTE", "PENDIENTE DE RESPUESTA CLIENTE", "CLIENTE QUIERE ESPERAR"
  ];
  var refundRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(refundList, true)
    .setAllowInvalid(true)
    .build();

  // Aplicar a todas las pestañas de Psicólogas
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var s = allSheets[i];
    var sName = s.getName().trim().toUpperCase();

    if (sName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sName !== "MATCHES") {
      var headers = getSheetHeaders(s);
      var statusCol = headers["STATUS"] || 9;
      var maxRows = Math.min(s.getMaxRows(), 5000);
      if (maxRows > 1) {
        s.getRange(2, statusCol, maxRows - 1, 1).setDataValidation(psycRule);
      }
    } else if (sName === "MATCHES") {
      var mHeaders = getSheetHeaders(s);
      var matchCol = mHeaders["MATCH"] || 13;
      var mMaxRows = Math.min(s.getMaxRows(), 5000);
      if (mMaxRows > 1) {
        s.getRange(2, matchCol, mMaxRows - 1, 1).setDataValidation(matchesRule);
      }
    } else if (sName === (CONFIG.REFUNDS_SHEET_NAME || "REFUNDS PENDIENTES").toUpperCase()) {
      var rHeaders = getSheetHeaders(s);
      var rStatusCol = rHeaders["STATUS"] || 7;
      var rMaxRows = Math.min(s.getMaxRows(), 3000);
      if (rMaxRows > 1) {
        s.getRange(2, rStatusCol, rMaxRows - 1, 1).setDataValidation(refundRule);
      }
    } else if (sName === (CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA").toUpperCase() || sName === "REVISION MARIA") {
      var revHeaders = getSheetHeaders(s);
      var revCol = revHeaders["APROBAR"] || revHeaders["STATUS"] || 11;
      var revMaxRows = Math.min(s.getMaxRows(), 3000);
      if (revMaxRows > 1) {
        s.getRange(2, revCol, revMaxRows - 1, 1).setDataValidation(psycRule);
      }
    }
  }

  Logger.log("✅ Validaciones de datos (desplegables) actualizadas dinámicamente desde ⚙️ CONFIG ESTADOS.");
  ss.toast("Desplegables actualizados desde ⚙️ CONFIG ESTADOS", "Estados Actualizados", 4);
}

/**
 * Trigger al editar ⚙️ CONFIG ESTADOS: Actualiza los desplegables de inmediato.
 */
function handleConfigEstadosEdit(sheet, row, col) {
  Logger.log("Edición detectada en ⚙️ CONFIG ESTADOS (Fila " + row + ", Col " + col + "). Actualizando desplegables...");
  actualizarDesplegablesDinamicos();
}

/**
 * Protege la pestaña ⚙️ CONFIG ESTADOS para edición exclusiva de María.
 */
function protegerConfigEstados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.CONFIG_ESTADOS_SHEET_NAME || "⚙️ CONFIG ESTADOS");
  if (!sheet) return;

  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  for (var i = 0; i < protections.length; i++) {
    protections[i].remove();
  }

  var protection = sheet.protect().setDescription("Protegido: Solo María");
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  
  if (CONFIG.MARIA_EMAIL) {
    try {
      protection.addEditor(CONFIG.MARIA_EMAIL);
    } catch (e) {
      Logger.log("No se pudo agregar email directo: " + e.message);
    }
  }

  // Quitar al resto de editores excepto María y el creador
  var editors = protection.getEditors();
  for (var j = 0; j < editors.length; j++) {
    var email = editors[j].getEmail();
    if (email !== CONFIG.MARIA_EMAIL && email !== me.getEmail()) {
      protection.removeEditor(editors[j]);
    }
  }

  Logger.log("✅ Pestaña ⚙️ CONFIG ESTADOS protegida para " + CONFIG.MARIA_EMAIL);
  ss.toast("⚙️ CONFIG ESTADOS protegida exclusivamente para María", "Protección Activa", 4);
}

// ─── 13. FLUJO DE APROBACIÓN REVISIÓN MARÍA & FILAS ESPEJO ──────────────────

/**
 * Retorna un identificador canónico único e insensible al orden para cualquier pareja.
 * Ejemplo: ("Diego", "Valentina") -> "diego___valentina"
 *          ("Valentina", "Diego") -> "diego___valentina"
 */
function getCanonicalPairId(nameA, nameB) {
  var cleanA = (nameA || "").toString().toLowerCase().trim();
  var cleanB = (nameB || "").toString().toLowerCase().trim();
  if (!cleanA && !cleanB) return "";
  var arr = [cleanA, cleanB].sort();
  return arr[0] + "___" + arr[1];
}

/**
 * Crea o sincroniza la fila espejo en la pestaña de Psicóloga B cuando Psicóloga A propone un match cruzado.
 */
function crearOActualizarFilaEspejo(sheetA, rowA, psycA, psycB, cellA, cellB, city, pref, plan, obs) {
  var sheetB = findPsychologistSheet(psycB);
  if (!sheetB) {
    Logger.log("AVISO: No se encontró la pestaña para Psicóloga B ('" + psycB + "').");
    return;
  }

  var headersB = getSheetHeaders(sheetB);
  var personAColB = headersB["PERSON A"] || headersB["PERSONA A"] || headersB["CLIENTE"] || 5;
  var personBColB = headersB["PERSON B"] || headersB["PERSONA B"] || headersB["CANDIDATO"] || headersB["MATCH"] || 6;
  var psycBColB = headersB["PSICÓLOGA DE B"] || headersB["PSICOLOGA DE B"] || headersB["PSICOLOGA B"] || 7;
  var statusColB = headersB["STATUS"] || 9;
  var obsColB = headersB["OBSERVACIONES"] || headersB["OBSERVACION"] || headersB["NOTAS"] || 8;

  var lastRowB = sheetB.getLastRow();
  var mirrorRow = null;

  // Buscar si ya existe la fila espejo para este par de forma canónica
  var targetPairKey = getCanonicalPairId(cellA.text, cellB.text);
  if (lastRowB > 1) {
    var dataB = sheetB.getRange(2, 1, lastRowB - 1, sheetB.getLastColumn()).getValues();
    for (var i = 0; i < dataB.length; i++) {
      var rowNameA = (dataB[i][personAColB - 1] || "").toString();
      var rowNameB = (dataB[i][personBColB - 1] || "").toString();
      if (getCanonicalPairId(rowNameA, rowNameB) === targetPairKey) {
        mirrorRow = i + 2;
        break;
      }
    }
  }

  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
  var mirrorObs = "[ESPEJO] Propuesto por " + psycA + " (" + todayStr + ")" + (obs ? " | " + obs : "");

  if (mirrorRow) {
    // Actualizar fila espejo existente
    if (statusColB) sheetB.getRange(mirrorRow, statusColB).setValue("REVISAR").setBackground("#D9D2E9");
    if (obsColB) sheetB.getRange(mirrorRow, obsColB).setValue(mirrorObs);
    Logger.log("🔄 Fila espejo actualizada en '" + sheetB.getName() + "' (Fila " + mirrorRow + ")");
  } else {
    // Insertar nueva fila espejo
    appendPrioritySlotRow(sheetB, headersB, {
      city: city,
      pref: pref,
      plan: plan,
      personACell: cellB,
      personBCell: cellA,
      fecha: todayStr,
      status: "REVISAR",
      observaciones: mirrorObs
    });

    // Colocar psicóloga de B (que es Psicóloga A)
    var newLastRow = sheetB.getLastRow();
    if (psycBColB) {
      sheetB.getRange(newLastRow, psycBColB).setValue(psycA).setBackground("#E8EAED");
    }
    if (statusColB) {
      sheetB.getRange(newLastRow, statusColB).setBackground("#D9D2E9");
    }
    Logger.log("✅ Fila espejo creada con éxito en '" + sheetB.getName() + "' (Fila " + newLastRow + ")");
    SpreadsheetApp.getActiveSpreadsheet().toast("Fila espejo generada en " + sheetB.getName() + " para " + cellB.text, "Fila Espejo", 4);
  }
}

/**
 * Sincroniza el match a la pestaña 'REVISIÓN MARÍA'.
 * Utiliza getCanonicalPairId para evitar duplicados sin importar el orden de Persona A / Persona B.
 */
function syncToRevisionMaria(matchData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var revSheet = ss.getSheetByName(CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA");
  if (!revSheet) {
    Logger.log("ERROR: No se encontró la pestaña 'REVISIÓN MARÍA'.");
    return;
  }

  var headers = getSheetHeaders(revSheet);
  var idCol = headers["ID MATCH"] || headers["ID"] || 1;
  var psycACol = headers["PSICÓLOGA A"] || headers["PSICOLOGA A"] || 2;
  var psycBCol = headers["PSICÓLOGA B"] || headers["PSICOLOGA B"] || 3;
  var cityCol = headers["CITY"] || headers["CIUDAD"] || 4;
  var prefCol = headers["PREF"] || headers["PREFERENCIA"] || 5;
  var planCol = headers["PLAN"] || headers["PLAN TIER"] || 6;
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 7;
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || 8;
  var fechaCol = headers["FECHA"] || headers["FECHA PROPUESTA"] || 9;
  var obsCol = headers["OBSERVACIONES"] || 10;
  var origenTabCol = headers["ORIGEN"] || headers["PESTAÑA ORIGEN"] || 11;
  var origenFilaCol = headers["FILA ORIGEN"] || 12;
  var aprobarCol = headers["APROBAR"] || headers["STATUS"] || 13;

  var lastRow = revSheet.getLastRow();
  var targetRow = null;
  var existingRowData = null;

  var targetPairKey = getCanonicalPairId(matchData.personACell.text, matchData.personBCell.text);

  // Buscar si ya existe este match en REVISIÓN MARÍA de forma CANÓNICA (A ↔ B o B ↔ A)
  if (lastRow > 1) {
    var data = revSheet.getRange(2, 1, lastRow - 1, revSheet.getLastColumn()).getValues();
    for (var i = 0; i < data.length; i++) {
      var rA = (data[i][personACol - 1] || "").toString();
      var rB = (data[i][personBCol - 1] || "").toString();
      if (getCanonicalPairId(rA, rB) === targetPairKey) {
        targetRow = i + 2;
        existingRowData = data[i];
        break;
      }
    }
  }

  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
  var isCrossMatch = (matchData.psycA && matchData.psycB && matchData.psycA !== matchData.psycB);

  // Si YA EXISTÍA la fila en REVISIÓN MARÍA (es la segunda psicóloga aprobando su fila espejo)
  if (targetRow && existingRowData) {
    var prevStatus = (existingRowData[aprobarCol - 1] || "").toString().trim();
    
    // Si la segunda psicóloga marca HECHO / APROBADO en su espejo
    if (isCrossMatch && (matchData.currentPsyc === matchData.psycB || prevStatus.indexOf("ESPERANDO") >= 0)) {
      var fullApprovalStatus = "APROBADO POR AMBAS PSICÓLOGAS (LISTO PARA MARÍA)";
      revSheet.getRange(targetRow, aprobarCol).setValue(fullApprovalStatus).setBackground("#CFE2F3");
      
      var doubleObs = "[DOBLE APROBACIÓN COMPLETA] " + matchData.psycA + " y " + matchData.psycB + " han aprobado (" + todayStr + ")" + (matchData.obs ? " | " + matchData.obs : "");
      if (obsCol) revSheet.getRange(targetRow, obsCol).setValue(doubleObs);
      if (fechaCol) revSheet.getRange(targetRow, fechaCol).setValue(todayStr);

      Logger.log("🎉 Match de doble aprobación completado en REVISIÓN MARÍA (Fila " + targetRow + ")");
      SpreadsheetApp.getActiveSpreadsheet().toast("Doble aprobación completada para " + matchData.personACell.text + " ↔ " + matchData.personBCell.text, "Listo para María", 5);
      return;
    }
  }

  // Si es una NUEVA entrada
  if (!targetRow) {
    targetRow = lastRow + 1;
  }

  // ID Canónico Único
  var matchUid = "MATCH-" + targetPairKey.replace(/___/g, "-").toUpperCase();
  if (idCol) revSheet.getRange(targetRow, idCol).setValue(matchUid);

  if (psycACol) revSheet.getRange(targetRow, psycACol).setValue(matchData.psycA);
  if (psycBCol) revSheet.getRange(targetRow, psycBCol).setValue(matchData.psycB);
  if (cityCol) revSheet.getRange(targetRow, cityCol).setValue(matchData.city);
  if (prefCol) revSheet.getRange(targetRow, prefCol).setValue(matchData.pref);
  if (planCol) revSheet.getRange(targetRow, planCol).setValue(matchData.planA);

  if (personACol) {
    if (matchData.personACell.richText) revSheet.getRange(targetRow, personACol).setRichTextValue(matchData.personACell.richText);
    else revSheet.getRange(targetRow, personACol).setValue(matchData.personACell.text);
  }

  if (personBCol) {
    if (matchData.personBCell.richText) revSheet.getRange(targetRow, personBCol).setRichTextValue(matchData.personBCell.richText);
    else revSheet.getRange(targetRow, personBCol).setValue(matchData.personBCell.text);
  }

  if (fechaCol) revSheet.getRange(targetRow, fechaCol).setValue(todayStr);
  if (obsCol) revSheet.getRange(targetRow, obsCol).setValue(matchData.obs || "");
  if (origenTabCol) revSheet.getRange(targetRow, origenTabCol).setValue(matchData.origenTab);
  if (origenFilaCol) revSheet.getRange(targetRow, origenFilaCol).setValue(matchData.origenFila);

  if (aprobarCol) {
    var initialStatus = "";
    var bg = "#CFE2F3";
    
    if (isCrossMatch) {
      initialStatus = "ESPERANDO APROBACIÓN DE " + matchData.psycB;
      bg = "#FFF2CC";
    } else {
      initialStatus = "APROBADO POR PSICÓLOGA (LISTO PARA MARÍA)";
      bg = "#CFE2F3";
    }
    
    revSheet.getRange(targetRow, aprobarCol).setValue(initialStatus).setBackground(bg);
  }

  Logger.log("✅ Match sincronizado a REVISIÓN MARÍA (Fila " + targetRow + "): " + matchData.personACell.text + " + " + matchData.personBCell.text);
}

/**
 * Cuando María edita la columna 'APROBAR' en 'REVISIÓN MARÍA':
 * - HARD BLOCKING: Si el match todavía dice 'ESPERANDO APROBACIÓN DE [B]', bloquea la acción y revierte la celda.
 * - APROBADO: Inserta en MATCHES (zona inferior) y actualiza pestañas de psicólogas origen y espejo a APROBADO.
 * - NOT APPROVED: Actualiza pestañas origen y espejo a NOT APPROVED y re-genera slots de reintento.
 */
function handleRevisionMariaEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var aprobarCol = headers["APROBAR"] || headers["STATUS"] || 13;
  if (col !== aprobarCol) return;

  var val = (newValue || sheet.getRange(row, col).getValue() || "").toString().trim().toUpperCase();
  if (!val) return;

  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 7;
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || 8;
  var psycACol = headers["PSICÓLOGA A"] || headers["PSICOLOGA A"] || 2;
  var psycBCol = headers["PSICÓLOGA B"] || headers["PSICOLOGA B"] || 3;
  var cityCol = headers["CITY"] || headers["CIUDAD"] || 4;
  var obsCol = headers["OBSERVACIONES"] || 10;
  var notasMariaCol = headers["NOTAS MARÍA"] || headers["NOTAS MARIA"] || 14;

  var cellA = getCellData(sheet, row, personACol);
  var cellB = getCellData(sheet, row, personBCol);
  var psycA = (sheet.getRange(row, psycACol).getValue() || "").toString().trim();
  var psycB = (sheet.getRange(row, psycBCol).getValue() || "").toString().trim();
  var city = (sheet.getRange(row, cityCol).getValue() || "").toString().trim();
  var obs = (sheet.getRange(row, obsCol).getValue() || "").toString().trim();
  var notasMaria = notasMariaCol ? (sheet.getRange(row, notasMariaCol).getValue() || "").toString().trim() : "";

  if (!cellA || !cellA.text) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. HARD BLOCKING: VALIDAR DOBLE APROBACIÓN PREVIA ────────────────────
  var prevStatusVal = (oldValue || "").toString().trim().toUpperCase();
  var isStillWaiting = (prevStatusVal.indexOf("ESPERANDO") >= 0);

  if ((val === "APROBADO" || val === "TRUE") && isStillWaiting && psycB && psycB !== psycA) {
    // REVERTIR el intento de aprobación anticipada
    var waitingText = "ESPERANDO APROBACIÓN DE " + psycB;
    sheet.getRange(row, aprobarCol).setValue(waitingText).setBackground("#FFF2CC");
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "⚠️ BLOQUEADO: Este match aún espera la aprobación de la Psicóloga B (" + psycB + "). María solo puede aprobar cuando ambas psicólogas hayan marcado HECHO.",
      "Aprobación Bloqueada",
      8
    );
    Logger.log("⛔ INTENTO DE APROBACIÓN BLOQUEADO: El match " + cellA.text + " ↔ " + cellB.text + " aún espera aprobación de " + psycB);
    return; // CORTE TOTAL
  }

  // ── CASO A: APROBADO POR MARÍA (Válido porque ambas psicólogas ya aprobaron) ──
  if (val === "APROBADO" || val === "TRUE") {
    var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES");
    if (!matchesSheet) {
      Logger.log("ERROR: No se encontró la pestaña 'MATCHES'.");
      return;
    }

    withScriptLock(function() {
      // 1. Insertar en zona inferior de MATCHES
      insertMatchInLowerZone(matchesSheet, {
        personACell: cellA,
        personBCell: cellB,
        city: city,
        observaciones: (psycA ? "[" + psycA + (psycB && psycB !== psycA ? " ↔ " + psycB : "") + "] " : "") + (obs || "") + (notasMaria ? " | Nota María: " + notasMaria : "")
      });

      // 2. Actualizar estado a APROBADO en la pestaña de Psicóloga A
      updateStatusInPsychologistSheet(psycA, cellA.text, cellB.text, "APROBADO", "#B6D7A8");

      // 3. Actualizar estado a APROBADO en la pestaña de Psicóloga B (si es distinta)
      if (psycB && psycB !== psycA) {
        updateStatusInPsychologistSheet(psycB, cellB.text, cellA.text, "APROBADO", "#B6D7A8");
      }

      // 4. Marcar verde en REVISIÓN MARÍA
      sheet.getRange(row, aprobarCol).setBackground("#D9EAD3").setValue("APROBADO");
      ss.toast("Match aprobado y enviado a MATCHES", "Aprobación Exitosa", 5);
    });
  }

  // ── CASO B: NOT APPROVED POR MARÍA ───────────────────────────────────────
  else if (val === "NOT APPROVED") {
    withScriptLock(function() {
      var motivoRechazo = notasMaria ? "Rechazado por María: " + notasMaria : "NOT APPROVED por María";

      // 1. Actualizar estado a NOT APPROVED en pestaña de Psicóloga A y re-generar slot
      updateStatusInPsychologistSheet(psycA, cellA.text, cellB.text, "NOT APPROVED", "#F4CCCC");
      var sheetA = findPsychologistSheet(psycA);
      if (sheetA) {
        appendNewRetryRow(sheetA, getSheetHeaders(sheetA), {
          city: city,
          pref: "",
          plan: "",
          personACell: cellA,
          personBCell: null,
          fecha: "",
          status: "Listo para match",
          observaciones: motivoRechazo
        });
      }

      // 2. Actualizar estado a NOT APPROVED en pestaña de Psicóloga B y re-generar slot
      if (psycB && psycB !== psycA) {
        updateStatusInPsychologistSheet(psycB, cellB.text, cellA.text, "NOT APPROVED", "#F4CCCC");
        var sheetB = findPsychologistSheet(psycB);
        if (sheetB) {
          appendNewRetryRow(sheetB, getSheetHeaders(sheetB), {
            city: city,
            pref: "",
            plan: "",
            personACell: cellB,
            personBCell: null,
            fecha: "",
            status: "Listo para match",
            observaciones: motivoRechazo
          });
        }
      }

      // 3. Marcar rojo en REVISIÓN MARÍA
      sheet.getRange(row, aprobarCol).setBackground("#F4CCCC").setValue("NOT APPROVED");
      ss.toast("Match rechazado. Slots de reintento creados para ambas personas.", "Rechazo Procesado", 5);
    });
  }
}

/**
 * Actualiza el estado y color de una fila en la pestaña de una psicóloga.
 */
function updateStatusInPsychologistSheet(psycName, nameA, nameB, newStatus, bgColor) {
  var sheet = findPsychologistSheet(psycName);
  if (!sheet) return;

  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"] || 5;
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || headers["CANDIDATO"] || headers["MATCH"] || 6;
  var statusCol = headers["STATUS"] || 9;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowA = (values[i][personACol - 1] || "").toString().toLowerCase().trim();
    var rowB = (values[i][personBCol - 1] || "").toString().toLowerCase().trim();
    if (rowA === nameA.toLowerCase().trim() && (rowB === nameB.toLowerCase().trim() || !nameB)) {
      var targetRow = i + 2;
      sheet.getRange(targetRow, statusCol).setValue(newStatus);
      if (bgColor) sheet.getRange(targetRow, statusCol).setBackground(bgColor);
      Logger.log("✅ Estado actualizado a '" + newStatus + "' en '" + sheet.getName() + "' (Fila " + targetRow + ")");
      break;
    }
  }
}

// ─── 14. PESTAÑA PRIVADA 🔒 SUPERVISIÓN MARÍA (DASHBOARD OPERATIVO) ─────────

/**
 * Genera o actualiza la pestaña privada '🔒 SUPERVISIÓN MARÍA' con KPIs ejecutivos en tiempo real.
 */
function generarPanelSupervisionMaria() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "🔒 SUPERVISIÓN MARÍA";
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }

  // 1. Configurar Encabezado Principal (Estilo Premium Wine Red)
  sheet.getRange("A1:H1").merge()
    .setValue("👑 DAILY LOVER — PANEL PRIVADO DE SUPERVISIÓN MARÍA")
    .setFontWeight("bold")
    .setFontSize(14)
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  sheet.getRange("A2:H2").merge()
    .setValue("Actualizado automáticamente: " + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss") + " | Entorno: SSOT Matchmaking")
    .setFontSize(9)
    .setFontStyle("italic")
    .setBackground("#1A1214")
    .setFontColor("#9A8A8D")
    .setHorizontalAlignment("center");

  // 2. Calcular KPIs de Control Operativo
  var revSheet = ss.getSheetByName(CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA");
  var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES");
  var refundsSheet = ss.getSheetByName(CONFIG.REFUNDS_SHEET_NAME || "REFUNDS PENDIENTES");

  var pendingRevision = 0;
  if (revSheet && revSheet.getLastRow() > 1) {
    var rData = revSheet.getRange(2, 1, revSheet.getLastRow() - 1, revSheet.getLastColumn()).getValues();
    var revHeaders = getSheetHeaders(revSheet);
    var apCol = revHeaders["APROBAR"] || revHeaders["STATUS"] || 12;
    for (var r = 0; r < rData.length; r++) {
      var st = (rData[r][apCol - 1] || "").toString().toUpperCase();
      if (st === "PENDIENTE" || st.indexOf("ESPERANDO") >= 0 || st.indexOf("APROBADO POR PSIC") >= 0) {
        pendingRevision++;
      }
    }
  }

  var pendingServiceCalls = 0;
  var scheduledDates = 0;
  if (matchesSheet && matchesSheet.getLastRow() > 1) {
    var mData = matchesSheet.getRange(2, 1, matchesSheet.getLastRow() - 1, matchesSheet.getLastColumn()).getValues();
    var mHeaders = getSheetHeaders(matchesSheet);
    var diaCol = mHeaders["DÍA"] || mHeaders["DIA"] || 5;
    var matchCol = mHeaders["MATCH"] || 13;
    for (var m = 0; m < mData.length; m++) {
      var diaVal = (mData[m][diaCol - 1] || "").toString().trim();
      var mSt = (mData[m][matchCol - 1] || "").toString().toUpperCase();
      if (!diaVal && (mSt === "PENDIENTE" || mSt.indexOf("AGENDANDO") >= 0 || mSt.indexOf("POR CONFIRMAR") >= 0)) {
        pendingServiceCalls++;
      } else if (diaVal || mSt.indexOf("CONFIRMADA") >= 0 || mSt.indexOf("DATE PROGRAMADO") >= 0) {
        scheduledDates++;
      }
    }
  }

  var pendingRefunds = refundsSheet ? Math.max(0, refundsSheet.getLastRow() - 1) : 0;

  // 3. Tarjetas KPI
  var kpiHeaders = [
    ["Matches por Revisar", "En Espera Servicio al Cliente", "Citas Agendadas / Activas", "Refunds Pendientes Lina"],
    [pendingRevision, pendingServiceCalls, scheduledDates, pendingRefunds]
  ];

  sheet.getRange("A4:B4").merge().setValue(kpiHeaders[0][0]).setFontWeight("bold").setBackground("#351C75").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("A5:B5").merge().setValue(kpiHeaders[1][0]).setFontSize(18).setFontWeight("bold").setBackground("#D9D2E9").setHorizontalAlignment("center");

  sheet.getRange("C4:D4").merge().setValue(kpiHeaders[0][1]).setFontWeight("bold").setBackground("#7F6000").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("C5:D5").merge().setValue(kpiHeaders[1][1]).setFontSize(18).setFontWeight("bold").setBackground("#FFF2CC").setHorizontalAlignment("center");

  sheet.getRange("E4:F4").merge().setValue(kpiHeaders[0][2]).setFontWeight("bold").setBackground("#274E13").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("E5:F5").merge().setValue(kpiHeaders[1][2]).setFontSize(18).setFontWeight("bold").setBackground("#D9EAD3").setHorizontalAlignment("center");

  sheet.getRange("G4:H4").merge().setValue(kpiHeaders[0][3]).setFontWeight("bold").setBackground("#783F04").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("G5:H5").merge().setValue(kpiHeaders[1][3]).setFontSize(18).setFontWeight("bold").setBackground("#FCE5CD").setHorizontalAlignment("center");

  // 4. Tabla de Rendimiento y Slots por Psicóloga
  sheet.getRange("A7:H7").merge()
    .setValue("📊 ACTIVIDAD Y CARGA OPERATIVA POR PSICÓLOGA")
    .setFontWeight("bold")
    .setBackground("#20124D")
    .setFontColor("#FFFFFF");

  var psycHeaders = ["Psicóloga", "Total Slots", "Listos Match", "Hechos", "Aprobados", "Trouble/Rechazos", "Refunds", "Eficiencia"];
  for (var h = 0; h < psycHeaders.length; h++) {
    sheet.getRange(8, h + 1).setValue(psycHeaders[h]).setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  }

  var psycList = CONFIG.VALID_PSYCHOLOGISTS || ["JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA"];
  for (var p = 0; p < psycList.length; p++) {
    var pName = psycList[p];
    var pSheet = findPsychologistSheet(pName);
    var totalSlots = 0, listos = 0, hechos = 0, aprobados = 0, trouble = 0, refunds = 0;

    if (pSheet && pSheet.getLastRow() > 1) {
      var pHeaders = getSheetHeaders(pSheet);
      var stCol = pHeaders["STATUS"] || 9;
      var pValues = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, pSheet.getLastColumn()).getValues();
      totalSlots = pValues.length;

      for (var rowIdx = 0; rowIdx < pValues.length; rowIdx++) {
        var sVal = (pValues[rowIdx][stCol - 1] || "").toString().toUpperCase();
        if (sVal.indexOf("LISTO") >= 0 || sVal.indexOf("LLENAR") >= 0) listos++;
        else if (sVal === "HECHO" || sVal === "HECHO POR MAPE") hechos++;
        else if (sVal === "APROBADO") aprobados++;
        else if (sVal.indexOf("TROUBLE") >= 0 || sVal.indexOf("NOT APPROVED") >= 0 || sVal.indexOf("DESCALIFICADO") >= 0) trouble++;
        else if (sVal === "REFUND") refunds++;
      }
    }

    var efec = totalSlots > 0 ? Math.round(((aprobados + hechos) / totalSlots) * 100) + "%" : "0%";
    var curRow = 9 + p;
    sheet.getRange(curRow, 1).setValue(pName).setFontWeight("bold");
    sheet.getRange(curRow, 2).setValue(totalSlots).setHorizontalAlignment("center");
    sheet.getRange(curRow, 3).setValue(listos).setHorizontalAlignment("center");
    sheet.getRange(curRow, 4).setValue(hechos).setHorizontalAlignment("center");
    sheet.getRange(curRow, 5).setValue(aprobados).setHorizontalAlignment("center");
    sheet.getRange(curRow, 6).setValue(trouble).setHorizontalAlignment("center");
    sheet.getRange(curRow, 7).setValue(refunds).setHorizontalAlignment("center");
    sheet.getRange(curRow, 8).setValue(efec).setHorizontalAlignment("center");
  }

  // 5. Proteger pestaña exclusivamente para María
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  for (var pr = 0; pr < protections.length; pr++) {
    protections[pr].remove();
  }

  var protection = sheet.protect().setDescription("Protegido: Solo María");
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  if (CONFIG.MARIA_EMAIL) {
    try {
      protection.addEditor(CONFIG.MARIA_EMAIL);
    } catch (e) {}
  }

  var editors = protection.getEditors();
  for (var ed = 0; ed < editors.length; ed++) {
    var em = editors[ed].getEmail();
    if (em !== CONFIG.MARIA_EMAIL && em !== me.getEmail()) {
      protection.removeEditor(editors[ed]);
    }
  }

  Logger.log("✅ Pestaña privada '🔒 SUPERVISIÓN MARÍA' generada y protegida con éxito.");
  ss.toast("Panel de Supervisión de María generado y actualizado.", "Panel Listo", 5);
}

/**
 * Inserta un match en la zona inferior de MATCHES (sin fecha, estado inicial 'pendiente').
 */
function insertMatchInLowerZone(matchesSheet, matchData) {
  var headers = getSheetHeaders(matchesSheet);
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 3;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 4;
  var diaCol = headers["DÍA"] || headers["DIA"] || 5;
  var cityCol = headers["CIUDAD"] || headers["CITY"] || 7;
  var matchCol = headers["MATCH"] || 13;
  var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 12;

  var lastRow = matchesSheet.getLastRow();
  var targetRow = lastRow + 1;

  // 1. Escribir Persona A
  var cellA = matchData.personACell;
  if (cellA.richText) {
    matchesSheet.getRange(targetRow, personACol).setRichTextValue(cellA.richText);
  } else {
    matchesSheet.getRange(targetRow, personACol).setValue(cellA.text);
  }

  // 2. Escribir Persona B
  var cellB = matchData.personBCell;
  if (cellB) {
    if (cellB.richText) {
      matchesSheet.getRange(targetRow, personBCol).setRichTextValue(cellB.richText);
    } else {
      matchesSheet.getRange(targetRow, personBCol).setValue(cellB.text);
    }
  }

  // 3. Ciudad
  if (cityCol && matchData.city) {
    matchesSheet.getRange(targetRow, cityCol).setValue(matchData.city);
  }

  // 4. Observaciones
  if (obsCol && matchData.observaciones) {
    matchesSheet.getRange(targetRow, obsCol).setValue(matchData.observaciones);
  }

  // 5. Estado inicial: 'pendiente' (Color #FFF2CC)
  if (matchCol) {
    matchesSheet.getRange(targetRow, matchCol)
      .setValue("pendiente")
      .setBackground("#FFF2CC");
  }

  // Asegurar que DÍA quede vacío (zona inferior)
  if (diaCol) {
    matchesSheet.getRange(targetRow, diaCol).setValue("");
  }

  Logger.log("✅ Match insertado en zona inferior de MATCHES (Fila " + targetRow + "): " + cellA.text + " + " + (cellB ? cellB.text : "Por definir"));
}

// ─── 14. AUTOMATIZACIÓN DE PESTAÑA MATCHES (DOS ZONAS & RETORNO RECHAZOS) ───

/**
 * Trigger al editar la pestaña MATCHES:
 * - Cambio de estado de Servicio al Cliente / Resultado de Cita.
 * - Promoción a zona superior al confirmar/agendar fecha.
 * - Regla de rechazo: Retorno automático a ambas psicólogas como nuevo slot.
 * - Coloreado automático según fecha pasada / futura.
 */
function handleMatchesEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 3;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 4;
  var diaCol = headers["DÍA"] || headers["DIA"] || 5;
  var matchCol = headers["MATCH"] || 13;
  var fechaRealCol = headers["FECHA CITA REAL"] || ensureRealDateColumn(sheet, headers);

  var statusVal = (col === matchCol ? (newValue || "") : (sheet.getRange(row, matchCol).getValue() || "")).toString().trim();
  var statusUpper = statusVal.toUpperCase();

  // Asegurar color según ⚙️ CONFIG ESTADOS
  var estadosData = getEstadosPorEtapa();
  if (col === matchCol && statusVal && estadosData.COLOR_MAP[statusUpper]) {
    sheet.getRange(row, matchCol).setBackground(estadosData.COLOR_MAP[statusUpper]);
  }

  // A. REGLA DE RECHAZO: Si alguno rechaza, el match muere y AMBOS vuelven como slot a sus psicólogas
  var REJECTION_KEYWORDS = [
    "NO MATCH", "RECHAZÓ", "RECHAZO", "SIN QUÍMICA", "SIN QUIMICA",
    "TROUBLEMAKER", "DESCALIFICADO", "PROBLEMAS PERSONALES", "NO CONTESTAN"
  ];
  
  var isRejection = false;
  for (var k = 0; k < REJECTION_KEYWORDS.length; k++) {
    if (statusUpper.indexOf(REJECTION_KEYWORDS[k]) >= 0) {
      isRejection = true;
      break;
    }
  }

  if (col === matchCol && isRejection) {
    var cellA = getCellData(sheet, row, personACol);
    var cellB = getCellData(sheet, row, personBCol);

    if (cellA && cellA.text) {
      withScriptLock(function() {
        returnCandidatesToPsychologists(sheet, row, cellA, cellB, statusVal);
      });
    }
    return;
  }

  // B. PROMOCIÓN A ZONA SUPERIOR AL AGENDAR / CONFIRMAR CITA
  var isScheduled = (statusUpper === "CITA CONFIRMADA" || statusUpper === "DATE PROGRAMADO");
  var fechaRealVal = (col === fechaRealCol ? (newValue || "") : (sheet.getRange(row, fechaRealCol).getValue() || ""));

  if ((col === matchCol && isScheduled) || (col === fechaRealCol && fechaRealVal)) {
    // Si la fecha real se ingresó o el estado pasó a confirmada, colorear fecha
    if (fechaRealCol) {
      var dVal = sheet.getRange(row, fechaRealCol).getValue();
      updateMatchesRowColor(sheet, row, dVal, statusUpper);
    }
  }
}

/**
 * Asegura la existencia de la columna 'FECHA CITA REAL' en MATCHES (Columna R / 18).
 */
function ensureRealDateColumn(sheet, headers) {
  if (headers["FECHA CITA REAL"]) return headers["FECHA CITA REAL"];
  var targetCol = 18;
  sheet.getRange(1, targetCol).setValue("FECHA CITA REAL").setFontWeight("bold").setBackground("#D9D2E9");
  headers["FECHA CITA REAL"] = targetCol;
  return targetCol;
}

/**
 * Retorna a Persona A y Persona B a sus respectivas pestañas de psicóloga como slots nuevos.
 */
function returnCandidatesToPsychologists(matchesSheet, row, cellA, cellB, rejectionReason) {
  var headers = getSheetHeaders(matchesSheet);
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 3;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 4;
  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
  var noteMsg = "[RETORNO MATCHES] " + rejectionReason + " (" + todayStr + ")";
  var missingPsyc = false;

  // 1. Retornar Persona A a su psicóloga
  var psycA = findPsychologistForPerson(cellA);
  var sheetPsycA = psycA ? findPsychologistSheet(psycA) : null;

  if (sheetPsycA) {
    var hA = getSheetHeaders(sheetPsycA);
    appendPrioritySlotRow(sheetPsycA, hA, {
      city: "",
      pref: "",
      plan: "",
      personACell: cellA,
      slotIndex: 1,
      totalSlots: 1,
      observaciones: noteMsg,
      status: "Listo para match"
    });
    Logger.log("✅ Persona A (" + cellA.text + ") retornada a 'MATCHES " + psycA + "'");
    matchesSheet.getRange(row, personACol).clearNote();
  } else {
    // Si no se encuentra psicóloga para Persona A, marcar en amarillo #FFF2CC con nota explicativa
    matchesSheet.getRange(row, personACol)
      .setBackground("#FFF2CC")
      .setNote("No se encontró psicóloga asignada para '" + cellA.text + "'. Asigne la psicóloga manualmente para crear el slot de retorno.");
    Logger.log("⚠️ Psicóloga de Persona A ('" + cellA.text + "') no encontrada. Fila " + row + " marcada en amarillo.");
    missingPsyc = true;
  }

  // 2. Retornar Persona B a su psicóloga (si existe)
  if (cellB && cellB.text && cellB.text.toLowerCase() !== "por definir") {
    var psycB = findPsychologistForPerson(cellB);
    var sheetPsycB = psycB ? findPsychologistSheet(psycB) : null;

    if (sheetPsycB) {
      var hB = getSheetHeaders(sheetPsycB);
      appendPrioritySlotRow(sheetPsycB, hB, {
        city: "",
        pref: "",
        plan: "",
        personACell: cellB,
        slotIndex: 1,
        totalSlots: 1,
        observaciones: noteMsg,
        status: "Listo para match"
      });
      Logger.log("✅ Persona B (" + cellB.text + ") retornada a 'MATCHES " + psycB + "'");
      matchesSheet.getRange(row, personBCol).clearNote();
    } else {
      // Si no se encuentra psicóloga para Persona B, marcar en amarillo #FFF2CC con nota explicativa
      matchesSheet.getRange(row, personBCol)
        .setBackground("#FFF2CC")
        .setNote("No se encontró psicóloga asignada para '" + cellB.text + "'. Asigne la psicóloga manualmente para crear el slot de retorno.");
      Logger.log("⚠️ Psicóloga de Persona B ('" + cellB.text + "') no encontrada. Fila " + row + " marcada en amarillo.");
      missingPsyc = true;
    }
  }

  if (missingPsyc) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Match rechazado: una o ambas personas no tienen psicóloga asignada. Celdas marcadas en amarillo.", "Revisión Requerida", 6);
  } else {
    // Marcar en MATCHES que el retorno fue completado
    matchesSheet.getRange(row, 1, 1, matchesSheet.getLastColumn()).setBackground("#F4CCCC");
    SpreadsheetApp.getActiveSpreadsheet().toast("Match cerrado. Ambas personas retornadas a sus psicólogas.", "Rechazo Procesado", 5);
  }
}

/**
 * Busca la psicóloga asignada a una persona consultando PROFILES o el backend.
 * NUNCA asigna psicóloga por defecto si no la encuentra.
 */
function findPsychologistForPerson(personCell) {
  if (!personCell || !personCell.text) return "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var profSheet = ss.getSheetByName(CONFIG.PROFILES_SHEET_NAME || "PROFILES");
  
  var targetName = personCell.text.toLowerCase().trim();
  var targetCrmId = personCell.crmId || (personCell.richText ? extractCrmIdFromUrl(personCell.richText.getLinkUrl()) : "");

  if (profSheet) {
    var pHeaders = getSheetHeaders(profSheet);
    var nameCol = pHeaders["FULLNAME"] || pHeaders["NOMBRE"] || 2;
    var respCol = pHeaders["RESPONSABLE"] || pHeaders["PSICOLOGA"] || 4;
    var lastRow = profSheet.getLastRow();

    if (lastRow > 1) {
      var values = profSheet.getRange(2, 1, lastRow - 1, profSheet.getLastColumn()).getValues();
      for (var i = 0; i < values.length; i++) {
        var rowName = (values[i][nameCol - 1] || "").toString().toLowerCase().trim();
        var rowPsyc = (values[i][respCol - 1] || "").toString().trim();
        if (rowName === targetName && rowPsyc) {
          return normalizePsychologistName(rowPsyc);
        }
      }
    }
  }

  // Fallback: Consultar al backend
  var query = targetCrmId || targetName;
  var crm = fetchProfileFromBackend(query);
  if (crm && crm.found && crm.psychologist) {
    return normalizePsychologistName(crm.psychologist);
  }

  // Si no se encuentra, retornar vacío (NUNCA asignar a SILVI ni a nadie por defecto)
  return "";
}

/**
 * Colorea la fila de MATCHES según si la cita ya pasó, es hoy o es futura.
 */
function updateMatchesRowColor(sheet, row, dateVal, statusUpper) {
  if (!dateVal) return;

  var dateObj = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
  if (isNaN(dateObj.getTime())) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var checkDate = new Date(dateObj);
  checkDate.setHours(0, 0, 0, 0);

  var bgColor = null;
  if (checkDate.getTime() < today.getTime()) {
    // Cita ya pasó (Gris suave)
    bgColor = "#F3F3F3";
  } else if (checkDate.getTime() === today.getTime()) {
    // Cita de hoy (Amarillo suave)
    bgColor = "#FFF2CC";
  } else {
    // Cita futura (Azul suave)
    bgColor = "#CFE2F3";
  }

  if (bgColor) {
    sheet.getRange(row, 1, 1, 8).setBackground(bgColor);
  }
}

/**
 * Abre el panel lateral (Sidebar) interactivo con el historial completo de candidatos, feedback y notas.
 */
function mostrarHistorialPersona() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var activeRange = sheet.getActiveRange();
  var initialQuery = "";

  if (activeRange) {
    var row = activeRange.getRow();
    var val = (activeRange.getValue() || "").toString().trim();

    // Si la celda seleccionada tiene texto/link directo
    if (val && val.length > 2 && val.indexOf("http") === -1 && val.toUpperCase() !== "APROBADO" && val.toUpperCase() !== "HECHO") {
      initialQuery = val;
    } else if (row > 1) {
      // Intentar leer de columnas conocidas (Persona A, FullName, Persona B)
      var headers = getSheetHeaders(sheet);
      var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["FULLNAME"] || headers["NOMBRE"] || headers["CLIENTE"] || 2;
      var personBCol = headers["PERSON B"] || headers["PERSONA B"] || 7;
      
      var cellA = getCellData(sheet, row, personACol);
      var cellB = getCellData(sheet, row, personBCol);

      if (cellA && cellA.text && cellA.text.indexOf("http") === -1) {
        initialQuery = cellA.text;
      } else if (cellB && cellB.text && cellB.text.indexOf("http") === -1) {
        initialQuery = cellB.text;
      } else if (val) {
        initialQuery = val;
      }
    }
  }

  var html = HtmlService.createHtmlOutput(getHistorialSidebarHtml(initialQuery))
    .setTitle("Daily Lover — Historial de Persona")
    .setWidth(420);

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Consulta el endpoint /history/{query} del backend y retorna los datos JSON al cliente.
 */
function fetchPersonHistoryData(query) {
  if (!query) return { error: "Por favor ingrese un nombre o CRM ID." };
  var cleanQuery = query.toString().trim();
  var apiUrl = (CONFIG.BACKEND_API_URL || "https://prueba-daily.agentesia.cloud") + "/api/v1/matchmaking/history/" + encodeURIComponent(cleanQuery);

  try {
    var response = UrlFetchApp.fetch(apiUrl, {
      method: "get",
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      return { error: "No se encontró historial para '" + cleanQuery + "' (HTTP " + code + ")" };
    }
  } catch (e) {
    return { error: "Error de conexión con el backend: " + e.message };
  }
}

/**
 * Genera el código HTML/CSS/JS del Sidebar con el diseño oficial Daily Lover.
 */
function getHistorialSidebarHtml(initialQuery) {
  var escapedQuery = (initialQuery || "").replace(/"/g, '&quot;');
  return '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'  <meta charset="utf-8">' +
'  <base target="_top">' +
'  <style>' +
'    * { box-sizing: border-box; margin: 0; padding: 0; }' +
'    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0D0A0B; color: #F5F0F1; padding: 16px; font-size: 13px; }' +
'    .header { background: linear-gradient(135deg, #961500, #5c0d00); padding: 14px 16px; border-radius: 12px; margin-bottom: 14px; box-shadow: 0 4px 12px rgba(150,21,0,0.3); }' +
'    .header h2 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 2px; }' +
'    .header p { font-size: 11px; color: rgba(255,255,255,0.8); }' +
'    .search-box { display: flex; gap: 6px; margin-bottom: 14px; }' +
'    .search-box input { flex: 1; background: #1A1214; border: 1px solid rgba(150,21,0,0.3); border-radius: 8px; color: #fff; padding: 9px 12px; font-size: 13px; outline: none; }' +
'    .search-box input:focus { border-color: #961500; box-shadow: 0 0 0 2px rgba(150,21,0,0.2); }' +
'    .search-box button { background: #961500; color: #fff; border: none; border-radius: 8px; padding: 0 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }' +
'    .search-box button:hover { background: #c41a00; }' +
'    .card { background: #1A1214; border: 1px solid rgba(150,21,0,0.2); border-radius: 10px; padding: 14px; margin-bottom: 12px; }' +
'    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9A8A8D; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }' +
'    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }' +
'    .badge-wine { background: rgba(150,21,0,0.25); color: #ff6b6b; border: 1px solid rgba(150,21,0,0.4); }' +
'    .badge-green { background: rgba(76,175,80,0.2); color: #81c784; }' +
'    .badge-yellow { background: rgba(255,193,7,0.2); color: #ffd54f; }' +
'    .badge-blue { background: rgba(33,150,243,0.2); color: #64b5f6; }' +
'    .badge-gray { background: rgba(255,255,255,0.1); color: #ccc; }' +
'    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }' +
'    .stat-item { background: #150F11; border: 1px solid rgba(150,21,0,0.15); border-radius: 8px; padding: 8px 6px; text-align: center; }' +
'    .stat-val { font-size: 16px; font-weight: 700; color: #fff; }' +
'    .stat-lbl { font-size: 9px; color: #9A8A8D; text-transform: uppercase; margin-top: 2px; }' +
'    .match-item { background: #150F11; border-left: 3px solid #961500; border-radius: 0 8px 8px 0; padding: 10px 12px; margin-bottom: 8px; }' +
'    .match-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }' +
'    .match-name { font-weight: 600; color: #fff; font-size: 13px; }' +
'    .match-meta { font-size: 11px; color: #9A8A8D; margin-bottom: 6px; }' +
'    .match-feedback { font-size: 11px; color: #ffd54f; background: rgba(255,193,7,0.08); padding: 6px 8px; border-radius: 6px; margin-top: 4px; }' +
'    .match-obs { font-size: 11px; color: #bbb; margin-top: 4px; font-style: italic; }' +
'    .loading { text-align: center; padding: 30px; color: #9A8A8D; font-size: 13px; }' +
'    .spinner { border: 3px solid rgba(150,21,0,0.2); border-top: 3px solid #961500; border-radius: 50%; width: 24px; height: 24px; animation: spin 0.8s linear infinite; margin: 0 auto 10px; }' +
'    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' +
'    .empty-state { text-align: center; padding: 20px; color: #777; font-size: 12px; }' +
'    .error-msg { background: rgba(244,67,54,0.15); border: 1px solid #f44336; color: #ef5350; padding: 10px; border-radius: 8px; font-size: 12px; margin-bottom: 12px; }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="header">' +
'    <h2>🔎 Daily Lover</h2>' +
'    <p>Historial y Candidatos Presentados</p>' +
'  </div>' +
'  <div class="search-box">' +
'    <input type="text" id="search-input" placeholder="Nombre o CRM ID..." value="' + escapedQuery + '" onkeydown="if(event.key===\'Enter\') runSearch()">' +
'    <button onclick="runSearch()">Buscar</button>' +
'  </div>' +
'  <div id="content-area">' +
'    <div class="loading"><div class="spinner"></div>Cargando historial...</div>' +
'  </div>' +
'  <script>' +
'    function runSearch() {' +
'      var q = document.getElementById("search-input").value.trim();' +
'      if (!q) return;' +
'      document.getElementById("content-area").innerHTML = \'<div class="loading"><div class="spinner"></div>Buscando a <b>\' + escapeHtml(q) + \'</b>...</div>\';' +
'      google.script.run' +
'        .withSuccessHandler(renderData)' +
'        .withFailureHandler(renderError)' +
'        .fetchPersonHistoryData(q);' +
'    }' +
'    function renderData(data) {' +
'      var area = document.getElementById("content-area");' +
'      if (!data || data.error) {' +
'        area.innerHTML = \'<div class="error-msg">\' + escapeHtml(data ? data.error : "No se encontraron datos.") + \'</div>\';' +
'        return;' +
'      }' +
'      var html = "";' +
'      html += \'<div class="card">\';' +
'      html += \'  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">\';' +
'      html += \'    <div><div style="font-size:15px; font-weight:700; color:#fff;">\' + escapeHtml(data.person_name) + \'</div>\';' +
'      if (data.crm_id && data.crm_id !== "None") {' +
'        html += \'    <div style="font-size:11px; color:#9A8A8D; margin-top:2px;">CRM ID: <b>\' + escapeHtml(data.crm_id) + \'</b></div>\';' +
'      }' +
'      html += \'    </div>\';' +
'      if (data.plan_tier) {' +
'        html += \'    <span class="badge badge-wine">\' + escapeHtml(data.plan_tier) + \'</span>\';' +
'      }' +
'      html += \'  </div>\';' +
'      html += \'  <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">\';' +
'      if (data.city) html += \'<span class="badge badge-gray">📍 \' + escapeHtml(data.city) + \'</span>\';' +
'      if (data.pref) html += \'<span class="badge badge-gray">❤️ \' + escapeHtml(data.pref) + \'</span>\';' +
'      if (data.psychologist) html += \'<span class="badge badge-gray">👩‍⚕️ \' + escapeHtml(data.psychologist) + \'</span>\';' +
'      if (data.age) html += \'<span class="badge badge-gray">🎂 \' + escapeHtml(data.age) + \' años</span>\';' +
'      if (data.occupation) html += \'<span class="badge badge-gray">💼 \' + escapeHtml(data.occupation) + \'</span>\';' +
'      html += \'  </div>\';' +
'      html += \'</div>\';' +
'      html += \'<div class="stats-row">\';' +
'      html += \'  <div class="stat-item"><div class="stat-val">\' + (data.completed_count || 0) + \'</div><div class="stat-lbl">Hechas</div></div>\';' +
'      html += \'  <div class="stat-item"><div class="stat-val">\' + (data.in_progress_count || 0) + \'</div><div class="stat-lbl">Proceso</div></div>\';' +
'      html += \'  <div class="stat-item"><div class="stat-val">\' + (data.trouble_count || 0) + \'</div><div class="stat-lbl">Rechazos</div></div>\';' +
'      html += \'  <div class="stat-item"><div class="stat-val">\' + (data.total_matches_count || 0) + \'</div><div class="stat-lbl">Total</div></div>\';' +
'      html += \'</div>\';' +
'      html += \'<div class="card">\';' +
'      html += \'  <div class="card-title"><span>👥 Candidatos Presentados</span><span class="badge badge-gray">\' + (data.matches ? data.matches.length : 0) + \'</span></div>\';' +
'      if (!data.matches || data.matches.length === 0) {' +
'        html += \'  <div class="empty-state">No tiene candidatos previos registrados.</div>\';' +
'      } else {' +
'        for (var i = 0; i < data.matches.length; i++) {' +
'          var m = data.matches[i];' +
'          var badgeClass = "badge-gray";' +
'          var stUpper = (m.status || "").toUpperCase();' +
'          if (stUpper === "APROBADO" || stUpper === "MATCH DONE") badgeClass = "badge-green";' +
'          else if (stUpper === "HECHO" || stUpper === "HECHO POR MAPE") badgeClass = "badge-blue";' +
'          else if (stUpper.indexOf("LISTO") >= 0 || stUpper.indexOf("PENDIENTE") >= 0) badgeClass = "badge-yellow";' +
'          else if (stUpper.indexOf("TROUBLE") >= 0 || stUpper.indexOf("NOT APPROVED") >= 0) badgeClass = "badge-wine";' +
'          html += \'  <div class="match-item">\';' +
'          html += \'    <div class="match-header">\';' +
'          html += \'      <span class="match-name">\' + escapeHtml(m.candidate_name) + \'</span>\';' +
'          html += \'      <span class="badge \' + badgeClass + \'">\' + escapeHtml(m.status) + \'</span>\';' +
'          html += \'    </div>\';' +
'          html += \'    <div class="match-meta">📅 \' + (m.fecha || "Sin fecha") + \' &bull; 👩‍⚕️ \' + (m.psychologist || "General") + (m.role ? " &bull; Rol: " + m.role : "") + \'</div>\';' +
'          if (m.feedback) {' +
'            html += \'    <div class="match-feedback">💬 <b>Feedback:</b> \' + escapeHtml(m.feedback) + \'</div>\';' +
'          }' +
'          if (m.observations) {' +
'            html += \'    <div class="match-obs">📝 \' + escapeHtml(m.observations) + \'</div>\';' +
'          }' +
'          html += \'  </div>\';' +
'        }' +
'      }' +
'      html += \'</div>\';' +
'      if (data.bio_notes || data.difficult_notes) {' +
'        html += \'<div class="card">\';' +
'        html += \'  <div class="card-title">📝 Notas Internas</div>\';' +
'        if (data.bio_notes) html += \'  <div style="font-size:12px; color:#ddd; margin-bottom:6px;">\' + escapeHtml(data.bio_notes) + \'</div>\';' +
'        if (data.difficult_notes) html += \'  <div style="font-size:11px; color:#ff8a80;"><b>Nota Dificultad:</b> \' + escapeHtml(data.difficult_notes) + \'</div>\';' +
'        html += \'</div>\';' +
'      }' +
'      area.innerHTML = html;' +
'    }' +
'    function renderError(err) {' +
'      document.getElementById("content-area").innerHTML = \'<div class="error-msg">Error: \' + escapeHtml(err.message || err) + \'</div>\';' +
'    }' +
'    function escapeHtml(str) {' +
'      if (!str) return "";' +
'      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");' +
'    }' +
'    window.onload = function() {' +
'      var initQ = document.getElementById("search-input").value.trim();' +
'      if (initQ) runSearch();' +
'      else document.getElementById("content-area").innerHTML = \'<div class="empty-state">Seleccione una celda con un cliente o busque por nombre arriba.</div>\';' +
'    };' +
'  </script>' +
'</body>' +
'</html>';
}



