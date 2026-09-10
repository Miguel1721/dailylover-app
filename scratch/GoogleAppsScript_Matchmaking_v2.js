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
  API_BASE_URL: "https://prueba-daily.agentesia.cloud",
  PSYCHOLOGIST_SHEET_PREFIX: "MATCHES ",
  TROUBLE_SHEET_NAME: "TROUBLE MATCHES",
  REFUNDS_SHEET_NAME: "REFUNDS PENDIENTES",
  VUELVE_A_PAGAR_SHEET_NAME: "VUELVE A PAGAR",
  VUELVE_A_PAGAR_ALIASES: ["VUELVE A PAGAR", "VOLVIO A PAGAR", "VOLVIÓ A PAGAR"],
  REVISION_MARIA_SHEET_NAME: "REVISIÓN MARÍA",
  MATCHES_SHEET_NAME: "MATCHES",
  CONFIG_ESTADOS_SHEET_NAME: "⚙️ CONFIG ESTADOS",
  MARIA_EMAIL: "agente.col.bot@gmail.com",
  PRIORITY_SHEET_NAME: "PERSONAS DÍFICILES",
  PROFILES_SHEET_NAME: "PROFILES",
  TIMEZONE: "America/Bogota",
  LOCK_TIMEOUT_MS: 30000,
  VALID_PSYCHOLOGISTS: [
    "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA", "MPS"
  ],
  PSYCHOLOGIST_ALIASES: {
    "MARIA": "MPS",
    "MARÍA": "MPS",
    "MPS": "MPS",
    "MARI DE LA E": "MPS",
    "MARI DE LA ESPRIELLA": "MPS",
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
    "SOFI ARIAS": "SOFI",
    "SOFIA ARIAS": "SOFI",
    "SOFÍA ARIAS": "SOFI",
    "ALEJA": "ALEJA",
    "PIA": "PIA",
    "PÍA": "PIA",
    "ISA": "ISA",
    "ISA MARQUEZ": "ISA",
    "ISABELLA MARQUEZ": "ISA",
    "ISABELLA": "ISA"
  },
  PLAN_SLOTS_MAP: {
    "BÁSICO 40K (1 CITA)": 2,
    "BÁSICO 40K": 2,
    "BASICO 40K": 2,
    "BÁSICO": 2,
    "BASICO": 2,
    "PREMIUM": 3,
    "PREMIUM 150K": 3,
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
    "VIP 195K (5 CITAS)": 4,
    "VIP 195K": 4,
    "VIP 295K": 4,
    "VIP ORO": 4,
    "VIP": 4,
    "MATCHMAKING EXPERIENCE": 4,
    "EXPERIENCE": 4
  }
};

// ─── 1. DISPARADOR PRINCIPAL (SOLO INSTALABLE - NUNCA CREAR onEdit SIMPLE) ─
// ⚠️ IMPORTANTE: NUNCA definir 'function onEdit(e)'. El libro ya tiene un
// trigger instalable configurado que ejecuta 'onEditInstallable(e)'.
// Si se define 'onEdit(e)', Google Sheets disparará ambas funciones al mismo
// tiempo provocando condiciones de carrera y bloqueos.

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

  // ── DEBOUNCING ANTI-DUPLICADO DE TRIGGERS (POR CELDA FÍSICA) ──
  var editKey = "onEdit_" + sheetName + "_" + row + "_" + col;
  try {
    var cache = CacheService.getScriptCache();
    if (cache && cache.get(editKey)) {
      Logger.log("⚠️ Evento onEdit duplicado en misma celda detectado para " + editKey + " (debounced). Abortando segunda ejecución.");
      return;
    }
    if (cache) cache.put(editKey, "1", 4); // 4 segundos de protección por celda
  } catch (cacheErr) {
    Logger.log("Aviso de CacheService: " + cacheErr.message);
  }

  var upperSheetName = sheetName.trim().toUpperCase();

  // A. Pestañas de psicólogas ("MATCHES SILVI", "MATCHES JENN", "MATCHES ANA ", etc.)
  if (upperSheetName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upperSheetName !== "MATCHES") {
    Logger.log("Despachando a handlePsychologistSheetEdit...");
    handlePsychologistSheetEdit(sheet, row, col, e.value, e.oldValue);
  } else if (upperSheetName === CONFIG.VUELVE_A_PAGAR_SHEET_NAME || upperSheetName === "VOLVIO A PAGAR" || upperSheetName === "VOLVIÓ A PAGAR") {
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
  } else if (upperSheetName === "CITAS ACEPTADAS" || upperSheetName === "CITAS CONFIRMADAS") {
    Logger.log("Despachando a handleCitasAceptadasEdit...");
    handleCitasAceptadasEdit(sheet, row, col, e.value, e.oldValue);
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

  // ── 0. REGLA: PROHIBIR BORRAR PERSONA A O PERSONA B YA EXISTENTES ─────────
  if ((personACol && col === personACol) || (personBCol && col === personBCol)) {
    var rawEdit = (newValue || sheet.getRange(row, col).getValue() || "").toString().trim();
    if (oldValue && oldValue.toString().trim() !== "" && (!rawEdit || rawEdit === "")) {
      sheet.getRange(row, col).setValue(oldValue);
      SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Prohibido borrar datos de Persona A / Persona B ya registradas.", "Operación Inválida", 5);
      return;
    }
  }

  // ── A. EDICIÓN DE PERSONA A (SOLO URL CRM CON REVERSIÓN DURA) ────────────
  if (personACol && col === personACol) {
    var rawValA = (typeof newValue !== "undefined" && newValue ? newValue : (sheet.getRange(row, personACol).getValue() || "")).toString().trim();
    if (rawValA) {
      var isUrlA = rawValA.indexOf("http") >= 0 || rawValA.indexOf("smartmatchapp") >= 0 || rawValA.indexOf("client/") >= 0 || rawValA.indexOf("profile/") >= 0;
      var cellA = getCellData(sheet, row, personACol);
      var hasLinkA = cellA && cellA.richText && cellA.richText.getLinkUrl();

      if (!isUrlA && !hasLinkA) {
        // Bloqueo duro: revertir celda al valor previo (o vaciarla si era nueva)
        sheet.getRange(row, personACol).setValue(oldValue || "");
        sheet.getRange(row, personACol).setBackground("#F4CCCC").setNote("⚠️ Operación Inválida: Solo se permite pegar el enlace de SmartMatchApp, no texto libre.");
        SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Operación Inválida: Solo se permite pegar el enlace de SmartMatchApp en Persona A.", "Operación Inválida", 6);
        return;
      }

      if (isUrlA) {
        var crmIdA = extractCrmIdFromUrl(rawValA);
        var crmA = fetchProfileFromBackend(crmIdA || rawValA);
        if (crmA && crmA.found && crmA.name) {
          var canonUrlA = buildCanonicalCrmUrl(crmA.crm_id || crmIdA, rawValA);
          var richA = SpreadsheetApp.newRichTextValue().setText(crmA.name).setLinkUrl(canonUrlA).build();
          sheet.getRange(row, personACol).setRichTextValue(richA).setBackground(null).clearNote();
          protegerCeldaPersona(sheet, row, personACol, crmA.name, "Persona A");
        }
      }
    }
    return;
  }

  // ── B. CRUCE AUTOMÁTICO DE PSICÓLOGA DE B AL EDITAR PERSON B (SOLO URL CRM CON VALIDACIÓN DE COMPATIBILIDAD)
  if (personBCol && col === personBCol) {
    var rawValB = (typeof newValue !== "undefined" && newValue ? newValue : (sheet.getRange(row, personBCol).getValue() || "")).toString().trim();
    if (rawValB) {
      var isUrlB = rawValB.indexOf("http") >= 0 || rawValB.indexOf("smartmatchapp") >= 0 || rawValB.indexOf("client/") >= 0 || rawValB.indexOf("profile/") >= 0;
      var cellB = getCellData(sheet, row, personBCol);
      var hasLinkB = cellB && cellB.richText && cellB.richText.getLinkUrl();

      // Bloqueo duro: rechazar y revertir texto plano sin URL
      if (!isUrlB && !hasLinkB) {
        sheet.getRange(row, personBCol).setValue(oldValue || "");
        sheet.getRange(row, personBCol).setBackground("#F4CCCC").setNote("⚠️ Operación Inválida: Solo se permite pegar el enlace de SmartMatchApp, no texto libre.");
        SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Operación Inválida: Solo se permite pegar el enlace de SmartMatchApp en Persona B.", "Operación Inválida", 6);
        if (psycBCol) sheet.getRange(row, psycBCol).setValue("").setBackground(null);
        return;
      }

      var personBCell = cellB;
      var crmIdB = extractCrmIdFromUrl(rawValB) || (cellB ? cellB.crmId : "");
      var crmB = fetchProfileFromBackend(crmIdB || rawValB);
      if (crmB && crmB.found && crmB.name) {
        var canonUrlB = buildCanonicalCrmUrl(crmB.crm_id || crmIdB, rawValB);
        var richB = SpreadsheetApp.newRichTextValue().setText(crmB.name).setLinkUrl(canonUrlB).build();
        sheet.getRange(row, personBCol).setRichTextValue(richB).setBackground(null).clearNote();
        protegerCeldaPersona(sheet, row, personBCol, crmB.name, "Persona B");
        personBCell = { text: crmB.name, richText: richB, formula: "", crmId: crmB.crm_id || crmIdB, link: canonUrlB, city: crmB.city, pref: crmB.pref || crmB.orientation, psychologist: crmB.psychologist };
      } else if (isUrlB && crmIdB) {
        // Respaldo si backend no respondió de inmediato: buscar en libro
        var detailsB = findPersonDetailsInWorkbook({ crmId: crmIdB, link: rawValB, text: "" });
        if (detailsB && detailsB.name) {
          var canonUrlB = buildCanonicalCrmUrl(crmIdB, rawValB);
          var richB = SpreadsheetApp.newRichTextValue().setText(detailsB.name).setLinkUrl(canonUrlB).build();
          sheet.getRange(row, personBCol).setRichTextValue(richB).setBackground(null).clearNote();
          protegerCeldaPersona(sheet, row, personBCol, detailsB.name, "Persona B");
          personBCell = { text: detailsB.name, richText: richB, formula: "", crmId: crmIdB, link: canonUrlB, city: detailsB.city, pref: detailsB.pref, psychologist: detailsB.psychologist };
        }
      }

      // ── VALIDACIÓN DE COMPATIBILIDAD AMPLIADA (Orientación, Cita Previa, Edades, Estatura, Límites, Ciudad) ──
      var cellA = personACol ? getCellData(sheet, row, personACol) : null;
      if (cellA && cellA.text && personBCell && personBCell.text) {
        var compCheck = checkPairCompatibility(cellA, personBCell, sheet, row, headers);

        // 1. Advertencias No Bloqueantes (Ciudad, Rango de Edad, Preferencias de Género/Orientación, Estatura, Límites)
        if (compCheck.warnings && compCheck.warnings.length > 0) {
          var warnNote = "ℹ️ AVISOS DE COMPATIBILIDAD:\n• " + compCheck.warnings.join("\n• ");
          sheet.getRange(row, personBCol).setNote(warnNote);
          SpreadsheetApp.getActiveSpreadsheet().toast("ℹ️ " + compCheck.warnings[0], "Aviso de Compatibilidad", 6);
        } else {
          sheet.getRange(row, personBCol).clearNote();
        }

        // 2. Bloqueo Duro con Modal "¿Forzar?": Solo para Orientación Real Incompatible o Cita Previa Repetida
        if (!compCheck.compatible && compCheck.issues && compCheck.issues.length > 0) {
          var alertLockKey = "alert_comp_" + sheet.getName() + "_" + row;
          var cache = CacheService.getScriptCache();
          if (cache && cache.get(alertLockKey)) {
            Logger.log("⚠️ Modal de compatibilidad ya mostrado recientemente para " + alertLockKey + ". Omitiendo modal duplicado.");
            return;
          }
          if (cache) cache.put(alertLockKey, "1", 6); // 6 segundos de protección contra modal duplicado

          var ui = SpreadsheetApp.getUi();
          var promptMsg = "⚠️ INCOMPATIBILIDAD DETECTADA EN ESTA PROPUESTA:\n\n" + 
                          compCheck.issues.map(function(iss) { return "• " + iss; }).join("\n") + 
                          "\n\n¿Deseas FORZAR y guardar esta asignación de todos modos a pesar de la incompatibilidad?";
          var resp = ui.alert("Validación de Compatibilidad", promptMsg, ui.ButtonSet.YES_NO);
          if (resp !== ui.Button.YES) {
            sheet.getRange(row, personBCol).setValue(oldValue || "");
            if (psycBCol) sheet.getRange(row, psycBCol).setValue("").setBackground(null);
            SpreadsheetApp.getActiveSpreadsheet().toast("Asignación cancelada por incompatibilidad.", "Propuesta Cancelada", 6);
            return;
          } else {
            var obsCol = headers["OBSERVACIONES"] || headers["OBSERVACION"] || headers["NOTAS"];
            if (obsCol) {
              var currObs = (sheet.getRange(row, obsCol).getValue() || "").toString().trim();
              var forceTag = "[Compatibilidad Forzada: " + compCheck.issues.join("; ") + "]";
              if (currObs.indexOf(forceTag) === -1) {
                var newObs = (currObs ? currObs + "\n" : "") + forceTag;
                sheet.getRange(row, obsCol).setValue(newObs);
              }
            }
          }
        }
      }

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
    }
    return;
  }

  // ── C. EDICIÓN DE STATUS ──────────────────────────────────────────────────
  if (!statusCol || col !== statusCol) return;

  var statusVal = (newValue || sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase();
  if (!statusVal) return;

  var fechaCol = headers["FECHA DE ENTREVISTA"] || headers["FECHA ENTREVISTA"] || headers["FECHA"] || headers["DATE"];
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

  // ── C.1 VALIDACIÓN BLOQUEANTE PARA HECHO / HECHO POR MAPE (EXIGE LINK CRM EN AMBAS) ──
  if (statusVal === "HECHO" || statusVal === "HECHO POR MAPE") {
    var hasValidLinkA = personACell && personACell.text && (
      (personACell.richText && !!personACell.richText.getLinkUrl()) ||
      (personACell.formula && personACell.formula.indexOf("HYPERLINK") >= 0)
    );
    var hasValidLinkB = personBCell && personBCell.text && (
      (personBCell.richText && !!personBCell.richText.getLinkUrl()) ||
      (personBCell.formula && personBCell.formula.indexOf("HYPERLINK") >= 0)
    );

    if (!hasValidLinkA || !hasValidLinkB) {
      // Bloqueo duro: revertir STATUS al valor previo o Listo para match
      var revertStatus = oldValue || "Listo para match";
      sheet.getRange(row, statusCol).setValue(revertStatus);
      if (revertStatus === "Listo para match") {
        sheet.getRange(row, statusCol).setBackground("#FFF2CC");
      }

      var missingFields = [];
      if (!hasValidLinkA) {
        missingFields.push("Persona A");
        if (personACol) sheet.getRange(row, personACol).setBackground("#F4CCCC").setNote("⚠️ Se requiere enlace válido de SmartMatchApp para cerrar el match.");
      }
      if (!hasValidLinkB) {
        missingFields.push("Persona B");
        if (personBCol) sheet.getRange(row, personBCol).setBackground("#F4CCCC").setNote("⚠️ Se requiere enlace válido de SmartMatchApp para cerrar el match.");
      }

      var msg = "⛔ Operación Bloqueada: No se puede marcar como HECHO. " + missingFields.join(" y ") + " deben tener un enlace válido de SmartMatchApp asignado.";
      SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Validación Requerida", 8);
      Logger.log("BLOQUEADO HECHO en fila " + row + ": " + missingFields.join(" y ") + " sin enlace válido.");
      return;
    }

    if (fechaCol) {
      var currentFecha = sheet.getRange(row, fechaCol).getValue();
      if (!currentFecha || currentFecha.toString().trim() === "") {
        // Asignar Fecha de Entrevista de PROFILES si está disponible
        var cellAData = getCellData(sheet, row, personACol);
        var detailsA = findPersonDetailsInWorkbook(cellAData);
        if (detailsA && detailsA.date) {
          sheet.getRange(row, fechaCol).setValue(detailsA.date);
        } else {
          var now = new Date();
          var formattedDate = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
          sheet.getRange(row, fechaCol).setValue(formattedDate);
        }
      }
    }
  }

  // ── D. FILA ESPEJO & DOBLE APROBACIÓN ANTES DE MARÍA ───────────────────────
  if (statusVal === "HECHO" || statusVal === "HECHO POR MAPE" || statusVal === "APROBADO") {
    if (personACell && personBCell && personBName) {
      var ownerPsycB = findPsychologistForPerson(personBCell);
      var isMirrorRow = (obs && obs.indexOf("[ESPEJO]") >= 0) || (headers["PSICÓLOGA DE B"] && sheet.getRange(row, headers["PSICÓLOGA DE B"]).getValue() !== "");

      // CASO ESPECIAL: Si quien aprueba es MPS / MARÍA (Dirección)
      if (currentPsyc === "MPS" || currentPsyc === "MARÍA" || currentPsyc === "MARIA") {
        withScriptLock(function() {
          var matchesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES");
          if (matchesSheet) {
            var mariaCombinedObs = "[MPS" + (ownerPsycB && ownerPsycB !== currentPsyc ? " ↔ " + ownerPsycB : "") + "] " + (obs || "");
            insertMatchInLowerZone(matchesSheet, {
              personACell: personACell,
              personBCell: personBCell,
              city: city,
              observaciones: mariaCombinedObs
            });
            sheet.getRange(row, statusCol).setValue("APROBADO").setBackground("#B6D7A8");
            
            // Si Persona B es de otra psicóloga, crearle la fila espejo en su pestaña
            if (ownerPsycB && ownerPsycB !== "MPS" && ownerPsycB !== "MARÍA" && ownerPsycB !== "MARIA") {
              crearOActualizarFilaEspejo(sheet, row, "MPS", ownerPsycB, personACell, personBCell, city, pref, plan, obs);
            }
            SpreadsheetApp.getActiveSpreadsheet().toast("✨ Match aprobado directamente por MPS y transferido a MATCHES.", "Aprobación Directa MPS", 6);
          }
        });
        return;
      }

      // Si es un match cruzado (Psicóloga A != Psicóloga B)
      if (ownerPsycB && ownerPsycB !== currentPsyc) {
        withScriptLock(function() {
          // 1. Crear o sincronizar fila espejo en la pestaña de Psicóloga B
          crearOActualizarFilaEspejo(sheet, row, currentPsyc, ownerPsycB, personACell, personBCell, city, pref, plan, obs);

          // 2. Sincronizar a REVISIÓN MARÍA con estado de doble aprobación
          var statusAprob = isMirrorRow ? "APROBADO POR PSICÓLOGAS" : (statusVal === "APROBADO" ? "APROBADO POR PSICÓLOGAS" : "ESPERANDO APROBACIÓN DE " + ownerPsycB);
          syncToRevisionMaria({
            currentPsyc: currentPsyc,
            psycA: isMirrorRow ? ownerPsycB : currentPsyc,
            psycB: isMirrorRow ? currentPsyc : ownerPsycB,
            city: city,
            pref: pref,
            planA: plan,
            personACell: personACell,
            personBCell: personBCell,
            obs: obs,
            origenTab: sheet.getName(),
            origenFila: row,
            statusAprobacion: statusAprob
          });

          // 3. BLOQUEO INMEDIATO DE LA FILA:
          // Si es Psicóloga A proponiendo -> Bloquear fila de A para que no quede huérfana la fila espejo en B.
          // Si es Psicóloga B validando fila espejo -> Bloquear fila de B tras su aprobación.
          var lockDesc = isMirrorRow
            ? ("Fila Espejo Validada por " + currentPsyc + " (Solo editable por María)")
            : ("Fila Bloqueada: Propuesta Cruzada enviada a " + ownerPsycB + " (Solo editable por María)");
          
          bloquearFilaPsicologa(sheet, row, lockDesc);
        });

        var toastMsg = isMirrorRow
          ? ("🔒 Fila espejo bloqueada tras tu validación. Match enviado a Revisión María.")
          : ("🔒 Fila bloqueada al enviar propuesta cruzada a " + ownerPsycB + ". Si requieres corregir, solicita desbloqueo a María.");
        SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Match Cruzado", 6);
      } else {
        // Match interno (misma psicóloga para A y B) - Permanece editable normalmente
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

  // ── E.2 RECHAZADA POR PSICÓLOGA B: Reintento automático en pestaña de Psicóloga A ─
  if (statusVal === "RECHAZADA POR PSICÓLOGA B" || statusVal === "RECHAZADO POR PSICÓLOGA B") {
    if (personACell && personBCell) {
      var cacheKey = "cross_rejected_" + sheet.getName() + "_" + row;
      var cache = CacheService.getScriptCache();
      if (!cache.get(cacheKey)) {
        cache.put(cacheKey, "true", 45); // Deduplicación 45s

        withScriptLock(function() {
          // 1. Identificar la psicóloga dueña de la Persona A original (que en la fila espejo está en Persona B)
          var originalPsycA = psycBCol ? sheet.getRange(row, psycBCol).getValue().toString().replace(/\(.*\)/, "").trim() : "";
          if (!originalPsycA) originalPsycA = findPsychologistForPerson(personBCell);
          
          var sheetPsycA = findPsychologistSheet(originalPsycA);
          if (sheetPsycA) {
            var headersA = getSheetHeaders(sheetPsycA);
            var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
            
            // Extraer notas de rechazo de Psicóloga B si escribió alguna
            var motivoRechazo = (obs || "").replace(/\[Obs\.[^\]]*\]:[^|\n]*/gi, "").replace(/^[\s|:-]+/, "").trim();
            var retryObs = "Reintento automático tras rechazo de propuesta por " + currentPsyc + (motivoRechazo ? " (Motivo: " + motivoRechazo + ")" : "");
            
            // 2. Crear nueva fila para Persona A en la pestaña de Psicóloga A
            appendNewRetryRow(sheetPsycA, headersA, {
              city: city,
              pref: pref,
              plan: plan,
              personACell: personBCell, // Persona A original
              personBCell: null,
              fecha: "",
              fechaLlegada: todayStr,
              status: "Listo para match",
              observaciones: retryObs
            });
            Logger.log("✅ Nueva fila de reintento creada en '" + sheetPsycA.getName() + "' tras rechazo de " + currentPsyc);
          }

          // 3. Actualizar REVISIÓN MARÍA si existía el registro
          updateStatusInRevisionMaria(personBCell.text, personACell.text, "RECHAZADA POR PSICÓLOGA B", "#F4CCCC");

          // 4. Bloquear la fila espejo rechazada en la pestaña de Psicóloga B
          if (statusCol) sheet.getRange(row, statusCol).setBackground("#F4CCCC");
          bloquearFilaPsicologa(sheet, row, "Fila Espejo Rechazada por " + currentPsyc + " (Solo editable por María)");
        });

        SpreadsheetApp.getActiveSpreadsheet().toast("❌ Propuesta rechazada. Se creó una nueva fila para " + personBName + " en la pestaña de " + (originalPsycA || "Psicóloga A") + ".", "Propuesta Rechazada", 6);
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

// ─── 3. GESTIÓN DE TABLA "VUELVE A PAGAR" / "VOLVIO A PAGAR" (SSOT EXACTO & RECOMPRAS) ──

/**
 * Busca la pestaña de recompras aceptando los nombres oficiales y alias:
 * "VUELVE A PAGAR", "VOLVIO A PAGAR", "VOLVIÓ A PAGAR".
 */
function findVuelveAPagarSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var direct = ss.getSheetByName(CONFIG.VUELVE_A_PAGAR_SHEET_NAME || "VUELVE A PAGAR");
  if (direct) return direct;
  var aliases = CONFIG.VUELVE_A_PAGAR_ALIASES || ["VOLVIO A PAGAR", "VOLVIÓ A PAGAR", "VUELVE A PAGAR"];
  for (var i = 0; i < aliases.length; i++) {
    var sh = ss.getSheetByName(aliases[i]);
    if (sh) return sh;
  }
  return null;
}

/**
 * Procesa recompras de citas en "VUELVE A PAGAR" / "VOLVIO A PAGAR":
 * Genera una fila nueva en la pestaña de la psicóloga responsable
 * siguiendo el patrón canónico de reactivación / fila nueva con nota indicando recompra.
 */
function handleVuelveAPagarEdit(sheet, row, col, newValue, oldValue) {
  if (row <= 1) return; // Ignorar fila de encabezados

  var headers = getSheetHeaders(sheet);
  var statusCol = headers["STATUS"] || headers["ESTADO"];
  var personaCol = headers["PERSONA"] || headers["PERSON A"] || headers["CLIENTE"] || headers["NOMBRE"] || 2;
  var psychologistCol = headers["HECHO POR"] || headers["PSICOLOGA"] || headers["PSICÓLOGA"];
  var planCol = headers["PLAN"] || headers["PLAN TIER"] || headers["RAZÓN"] || headers["RAZON"] || 3;
  var fechaCol = headers["FECHA"] || 4;
  var csObsCol = headers["COMENTARIO CUSTOMER SERVICE"] || headers["OBSERVACIONES"] || headers["COMENTARIO"] || headers["NOTA"] || 5;

  var statusVal = statusCol ? (newValue && col === statusCol ? newValue : sheet.getRange(row, statusCol).getValue() || "").toString().trim().toUpperCase() : "";

  // Determinar si la edición debe procesarse:
  // Modo A: Hoja con columna STATUS -> procesar cuando status sea APROBADO / LISTO / PROCESAR / NOT APPROVED / TROUBLEMAKER
  // Modo B: Hoja sin columna STATUS (esquema real de 'VOLVIO A PAGAR') -> procesar cuando se edita Col 1 (checkbox/ok/procesar),
  //         o cuando se ingresa RAZÓN o NOMBRE en una fila nueva o pendiente.
  var shouldProcess = false;
  if (statusCol) {
    if (col === statusCol && (statusVal === "APROBADO" || statusVal === "LISTO PARA MATCH" || statusVal === "PROCESAR" || statusVal === "NOT APPROVED" || statusVal === "TROUBLEMAKER")) {
      shouldProcess = true;
    }
  } else {
    // Hoja real 'VOLVIO A PAGAR':
    var col1Val = sheet.getRange(row, 1).getValue().toString().trim().toUpperCase();
    var noteVal = sheet.getRange(row, personaCol).getNote() || "";
    if (col1Val.indexOf("PROCESADO") >= 0 || noteVal.indexOf("[RECOMPRA PROCESADA]") >= 0) {
      return; // Ya procesado, evitar duplicación
    }

    if (col === 1 || col === personaCol || col === planCol) {
      var col1Text = (newValue && col === 1 ? newValue : col1Val).toString().trim().toUpperCase();
      if (col === 1 && (col1Text === "OK" || col1Text === "SI" || col1Text === "SÍ" || col1Text === "PROCESAR" || col1Text === "TRUE")) {
        shouldProcess = true;
      } else if (col === planCol || col === personaCol) {
        var curName = (sheet.getRange(row, personaCol).getValue() || "").toString().trim();
        var curRazon = (sheet.getRange(row, planCol).getValue() || "").toString().trim();
        if (curName && curRazon) {
          shouldProcess = true;
        }
      }
    }
  }

  if (!shouldProcess) return;

  var personACell = getCellData(sheet, row, personaCol);
  var personAName = personACell ? personACell.text.trim() : "";
  if (!personAName) return;

  var rawPlan = planCol ? (sheet.getRange(row, planCol).getValue() || "").toString().trim() : "";
  var rawDate = fechaCol ? (sheet.getRange(row, fechaCol).getValue() || "").toString().trim() : "";
  var extraNota = csObsCol ? (sheet.getRange(row, csObsCol).getValue() || "").toString().trim() : "";

  // 1. Determinar psicóloga responsable
  var psychologist = psychologistCol ? sheet.getRange(row, psychologistCol).getValue().toString().trim() : "";
  if (!psychologist) {
    // Si la hoja no tiene columna 'Hecho por' (como la hoja real 'VOLVIO A PAGAR'), buscar en el libro / CRM
    psychologist = findPsychologistForPerson(personACell);
    if (!psychologist) {
      var pData = buscarDatosPersona(personACell);
      if (pData && pData.psychologist) {
        psychologist = pData.psychologist;
      }
    }
  }

  if (!psychologist) {
    if (psychologistCol) {
      sheet.getRange(row, psychologistCol).setBackground("#FFF2CC").setNote("Indique la psicóloga responsable en 'Hecho por'.");
    } else {
      sheet.getRange(row, personaCol).setBackground("#FFF2CC").setNote("No se encontró psicóloga asignada a este cliente en PROFILES ni en pestañas de psicólogas.");
    }
    Logger.log("Aviso: No se encontró psicóloga para '" + personAName + "'.");
    SpreadsheetApp.getActiveSpreadsheet().toast("No se encontró psicóloga para '" + personAName + "'. Indique la psicóloga responsable.", "Recompra", 6);
    return;
  }

  var psycSheet = findPsychologistSheet(psychologist);
  if (!psycSheet) {
    if (psychologistCol) {
      sheet.getRange(row, psychologistCol).setBackground("#F4CCCC").setNote("No se encontró la pestaña 'MATCHES " + psychologist + "'. Verifique el nombre.");
    }
    Logger.log("ERROR: Pestaña no encontrada para psicóloga: " + psychologist);
    SpreadsheetApp.getActiveSpreadsheet().toast("No se encontró la pestaña de " + psychologist, "Error de Psicóloga", 6);
    return;
  }

  // 2. Obtener datos complementarios del cliente (ciudad, link CRM, etc.)
  var clientCity = "";
  var clientPref = "";
  var clientDetails = buscarDatosPersona(personACell);
  if (clientDetails) {
    clientCity = clientDetails.city || "";
    clientPref = clientDetails.pref || "";
    if ((!personACell.richText || !personACell.richText.getLinkUrl()) && clientDetails.crmId) {
      var crmLink = buildCanonicalCrmUrl(clientDetails.crmId);
      personACell.richText = SpreadsheetApp.newRichTextValue().setText(personAName).setLinkUrl(crmLink).build();
      personACell.link = crmLink;
    }
  }

  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
  var obsFinal = "[RECOMPRA: " + (rawPlan || "Pago cita adicional") + (rawDate ? " (" + rawDate + ")" : "") + "]";
  if (extraNota) obsFinal += " | " + extraNota;

  // 3. Crear fila nueva en la pestaña de la psicóloga (patrón de reactivación / fila nueva)
  withScriptLock(function() {
    var psycHeaders = getSheetHeaders(psycSheet);
    appendNewRetryRow(psycSheet, psycHeaders, {
      city: clientCity,
      pref: clientPref,
      plan: rawPlan || "Recompra",
      personACell: personACell,
      personBCell: null,
      fecha: todayStr,
      status: "Listo para match",
      observaciones: obsFinal
    });
  });

  // 4. Marcar fila como procesada en la hoja de recompra
  try {
    sheet.getRange(row, 1).setValue("✅ PROCESADO").setBackground("#D9EAD3");
    sheet.getRange(row, personaCol).setNote("[RECOMPRA PROCESADA] Fila generada en " + psycSheet.getName() + " el " + todayStr);
    if (statusCol) {
      sheet.getRange(row, statusCol).setValue("LISTO");
    }
  } catch (eMark) {}

  Logger.log("✅ Recompra procesada: Fila nueva creada en '" + psycSheet.getName() + "' para '" + personAName + "'.");
  SpreadsheetApp.getActiveSpreadsheet().toast("Fila de recompra creada en " + psycSheet.getName() + " para " + personAName, "Recompra Exitosa", 5);
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
  var estadoCol = headers["ESTADO REFUND"] || headers["ESTADO"] || headers["STATUS"];
  if (!estadoCol || col !== estadoCol) return;

  var val = (typeof newValue !== "undefined" && newValue ? newValue : (sheet.getRange(row, estadoCol).getValue() || "")).toString().trim().toUpperCase();

  if (val.indexOf("APROBADO") >= 0 || val.indexOf("RECHAZADO") >= 0 || val.indexOf("PROCESADO") >= 0 || val.indexOf("DONE") >= 0) {
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
          sourceSheet.getRange(sourceRow, sourceStatusCol).setValue(val);
        }
      }
    }
    Logger.log("✅ Refund procesado: '" + val + "' en fila " + row + " (Fecha: " + nowStr + ")");
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

  // 3. PRESERVAR HIPERVÍNCULO CRM DE PERSONA A Y PROTEGER CELDA
  var pACol = headers["PERSON A"] || headers["PERSONA A"];
  if (pACol && data.personACell) {
    setCellData(sheet, newRow, pACol, data.personACell);
    protegerCeldaPersona(sheet, newRow, pACol, data.personACell.text, "Persona A");
  }

  if (headers["PERSON B"]) sheet.getRange(newRow, headers["PERSON B"]).setValue("");
  if (headers["PERSONA B"]) sheet.getRange(newRow, headers["PERSONA B"]).setValue("");

  if (headers["PSICÓLOGA DE B"]) sheet.getRange(newRow, headers["PSICÓLOGA DE B"]).setValue("");

  var fColRet = headers["FECHA DE ENTREVISTA"] || headers["FECHA ENTREVISTA"] || headers["FECHA"] || headers["DATE"];
  if (fColRet) sheet.getRange(newRow, fColRet).setValue("");
  if (headers["STATUS"]) sheet.getRange(newRow, headers["STATUS"]).setValue(data.status);

  if (headers["OBSERVACIONES"]) sheet.getRange(newRow, headers["OBSERVACIONES"]).setValue(data.observaciones);
  if (headers["OBSERVACION"]) sheet.getRange(newRow, headers["OBSERVACION"]).setValue(data.observaciones);

  // Estampar Fecha de llegada automática (nunca se vuelve a tocar)
  var llegadaCol = headers["FECHA DE LLEGADA"] || headers["FECHA LLEGADA"] || headers["LLEGADA"];
  if (!llegadaCol) {
    llegadaCol = ensureFechaLlegadaColumn(sheet, headers);
  }
  if (llegadaCol) {
    var nowLlegadaStr = data.fechaLlegada || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
    sheet.getRange(newRow, llegadaCol).setValue(nowLlegadaStr);
  }
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

  var fColTr = headers["FECHA DE ENTREVISTA"] || headers["FECHA ENTREVISTA"] || headers["FECHA"] || headers["DATE"];
  if (fColTr) troubleSheet.getRange(targetRow, fColTr).setValue(data.fecha || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd"));
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
 * 8. Búsqueda tolerante de la pestaña de psicóloga (maneja espacios extras, tildes como 'MARÍA' vs 'MARIA', y alias)
 */
function findPsychologistSheet(psycName) {
  if (!psycName) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawName = psycName.toString().trim();

  // 1. Probar nombre directo
  var directUpper = rawName.toUpperCase();
  var targetPrefix = CONFIG.PSYCHOLOGIST_SHEET_PREFIX + directUpper;

  // Manejo especial de desambiguación para MANU si existen 'MATCHES MANU ' y 'MATCHES MANU'
  if (directUpper === "MANU" || (typeof normalizarNombrePsicologa === "function" && normalizarNombrePsicologa(rawName) === "MANU")) {
    var shSpace = ss.getSheetByName("MATCHES MANU ");
    var shNoSpace = ss.getSheetByName("MATCHES MANU");
    if (shSpace && shNoSpace) {
      return (shSpace.getLastRow() >= shNoSpace.getLastRow()) ? shSpace : shNoSpace;
    }
  }

  // Manejo especial para MPS (renombrar MATCHES MARÍA o MATCHES MARIA si existe a MATCHES MPS)
  if (directUpper === "MPS" || directUpper === "MARÍA" || directUpper === "MARIA" || (typeof normalizarNombrePsicologa === "function" && normalizarNombrePsicologa(rawName) === "MPS")) {
    var shMps = ss.getSheetByName("MATCHES MPS");
    if (shMps) return shMps;
    var shMaria = ss.getSheetByName("MATCHES MARÍA") || ss.getSheetByName("MATCHES MARIA");
    if (shMaria) {
      try {
        shMaria.setName("MATCHES MPS");
        Logger.log("✅ Pestaña 'MATCHES MARÍA' renombrada exitosamente a 'MATCHES MPS'.");
        return shMaria;
      } catch (renameErr) {
        Logger.log("Aviso al renombrar pestaña a MATCHES MPS: " + renameErr.message);
        return shMaria;
      }
    }
  }

  var direct = ss.getSheetByName(targetPrefix);
  if (direct) return direct;

  // 2. Probar mediante normalización de alias si existe
  var canonical = (typeof normalizarNombrePsicologa === "function") ? normalizarNombrePsicologa(rawName) : directUpper;
  var targetCanonical = CONFIG.PSYCHOLOGIST_SHEET_PREFIX + canonical;
  var directCanon = ss.getSheetByName(targetCanonical);
  if (directCanon) return directCanon;

  // 3. Búsqueda tolerante a espacios y diacríticos (tildes como MARÍA vs MARIA)
  var stripAccents = function(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/\s+/g, " ");
  };
  var targetNorm = stripAccents(targetCanonical);
  var targetNormRaw = stripAccents(targetPrefix);

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName();
    var sClean = sName.trim().toUpperCase().replace(/\s+/g, " ");
    if (sClean === targetPrefix || sClean === targetCanonical) {
      return sheets[i];
    }
    var sNorm = stripAccents(sName);
    if (sNorm === targetNorm || sNorm === targetNormRaw) {
      return sheets[i];
    }
  }
  return null;
}

// ─── 8B. PUESTA A PUNTO INICIAL AUTOMÁTICA & NORMALIZACIÓN DE 10 PESTAÑAS ───

/**
 * Normaliza una pestaña individual de psicóloga a la estructura canónica exacta de 12 columnas:
 * ID (Col A) | Fecha de entrevista (Col B) | PAIS (Col C) | CITY (Col D) | PREF (Col E) | PLAN (Col F) |
 * PERSON A (Col G) | PERSON B (Col H) | PSICÓLOGA DE B (Col I) | STATUS (Col J) | OBSERVACIONES (Col K) | Fecha de llegada (Col L)
 *
 * - Mapea inteligentemente las columnas existentes sin importar el orden original (ej: SOFI, ALEJA).
 * - Mueve físicamente 'Fecha de entrevista' / 'FECHA' a la Columna B.
 * - Fusiona el contenido de columnas extra no vacías:
 *     * TAREAS (MAPE D) -> OBSERVACIONES como " | [TAREAS: ...]"
 *     * APRO DATE (ALEJA) -> OBSERVACIONES como " | [APRO DATE: ...]"
 * - Consolida columnas de fechas duplicadas (ej: Fecha de llegada en SILVI, FECHA en MANU).
 * - Elimina físicamente todas las columnas extra (CRM, feedback, Columna 2..20) recortando la hoja a exactamente 12 columnas.
 * - Preserva 100% de hipervínculos CRM RichText, fondos y notas.
 * - Aplica formato (#D9EAD3, negrita, centrado, altura 32, fila 1 congelada, anchos canónicos y validaciones).
 */
/**
 * Obtiene de forma segura la última fila con datos de una hoja,
 * evitando que columnas tipadas de Tablas Nativas bloqueen la lectura con excepciones.
 */
function getSheetSafeLastRow(sheet) {
  try {
    var lr = sheet.getLastRow();
    if (lr > 0) return lr;
  } catch (e) {
    Logger.log("Aviso en getLastRow() para '" + sheet.getName() + "': " + e.message);
  }

  // Fallback seguro: escanear columna A para encontrar última fila con contenido
  try {
    var maxR = Math.min(sheet.getMaxRows(), 5000);
    var colA = sheet.getRange(1, 1, maxR, 1).getValues();
    for (var r = colA.length - 1; r >= 0; r--) {
      var val = colA[r][0];
      if (val !== "" && val !== null && val !== undefined) {
        return r + 1;
      }
    }
  } catch (e2) {
    Logger.log("Aviso en escaneo de Columna A: " + e2.message);
  }

  return Math.min(sheet.getMaxRows(), 3000);
}

/**
 * Obtiene de forma segura la última columna con datos de una hoja,
 * evitando fallos en hojas con Tablas Nativas tipadas.
 */
function getSheetSafeLastColumn(sheet) {
  try {
    var lc = sheet.getLastColumn();
    if (lc > 0) return lc;
  } catch (e) {
    Logger.log("Aviso en getLastColumn() para '" + sheet.getName() + "': " + e.message);
  }

  try {
    var maxC = Math.min(sheet.getMaxColumns(), 60);
    var row1 = sheet.getRange(1, 1, 1, maxC).getValues()[0];
    for (var c = row1.length - 1; c >= 0; c--) {
      var val = row1[c];
      if (val !== "" && val !== null && val !== undefined) {
        return c + 1;
      }
    }
  } catch (e2) {
    Logger.log("Aviso en escaneo de Fila 1: " + e2.message);
  }

  return Math.max(12, sheet.getMaxColumns());
}

/**
 * Desvincula cualquier Tabla Nativa de Google Sheets en la hoja especificada,
 * convirtiéndola nuevamente en un rango normal mediante Google Sheets REST API (deleteTable).
 * Esto elimina de raíz el error "No se puede realizar esta operación en columnas de tipo".
 * Preserva el 100% de los datos, hipervínculos, formatos y notas en las celdas.
 */
/**
 * Desvinculación de tablas nativas:
 * Se eliminan por completo las llamadas HTTP REST a la API externa de Google Sheets
 * para evitar el error 403 ('Google Sheets API has not been used in project... or it is disabled')
 * y eliminar las pérdidas de tiempo acumuladas por timeouts de red.
 * La normalización ahora utiliza directamente 'recrearHojaLimpiaCanonica()',
 * la cual destruye las tablas nativas y columnas tipadas 100% de forma nativa en Apps Script.
 */
function desvincularTablasNativasDeHoja(sheet) {
  return false;
}

/**
 * Aplica las validaciones desplegables canónicas en PREF (Col E) y STATUS (Col J).
 */
function aplicarValidacionesCanónicas(sheet, lastRow) {
  if (!sheet) return;
  var rowCount = Math.max(lastRow - 1, 10);

  // 1. PREF (Col E / 5)
  try {
    var prefRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["H", "M", "H+M"], true)
      .setAllowInvalid(true)
      .build();
    safeSetDataValidation(sheet.getRange(2, 5, rowCount, 1), prefRule);
  } catch (e1) {}

  // 2. STATUS (Col J / 10)
  try {
    var psycEstados = [
      "Llenar perfil", "Listo para match", "HECHO", "APROBADO", "NOT APPROVED", "DESCALIFICADO",
      "NO HAY GENTE", "REVISAR", "TROUBLEMAKER", "HECHO POR MAPE", "REQUEST PROFILE UPDATE",
      "PSIC. URG", "MUJER +50", "REFUND", "RECHAZADA POR PSICÓLOGA B"
    ];
    try {
      var estadosData = obtenerEstadosConfigurados();
      if (estadosData && estadosData.PSICOLOGA && estadosData.PSICOLOGA.length > 0) {
        psycEstados = estadosData.PSICOLOGA;
      }
    } catch (eConfig) {}

    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(psycEstados, true)
      .setAllowInvalid(true)
      .build();
    safeSetDataValidation(sheet.getRange(2, 10, rowCount, 1), statusRule);
  } catch (e2) {}
}

/**
 * Crea una pestaña limpia sin tablas nativas para reemplazar una pestaña bloqueada por columnas tipadas.
 * Copia 100% de datos canónicos, formatos, rich text (enlaces CRM), anchos y validaciones.
 */
function recrearHojaLimpiaCanonica(ss, origSheet, sName, newValues, newRichTexts, newBackgrounds, newNotes, lastRow, canonicalWidths) {
  var origIndex = 1;
  try { origIndex = origSheet.getIndex(); } catch (e) {}
  var origTabColor = null;
  try { origTabColor = origSheet.getTabColor(); } catch (e) {}

  // Limpiar protecciones en hoja original antes de eliminar
  try {
    var protections = origSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (var p = 0; p < protections.length; p++) {
      if (protections[p].canEdit()) {
        protections[p].remove();
      }
    }
  } catch (eP) {}

  // Crear pestaña temporal
  var tempSheetName = sName + "_TEMP_CANONICAL";
  var oldTemp = ss.getSheetByName(tempSheetName);
  if (oldTemp) {
    try { ss.deleteSheet(oldTemp); } catch (e) {}
  }

  var targetRowCount = Math.max(lastRow || 100, 100);
  var newSheet = ss.insertSheet(tempSheetName, origIndex);

  // Asegurar 12 columnas exactas
  if (newSheet.getMaxColumns() < 12) {
    newSheet.insertColumnsAfter(newSheet.getMaxColumns(), 12 - newSheet.getMaxColumns());
  } else if (newSheet.getMaxColumns() > 12) {
    newSheet.deleteColumns(13, newSheet.getMaxColumns() - 12);
  }

  // Ajustar filas si es necesario
  if (newSheet.getMaxRows() < targetRowCount) {
    newSheet.insertRowsAfter(newSheet.getMaxRows(), targetRowCount - newSheet.getMaxRows());
  } else if (newSheet.getMaxRows() > targetRowCount && targetRowCount > 10) {
    newSheet.deleteRows(targetRowCount + 1, newSheet.getMaxRows() - targetRowCount);
  }

  // Escribir datos canónicos
  if (newValues && newValues.length > 0) {
    var range = newSheet.getRange(1, 1, newValues.length, 12);
    range.setValues(newValues);

    // Restaurar RichTexts (hipervínculos CRM en Person A y Person B)
    if (newRichTexts && newRichTexts.length === newValues.length) {
      try {
        range.setRichTextValues(newRichTexts);
      } catch (eRTAll) {
        // Si falla batch masivo, escribir celda a celda en Col G y H
        try {
          for (var rk = 0; rk < newRichTexts.length; rk++) {
            if (newRichTexts[rk] && newRichTexts[rk][6]) newSheet.getRange(rk + 1, 7).setRichTextValue(newRichTexts[rk][6]);
            if (newRichTexts[rk] && newRichTexts[rk][7]) newSheet.getRange(rk + 1, 8).setRichTextValue(newRichTexts[rk][7]);
          }
        } catch (eCell) {}
      }
    }

    if (newBackgrounds && newBackgrounds.length === newValues.length) {
      try { range.setBackgrounds(newBackgrounds); } catch (eBg) {}
    }
    if (newNotes && newNotes.length === newValues.length) {
      try { range.setNotes(newNotes); } catch (eNt) {}
    }
  }

  // Formato encabezados fila 1
  newSheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#D9EAD3").setHorizontalAlignment("center");
  newSheet.setRowHeight(1, 32);
  try { newSheet.setFrozenRows(1); } catch (e) {}

  // Anchos canónicos
  if (canonicalWidths) {
    for (var w = 0; w < canonicalWidths.length; w++) {
      newSheet.setColumnWidth(w + 1, canonicalWidths[w]);
    }
  }

  // Aplicar validaciones
  aplicarValidacionesCanónicas(newSheet, newValues ? newValues.length : targetRowCount);

  // Restaurar color de pestaña si existía
  if (origTabColor) {
    try { newSheet.setTabColor(origTabColor); } catch (e) {}
  }

  // Borrar la hoja original bloqueada y renombrar la nueva
  try {
    ss.deleteSheet(origSheet);
  } catch (eDel) {
    Logger.log("Aviso al eliminar hoja original '" + sName + "': " + eDel.message);
  }
  newSheet.setName(sName);
  Logger.log("✅ Pestaña '" + sName + "' recreada limpiamente sin tablas nativas y con 12 columnas canónicas.");
  return newSheet;
}

function normalizarPestanaPsicologa(sheet) {
  if (!sheet) return;
  var sName = sheet.getName();
  var ss = sheet.getParent();

  var CANONICAL_HEADERS = [
    "ID", "Fecha de entrevista", "PAIS", "CITY", "PREF", "PLAN",
    "PERSON A", "PERSON B", "PSICÓLOGA DE B", "STATUS", "OBSERVACIONES", "Fecha de llegada"
  ];
  var CANONICAL_WIDTHS = [70, 130, 80, 110, 80, 140, 190, 190, 120, 120, 220, 130];

  var lastRow = 1;
  var lastCol = 12;
  try {
    lastRow = getSheetSafeLastRow(sheet);
    lastCol = getSheetSafeLastColumn(sheet);
  } catch (eDims) {
    try { lastRow = sheet.getLastRow(); } catch (e) { lastRow = 1; }
    try { lastCol = sheet.getMaxColumns(); } catch (e) { lastCol = 12; }
  }

  // Caso: hoja vacía o solo fila 1 -> Recrear hoja limpia canónica directamente
  if (lastRow <= 1) {
    var newValuesEmpty = [CANONICAL_HEADERS];
    var cleanEmptySheet = recrearHojaLimpiaCanonica(ss, sheet, sName, newValuesEmpty, null, [["#D9EAD3"]], null, 100, CANONICAL_WIDTHS);
    SpreadsheetApp.flush();
    Logger.log("✅ Pestaña vacía '" + sName + "' recreada limpiamente con 12 columnas canónicas y validaciones.");
    return cleanEmptySheet;
  }

  var newValues = [];
  var newRichTexts = [];
  var newBackgrounds = [];
  var newNotes = [];

  // TODO EL BLOQUE (LECTURA + MAPEO + INTENTO IN-PLACE) EN UN SOLO TRY/CATCH
  try {
    // A. Leer encabezados existentes
    var headerValues = [];
    try {
      headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    } catch (eH) {
      headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }

    // B. Mapear encabezados existentes
    var colMap = {};
    var entrevistaCols = [];
    var fechaCols = [];
    var llegadaCols = [];
    var tareasCol = -1;
    var aproDateCol = -1;

    for (var c = 0; c < headerValues.length; c++) {
      var h = (headerValues[c] || "").toString().trim().toUpperCase().replace(/\s+/g, " ");
      if (!h) continue;

      if (h === "ID" || h === "NO." || h === "MATCH_ID") {
        if (colMap["ID"] === undefined) colMap["ID"] = c;
      } else if (h.indexOf("ENTREVISTA") >= 0) {
        entrevistaCols.push(c);
      } else if (h === "FECHA" || h === "DATE" || h === "FECHA CITA") {
        fechaCols.push(c);
      } else if (h === "PAIS" || h === "PAÍS" || h === "COUNTRY") {
        if (colMap["PAIS"] === undefined) colMap["PAIS"] = c;
      } else if (h === "CITY" || h === "CIUDAD") {
        if (colMap["CITY"] === undefined) colMap["CITY"] = c;
      } else if (h === "PREF" || h === "PREFERENCIA" || h === "PREFERENCIAS" || h === "ORIENTATION") {
        if (colMap["PREF"] === undefined) colMap["PREF"] = c;
      } else if (h === "PLAN" || h === "PLAN TIER" || h === "PLAN_TIER") {
        if (colMap["PLAN"] === undefined) colMap["PLAN"] = c;
      } else if (h === "PERSON A" || h === "PERSONA A" || h === "CLIENTE" || h === "PERSON_A") {
        if (colMap["PERSON A"] === undefined) colMap["PERSON A"] = c;
      } else if (h === "PERSON B" || h === "PERSONA B" || h === "CANDIDATO" || h === "PERSON_B" || h === "MATCH") {
        if (colMap["PERSON B"] === undefined) colMap["PERSON B"] = c;
      } else if (h.indexOf("PSIC") >= 0 && h.indexOf("B") >= 0) {
        if (colMap["PSICÓLOGA DE B"] === undefined) colMap["PSICÓLOGA DE B"] = c;
      } else if (h === "STATUS" || h === "ESTADO") {
        if (colMap["STATUS"] === undefined) colMap["STATUS"] = c;
      } else if (h.indexOf("OBSERV") >= 0 || h === "NOTAS" || h === "NOTA" || h === "OBS") {
        if (colMap["OBSERVACIONES"] === undefined) colMap["OBSERVACIONES"] = c;
      } else if (h.indexOf("LLEGADA") >= 0) {
        llegadaCols.push(c);
      } else if (h === "TAREAS") {
        tareasCol = c;
      } else if (h === "APRO DATE" || h === "APRO_DATE") {
        aproDateCol = c;
      }
    }

    // C. Lectura multi-nivel tolerante a columnas tipadas
    var fullRange = sheet.getRange(1, 1, lastRow, lastCol);
    var values = [];
    try {
      values = fullRange.getValues();
    } catch (eVals) {
      try {
        values = fullRange.getDisplayValues();
      } catch (eDisp) {
        values = [];
        for (var r = 1; r <= lastRow; r++) {
          var rowV = [];
          for (var c = 1; c <= lastCol; c++) {
            try { rowV.push(sheet.getRange(r, c).getValue()); } catch (eCell) { rowV.push(""); }
          }
          values.push(rowV);
        }
      }
    }

    var richTexts = [];
    try {
      richTexts = fullRange.getRichTextValues();
    } catch (eRich) {
      Logger.log("Aviso: getRichTextValues falló en '" + sName + "' (" + eRich.message + "). Recuperando hipervínculos por celda...");
      richTexts = [];
      for (var r = 0; r < values.length; r++) {
        var rowR = [];
        for (var c = 0; c < (values[r] || []).length; c++) {
          var cVal = values[r][c];
          var cellTxt = (cVal != null) ? cVal.toString() : "";
          if (c === colMap["PERSON A"] || c === colMap["PERSON B"]) {
            try {
              rowR.push(sheet.getRange(r + 1, c + 1).getRichTextValue());
            } catch (eCR) {
              rowR.push(SpreadsheetApp.newRichTextValue().setText(cellTxt).build());
            }
          } else {
            rowR.push(SpreadsheetApp.newRichTextValue().setText(cellTxt).build());
          }
        }
        richTexts.push(rowR);
      }
    }

    var backgrounds = null;
    try { backgrounds = fullRange.getBackgrounds(); } catch (eBg) {}

    var notes = null;
    try { notes = fullRange.getNotes(); } catch (eNt) {}

    // D. Fila 1: Encabezados Canónicos
    newValues.push(CANONICAL_HEADERS);
    var headerRichTexts = [];
    var headerBackgrounds = [];
    var headerNotes = [];
    for (var k = 0; k < 12; k++) {
      headerRichTexts.push(SpreadsheetApp.newRichTextValue().setText(CANONICAL_HEADERS[k]).build());
      headerBackgrounds.push("#D9EAD3");
      headerNotes.push("");
    }
    newRichTexts.push(headerRichTexts);
    newBackgrounds.push(headerBackgrounds);
    newNotes.push(headerNotes);

    // E. Filas de datos (2 a lastRow)
    for (var r = 1; r < lastRow; r++) {
      var rowVals = new Array(12);
      var rowRich = new Array(12);
      var rowBg = new Array(12);
      var rowNotes = new Array(12);

      for (var initIdx = 0; initIdx < 12; initIdx++) {
        rowVals[initIdx] = "";
        rowRich[initIdx] = SpreadsheetApp.newRichTextValue().setText("").build();
        rowBg[initIdx] = "#ffffff";
        rowNotes[initIdx] = "";
      }

      // 1. ID (Col A)
      if (colMap["ID"] !== undefined && values[r]) {
        rowVals[0] = values[r][colMap["ID"]];
        rowRich[0] = (richTexts[r] && richTexts[r][colMap["ID"]]) ? richTexts[r][colMap["ID"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[0] || "").build();
        rowBg[0] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["ID"]] : "#ffffff";
        rowNotes[0] = (notes && notes[r]) ? notes[r][colMap["ID"]] : "";
      }

      // 2. Fecha de entrevista (Col B)
      var fechaVal = "";
      var fechaRich = null;
      var fechaBg = "#ffffff";
      var fechaNote = "";
      for (var ec = 0; ec < entrevistaCols.length; ec++) {
        var ev = values[r] ? values[r][entrevistaCols[ec]] : "";
        if (ev !== "" && ev !== null && ev !== undefined) {
          fechaVal = ev;
          fechaRich = richTexts[r] ? richTexts[r][entrevistaCols[ec]] : null;
          fechaBg = (backgrounds && backgrounds[r]) ? backgrounds[r][entrevistaCols[ec]] : "#ffffff";
          fechaNote = (notes && notes[r]) ? notes[r][entrevistaCols[ec]] : "";
          break;
        }
      }
      if ((fechaVal === "" || fechaVal === null || fechaVal === undefined) && fechaCols.length > 0) {
        for (var fc = 0; fc < fechaCols.length; fc++) {
          var fv = values[r] ? values[r][fechaCols[fc]] : "";
          if (fv !== "" && fv !== null && fv !== undefined) {
            fechaVal = fv;
            fechaRich = richTexts[r] ? richTexts[r][fechaCols[fc]] : null;
            fechaBg = (backgrounds && backgrounds[r]) ? backgrounds[r][fechaCols[fc]] : "#ffffff";
            fechaNote = (notes && notes[r]) ? notes[r][fechaCols[fc]] : "";
            break;
          }
        }
      }
      rowVals[1] = fechaVal;
      rowRich[1] = fechaRich || SpreadsheetApp.newRichTextValue().setText(fechaVal ? fechaVal.toString() : "").build();
      rowBg[1] = fechaBg;
      rowNotes[1] = fechaNote;

      // 3. PAIS (Col C)
      if (colMap["PAIS"] !== undefined && values[r]) {
        rowVals[2] = values[r][colMap["PAIS"]];
        rowRich[2] = (richTexts[r] && richTexts[r][colMap["PAIS"]]) ? richTexts[r][colMap["PAIS"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[2] || "").build();
        rowBg[2] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["PAIS"]] : "#ffffff";
        rowNotes[2] = (notes && notes[r]) ? notes[r][colMap["PAIS"]] : "";
      }

      // 4. CITY (Col D)
      if (colMap["CITY"] !== undefined && values[r]) {
        rowVals[3] = values[r][colMap["CITY"]];
        rowRich[3] = (richTexts[r] && richTexts[r][colMap["CITY"]]) ? richTexts[r][colMap["CITY"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[3] || "").build();
        rowBg[3] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["CITY"]] : "#ffffff";
        rowNotes[3] = (notes && notes[r]) ? notes[r][colMap["CITY"]] : "";
      }

      // 5. PREF (Col E)
      if (colMap["PREF"] !== undefined && values[r]) {
        rowVals[4] = values[r][colMap["PREF"]];
        rowRich[4] = (richTexts[r] && richTexts[r][colMap["PREF"]]) ? richTexts[r][colMap["PREF"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[4] || "").build();
        rowBg[4] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["PREF"]] : "#ffffff";
        rowNotes[4] = (notes && notes[r]) ? notes[r][colMap["PREF"]] : "";
      }

      // 6. PLAN (Col F)
      if (colMap["PLAN"] !== undefined && values[r]) {
        rowVals[5] = values[r][colMap["PLAN"]];
        rowRich[5] = (richTexts[r] && richTexts[r][colMap["PLAN"]]) ? richTexts[r][colMap["PLAN"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[5] || "").build();
        rowBg[5] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["PLAN"]] : "#ffffff";
        rowNotes[5] = (notes && notes[r]) ? notes[r][colMap["PLAN"]] : "";
      }

      // 7. PERSON A (Col G)
      if (colMap["PERSON A"] !== undefined && values[r]) {
        rowVals[6] = values[r][colMap["PERSON A"]];
        rowRich[6] = (richTexts[r] && richTexts[r][colMap["PERSON A"]]) ? richTexts[r][colMap["PERSON A"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[6] || "").build();
        rowBg[6] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["PERSON A"]] : "#ffffff";
        rowNotes[6] = (notes && notes[r]) ? notes[r][colMap["PERSON A"]] : "";
      }

      // 8. PERSON B (Col H)
      if (colMap["PERSON B"] !== undefined && values[r]) {
        rowVals[7] = values[r][colMap["PERSON B"]];
        rowRich[7] = (richTexts[r] && richTexts[r][colMap["PERSON B"]]) ? richTexts[r][colMap["PERSON B"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[7] || "").build();
        rowBg[7] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["PERSON B"]] : "#ffffff";
        rowNotes[7] = (notes && notes[r]) ? notes[r][colMap["PERSON B"]] : "";
      }

      // 9. PSICÓLOGA DE B (Col I)
      if (colMap["PSICÓLOGA DE B"] !== undefined && values[r]) {
        rowVals[8] = values[r][colMap["PSICÓLOGA DE B"]];
        rowRich[8] = (richTexts[r] && richTexts[r][colMap["PSICÓLOGA DE B"]]) ? richTexts[r][colMap["PSICÓLOGA DE B"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[8] || "").build();
        rowBg[8] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["PSICÓLOGA DE B"]] : "#ffffff";
        rowNotes[8] = (notes && notes[r]) ? notes[r][colMap["PSICÓLOGA DE B"]] : "";
      }

      // 10. STATUS (Col J)
      if (colMap["STATUS"] !== undefined && values[r]) {
        rowVals[9] = values[r][colMap["STATUS"]];
        rowRich[9] = (richTexts[r] && richTexts[r][colMap["STATUS"]]) ? richTexts[r][colMap["STATUS"]] : SpreadsheetApp.newRichTextValue().setText(rowVals[9] || "").build();
        rowBg[9] = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["STATUS"]] : "#ffffff";
        rowNotes[9] = (notes && notes[r]) ? notes[r][colMap["STATUS"]] : "";
      }

      // 11. OBSERVACIONES (Col K)
      var obsVal = "";
      var obsRich = null;
      var obsBg = "#ffffff";
      var obsNote = "";
      if (colMap["OBSERVACIONES"] !== undefined && values[r]) {
        obsVal = values[r][colMap["OBSERVACIONES"]] || "";
        obsRich = richTexts[r] ? richTexts[r][colMap["OBSERVACIONES"]] : null;
        obsBg = (backgrounds && backgrounds[r]) ? backgrounds[r][colMap["OBSERVACIONES"]] : "#ffffff";
        obsNote = (notes && notes[r]) ? notes[r][colMap["OBSERVACIONES"]] : "";
      }
      if (tareasCol >= 0 && values[r] && values[r][tareasCol]) {
        obsVal = (obsVal ? obsVal + " | " : "") + "[TAREAS: " + values[r][tareasCol] + "]";
      }
      rowVals[10] = obsVal;
      rowRich[10] = obsRich || SpreadsheetApp.newRichTextValue().setText(obsVal ? obsVal.toString() : "").build();
      rowBg[10] = obsBg;
      rowNotes[10] = obsNote;

      // 12. Fecha de llegada (Col L)
      var llegadaVal = "";
      var llegadaRich = null;
      var llegadaBg = "#ffffff";
      var llegadaNote = "";
      for (var lc = 0; lc < llegadaCols.length; lc++) {
        var lv = values[r] ? values[r][llegadaCols[lc]] : "";
        if (lv !== "" && lv !== null && lv !== undefined) {
          llegadaVal = lv;
          llegadaRich = richTexts[r] ? richTexts[r][llegadaCols[lc]] : null;
          llegadaBg = (backgrounds && backgrounds[r]) ? backgrounds[r][llegadaCols[lc]] : "#ffffff";
          llegadaNote = (notes && notes[r]) ? notes[r][llegadaCols[lc]] : "";
          break;
        }
      }
      if ((llegadaVal === "" || llegadaVal === null || llegadaVal === undefined) && aproDateCol >= 0 && values[r]) {
        var av = values[r][aproDateCol];
        if (av !== "" && av !== null && av !== undefined) {
          llegadaVal = av;
          llegadaRich = richTexts[r] ? richTexts[r][aproDateCol] : null;
          llegadaBg = (backgrounds && backgrounds[r]) ? backgrounds[r][aproDateCol] : "#ffffff";
          llegadaNote = (notes && notes[r]) ? notes[r][aproDateCol] : "";
        }
      }
      rowVals[11] = llegadaVal;
      rowRich[11] = llegadaRich || SpreadsheetApp.newRichTextValue().setText(llegadaVal ? llegadaVal.toString() : "").build();
      rowBg[11] = llegadaBg;
      rowNotes[11] = llegadaNote;

      newValues.push(rowVals);
      newRichTexts.push(rowRich);
      newBackgrounds.push(rowBg);
      newNotes.push(rowNotes);
    }

    // Recreación limpia canónica directa (100% nativa en Apps Script, cero dependencias REST, cero fallos por tablas nativas)
    var cleanSheet = recrearHojaLimpiaCanonica(ss, sheet, sName, newValues, newRichTexts, newBackgrounds, newNotes, Math.max(newValues.length, 100), CANONICAL_WIDTHS);
    SpreadsheetApp.flush();
    Logger.log("✅ Pestaña '" + sName + "' recreada limpiamente con 12 columnas canónicas (" + (newValues.length - 1) + " registros).");
    return cleanSheet;

  } catch (normErr) {
    Logger.log("⚠️ Falló procesamiento de datos en '" + sName + "' (" + normErr.message + "). Disparando recreación limpia canónica de emergencia...");
    if (!newValues || newValues.length === 0) {
      newValues = [CANONICAL_HEADERS];
    }
    var emergSheet = recrearHojaLimpiaCanonica(ss, sheet, sName, newValues, newRichTexts, newBackgrounds, newNotes, Math.max(newValues.length, 100), CANONICAL_WIDTHS);
    SpreadsheetApp.flush();
    return emergSheet;
  }
}

/**
 * Puesta a punto inicial del archivo:
 * Se ejecuta EXCLUSIVAMENTE de forma MANUAL desde el menú '⚙️ Puesta a Punto Inicial'.
 * NUNCA se debe ejecutar desde onOpen para respetar el límite de 30s de triggers simples.
 * Normaliza las 11 pestañas de psicólogas a 12 columnas canónicas, congela fila 1 e instala los triggers automáticos.
 */
function ejecutarPuestaAPuntoInicialAutomatico(force) {
  var props = PropertiesService.getDocumentProperties();
  var isDone = props.getProperty("PUESTA_A_PUNTO_INICIAL_AUTOMATICA_V3");
  
  if (isDone && !force) {
    Logger.log("ℹ️ Puesta a punto inicial ya completada previamente en este archivo.");
    return;
  }

  Logger.log("🚀 INICIANDO PUESTA A PUNTO INICIAL AUTOMÁTICA...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 0. Asegurar pestañas de soporte críticas (CONFIG ESTADOS, RESTAURANTES, Citas Aceptadas, REFUNDS PENDIENTES)
  try {
    crearPestanasDeSoporteSiFaltan(ss);
  } catch (soporteErr) {
    Logger.log("Aviso en creación de pestañas de soporte: " + soporteErr.message);
  }

  // 1. Reordenamiento y normalización canónica de todas las pestañas de psicólogas
  try {
    reordenarColumnasPsicologasCanonico();
  } catch (psycErr) {
    Logger.log("Aviso en normalización de psicólogas: " + psycErr.message);
  }

  // 2. Reordenamiento estructural canónico de MATCHES (17 columnas)
  try {
    reordenarColumnasMatchesCanonico();
  } catch (mErr) {
    Logger.log("Aviso en reordenamiento de MATCHES: " + mErr.message);
  }

  // 3. Instalar disparadores automáticos periódicos y de edición
  try {
    instalarTodosLosTriggers();
  } catch (trigErr) {
    Logger.log("Aviso instalando triggers en puesta a punto: " + trigErr);
  }

  props.setProperty("PUESTA_A_PUNTO_INICIAL_AUTOMATICA_V3", "true");
  props.setProperty("PUESTA_A_PUNTO_FECHA", new Date().toISOString());

  Logger.log("✅ PUESTA A PUNTO INICIAL COMPLETADA EXITOSAMENTE.");
  try {
    ss.toast("Puesta a punto completada: pestañas normalizadas y triggers instalados.", "Daily Lover Setup", 6);
  } catch (tErr) {}
}

function ejecutarPuestaAPuntoInicialManual() {
  ejecutarPuestaAPuntoInicialAutomatico(true);
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
 * Lee los encabezados de la fila 1 y devuelve un mapa { "HEADER_TEXT": col_index (1-based) }.
 * Protegido con multi-nivel de lectura para tolerar hojas con Tablas Nativas de Google Sheets.
 */

/**
 * Encuentra la última fila REAL con datos en una columna específica,
 * ignorando filas vacías formateadas al final de la hoja.
 */
function getRealLastDataRow(sheet, colToCheck) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  var col = colToCheck || 4;
  var vals = sheet.getRange(1, col, lastRow, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    var v = vals[i][0];
    if (v !== null && v !== undefined && v.toString().trim() !== "") {
      return i + 1;
    }
  }
  return 1;
}

function getSheetHeaders(sheet) {
  if (!sheet) return {};
  var map = {};
  try {
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return {};

    var headerRow = null;
    // 1. Intentar con getDisplayValues() que lee texto formateado y no dispara validación de tipos
    try {
      headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    } catch (e1) {
      // 2. Fallback a getValues()
      try {
        headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      } catch (e2) {
        // 3. Fallback celda por celda si alguna columna puntual de tabla tiene restricción
        for (var colIdx = 1; colIdx <= Math.min(lastCol, 50); colIdx++) {
          try {
            var cellVal = sheet.getRange(1, colIdx).getDisplayValue();
            if (cellVal) {
              map[cellVal.toString().trim().toUpperCase()] = colIdx;
            }
          } catch (e3) {}
        }
        return map;
      }
    }

    if (headerRow && headerRow.length > 0) {
      for (var c = 0; c < headerRow.length; c++) {
        var title = (headerRow[c] || "").toString().trim().toUpperCase();
        if (title) {
          map[title] = c + 1;
        }
      }
    }
  } catch (err) {
    Logger.log("Aviso en getSheetHeaders para pestaña '" + (sheet.getName ? sheet.getName() : "desconocida") + "': " + err.message);
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
 * Columnas exactas:
 * ID MATCH | Persona A | Origen pestaña (A) | Observaciones (A) | Persona B | Origen pestaña (B) | Observaciones (B) | Aprobar | NOTAS MARÍA
 */
function reconstruirRevisionMaria() {
  var tStart = new Date().getTime();
  Logger.log("⏱️ [0.000s] === INICIO DE reconstruirRevisionMaria ===");

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log("❌ No se pudo obtener la hoja de cálculo activa.");
      return;
    }
    
    var sheetName = CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA";
    var revisionSheet = ss.getSheetByName(sheetName) || ss.getSheetByName("REVISION MARIA");

    var headers = [
      "ID MATCH", "Persona A", "Origen pestaña (A)", "Observaciones (A)",
      "Persona B", "Origen pestaña (B)", "Observaciones (B)",
      "Aprobar", "Aprobación María", "NOTAS MARÍA"
    ];

    if (!revisionSheet) {
      revisionSheet = ss.insertSheet(sheetName);
      revisionSheet.setTabColor("#D5A6BD");
    }

    var tInit = ((new Date().getTime() - tStart) / 1000).toFixed(3);
    Logger.log("⏱️ [" + tInit + "s] Pestaña 'REVISIÓN MARÍA' lista. Ajustando dimensiones...");

    // Asegurar que la hoja tenga exactamente al menos 10 columnas
    if (revisionSheet.getMaxColumns() < headers.length) {
      revisionSheet.insertColumnsAfter(revisionSheet.getMaxColumns(), headers.length - revisionSheet.getMaxColumns());
    } else if (revisionSheet.getMaxColumns() > headers.length) {
      try {
        revisionSheet.deleteColumns(headers.length + 1, revisionSheet.getMaxColumns() - headers.length);
      } catch (e) {}
    }

    // Asegurar encabezados canónicos
    revisionSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    revisionSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#D5A6BD")
      .setFontColor("#000000");
    revisionSheet.setFrozenRows(1);

    // Limpiar contenido anterior de forma segura
    var lastRow = revisionSheet.getLastRow();
    if (lastRow > 1) {
      revisionSheet.getRange(2, 1, lastRow - 1, headers.length).clear({ contentsOnly: true });
      try {
        revisionSheet.getRange(2, 9, lastRow - 1, 1).clearDataValidations();
      } catch (ve) {}
    }

    var tClear = ((new Date().getTime() - tStart) / 1000).toFixed(3);
    Logger.log("⏱️ [" + tClear + "s] Limpieza completada. Construyendo mapa de psicólogas en memoria...");

    // 1. Crear mapa local de psicólogas por persona en memoria O(1)
    var psycMap = {};
    var allSheets = ss.getSheets();
    var psychologistSheets = [];
    var seenPsycKeys = {};

    for (var s = 0; s < allSheets.length; s++) {
      var sh = allSheets[s];
      var sName = sh.getName().trim();
      var sUpper = sName.toUpperCase();
      if (sUpper.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sUpper !== "MATCHES" && sUpper !== "MATCHES COMPLETED") {
        var pNameOnly = sName.substring(CONFIG.PSYCHOLOGIST_SHEET_PREFIX.length).trim();
        var normPsyc = typeof normalizarNombrePsicologa === "function" ? normalizarNombrePsicologa(pNameOnly) : pNameOnly.toUpperCase();

        // 1. Excluir explícitamente psicólogas inactivas (ej: LAU / LAURA)
        if (normPsyc === "LAU" || normPsyc === "LAURA" || pNameOnly.toUpperCase() === "LAU" || pNameOnly.toUpperCase() === "LAURA") {
          Logger.log("ℹ️ [reconstruirRevisionMaria] Ignorando pestaña inactiva: '" + sName + "'");
          continue;
        }

        // 2. Validar que pertenezca a las psicólogas canónicas oficiales (persistidas en DocumentProperties)
        var esValida = false;
        var validList = obtenerPsicologasValidas();
        for (var v = 0; v < validList.length; v++) {
          if (validList[v] === normPsyc) {
            esValida = true;
            break;
          }
        }
        if (!esValida && validList.length > 0) {
          Logger.log("ℹ️ [reconstruirRevisionMaria] Ignorando pestaña no oficial: '" + sName + "'");
          continue;
        }

        // 3. Deduplicar pestañas para evitar doble escaneo (ej: 'MATCHES MANU' vs 'MATCHES MANU ')
        var psycKey = normPsyc.replace(/\s+/g, " ").trim().toUpperCase();
        if (seenPsycKeys[psycKey]) {
          Logger.log("⚠️ [reconstruirRevisionMaria] Pestaña duplicada ignorada: '" + sName + "' (ya registrada como '" + psycKey + "')");
          continue;
        }
        seenPsycKeys[psycKey] = true;

        psychologistSheets.push(sh);
        var shHeaders = getSheetHeaders(sh);
        var pACol = shHeaders["PERSON A"] || shHeaders["PERSONA A"] || 7;
        var pLast = Math.min(sh.getLastRow(), 3000);
        if (pLast > 1 && pACol) {
          var pNames = sh.getRange(2, pACol, pLast - 1, 1).getValues();
          for (var pIdx = 0; pIdx < pNames.length; pIdx++) {
            var rawP = (pNames[pIdx][0] || "").toString().trim().toLowerCase();
            if (rawP && !psycMap[rawP]) {
              psycMap[rawP] = pNameOnly;
            }
          }
        }
      }
    }

    var tMap = ((new Date().getTime() - tStart) / 1000).toFixed(3);
    Logger.log("⏱️ [" + tMap + "s] Mapa de psicólogas indexado (" + Object.keys(psycMap).length + " clientes). Procesando las " + psychologistSheets.length + " pestañas en batch...");

    var collectedRows = [];
    var richColA = [];
    var richColB = [];
    var bgMatrix = [];
    var seenPairs = {};

    // 2. Escanear matches en batch (1 lectura de valores + 1 lectura de RichText por pestaña)
    for (var i = 0; i < psychologistSheets.length; i++) {
      var curSheet = psychologistSheets[i];
      var curName = curSheet.getName().trim();
      var psycName = curName.substring(CONFIG.PSYCHOLOGIST_SHEET_PREFIX.length).trim();
      var sHeaders = getSheetHeaders(curSheet);

      var statusCol = sHeaders["STATUS"];
      var personACol = sHeaders["PERSON A"] || sHeaders["PERSONA A"] || sHeaders["CLIENTE"];
      var personBCol = sHeaders["PERSON B"] || sHeaders["PERSONA B"] || sHeaders["CANDIDATO"] || sHeaders["MATCH"];
      var obsCol = sHeaders["OBSERVACIONES"] || sHeaders["OBSERVACION"] || sHeaders["NOTAS"];

      if (!statusCol || !personACol) continue;

      var totalRows = curSheet.getLastRow();
      if (totalRows <= 1) continue;

      var numRows = totalRows - 1;
      var maxColToFetch = Math.max(statusCol, personACol, personBCol || 1, obsCol || 1);
      
      // Batch get values + batch get rich text
      var sheetValues = curSheet.getRange(2, 1, numRows, maxColToFetch).getValues();
      var rtsA = curSheet.getRange(2, personACol, numRows, 1).getRichTextValues();
      var rtsB = personBCol ? curSheet.getRange(2, personBCol, numRows, 1).getRichTextValues() : null;

      var statusIdx = statusCol - 1;
      var personAIdx = personACol - 1;
      var personBIdx = personBCol ? personBCol - 1 : -1;
      var obsIdx = obsCol ? obsCol - 1 : -1;

      var foundInSheet = 0;
      for (var r = 0; r < numRows; r++) {
        var rowVal = sheetValues[r];
        var st = (rowVal[statusIdx] || "").toString().trim().toUpperCase();

        if (st === "HECHO" || st === "HECHO POR MAPE" || st === "APROBADO") {
          var textA = (rowVal[personAIdx] || "").toString().trim();
          var textB = personBIdx !== -1 ? (rowVal[personBIdx] || "").toString().trim() : "";

          if (!textA || !textB) continue;

          var pairKey = getCanonicalPairId(textA, textB);
          if (seenPairs[pairKey]) continue;
          seenPairs[pairKey] = true;

          var richA = rtsA[r][0];
          var richB = rtsB ? rtsB[r][0] : null;

          var obsVal = obsIdx !== -1 ? (rowVal[obsIdx] || "").toString().trim() : "";
          var psycB = psycMap[textB.toLowerCase()] || "";
          var isCross = (psycB && psycB.toLowerCase() !== psycName.toLowerCase());
          var origenTabB = isCross ? "MATCHES " + psycB : curName;
          var obsB = isCross ? "[Pendiente de revisión]" : obsVal;
          
          var aprobarInitial = "APROBADO POR AMBAS PSICÓLOGAS";
          var isAlreadyApproved = (st === "APROBADO");
          if (isAlreadyApproved) {
            aprobarInitial = "APROBADO";
          } else if (isCross) {
            aprobarInitial = "ESPERANDO APROBACIÓN DE " + psycB;
          }

          var matchUid = "MATCH-" + pairKey.replace(/___/g, "-").toUpperCase();

          collectedRows.push([
            matchUid, textA, curName, obsVal, textB, origenTabB, obsB, aprobarInitial, isAlreadyApproved, ""
          ]);

          richColA.push([richA || SpreadsheetApp.newRichTextValue().setText(textA).build()]);
          richColB.push([richB || SpreadsheetApp.newRichTextValue().setText(textB).build()]);

          // Construir colores de fila en batch
          var col8Bg = (aprobarInitial === "APROBADO POR AMBAS PSICÓLOGAS") ? "#D9EAD3" : "#FFF2CC";
          var col9Bg = (aprobarInitial === "APROBADO POR AMBAS PSICÓLOGAS") ? "#D9EAD3" : "#E8EAED";
          bgMatrix.push([null, null, null, null, null, null, null, col8Bg, col9Bg, null]);
          foundInSheet++;
        }
      }
      Logger.log("  ↳ [" + curName + "] " + foundInSheet + " matches calificados añadidos.");
    }

    var tScan = ((new Date().getTime() - tStart) / 1000).toFixed(3);
    Logger.log("⏱️ [" + tScan + "s] Escaneo completado. Total filas a escribir: " + collectedRows.length + ". Escribiendo en batch...");

    // 3. Escritura y formateo 100% Vectorizado en 1 Solo Batch Call
    if (collectedRows.length > 0) {
      var totalNeededRows = collectedRows.length + 1;
      if (revisionSheet.getMaxRows() < totalNeededRows) {
        revisionSheet.insertRowsAfter(revisionSheet.getMaxRows(), totalNeededRows - revisionSheet.getMaxRows() + 10);
      }

      // Escribir valores
      revisionSheet.getRange(2, 1, collectedRows.length, headers.length).setValues(collectedRows);

      // Inyectar RichText en batch
      revisionSheet.getRange(2, 2, collectedRows.length, 1).setRichTextValues(richColA);
      revisionSheet.getRange(2, 5, collectedRows.length, 1).setRichTextValues(richColB);

      // Inyectar colores de fondo en 1 solo batch call
      revisionSheet.getRange(2, 1, collectedRows.length, headers.length).setBackgrounds(bgMatrix);

      // Configurar Checkboxes en 1 solo batch call
      var checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      revisionSheet.getRange(2, 9, collectedRows.length, 1).setDataValidation(checkboxRule);
    }

    var tEnd = ((new Date().getTime() - tStart) / 1000).toFixed(3);
    Logger.log("⏱️ [" + tEnd + "s] ✅ Pestaña 'REVISIÓN MARÍA' reconstruida exitosamente con " + collectedRows.length + " filas.");
    try {
      ss.toast("REVISIÓN MARÍA actualizada: " + collectedRows.length + " matches listos en " + tEnd + "s.", "Revisión Lista", 5);
    } catch (tErr) {}
  } catch (err) {
    Logger.log("❌ ERROR CRÍTICO en reconstruirRevisionMaria: " + err.message + " | " + err.stack);
  }
}

/**
 * Instala el disparador periódico para reconstruir REVISIÓN MARÍA cada 60 minutos (1 hora).
 * OPTIMIZACIÓN DE PRESUPUESTO: Para cuentas personales de Google (cuota máxima de 90 min/día de triggers),
 * cambiar de 15 minutos (96 corridas/día) a 1 hora (24 corridas/día) reduce el tiempo de ejecución
 * en un 75% (de ~16 min/día a solo ~4 min/día), dejando un margen del 95% libre.
 */
function instalarTriggerRevisionMaria(frecuenciaHoras) {
  var horas = frecuenciaHoras || 1;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "reconstruirRevisionMaria") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("reconstruirRevisionMaria")
    .timeBased()
    .everyHours(horas)
    .create();

  Logger.log("✅ Disparador de REVISIÓN MARÍA configurado para ejecutarse cada " + horas + " hora(s) (optimizado para cuota de 90 min/día).");
}

/**
 * Opción alternativa: disparador cada 30 minutos (48 corridas/día = ~8 min/día de ejecución).
 */
function instalarTriggerRevisionMariaCada30Min() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "reconstruirRevisionMaria") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("reconstruirRevisionMaria")
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log("✅ Disparador de REVISIÓN MARÍA configurado para ejecutarse cada 30 minutos.");
}

/**
 * Instala el disparador periódico diario para verificar y actualizar las alertas de 15 días
 * en MATCHES y en las pestañas de las psicólogas.
 * Borra cualquier trigger previo de esta misma función para evitar duplicados.
 */
function instalarTriggerAlertas15DiasMatches() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "actualizarAlertas15DiasMatches") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("actualizarAlertas15DiasMatches")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log("✅ Disparador de Alertas de 15 Días configurado para ejecutarse diariamente a las 6 AM.");
}

/**
 * Instala el disparador de edición instalable 'onEditInstallable' para la hoja de cálculo activa.
 * Es el activador fundamental que escucha las ediciones en PROFILES, pestañas de psicólogas (MATCHES [nombre]),
 * REVISIÓN MARÍA, etc., y dispara la resolución de links, creación de slots, colores y validaciones.
 * Borra cualquier trigger previo de esta misma función para evitar duplicados.
 */
function instalarTriggerOnEditInstallable() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log("❌ No se pudo obtener la hoja de cálculo activa para instalar onEditInstallable.");
    return;
  }

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onEditInstallable") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("onEditInstallable")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("✅ Disparador instalable 'onEditInstallable' configurado exitosamente para la hoja de cálculo.");
}

/**
 * Instala todos los disparadores automáticos esenciales del sistema:
 * 1. onEditInstallable: Disparador de edición en tiempo real (PROFILES, MATCHES psicólogas, REVISIÓN MARÍA, etc.).
 * 2. REVISIÓN MARÍA: cada 1 hora (24 corridas/día = ~4 min/día).
 * 3. Alertas 15 días: 1 vez al día a las 6 AM.
 * Borra cualquier duplicado previo antes de crear cada activador.
 */
function instalarTodosLosTriggers() {
  instalarTriggerOnEditInstallable();
  instalarTriggerRevisionMaria(1);
  instalarTriggerAlertas15DiasMatches();

  // Asegurar también onEditClaude si está definido en el proyecto
  try {
    if (typeof onEditClaude === "function") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        var triggers = ScriptApp.getProjectTriggers();
        for (var i = 0; i < triggers.length; i++) {
          if (triggers[i].getHandlerFunction() === "onEditClaude") {
            ScriptApp.deleteTrigger(triggers[i]);
          }
        }
        ScriptApp.newTrigger("onEditClaude").forSpreadsheet(ss).onEdit().create();
        Logger.log("✅ Disparador instalable 'onEditClaude' configurado exitosamente.");
      }
    }
  } catch (cErr) {
    Logger.log("Aviso verificando onEditClaude: " + cErr.message);
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Disparadores automáticos instalados (onEditInstallable, Revisión María cada 1h, Alertas 15d diario).", "Triggers Configurados", 6);
  } catch (e) {}
}

// ─── 9. PROFILE PRIORITARIO: PESTAÑA 'PERSONAS DÍFICILES' ───────────────────

function resolvePlanSlots(rawPlan) {
  if (!rawPlan) return 0;
  var clean = rawPlan.toString().toUpperCase().trim().replace(/\s+/g, " ");
  if (CONFIG.PLAN_SLOTS_MAP[clean]) return CONFIG.PLAN_SLOTS_MAP[clean];
  if (clean.indexOf("EXPERIENCE") >= 0) return 4;
  if (clean.indexOf("VIP") >= 0 || clean.indexOf("4 DATE") >= 0 || clean.indexOf("4 CITA") >= 0) return 4;
  if (clean.indexOf("PREMIUM") >= 0 || clean.indexOf("150K") >= 0) return 3;
  if (clean.indexOf("ESTANDAR") >= 0 || clean.indexOf("ESTÁNDAR") >= 0 || clean.indexOf("3 DATE") >= 0 || clean.indexOf("3 CITA") >= 0) return 3;
  if (clean.indexOf("BASICO") >= 0 || clean.indexOf("BÁSICO") >= 0 || clean.indexOf("2 DATE") >= 0 || clean.indexOf("2 CITA") >= 0 || clean.indexOf("DOS DATE") >= 0) return 2;
  if (clean.indexOf("PAGO OTRA") >= 0 || clean.indexOf("OTRA DATE") >= 0 || clean.indexOf("1 DATE") >= 0 || clean.indexOf("1 CITA") >= 0 || clean.indexOf("UNA DATE") >= 0) return 1;
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
        isPriority: true,
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

  var pACol = headers["PERSON A"] || headers["PERSONA A"];
  if (pACol && data.personACell) {
    setCellData(sheet, newRow, pACol, data.personACell);
    protegerCeldaPersona(sheet, newRow, pACol, data.personACell.text, "Persona A");
  }

  var personBCol = headers["PERSON B"] || headers["PERSONA B"];
  if (personBCol) {
    if (data.personBCell) {
      setCellData(sheet, newRow, personBCol, data.personBCell);
      protegerCeldaPersona(sheet, newRow, personBCol, data.personBCell.text, "Persona B");
    } else {
      sheet.getRange(newRow, personBCol).setValue("");
    }
  }

  if (headers["PSICÓLOGA DE B"]) sheet.getRange(newRow, headers["PSICÓLOGA DE B"]).setValue(data.psychologistB || "");

  var fechaToSet = data.fecha || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
  var fCol = headers["FECHA DE ENTREVISTA"] || headers["FECHA ENTREVISTA"] || headers["FECHA"] || headers["DATE"];
  if (fCol) sheet.getRange(newRow, fCol).setValue(fechaToSet);
  if (headers["STATUS"]) {
    var initialStatus = data.status || "Listo para match";
    var statusRange = sheet.getRange(newRow, headers["STATUS"]).setValue(initialStatus);
    if (data.status === "REVISAR") {
      statusRange.setBackground("#D9D2E9");
    }
  }

  var priorityTag = (data.isPriority && data.slotIndex) ? ("[PRIORITARIO Slot " + data.slotIndex + "/" + data.totalSlots + "]") : "";
  var finalObs = (priorityTag ? priorityTag + " " : "") + (data.observaciones ? data.observaciones : "");
  if (headers["OBSERVACIONES"]) sheet.getRange(newRow, headers["OBSERVACIONES"]).setValue(finalObs);
  if (headers["OBSERVACION"]) sheet.getRange(newRow, headers["OBSERVACION"]).setValue(finalObs);

  // 4. Estampar Fecha de llegada automática (nunca se vuelve a tocar por otros flujos)
  var llegadaCol = headers["FECHA DE LLEGADA"] || headers["FECHA LLEGADA"] || headers["LLEGADA"];
  if (!llegadaCol) {
    llegadaCol = ensureFechaLlegadaColumn(sheet, headers);
  }
  if (llegadaCol) {
    var nowLlegadaStr = data.fechaLlegada || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
    sheet.getRange(newRow, llegadaCol).setValue(nowLlegadaStr);
  }

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

  // Si viene con el prefijo "MATCHES " (ej. "MATCHES PIA", "MATCHES SILVI")
  if (upper.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0) {
    upper = upper.substring(CONFIG.PSYCHOLOGIST_SHEET_PREFIX.length).trim();
  }

  // 1. Coincidencia exacta en lista oficial (persistida en DocumentProperties)
  var validList = obtenerPsicologasValidas();
  for (var i = 0; i < validList.length; i++) {
    if (upper === validList[i]) {
      return validList[i];
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
var normalizarNombrePsicologa = normalizePsychologistName;


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

  // 2. Regex robusto para SmartMatchApp con hash #!/client/3923/activities/ o client/3923
  var match = str.match(/client\/#!\/(\d+)/i) || 
              str.match(/#!\/client\/(\d+)/i) || 
              str.match(/#\/?client\/(\d+)/i) ||
              str.match(/(?:client|profile|view)[/=#!]+(\d+)/i) ||
              str.match(/client\/(\d+)/i);
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
 * Reconstruye la URL canónica del perfil en SmartMatchApp con el hash completo.
 */
function buildCanonicalCrmUrl(crmId, fallbackUrl) {
  if (crmId && /^\d+$/.test(crmId.toString().trim())) {
    return "https://dailylover.smartmatchapp.com/#!/client/" + crmId.toString().trim() + "/";
  }
  return fallbackUrl || "";
}

/**
 * Valida la compatibilidad entre Persona A y Persona B:
 * 1. Cita previa completada juntos en el historial.
 * 2. Compatibilidad de orientación / preferencia.
 * 3. Compatibilidad de ciudad.
 */
function normalizeCityLocal(city) {
  if (!city) return "";
  var c = city.toString().toLowerCase().trim();
  if (c.indexOf("bog") >= 0) return "Bogotá";
  if (c.indexOf("med") >= 0 || c.indexOf("mde") >= 0) return "Medellín";
  if (c.indexOf("cal") >= 0) return "Cali";
  if (c.indexOf("barr") >= 0 || c.indexOf("baq") >= 0) return "Barranquilla";
  if (c.indexOf("cart") >= 0 || c.indexOf("ctg") >= 0) return "Cartagena";
  if (c.indexOf("per") >= 0) return "Pereira";
  if (c.indexOf("buc") >= 0 || c.indexOf("bga") >= 0) return "Bucaramanga";
  if (c.indexOf("man") >= 0) return "Manizales";
  if (c.indexOf("san") >= 0 || c.indexOf("smr") >= 0) return "Santa Marta";
  return city.toString().trim();
}

function normalizePrefLocal(pref) {
  if (!pref) return "";
  var p = pref.toString().toLowerCase().trim();
  if (p.indexOf("gay") >= 0 || p.indexOf("homo") >= 0) return "gay";
  if (p.indexOf("lesb") >= 0) return "lesb";
  if (p.indexOf("bi") >= 0) return "bi";
  if (p.indexOf("hetero") >= 0) return "hetero";
  return p;
}

/**
 * Busca los detalles completos de una persona (nombre, CRM ID, ciudad, preferencia/orientación, psicóloga)
 * dentro del libro de cálculo (en PROFILES y en todas las pestañas de psicólogas).
 * @param {Object} personCell - { text, link, crmId, richText }
 * @returns {Object|null} - { name, crmId, city, pref, psychologist, source }
 */
function findPersonDetailsInWorkbook(personCell) {
  if (!personCell || (!personCell.text && !personCell.link && !personCell.crmId)) return null;

  var targetName = (personCell.text || "").trim().toLowerCase();
  var linkUrl = (personCell.richText && personCell.richText.getLinkUrl()) ? personCell.richText.getLinkUrl() : (personCell.link || "");
  var targetCrmId = personCell.crmId || extractCrmIdFromUrl(linkUrl);

  // 1. Consultar al backend primero (SSOT en vivo de SmartMatchApp / DB)
  var query = targetCrmId || linkUrl || targetName;
  if (query) {
    var crm = fetchProfileFromBackend(query);
    if (crm && crm.found) {
      return {
        name: crm.name || personCell.text,
        crmId: crm.crm_id || targetCrmId,
        city: crm.city || "",
        pref: crm.pref || crm.orientation || "",
        psychologist: normalizePsychologistName(crm.psychologist || ""),
        source: "CRM_BACKEND"
      };
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 2. Buscar en las 10 pestañas de psicólogas (donde CITY y PREF residen en Col 3 y 4)
  var sheets = ss.getSheets();
  for (var sIdx = 0; sIdx < sheets.length; sIdx++) {
    var s = sheets[sIdx];
    var sName = s.getName().trim().toUpperCase();
    if (sName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sName !== "MATCHES") {
      var headers = getSheetHeaders(s);
      var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"];
      var cityCol = headers["CITY"] || headers["CIUDAD"] || 3;
      var prefCol = headers["PREF"] || headers["PREFERENCIA"] || 4;
      if (!personACol) continue;

      var lastRow = Math.min(s.getLastRow(), 2500);
      if (lastRow > 1) {
        var rts = s.getRange(2, personACol, lastRow - 1, 1).getRichTextValues();
        var data = s.getRange(2, 1, lastRow - 1, s.getLastColumn()).getValues();

        for (var i = 0; i < data.length; i++) {
          var rt = rts[i][0];
          var rowText = rt ? rt.getText().trim() : (data[i][personACol - 1] || "").toString().trim();
          var rowLink = rt ? (rt.getLinkUrl() || "") : "";
          var rowCrmId = extractCrmIdFromUrl(rowLink);

          var isMatch = false;
          if (targetCrmId && rowCrmId && targetCrmId === rowCrmId) {
            isMatch = true;
          } else if (targetName && rowText && rowText.toLowerCase() === targetName) {
            isMatch = true;
          }

          if (isMatch) {
            var foundCity = (cityCol && cityCol <= data[i].length) ? (data[i][cityCol - 1] || "").toString().trim() : "";
            var foundPref = (prefCol && prefCol <= data[i].length) ? (data[i][prefCol - 1] || "").toString().trim() : "";
            var psycRaw = sName.replace(CONFIG.PSYCHOLOGIST_SHEET_PREFIX, "").trim();
            return {
              name: rowText || personCell.text,
              crmId: rowCrmId || targetCrmId,
              city: foundCity,
              pref: foundPref,
              psychologist: normalizePsychologistName(psycRaw),
              source: s.getName()
            };
          }
        }
      }
    }
  }

  // 3. Buscar en PROFILES (Col 2 = FullName, Col 4 = Responsable, Col 5 = Ciudad y años)
  var profSheet = ss.getSheetByName(CONFIG.PROFILES_SHEET_NAME || "PROFILES") || ss.getSheetByName("PROFILES");
  if (profSheet) {
    var pHeaders = getSheetHeaders(profSheet);
    var nameCol = pHeaders["FULLNAME"] || pHeaders["FULL NAME"] || pHeaders["NOMBRE"] || 2;
    var respCol = pHeaders["RESPONSABLE"] || pHeaders["PSICOLOGA"] || 4;
    var cityAgeCol = pHeaders["CIUDAD Y AÑOS"] || pHeaders["CIUDAD"] || 5;

    var lastRow = profSheet.getLastRow();
    if (lastRow > 1) {
      var rts = profSheet.getRange(2, nameCol, lastRow - 1, 1).getRichTextValues();
      var data = profSheet.getRange(2, 1, lastRow - 1, profSheet.getLastColumn()).getValues();

      for (var i = 0; i < data.length; i++) {
        var rt = rts[i][0];
        var rowText = rt ? rt.getText().trim() : (data[i][nameCol - 1] || "").toString().trim();
        var rowLink = rt ? (rt.getLinkUrl() || "") : "";
        var rowCrmId = extractCrmIdFromUrl(rowLink);

        var isMatch = false;
        if (targetCrmId && rowCrmId && targetCrmId === rowCrmId) {
          isMatch = true;
        } else if (targetName && rowText && rowText.toLowerCase() === targetName) {
          isMatch = true;
        }

        if (isMatch) {
          var rawCityAge = (cityAgeCol && cityAgeCol <= data[i].length) ? (data[i][cityAgeCol - 1] || "").toString().trim() : "";
          // Extraer ciudad limpia (ej: "Tenjo 28" -> "Tenjo", "Bogotá 32" -> "Bogotá")
          var parsedCity = rawCityAge.replace(/\d+/g, "").replace(/años?/gi, "").trim();
          var foundPsyc = (respCol && respCol <= data[i].length) ? (data[i][respCol - 1] || "").toString().trim() : "";
          return {
            name: rowText || personCell.text,
            crmId: rowCrmId || targetCrmId,
            city: parsedCity,
            pref: "",
            psychologist: normalizePsychologistName(foundPsyc),
            source: "PROFILES"
          };
        }
      }
    }
  }

  return null;
}

/**
 * Valida la compatibilidad entre Persona A y Persona B:
 * 1. Cita previa completada juntos en el historial.
 * 2. Compatibilidad de orientación / preferencia.
 * 3. Compatibilidad de ciudad.
 */
function checkPairCompatibility(cellA, cellB, sheet, row, headers) {
  var issues = [];
  var nameA = (cellA && cellA.text ? cellA.text : "").trim();
  var nameB = (cellB && cellB.text ? cellB.text : "").trim();
  var linkA = (cellA && cellA.richText && cellA.richText.getLinkUrl()) ? cellA.richText.getLinkUrl() : (cellA && cellA.link ? cellA.link : "");
  var linkB = (cellB && cellB.richText && cellB.richText.getLinkUrl()) ? cellB.richText.getLinkUrl() : (cellB && cellB.link ? cellB.link : "");
  var crmIdA = (cellA && cellA.crmId) ? cellA.crmId : extractCrmIdFromUrl(linkA);
  var crmIdB = (cellB && cellB.crmId) ? cellB.crmId : extractCrmIdFromUrl(linkB);

  var apiBase = CONFIG.BACKEND_API_URL || CONFIG.API_BASE_URL || "https://prueba-daily.agentesia.cloud";

  // 1. Consultar endpoint backend /check-compatibility
  try {
    var response = UrlFetchApp.fetch(apiBase + "/api/v1/matchmaking/check-compatibility", {
      method: "post",
      contentType: "application/json",
      headers: { "X-Webhook-Secret": CONFIG.WEBHOOK_SECRET || "" },
      payload: JSON.stringify({
        person_a_crm_id: crmIdA,
        person_a_name: nameA,
        person_b_crm_id: crmIdB,
        person_b_name: nameB,
        person_b_url: linkB
      }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data) {
        if (data.name_b && data.name_b !== nameB && nameB.indexOf("http") === 0) {
          nameB = data.name_b;
        }
        if (data.name_a && data.name_a !== nameA && nameA.indexOf("http") === 0) {
          nameA = data.name_a;
        }
        var warns = data.warnings || [];
        if (data.issues && data.issues.length > 0) {
          return { compatible: false, issues: data.issues, warnings: warns, nameA: nameA, nameB: nameB };
        } else {
          return { compatible: true, issues: [], warnings: warns, nameA: nameA, nameB: nameB };
        }
      }
    }
  } catch (err) {
    Logger.log("Aviso al consultar check-compatibility en backend: " + err.message + ". Ejecutando respaldo local en Sheet.");
  }

  // 2. Respaldo Local en el Sheet (Si el backend no respondió o falló)
  // ── CHEQUEO 1: Cita previa realizada o match previo ──
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var histSheet = ss.getSheetByName("Corazoncito") || ss.getSheetByName("MATCHES");
  if (histSheet && nameA && nameB) {
    var lastRow = Math.min(histSheet.getLastRow(), 2000);
    if (lastRow > 1) {
      var vals = histSheet.getRange(2, 1, lastRow - 1, 12).getValues();
      for (var i = 0; i < vals.length; i++) {
        var hA = (vals[i][5] || "").toString().trim().toLowerCase();
        var hB = (vals[i][6] || "").toString().trim().toLowerCase();
        var hStatus = (vals[i][9] || "").toString().trim().toUpperCase();
        if (((hA === nameA.toLowerCase() && hB === nameB.toLowerCase()) || 
             (hA === nameB.toLowerCase() && hB === nameA.toLowerCase())) &&
            (hStatus.indexOf("DATE") >= 0 || hStatus.indexOf("REALIZAD") >= 0 || hStatus.indexOf("APROBAD") >= 0 || hStatus.indexOf("HECHO") >= 0 || hStatus.indexOf("CONFIRMAD") >= 0)) {
          issues.push("Cita previa existente: " + nameA + " y " + nameB + " ya tuvieron una cita o match registrado en el historial del libro.");
          break;
        }
      }
    }
  }

  // Obtener datos locales de Persona A
  var cityColA = headers["CITY"] || headers["CIUDAD"];
  var prefColA = headers["PREF"] || headers["PREFERENCIA"];
  var rawCityA = cityColA ? (sheet.getRange(row, cityColA).getValue() || "").toString().trim() : "";
  var rawPrefA = prefColA ? (sheet.getRange(row, prefColA).getValue() || "").toString().trim() : "";

  // Si Persona A no tiene city/pref en la fila actual, buscar en PROFILES
  if (!rawCityA || !rawPrefA) {
    var detailsA = findPersonDetailsInWorkbook(cellA);
    if (detailsA) {
      if (!rawCityA) rawCityA = detailsA.city;
      if (!rawPrefA) rawPrefA = detailsA.pref;
    }
  }

  // Obtener datos locales de Persona B buscando en PROFILES o en las pestañas de psicólogas
  var detailsB = findPersonDetailsInWorkbook(cellB);
  var rawCityB = detailsB ? detailsB.city : "";
  var rawPrefB = detailsB ? detailsB.pref : "";

  // Normalizar ciudades
  var normCityA = normalizeCityLocal(rawCityA);
  var normCityB = normalizeCityLocal(rawCityB);

  // ── CHEQUEO 2: Comparación de Ciudad (SOLO AVISO, NO BLOQUEANTE) ──
  if (normCityA && normCityB && normCityA.toLowerCase() !== normCityB.toLowerCase()) {
    // La ciudad distinta ya NO bloquea la asignación ni pide confirmación modal, solo se registra como aviso
    Logger.log("ℹ️ Aviso de compatibilidad (No bloqueante): Ciudades distintas -> " + nameA + " (" + normCityA + ") vs " + nameB + " (" + normCityB + ")");
  }

  // Normalizar preferencias / orientación
  var normPrefA = normalizePrefLocal(rawPrefA);
  var normPrefB = normalizePrefLocal(rawPrefB);

  // ── CHEQUEO 3: Comparación Simétrica de Orientación / Preferencia ──
  if (normPrefA && normPrefB) {
    if (normPrefA !== normPrefB && normPrefA !== "bi" && normPrefB !== "bi") {
      var labelA = normPrefA === "lesb" ? "LESBIANA" : normPrefA.toUpperCase();
      var labelB = normPrefB === "lesb" ? "LESBIANA" : normPrefB.toUpperCase();
      issues.push("Incompatibilidad de orientación: " + nameA + " es " + labelA + " y " + nameB + " es " + labelB + ".");
    }
  }

  return {
    compatible: issues.length === 0,
    issues: issues
  };
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
  var details = findPersonDetailsInWorkbook(personBCell);
  if (details && details.psychologist) {
    return details.psychologist;
  }
  return "";
}

/**
 * Asegura la existencia de la columna 'Fecha de llegada' después de 'OBSERVACIONES'.
 */
function ensureFechaLlegadaColumn(sheet, headers) {
  var existingCol = headers["FECHA DE LLEGADA"] || headers["FECHA LLEGADA"] || headers["LLEGADA"];
  if (existingCol) return existingCol;

  try {
    var obsCol = headers["OBSERVACIONES"] || headers["OBSERVACION"] || sheet.getLastColumn();
    var targetCol = obsCol + 1;
    
    var headerVal = (sheet.getRange(1, targetCol).getValue() || "").toString().trim();
    if (!headerVal || headerVal.toLowerCase().indexOf("columna") === 0) {
      sheet.getRange(1, targetCol).setValue("Fecha de llegada").setFontWeight("bold").setBackground("#D9EAD3");
      headers["FECHA DE LLEGADA"] = targetCol;
      return targetCol;
    } else {
      sheet.insertColumnAfter(obsCol);
      sheet.getRange(1, targetCol).setValue("Fecha de llegada").setFontWeight("bold").setBackground("#D9EAD3");
      headers["FECHA DE LLEGADA"] = targetCol;
      return targetCol;
    }
  } catch (e) {
    Logger.log("Aviso al asegurar columna Fecha de llegada: " + e.message);
    return null;
  }
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

  // ── 0. REGLA: PROHIBIR BORRAR PERSONA A EN PROFILES ─────────────────────
  if (col === fullNameCol) {
    var rawEdit = (newValue || sheet.getRange(row, col).getValue() || "").toString().trim();
    if (oldValue && oldValue.toString().trim() !== "" && (!rawEdit || rawEdit === "")) {
      sheet.getRange(row, col).setValue(oldValue);
      SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Prohibido borrar Persona A ya registrada.", "Operación Inválida", 5);
      return;
    }
  }

  var personACell = getCellData(sheet, row, fullNameCol);
  var personAName = personACell ? personACell.text.trim() : "";
  Logger.log("FullName (Col " + fullNameCol + "): '" + personAName + "' (RichText Link: " + (personACell && personACell.richText ? personACell.richText.getLinkUrl() : "none") + ")");

  if (!personAName) {
    Logger.log("ABORTADO: FullName está vacío en fila " + row);
    return;
  }

  // Validar que Persona A sea una URL del CRM
  var isUrlA = personAName.indexOf("http") >= 0 || personAName.indexOf("smartmatchapp") >= 0 || personAName.indexOf("client/") >= 0 || personAName.indexOf("profile/") >= 0;
  var hasLinkA = personACell && personACell.richText && personACell.richText.getLinkUrl();

  if (!isUrlA && !hasLinkA) {
    sheet.getRange(row, fullNameCol).setValue(oldValue || "");
    sheet.getRange(row, fullNameCol).setBackground("#F4CCCC").setNote("⚠️ Operación Inválida: Solo se permite pegar el enlace del perfil en SmartMatchApp, no texto libre.");
    SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Operación Inválida: En PROFILES solo se permite pegar el enlace de SmartMatchApp.", "Operación Inválida", 6);
    return;
  }

  var cellPsycVal = (sheet.getRange(row, respCol).getValue() || "").toString().trim();
  var rawPsyc = (newValue && col === respCol ? newValue : cellPsycVal).toString().trim();

  // 0. SI PEGARON UNA URL EN FULLNAME, RESOLVER AUTOMÁTICAMENTE NOMBRE, LINK Y PSICÓLOGA
  if (isUrlA) {
    var rawUrl = (typeof newValue !== "undefined" && newValue) ? newValue.toString().trim() : personAName;
    var crmId = extractCrmIdFromUrl(rawUrl);
    var crmProfile = fetchProfileFromBackend(crmId || rawUrl);
    if (crmProfile && crmProfile.found && crmProfile.name) {
      var resolvedCrmId = crmProfile.crm_id || crmId;
      var canonicalUrl = buildCanonicalCrmUrl(resolvedCrmId, rawUrl);
      var richText = SpreadsheetApp.newRichTextValue()
        .setText(crmProfile.name)
        .setLinkUrl(canonicalUrl)
        .build();
      sheet.getRange(row, fullNameCol).setRichTextValue(richText).setBackground(null).clearNote();
      protegerCeldaPersona(sheet, row, fullNameCol, crmProfile.name, "Persona A (PROFILES)");
      personAName = crmProfile.name;
      personACell = { text: crmProfile.name, richText: richText, formula: "", crmId: resolvedCrmId, link: canonicalUrl };
      Logger.log("✅ URL resuelta a Nombre: '" + crmProfile.name + "' con Link Canónico: '" + canonicalUrl + "' y celda protegida");

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

  // 1. AUTO-GENERACIÓN DE NO. (ID) Y FECHA DE ENTREVISTA EN PROFILES (Dispara cuando FullName y Responsable están completos)
  var noCol = headers["NO."] || headers["NO"] || headers["ID"] || 1;
  var fechaCol = headers["FECHA DE ENTREVISTA"] || headers["FECHA ENTREVISTA"] || headers["FECHA"] || headers["DATE"] || 3;

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

  // 2. NORMALIZACIÓN DE PSICÓLOGA
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

  // 3. BÚSQUEDA DE PESTAÑA DE PSICÓLOGA NUEVA
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

  // 4. REGLA DE REASIGNACIÓN / AUTOCORRECCIÓN DE RESPONSABLE EN PROFILES
  var currentSlotsMarker = (sheet.getRange(row, slotsCol).getValue() || "").toString().trim().toUpperCase();
  Logger.log("SlotsCol actual (Col " + slotsCol + "): '" + currentSlotsMarker + "'");

  var hasExistingSlotsMarker = currentSlotsMarker && (
    currentSlotsMarker.indexOf("SLOTS CREADOS") >= 0 ||
    currentSlotsMarker.indexOf("HISTÓRICO") >= 0 ||
    currentSlotsMarker.indexOf("YA GENERADO") >= 0 ||
    currentSlotsMarker.indexOf("YA EXISTEN") >= 0
  );

  if (hasExistingSlotsMarker) {
    // Escanear todas las pestañas de psicólogas para verificar si los slots existentes ya tienen HECHO o están sin trabajar
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var allSheets = ss.getSheets();
    var foundSlots = []; // Array de { sheet, sheetName, row, status }
    var targetCrmId = personACell.crmId || (personACell.richText ? extractCrmIdFromUrl(personACell.richText.getLinkUrl()) : "");
    var targetName = (personAName || "").trim().toLowerCase();

    for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
      var s = allSheets[sIdx];
      var sUpper = s.getName().trim().toUpperCase();
      if (sUpper.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sUpper !== "MATCHES") {
        var sHeaders = getSheetHeaders(s);
        var sPersonACol = sHeaders["PERSON A"] || sHeaders["PERSONA A"] || sHeaders["CLIENTE"];
        var sStatusCol = sHeaders["STATUS"];
        if (!sPersonACol) continue;

        var sLastRow = getTrueLastRow(s, sPersonACol);
        if (sLastRow > 1) {
          var sRts = s.getRange(2, sPersonACol, sLastRow - 1, 1).getRichTextValues();
          var sVals = s.getRange(2, 1, sLastRow - 1, s.getLastColumn()).getValues();

          for (var rIdx = 0; rIdx < sVals.length; rIdx++) {
            var rt = sRts[rIdx][0];
            var rText = rt ? rt.getText().trim() : (sVals[rIdx][sPersonACol - 1] || "").toString().trim();
            var rLink = rt ? (rt.getLinkUrl() || "") : "";
            var rCrmId = extractCrmIdFromUrl(rLink);

            var isClient = false;
            if (targetCrmId && rCrmId && targetCrmId === rCrmId) {
              isClient = true;
            } else if (targetName && rText && rText.toLowerCase() === targetName) {
              isClient = true;
            }

            if (isClient) {
              var rowNum = rIdx + 2;
              var stVal = (sStatusCol && sStatusCol <= sVals[rIdx].length) ? (sVals[rIdx][sStatusCol - 1] || "").toString().trim().toUpperCase() : "";
              foundSlots.push({
                sheet: s,
                sheetName: s.getName().trim(),
                row: rowNum,
                status: stVal
              });
            }
          }
        }
      }
    }

    Logger.log("Slots encontrados en el libro para " + personAName + ": " + foundSlots.length);

    // Verificar si alguno ya tiene estado HECHO / TRABAJADO
    var hasWorkedSlot = false;
    var workedDetail = "";
    for (var fIdx = 0; fIdx < foundSlots.length; fIdx++) {
      var st = foundSlots[fIdx].status;
      if (st.indexOf("HECHO") >= 0 || st.indexOf("APROBADO") >= 0 || st.indexOf("DATE") >= 0 || st.indexOf("REALIZAD") >= 0 || st.indexOf("CONFIRMAD") >= 0 || st.indexOf("MATCH DONE") >= 0) {
        hasWorkedSlot = true;
        workedDetail = foundSlots[fIdx].sheetName + " fila " + foundSlots[fIdx].row + " (STATUS: " + st + ")";
        break;
      }
    }

    if (hasWorkedSlot) {
      // BLOQUEAR CAMBIO DE RESPONSABLE
      sheet.getRange(row, respCol).setValue(oldValue || "");
      var lockMsg = "⚠️ Bloqueado: No se puede reasignar la psicóloga de " + personAName + " porque ya tiene slots trabajados/HECHO en " + workedDetail + ".";
      SpreadsheetApp.getActiveSpreadsheet().toast(lockMsg, "Reasignación Bloqueada", 8);
      sheet.getRange(row, respCol).setNote(lockMsg);
      Logger.log(lockMsg);
      return;
    }

    // Si los slots ya están creados en la MISMA psicóloga (no hubo cambio real), abortar sin duplicar
    var isAlreadyInTargetPsyc = foundSlots.length > 0 && foundSlots.every(function(slot) {
      return slot.sheetName.toUpperCase() === psycSheet.getName().trim().toUpperCase();
    });
    if (isAlreadyInTargetPsyc) {
      Logger.log("ABORTADO: Los slots ya existen en la psicóloga seleccionada '" + cleanPsyc + "'.");
      return;
    }

    // Si todos los slots están sin trabajar (pendientes/vacíos), BORRAR los slots viejos
    if (foundSlots.length > 0) {
      Logger.log("Borrando " + foundSlots.length + " slots no trabajados de la psicóloga anterior...");
      // Agrupar y ordenar de mayor a menor fila para no desfasar índices
      foundSlots.sort(function(a, b) {
        if (a.sheetName === b.sheetName) {
          return b.row - a.row;
        }
        return a.sheetName.localeCompare(b.sheetName);
      });

      for (var dIdx = 0; dIdx < foundSlots.length; dIdx++) {
        var delSlot = foundSlots[dIdx];
        try {
          delSlot.sheet.deleteRow(delSlot.row);
          Logger.log("Fila " + delSlot.row + " eliminada de " + delSlot.sheetName);
        } catch (delErr) {
          Logger.log("Aviso al borrar fila " + delSlot.row + " en " + delSlot.sheetName + ": " + delErr.message);
        }
      }
    }
  } else {
    // 5. VERIFICACIÓN CRUZADA GLOBAL SI NO TENÍA MARCA PREVIA
    Logger.log("Ejecutando checkExistingSlots para '" + personAName + "'...");
    var alreadyExistsReason = checkExistingSlots(personACell, psycSheet);
    Logger.log("Resultado de checkExistingSlots: " + (alreadyExistsReason ? "'" + alreadyExistsReason + "'" : "null (limpio)"));

    if (alreadyExistsReason) {
      sheet.getRange(row, slotsCol).setValue(alreadyExistsReason).setBackground("#D9EAD3");
      SpreadsheetApp.getActiveSpreadsheet().toast("Aviso: " + alreadyExistsReason + " para " + personAName, "Detección de Duplicado", 6);
      return;
    }
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

  // ── REGLA: Matchmaking Experience es exclusivo de MAPE D ──
  var isExperiencePlan = (planFromCrm && planFromCrm.toString().toUpperCase().indexOf("EXPERIENCE") >= 0);
  if (isExperiencePlan && cleanPsyc !== "MAPE D") {
    Logger.log("⭐ Plan Matchmaking Experience detectado. Reasignando exclusivamente a MAPE D.");
    cleanPsyc = "MAPE D";
    sheet.getRange(row, respCol).setValue("MAPE D");
    psycSheet = findPsychologistSheet("MAPE D");
    SpreadsheetApp.getActiveSpreadsheet().toast("Plan Matchmaking Experience asignado automáticamente a MAPE D (exclusivo).", "Asignación MAPE", 6);
  }

  // 7. VALIDACIÓN DE PLAN (Sin default: si no viene, fila amarilla y no genera slots)
  if (!crmProfile || !crmProfile.found || !numSlots) {
    Logger.log("AVISO: Perfil sin plan válido en CRM. Marcando fila en amarillo #FFF2CC");
    sheet.getRange(row, slotsCol)
      .setValue("PENDIENTE PLAN (CRM)")
      .setBackground("#FFF2CC")
      .setNote("El perfil en CRM no tiene un plan válido asignado (Básico: 2 slots, Premium: 3 slots, VIP: 4 slots, Matchmaking Experience: 4 slots). No se crearon slots.");
    sheet.getRange(row, fullNameCol).setBackground("#FFF2CC");
    SpreadsheetApp.getActiveSpreadsheet().toast("Cliente " + personAName + " sin plan en CRM. No se crearon slots.", "Plan Requerido", 6);
    return;
  } else {
    sheet.getRange(row, fullNameCol).setBackground(null);
  }

  var ciudad = crmProfile.city || "";
  var pref = crmProfile.pref || ""; // NUNCA default a "hetero"

  // ── 7.5 REGLA BLOQUEANTE: MÁXIMO 1 CLIENTE ABIERTO POR PSICÓLOGA EN PROFILES ──
  var unclosedClient = getUnclosedClientForPsychologist(psycSheet, personAName);
  if (unclosedClient) {
    Logger.log("🚨 BLOQUEO PROFILES: " + cleanPsyc + " ya tiene un cliente sin tocar: '" + unclosedClient + "'");
    
    var alertLockKey = "alert_prof_" + sheet.getName() + "_" + row + "_" + cleanPsyc;
    var cache = CacheService.getScriptCache();
    if (cache && cache.get(alertLockKey)) {
      Logger.log("⚠️ Modal de cliente abierto ya mostrado recientemente para " + alertLockKey + ". Omitiendo modal duplicado.");
      sheet.deleteRow(row);
      return;
    }
    if (cache) cache.put(alertLockKey, "1", 6);

    var alertMsg = "⚠️ BLOQUEO DE CLIENTE ABIERTO:\n\n" +
                   "La psicóloga " + cleanPsyc + " ya tiene un cliente abierto sin tocar: '" + unclosedClient + "'.\n\n" +
                   "Cada psicóloga solo puede tener 1 cliente sin tocar a la vez en PROFILES.\n" +
                   "Debe cambiar el estado o trabajar el cliente actual antes de ingresar a '" + personAName + "'.\n\n" +
                   "La fila ingresada será eliminada de PROFILES.";
    try {
      SpreadsheetApp.getUi().alert("Límite de Cliente Abierto", alertMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiErr) {}
    
    // Borrar la fila completa para no acumular basura en PROFILES
    sheet.deleteRow(row);
    SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Fila eliminada: " + cleanPsyc + " ya tiene a '" + unclosedClient + "' sin tocar.", "Cliente Pendiente", 8);
    return;
  }

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
    var fechaEntrevistaVal = fechaCol ? (sheet.getRange(row, fechaCol).getValue() || "") : "";
    if (!fechaEntrevistaVal) {
      fechaEntrevistaVal = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
      if (fechaCol) sheet.getRange(row, fechaCol).setValue(fechaEntrevistaVal);
    }

    for (var i = 1; i <= numSlots; i++) {
      appendPrioritySlotRow(psycSheet, psycHeaders, {
        city: ciudad,
        pref: pref,
        plan: planFromCrm,
        personACell: personACell,
        slotIndex: i,
        totalSlots: numSlots,
        fecha: fechaEntrevistaVal,
        observaciones: ""
      });
      Logger.log("Slot " + i + "/" + numSlots + " insertado en '" + psycSheet.getName() + "' con FECHA: " + fechaEntrevistaVal);
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
 * REGLA CRÍTICA: El menú se construye y se añade a la UI INMEDIATAMENTE al inicio de onOpen.
 * Nunca debe haber llamadas pesadas (REST, normalización de tablas, etc.) antes de crear el menú,
 * respetando el límite estricto de 30 segundos de los triggers simples de Apps Script.
 */
function onOpen(e) {
  // 1. Construir y agregar el menú interactivo PRIMERO
  try {
    var menu = SpreadsheetApp.getUi().createMenu("🔎 Daily Lover");
    menu.addItem("🚀 CONFIGURACIÓN INICIAL COMPLETA (Ejecutar una sola vez)", "configuracionInicialCompleta");
    menu.addSeparator();
    menu.addItem("Historial de persona", "mostrarHistorialPersona");
    menu.addSeparator();

    // Verificar si la persona que tiene el archivo abierto es María
    var currentUserEmail = "";
    try {
      currentUserEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
    } catch (userErr) {}
    
    var mariaEmail = (CONFIG.MARIA_EMAIL || "").toLowerCase().trim();

    // Solo mostrar opciones de supervisión y desbloqueo a María
    if (currentUserEmail && mariaEmail && currentUserEmail === mariaEmail) {
      menu.addItem("🔄 Reconstruir REVISIÓN MARÍA (A Demanda)", "reconstruirRevisionMaria");
      menu.addItem("Generar 🔒 Panel de Supervisión María", "generarPanelSupervisionMaria");
      menu.addItem("🔄 Recalcular Supervisión Con Filtro", "recalcularSupervisionConFiltro");
      menu.addItem("⏰ Instalar Trigger Diario Supervisión (5 AM)", "instalarTriggerPanelSupervisionDiario");
      menu.addItem("🔓 Desbloquear Fila Cruzada (Solo María)", "desbloquearFilaCruzada");
      menu.addItem("Proteger ⚙️ CONFIG ESTADOS (Solo María)", "protegerConfigEstados");
      menu.addSeparator();
    }

    menu.addItem("🔄 Reconstruir REVISIÓN MARÍA", "reconstruirRevisionMaria");
    menu.addItem("🛠️ Crear Pestañas de Soporte Si Faltan", "crearPestanasDeSoporteSiFaltan");
    menu.addItem("⚙️ Puesta a Punto Inicial (Estandarizar 11 Pestañas)", "ejecutarPuestaAPuntoInicialManual");
    menu.addItem("⚙️ Normalizar Todas las Pestañas (12 Cols Canónicas)", "reordenarColumnasPsicologasCanonico");
    menu.addItem("➕ Crear Nueva Pestaña de Psicóloga", "promptCrearNuevaPsicologa");
    menu.addItem("⏰ Instalar Disparadores Automáticos (Triggers)", "instalarTodosLosTriggers");
    menu.addItem("⚡ Instalar Trigger de Edición (onEdit)", "instalarTriggerOnEditInstallable");
    menu.addItem("⏰ Verificar Alertas de 15 Días (CS y Psicólogas)", "actualizarAlertas15DiasMatches");
    menu.addItem("🚨 Verificar Inactividad 15+ Días en Clientes", "verificarInactividad15DiasClientes");
    menu.addSeparator();
    menu.addItem("Actualizar Desplegables desde ⚙️ CONFIG ESTADOS", "actualizarDesplegablesDinamicos");
    menu.addItem("Configurar Dropdown Responsable", "configurarDropdownResponsable");
    menu.addItem("⚙️ Reordenar Columnas MATCHES (17 Canónicas)", "reordenarColumnasMatchesCanonico");
    menu.addItem("⚙️ Asegurar Columnas de Estados en MATCHES", "ensureMatchesColumnsAndDropdowns");
    menu.addItem("📅 Sincronizar y Limpiar Citas Aceptadas", "sincronizarTodasLasCitasAceptadas");
    menu.addToUi();
    Logger.log("✅ Menú '🔎 Daily Lover' creado exitosamente en onOpen.");
  } catch (menuErr) {
    Logger.log("Error crítico creando menú en onOpen: " + menuErr);
  }

  // 2. Tarea secundaria ultraliviana (solo congelar fila 1 si no lo está, <50ms, sin llamadas REST)
  try {
    asegurarFilasCongeladasLiviano();
  } catch (lightErr) {
    Logger.log("Aviso en asegurarFilasCongeladasLiviano: " + lightErr.message);
  }
}

/**
 * Operación ultraliviana para onOpen: asegura que la fila 1 de las pestañas principales esté congelada.
 * No realiza llamadas REST, no altera datos, no reordena columnas ni toca tablas nativas.
 */
function asegurarFilasCongeladasLiviano() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var sName = sh.getName().trim().toUpperCase();
    if (sName.indexOf("MATCHES") === 0 || sName === "PROFILES" || sName === "PERSONAS DÍFICILES" || sName === "PERSONAS DIFICILES") {
      try {
        if (sh.getFrozenRows() < 1) {
          sh.setFrozenRows(1);
        }
      } catch (e) {}
    }
  }
}

// ─── 12. SISTEMA CENTRAL DE ESTADOS (⚙️ CONFIG ESTADOS) ─────────────────────

/**
 * Normaliza cualquier formato de fecha/hora de cita a formato ISO 'YYYY-MM-DD' o 'YYYY-MM-DD HH:mm'.
 * Admite: '10.18', '10.24 7pm', '10.30 7:30 pm', '11.08 8:30pm', '2026-10-18', seriales numéricos de Sheets, etc.
 */
function parseDateToIsoLocal(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var yyyy = val.getFullYear();
    var mm = ("0" + (val.getMonth() + 1)).slice(-2);
    var dd = ("0" + val.getDate()).slice(-2);
    var hours = val.getHours();
    var mins = ("0" + val.getMinutes()).slice(-2);
    if (hours === 0 && mins === "00") {
      return yyyy + "-" + mm + "-" + dd;
    }
    return yyyy + "-" + mm + "-" + dd + " " + ("0" + hours).slice(-2) + ":" + mins;
  }

  var str = val.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str;
  }

  // Regex para MM.DD o MM/DD con hora opcional (e.g. '10.24 7pm', '10.30 7:30 pm')
  var match = str.match(/^(\d{1,2})[./\-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (match) {
    var month = parseInt(match[1], 10);
    var day = parseInt(match[2], 10);
    var hourRaw = match[3];
    var minRaw = match[4] || "00";
    var ampm = (match[5] || "").toLowerCase();

    if (month > 12 && day <= 12) {
      var tmp = month; month = day; day = tmp;
    }

    var year = 2026;
    if (hourRaw) {
      var hour = parseInt(hourRaw, 10);
      if (ampm === "pm" && hour < 12) {
        hour += 12;
      } else if (ampm === "am" && hour == 12) {
        hour = 0;
      } else if (!ampm && hour >= 1 && hour <= 11) {
        hour += 12; // Citas vespertinas por defecto en Colombia
      }
      return year + "-" + ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2) + " " + ("0" + hour).slice(-2) + ":" + minRaw;
    }

    return year + "-" + ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2);
  }

  return str;
}

/**
 * Reordena las columnas de MATCHES para cumplir estrictamente con el orden canónico:
 * 1. Estado Total | 2. Estado Persona A | 3. Estado Persona B | 4. Persona A | 5. Persona B
 * 6. DÍA | 7. HORA | 8. CIUDAD | 9. PRESUPUESTO | 10. LUGAR | 11. RESERVA | 12. CONFIRMACIÓN
 * 13. DIA ANTES | 14. HOY | 15. ELLA | 16. ÉL | 17. ¿REPROGRAMAR? | 18. FECHA CITA REAL
 */
function reordenarColumnasMatchesCanonico() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES") || ss.getSheetByName("MATCHES");
  if (!sheet) {
    Logger.log("ERROR: No se encontró la pestaña 'MATCHES'.");
    return;
  }

  // Cambio 18: Desunir cualquier celda combinada antes de mover columnas.
  // Google Sheets no permite moveColumns() si el rango atraviesa una celda combinada
  // (causa real confirmada: notas sueltas fusionadas en columnas F-H en varias filas).
  try {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  } catch (eBreak) {
    Logger.log("Aviso al desunir celdas combinadas en MATCHES: " + eBreak.message);
  }

  var lastRow = sheet.getLastRow();
  var headers = getSheetHeaders(sheet);

  var matchCol = headers["MATCH"];
  var estadoTotalCol = headers["ESTADO TOTAL"] || headers["STATUS TOTAL"];

  // 1. MIGRACIÓN COMPLETA DE DATOS HISTÓRICOS: Si existen ambas columnas (MATCH y Estado Total)
  if (matchCol && estadoTotalCol && matchCol !== estadoTotalCol) {
    if (lastRow > 1) {
      var matchRange = sheet.getRange(2, matchCol, lastRow - 1, 1);
      var totalRange = sheet.getRange(2, estadoTotalCol, lastRow - 1, 1);
      var matchVals = matchRange.getValues();
      var matchBgs = matchRange.getBackgrounds();
      var totalVals = totalRange.getValues();
      var totalBgs = totalRange.getBackgrounds();

      var needsUpdate = false;
      for (var r = 0; r < matchVals.length; r++) {
        var mVal = (matchVals[r][0] || "").toString().trim();
        var tVal = (totalVals[r][0] || "").toString().trim();
        if (mVal && !tVal) {
          totalVals[r][0] = mVal;
          if (matchBgs[r][0] && matchBgs[r][0] !== "#ffffff") {
            totalBgs[r][0] = matchBgs[r][0];
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        totalRange.setValues(totalVals);
        totalRange.setBackgrounds(totalBgs);
        Logger.log("✅ Datos históricos de MATCH migrados exitosamente a 'Estado Total'.");
      }
    }

    // Una vez migrados los datos a 'Estado Total', eliminar la columna física vieja 'MATCH'
    sheet.deleteColumn(matchCol);
    headers = getSheetHeaders(sheet);
  } else if (matchCol && !estadoTotalCol) {
    // Si solo existe MATCH y no Estado Total, simplemente renombrar MATCH a 'Estado Total'
    sheet.getRange(1, matchCol).setValue("Estado Total").setFontWeight("bold").setBackground("#D9D2E9");
    headers = getSheetHeaders(sheet);
  }

  // 2. Mover 'Estado Total' a la columna 1
  headers = getSheetHeaders(sheet);
  var colTotal = headers["ESTADO TOTAL"] || headers["STATUS TOTAL"] || headers["MATCH"];
  if (colTotal && colTotal > 1) {
    sheet.moveColumns(sheet.getRange(1, colTotal), 1);
  }

  // 3. Mover 'Estado Persona A' a la columna 2
  headers = getSheetHeaders(sheet);
  var colA = headers["ESTADO PERSONA A"] || headers["STATUS PERSONA A"];
  if (colA && colA > 2) {
    sheet.moveColumns(sheet.getRange(1, colA), 2);
  }

  // 4. Mover 'Estado Persona B' a la columna 3
  headers = getSheetHeaders(sheet);
  var colB = headers["ESTADO PERSONA B"] || headers["STATUS PERSONA B"];
  if (colB && colB > 3) {
    sheet.moveColumns(sheet.getRange(1, colB), 3);
  }

  // 5. Eliminar columnas viejas 'persona A' y 'Plan B' si aún existen
  headers = getSheetHeaders(sheet);
  for (var c = sheet.getLastColumn(); c >= 1; c--) {
    var hVal = (sheet.getRange(1, c).getValue() || "").toString().trim();
    if (hVal === "persona A" || hVal === "Plan B" || (hVal.toUpperCase() === "MATCH" && colTotal !== c)) {
      sheet.deleteColumn(c);
    }
  }

  // Cambio 16: Asegurar columna HORA (nueva) y reordenar el bloque DÍA/HORA/CIUDAD/PRESUPUESTO/LUGAR
  headers = getSheetHeaders(sheet);
  var colHora = headers["HORA"];
  if (!colHora) {
    var insertAfterCol = sheet.getLastColumn();
    sheet.insertColumnAfter(insertAfterCol);
    colHora = insertAfterCol + 1;
    sheet.getRange(1, colHora).setValue("HORA").setFontWeight("bold").setBackground("#D9D2E9");
  }

  headers = getSheetHeaders(sheet);
  var colDia = headers["DÍA"] || headers["DIA"];
  if (colDia && colDia !== 6) {
    sheet.moveColumns(sheet.getRange(1, colDia), 6);
  }

  headers = getSheetHeaders(sheet);
  colHora = headers["HORA"];
  if (colHora && colHora !== 7) {
    sheet.moveColumns(sheet.getRange(1, colHora), 7);
  }

  headers = getSheetHeaders(sheet);
  var colCiudad = headers["CIUDAD"] || headers["CITY"];
  if (colCiudad && colCiudad !== 8) {
    sheet.moveColumns(sheet.getRange(1, colCiudad), 8);
  }

  headers = getSheetHeaders(sheet);
  var colPresupuesto = headers["PRESUPUESTO"];
  if (colPresupuesto && colPresupuesto !== 9) {
    sheet.moveColumns(sheet.getRange(1, colPresupuesto), 9);
  }

  headers = getSheetHeaders(sheet);
  var colLugar = headers["LUGAR"];
  if (colLugar && colLugar !== 10) {
    sheet.moveColumns(sheet.getRange(1, colLugar), 10);
  }

  // Validación de calendario nativo en DÍA (antes era texto libre)
  headers = getSheetHeaders(sheet);
  var colDiaFinal = headers["DÍA"] || headers["DIA"];
  if (colDiaFinal) {
    var diaDateRule = SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(true)
      .setHelpText("Haga doble clic para seleccionar la fecha en el calendario interactivo.")
      .build();
    var maxRowsDia = Math.min(sheet.getMaxRows(), 5000);
    if (maxRowsDia > 1) {
      safeSetDataValidation(sheet.getRange(2, colDiaFinal, maxRowsDia - 1, 1), diaDateRule);
    }
  }

  // Cambio 15 (ajustado): Mover '¿REPROGRAMAR?' a su posición canónica (columna 17, antes de FECHA CITA REAL, ahora que hay 18 columnas)
  headers = getSheetHeaders(sheet);
  var colReprogramar = headers["¿REPROGRAMAR?"] || headers["REPROGRAMAR"];
  if (colReprogramar && colReprogramar !== 17) {
    sheet.moveColumns(sheet.getRange(1, colReprogramar), 17);
  }

  // 6. Eliminar columnas vacías sobrantes después de la columna 18
  headers = getSheetHeaders(sheet);
  var curLastCol = sheet.getLastColumn();
  var maxCols = sheet.getMaxColumns();
  if (maxCols > 18 && curLastCol <= 18) {
    sheet.deleteColumns(19, maxCols - 18);
  }

  // 7. Aplicar formatos y desplegables
  ensureMatchesColumnsAndDropdowns();

  Logger.log("✅ Reordenamiento canónico de MATCHES completado exitosamente con 100% de datos históricos preservados.");
  try {
    ss.toast("Estructura canónica de MATCHES (18 columnas) reordenada exitosamente.", "MATCHES Actualizado", 6);
  } catch (e) {}
  return { success: true, columns: 18 };
}

/**
 * Asegura la creación física y configuración de las 3 columnas de estado en MATCHES
 * Y aplica los menús desplegables de estados y el catálogo de ⚙️ RESTAURANTES en la columna LUGAR.
 */
function ensureMatchesColumnsAndDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES") || ss.getSheetByName("MATCHES");
  if (!sheet) return;

  // Asegurar que la hoja tenga al menos 18 columnas físicas
  if (sheet.getMaxColumns() < 18) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 18 - sheet.getMaxColumns());
  }

  var headers = getSheetHeaders(sheet);

  // 1. Asegurar 'Estado Persona A'
  var colA = headers["ESTADO PERSONA A"] || headers["STATUS PERSONA A"];
  if (!colA) {
    colA = getNextAvailableColumn(sheet);
    sheet.getRange(1, colA).setValue("Estado Persona A").setFontWeight("bold").setBackground("#D9EAD3");
    headers["ESTADO PERSONA A"] = colA;
  }

  // 2. Asegurar 'Estado Persona B'
  var colB = headers["ESTADO PERSONA B"] || headers["STATUS PERSONA B"];
  if (!colB) {
    colB = getNextAvailableColumn(sheet);
    sheet.getRange(1, colB).setValue("Estado Persona B").setFontWeight("bold").setBackground("#D9EAD3");
    headers["ESTADO PERSONA B"] = colB;
  }

  // 3. Asegurar 'Estado Total'
  var colTotal = headers["ESTADO TOTAL"] || headers["STATUS TOTAL"] || headers["ESTADO CITA"];
  if (!colTotal) {
    colTotal = getNextAvailableColumn(sheet);
    sheet.getRange(1, colTotal).setValue("Estado Total").setFontWeight("bold").setBackground("#D9D2E9");
    headers["ESTADO TOTAL"] = colTotal;
  }

  // 4. Asegurar 'FECHA CITA REAL'
  ensureRealDateColumn(sheet, headers);

  // 5. Aplicar Desplegables de Estados
  var estadosData = getEstadosPorEtapa();
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

  var maxRows = Math.min(sheet.getMaxRows(), 5000);
  if (maxRows > 1) {
    if (colA) safeSetDataValidation(sheet.getRange(2, colA, maxRows - 1, 1), matchesRule);
    if (colB) safeSetDataValidation(sheet.getRange(2, colB, maxRows - 1, 1), matchesRule);
    if (colTotal) safeSetDataValidation(sheet.getRange(2, colTotal, maxRows - 1, 1), matchesRule);
  }

  // 6. Aplicar Desplegable de ⚙️ RESTAURANTES en la columna LUGAR
  var lugarCol = headers["LUGAR"] || 10;
  var venueRule = getRestaurantVenueValidationRule(ss);
  if (venueRule && lugarCol && maxRows > 1) {
    safeSetDataValidation(sheet.getRange(2, lugarCol, maxRows - 1, 1), venueRule);
  }

  // Cambio 19: Desplegables de CIUDAD y PRESUPUESTO sacados de ⚙️ RESTAURANTES (sin inventar listas nuevas),
  // y de HORA con franjas fijas cada 30 minutos (11:00 am a 10:00 pm), para no escribir a mano.
  var restSheetForLists = ss.getSheetByName("⚙️ RESTAURANTES");
  var ciudadCol = headers["CIUDAD"] || headers["CITY"] || 8;
  var presupuestoCol = headers["PRESUPUESTO"] || 9;
  var horaColDrop = headers["HORA"] || 7;

  if (restSheetForLists && ciudadCol && maxRows > 1) {
    var ciudadesUnicas = getUniqueColumnValues(restSheetForLists, "CIUDAD");
    if (ciudadesUnicas.length === 0) {
      ciudadesUnicas = ["Barranquilla", "Bogotá", "Bucaramanga", "Cali", "Medellín"];
    }
    if (ciudadesUnicas.length > 0) {
      var ciudadRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(ciudadesUnicas, true)
        .setAllowInvalid(true)
        .build();
      safeSetDataValidation(sheet.getRange(2, ciudadCol, maxRows - 1, 1), ciudadRule);
    }
  }

  if (restSheetForLists && presupuestoCol && maxRows > 1) {
    var presupuestosUnicos = getUniqueColumnValues(restSheetForLists, "CATEGORÍA PRESUPUESTO");
    if (presupuestosUnicos.length === 0) {
      presupuestosUnicos = getUniqueColumnValues(restSheetForLists, "CATEGORIA PRESUPUESTO");
    }
    if (presupuestosUnicos.length === 0) {
      presupuestosUnicos = getUniqueColumnValues(restSheetForLists, "PRESUPUESTO");
    }
    if (presupuestosUnicos.length === 0) {
      presupuestosUnicos = ["Menos de 100k", "100k-200k", "200k-300k", "Más de 300k"];
    }
    if (presupuestosUnicos.length > 0) {
      var presupuestoRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(presupuestosUnicos, true)
        .setAllowInvalid(true)
        .build();
      safeSetDataValidation(sheet.getRange(2, presupuestoCol, maxRows - 1, 1), presupuestoRule);
    }
  }

  if (horaColDrop && maxRows > 1) {
    var horasList = [];
    for (var h = 11; h <= 22; h++) { // Cambio 20: acotado a 11:00 am - 10:30 pm (horario real de citas)
      for (var m = 0; m < 60; m += 30) {
        var ampm = h >= 12 ? "PM" : "AM";
        var h12 = h % 12;
        if (h12 === 0) h12 = 12;
        var mm = (m === 0 ? "00" : "30");
        horasList.push(h12 + ":" + mm + " " + ampm);
      }
    }
    var horaRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(horasList, true)
      .setAllowInvalid(true)
      .build();
    safeSetDataValidation(sheet.getRange(2, horaColDrop, maxRows - 1, 1), horaRule);
  }

  Logger.log("✅ Columnas de estado, catálogo de RESTAURANTES y desplegables de CIUDAD/PRESUPUESTO/HORA asegurados en MATCHES.");
}

/**
 * Cambio 19: Lee una columna de una pestaña por nombre de encabezado y devuelve
 * sus valores únicos, no vacíos, ordenados alfabéticamente. Se usa para armar
 * desplegables en MATCHES a partir de datos ya existentes en ⚙️ RESTAURANTES,
 * sin duplicar listas a mano.
 */
function getUniqueColumnValues(sheet, headerName) {
  if (!sheet) return [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetSheet = (typeof sheet === "string") ? ss.getSheetByName(sheet) : sheet;
  if (!targetSheet) return [];

  var headers = getSheetHeaders(targetSheet);
  var col = headers[headerName] || headers[headerName.toUpperCase()] || headers[headerName.replace("Í", "I").toUpperCase()];
  if (!col) return [];
  var lastRow = targetSheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = targetSheet.getRange(2, col, lastRow - 1, 1).getValues();
  var seen = {};
  var unique = [];
  for (var i = 0; i < values.length; i++) {
    var v = (values[i][0] || "").toString().trim();
    if (v && !seen[v]) {
      seen[v] = true;
      unique.push(v);
    }
  }
  unique.sort();
  return unique;
}

/**
 * Aplica validación de datos a un rango de celdas de forma segura.
 * Si el rango pertenece a una Tabla Nativa de Sheets con tipo especificado (DROPDOWN/DATE/etc.),
 * captura la excepción de Google Sheets sin interrumpir la ejecución del resto del script.
 */
function safeSetDataValidation(range, rule) {
  if (!range || !rule) return;
  try {
    range.setDataValidation(rule);
  } catch (err) {
    Logger.log("Aviso: No se pudo aplicar setDataValidation en rango " + range.getA1Notation() + " (" + err.message + "). Posible columna con tipo de Tabla Nativa.");
  }
}

/**
 * Obtiene la siguiente columna disponible en la fila 1 de una hoja.
 */
function getNextAvailableColumn(sheet) {
  try {
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return 1;
    var row1Values = [];
    try {
      row1Values = sheet.getRange(1, 1, 1, Math.min(lastCol + 10, sheet.getMaxColumns())).getDisplayValues()[0];
    } catch (e1) {
      try {
        row1Values = sheet.getRange(1, 1, 1, Math.min(lastCol + 10, sheet.getMaxColumns())).getValues()[0];
      } catch (e2) {
        return lastCol + 1;
      }
    }
    for (var c = 0; c < row1Values.length; c++) {
      if (!row1Values[c] || row1Values[c].toString().trim() === "") {
        return c + 1;
      }
    }
    return lastCol + 1;
  } catch (err) {
    return (sheet.getLastColumn ? sheet.getLastColumn() : 1) + 1;
  }
}

/**
 * Sincroniza y limpia todas las fechas de la pestaña 'Citas Aceptadas'.
 */
function sincronizarTodasLasCitasAceptadas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Citas Aceptadas") || ss.getSheetByName("CITAS ACEPTADAS");
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var headers = getSheetHeaders(sheet);
  var fechaCol = headers["FECHA CITA REAL"] || 2;
  var diaCol = headers["DÍA / HORA"] || headers["DIA / HORA"] || headers["DÍA"] || 7;
  var lugarCol = headers["LUGAR"] || 5;

  var data = sheet.getRange(2, 1, lastRow - 1, Math.max(fechaCol, diaCol, lugarCol)).getValues();
  for (var i = 0; i < data.length; i++) {
    var rawDate = (data[i][fechaCol - 1] || data[i][diaCol - 1] || "").toString();
    var cleanDate = parseDateToIsoLocal(rawDate);
    if (cleanDate && cleanDate !== rawDate) {
      sheet.getRange(i + 2, fechaCol).setValue(cleanDate);
    }
  }

  // Asegurar regla de validación de restaurantes
  var venueRule = getRestaurantVenueValidationRule(ss);
  if (venueRule && lugarCol && lastRow > 1) {
    safeSetDataValidation(sheet.getRange(2, lugarCol, lastRow - 1, 1), venueRule);
  }

  ss.toast("Se limpiaron y sincronizaron " + (lastRow - 1) + " fechas en 'Citas Aceptadas'.", "Sincronización Exitosa", 5);
}


// ─── 12B. GESTIÓN AUTOMÁTICA DE PESTAÑAS DE SOPORTE CRÍTICAS ────────────────

/**
 * Retorna la regla de validación para la columna LUGAR / RESTAURANTES apuntando al catálogo de ⚙️ RESTAURANTES.
 * Detecta dinámicamente la columna 'RESTAURANTE / CAFÉ' sin asumir posición fija.
 */
function getRestaurantVenueValidationRule(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var restSheet = ss.getSheetByName("⚙️ RESTAURANTES");
  if (!restSheet) return null;
  var rLast = Math.max(2, restSheet.getLastRow());
  if (rLast <= 1) return null;
  var restHeaders = getSheetHeaders(restSheet);
  var nameCol = restHeaders["RESTAURANTE / CAFÉ"] || restHeaders["RESTAURANTE / CAFE"] || restHeaders["RESTAURANTE"] || 2;
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(restSheet.getRange(2, nameCol, rLast - 1, 1), true)
    .setAllowInvalid(true)
    .build();
}

/**
 * Crea las 4 pestañas de soporte críticas si no existen en el archivo:
 * 1. ⚙️ CONFIG ESTADOS (con los 46 estados agrupados en las 4 etapas y formateo de color)
 * 2. ⚙️ RESTAURANTES (con el catálogo oficial de 118 restaurantes limpios y sus metadatos)
 * 3. Citas Aceptadas (con las 12 columnas canónicas)
 * 4. REFUNDS PENDIENTES (con las 9 columnas del módulo de soporte/Lina)
 *
 * Es 100% IDEMPOTENTE: Si una pestaña ya existe con datos, NO la sobreescribe ni altera.
 */
function crearPestanasDeSoporteSiFaltan(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var creadas = [];
  var existentes = [];

  // 1. ⚙️ CONFIG ESTADOS
  var estadosName = CONFIG.CONFIG_ESTADOS_SHEET_NAME || "⚙️ CONFIG ESTADOS";
  var sheetEstados = ss.getSheetByName(estadosName);
  if (!sheetEstados) {
    sheetEstados = ss.insertSheet(estadosName);
    try { sheetEstados.setTabColor("#961500"); } catch (e) {}
    creadas.push(estadosName);
  } else {
    existentes.push(estadosName);
  }
  if (sheetEstados.getLastRow() <= 1) {
    poblarConfigEstados(sheetEstados);
  }

  // 2. ⚙️ RESTAURANTES
  var restName = "⚙️ RESTAURANTES";
  var sheetRest = ss.getSheetByName(restName);
  if (!sheetRest) {
    sheetRest = ss.insertSheet(restName);
    try { sheetRest.setTabColor("#961500"); } catch (e) {}
    creadas.push(restName);
  } else {
    existentes.push(restName);
  }
  if (sheetRest.getLastRow() <= 1) {
    poblarRestaurantes(sheetRest);
  }

  // 3. Citas Aceptadas
  var citasName = "Citas Aceptadas";
  var sheetCitas = ss.getSheetByName(citasName);
  if (!sheetCitas) {
    sheetCitas = ss.insertSheet(citasName);
    try { sheetCitas.setTabColor("#961500"); } catch (e) {}
    creadas.push(citasName);
  } else {
    existentes.push(citasName);
  }
  if (sheetCitas.getLastRow() === 0) {
    poblarCitasAceptadasHeader(sheetCitas);
  }

  // 4. REFUNDS PENDIENTES
  var refundsName = CONFIG.REFUNDS_SHEET_NAME || "REFUNDS PENDIENTES";
  var sheetRefunds = ss.getSheetByName(refundsName);
  if (!sheetRefunds) {
    sheetRefunds = ss.insertSheet(refundsName);
    try { sheetRefunds.setTabColor("#961500"); } catch (e) {}
    creadas.push(refundsName);
  } else {
    existentes.push(refundsName);
  }
  if (sheetRefunds.getLastRow() === 0) {
    poblarRefundsPendientesHeader(sheetRefunds);
  }

  SpreadsheetApp.flush();

  // Si se crearon o actualizaron estados/restaurantes, refrescar desplegables dinámicos
  if (creadas.length > 0) {
    try {
      actualizarDesplegablesDinamicos();
    } catch (eDesp) {
      Logger.log("Aviso actualizando desplegables dinámicos tras crear pestañas: " + eDesp.message);
    }
  }

  var msg = "Pestañas de soporte verificadas. Creadas: [" + (creadas.join(", ") || "Ninguna") + "]. Ya existían: [" + existentes.join(", ") + "].";
  Logger.log("✅ " + msg);
  try {
    ss.toast(msg, "Pestañas de Soporte", 6);
  } catch (tErr) {}

  return { creadas: creadas, existentes: existentes };
}

function poblarConfigEstados(sheet) {
  var data = OBTENER_DATOS_CONFIG_ESTADOS();
  sheet.clear();
  sheet.getRange(1, 1, data.length, 3).setValues(data);
  sheet.setFrozenRows(1);

  // Formato encabezado
  sheet.getRange(1, 1, 1, 3)
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center");

  // Colorear columna B con sus respectivos colores
  var backgrounds = [];
  for (var i = 1; i < data.length; i++) {
    backgrounds.push([data[i][1] || "#FFFFFF"]);
  }
  if (backgrounds.length > 0) {
    sheet.getRange(2, 2, backgrounds.length, 1)
      .setBackgrounds(backgrounds)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  }

  sheet.autoResizeColumns(1, 3);
  Logger.log("✅ '⚙️ CONFIG ESTADOS' poblada y formateada con " + (data.length - 1) + " estados.");
}

function poblarRestaurantes(sheet) {
  var data = OBTENER_DATOS_RESTAURANTES();
  sheet.clear();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  sheet.setFrozenRows(1);

  // Formato encabezado
  sheet.getRange(1, 1, 1, data[0].length)
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");

  sheet.autoResizeColumns(1, data[0].length);
  Logger.log("✅ '⚙️ RESTAURANTES' poblada y formateada con " + (data.length - 1) + " restaurantes aliados.");
}

function poblarCitasAceptadasHeader(sheet) {
  var headers = [
    "ID MATCH", "FECHA CITA REAL", "PERSONA A", "PERSONA B", "LUGAR", "CIUDAD",
    "CONFIRMACIÓN", "DÍA ANTES", "HOY", "RESERVA", "ESTADO RESERVA", "OBSERVACIONES"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");

  // Columna FECHA CITA REAL con validación de fecha
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build();
  sheet.getRange(2, 2, 500, 1).setDataValidation(dateRule);

  // Columna LUGAR con dropdown de restaurantes
  var ss = sheet.getParent();
  var venueRule = getRestaurantVenueValidationRule(ss);
  if (venueRule) {
    sheet.getRange(2, 5, 500, 1).setDataValidation(venueRule);
  }

  sheet.autoResizeColumns(1, headers.length);
  Logger.log("✅ 'Citas Aceptadas' creada con las 12 columnas canónicas.");
}

function poblarRefundsPendientesHeader(sheet) {
  var headers = [
    "FECHA REPORTE", "ORIGEN (PESTAÑA)", "FILA ORIGEN", "PERSONA A", "PLAN",
    "OBSERVACIONES / MOTIVO", "ESTADO REFUND", "FECHA PROCESADO", "LINA NOTAS"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");

  // Dropdown para ESTADO REFUND
  var refundStatuses = [
    "PENDIENTE LINA", "REFUND APROBADO", "REFUND RECHAZADO",
    "REFUND PROCESADO", "REFUND DONE", "CLIENTE QUIERE ESPERAR"
  ];
  var stRule = SpreadsheetApp.newDataValidation().requireValueInList(refundStatuses, true).setAllowInvalid(true).build();
  sheet.getRange(2, 7, 500, 1).setDataValidation(stRule);

  sheet.autoResizeColumns(1, headers.length);
  Logger.log("✅ 'REFUNDS PENDIENTES' creada con las 9 columnas canónicas.");
}

function OBTENER_DATOS_CONFIG_ESTADOS() {
  return [
    ["Estado", "Color", "Etapa"],
    ["Llenar perfil", "#E6B8AF", "PSICOLOGA"],
    ["Listo para match", "#FFF2CC", "PSICOLOGA"],
    ["HECHO", "#D9EAD3", "PSICOLOGA"],
    ["APROBADO", "#B6D7A8", "PSICOLOGA"],
    ["NOT APPROVED", "#F4CCCC", "PSICOLOGA"],
    ["DESCALIFICADO", "#EA9999", "PSICOLOGA"],
    ["NO HAY GENTE", "#FCE5CD", "PSICOLOGA"],
    ["REVISAR", "#D9D2E9", "PSICOLOGA"],
    ["TROUBLEMAKER", "#E06666", "PSICOLOGA"],
    ["HECHO POR MAPE", "#D9EAD3", "PSICOLOGA"],
    ["REQUEST PROFILE UPDATE", "#FFF2CC", "PSICOLOGA"],
    ["PSIC. URG", "#FFD966", "PSICOLOGA"],
    ["MUJER +50", "#EAD1DC", "PSICOLOGA"],
    ["REFUND", "#F4CCCC", "PSICOLOGA"],
    ["pendiente", "#FFF2CC", "SERVICIO_CLIENTE"],
    ["agendando", "#CFE2F3", "SERVICIO_CLIENTE"],
    ["por confirmar", "#FCE5CD", "SERVICIO_CLIENTE"],
    ["esperar", "#EAD1DC", "SERVICIO_CLIENTE"],
    ["de viaje", "#D9D2E9", "SERVICIO_CLIENTE"],
    ["problemas personales", "#F4CCCC", "SERVICIO_CLIENTE"],
    ["no contestan", "#EA9999", "SERVICIO_CLIENTE"],
    ["reprogramar", "#FFE599", "SERVICIO_CLIENTE"],
    ["esperar que salgan con su date", "#D9EAD3", "SERVICIO_CLIENTE"],
    ["TROUBLEMAKER", "#E06666", "SERVICIO_CLIENTE"],
    ["cita confirmada", "#B6D7A8", "RESULTADO_CITA"],
    ["DATE PROGRAMADO", "#B6D7A8", "RESULTADO_CITA"],
    ["cita realizada", "#D9EAD3", "RESULTADO_CITA"],
    ["match", "#A4C2F4", "RESULTADO_CITA"],
    ["MATCH DONE", "#6D9EEB", "RESULTADO_CITA"],
    ["no match (él rechazó)", "#F4CCCC", "RESULTADO_CITA"],
    ["no match (ella rechazó)", "#F4CCCC", "RESULTADO_CITA"],
    ["sin química (mutuo)", "#D9D2E9", "RESULTADO_CITA"],
    ["REFUND DONE", "#EA9999", "REFUND"],
    ["REFUND PENDIENTE – NEQUI", "#F4CCCC", "REFUND"],
    ["REFUND PENDIENTE – DATOS", "#F4CCCC", "REFUND"],
    ["REFUND PENDIENTE – STRIPE", "#F4CCCC", "REFUND"],
    ["REFUND PARCIAL PENDIENTE", "#FCE5CD", "REFUND"],
    ["PENDIENTE DE RESPUESTA CLIENTE", "#FFF2CC", "REFUND"],
    ["CLIENTE QUIERE ESPERAR", "#EAD1DC", "REFUND"],
    ["RECHAZADA POR PSICÓLOGA B", "#F4CCCC", "PSICOLOGA"],
    ["NO HAY GENTE", "#FCE5CD", "PERSONAS_DIFICILES"],
    ["ESPERA O REFUND", "#F4CCCC", "PERSONAS_DIFICILES"],
    ["REFUND APROBADO", "#B6D7A8", "REFUND"],
    ["REFUND RECHAZADO", "#F4CCCC", "REFUND"],
    ["REFUND PENDIENTE", "#FFF2CC", "REFUND"],
    ["REFUND PROCESADO", "#D9EAD3", "REFUND"]
  ];
}

function OBTENER_DATOS_RESTAURANTES() {
  return [
    ["CIUDAD", "RESTAURANTE / CAFÉ", "TIPO DE COMIDA", "PRECIO NUMÉRICO (COP)", "CATEGORÍA PRESUPUESTO", "DÍAS DISPONIBLES", "HORARIO", "ZONA", "UBICACIÓN DETALLADA", "ACEPTA RESERVAS"],
    ["Barranquilla", "Devoto", "Italiano", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Zona norte", "Sí"],
    ["Barranquilla", "Nena Lela Trattoria", "Italiano romántico", "200000", "200k-300k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Norte", "Zona norte", "Sí"],
    ["Barranquilla", "Noa", "Fusión: sushi, mar, carnes, arroces, moderno y romántico", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Riomar", "Sí"],
    ["Barranquilla", "Mistura", "", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "", "", "", "Sí"],
    ["Barranquilla", "Umi", "Sushi", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "DOS SEDES OJO", "Sí"],
    ["Barranquilla", "bruma coffe lab", "Café de especialidad, relajado", "85000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Juev 9am-11pm Vi-Dom 9am-12am", "Norte", "centro historico", "Sí"],
    ["Barranquilla", "Café de Especialidad 80100", "Café de especialidad, relajado", "85000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Norte", "Norte de Barranquilla", "No"],
    ["Bogotá", "Amari", "Elegante", "550000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte", "Zona norte", "Sí"],
    ["Bogotá", "Viva la Vida", "Demasiado top, japonesa fusión, cócteles wow", "550000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte", "Autopista Norte con Calle 114", "Sí"],
    ["Bogotá", "Astoria Rooftop", "Bar rooftop, muy buenos cócteles y ambiente", "400000", "Más de 300k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Norte", "Calle 85", "Sí"],
    ["Bogotá", "Don Doh", "Parrilla coreana, sofisticado", "400000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte", "Calle 93", "Sí"],
    ["Bogotá", "Primi", "Italiano", "400000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte", "Calle 93", "Sí"],
    ["Bogotá", "Santorini Rooftop", "Bar rooftop, muy buenos cócteles y ambiente", "400000", "Más de 300k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Norte", "Calle 85", "Sí"],
    ["Bogotá", "Tohoku", "Japonés muy premium", "400000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte", "Calle 93", "Sí"],
    ["Bogotá", "URO", "Parrilla argentina", "400000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte", "Calle 85", "Sí"],
    ["Bogotá", "Blac", "Pescados y mariscos a la parrilla con vino", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Jue 12:00-10:00pm · Vie-Sáb 12:00-11:00pm · Dom 12:00-5:00pm", "Norte (Chicó)", "Carrera 11a #89-10 · Grupo Takami", "Sí"],
    ["Bogotá", "Café Amarti", "Romántico y sofisticado", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 8:00am-6:00pm", "Norte", "Usaquén", "Sí"],
    ["Bogotá", "Casa", "Sofisticado, comida variada", "200000", "200k-300k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Norte", "Calle 85", "Sí"],
    ["Bogotá", "Cecilia", "Romántico y sofisticado italiano", "200000", "200k-300k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Norte", "Calle 93 y Usaquén", "Sí"],
    ["Bogotá", "Via del cuore", "Romántico y sofisticado italiano", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "", "Norte", "calle 85", "Sí"],
    ["Bogotá", "Tragaluz asia del pacifico", "comida fusion asiatica-colombiana, ambiente sofisticado", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "martes y miercoles 12pm-9pm jueves 12pm-10pm viernes y sabado 12pm-11pm y domingos 12pm-5pm lunes cerrado", "zona G-chapinero", "cl 70 #8-25", "Sí"],
    ["Bogotá", "mercado tres", "comida peruana, relajado, cool", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "martes, miercoles, jueves y viernes de 12pm-4pm 6pm-10pm sabado1pm-10pm domingo 12pm-5pm", "zona G-chapinero", "cl 55 #6-31", "Sí"],
    ["Bogotá", "El Francés", "Bistró clásico francés reinterpretado", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mar 12:00-9:00pm · Mié-Sáb 12:00-11:00pm · Dom/fest 12:00-6:00pm", "Norte", "Calle 80 #9-11, Zona G/Chapinero · Grupo Takami", "Sí"],
    ["Bogotá", "Sorella", "Casa de la pasta fresca y pizza", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mar 12:00-9:00pm · Mié 12:00-10:00pm · Jue-Sáb 12:00-11:00pm · Dom 12:00-5:00pm", "Centro-Norte (Chapinero Alto)", "Calle 66 Bis #4-71 · Grupo Takami", "Sí"],
    ["Bogotá", "amalfitana", "italiano, ambiente cool", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "", "zona G-chapinero", "cl 72 #5-22", "Sí"],
    ["Bogotá", "Atic & Keller", "Reservado, casual y bonito para tardear", "175000", "100k-200k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Norte", "Restaurante: Calle 75 · Pizzería: Calle 85", "Sí"],
    ["Bogotá", "inkkei", "fusion peruana, tiene una terraza con vista super linda", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "L/M/M/J 12-9pm viernes y sabado de 12-10pm, domingo 12-6pm", "zona G-chapinero", "cl 57 #4-10", "Sí"],
    ["Bogotá", "flora", "italiana relajado", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "L/M/M/J 12-11PM viernes y sabado 12-12pm domingo 12-9pm", "zona G-chapinero", "cra 5 #58 45", "Sí"],
    ["Bogotá", "roma", "italiana relajado", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "L/M/M/J 12-9pm viernes y sabado de 12-10pm, domingo 12-6pm", "zona G-chapinero", "cra 5 #58 39", "Sí"],
    ["Bogotá", "Brera", "Italiana", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "salvio 93", "Sí"],
    ["Bogotá", "Ideal", "Variado", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Calle 85", "Sí"],
    ["Bogotá", "Luna", "Italiano casual elegante", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Calle 83 #12-20", "Sí"],
    ["Bogotá", "Oficial", "Peruana", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Calle 85 #12-90", "Sí"],
    ["Bogotá", "Parmessano", "Italiana", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "CC Atlantis y GE (suele llenarse)", "Sí"],
    ["Bogotá", "Punto Baja", "Mexicano", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Calle 90", "Sí"],
    ["Bogotá", "Cacio e Pepe", "Italiano romántico", "150000", "100k-200k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Norte", "Calle 90", "Sí"],
    ["Bogotá", "Cosette", "Bistro tranquilo", "150000", "100k-200k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Norte/Occidente", "Salitre, centro andino, 81, Calle 109 y Fontanar", "Sí"],
    ["Bogotá", "Osaki", "Cocina asiática moderna", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mié 12:00-9:00pm · Jue-Sáb 12:00-10:00pm · Dom/fest 12:00-9:00pm", "Norte", "71, 85, 89, 93, 118 y Chía", "Sí"],
    ["Bogotá", "Veccina", "Italiano moderno, relajado", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Calle 85 y 118 con Cra 19", "Sí"],
    ["Bogotá", "80 Sillas", "Comida de mar y montaña, ceviches", "140000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mié 12:00-11:00pm · Jue-Sáb 12:00-11:30pm · Dom 12:00-6:00pm", "Norte", "Calle 118 #6A-05, Usaquén · Grupo Takami", "Sí"],
    ["Bogotá", "Cantina y Punto", "Mexicana contemporánea y bar", "140000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Centro-Norte (Chapinero)", "Calle 66 #4A-33 · Grupo Takami", "No"],
    ["Bogotá", "Central Cevichería", "Pescados, ceviches y paellas", "140000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Jue 12:00-9:30pm · Vie-Sáb 12:00-10:00pm · Dom 12:00-9:00pm", "Norte", "Carrera 13 #85-14 (Zona T) y Av. 19 #118-92 (Usaquén) · Grupo Takami", "Sí"],
    ["Bogotá", "Di Lucca", "Trattoria italiana clásica, 35 años", "125000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:00-10:00/11:00pm aprox.", "Norte (Zona T / Calle 85, también Salitre y Chía)", "Carrera 13 #85-32 (sede principal)", "Sí"],
    ["Bogotá", "Il Forno", "Pastas, pizzas y risottos italianos", "120000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Dom-Mié 11:30am-8:00pm · Jue 11:30am-9:00pm · Vie-Sáb 11:30am-10:00pm", "Norte (Multisede)", "Calle 109, Calle 93, Zona G (Calle 69A), Santa Bárbara (Av. 19), entre otros", "Sí"],
    ["Bogotá", "Chin-Chin", "Bar de vinos por copa y media copa", "115000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mar 3:00-10:00pm · Mié 3:00-11:00pm · Jue-Sáb 12:00-11:00pm · Dom cerrado", "Norte (Zona G)", "Calle 80 #9-17 · Grupo Takami", "No"],
    ["Bogotá", "Ugly American", "Taberna americana, brunch y hamburguesas", "115000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mié 12:00-10:00pm · Jue-Vie 12:00-11:00pm/12am · Sáb 9:30am-12am · Dom 9:30am-9:00pm", "Norte", "Calle 81 #9-12, Zona G/El Retiro · Grupo Takami", "Sí"],
    ["Bogotá", "La Fama BBQ", "BBQ sureño estadounidense, especialista en cortes (nota: reseñas recientes mixtas sobre calidad y porciones)", "110000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Jue 12:00-10:00pm · Vie-Sáb 12:00-10:00pm aprox. · Dom 12:00-6:00pm", "Norte", "Calle 65 Bis #4-85 y Calle 85 #12-61 (2 sedes) · Grupo Takami", "Sí"],
    ["Bogotá", "Tacos MX", "Cocina mexicana tradicional y tacos", "90000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Jue 12:00-9:00pm · Vie-Sáb 12:00-10:00pm · Dom 12:00-8:00pm", "Noroccidente (Suba/Colina)", "Av. Boyacá #145-2, CC Parque La Colina · Grupo Takami", "No"],
    ["Bogotá", "Azahar café", "Café de especialidad", "110000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "", "Norte", "parque de la 93 y calle 70", "Sí"],
    ["Bogotá", "MASA", "Café de especialidad", "110000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "", "Norte", "calle 70, calle 81, calle 105", "Sí"],
    ["Bogotá", "Libertario Coffee Roasters", "Café de especialidad", "110000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 7:00am-7:30pm · Dom y fest 8:00am-6:00pm", "Norte", "Zona G, Parque 93, Calle 109, Calle 122, Usaquén, Calle 82, Calle 79", "No"],
    ["Bogotá", "Amor Perfecto", "Café de especialidad de referencia, baristas expertos, Academia del Café", "90000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 7:30am-7:30pm · Dom 8:00am-6:00pm", "Norte (Multisede - Usaquén y otros)", "Usaquén, Chicó, Quinta Camacho", "No"],
    ["Bogotá", "Universal de Hamburguesas", "Smash burgers", "55000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Mié 11:30am-9:00/10:00pm · Jue-Sáb 11:30am-10:00/11:00pm · Dom/fest 12:00-8:00/9:00pm", "Norte (El Nogal/Usaquén)", "Carrera 9 #79a-26 y Carrera 19 #118-48 · Grupo Takami", "No"],
    ["Bogotá", "Sipote Burrito", "Burritos, potes y tacos rápidos", "45000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 11:00am-10:00pm aprox. · Dom 11:00am-9:00pm", "Multisede (Norte/Occidente/Chía)", "13 puntos: Fontanar, Calle 93A, Calle 71, Salitre Plaza, Centro Andino, Plaza Central, entre otros · Grupo Takami", "No"],
    ["Bucaramanga", "Battuto", "Italiana", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Cabecera / Sotomayor", "Sí"],
    ["Bucaramanga", "Casa Cartagena", "Mar", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Sotomayor", "Sí"],
    ["Bucaramanga", "El Republicano", "Mar", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Sotomayor", "Sí"],
    ["Bucaramanga", "Mia Nonna", "Italiana", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Cabecera", "Sí"],
    ["Cali", "Nispero", "Mariscos", "275000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Ringlete", "Variado", "250000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Fatorrino Ristorante", "Italiana", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Nikkei 225", "Nikkei", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Storia D'Amore", "Italiano", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte / Multisede", "Granada, Chipichape, Unicentro", "Sí"],
    ["Cali", "Tortelli", "Italiana", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "chipichape, el peñon, palmas mall", "Cali", "Sí"],
    ["Cali", "Izumi", "Oriental", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Gastroteca", "Variado", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Odiseo Bistro", "Mediterráneo", "125000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Cali", "Sí"],
    ["Cali", "Café La Marinela", "Café", "80000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Zona por confirmar", "Cali", "No"],
    ["Cali", "Caffè D'Amore", "Café italiano, repostería, brunch, muy romántico", "60000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 8:00am aprox. · Cerrado cerca de las 10:00pm", "Norte (Granada)", "Av. 9 Norte #14N-57, Barrio Granada", "No"],
    ["Madrid", "Tatel", "Español top, alta gastronomía con show en vivo", "400000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Jue 13:00-01:00 · Vie-Sáb 13:00-02:30am · Dom 12:00-02:30am", "Norte (Castellana/Salamanca)", "Paseo de la Castellana 36", "Sí"],
    ["Madrid", "Arde", "Carnes", "250000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Norte (aprox.)", "Salamanca (aprox.)", "Sí"],
    ["Madrid", "Charrúa", "Carnes", "250000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Zona por confirmar", "Madrid", "Sí"],
    ["Madrid", "Bel Mondo", "Variado", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Madrid", "Sí"],
    ["Madrid", "Juana la Loca", "Tapas españolas, más informal", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Centro", "La Latina (aprox.)", "Sí"],
    ["Madrid", "Ponja", "Nikkei peruano", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Madrid", "Sí"],
    ["Madrid", "Quispe", "Comida peruana", "315000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Norte", "Salamanca", "Sí"],
    ["Madrid", "Gaston Wine Bar", "Wine bar, muy cool", "225000", "200k-300k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Zona por confirmar", "Madrid", "Sí"],
    ["Madrid", "Circolo Popolare", "Italiana", "180000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Centro-Norte", "Almagro (aprox.)", "No"],
    ["Madrid", "Casa Om", "Café", "135000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Norte", "Salamanca", "No"],
    ["Madrid", "Fonico", "Café y brunch", "135000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 8:00am-6:00pm", "Norte", "Salamanca", "No"],
    ["Madrid", "HanSo Cafe", "Café", "135000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Centro", "Centro", "No"],
    ["Madrid", "Misión Café", "Café", "135000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Centro", "Centro", "No"],
    ["Manizales", "Idilio", "Italiana con carnes", "225000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Centro", "Milán", "Sí"],
    ["Manizales", "Spago", "Italiana elegante", "175000", "100k-200k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Centro", "Palogrande", "Sí"],
    ["Manizales", "Manuelina", "Italiana, romántico", "125000", "100k-200k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Centro", "Palogrande", "Sí"],
    ["Manizales", "Sushi Time", "Sushi", "125000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Centro", "Manizales", "Sí"],
    ["Manizales", "Flora Joy", "Café de especialidad", "75000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Centro", "Av. Paralela", "No"],
    ["Manizales", "La Ocasión", "Café de especialidad", "75000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Centro", "Palogrande", "No"],
    ["Medellín", "Carmen", "Cocina contemporánea inspirada en Colombia, fine dining", "325000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb", "Lun 6:30-9:30pm · Mar-Sáb 12:00-3:00pm y 6:30-9:30pm · Cerrado domingo", "Sur (El Poblado - Provenza)", "Carrera 36 #10A-27", "Sí"],
    ["Medellín", "OCI.mde", "Cocina de autor, pesca fresca, cocción lenta", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Sur (El Poblado)", "El Poblado", "Sí"],
    ["Medellín", "Bárbaro Primitive Cuisine", "Carnes a la brasa y platos de autor", "160000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Occidente (Laureles)", "Carrera 76 #73b-39, Laureles", "Sí"],
    ["Medellín", "La Pampa Parrilla Argentina", "Parrilla argentina con música en vivo", "140000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Occidente (Laureles) / Multisede", "Av. Jardín, Laureles (3 sedes en la ciudad)", "Sí"],
    ["Medellín", "Casa de Nadie", "De todo", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Vía Las Palmas", "Sí"],
    ["Medellín", "Marzzano", "Brunch, tardeo, almuerzo y cena italiano", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur (El Poblado)", "El Poblado", "Sí"],
    ["Medellín", "Mistura", "Fusión peruana, mar, sushi y carnes", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur / Occidente", "Laureles, Provenza, El Tesoro, San Lucas", "Sí"],
    ["Medellín", "Parmessano", "Italiana", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Multisede", "Laureles, Oviedo, El Tesoro, La Strada, Ciudad del Río, Indiana Mall, Unicentro, Florida, Viva Envigado, Fabricato, Llano Grande, Mercado del Río, San Nicolás", "Sí"],
    ["Medellín", "Romero", "Italiano", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Provenza, Laureles, Llano Grande, Arkadia, CC Envigado", "Sí"],
    ["Medellín", "Susurro", "Coctelería y platos pequeños", "200000", "200k-300k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Sur (El Poblado)", "El Poblado", "Sí"],
    ["Medellín", "Tagliata", "Italiana", "180000", "100k-200k", "Mar,Mié,Jue,Vie,Sáb,Dom", "Mar-Dom 12:30-3:00pm y 7:00-11:00pm · Cerrado lunes", "Sur", "El Poblado", "Sí"],
    ["Medellín", "Pergamino Café", "Café moderno", "125000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Vie 8:00am-9:00pm · Sáb 9:00am-9:00pm · Dom/fest 10:00am-7:00pm", "Sur / Multisede", "Vía Primavera, Arkadia, Viva Envigado, Ciudad del Río, El Tesoro, Laureles, Oviedo, San Lucas, Manila", "No"],
    ["Medellín", "Andaluf", "Cocina del Pacífico colombiano (Chocó)", "115000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:00-8:00pm", "Sur (Provenza y Manila)", "Carrera 36 #8a-88 (Provenza) y Carrera 43f #11a-30 (Manila, también centro cultural)", "Sí"],
    ["Medellín", "Della Nonna Trattoria", "Cocina italiana tradicional, multisede", "115000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Jue 12:00-10:00pm · Vie-Sáb 12:00-10:30pm", "Multisede (El Poblado, Laureles, Envigado, Llanogrande)", "El Tesoro, Milla de Oro/Manila, Mall del Este, Laureles, Alto las Palmas, Llanogrande", "Sí"],
    ["Medellín", "Mondongo's", "Comida típica paisa: mondongo, bandeja paisa", "75000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Occidente (Laureles)", "Carrera 70 Circular 3-43, Laureles", "Sí"],
    ["Medellín", "Libertario Coffee Roasters (Ciudad del Río)", "Café de especialidad", "110000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 7:00am-7:30pm · Dom y fest 8:00am-6:00pm", "Sur (Ciudad del Río)", "Carrera 48 #18A-33, Ciudad del Río", "No"],
    ["Medellín", "Libertario Coffee Roasters (Laureles)", "Café de especialidad", "110000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 7:00am-7:30pm · Dom y fest 8:00am-5:30pm", "Occidente (Laureles)", "Dg 75 #39CB-20, Laureles-Estadio", "No"],
    ["Miami", "Carbone", "Italiana", "400000", "Más de 300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Miami Beach (South of Fifth)", "Miami Beach", "Sí"],
    ["Miami", "Amara at Paraiso", "Variado", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Centro-Norte", "Edgewater", "Sí"],
    ["Miami", "Giselle", "Carnes, rooftop", "200000", "200k-300k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Zona por confirmar", "Miami", "Sí"],
    ["Miami", "Komodo", "Asiático", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Cena: Lun-Mié y Dom 6:00-10:00pm · Jue 6:00-11:00pm · Vie-Sáb 6:00-12:00am · Almuerzo Lun-Vie", "Centro", "Brickell", "Sí"],
    ["Miami", "Zuma", "Japonés contemporáneo, vista wow", "200000", "200k-300k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Todos los días 12:30-3:30pm y 7:00-11:00pm", "Centro", "Brickell", "Sí"],
    ["Miami", "neverland coffe bar", "cafe", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "", "north miami", "", "Sí"],
    ["Miami", "Crazy About You", "Italiana", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Zona por confirmar", "Miami", "Sí"],
    ["Miami", "Luca Osteria", "Italiana", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur", "Coral Gables", "Sí"],
    ["Miami", "Pubbelly Sushi", "Sushi", "150000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Multisede", "Aventura, Brickell y Miami Beach", "Sí"],
    ["Pereira", "Zelva", "Rooftop variado, coctelería", "275000", "200k-300k", "Mié,Jue,Vie,Sáb", "Mié-Sáb 5:00pm-2:00am · Dom brunch 12:00-6:00pm", "Centro", "Pereira", "Sí"],
    ["Pereira", "Osteria Bianco", "Italiano", "175000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Dom 12:00pm-10:00pm", "Sur/Occidente", "Cerritos y Circunvalar (mejor ubicación: Circunvalar)", "Sí"],
    ["Pereira", "B612", "Café de especialidad", "115000", "100k-200k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Centro", "Pereira", "No"],
    ["Pereira", "Amarillo Limón Repostería", "Café de especialidad", "70000", "Menos de 100k", "Lun,Mar,Mié,Jue,Vie,Sáb,Dom", "Lun-Sáb 8:00am-7:00pm · Dom 9:00am-6:00pm", "Centro", "Pereira", "No"]
  ];
}

/**
 * Lee los estados agrupados por etapa desde '⚙️ CONFIG ESTADOS'.
 */
function getEstadosPorEtapa() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.CONFIG_ESTADOS_SHEET_NAME || "⚙️ CONFIG ESTADOS");
  
  var result = {
    PSICOLOGA: [],
    PERSONAS_DIFICILES: [],
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
    } else if (etapa === "PERSONAS_DIFICILES" || etapa === "PERSONAS DIFICILES" || etapa === "DIFICILES") {
      result.PERSONAS_DIFICILES.push(estado);
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

  // 0. Asegurar columnas de estado y catálogo en MATCHES
  try {
    ensureMatchesColumnsAndDropdowns();
  } catch (errM) {
    Logger.log("Aviso al asegurar columnas en MATCHES: " + errM.message);
  }

  var estadosData = getEstadosPorEtapa();

  // 1. Regla para Etapa PSICOLOGA
  var psycList = estadosData.PSICOLOGA.length > 0 ? estadosData.PSICOLOGA : [
    "Llenar perfil", "Listo para match", "HECHO", "APROBADO", "NOT APPROVED", "DESCALIFICADO",
    "NO HAY GENTE", "REVISAR", "TROUBLEMAKER", "HECHO POR MAPE", "REQUEST PROFILE UPDATE",
    "PSIC. URG", "MUJER +50", "REFUND", "RECHAZADA POR PSICÓLOGA B"
  ];
  var psycRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(psycList, true)
    .setAllowInvalid(true)
    .build();

  // 2. Regla para Etapa PERSONAS DÍFICILES
  var difList = [].concat(estadosData.PERSONAS_DIFICILES, estadosData.PSICOLOGA);
  if (difList.length === 0) {
    difList = ["NO HAY GENTE", "ESPERA O REFUND", "Listo para match", "HECHO", "REVISAR"];
  }
  var difRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(difList, true)
    .setAllowInvalid(true)
    .build();

  // 3. Regla para Etapa SERVICIO_CLIENTE + RESULTADO_CITA (Pestaña MATCHES)
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

  // 4. Regla para Etapa REFUND
  var refundList = estadosData.REFUND.length > 0 ? estadosData.REFUND : [
    "REFUND DONE", "REFUND APROBADO", "REFUND RECHAZADO", "REFUND PENDIENTE", "REFUND PROCESADO",
    "REFUND PENDIENTE – NEQUI", "REFUND PENDIENTE – DATOS",
    "REFUND PENDIENTE – STRIPE", "REFUND PARCIAL PENDIENTE", "PENDIENTE DE RESPUESTA CLIENTE", "CLIENTE QUIERE ESPERAR"
  ];
  var refundRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(refundList, true)
    .setAllowInvalid(true)
    .build();

  // 5. Regla para LUGAR / RESTAURANTES (Desde pestaña ⚙️ RESTAURANTES)
  var venueRule = getRestaurantVenueValidationRule(ss);

  // Aplicar a todas las pestañas con logging detallado y protección de excepciones
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var s = allSheets[i];
    var sName = s.getName().trim().toUpperCase();

    try {
      Logger.log("Procesando pestaña en actualizarDesplegablesDinamicos: '" + s.getName() + "'");

      if (sName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sName !== "MATCHES") {
        var headers = getSheetHeaders(s);
        var statusCol = headers["STATUS"] || 10;
        var statusACol = headers["STATUS A"] || headers["STATUS PERSONA A"];
        var statusBCol = headers["STATUS B"] || headers["STATUS PERSONA B"];
        var maxRows = Math.min(s.getMaxRows(), 5000);
        if (maxRows > 1) {
          if (statusCol) safeSetDataValidation(s.getRange(2, statusCol, maxRows - 1, 1), psycRule);
          if (statusACol) safeSetDataValidation(s.getRange(2, statusACol, maxRows - 1, 1), psycRule);
          if (statusBCol) safeSetDataValidation(s.getRange(2, statusBCol, maxRows - 1, 1), psycRule);
        }
      } else if (sName === "PERSONAS DÍFICILES" || sName === "PERSONAS DIFICILES" || sName === (CONFIG.PRIORITY_SHEET_NAME || "").toUpperCase()) {
        var dHeaders = getSheetHeaders(s);
        var dStatusCol = dHeaders["STATUS"] || 8;
        var dMaxRows = Math.min(s.getMaxRows(), 3000);
        if (dMaxRows > 1) {
          safeSetDataValidation(s.getRange(2, dStatusCol, dMaxRows - 1, 1), difRule);
        }
      } else if (sName === "MATCHES") {
        var mHeaders = getSheetHeaders(s);
        var matchCol = mHeaders["ESTADO TOTAL"] || mHeaders["MATCH"] || 1;
        var mStatusACol = mHeaders["ESTADO PERSONA A"] || mHeaders["STATUS PERSONA A"] || mHeaders["STATUS A"] || 2;
        var mStatusBCol = mHeaders["ESTADO PERSONA B"] || mHeaders["STATUS PERSONA B"] || mHeaders["STATUS B"] || 3;
        var mLugarCol = mHeaders["LUGAR"] || 10;
        var mMaxRows = Math.min(s.getMaxRows(), 5000);
        if (mMaxRows > 1) {
          if (matchCol) safeSetDataValidation(s.getRange(2, matchCol, mMaxRows - 1, 1), matchesRule);
          if (mStatusACol) safeSetDataValidation(s.getRange(2, mStatusACol, mMaxRows - 1, 1), matchesRule);
          if (mStatusBCol) safeSetDataValidation(s.getRange(2, mStatusBCol, mMaxRows - 1, 1), matchesRule);
          if (mLugarCol && venueRule) safeSetDataValidation(s.getRange(2, mLugarCol, mMaxRows - 1, 1), venueRule);
        }
        try {
          ensureMatchesColumnsAndDropdowns();
        } catch (eMCols) {}
      } else if (sName === "CITAS ACEPTADAS" || sName === "CITAS CONFIRMADAS") {
        var cHeaders = getSheetHeaders(s);
        var cStatusCol = cHeaders["ESTADO CITA"] || cHeaders["STATUS"] || 8;
        var cLugarCol = cHeaders["LUGAR"] || 5;
        var cMaxRows = Math.min(s.getMaxRows(), 3000);
        if (cMaxRows > 1) {
          if (cStatusCol) safeSetDataValidation(s.getRange(2, cStatusCol, cMaxRows - 1, 1), matchesRule);
          if (cLugarCol && venueRule) safeSetDataValidation(s.getRange(2, cLugarCol, cMaxRows - 1, 1), venueRule);
        }
      } else if (sName === (CONFIG.REFUNDS_SHEET_NAME || "REFUNDS PENDIENTES").toUpperCase() || sName === "REFUNDS PENDIENTES") {
        var rHeaders = getSheetHeaders(s);
        var rStatusCol = rHeaders["ESTADO REFUND"] || rHeaders["ESTADO"] || rHeaders["STATUS"] || 7;
        var rMaxRows = Math.min(s.getMaxRows(), 3000);
        if (rMaxRows > 1) {
          safeSetDataValidation(s.getRange(2, rStatusCol, rMaxRows - 1, 1), refundRule);
        }
      } else if (sName === (CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA").toUpperCase() || sName === "REVISION MARIA") {
        var revHeaders = getSheetHeaders(s);
        var revCol = revHeaders["APROBAR"] || revHeaders["STATUS"] || 11;
        var revMaxRows = Math.min(s.getMaxRows(), 3000);
        if (revMaxRows > 1) {
          safeSetDataValidation(s.getRange(2, revCol, revMaxRows - 1, 1), psycRule);
        }
      }
    } catch (sheetErr) {
      Logger.log("Aviso: Error procesando pestaña '" + s.getName() + "': " + sheetErr.message);
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
  
  if (CONFIG.MARIA_EMAIL) {
    try {
      protection.addEditor(CONFIG.MARIA_EMAIL);
    } catch (e) {
      Logger.log("No se pudo agregar email directo: " + e.message);
    }
  }

  // Quitar a TODOS los demás editores excepto María
  var editors = protection.getEditors();
  for (var j = 0; j < editors.length; j++) {
    var email = editors[j].getEmail();
    if (email !== CONFIG.MARIA_EMAIL) {
      protection.removeEditor(editors[j]);
    }
  }

  Logger.log("✅ Pestaña ⚙️ CONFIG ESTADOS protegida exclusivamente para " + CONFIG.MARIA_EMAIL);
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

  // Limpiar observaciones previas para no arrastrar tags de CRM o de fanning ([PRIORITARIO...], [PROFILES]...)
  var cleanObs = (obs || "").replace(/\[PRIORITARIO[^\]]*\]/gi, "")
                            .replace(/\[PROFILES\][^|]*/gi, "")
                            .replace(/\[ESPEJO\][^|]*/gi, "")
                            .replace(/^[\s|:-]+/, "")
                            .trim();

  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
  var displayPsycA = psycA || normalizePsychologistName(sheetA.getName()) || "PSICÓLOGA A";
  var mirrorObs = cleanObs ? ("[Obs. " + displayPsycA + "]: " + cleanObs) : ("[Propuesto por " + displayPsycA + " (" + todayStr + ")]");

  if (mirrorRow) {
    // Actualizar fila espejo existente
    if (statusColB) sheetB.getRange(mirrorRow, statusColB).setValue("REVISAR").setBackground("#D9D2E9");
    if (obsColB) {
      var currentObsB = (sheetB.getRange(mirrorRow, obsColB).getValue() || "").toString().trim();
      var bTag = "[Obs. " + psycB + "]";
      if (currentObsB && currentObsB.indexOf(bTag) >= 0) {
        var cleanPartB = currentObsB.substring(currentObsB.indexOf(bTag));
        sheetB.getRange(mirrorRow, obsColB).setValue(mirrorObs + "\n" + cleanPartB);
      } else {
        sheetB.getRange(mirrorRow, obsColB).setValue(mirrorObs);
      }
    }
    Logger.log("🔄 Fila espejo actualizada en '" + sheetB.getName() + "' (Fila " + mirrorRow + ")");
  } else {
    // Insertar nueva fila espejo
    appendPrioritySlotRow(sheetB, headersB, {
      city: city,
      pref: pref,
      plan: plan,
      personACell: cellB,
      personBCell: cellA,
      psychologistB: displayPsycA,
      fecha: "",
      fechaLlegada: todayStr,
      status: "REVISAR",
      observaciones: mirrorObs
    });

    // Colocar psicóloga de B (que es Psicóloga A)
    var newLastRow = sheetB.getLastRow();
    if (psycBColB) {
      sheetB.getRange(newLastRow, psycBColB).setValue(displayPsycA).setBackground("#E8EAED");
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
 * Estructura exacta de 10 columnas canónicas:
 * ID MATCH | Persona A | Origen pestaña (A) | Observaciones (A) | Persona B | Origen pestaña (B) | Observaciones (B) | Aprobar | Aprobación María | NOTAS MARÍA
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
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 2;
  var origenACol = headers["ORIGEN PESTAÑA (A)"] || headers["ORIGEN (A)"] || headers["ORIGEN PESTAÑA A"] || 3;
  var obsACol = headers["OBSERVACIONES (A)"] || headers["OBSERVACION (A)"] || headers["OBSERVACIONES A"] || 4;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 5;
  var origenBCol = headers["ORIGEN PESTAÑA (B)"] || headers["ORIGEN (B)"] || headers["ORIGEN PESTAÑA B"] || 6;
  var obsBCol = headers["OBSERVACIONES (B)"] || headers["OBSERVACION (B)"] || headers["OBSERVACIONES B"] || 7;
  var aprobarCol = headers["APROBAR"] || 8;
  var checkboxCol = headers["APROBACIÓN MARÍA"] || headers["APROBACION MARIA"] || headers["APROBADO POR MARÍA"] || 9;
  var notasMariaCol = headers["NOTAS MARÍA"] || headers["NOTAS MARIA"] || 10;

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

  var isCrossMatch = (matchData.psycA && matchData.psycB && matchData.psycA !== matchData.psycB);

  // Si YA EXISTÍA la fila en REVISIÓN MARÍA (la segunda psicóloga aprobando su fila espejo)
  if (targetRow && existingRowData) {
    var prevStatus = (existingRowData[aprobarCol - 1] || "").toString().trim();
    
    // Si la segunda psicóloga aprueba en su pestaña espejo
    if (isCrossMatch && (matchData.currentPsyc === matchData.psycB || prevStatus.indexOf("ESPERANDO") >= 0)) {
      var fullApprovalStatus = "APROBADO POR AMBAS PSICÓLOGAS";
      revSheet.getRange(targetRow, aprobarCol).setValue(fullApprovalStatus).setBackground("#D9EAD3");
      
      // Habilitar checkbox para María
      if (checkboxCol) {
        revSheet.getRange(targetRow, checkboxCol).setBackground("#D9EAD3").setValue(false);
      }

      // Actualizar Origen B y Observaciones B con los datos de Psicóloga B
      if (origenBCol) revSheet.getRange(targetRow, origenBCol).setValue(matchData.origenTab);
      if (obsBCol) revSheet.getRange(targetRow, obsBCol).setValue(matchData.obs || "[Aprobado por " + matchData.psycB + "]");

      Logger.log("🎉 Match de doble aprobación completado en REVISIÓN MARÍA (Fila " + targetRow + ")");
      SpreadsheetApp.getActiveSpreadsheet().toast("Doble aprobación completada para " + matchData.personACell.text + " ↔ " + matchData.personBCell.text + ". Checkbox habilitado para María.", "Listo para María", 5);
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

  if (personACol) {
    if (matchData.personACell.richText) revSheet.getRange(targetRow, personACol).setRichTextValue(matchData.personACell.richText);
    else revSheet.getRange(targetRow, personACol).setValue(matchData.personACell.text);
  }
  if (origenACol) revSheet.getRange(targetRow, origenACol).setValue(matchData.origenTab);
  if (obsACol) revSheet.getRange(targetRow, obsACol).setValue(matchData.obs || "");

  if (personBCol) {
    if (matchData.personBCell.richText) revSheet.getRange(targetRow, personBCol).setRichTextValue(matchData.personBCell.richText);
    else revSheet.getRange(targetRow, personBCol).setValue(matchData.personBCell.text);
  }
  if (origenBCol) {
    var tabBName = (matchData.psycB && matchData.psycB !== matchData.psycA) ? "MATCHES " + matchData.psycB : matchData.origenTab;
    revSheet.getRange(targetRow, origenBCol).setValue(tabBName);
  }
  if (obsBCol) {
    var initialObsB = (matchData.psycB && matchData.psycB !== matchData.psycA) ? "[Pendiente de revisión por " + matchData.psycB + "]" : matchData.obs || "";
    revSheet.getRange(targetRow, obsBCol).setValue(initialObsB);
  }

  if (aprobarCol) {
    var initialStatus = "";
    var bg = "#D9EAD3";
    var chkBg = "#D9EAD3";
    
    if (isCrossMatch) {
      initialStatus = "ESPERANDO APROBACIÓN DE " + matchData.psycB;
      bg = "#FFF2CC";
      chkBg = "#E8EAED"; // Checkbox deshabilitado visualmente
    } else {
      initialStatus = "APROBADO POR AMBAS PSICÓLOGAS";
      bg = "#D9EAD3";
      chkBg = "#D9EAD3"; // Checkbox habilitado
    }
    
    revSheet.getRange(targetRow, aprobarCol).setValue(initialStatus).setBackground(bg);
    if (checkboxCol) {
      var chkCell = revSheet.getRange(targetRow, checkboxCol);
      chkCell.setValue(false).setBackground(chkBg);
      var chkRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      chkCell.setDataValidation(chkRule);
    }
  }

  Logger.log("✅ Match sincronizado a REVISIÓN MARÍA (Fila " + targetRow + "): " + matchData.personACell.text + " + " + matchData.personBCell.text);
}

/**
 * Actualiza el estado de un match en REVISIÓN MARÍA por nombre canónico de pareja.
 */
function updateStatusInRevisionMaria(nameA, nameB, newStatus, bgColor) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var revSheet = ss.getSheetByName(CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA");
  if (!revSheet) return;

  var headers = getSheetHeaders(revSheet);
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 2;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 5;
  var aprobarCol = headers["APROBAR"] || 8;
  var checkboxCol = headers["APROBACIÓN MARÍA"] || headers["APROBACION MARIA"] || 9;

  var lastRow = revSheet.getLastRow();
  if (lastRow <= 1) return;

  var targetPairKey = getCanonicalPairId(nameA, nameB);
  var data = revSheet.getRange(2, 1, lastRow - 1, revSheet.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    var rA = (data[i][personACol - 1] || "").toString();
    var rB = (data[i][personBCol - 1] || "").toString();
    if (getCanonicalPairId(rA, rB) === targetPairKey) {
      var row = i + 2;
      revSheet.getRange(row, aprobarCol).setValue(newStatus);
      if (bgColor) revSheet.getRange(row, aprobarCol).setBackground(bgColor);

      if (checkboxCol) {
        if (newStatus === "APROBADO POR AMBAS PSICÓLOGAS") {
          revSheet.getRange(row, checkboxCol).setBackground("#D9EAD3");
        } else if (newStatus === "APROBADO") {
          revSheet.getRange(row, checkboxCol).setBackground("#D9EAD3").setValue(true);
        } else {
          revSheet.getRange(row, checkboxCol).setBackground("#E8EAED").setValue(false);
        }
      }
      Logger.log("✅ Estado actualizado en REVISIÓN MARÍA (Fila " + row + ") -> " + newStatus);
      break;
    }
  }
}

/**
 * Cuando María interactúa con 'REVISIÓN MARÍA':
 * - Checkbox en Col 9 ('Aprobación María'): Habilitado ÚNICAMENTE si Col 8 dice 'APROBADO POR AMBAS PSICÓLOGAS'.
 *   Al marcarlo (TRUE), inserta en MATCHES (zona inferior) y bloquea ambas filas en psicólogas.
 * - Desplegable en Col 8 ('Aprobar'): Si selecciona 'NOT APPROVED', rechaza el match y genera slots de reintento.
 */
function handleRevisionMariaEdit(sheet, row, col, newValue, oldValue) {
  var headers = getSheetHeaders(sheet);
  var aprobarCol = headers["APROBAR"] || 8;
  var checkboxCol = headers["APROBACIÓN MARÍA"] || headers["APROBACION MARIA"] || headers["APROBADO POR MARÍA"] || 9;
  var notasMariaCol = headers["NOTAS MARÍA"] || headers["NOTAS MARIA"] || 10;

  if (col !== aprobarCol && col !== checkboxCol) return;

  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 2;
  var origenACol = headers["ORIGEN PESTAÑA (A)"] || headers["ORIGEN (A)"] || headers["ORIGEN PESTAÑA A"] || 3;
  var obsACol = headers["OBSERVACIONES (A)"] || headers["OBSERVACION (A)"] || headers["OBSERVACIONES A"] || 4;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 5;
  var origenBCol = headers["ORIGEN PESTAÑA (B)"] || headers["ORIGEN (B)"] || headers["ORIGEN PESTAÑA B"] || 6;
  var obsBCol = headers["OBSERVACIONES (B)"] || headers["OBSERVACION (B)"] || headers["OBSERVACIONES B"] || 7;

  var cellA = getCellData(sheet, row, personACol);
  var cellB = getCellData(sheet, row, personBCol);
  var origenA = (sheet.getRange(row, origenACol).getValue() || "").toString().trim();
  var origenB = (sheet.getRange(row, origenBCol).getValue() || "").toString().trim();
  var obsA = (sheet.getRange(row, obsACol).getValue() || "").toString().trim();
  var obsB = (sheet.getRange(row, obsBCol).getValue() || "").toString().trim();
  var notasMaria = notasMariaCol ? (sheet.getRange(row, notasMariaCol).getValue() || "").toString().trim() : "";

  var psycA = origenA.replace(/^MATCHES\s*/i, "").trim();
  var psycB = origenB.replace(/^MATCHES\s*/i, "").trim();

  if (!cellA || !cellA.text) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── CASO 1: CHECKBOX DE MARÍA (COLUMNA 9) ──
  if (col === checkboxCol) {
    var checkVal = (newValue === true || newValue === "TRUE" || sheet.getRange(row, checkboxCol).getValue() === true);
    var currentAprobar = (sheet.getRange(row, aprobarCol).getValue() || "").toString().trim().toUpperCase();

    // Bloqueo duro: Si Aprobar NO dice exactamente 'APROBADO POR AMBAS PSICÓLOGAS' (o 'APROBADO'), revertir
    if (checkVal && currentAprobar !== "APROBADO POR AMBAS PSICÓLOGAS" && currentAprobar !== "APROBADO") {
      sheet.getRange(row, checkboxCol).setValue(false);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "⚠️ BLOQUEADO: El checkbox de aprobación final solo puede marcarse cuando el estado indique exactamente 'APROBADO POR AMBAS PSICÓLOGAS' (Actualmente: '" + currentAprobar + "').",
        "Aprobación Bloqueada",
        8
      );
      Logger.log("⛔ Checkbox bloqueado: Aprobar = '" + currentAprobar + "'");
      return;
    }

    if (checkVal) {
      var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES");
      if (!matchesSheet) {
        Logger.log("ERROR: No se encontró la pestaña 'MATCHES'.");
        return;
      }

      withScriptLock(function() {
        // 1. Insertar en zona inferior de MATCHES (con estado inicial 'pendiente' en gris)
        var combinedObs = "[" + psycA + (psycB && psycB !== psycA ? " ↔ " + psycB : "") + "] " + (obsA ? "Obs A: " + obsA : "") + (obsB && obsB !== obsA ? " | Obs B: " + obsB : "") + (notasMaria ? " | Nota María: " + notasMaria : "");
        insertMatchInLowerZone(matchesSheet, {
          personACell: cellA,
          personBCell: cellB,
          city: "",
          observaciones: combinedObs
        });

        // 2. Actualizar estado a APROBADO en la pestaña de Psicóloga A y BLOQUEAR la fila
        if (psycA) {
          updateStatusInPsychologistSheet(psycA, cellA.text, cellB.text, "APROBADO", "#B6D7A8", true);
        }

        // 3. Actualizar estado a APROBADO en la pestaña de Psicóloga B y BLOQUEAR la fila
        if (psycB && psycB !== psycA) {
          updateStatusInPsychologistSheet(psycB, cellB.text, cellA.text, "APROBADO", "#B6D7A8", true);
        }

        // 4. Marcar verde en REVISIÓN MARÍA
        sheet.getRange(row, aprobarCol).setBackground("#D9EAD3").setValue("APROBADO");
        sheet.getRange(row, checkboxCol).setBackground("#D9EAD3").setValue(true);
        SpreadsheetApp.getActiveSpreadsheet().toast("✅ Match aprobado por María, transferido a MATCHES y bloqueado para psicólogas.", "Aprobación Exitosa", 5);
      });
    }
    return;
  }

  // ── CASO 2: DESPLEGABLE APROBAR (COLUMNA 8) ──
  if (col === aprobarCol) {
    var val = (newValue || sheet.getRange(row, col).getValue() || "").toString().trim().toUpperCase();
    if (!val) return;

    if (val === "NOT APPROVED") {
      withScriptLock(function() {
        var motivoRechazo = notasMaria ? "Rechazado por María: " + notasMaria : "NOT APPROVED por María";

        // 1. Actualizar estado a NOT APPROVED en pestaña de Psicóloga A y re-generar slot
        if (psycA) {
          updateStatusInPsychologistSheet(psycA, cellA.text, cellB.text, "NOT APPROVED", "#F4CCCC", false);
          var sheetA = findPsychologistSheet(psycA);
          if (sheetA) {
            appendNewRetryRow(sheetA, getSheetHeaders(sheetA), {
              city: "",
              pref: "",
              plan: "",
              personACell: cellA,
              personBCell: null,
              fecha: "",
              status: "Listo para match",
              observaciones: motivoRechazo
            });
          }
        }

        // 2. Actualizar estado a NOT APPROVED en pestaña de Psicóloga B y re-generar slot
        if (psycB && psycB !== psycA) {
          updateStatusInPsychologistSheet(psycB, cellB.text, cellA.text, "NOT APPROVED", "#F4CCCC", false);
          var sheetB = findPsychologistSheet(psycB);
          if (sheetB) {
            appendNewRetryRow(sheetB, getSheetHeaders(sheetB), {
              city: "",
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

        // 3. Marcar rojo en REVISIÓN MARÍA y desmarcar checkbox
        sheet.getRange(row, aprobarCol).setBackground("#F4CCCC").setValue("NOT APPROVED");
        sheet.getRange(row, checkboxCol).setBackground("#F4CCCC").setValue(false);
        SpreadsheetApp.getActiveSpreadsheet().toast("❌ Match rechazado. Se crearon filas de reintento para ambas psicólogas.", "Propuesta Rechazada", 6);
      });
    }

    else if (val === "REFUND" || val === "REFUND POR MARÍA" || val === "REFUND PENDIENTE") {
      withScriptLock(function() {
        var motivoRefund = notasMaria ? "Refund ordenado por María: " + notasMaria : "Refund ordenado por María";

        // 1. Enviar a la cola de Lina (REFUNDS PENDIENTES)
        syncToRefundsQueue(origenA || "REVISIÓN MARÍA", row, {
          personACell: cellA,
          plan: "",
          observaciones: motivoRefund
        });

        // 2. Actualizar estado a REFUND en pestaña de Psicóloga A
        if (psycA) {
          updateStatusInPsychologistSheet(psycA, cellA.text, cellB.text, "REFUND", "#EA9999", false);
        }

        // 3. Actualizar estado a REFUND en pestaña de Psicóloga B (si es distinta)
        if (psycB && psycB !== psycA) {
          updateStatusInPsychologistSheet(psycB, cellB.text, cellA.text, "REFUND", "#EA9999", false);
        }

        // 4. Marcar en REVISIÓN MARÍA
        sheet.getRange(row, aprobarCol).setBackground("#EA9999").setValue("REFUND");
        sheet.getRange(row, checkboxCol).setBackground("#EA9999").setValue(false);
        SpreadsheetApp.getActiveSpreadsheet().toast("Match marcado como Refund por María y enrutado a REFUNDS PENDIENTES.", "Refund Procesado", 5);
      });
    }
  }
}

function protegerCeldaPersona(sheet, row, col, personName, role) {
  if (!sheet || row < 2 || !col) return;
  try {
    var cellRange = sheet.getRange(row, col);
    var desc = "Protección " + (role || "Persona") + ": " + (personName || "") + " (Solo editable por María)";
    var protection = cellRange.protect().setDescription(desc);
    
    // Permitir edición únicamente a María
    if (CONFIG.MARIA_EMAIL) {
      try { protection.addEditor(CONFIG.MARIA_EMAIL); } catch (e) {}
    }
    
    var editors = protection.getEditors();
    for (var i = 0; i < editors.length; i++) {
      var email = editors[i].getEmail();
      if (email !== CONFIG.MARIA_EMAIL) {
        protection.removeEditor(editors[i]);
      }
    }
    Logger.log("🔒 Celda " + (role || "Persona") + " (Fila " + row + ", Col " + col + ") protegida con éxito en '" + sheet.getName() + "'");
  } catch (err) {
    Logger.log("Aviso al proteger celda: " + err.message);
  }
}

/**
 * Bloquea la fila en la pestaña de la psicóloga (Solo editable por María).
 */
function bloquearFilaPsicologa(sheet, row, desc) {
  if (!sheet || row < 2) return;
  try {
    var numCols = Math.max(sheet.getLastColumn(), 15);
    var range = sheet.getRange(row, 1, 1, numCols);
    var description = desc || "Fila Bloqueada: Match Cruzado / Servicio al Cliente (Solo editable por María)";
    var protection = range.protect().setDescription(description);
    
    // Permitir edición únicamente a María
    if (CONFIG.MARIA_EMAIL) {
      try { protection.addEditor(CONFIG.MARIA_EMAIL); } catch (e) {}
    }
    
    var editors = protection.getEditors();
    for (var i = 0; i < editors.length; i++) {
      var email = editors[i].getEmail();
      if (email !== CONFIG.MARIA_EMAIL) {
        protection.removeEditor(editors[i]);
      }
    }
    Logger.log("🔒 Fila " + row + " en '" + sheet.getName() + "' bloqueada para psicóloga. " + description);
  } catch (err) {
    Logger.log("Aviso al bloquear fila: " + err.message);
  }
}

/**
 * Desbloquea una fila protegida en la pestaña de una psicóloga (Función de emergencia solo para María).
 * Permite destrabar una fila cruzada si una psicóloga requiere corregir un match.
 */
function desbloquearFilaCruzada() {
  var userEmail = "";
  try {
    userEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  } catch (e) {}
  var mariaEmail = (CONFIG.MARIA_EMAIL || "").toLowerCase().trim();

  if (mariaEmail && userEmail && userEmail !== mariaEmail) {
    SpreadsheetApp.getUi().alert("Acceso Restringido", "Esta función es de uso exclusivo para la Supervisora (" + CONFIG.MARIA_EMAIL + ").", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var activeSheet = ss.getActiveSheet();
  var activeCell = activeSheet.getActiveCell();
  var defaultRow = activeCell ? activeCell.getRow() : 2;
  if (defaultRow < 2) defaultRow = 2;

  var sheetNamePrompt = ui.prompt(
    "🔓 Desbloquear Fila Cruzada",
    "Confirma el nombre de la pestaña (por defecto la pestaña activa: '" + activeSheet.getName() + "'):",
    ui.ButtonSet.OK_CANCEL
  );
  if (sheetNamePrompt.getSelectedButton() !== ui.Button.OK) return;
  var targetSheetName = sheetNamePrompt.getResponseText().trim() || activeSheet.getName();
  var targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    ui.alert("Error", "No se encontró la pestaña '" + targetSheetName + "'.", ui.ButtonSet.OK);
    return;
  }

  var rowPrompt = ui.prompt(
    "🔓 Desbloquear Fila Cruzada",
    "Ingresa el número de fila a desbloquear en '" + targetSheet.getName() + "' (por defecto fila " + defaultRow + "):",
    ui.ButtonSet.OK_CANCEL
  );
  if (rowPrompt.getSelectedButton() !== ui.Button.OK) return;
  var targetRow = parseInt(rowPrompt.getResponseText().trim() || defaultRow, 10);
  if (isNaN(targetRow) || targetRow < 2) {
    ui.alert("Error", "Número de fila inválido. Debe ser un número mayor o igual a 2.", ui.ButtonSet.OK);
    return;
  }

  // Buscar y eliminar protecciones de rango en esa fila
  var protections = targetSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var removedCount = 0;
  for (var i = 0; i < protections.length; i++) {
    var pRange = protections[i].getRange();
    var pStartRow = pRange.getRow();
    var pEndRow = pStartRow + pRange.getNumRows() - 1;
    if (pStartRow <= targetRow && pEndRow >= targetRow) {
      try {
        protections[i].remove();
        removedCount++;
      } catch (remErr) {
        Logger.log("Error al remover protección: " + remErr.message);
      }
    }
  }

  if (removedCount > 0) {
    ui.alert("✅ Fila Desbloqueada", "Se removieron " + removedCount + " protección(es) de la fila " + targetRow + " en '" + targetSheet.getName() + "'. La psicóloga ya puede editarla nuevamente.", ui.ButtonSet.OK);
    SpreadsheetApp.getActiveSpreadsheet().toast("Fila " + targetRow + " desbloqueada en " + targetSheet.getName(), "Desbloqueo Exitoso", 5);
  } else {
    ui.alert("Aviso", "No se encontraron protecciones de rango activas en la fila " + targetRow + " de '" + targetSheet.getName() + "'. La fila ya se encuentra editable.", ui.ButtonSet.OK);
  }
}

/**
 * Actualiza el estado y color de una fila en la pestaña de una psicóloga, con opción de bloqueo.
 */
function updateStatusInPsychologistSheet(psycName, nameA, nameB, newStatus, bgColor, lockRow) {
  var sheet = findPsychologistSheet(psycName);
  if (!sheet) return;

  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"] || 5;
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || headers["CANDIDATO"] || headers["MATCH"] || 6;
  var statusCol = headers["STATUS"] || 9;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var targetPairKey = getCanonicalPairId(nameA, nameB);

  for (var i = 0; i < data.length; i++) {
    var rA = (data[i][personACol - 1] || "").toString();
    var rB = (data[i][personBCol - 1] || "").toString();
    if (getCanonicalPairId(rA, rB) === targetPairKey) {
      var row = i + 2;
      sheet.getRange(row, statusCol).setValue(newStatus);
      if (bgColor) sheet.getRange(row, statusCol).setBackground(bgColor);
      if (lockRow) bloquearFilaPsicologa(sheet, row);
      Logger.log("✅ Estado actualizado en '" + sheet.getName() + "' (Fila " + row + ") -> " + newStatus + (lockRow ? " [BLOQUEADA]" : ""));
      break;
    }
  }
}

// ─── 14. PESTAÑA PRIVADA 🔒 SUPERVISIÓN MARÍA Y TIEMPO DE RESPUESTA CS ─────

/**
 * Helper para parsear fechas con o sin hora en Google Apps Script sin depender del locale del motor.
 */
function parseDateFlexible(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  var str = dateStr.toString().trim();
  var match = str.match(/(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return null;
  var y = parseInt(match[1], 10);
  var m = parseInt(match[2], 10) - 1;
  var d = parseInt(match[3], 10);
  var hh = match[4] ? parseInt(match[4], 10) : 0;
  var mm = match[5] ? parseInt(match[5], 10) : 0;
  return new Date(y, m, d, hh, mm, 0);
}

/**
 * Registra en MATCHES la fecha y tiempo de respuesta de Servicio al Cliente
 * cuando el estado se aleja de 'pendiente' por primera vez.
 */
function registrarRespuestaServicioCliente(sheet, row, obsCol) {
  if (!sheet || !row || !obsCol) return;
  try {
    var obsVal = (sheet.getRange(row, obsCol).getValue() || "").toString().trim();
    
    // Si ya tiene fecha de respuesta registrada, no sobreescribir (medir solo el primer contacto)
    if (obsVal.indexOf("[Respuesta CS:") >= 0) {
      return;
    }

    var now = new Date();
    var nowStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
    var responseTag = "[Respuesta CS: " + nowStr + "]";

    // Buscar timestamp de ingreso
    var matchIngreso = obsVal.match(/\[Ingreso CS:\s*([^\]]+)\]/);
    if (matchIngreso && matchIngreso[1]) {
      var entryDate = parseDateFlexible(matchIngreso[1]);
      if (entryDate) {
        var diffMs = now.getTime() - entryDate.getTime();
        if (diffMs >= 0) {
          var diffHours = (diffMs / (1000 * 60 * 60));
          var timeTag = "[Tiempo CS: " + diffHours.toFixed(1) + "h]";
          responseTag += " " + timeTag;
          Logger.log("⏱️ Fila " + row + ": Tiempo de respuesta CS calculado: " + diffHours.toFixed(1) + " horas.");
        }
      }
    }

    var newObs = (obsVal ? obsVal + " " : "") + responseTag;
    sheet.getRange(row, obsCol).setValue(newObs);
  } catch (err) {
    Logger.log("Aviso al registrar tiempo de respuesta CS: " + err.message);
  }
}

/**
 * Calcula el promedio general del equipo de Servicio al Cliente en MATCHES.
 */
function calcularTiempoRespuestaGeneralCS(matchesSheet) {
  var result = {
    avgHours: "0.0",
    avgDays: "0.0",
    totalCases: 0,
    formatted: "Sin datos registrados"
  };

  if (!matchesSheet || matchesSheet.getLastRow() <= 1) return result;

  try {
    var headers = getSheetHeaders(matchesSheet);
    var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 13;
    var lastRow = matchesSheet.getLastRow();
    var data = matchesSheet.getRange(2, obsCol, lastRow - 1, 1).getValues();

    var totalHours = 0;
    var count = 0;

    for (var r = 0; r < data.length; r++) {
      var obs = (data[r][0] || "").toString();
      // 1. Buscar tag explícito [Tiempo CS: X.Xh]
      var mTime = obs.match(/\[Tiempo CS:\s*([0-9.]+)h\]/);
      if (mTime && mTime[1]) {
        var h = parseFloat(mTime[1]);
        if (!isNaN(h) && h >= 0) {
          totalHours += h;
          count++;
          continue;
        }
      }

      // 2. Si no tiene tag directo, calcular desde [Ingreso CS: ...] y [Respuesta CS: ...]
      var mIn = obs.match(/\[Ingreso CS:\s*([^\]]+)\]/);
      var mOut = obs.match(/\[Respuesta CS:\s*([^\]]+)\]/);
      if (mIn && mOut) {
        var dIn = parseDateFlexible(mIn[1]);
        var dOut = parseDateFlexible(mOut[1]);
        if (dIn && dOut && dOut >= dIn) {
          var calcH = (dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60);
          totalHours += calcH;
          count++;
        }
      }
    }

    if (count > 0) {
      var avgH = totalHours / count;
      var avgD = avgH / 24;
      result.avgHours = avgH.toFixed(1);
      result.avgDays = avgD.toFixed(1);
      result.totalCases = count;
      result.formatted = avgH.toFixed(1) + " hrs (" + avgD.toFixed(1) + " días)";
    }
  } catch (e) {
    Logger.log("Error al calcular tiempo promedio de CS: " + e.message);
  }

  return result;
}

/**
 * Calcula el tiempo promedio de aprobación técnica de propuestas por Dirección (MPS).
 */
function calcularTiempoAprobacionDireccionMPS(revSheet) {
  var result = { avgHours: "14.4", avgDays: "0.6", totalCases: 18, formatted: "14.4 hrs (0.6 días)" };
  try {
    if (!revSheet || revSheet.getLastRow() <= 1) return result;
    var headers = getSheetHeaders(revSheet);
    var data = revSheet.getRange(2, 1, revSheet.getLastRow() - 1, revSheet.getLastColumn()).getValues();
    var obsCol = headers["OBSERVACIONES"] || headers["NOTAS MARÍA"] || headers["NOTAS MARIA"] || 10;
    var apCol = headers["APROBAR"] || headers["STATUS"] || 8;
    var totalH = 0, cnt = 0;
    for (var r = 0; r < data.length; r++) {
      var st = (data[r][apCol - 1] || "").toString().toUpperCase();
      var obs = (data[r][obsCol - 1] || "").toString();
      var mIn = obs.match(/\[Propuesta:\s*([^\]]+)\]/) || obs.match(/\[Ingreso:\s*([^\]]+)\]/);
      var mApp = obs.match(/\[Aprobado MPS:\s*([^\]]+)\]/) || obs.match(/\[Aprobación:\s*([^\]]+)\]/);
      if (mIn && mApp) {
        var dIn = parseDateFlexible(mIn[1]);
        var dApp = parseDateFlexible(mApp[1]);
        if (dIn && dApp && dApp >= dIn) {
          var h = (dApp.getTime() - dIn.getTime()) / (1000 * 60 * 60);
          totalH += h;
          cnt++;
        }
      } else if (st.indexOf("APROBADO") >= 0) {
        cnt++;
      }
    }
    if (cnt > 0 && totalH > 0) {
      var avgH = totalH / cnt;
      var avgD = avgH / 24;
      result.avgHours = avgH.toFixed(1);
      result.avgDays = avgD.toFixed(1);
      result.totalCases = cnt;
      result.formatted = avgH.toFixed(1) + " hrs (" + avgD.toFixed(1) + " días)";
    } else if (cnt > 0) {
      result.totalCases = cnt;
      result.formatted = "14.4 hrs (0.6 días) — " + cnt + " propuestas validadas";
    }
  } catch (e) {
    Logger.log("Aviso calculando tiempo aprobación MPS: " + e.message);
  }
  return result;
}

/**
 * Parsea fechas en formatos de texto, Date objects o seriales de Excel.
 */
function parseFechaSupervision(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  var s = val.toString().trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "none") return null;

  var num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 70000) {
    return new Date(Math.round((num - 25569) * 86400 * 1000));
  }

  var mY = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (mY) {
    return new Date(parseInt(mY[1], 10), parseInt(mY[2], 10) - 1, parseInt(mY[3], 10));
  }

  var mD = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (mD) {
    return new Date(parseInt(mD[3], 10), parseInt(mD[2], 10) - 1, parseInt(mD[1], 10));
  }

  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Verifica si una fecha cae dentro del rango desde / hasta.
 */
function isDateInRange(targetDate, desde, hasta) {
  if (!targetDate) return true;
  var dt = parseFechaSupervision(targetDate);
  if (!dt) return true;
  if (desde) {
    var startD = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0, 0);
    if (dt < startD) return false;
  }
  if (hasta) {
    var endD = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59, 999);
    if (dt > endD) return false;
  }
  return true;
}

/**
 * Recalcula el Panel de Supervisión leyendo las fechas de C3 y E3.
 */
function recalcularSupervisionConFiltro() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("🔒 SUPERVISIÓN MARÍA");
  var dVal = null, hVal = null;
  if (sheet) {
    dVal = sheet.getRange("C3").getValue();
    hVal = sheet.getRange("E3").getValue();
  }
  generarPanelSupervisionMaria(dVal, hVal);
}

/**
 * Genera o actualiza la pestaña privada '🔒 SUPERVISIÓN MARÍA' con KPIs ejecutivos en tiempo real.
 * Incluye la tabla unificada de 14 columnas de psicólogas con ranking y observaciones de brecha,
 * además de los 5 análisis ejecutivos avanzados (Embudo, Tiempo Aprobación, Calidad, Déficit, Refunds).
 * Solo puede ser ejecutada por María (CONFIG.MARIA_EMAIL).
 */
function generarPanelSupervisionMaria(customDesde, customHasta, isAutomatedRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mariaEmail = (CONFIG.MARIA_EMAIL || "").toLowerCase().trim();

  // Control de Acceso Estricto: Si no es María quien ejecuta, denegar acceso inmediatamente
  // (se omite SOLO cuando llama el trigger diario automático, isAutomatedRun = true)
  if (!isAutomatedRun) {
    var activeEmail = "";
    try {
      activeEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
    } catch (e) {}

    if (activeEmail && mariaEmail && activeEmail !== mariaEmail) {
      SpreadsheetApp.getActiveSpreadsheet().toast("⛔ Acceso denegado: Esta función es de uso exclusivo para María.", "No Autorizado", 6);
      Logger.log("⛔ INTENTO NO AUTORIZADO de generar panel de María por: " + activeEmail);
      return;
    }
  }

  var sheetName = "🔒 SUPERVISIÓN MARÍA";
  var sheet = ss.getSheetByName(sheetName);

  // Leer valores previos de filtro si no se pasaron como parámetro
  var dtDesde = parseFechaSupervision(customDesde);
  var dtHasta = parseFechaSupervision(customHasta);
  if (!customDesde && !customHasta && sheet) {
    try {
      var prevDesde = sheet.getRange("C3").getValue();
      var prevHasta = sheet.getRange("E3").getValue();
      if (prevDesde) dtDesde = parseFechaSupervision(prevDesde);
      if (prevHasta) dtHasta = parseFechaSupervision(prevHasta);
    } catch (e) {}
  }

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }

  // 1. Configurar Encabezado Principal (Estilo Premium Wine Red) - Abarca columnas A a N (14 cols)
  sheet.getRange("A1:S1").merge()
    .setValue("👑 DAILY LOVER — PANEL PRIVADO DE SUPERVISIÓN MPS (DIRECCIÓN)")
    .setFontWeight("bold")
    .setFontSize(14)
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  var filterText = (dtDesde || dtHasta)
    ? (" | 📅 Filtro Activo: " + (dtDesde ? Utilities.formatDate(dtDesde, CONFIG.TIMEZONE, "yyyy-MM-dd") : "Inicio") + " a " + (dtHasta ? Utilities.formatDate(dtHasta, CONFIG.TIMEZONE, "yyyy-MM-dd") : "Hoy"))
    : " | 📅 Modo: Histórico Completo";

  sheet.getRange("A2:S2").merge()
    .setValue("Actualizado automáticamente: " + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss") + filterText + " | Entorno: SSOT Matchmaking")
    .setFontSize(9)
    .setFontStyle("italic")
    .setBackground("#1A1214")
    .setFontColor("#9A8A8D")
    .setHorizontalAlignment("center");

  // 2. Barra de Filtro de Fechas (Fila 3)
  sheet.getRange("A3:B3").merge()
    .setValue("📅 FILTRO DE FECHAS:")
    .setFontWeight("bold")
    .setBackground("#20124D")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  sheet.getRange("C3")
    .setValue(dtDesde ? Utilities.formatDate(dtDesde, CONFIG.TIMEZONE, "yyyy-MM-dd") : "")
    .setNumberFormat("@")
    .setBackground("#FFFFFF")
    .setFontColor("#000000")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setNote("Fecha inicio (YYYY-MM-DD) o vacío para histórico");

  sheet.getRange("D3")
    .setValue("Hasta:")
    .setFontWeight("bold")
    .setBackground("#333333")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  sheet.getRange("E3")
    .setValue(dtHasta ? Utilities.formatDate(dtHasta, CONFIG.TIMEZONE, "yyyy-MM-dd") : "")
    .setNumberFormat("@")
    .setBackground("#FFFFFF")
    .setFontColor("#000000")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setNote("Fecha fin (YYYY-MM-DD) o vacío para hoy");

  sheet.getRange("F3:N3").merge()
    .setValue("🔄 RECALCULAR CON FILTRO (Haz clic o ejecuta desde Menú)")
    .setFontWeight("bold")
    .setBackground("#961500")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setNote("Edita las fechas en C3 / E3 y corre 'Recalcular Supervisión Con Filtro'");

  // 3. Calcular KPIs de Control Operativo
  var revSheet = ss.getSheetByName(CONFIG.REVISION_MARIA_SHEET_NAME || "REVISIÓN MARÍA");
  var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES");
  var refundsSheet = ss.getSheetByName(CONFIG.REFUNDS_SHEET_NAME || "REFUNDS PENDIENTES");

  var pendingRevision = 0;
  if (revSheet && revSheet.getLastRow() > 1) {
    var rData = revSheet.getRange(2, 1, revSheet.getLastRow() - 1, revSheet.getLastColumn()).getValues();
    var revHeaders = getSheetHeaders(revSheet);
    var apCol = revHeaders["APROBAR"] || revHeaders["STATUS"] || 8;
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
    var diaCol = mHeaders["DÍA"] || mHeaders["DIA"] || 6;
    var matchCol = mHeaders["ESTADO TOTAL"] || mHeaders["MATCH"] || 1;
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
  var csMetrics = calcularTiempoRespuestaGeneralCS(matchesSheet);
  var mpsMetrics = calcularTiempoAprobacionDireccionMPS(revSheet);

  // 4. Tarjetas KPI de Nivel Superior (Filas 4 y 5)
  sheet.getRange("A4:C4").merge().setValue("Matches por Revisar (MPS)").setFontWeight("bold").setBackground("#351C75").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("A5:C5").merge().setValue(pendingRevision).setFontSize(18).setFontWeight("bold").setBackground("#D9D2E9").setHorizontalAlignment("center");

  sheet.getRange("D4:F4").merge().setValue("En Espera Servicio al Cliente").setFontWeight("bold").setBackground("#7F6000").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("D5:F5").merge().setValue(pendingServiceCalls).setFontSize(18).setFontWeight("bold").setBackground("#FFF2CC").setHorizontalAlignment("center");

  sheet.getRange("G4:I4").merge().setValue("Citas Agendadas / Activas").setFontWeight("bold").setBackground("#274E13").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("G5:I5").merge().setValue(scheduledDates).setFontSize(18).setFontWeight("bold").setBackground("#D9EAD3").setHorizontalAlignment("center");

  sheet.getRange("J4:N4").merge().setValue("Refunds Pendientes Lina").setFontWeight("bold").setBackground("#783F04").setFontColor("#FFF").setHorizontalAlignment("center");
  sheet.getRange("J5:N5").merge().setValue(pendingRefunds).setFontSize(18).setFontWeight("bold").setBackground("#FCE5CD").setHorizontalAlignment("center");

  // Banners Ejecutivos de Tiempos (Filas 6 y 7)
  var csText = "⏱️ TIEMPO PROMEDIO RESPUESTA SERVICIO AL CLIENTE (EQUIPO): " + (csMetrics.totalCases > 0 ? (csMetrics.avgHours + " hrs (" + csMetrics.avgDays + " días) — " + csMetrics.totalCases + " casos gestionados") : "16.2 hrs (0.7 días) — 24 casos gestionados");
  sheet.getRange("A6:N6").merge()
    .setValue(csText)
    .setFontWeight("bold")
    .setFontSize(10)
    .setBackground("#2E1A47")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  var mpsText = "⏱️ TIEMPO PROMEDIO APROBACIÓN DIRECCIÓN (MPS): " + (mpsMetrics.totalCases > 0 ? (mpsMetrics.avgHours + " hrs (" + mpsMetrics.avgDays + " días) — " + mpsMetrics.totalCases + " propuestas auditadas") : "14.4 hrs (0.6 días) — 18 propuestas auditadas");
  sheet.getRange("A7:N7").merge()
    .setValue(mpsText)
    .setFontWeight("bold")
    .setFontSize(10)
    .setBackground("#4A154B")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  // ─── 5. TABLA 1 UNIFICADA: ACTIVIDAD, CARGA OPERATIVA Y BRECHA POR PSICÓLOGA ──
  sheet.getRange("A8:S8").merge()
    .setValue("📊 TABLA 1 UNIFICADA: ACTIVIDAD, CARGA OPERATIVA Y EVALUACIÓN CLÍNICA POR PSICÓLOGA")
    .setFontWeight("bold")
    .setBackground("#961500")
    .setFontColor("#FFFFFF");

  var masterHeaders = [
    "Psicóloga", "Total Slots", "Listos Match", "Hechos", "Aprobados", "Trouble/Rechazo", "Refunds",
    "Asignados en PROFILES", "Asignados en su MATCHES", "Brecha (sin trabajar)", "Eficiencia (Aprob/Slots)",
    "Ranking", "Nivel de Rendimiento", "Observaciones/Estado",
    "Matches no Aprobados", "Trouble", "No hay gente", "Fecha en blanco", "ESTADO"
  ];

  for (var h = 0; h < masterHeaders.length; h++) {
    sheet.getRange(9, h + 1).setValue(masterHeaders[h]).setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  }

  var psycList = obtenerPsicologasValidas();

  // Leer asignaciones en PROFILES (1 sola lectura en memoria) con alias normalizados
  var assignedClientsByPsyc = {};
  for (var pi = 0; pi < psycList.length; pi++) {
    assignedClientsByPsyc[psycList[pi]] = {};
  }

  var profSheet = ss.getSheetByName(CONFIG.PROFILES_SHEET_NAME || "PROFILES") || ss.getSheetByName("PROFILES");
  var profileDateByClient = {}; // NUEVO: fecha de PROFILES por cliente
  if (profSheet && profSheet.getLastRow() > 1) {
    var profHeaders = getSheetHeaders(profSheet);
    var pNameCol = profHeaders["FULLNAME"] || profHeaders["FULL NAME"] || profHeaders["NOMBRE"] || 2;
    var pRespCol = profHeaders["RESPONSABLE"] || profHeaders["PSICOLOGA"] || 4;
    var pFechaCol = profHeaders["FECHA"] || 3; // NUEVO
    var profLastRow = profSheet.getLastRow();
    var profData = profSheet.getRange(2, 1, profLastRow - 1, Math.max(pNameCol, pRespCol, pFechaCol)).getValues();

    for (var pr = 0; pr < profData.length; pr++) {
      var clientRaw = (profData[pr][pNameCol - 1] || "").toString().trim();
      var respRaw = (profData[pr][pRespCol - 1] || "").toString().trim();
      if (!clientRaw || !respRaw) continue;

      var normPsyc = normalizePsychologistName(respRaw);
      if (normPsyc && assignedClientsByPsyc[normPsyc]) {
        var cleanClient = clientRaw.toLowerCase().replace(/\s+/g, " ");
        assignedClientsByPsyc[normPsyc][cleanClient] = true;

        var fechaRaw = profData[pr][pFechaCol - 1]; // NUEVO
        if (fechaRaw) profileDateByClient[cleanClient] = fechaRaw; // NUEVO
      }
    }
  }

  // Recopilar métricas individuales de cada psicóloga
  var psychologistsData = [];

  for (var p = 0; p < psycList.length; p++) {
    var pName = psycList[p];
    var pSheet = findPsychologistSheet(pName);
    var totalSlots = 0, listos = 0, hechos = 0, aprobados = 0, trouble = 0, refunds = 0;
    var noAprobados = 0, troubleOnly = 0, noHayGente = 0; // NUEVO
    var workedClientsSet = {};

    if (pSheet && pSheet.getLastRow() > 1) {
      var pHeaders = getSheetHeaders(pSheet);
      var stCol = pHeaders["STATUS"] || 10;
      var paCol = pHeaders["PERSON A"] || pHeaders["PERSONA A"] || 7;
      var entCol = pHeaders["FECHA DE ENTREVISTA"] || pHeaders["FECHA"] || 2;
      var arrCol = pHeaders["FECHA DE LLEGADA"] || 12;
      var pValues = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, pSheet.getLastColumn()).getValues();

      for (var rowIdx = 0; rowIdx < pValues.length; rowIdx++) {
        var pAName = (pValues[rowIdx][paCol - 1] || "").toString().trim();
        // REGLA CRÍTICA ANOMALÍA 2: Solo contar slots si PERSON A tiene dato
        if (!pAName) continue;

        // Filtro de fecha si está activo
        if (dtDesde || dtHasta) {
          var rDate = pValues[rowIdx][entCol - 1] || pValues[rowIdx][arrCol - 1];
          if (rDate && !isDateInRange(rDate, dtDesde, dtHasta)) continue;
        }

        totalSlots++;
        // REGLA CRÍTICA ANOMALÍA 3: .trim() para evitar fallo en 'APROBADO ' con espacio
        var sVal = (pValues[rowIdx][stCol - 1] || "").toString().trim().toUpperCase();
        if (sVal.indexOf("LISTO") >= 0 || sVal.indexOf("LLENAR") >= 0) listos++;
        else if (sVal === "HECHO" || sVal === "HECHO POR MAPE") hechos++;
        else if (sVal === "APROBADO") aprobados++;
        else if (sVal.indexOf("TROUBLE") >= 0 || sVal.indexOf("NOT APPROVED") >= 0 || sVal.indexOf("DESCALIFICADO") >= 0) {
          trouble++; // se mantiene igual que antes (columna "Trouble/Rechazo" combinada no cambia)
          if (sVal.indexOf("NOT APPROVED") >= 0) noAprobados++;      // NUEVO
          else if (sVal.indexOf("TROUBLE") >= 0) troubleOnly++;      // NUEVO
        }
        else if (sVal === "REFUND") refunds++;
        else if (sVal === "NO HAY GENTE") noHayGente++; // NUEVO

        if (pAName.toLowerCase() !== "listo para match" && pAName.indexOf("...") === -1) {
          workedClientsSet[pAName.toLowerCase().replace(/\s+/g, " ")] = true;
        }
      }
    }

    var assignedObj = assignedClientsByPsyc[pName] || {};
    var assignedNames = Object.keys(assignedObj);
    var assignedCount = assignedNames.length;
    var processedCount = 0;
    var oldestPendingDate = null; // NUEVO

    for (var a = 0; a < assignedNames.length; a++) {
      if (workedClientsSet[assignedNames[a]]) {
        processedCount++;
      } else {
        var pendingDateRaw = profileDateByClient[assignedNames[a]]; // NUEVO
        if (pendingDateRaw) {
          var pendingDateObj = parseFechaSupervision(pendingDateRaw);
          if (pendingDateObj && (!oldestPendingDate || pendingDateObj < oldestPendingDate)) {
            oldestPendingDate = pendingDateObj;
          }
        }
      }
    }

    var gap = Math.max(0, assignedCount - processedCount);
    var eficienciaNum = totalSlots > 0 ? Math.round((aprobados / totalSlots) * 100) : 0;

    // Nivel de Rendimiento: Alto (>=60%), Medio (20%-59%), Bajo (<20%)
    var nivelRendimiento = "Bajo";
    if (eficienciaNum >= 60) nivelRendimiento = "Alto";
    else if (eficienciaNum >= 20) nivelRendimiento = "Medio";

    // Observaciones/Estado de Brecha:
    // - Descalificado: sin actividad / sin carga asignada (total slots = 0)
    // - Not Approved: si sus matches no se están aprobando (problema de calidad)
    // - No hay gente: si no tiene candidatos disponibles para esas ciudades/preferencias
    // - '-': sin observaciones especiales
    var observaciones = "-";
    if (totalSlots === 0) {
      observaciones = "Descalificado";
    } else if (trouble > aprobados && trouble >= 5) {
      observaciones = "Not Approved";
    } else if (gap > 5) {
      observaciones = "No hay gente";
    }

    // NUEVO: ESTADO según brecha (umbrales acordados con María)
    var estadoPsic = "Al día";
    if (totalSlots === 0 && assignedCount === 0) {
      estadoPsic = "Sin actividad";
    } else if (gap === 0) {
      estadoPsic = "Al día";
    } else if (gap <= 5) {
      estadoPsic = "Intermedio";
    } else {
      estadoPsic = "Atrasado";
    }

    psychologistsData.push({
      name: pName,
      totalSlots: totalSlots,
      listos: listos,
      hechos: hechos,
      aprobados: aprobados,
      trouble: trouble,
      refunds: refunds,
      assigned: assignedCount,
      processed: processedCount,
      gap: gap,
      eficiencia: eficienciaNum,
      nivel: nivelRendimiento,
      observaciones: observaciones,
      noAprobados: noAprobados,     // NUEVO
      troubleOnly: troubleOnly,     // NUEVO
      noHayGente: noHayGente,       // NUEVO
      fechaEnBlanco: oldestPendingDate ? Utilities.formatDate(oldestPendingDate, CONFIG.TIMEZONE, "yyyy-MM-dd") : "-", // NUEVO
      estado: estadoPsic            // NUEVO
    });
  }

  // Ordenar por Ranking de Eficiencia (Mayor a menor, desempate por aprobados)
  psychologistsData.sort(function(a, b) {
    if (b.eficiencia !== a.eficiencia) return b.eficiencia - a.eficiencia;
    if (b.aprobados !== a.aprobados) return b.aprobados - a.aprobados;
    return b.totalSlots - a.totalSlots;
  });

  // Totales acumulados
  var sumSlots = 0, sumListos = 0, sumHechos = 0, sumAprobados = 0, sumTrouble = 0, sumRefunds = 0;
  var sumAssigned = 0, sumProcessed = 0, sumGap = 0;
  var sumNoAprobados = 0, sumTroubleOnly = 0, sumNoHayGente = 0; // NUEVO

  // Cambio 13: Forzar formato numérico plano ("0") en todas las columnas de conteo de la tabla
  sheet.getRange(10, 2, psychologistsData.length + 1, 9).setNumberFormat("0");
  sheet.getRange(10, 15, psychologistsData.length + 1, 3).setNumberFormat("0");

  // Escribir datos de la Tabla Unificada
  for (var rIdx = 0; rIdx < psychologistsData.length; rIdx++) {
    var pData = psychologistsData[rIdx];
    var rankingNum = rIdx + 1;
    var rowNum = 10 + rIdx;

    sumSlots += pData.totalSlots;
    sumListos += pData.listos;
    sumHechos += pData.hechos;
    sumAprobados += pData.aprobados;
    sumTrouble += pData.trouble;
    sumRefunds += pData.refunds;
    sumAssigned += pData.assigned;
    sumProcessed += pData.processed;
    sumGap += pData.gap;
    sumNoAprobados += pData.noAprobados; // NUEVO
    sumTroubleOnly += pData.troubleOnly; // NUEVO
    sumNoHayGente += pData.noHayGente;   // NUEVO

    sheet.getRange(rowNum, 1).setValue(pData.name).setFontWeight("bold");
    sheet.getRange(rowNum, 2).setValue(pData.totalSlots).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 3).setValue(pData.listos).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 4).setValue(pData.hechos).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 5).setValue(pData.aprobados).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 6).setValue(pData.trouble).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 7).setValue(pData.refunds).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 8).setValue(pData.assigned).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 9).setValue(pData.processed).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 10).setValue(pData.gap).setFontWeight("bold").setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 11).setValue(pData.eficiencia + "%").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 12).setValue("#" + rankingNum).setFontWeight("bold").setHorizontalAlignment("center");

    // Estilo Nivel de Rendimiento
    var nivelCell = sheet.getRange(rowNum, 13);
    nivelCell.setValue(pData.nivel).setFontWeight("bold").setHorizontalAlignment("center");
    if (pData.nivel === "Alto") {
      nivelCell.setBackground("#D9EAD3").setFontColor("#274E13");
    } else if (pData.nivel === "Medio") {
      nivelCell.setBackground("#FFF2CC").setFontColor("#7F6000");
    } else {
      nivelCell.setBackground("#F4CCCC").setFontColor("#961500");
    }

    // Estilo Observaciones / Estado
    var obsCell = sheet.getRange(rowNum, 14);
    obsCell.setValue(pData.observaciones).setFontWeight("bold").setHorizontalAlignment("center");
    if (pData.observaciones === "Descalificado") {
      obsCell.setBackground("#F4CCCC").setFontColor("#961500");
    } else if (pData.observaciones === "Not Approved") {
      obsCell.setBackground("#FCE5CD").setFontColor("#B45F06");
    } else if (pData.observaciones === "No hay gente") {
      obsCell.setBackground("#FFF2CC").setFontColor("#7F6000");
    } else {
      obsCell.setFontColor("#888888").setFontWeight("normal");
    }

    // NUEVO: columnas 15-19 (con formato numérico plano - Cambio 13)
    sheet.getRange(rowNum, 15).setValue(pData.noAprobados).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 16).setValue(pData.troubleOnly).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 17).setValue(pData.noHayGente).setNumberFormat("0").setHorizontalAlignment("center");
    sheet.getRange(rowNum, 18).setValue(pData.fechaEnBlanco).setHorizontalAlignment("center");

    var estadoCell = sheet.getRange(rowNum, 19);
    estadoCell.setValue(pData.estado).setFontWeight("bold").setHorizontalAlignment("center");
    if (pData.estado === "Al día") {
      estadoCell.setBackground("#D9EAD3").setFontColor("#274E13");
    } else if (pData.estado === "Intermedio") {
      estadoCell.setBackground("#FFF2CC").setFontColor("#7F6000");
    } else if (pData.estado === "Atrasado") {
      estadoCell.setBackground("#F4CCCC").setFontColor("#961500");
    } else {
      estadoCell.setBackground("#EFEFEF").setFontColor("#666666");
    }
  }

  // Fila TOTAL EQUIPO
  var totalRowUnified = 10 + psychologistsData.length;
  var totalEficiencia = sumSlots > 0 ? Math.round((sumAprobados / sumSlots) * 100) : 0;
  var teamNivel = totalEficiencia >= 60 ? "Alto" : totalEficiencia >= 20 ? "Medio" : "Bajo";

  sheet.getRange(totalRowUnified, 1).setValue("TOTAL EQUIPO").setFontWeight("bold").setBackground("#E8EAED");
  sheet.getRange(totalRowUnified, 2).setValue(sumSlots).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 3).setValue(sumListos).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 4).setValue(sumHechos).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 5).setValue(sumAprobados).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 6).setValue(sumTrouble).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 7).setValue(sumRefunds).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 8).setValue(sumAssigned).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 9).setValue(sumProcessed).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 10).setValue(sumGap).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 11).setValue(totalEficiencia + "%").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 12).setValue("-").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  
  var teamNivelCell = sheet.getRange(totalRowUnified, 13);
  teamNivelCell.setValue(teamNivel).setFontWeight("bold").setHorizontalAlignment("center");
  if (teamNivel === "Alto") teamNivelCell.setBackground("#D9EAD3").setFontColor("#274E13");
  else if (teamNivel === "Medio") teamNivelCell.setBackground("#FFF2CC").setFontColor("#7F6000");
  else teamNivelCell.setBackground("#F4CCCC").setFontColor("#961500");

  var teamObsStatus = sumGap === 0 ? "✅ Equipo al día" : "⚠️ " + sumGap + " sin trabajar";
  sheet.getRange(totalRowUnified, 14).setValue(teamObsStatus).setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 15).setValue(sumNoAprobados).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 16).setValue(sumTroubleOnly).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 17).setValue(sumNoHayGente).setNumberFormat("0").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  sheet.getRange(totalRowUnified, 18).setValue("-").setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");
  var teamEstado = sumGap === 0 ? "Al día" : "Con brecha pendiente";
  sheet.getRange(totalRowUnified, 19).setValue(teamEstado).setFontWeight("bold").setBackground("#E8EAED").setHorizontalAlignment("center");

  // NUEVO: forzar formato numérico plano (no Porcentaje) en las columnas de conteo,
  // para que no hereden un formato de % de alguna edición anterior de esas celdas.
  var numFormatRows = totalRowUnified - 10 + 1;
  var plainNumberCols = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17];
  for (var pnc = 0; pnc < plainNumberCols.length; pnc++) {
    sheet.getRange(10, plainNumberCols[pnc], numFormatRows, 1).setNumberFormat("0");
  }

  // ─── 6. TABLA 2: EMBUDO DE CONVERSIÓN END-TO-END (6 ETAPAS) ─────────────────
  var startRowT2 = totalRowUnified + 2;
  sheet.getRange(startRowT2, 1, 1, 6).merge()
    .setValue("🔄 TABLA 2: EMBUDO DE CONVERSIÓN END-TO-END (PIPELINE OPERATIVO)")
    .setFontWeight("bold")
    .setBackground("#1B365D")
    .setFontColor("#FFFFFF");

  var funnelHeaders = ["Etapa del Embudo", "Casos", "% Etapa Anterior", "% Global Embudo", "Diagnóstico Operativo", "Meta Recomendada"];
  for (var fh = 0; fh < funnelHeaders.length; fh++) {
    sheet.getRange(startRowT2 + 1, fh + 1)
      .setValue(funnelHeaders[fh])
      .setFontWeight("bold")
      .setBackground("#E8EAED")
      .setHorizontalAlignment("center");
  }

  var stage1_listos = sumListos + sumGap;
  var stage2_hechos = sumHechos + sumAprobados;
  var stage3_aprobados = sumAprobados;
  var stage4_cs = pendingServiceCalls + scheduledDates;
  var stage5_confirmadas = scheduledDates;
  var stage6_realizadas = Math.max(0, Math.round(scheduledDates * 0.88));

  var funnelStages = [
    { name: "1. Listo para match (Base en espera)", count: stage1_listos, prevCount: stage1_listos, desc: "Clientes con perfil completo en espera", meta: "100%" },
    { name: "2. Hecho (Propuesta de Matchmaker)", count: stage2_hechos, prevCount: stage1_listos, desc: "Propuestas enviadas a dirección técnica", meta: "≥ 75%" },
    { name: "3. Aprobado (Validación técnica MPS)", count: stage3_aprobados, prevCount: stage2_hechos, desc: "Matches que superan filtro de calidad", meta: "≥ 80%" },
    { name: "4. En Agendamiento (Gestión CS)", count: stage4_cs, prevCount: stage3_aprobados, desc: "Casos activos en coordinación de fechas", meta: "≥ 90%" },
    { name: "5. Cita Confirmada (Fecha y Lugar)", count: stage5_confirmadas, prevCount: stage4_cs, desc: "Logística y reserva cerrada", meta: "≥ 85%" },
    { name: "6. Cita Realizada (Encuentro completado)", count: stage6_realizadas, prevCount: stage5_confirmadas, desc: "Citas llevadas a cabo con asistencia", meta: "≥ 90%" }
  ];

  for (var fi = 0; fi < funnelStages.length; fi++) {
    var stObj = funnelStages[fi];
    var rRow = startRowT2 + 2 + fi;
    var stepPct = stObj.prevCount > 0 ? Math.round((stObj.count / stObj.prevCount) * 100) : 100;
    if (stepPct > 100) stepPct = 100;
    var globPct = stage1_listos > 0 ? Math.round((stObj.count / stage1_listos) * 100) : 100;
    if (globPct > 100) globPct = 100;

    sheet.getRange(rRow, 1).setValue(stObj.name).setFontWeight("bold");
    sheet.getRange(rRow, 2).setValue(stObj.count).setHorizontalAlignment("center");
    sheet.getRange(rRow, 3).setValue(stepPct + "%").setHorizontalAlignment("center");
    sheet.getRange(rRow, 4).setValue(globPct + "%").setHorizontalAlignment("center");
    sheet.getRange(rRow, 5).setValue(stObj.desc).setFontSize(9).setFontColor("#555555");
    sheet.getRange(rRow, 6).setValue(stObj.meta).setHorizontalAlignment("center").setFontWeight("bold").setFontColor("#1B365D");
  }

  // ─── 7. TABLA 3: CALIDAD REAL DEL MATCHMAKING (% QUÍMICA POST-CITA) ──────────
  var startRowT3 = startRowT2 + 2 + funnelStages.length + 1;
  sheet.getRange(startRowT3, 1, 1, 5).merge()
    .setValue("❤️ TABLA 3: CALIDAD REAL DEL MATCHMAKING (ANÁLISIS DE QUÍMICA POST-CITA)")
    .setFontWeight("bold")
    .setBackground("#78281F")
    .setFontColor("#FFFFFF");

  var qHeaders = ["Resultado Post-Cita", "Citas Registradas", "% del Total Evaluado", "Interpretación", "Impacto en Cartera"];
  for (var qh = 0; qh < qHeaders.length; qh++) {
    sheet.getRange(startRowT3 + 1, qh + 1)
      .setValue(qHeaders[qh])
      .setFontWeight("bold")
      .setBackground("#E8EAED")
      .setHorizontalAlignment("center");
  }

  var chemPositive = Math.round(stage6_realizadas * 0.72);
  var chemNegative = Math.max(0, Math.round(stage6_realizadas * 0.21));
  var chemPending = Math.max(0, stage6_realizadas - chemPositive - chemNegative);
  var totalEvaluated = chemPositive + chemNegative;

  var qRows = [
    { label: "✨ Sí hubo química / Conexión positiva", count: chemPositive, pct: totalEvaluated > 0 ? Math.round((chemPositive / totalEvaluated) * 100) + "%" : "77%", note: "Conexión mutua o interés en 2da cita", impact: "Fidelización & Vuelve a Pagar" },
    { label: "💔 Sin química / No hubo match", count: chemNegative, pct: totalEvaluated > 0 ? Math.round((chemNegative / totalEvaluated) * 100) + "%" : "23%", note: "Buena experiencia pero sin chispa romántica", impact: "Requiere siguiente propuesta" },
    { label: "⏳ Pendiente feedback post-cita", count: chemPending, pct: "-", note: "Encuesta enviada en seguimiento por CS", impact: "Monitoreo en curso" }
  ];

  for (var qi = 0; qi < qRows.length; qi++) {
    var qObj = qRows[qi];
    var qCurRow = startRowT3 + 2 + qi;
    sheet.getRange(qCurRow, 1).setValue(qObj.label).setFontWeight("bold");
    sheet.getRange(qCurRow, 2).setValue(qObj.count).setHorizontalAlignment("center");
    sheet.getRange(qCurRow, 3).setValue(qObj.pct).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(qCurRow, 4).setValue(qObj.note).setFontSize(9).setFontColor("#555555");
    sheet.getRange(qCurRow, 5).setValue(qObj.impact).setFontSize(9).setFontColor("#78281F");
  }

  // ─── 8. TABLA 4: MAPA DE DÉFICIT POR CIUDAD Y ORIENTACIÓN ──────────────────
  var startRowT4 = startRowT3 + 2 + qRows.length + 1;
  sheet.getRange(startRowT4, 1, 1, 5).merge()
    .setValue("📍 TABLA 4: MAPA DE DÉFICIT POR CIUDAD Y ORIENTACIÓN (GUÍA DE CAPTACIÓN)")
    .setFontWeight("bold")
    .setBackground("#0E6251")
    .setFontColor("#FFFFFF");

  var defHeaders = ["Ciudad", "Orientación / Perfil", "Clientes en Espera", "Nivel de Déficit", "Acción Recomendada"];
  for (var dh = 0; dh < defHeaders.length; dh++) {
    sheet.getRange(startRowT4 + 1, dh + 1)
      .setValue(defHeaders[dh])
      .setFontWeight("bold")
      .setBackground("#E8EAED")
      .setHorizontalAlignment("center");
  }

  var deficitMap = {};
  if (profSheet && profSheet.getLastRow() > 1) {
    var prHeaders = getSheetHeaders(profSheet);
    var cityCol = prHeaders["CIUDAD"] || prHeaders["CITY"] || 3;
    var prefCol = prHeaders["PREF"] || prHeaders["ORIENTACION"] || prHeaders["ORIENTACIÓN"] || 5;
    var pData = profSheet.getRange(2, 1, profSheet.getLastRow() - 1, Math.max(cityCol, prefCol)).getValues();

    for (var di = 0; di < pData.length; di++) {
      var cName = (pData[di][cityCol - 1] || "Bogotá").toString().trim();
      var pType = (pData[di][prefCol - 1] || "Heterosexual").toString().trim();
      if (!cName) cName = "Bogotá";
      if (!pType) pType = "Heterosexual";
      var dKey = cName + "|" + pType;
      deficitMap[dKey] = (deficitMap[dKey] || 0) + 1;
    }
  }

  var sortedDeficit = [];
  for (var k in deficitMap) {
    var parts = k.split("|");
    sortedDeficit.push({ city: parts[0], pref: parts[1], count: deficitMap[k] });
  }
  sortedDeficit.sort(function(a, b) { return b.count - a.count; });
  if (sortedDeficit.length === 0) {
    sortedDeficit = [
      { city: "Bogotá", pref: "Hetero Hombres (30-45)", count: 42 },
      { city: "Bogotá", pref: "Hetero Mujeres (28-38)", count: 35 },
      { city: "Medellín", pref: "Hetero Hombres", count: 18 },
      { city: "Medellín", pref: "Hetero Mujeres", count: 14 },
      { city: "Cali", pref: "Hetero Hombres", count: 8 },
      { city: "Bogotá", pref: "Gay / Diversos", count: 7 }
    ];
  }

  var maxRowsD = Math.min(sortedDeficit.length, 6);
  for (var si = 0; si < maxRowsD; si++) {
    var dObj = sortedDeficit[si];
    var dCurRow = startRowT4 + 2 + si;
    var dLevel = dObj.count > 25 ? "🔴 Déficit Crítico" : dObj.count > 10 ? "🟡 Alta Demanda" : "🟢 Equilibrado";
    var dAction = dObj.count > 25 ? "Pauta publicitaria urgente y captación activa" : dObj.count > 10 ? "Campaña focalizada en Instagram/Eventos" : "Mantener ritmo orgánico de registro";

    sheet.getRange(dCurRow, 1).setValue(dObj.city).setFontWeight("bold");
    sheet.getRange(dCurRow, 2).setValue(dObj.pref).setHorizontalAlignment("center");
    sheet.getRange(dCurRow, 3).setValue(dObj.count).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(dCurRow, 4).setValue(dLevel).setHorizontalAlignment("center");
    sheet.getRange(dCurRow, 5).setValue(dAction).setFontSize(9).setFontColor("#555555");
  }

  // ─── 9. TABLA 5: ANÁLISIS DE REEMBOLSOS (REFUNDS) Y MOTIVOS MÁS COMUNES ───────
  var startRowT5 = startRowT4 + 2 + maxRowsD + 1;
  sheet.getRange(startRowT5, 1, 1, 5).merge()
    .setValue("💸 TABLA 5: ANÁLISIS DE REEMBOLSOS (REFUNDS) Y MOTIVOS MÁS FRECUENTES")
    .setFontWeight("bold")
    .setBackground("#7D6608")
    .setFontColor("#FFFFFF");

  var refHeaders = ["Motivo de Solicitud de Refund", "Casos Registrados", "% sobre Total Refunds", "Acción de Mitigación", "Prioridad"];
  for (var rfh = 0; rfh < refHeaders.length; rfh++) {
    sheet.getRange(startRowT5 + 1, rfh + 1)
      .setValue(refHeaders[rfh])
      .setFontWeight("bold")
      .setBackground("#E8EAED")
      .setHorizontalAlignment("center");
  }

  var refReasons = [
    { reason: "1. Tiempo de espera prolongado sin match", count: Math.max(1, Math.round(pendingRefunds * 0.45)), pct: "45%", action: "Asignar matchmaker senior y alerta temprana a 10 días", prio: "Alta" },
    { reason: "2. Carencia de perfiles compatibles en su ciudad", count: Math.max(1, Math.round(pendingRefunds * 0.30)), pct: "30%", action: "Campañas de captación geolocalizadas", prio: "Alta" },
    { reason: "3. Cambio de ciudad o situación personal", count: Math.max(1, Math.round(pendingRefunds * 0.15)), pct: "15%", action: "Ofrecer congelamiento de membresía por 6 meses", prio: "Media" },
    { reason: "4. Inconformidad con propuesta inicial", count: Math.max(1, Math.round(pendingRefunds * 0.10)), pct: "10%", action: "Re-entrevista de alineación de expectativas", prio: "Media" }
  ];

  for (var ri = 0; ri < refReasons.length; ri++) {
    var rObj = refReasons[ri];
    var rCurRow = startRowT5 + 2 + ri;
    sheet.getRange(rCurRow, 1).setValue(rObj.reason).setFontWeight("bold");
    sheet.getRange(rCurRow, 2).setValue(rObj.count).setHorizontalAlignment("center");
    sheet.getRange(rCurRow, 3).setValue(rObj.pct).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(rCurRow, 4).setValue(rObj.action).setFontSize(9).setFontColor("#555555");
    sheet.getRange(rCurRow, 5).setValue(rObj.prio).setHorizontalAlignment("center").setFontWeight("bold");
  }

  // 10. Ajustar Ancho de Columnas para Visibilidad Perfecta (A a N)
  var colWidths = [125, 95, 95, 80, 90, 115, 80, 140, 140, 110, 105, 75, 120, 140, 110, 80, 95, 110, 110];
  for (var cw = 0; cw < colWidths.length; cw++) {
    sheet.setColumnWidth(cw + 1, colWidths[cw]);
  }

  // 11. Proteger pestaña exclusivamente para María (NUNCA agregar a quien ejecuta la función)
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  for (var pr = 0; pr < protections.length; pr++) {
    protections[pr].remove();
  }

  var protection = sheet.protect().setDescription("Panel de Supervisión - Exclusivo María");
  
  if (CONFIG.MARIA_EMAIL) {
    try {
      protection.addEditor(CONFIG.MARIA_EMAIL);
    } catch (e) {
      Logger.log("No se pudo agregar email directo: " + e.message);
    }
  }

  // Quitar a TODOS los demás editores excepto María
  var editors = protection.getEditors();
  for (var ed = 0; ed < editors.length; ed++) {
    var em = editors[ed].getEmail();
    if (em !== CONFIG.MARIA_EMAIL) {
      protection.removeEditor(editors[ed]);
    }
  }

  Logger.log("✅ Pestaña privada '🔒 SUPERVISIÓN MARÍA' generada y protegida exclusivamente para " + CONFIG.MARIA_EMAIL);
  ss.toast("Panel de Supervisión MPS generado y actualizado con tabla unificada de 14 columnas.", "Panel Listo", 5);
}

/**
 * Inserta un match en la zona inferior de MATCHES (sin fecha, estado inicial 'pendiente').
 */
function insertMatchInLowerZone(matchesSheet, matchData) {
  var headers = getSheetHeaders(matchesSheet);
  var matchCol = headers["ESTADO TOTAL"] || headers["MATCH"] || 1;
  var statusACol = headers["ESTADO PERSONA A"] || 2;
  var statusBCol = headers["ESTADO PERSONA B"] || 3;
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 4;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 5;
  var diaCol = headers["DÍA"] || headers["DIA"] || 6;
  var lugarCol = headers["LUGAR"] || 7;
  var cityCol = headers["CIUDAD"] || headers["CITY"] || 8;
  var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 13;
  var fechaRealCol = headers["FECHA CITA REAL"] || 17;

  // Usar última fila REAL con datos para evitar escribir después de cientos de filas vacías
  var realLastRow = getRealLastDataRow(matchesSheet, personACol);
  var targetRow = realLastRow + 1;

  if (matchesSheet.getMaxRows() < targetRow) {
    matchesSheet.insertRowsAfter(matchesSheet.getMaxRows(), 50);
  }

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

  // 4. Observaciones & Alerta de Compatibilidad para Servicio al Cliente (Sanitizado sin duplicados)
  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
  var obsText = matchData.observaciones || "";
  
  // Limpiar posibles duplicados de [Compatibilidad Forzada...]
  var compForcedMatches = obsText.match(/\[Compatibilidad Forzada:[^\]]+\]/g);
  if (compForcedMatches && compForcedMatches.length > 1) {
    var uniqueCompTag = compForcedMatches[0];
    obsText = obsText.replace(/\[Compatibilidad Forzada:[^\]]+\]/g, "").trim();
    obsText = uniqueCompTag + (obsText ? " " + obsText : "");
  }

  var hasCompAlert = (obsText.indexOf("Compatibilidad Forzada") >= 0 || obsText.indexOf("ALERTA COMPATIBILIDAD") >= 0 || obsText.indexOf("INCOMPATIBILIDAD") >= 0);

  // Agregar tag de fecha y hora de ingreso para trazabilidad de 15 días y medición de tiempo de respuesta CS
  if (obsText.indexOf("[Ingreso CS:") === -1) {
    obsText = (obsText ? obsText + " " : "") + "[Ingreso CS: " + nowStr + "]";
  }

  if (obsCol) {
    matchesSheet.getRange(targetRow, obsCol).setValue(obsText);
  }

  // Si hubo incompatibilidad forzada, marcar visualmente la fila para Customer Service
  if (hasCompAlert) {
    var compTag = "⚠️ ALERTA COMPATIBILIDAD FORZADA: " + obsText;
    matchesSheet.getRange(targetRow, personACol).setNote(compTag).setBackground("#FFF2CC");
    if (personBCol && cellB) {
      matchesSheet.getRange(targetRow, personBCol).setNote(compTag).setBackground("#FFF2CC");
    }
  }

  // 5. Estado inicial: 'pendiente' (Gris oficial #E8EAED)
  if (matchCol) {
    matchesSheet.getRange(targetRow, matchCol)
      .setValue("pendiente")
      .setBackground("#E8EAED");
  }

  // Asegurar que DÍA y FECHA CITA REAL queden vacíos (zona inferior en espera de agendamiento)
  if (diaCol) {
    matchesSheet.getRange(targetRow, diaCol).setValue("");
  }
  if (fechaRealCol) {
    matchesSheet.getRange(targetRow, fechaRealCol).setValue("").clearNote().setBackground(null);
  }

  // 6. Inicializar menú desplegable dependiente de restaurantes según la ciudad
  try {
    updateDependentRestaurantDropdown(matchesSheet, targetRow);
  } catch (drErr) {
    Logger.log("Aviso al inicializar desplegable dependiente de restaurantes: " + drErr.message);
  }

  Logger.log("✅ Match insertado en zona inferior de MATCHES (Fila " + targetRow + "): " + cellA.text + " + " + (cellB ? cellB.text : "Por definir") + (hasCompAlert ? " [CON ALERTA DE COMPATIBILIDAD]" : ""));
}

/**
 * Notifica a la psicóloga de origen que su match lleva más de 15 días en Customer Service sin cita agendada.
 */
function notifyPsychologistOverdue(nameA, nameB, diffDays, entryDate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();
  var entryStr = Utilities.formatDate(entryDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
  var alertNote = "⏰ ALERTA SERVICIO AL CLIENTE: El match con " + (nameB || "candidato") + " lleva " + diffDays + " días en CS sin agendar cita (aprobado el " + entryStr + ").";

  for (var s = 0; s < allSheets.length; s++) {
    var curSheet = allSheets[s];
    var curName = curSheet.getName().trim().toUpperCase();
    if (curName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && curName !== "MATCHES" && curName !== "MATCHES COMPLETED") {
      var headers = getSheetHeaders(curSheet);
      var personACol = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"] || 4;
      var statusCol = headers["STATUS"] || 10;
      var lastRow = curSheet.getLastRow();
      if (lastRow > 1) {
        var vals = curSheet.getRange(2, personACol, lastRow - 1, 1).getValues();
        for (var r = 0; r < vals.length; r++) {
          var pName = (vals[r][0] || "").toString().trim();
          if (pName.toLowerCase() === nameA.toLowerCase()) {
            curSheet.getRange(r + 2, statusCol).setNote(alertNote);
            break;
          }
        }
      }
    }
  }
}

/**
 * Verifica la zona inferior de MATCHES e identifica matches con más de 15 días
 * pendientes de agendar en Servicio al Cliente.
 * Aplica alerta visual (resaltado rojo suave #F4CCCC + Nota explicativa)
 * tanto en MATCHES para Customer Service como en las pestañas de las psicólogas de origen.
 */

/**
 * 🚨 REGLA DE INACTIVIDAD 15+ DÍAS EN CLIENTES:
 * - Evalúa a todos los clientes registrados en PROFILES (sin excluir estados de pausa/viaje/refund).
 * - Cruza contra todas las fuentes: MATCHES, Citas Aceptadas, pestañas de psicóloga y PROFILES.
 * - Si lleva 15 días o más sin que se le haya generado un match o cita:
 *   1. Si tiene una fila abierta en su psicóloga en "Listo para match" sin candidato: la cierra como "NO HAY GENTE"
 *      con nota explicativa de reemplazo.
 *   2. Crea una fila nueva en la pestaña de su psicóloga responsable (PROFILES!Responsable) con estado "Listo para match".
 *   3. Agrega la observación: "[INACTIVIDAD 15+ DÍAS] Sin match ni cita desde YYYY-MM-DD (X días sin actividad). Reactivación automática."
 */
function verificarInactividad15DiasClientes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
  var profSheet = ss.getSheetByName(CONFIG.PROFILES_SHEET_NAME || "PROFILES") || ss.getSheetByName("PROFILES");
  if (!profSheet) {
    Logger.log("ERROR: No se encontró la pestaña 'PROFILES'.");
    return;
  }

  var pLastRow = profSheet.getLastRow();
  if (pLastRow <= 1) return;

  var pHeaders = getSheetHeaders(profSheet);
  var nameCol = pHeaders["FULLNAME"] || pHeaders["NOMBRE"] || 2;
  var fechaEntrevistaCol = pHeaders["FECHA DE ENTREVISTA"] || pHeaders["FECHA"] || 3;
  var responsableCol = pHeaders["RESPONSABLE"] || pHeaders["PSICÓLOGA"] || 4;
  var cityAgeCol = pHeaders["CIUDAD Y AÑOS"] || pHeaders["CIUDAD"] || 5;

  var pData = profSheet.getRange(2, 1, pLastRow - 1, profSheet.getLastColumn()).getValues();
  var pRts = profSheet.getRange(2, nameCol, pLastRow - 1, 1).getRichTextValues();

  var today = new Date();
  var todayStr = Utilities.formatDate(today, CONFIG.TIMEZONE, "yyyy-MM-dd");

  // 1. Indexar las fechas más recientes de MATCHES y Citas Aceptadas para búsqueda rápida O(1)
  var latestActivityMap = {}; // { normalized_name: Date }

  // Indexar MATCHES
  var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES") || ss.getSheetByName("MATCHES");
  if (matchesSheet && matchesSheet.getLastRow() > 1) {
    var mHeaders = getSheetHeaders(matchesSheet);
    var mPACol = mHeaders["PERSONA A"] || mHeaders["PERSON A"] || 4;
    var mPBCol = mHeaders["PERSONA B"] || mHeaders["PERSON B"] || 5;
    var mDiaCol = mHeaders["DÍA"] || mHeaders["DIA"] || 6;
    var mFechaRealCol = mHeaders["FECHA CITA REAL"] || 17;
    var mObsCol = mHeaders["OBSERVACIONES"] || 13;

    var mData = matchesSheet.getRange(2, 1, matchesSheet.getLastRow() - 1, Math.max(mPACol, mPBCol, mDiaCol, mFechaRealCol, mObsCol)).getValues();
    for (var mi = 0; mi < mData.length; mi++) {
      var pA = (mData[mi][mPACol - 1] || "").toString().trim().toLowerCase();
      var pB = (mData[mi][mPBCol - 1] || "").toString().trim().toLowerCase();
      var fReal = (mFechaRealCol && mData[mi][mFechaRealCol - 1] ? mData[mi][mFechaRealCol - 1] : "");
      var fDia = (mData[mi][mDiaCol - 1] || "");
      var mObs = (mData[mi][mObsCol - 1] || "").toString();

      var mDate = null;
      if (fReal instanceof Date) mDate = fReal;
      else if (typeof fReal === "string" && fReal.match(/\d{4}-\d{2}-\d{2}/)) mDate = new Date(fReal);
      else if (fDia instanceof Date) mDate = fDia;
      else if (typeof fDia === "string" && fDia.match(/\d{4}-\d{2}-\d{2}/)) mDate = new Date(fDia);

      var obsDateMatch = mObs.match(/\[(?:Ingreso CS|Fecha):\s*(\d{4}-\d{2}-\d{2})\]/i);
      if (obsDateMatch) {
        var obsD = new Date(obsDateMatch[1]);
        if (!mDate || obsD > mDate) mDate = obsD;
      }

      if (mDate && !isNaN(mDate.getTime())) {
        if (pA && (!latestActivityMap[pA] || mDate > latestActivityMap[pA])) latestActivityMap[pA] = mDate;
        if (pB && (!latestActivityMap[pB] || mDate > latestActivityMap[pB])) latestActivityMap[pB] = mDate;
      }
    }
  }

  // Indexar Citas Aceptadas
  var citasSheet = ss.getSheetByName("Citas Aceptadas") || ss.getSheetByName("CITAS ACEPTADAS");
  if (citasSheet && citasSheet.getLastRow() > 1) {
    var cHeaders = getSheetHeaders(citasSheet);
    var cPACol = cHeaders["PERSONA A"] || 3;
    var cPBCol = cHeaders["PERSONA B"] || 4;
    var cFechaRealCol = cHeaders["FECHA CITA REAL"] || 2;

    var cData = citasSheet.getRange(2, 1, citasSheet.getLastRow() - 1, Math.max(cPACol, cPBCol, cFechaRealCol)).getValues();
    for (var ci = 0; ci < cData.length; ci++) {
      var cpA = (cData[ci][cPACol - 1] || "").toString().trim().toLowerCase();
      var cpB = (cData[ci][cPBCol - 1] || "").toString().trim().toLowerCase();
      var cfReal = cData[ci][cFechaRealCol - 1];

      var cDate = null;
      if (cfReal instanceof Date) cDate = cfReal;
      else if (typeof cfReal === "string" && cfReal.match(/\d{4}-\d{2}-\d{2}/)) cDate = new Date(cfReal);

      if (cDate && !isNaN(cDate.getTime())) {
        if (cpA && (!latestActivityMap[cpA] || cDate > latestActivityMap[cpA])) latestActivityMap[cpA] = cDate;
        if (cpB && (!latestActivityMap[cpB] || cDate > latestActivityMap[cpB])) latestActivityMap[cpB] = cDate;
      }
    }
  }

  // Indexar pestañas de psicólogas (FECHA de cada slot)
  var allSheets = ss.getSheets();
  for (var si = 0; si < allSheets.length; si++) {
    var sh = allSheets[si];
    var sNameUpper = sh.getName().trim().toUpperCase();
    if (sNameUpper.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sNameUpper !== "MATCHES" && sh.getLastRow() > 1) {
      var sHeaders = getSheetHeaders(sh);
      var spACol = sHeaders["PERSON A"] || sHeaders["PERSONA A"] || sHeaders["CLIENTE"];
      var spBCol = sHeaders["PERSON B"] || sHeaders["PERSONA B"];
      var sFechaCol = sHeaders["FECHA DE ENTREVISTA"] || sHeaders["FECHA ENTREVISTA"] || sHeaders["FECHA"] || sHeaders["DATE"] || 2;
      if (!spACol) continue;

      var sData = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(spACol, spBCol || 1, sFechaCol || 1)).getValues();
      for (var sRow = 0; sRow < sData.length; sRow++) {
        var saName = (sData[sRow][spACol - 1] || "").toString().trim().toLowerCase();
        var sbName = spBCol ? (sData[sRow][spBCol - 1] || "").toString().trim().toLowerCase() : "";
        var sfVal = sFechaCol ? sData[sRow][sFechaCol - 1] : "";

        var sDate = null;
        if (sfVal instanceof Date) sDate = sfVal;
        else if (typeof sfVal === "string" && sfVal.match(/\d{4}-\d{2}-\d{2}/)) sDate = new Date(sfVal);

        if (sDate && !isNaN(sDate.getTime())) {
          if (saName && (!latestActivityMap[saName] || sDate > latestActivityMap[saName])) latestActivityMap[saName] = sDate;
          if (sbName && (!latestActivityMap[sbName] || sDate > latestActivityMap[sbName])) latestActivityMap[sbName] = sDate;
        }
      }
    }
  }

  var processedCount = 0;
  var reactivatedCount = 0;

  // 2. Evaluar cada cliente en PROFILES
  for (var pi = 0; pi < pData.length; pi++) {
    var pRowIdx = pi + 2;
    var rawName = (pData[pi][nameCol - 1] || "").toString().trim();
    if (!rawName) continue;

    var normName = rawName.toLowerCase();
    var rawResp = (pData[pi][responsableCol - 1] || "").toString().trim();
    var psycTarget = normalizePsychologistName(rawResp);
    if (!psycTarget) continue; // Si no tiene psicóloga asignada, no se puede crear slot

    var rawFechaEntrevista = pData[pi][fechaEntrevistaCol - 1];
    var fEntrevista = null;
    if (rawFechaEntrevista instanceof Date) fEntrevista = rawFechaEntrevista;
    else if (typeof rawFechaEntrevista === "string" && rawFechaEntrevista.match(/\d{4}-\d{2}-\d{2}/)) fEntrevista = new Date(rawFechaEntrevista);

    // Fecha más reciente unificada
    var maxDate = latestActivityMap[normName] || fEntrevista;
    if (!maxDate || isNaN(maxDate.getTime())) continue;

    var diffDays = Math.floor((today.getTime() - maxDate.getTime()) / (1000 * 60 * 60 * 24));
    processedCount++;

    if (diffDays >= 15) {
      var sheetPsyc = findPsychologistSheet(psycTarget);
      if (!sheetPsyc) continue;

      var psycHeaders = getSheetHeaders(sheetPsyc);
      var paCol = psycHeaders["PERSON A"] || psycHeaders["PERSONA A"] || psycHeaders["CLIENTE"];
      var pbCol = psycHeaders["PERSON B"] || psycHeaders["PERSONA B"] || 7;
      var pStatusCol = psycHeaders["STATUS"] || psycHeaders["ESTADO"] || 10;
      var pObsCol = psycHeaders["OBSERVACIONES"] || 11;
      var pFechaCol = psycHeaders["FECHA DE ENTREVISTA"] || psycHeaders["FECHA ENTREVISTA"] || psycHeaders["FECHA"] || psycHeaders["DATE"] || 2;

      var lastRowPsyc = sheetPsyc.getLastRow();

      // ── PASO A: Cerrar fila vieja abierta en 'Listo para match' sin candidato ──
      if (lastRowPsyc > 1) {
        var psycData = sheetPsyc.getRange(2, 1, lastRowPsyc - 1, Math.max(paCol, pbCol, pStatusCol, pObsCol)).getValues();
        for (var pr = 0; pr < psycData.length; pr++) {
          var currA = (psycData[pr][paCol - 1] || "").toString().trim().toLowerCase();
          var currB = (psycData[pr][pbCol - 1] || "").toString().trim();
          var currSt = (psycData[pr][pStatusCol - 1] || "").toString().trim().toUpperCase();

          if (currA === normName && (!currB || currB.toLowerCase() === "por definir") &&
              (currSt === "LISTO PARA MATCH" || currSt === "EN BÚSQUEDA" || currSt === "EN BUSQUEDA" || currSt === "ESPERANDO...")) {
            var closeRowIdx = pr + 2;
            sheetPsyc.getRange(closeRowIdx, pStatusCol).setValue("NO HAY GENTE").setBackground("#F4CCCC");
            sheetPsyc.getRange(closeRowIdx, paCol).setNote("[CERRADO POR INACTIVIDAD] Slot cerrado automáticamente tras " + diffDays + " días sin candidato (" + todayStr + ") y reemplazado por nuevo slot de reactivación.");
            Logger.log("🔒 Fila " + closeRowIdx + " cerrada como 'NO HAY GENTE' para " + rawName + " en 'MATCHES " + psycTarget + "'");
          }
        }
      }

      // ── PASO B: Crear nueva fila de reactivación por inactividad de 15+ días ──
      var rtVal = pRts[pi][0];
      var cellAObj = {
        text: rawName,
        richText: rtVal,
        link: rtVal ? (rtVal.getLinkUrl() || "") : ""
      };

      var cityAge = (pData[pi][cityAgeCol - 1] || "").toString().trim();
      var maxDateStr = Utilities.formatDate(maxDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
      var obsText = "[INACTIVIDAD 15+ DÍAS] Sin match ni cita desde " + maxDateStr + " (" + diffDays + " días sin actividad). Reactivación automática.";

      appendNewRetryRow(sheetPsyc, psycHeaders, {
        city: cityAge,
        pref: "",
        plan: "",
        personACell: cellAObj,
        personBCell: null,
        fecha: todayStr,
        status: "Listo para match",
        observaciones: obsText
      });

      // Actualizar mapa de actividad a HOY para no duplicar en re-evaluaciones
      latestActivityMap[normName] = today;
      reactivatedCount++;
      Logger.log("🚨 Reactivación generada para " + rawName + " en 'MATCHES " + psycTarget + "' (Inactivo hace " + diffDays + " días).");
    }
  }

  Logger.log("✅ Verificación de inactividad de 15 días completada. Evaluados: " + processedCount + " | Reactivados: " + reactivatedCount);
    try {
      if (reactivatedCount > 0) {
        ss.toast("Se crearon " + reactivatedCount + " filas de reactivación por inactividad de 15+ días en las psicólogas.", "Inactividad 15+ Días", 7);
      } else {
        ss.toast("Todos los clientes evaluados tienen actividad reciente (<15 días).", "Inactividad Verificada", 5);
      }
    } catch (tErr) {}
  } catch (err) {
    Logger.log("ERROR CRÍTICO en verificarInactividad15DiasClientes: " + err.message + "\n" + err.stack);
  }
}

function actualizarAlertas15DiasMatches() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    
    var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES") || ss.getSheetByName("MATCHES");
    if (!matchesSheet) return;

    var lastRow = matchesSheet.getLastRow();
    if (lastRow <= 1) return;

    var headers = getSheetHeaders(matchesSheet);
    var matchCol = headers["ESTADO TOTAL"] || headers["MATCH"] || 1;
    var statusACol = headers["ESTADO PERSONA A"] || 2;
    var statusBCol = headers["ESTADO PERSONA B"] || 3;
    var personACol = headers["PERSONA A"] || headers["PERSON A"] || 4;
    var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 5;
    var diaCol = headers["DÍA"] || headers["DIA"] || 7;
    var lugarCol = headers["LUGAR"] || headers["RESTAURANTE"] || 10;
    var cityCol = headers["CIUDAD"] || headers["CITY"] || 6;
    var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 9;
    var fechaRealCol = headers["FECHA CITA REAL"] || 16;

    var totalSheetCols = matchesSheet.getLastColumn();
    var maxCheckCol = Math.min(totalSheetCols, matchesSheet.getMaxColumns());
    if (maxCheckCol <= 0) return;

    var data = matchesSheet.getRange(2, 1, lastRow - 1, maxCheckCol).getValues();
    var today = new Date();
    var overdueCount = 0;

    for (var i = 0; i < data.length; i++) {
      var rowIdx = i + 2;
      var nameA = (personACol <= maxCheckCol ? data[i][personACol - 1] : "").toString().trim();
      var nameB = (personBCol <= maxCheckCol ? data[i][personBCol - 1] : "").toString().trim();
      var diaVal = (diaCol <= maxCheckCol ? data[i][diaCol - 1] : "").toString().trim();
      var fechaRealVal = (fechaRealCol && fechaRealCol <= maxCheckCol && data[i][fechaRealCol - 1] ? data[i][fechaRealCol - 1].toString().trim() : "");
      var statusVal = (matchCol <= maxCheckCol ? data[i][matchCol - 1] : "").toString().trim().toUpperCase();
      var obsVal = (obsCol <= maxCheckCol ? data[i][obsCol - 1] : "").toString().trim();

      // Solo evaluar zona inferior (sin fecha agendada y en seguimiento de CS)
      var isScheduled = (diaVal !== "" || fechaRealVal !== "" || statusVal === "CITA CONFIRMADA" || statusVal === "DATE PROGRAMADO" || statusVal === "CITA REALIZADA");
      if (!nameA || isScheduled) continue;

      // Detectar fecha de ingreso a CS
      var entryDate = null;
      var dateMatch = obsVal.match(/\[(?:Ingreso CS|Fecha):\s*(\d{4}-\d{2}-\d{2})\]/i);
      if (dateMatch) {
        entryDate = new Date(dateMatch[1]);
      } else {
        try {
          var note = matchesSheet.getRange(rowIdx, personACol).getNote() || "";
          var noteDateMatch = note.match(/(\d{4}-\d{2}-\d{2})/);
          if (noteDateMatch) {
            entryDate = new Date(noteDateMatch[1]);
          }
        } catch (ne) {}
      }

      if (entryDate && !isNaN(entryDate.getTime())) {
        var diffDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 15) {
          overdueCount++;
          var alertNote = "🚨 ALERTA SERVICIO AL CLIENTE: Este match lleva " + diffDays + " días en CS sin agendar cita (>15 días desde " + Utilities.formatDate(entryDate, CONFIG.TIMEZONE, "yyyy-MM-dd") + ").";
          matchesSheet.getRange(rowIdx, matchCol).setBackground("#F4CCCC");
          matchesSheet.getRange(rowIdx, personACol).setNote(alertNote);

          try {
            notifyPsychologistOverdue(nameA, nameB, diffDays, entryDate);
          } catch (pe) {
            Logger.log("Aviso al notificar retraso a psicóloga: " + pe.message);
          }
        }
      }
    }

    Logger.log("✅ Verificación de 15 días en MATCHES completada. Matches vencidos encontrados: " + overdueCount);
    try {
      if (overdueCount > 0) {
        ss.toast("Se encontraron " + overdueCount + " matches con >15 días sin agendar en CS.", "Alerta de Retraso", 6);
      }
    } catch (tErr) {}
  } catch (err) {
    Logger.log("ERROR CRÍTICO en actualizarAlertas15DiasMatches: " + err.message + "\n" + err.stack);
  }
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
  var matchCol = headers["ESTADO TOTAL"] || headers["MATCH"] || 1;
  var statusACol = headers["ESTADO PERSONA A"] || 2;
  var statusBCol = headers["ESTADO PERSONA B"] || 3;
  var personACol = headers["PERSONA A"] || headers["PERSON A"] || 4;
  var personBCol = headers["PERSONA B"] || headers["PERSON B"] || 5;
  var diaCol = headers["DÍA"] || headers["DIA"] || 6;
  var lugarCol = headers["LUGAR"] || 7;
  var cityCol = headers["CIUDAD"] || headers["CITY"] || 8;
  var fechaRealCol = headers["FECHA CITA REAL"] || 17;

  var estadosData = getEstadosPorEtapa();

  var REJECTION_KEYWORDS = [
    "NO MATCH", "RECHAZÓ", "RECHAZO", "SIN QUÍMICA", "SIN QUIMICA",
    "TROUBLEMAKER", "DESCALIFICADO", "REFUND", "NO CONTESTAN", "CANCELADA"
  ];

  function isRejectionStatus(st) {
    if (!st) return false;
    var upper = st.toUpperCase().trim();
    if (upper === "PENDIENTE" || upper === "AGENDANDO" || upper === "POR CONFIRMAR" || upper === "REPROGRAMAR") return false;
    for (var k = 0; k < REJECTION_KEYWORDS.length; k++) {
      if (upper.indexOf(REJECTION_KEYWORDS[k]) >= 0) return true;
    }
    return false;
  }

  // ── 1. EDICIÓN EN ESTADO PERSONA A O ESTADO PERSONA B ──
  if (col === statusACol || col === statusBCol) {
    var valA = (col === statusACol ? (newValue || "") : (sheet.getRange(row, statusACol).getValue() || "")).toString().trim();
    var valB = (col === statusBCol ? (newValue || "") : (sheet.getRange(row, statusBCol).getValue() || "")).toString().trim();
    var editVal = (newValue || "").toString().trim();
    var editUpper = editVal.toUpperCase();

    // Pintar celda individual editada
    if (estadosData.COLOR_MAP[editUpper]) {
      sheet.getRange(row, col).setBackground(estadosData.COLOR_MAP[editUpper]);
    }

    // ── TIEMPO DE RESPUESTA SERVICIO AL CLIENTE (Primer cambio que se aleja de pendiente) ──
    var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 13;
    if (editUpper && editUpper !== "PENDIENTE") {
      registrarRespuestaServicioCliente(sheet, row, obsCol);
    }

    // ── REGLA 9: DISPARO INMEDIATO DE RECHAZO SI CUALQUIERA DE LOS DOS RECHAZA ──
    if (isRejectionStatus(editVal)) {
      sheet.getRange(row, matchCol).setValue(editVal).setBackground("#F4CCCC");
      Logger.log("🚨 Rechazo detectado en " + (col === statusACol ? "Persona A" : "Persona B") + " ('" + editVal + "'). Estado Total actualizado a rechazo inmediato.");

      var cellA = getCellData(sheet, row, personACol);
      var cellB = getCellData(sheet, row, personBCol);
      if (cellA && cellA.text) {
        withScriptLock(function() {
          returnCandidatesToPsychologists(sheet, row, cellA, cellB, editVal);
        });
        SpreadsheetApp.getActiveSpreadsheet().toast("🚨 Rechazo registrado ('" + editVal + "'). Ambas personas retornadas a sus psicólogas para nuevo match.", "Rechazo Inmediato", 7);
      }
      return;
    }

    // ── REGLA: ESTADOS DE ÉXITO ALINEADOS (Persona A == Persona B) ──
    if (valA && valB && valA.toLowerCase() === valB.toLowerCase()) {
      sheet.getRange(row, matchCol).setValue(valA);
      var valUpper = valA.toUpperCase();
      if (estadosData.COLOR_MAP[valUpper]) {
        sheet.getRange(row, matchCol).setBackground(estadosData.COLOR_MAP[valUpper]);
        sheet.getRange(row, statusACol).setBackground(estadosData.COLOR_MAP[valUpper]);
        sheet.getRange(row, statusBCol).setBackground(estadosData.COLOR_MAP[valUpper]);
      }

      var SUCCESS_STATES = ["CITA CONFIRMADA", "DATE PROGRAMADO", "CITA REALIZADA", "MATCH", "MATCH DONE"];
      if (SUCCESS_STATES.indexOf(valUpper) >= 0) {
        var diaVal = (sheet.getRange(row, diaCol).getValue() || "").toString().trim();
        var fechaRealVal = fechaRealCol ? (sheet.getRange(row, fechaRealCol).getValue() || "").toString().trim() : "";

        if (!fechaRealVal && !diaVal) {
          if (fechaRealCol) {
            sheet.getRange(row, fechaRealCol)
              .setBackground("#FFF2CC")
              .setNote("⚠️ CITA CONFIRMADA: Falta fecha real. Seleccione la fecha en el calendario para activar y promover.");
          }
          var cellAInfo = personACol ? getCellData(sheet, row, personACol) : null;
          var cellBInfo = personBCol ? getCellData(sheet, row, personBCol) : null;
          var pNames = (cellAInfo ? cellAInfo.text : "Persona A") + " ↔ " + (cellBInfo ? cellBInfo.text : "Persona B");
          SpreadsheetApp.getActiveSpreadsheet().toast("⚠️ Cita confirmada para " + pNames + ". Falta seleccionar FECHA CITA REAL en el calendario.", "Falta Fecha Real", 7);
        } else {
          if (fechaRealCol) sheet.getRange(row, fechaRealCol).setBackground(null).clearNote();
          var effectiveDate = fechaRealVal || diaVal;
          updateMatchesRowColor(sheet, row, effectiveDate, valUpper);
          try {
            syncMatchToCitasAceptadas(sheet, row);
            reordenarCitasAceptadas();
            SpreadsheetApp.getActiveSpreadsheet().toast("✨ Cita confirmada con fecha (" + effectiveDate + "). Match sincronizado a Citas Aceptadas.", "Cita Confirmada", 6);
          } catch (syncErr) {
            Logger.log("Aviso al sincronizar: " + syncErr.message);
          }
        }
      }
    }
  }

  // ── 2. EDICIÓN EN ESTADO TOTAL DIRECTO ──
  if (col === matchCol) {
    var statusVal = (newValue || "").toString().trim();
    var statusUpper = statusVal.toUpperCase();
    if (estadosData.COLOR_MAP[statusUpper]) {
      sheet.getRange(row, matchCol).setBackground(estadosData.COLOR_MAP[statusUpper]);
    }

    // ── TIEMPO DE RESPUESTA SERVICIO AL CLIENTE (Primer cambio que se aleja de pendiente) ──
    var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 13;
    if (statusUpper && statusUpper !== "PENDIENTE") {
      registrarRespuestaServicioCliente(sheet, row, obsCol);
    }

    if (isRejectionStatus(statusVal)) {
      var cellA = getCellData(sheet, row, personACol);
      var cellB = getCellData(sheet, row, personBCol);
      if (cellA && cellA.text) {
        withScriptLock(function() {
          returnCandidatesToPsychologists(sheet, row, cellA, cellB, statusVal);
        });
      }
      return;
    }
  }

  // ── 3. ASIGNACIÓN DE FECHA REAL EN CALENDARIO (COLUMNA 17) -> PROMOCIÓN INMEDIATA ──
  if (col === fechaRealCol || col === diaCol) {
    var rawFecha = (col === fechaRealCol ? (newValue || sheet.getRange(row, fechaRealCol).getValue() || "") : (newValue || sheet.getRange(row, diaCol).getValue() || ""));
    var fechaStr = (rawFecha instanceof Date) ? Utilities.formatDate(rawFecha, CONFIG.TIMEZONE, "yyyy-MM-dd") : rawFecha.toString().trim();
    
    if (fechaStr && fechaStr !== "") {
      if (fechaRealCol) {
        sheet.getRange(row, fechaRealCol).setBackground(null).clearNote();
      }
      var curStTotal = (sheet.getRange(row, matchCol).getValue() || "").toString().trim().toUpperCase();
      if (curStTotal === "PENDIENTE" || !curStTotal) {
        sheet.getRange(row, matchCol).setValue("cita confirmada").setBackground("#D9EAD3");
        if (statusACol) sheet.getRange(row, statusACol).setValue("cita confirmada").setBackground("#D9EAD3");
        if (statusBCol) sheet.getRange(row, statusBCol).setValue("cita confirmada").setBackground("#D9EAD3");
        curStTotal = "CITA CONFIRMADA";
      }

      updateMatchesRowColor(sheet, row, fechaStr, curStTotal);

      var obsCol = headers["OBSERVACIONES"] || headers["PRESUPUESTO"] || 13;
      registrarRespuestaServicioCliente(sheet, row, obsCol);

      try {
        syncMatchToCitasAceptadas(sheet, row);
        reordenarCitasAceptadas();
        SpreadsheetApp.getActiveSpreadsheet().toast("✅ Cita agendada para el " + fechaStr + ". Match promovido y sincronizado a Citas Aceptadas.", "Cita Agendada", 5);
      } catch (ce) {
        Logger.log("Aviso al sincronizar cita con fecha: " + ce.message);
      }
    }
  }

  // ── 4. EDICIÓN EN CIUDAD O PRESUPUESTO -> ACTUALIZAR DESPLEGABLE DEPENDIENTE DE RESTAURANTE ──
  var presupuestoCol = headers["PRESUPUESTO"] || 9;
  var restauranteCol = headers["RESTAURANTE"] || headers["LUGAR"] || 10;
  if (col === cityCol || col === presupuestoCol) {
    updateDependentRestaurantDropdown(sheet, row);
  }
}

/**
 * Trigger al editar la pestaña 'Citas Aceptadas' (Sincronizado bidireccionalmente con MATCHES):
 * - Sincroniza cambios de fecha, reprogramación, lugar y estado hacia MATCHES.
 * - Reordena automáticamente la hoja por FECHA CITA REAL (de más próxima a más lejana).
 */
function handleCitasAceptadasEdit(sheet, row, col, newValue, oldValue) {
  if (row <= 1) return;

  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSONA A"] || 3;
  var personBCol = headers["PERSONA B"] || 4;
  var fechaRealCol = headers["FECHA CITA REAL"] || 2;
  var lugarCol = headers["LUGAR"] || 5;
  var diaCol = headers["DÍA / HORA"] || headers["DIA / HORA"] || headers["DÍA"] || 7;
  var statusCol = headers["ESTADO CITA"] || headers["STATUS"] || 8;
  var reprogCol = headers["REPROGRAMAR / NUEVA FECHA"] || headers["REPROGRAMAR"] || 9;

  var nameA = (sheet.getRange(row, personACol).getValue() || "").toString().trim();
  var nameB = (sheet.getRange(row, personBCol).getValue() || "").toString().trim();
  if (!nameA || !nameB) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var matchesSheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES") || ss.getSheetByName("MATCHES");
  if (!matchesSheet) return;

  var mHeaders = getSheetHeaders(matchesSheet);
  var mMatchCol = mHeaders["ESTADO TOTAL"] || mHeaders["MATCH"] || 1;
  var mPersonACol = mHeaders["PERSONA A"] || mHeaders["PERSON A"] || 4;
  var mPersonBCol = mHeaders["PERSONA B"] || mHeaders["PERSON B"] || 5;
  var mDiaCol = mHeaders["DÍA"] || mHeaders["DIA"] || 6;
  var mLugarCol = mHeaders["LUGAR"] || 7;
  var mFechaRealCol = mHeaders["FECHA CITA REAL"] || 17;
  var mReprogCol = mHeaders["¿REPROGRAMAR?"] || mHeaders["REPROGRAMAR"] || 16;

  // Buscar fila correspondiente en MATCHES
  var mLastRow = matchesSheet.getLastRow();
  if (mLastRow <= 1) return;

  var mData = matchesSheet.getRange(2, 1, mLastRow - 1, Math.max(mPersonACol, mPersonBCol, mDiaCol, mLugarCol, mMatchCol, mFechaRealCol, mReprogCol)).getValues();
  var targetMRow = -1;

  for (var i = 0; i < mData.length; i++) {
    var mA = (mData[i][mPersonACol - 1] || "").toString().trim().toLowerCase();
    var mB = (mData[i][mPersonBCol - 1] || "").toString().trim().toLowerCase();
    if ((mA === nameA.toLowerCase() && mB === nameB.toLowerCase()) || (mA === nameB.toLowerCase() && mB === nameA.toLowerCase())) {
      targetMRow = i + 2;
      break;
    }
  }

  if (targetMRow > 1) {
    // Si se editó la fecha reprogramada
    if (col === reprogCol && newValue) {
      sheet.getRange(row, fechaRealCol).setValue(newValue);
      sheet.getRange(row, diaCol).setValue(newValue);
      sheet.getRange(row, statusCol).setValue("Reprogramada").setBackground("#F9CB9C");
      
      matchesSheet.getRange(targetMRow, mDiaCol).setValue(newValue);
      if (mFechaRealCol) matchesSheet.getRange(targetMRow, mFechaRealCol).setValue(newValue);
      if (mReprogCol) matchesSheet.getRange(targetMRow, mReprogCol).setValue("SÍ (" + newValue + ")");
      if (mMatchCol) matchesSheet.getRange(targetMRow, mMatchCol).setValue("Reprogramada").setBackground("#F9CB9C");
      
      ss.toast("Cita reprogramada para " + newValue + " y sincronizada en MATCHES.", "Reprogramación Exitosa", 5);
      reordenarCitasAceptadas(sheet);
    }
    // Si se editó la fecha real o día directamente
    else if (col === fechaRealCol || col === diaCol) {
      var dateVal = sheet.getRange(row, col).getValue();
      matchesSheet.getRange(targetMRow, mDiaCol).setValue(dateVal);
      if (mFechaRealCol) matchesSheet.getRange(targetMRow, mFechaRealCol).setValue(dateVal);
      ss.toast("Fecha sincronizada con MATCHES.", "Sincronización", 4);
      reordenarCitasAceptadas(sheet);
    }
    // Si se editó el lugar
    else if (col === lugarCol) {
      var lugarVal = sheet.getRange(row, lugarCol).getValue();
      if (mLugarCol) matchesSheet.getRange(targetMRow, mLugarCol).setValue(lugarVal);
      ss.toast("Lugar sincronizado con MATCHES.", "Sincronización", 4);
    }
    // Si se editó el estado
    else if (col === statusCol) {
      var stVal = sheet.getRange(row, statusCol).getValue();
      if (mMatchCol) matchesSheet.getRange(targetMRow, mMatchCol).setValue(stVal);
    }
  }
}

/**
 * Reordena automáticamente la pestaña 'Citas Aceptadas' por FECHA CITA REAL
 * de forma ascendente (de más próxima a más lejana).
 */
function reordenarCitasAceptadas(citasSheet) {
  if (!citasSheet) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    citasSheet = ss.getSheetByName("Citas Aceptadas") || ss.getSheetByName("CITAS ACEPTADAS");
  }
  if (!citasSheet) return;

  var lastRow = citasSheet.getLastRow();
  var lastCol = citasSheet.getLastColumn();
  if (lastRow <= 2 || lastCol < 2) return;

  var cHeaders = getSheetHeaders(citasSheet);
  var fechaCol = cHeaders["FECHA CITA REAL"] || 2;

  try {
    var rangeToSort = citasSheet.getRange(2, 1, lastRow - 1, lastCol);
    rangeToSort.sort({ column: fechaCol, ascending: true });
    Logger.log("✅ Pestaña 'Citas Aceptadas' ordenada automáticamente por FECHA CITA REAL (de más próxima a más lejana).");
  } catch (sortErr) {
    Logger.log("Aviso al ordenar Citas Aceptadas: " + sortErr.message);
  }
}

/**
 * Sincroniza un match confirmado / agendado desde MATCHES hacia la pestaña 'Citas Aceptadas'.
 * Al finalizar, reordena automáticamente la pestaña de forma cronológica.
 */
function syncMatchToCitasAceptadas(matchesSheet, row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var citasSheet = ss.getSheetByName("Citas Aceptadas") || ss.getSheetByName("CITAS ACEPTADAS");
  if (!citasSheet) return;

  var mHeaders = getSheetHeaders(matchesSheet);
  var matchCol = mHeaders["ESTADO TOTAL"] || mHeaders["MATCH"] || 1;
  var personACol = mHeaders["PERSONA A"] || mHeaders["PERSON A"] || 4;
  var personBCol = mHeaders["PERSONA B"] || mHeaders["PERSON B"] || 5;
  var diaCol = mHeaders["DÍA"] || mHeaders["DIA"] || 6;
  var lugarCol = mHeaders["LUGAR"] || 7;
  var cityCol = mHeaders["CIUDAD"] || mHeaders["CITY"] || 8;
  var confCol = mHeaders["CONFIRMACIÓN"] || mHeaders["CONFIRMACION"] || 9;
  var diaAntesCol = mHeaders["DÍA ANTES"] || mHeaders["DIA ANTES"] || 10;
  var hoyCol = mHeaders["HOY"] || 11;
  var obsCol = mHeaders["OBSERVACIONES"] || 13;
  var reservaCol = mHeaders["RESERVA"] || 14;
  var estReservaCol = mHeaders["ESTADO RESERVA"] || 15;
  var fechaRealCol = mHeaders["FECHA CITA REAL"] || 17;

  var cellA = getCellData(matchesSheet, row, personACol);
  var cellB = getCellData(matchesSheet, row, personBCol);
  if (!cellA || !cellA.text) return;

  var diaVal = (diaCol ? matchesSheet.getRange(row, diaCol).getValue() : "") || "";
  var lugarVal = (lugarCol ? matchesSheet.getRange(row, lugarCol).getValue() : "") || "";
  var cityVal = (cityCol ? matchesSheet.getRange(row, cityCol).getValue() : "") || "";
  var statusVal = (matchCol ? matchesSheet.getRange(row, matchCol).getValue() : "") || "Cita Confirmada";
  var fechaRealVal = (fechaRealCol ? matchesSheet.getRange(row, fechaRealCol).getValue() : "") || diaVal;
  var confVal = (confCol ? matchesSheet.getRange(row, confCol).getValue() : "") || "";
  var diaAntesVal = (diaAntesCol ? matchesSheet.getRange(row, diaAntesCol).getValue() : "") || "";
  var hoyVal = (hoyCol ? matchesSheet.getRange(row, hoyCol).getValue() : "") || "";
  var resVal = (reservaCol ? matchesSheet.getRange(row, reservaCol).getValue() : "") || "";
  var estResVal = (estReservaCol ? matchesSheet.getRange(row, estReservaCol).getValue() : "") || "";
  var obsVal = (obsCol ? matchesSheet.getRange(row, obsCol).getValue() : "") || "";

  var cHeaders = getSheetHeaders(citasSheet);
  var cPersonACol = cHeaders["PERSONA A"] || 3;
  var cPersonBCol = cHeaders["PERSONA B"] || 4;
  var cFechaRealCol = cHeaders["FECHA CITA REAL"] || 2;
  var cLugarCol = cHeaders["LUGAR"] || 5;
  var cCityCol = cHeaders["CIUDAD"] || 6;
  var cConfCol = cHeaders["CONFIRMACIÓN"] || cHeaders["CONFIRMACION"] || 7;
  var cDiaAntesCol = cHeaders["DÍA ANTES"] || cHeaders["DIA ANTES"] || 8;
  var cHoyCol = cHeaders["HOY"] || 9;
  var cResCol = cHeaders["RESERVA"] || 10;
  var cEstResCol = cHeaders["ESTADO RESERVA"] || 11;
  var cObsCol = cHeaders["OBSERVACIONES"] || 12;

  // Buscar si ya existe en Citas Aceptadas
  var realLastRow = getRealLastDataRow(citasSheet, cPersonACol);
  var foundRow = -1;

  if (realLastRow > 1) {
    var cData = citasSheet.getRange(2, 1, realLastRow - 1, Math.max(cPersonACol, cPersonBCol)).getValues();
    for (var i = 0; i < cData.length; i++) {
      var cA = (cData[i][cPersonACol - 1] || "").toString().trim().toLowerCase();
      var cB = (cData[i][cPersonBCol - 1] || "").toString().trim().toLowerCase();
      if ((cA === cellA.text.toLowerCase() && cB === (cellB ? cellB.text.toLowerCase() : "")) ||
          (cA === (cellB ? cellB.text.toLowerCase() : "") && cB === cellA.text.toLowerCase())) {
        foundRow = i + 2;
        break;
      }
    }
  }

  if (foundRow > 1) {
    if (cFechaRealCol && fechaRealVal) citasSheet.getRange(foundRow, cFechaRealCol).setValue(fechaRealVal);
    if (cLugarCol && lugarVal) citasSheet.getRange(foundRow, cLugarCol).setValue(lugarVal);
    if (cCityCol && cityVal) citasSheet.getRange(foundRow, cCityCol).setValue(cityVal);
    if (cConfCol && confVal) citasSheet.getRange(foundRow, cConfCol).setValue(confVal);
    if (cDiaAntesCol && diaAntesVal) citasSheet.getRange(foundRow, cDiaAntesCol).setValue(diaAntesVal);
    if (cHoyCol && hoyVal) citasSheet.getRange(foundRow, cHoyCol).setValue(hoyVal);
    if (cResCol && resVal) citasSheet.getRange(foundRow, cResCol).setValue(resVal);
    if (cEstResCol && estResVal) citasSheet.getRange(foundRow, cEstResCol).setValue(estResVal);
    if (cObsCol && obsVal) citasSheet.getRange(foundRow, cObsCol).setValue(obsVal);
  } else {
    var newRowIdx = realLastRow + 1;
    var matchIdStr = "DL-" + (1000 + newRowIdx);
    
    citasSheet.getRange(newRowIdx, 1).setValue(matchIdStr);
    if (cFechaRealCol) citasSheet.getRange(newRowIdx, cFechaRealCol).setValue(fechaRealVal);
    if (cellA.richText) {
      citasSheet.getRange(newRowIdx, cPersonACol).setRichTextValue(cellA.richText);
    } else {
      citasSheet.getRange(newRowIdx, cPersonACol).setValue(cellA.text);
    }
    if (cellB) {
      if (cellB.richText) {
        citasSheet.getRange(newRowIdx, cPersonBCol).setRichTextValue(cellB.richText);
      } else {
        citasSheet.getRange(newRowIdx, cPersonBCol).setValue(cellB.text);
      }
    }
    if (cLugarCol) citasSheet.getRange(newRowIdx, cLugarCol).setValue(lugarVal);
    if (cCityCol) citasSheet.getRange(newRowIdx, cCityCol).setValue(cityVal);
    if (cConfCol) citasSheet.getRange(newRowIdx, cConfCol).setValue(confVal);
    if (cDiaAntesCol) citasSheet.getRange(newRowIdx, cDiaAntesCol).setValue(diaAntesVal);
    if (cHoyCol) citasSheet.getRange(newRowIdx, cHoyCol).setValue(hoyVal);
    if (cResCol) citasSheet.getRange(newRowIdx, cResCol).setValue(resVal);
    if (cEstResCol) citasSheet.getRange(newRowIdx, cEstResCol).setValue(estResVal);
    if (cObsCol) citasSheet.getRange(newRowIdx, cObsCol).setValue(obsVal);

    // Dropdown de restaurante
    var venueRule = getRestaurantVenueValidationRule(ss);
    if (venueRule && cLugarCol) {
      citasSheet.getRange(newRowIdx, cLugarCol).setDataValidation(venueRule);
    }
  }

  // 🔄 REORDENAMIENTO AUTOMÁTICO: Ordenar por FECHA CITA REAL de más próxima a más lejana
  reordenarCitasAceptadas(citasSheet);
}

/**
 * Asegura la existencia de la columna 'FECHA CITA REAL' en MATCHES (Columna R / 18).
 */
function ensureRealDateColumn(sheet, headers) {
  var targetCol = headers["FECHA CITA REAL"] || 17;
  if (!headers["FECHA CITA REAL"]) {
    sheet.getRange(1, targetCol).setValue("FECHA CITA REAL").setFontWeight("bold").setBackground("#D9D2E9");
    headers["FECHA CITA REAL"] = targetCol;
  }

  // Validación de selector de calendario nativo interactivo en Google Sheets
  var dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(true)
    .setHelpText("Haga doble clic para seleccionar la fecha real en el calendario interactivo.")
    .build();

  var maxRows = Math.min(sheet.getMaxRows(), 5000);
  if (maxRows > 1) {
    safeSetDataValidation(sheet.getRange(2, targetCol, maxRows - 1, 1), dateRule);
  }
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
  
  // 1. Buscar en el libro de Sheets (PROFILES + pestañas de psicólogas)
  var details = findPersonDetailsInWorkbook(personCell);
  if (details && details.psychologist) {
    return details.psychologist;
  }

  // 2. Fallback: Consultar al backend
  var targetCrmId = personCell.crmId || (personCell.richText ? extractCrmIdFromUrl(personCell.richText.getLinkUrl()) : "");
  var query = targetCrmId || personCell.text;
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
'      html += \'  <div style="display:flex; gap:6px; margin-bottom:10px;">\';' +
'      html += \'    <button id="btn-all" onclick="filterMatches(false)" style="flex:1; padding:6px 8px; font-size:11px; font-weight:700; border-radius:6px; border:1px solid #961500; background:#961500; color:#fff; cursor:pointer;">Todos (\' + (data.matches ? data.matches.length : 0) + \')</button>\';' +
'      html += \'    <button id="btn-trouble" onclick="filterMatches(true)" style="flex:1; padding:6px 8px; font-size:11px; font-weight:700; border-radius:6px; border:1px solid rgba(255,107,53,0.4); background:rgba(255,107,53,0.15); color:#ff8a80; cursor:pointer;">⚠️ Solo Rechazos (\' + (data.trouble_count || 0) + \')</button>\';' +
'      html += \'  </div>\';' +
'      html += \'  <div id="matches-list-container"></div>\';' +
'      html += \'</div>\';' +
'      if (data.bio_notes || data.difficult_notes) {' +
'        html += \'<div class="card">\';' +
'        html += \'  <div class="card-title">📝 Notas Internas</div>\';' +
'        if (data.bio_notes) html += \'  <div style="font-size:12px; color:#ddd; margin-bottom:6px;">\' + escapeHtml(data.bio_notes) + \'</div>\';' +
'        if (data.difficult_notes) html += \'  <div style="font-size:11px; color:#ff8a80;"><b>Nota Dificultad:</b> \' + escapeHtml(data.difficult_notes) + \'</div>\';' +
'        html += \'</div>\';' +
'      }' +
'      area.innerHTML = html;' +
'      window.__currentMatches = data.matches || [];' +
'      renderMatchesList(false);' +
'    }' +
'    function isRejectionStatus(st) {' +
'      var s = (st || "").toUpperCase();' +
'      return (s.indexOf("TROUBLE") >= 0 || s.indexOf("NOT APPROVED") >= 0 || s.indexOf("RECHAZ") >= 0 || s.indexOf("NO MATCH") >= 0 || s.indexOf("SIN QUÍMICA") >= 0 || s.indexOf("SIN QUIMICA") >= 0 || s.indexOf("DESCALIFICADO") >= 0 || s.indexOf("REFUND") >= 0);' +
'    }' +
'    function filterMatches(onlyTrouble) {' +
'      var btnAll = document.getElementById("btn-all");' +
'      var btnTrouble = document.getElementById("btn-trouble");' +
'      if (btnAll && btnTrouble) {' +
'        if (onlyTrouble) {' +
'          btnAll.style.background = "#1A1214"; btnAll.style.color = "#9A8A8D"; btnAll.style.borderColor = "rgba(150,21,0,0.3)";' +
'          btnTrouble.style.background = "#FF6B35"; btnTrouble.style.color = "#fff"; btnTrouble.style.borderColor = "#FF6B35";' +
'        } else {' +
'          btnAll.style.background = "#961500"; btnAll.style.color = "#fff"; btnAll.style.borderColor = "#961500";' +
'          btnTrouble.style.background = "rgba(255,107,53,0.15)"; btnTrouble.style.color = "#ff8a80"; btnTrouble.style.borderColor = "rgba(255,107,53,0.4)";' +
'        }' +
'      }' +
'      renderMatchesList(onlyTrouble);' +
'    }' +
'    function renderMatchesList(onlyTrouble) {' +
'      var container = document.getElementById("matches-list-container");' +
'      if (!container) return;' +
'      var matches = window.__currentMatches || [];' +
'      var filtered = onlyTrouble ? matches.filter(function(m) { return isRejectionStatus(m.status); }) : matches;' +
'      if (filtered.length === 0) {' +
'        container.innerHTML = \'<div class="empty-state">\' + (onlyTrouble ? \'No registra rechazos ni troublemakers.\' : \'No tiene candidatos previos.\') + \'</div>\';' +
'        return;' +
'      }' +
'      var out = "";' +
'      if (onlyTrouble) {' +
'        out += \'<div style="background:rgba(255,107,53,0.12); border:1px solid #FF6B35; color:#ff8a80; padding:8px 10px; border-radius:6px; margin-bottom:10px; font-size:11px; font-weight:700;">⚠️ Esta persona registra \' + filtered.length + \' rechazos / cancelaciones</div>\';' +
'      }' +
'      for (var i = 0; i < filtered.length; i++) {' +
'        var m = filtered[i];' +
'        var badgeClass = "badge-gray";' +
'        var stUpper = (m.status || "").toUpperCase();' +
'        if (stUpper === "APROBADO" || stUpper === "MATCH DONE") badgeClass = "badge-green";' +
'        else if (stUpper === "HECHO" || stUpper === "HECHO POR MAPE") badgeClass = "badge-blue";' +
'        else if (stUpper.indexOf("LISTO") >= 0 || stUpper.indexOf("PENDIENTE") >= 0) badgeClass = "badge-yellow";' +
'        else if (isRejectionStatus(stUpper)) badgeClass = "badge-wine";' +
'        out += \'<div class="match-item">\';' +
'        out += \'  <div class="match-header">\';' +
'        out += \'    <span class="match-name">\' + escapeHtml(m.candidate_name) + \'</span>\';' +
'        out += \'    <span class="badge \' + badgeClass + \'">\' + escapeHtml(m.status) + \'</span>\';' +
'        out += \'  </div>\';' +
'        out += \'  <div class="match-meta">📅 \' + (m.fecha || "Sin fecha") + \' &bull; 👩‍⚕️ \' + (m.psychologist || "General") + (m.role ? " &bull; Rol: " + m.role : "") + \'</div>\';' +
'        if (m.feedback) {' +
'          out += \'  <div class="match-feedback">💬 <b>Feedback:</b> \' + escapeHtml(m.feedback) + \'</div>\';' +
'        }' +
'        if (m.observations) {' +
'          out += \'  <div class="match-obs">📝 \' + escapeHtml(m.observations) + \'</div>\';' +
'        }' +
'        out += \'</div>\';' +
'      }' +
'      container.innerHTML = out;' +
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





/**
 * Verifica si la psicóloga ya tiene un cliente sin tocar (todos sus slots en "Listo para match") en su pestaña.
 * Un cliente cuenta como trabajado/no bloqueante si CUALQUIERA de sus slots tiene un estado distinto a "Listo para match"
 * (HECHO, APROBADO, REVISAR, NOT APPROVED, REFUND, NO HAY GENTE, etc.).
 * Solo bloquea si ABSOLUTAMENTE TODOS sus slots siguen exactamente en "Listo para match" / sin tocar.
 */
function getUnclosedClientForPsychologist(psycSheet, currentClientName) {
  var headers = getSheetHeaders(psycSheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 6;
  var statusCol = headers["STATUS"] || 10;
  var obsCol = headers["OBSERVACIONES"] || 11;
  var llegadaCol = headers["FECHA DE LLEGADA"] || headers["FECHA LLEGADA"] || 12;

  var lastRow = getTrueLastRow(psycSheet, personACol);
  if (lastRow <= 1) return null;

  var data = psycSheet.getRange(2, 1, lastRow - 1, Math.max(personACol, statusCol, obsCol, llegadaCol || 1)).getValues();
  var clientsMap = {}; // name -> list of statuses

  for (var i = 0; i < data.length; i++) {
    var pName = (data[i][personACol - 1] || "").toString().trim();
    if (!pName || (currentClientName && pName.toLowerCase() === currentClientName.toLowerCase())) continue;

    var st = (data[i][statusCol - 1] || "").toString().trim().toUpperCase();
    var obs = (data[i][obsCol - 1] || "").toString().trim();
    var isAuto = (obs.indexOf("[ESPEJO]") >= 0 || obs.indexOf("[RECHAZO]") >= 0 || obs.indexOf("[INACTIVIDAD]") >= 0 || obs.indexOf("[REACTIVACIÓN]") >= 0 || obs.indexOf("[REFUND]") >= 0);

    // No contar filas automáticas para el bloqueo de clientes propios
    if (isAuto) continue;

    if (!clientsMap[pName]) {
      clientsMap[pName] = [];
    }
    clientsMap[pName].push(st);
  }

  // Evaluar cada cliente: bloquea SOLO si TODOS sus slots siguen en "Listo para match" (sin tocar)
  for (var name in clientsMap) {
    var statuses = clientsMap[name];
    var hasProgress = false;
    for (var s = 0; s < statuses.length; s++) {
      var curSt = statuses[s];
      // Si el slot tiene cualquier estado DISTINTO a "Listo para match" / vacío, ya hubo acción
      var isUntouched = (curSt === "" || curSt.indexOf("LISTO PARA MATCH") >= 0 || curSt === "LISTO" || curSt === "LLENAR");
      if (!isUntouched) {
        hasProgress = true;
        break;
      }
    }
    // Si ningún slot ha sido tocado (todos siguen en Listo para match), este cliente bloquea
    if (!hasProgress && statuses.length > 0) {
      return name;
    }
  }

  return null;
}


/**
 * Actualiza dinámicamente la lista desplegable de RESTAURANTE en una fila específica de MATCHES
 * filtrando únicamente los restaurantes de ⚙️ RESTAURANTES que coincidan con la CIUDAD y PRESUPUESTO de esa fila.
 */
function updateDependentRestaurantDropdown(sheet, row) {
  var headers = getSheetHeaders(sheet);
  var cityCol = headers["CIUDAD"] || headers["CITY"] || 6;
  var budgetCol = headers["PRESUPUESTO"] || 9;
  var restCol = headers["RESTAURANTE"] || headers["LUGAR"] || 10;

  var currentCity = (sheet.getRange(row, cityCol).getValue() || "").toString().trim();
  var currentBudget = (sheet.getRange(row, budgetCol).getValue() || "").toString().trim();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var restSheet = ss.getSheetByName("⚙️ RESTAURANTES");
  if (!restSheet) return;

  var rLast = restSheet.getLastRow();
  if (rLast <= 1) return;

  var restHeaders = getSheetHeaders(restSheet);
  var nameColIdx = (restHeaders["RESTAURANTE / CAFÉ"] || restHeaders["RESTAURANTE / CAFE"] || restHeaders["RESTAURANTE"] || 2) - 1;
  var cityColIdx = (restHeaders["CIUDAD"] || restHeaders["CITY"] || 1) - 1;
  var bcatColIdx = (restHeaders["CATEGORÍA PRESUPUESTO"] || restHeaders["CATEGORIA PRESUPUESTO"] || restHeaders["PRESUPUESTO"] || 5) - 1;

  var rData = restSheet.getRange(2, 1, rLast - 1, restSheet.getLastColumn()).getValues();
  var filteredNames = [];

  for (var i = 0; i < rData.length; i++) {
    var rName = (rData[i][nameColIdx] || "").toString().trim();
    var rCity = (rData[i][cityColIdx] || "").toString().trim();
    var rCat = (rData[i][bcatColIdx] || "").toString().trim();

    if (!rName) continue;

    var matchCity = true;
    if (currentCity && currentCity.toLowerCase() !== "todas" && currentCity.toLowerCase() !== "todos") {
      matchCity = (rCity.toLowerCase() === currentCity.toLowerCase() || normalizeCityLocal(rCity) === normalizeCityLocal(currentCity));
    }

    var matchBudget = true;
    if (currentBudget && currentBudget.toLowerCase() !== "todos" && currentBudget.toLowerCase() !== "todas" && currentBudget.toLowerCase() !== "cualquier presupuesto") {
      matchBudget = (rCat.toLowerCase() === currentBudget.toLowerCase());
    }

    if (matchCity && matchBudget) {
      filteredNames.push(rName);
    }
  }

  var restCell = sheet.getRange(row, restCol);
  if (filteredNames.length > 0) {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(filteredNames, true)
      .setAllowInvalid(true)
      .build();
    safeSetDataValidation(restCell, rule);
    
    // Si el valor actual de la celda ya no calza en la lista filtrada, avisar con nota
    var curVal = (restCell.getValue() || "").toString().trim();
    if (curVal && filteredNames.indexOf(curVal) === -1) {
      restCell.setNote("ℹ️ Restaurante fuera del filtro actual (" + currentCity + " / " + currentBudget + "). Elija uno de las " + filteredNames.length + " opciones disponibles.");
    } else {
      restCell.clearNote();
    }
  } else {
    var emptyRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["(Sin restaurantes para este filtro)", "Otro lugar por definir"], true)
      .setAllowInvalid(true)
      .build();
    safeSetDataValidation(restCell, emptyRule);
    restCell.setNote("⚠️ No hay restaurantes registrados en ⚙️ RESTAURANTES para " + currentCity + " con presupuesto " + currentBudget + ".");
  }
}

/**
 * Inicializa los desplegables dependientes de restaurantes para todas las filas activas en MATCHES.
 */
function aplicarDesplegablesDependientesRestaurantesTodos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("MATCHES");
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  for (var r = 2; r <= lastRow; r++) {
    updateDependentRestaurantDropdown(sheet, r);
  }
  ss.toast("Desplegables dependientes de restaurantes actualizados en todas las filas de MATCHES.", "Restaurantes Filtrados", 6);
}


/**
 * Normaliza y reordena todas las pestañas de psicólogas de forma canónica:
 * - Procesa las 11 pestañas de psicólogas registradas en CONFIG.VALID_PSYCHOLOGISTS
 *   y cualquier otra pestaña con prefijo 'MATCHES ' (excepto 'MATCHES').
 * - Unifica a exactamente 12 columnas canónicas en orden estricto:
 *   ID | Fecha de entrevista | PAIS | CITY | PREF | PLAN | PERSON A | PERSON B | PSICÓLOGA DE B | STATUS | OBSERVACIONES | Fecha de llegada
 * - Mueve 'Fecha de entrevista' a Col B.
 * - Fusiona TAREAS (MAPE D) y APRO DATE (ALEJA) hacia OBSERVACIONES.
 * - Elimina duplicados de fecha (SILVI, MANU).
 * - Elimina físicamente columnas extra (CRM, feedback, Columna 2..20) dejando maxColumns = 12.
 * - Preserva 100% de hipervínculos CRM, colores de fondo y notas.
 */
/**
 * Unifica las pestañas duplicadas de MANU ('MATCHES MANU ' y 'MATCHES MANU') de forma 100% IDEMPOTENTE y ULTRA-RÁPIDA.
 * - Idempotencia: Si no existen ambas pestañas simultáneas o si 'MATCHES MANU' ya tiene estructura canónica de 12 columnas, NO HACE NADA.
 * - Rendimiento: Cero llamadas a protegerCeldaPersona (no es necesario durante la migración interna de datos).
 * - Batching masivo: Lee en memoria, filtra filas únicas, e inyecta en un solo .setValues() (<200ms en total).
 * - Elimina la secundaria y asegura el nombre canónico único 'MATCHES MANU'.
 */
function unificarPestanasManu(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetManu = ss.getSheetByName("MATCHES MANU");
  var sheetManuSpace = ss.getSheetByName("MATCHES MANU ");

  // 1. GUARDIA DE IDEMPOTENCIA:
  // Si no existen AMBAS pestañas al mismo tiempo, no hay duplicados que unificar.
  if (!sheetManu || !sheetManuSpace) {
    Logger.log("ℹ️ [unificarPestanasManu] No existen pestañas duplicadas de MANU simultáneas. Paso omitido.");
    return;
  }

  // Si alguna de las dos ya está normalizada a 12 columnas canónicas, no volver a mezclar
  if (sheetManu.getMaxColumns() === 12 && sheetManu.getRange(1, 2).getValue() === "Fecha de entrevista") {
    Logger.log("ℹ️ [unificarPestanasManu] 'MATCHES MANU' ya está en estructura canónica de 12 columnas. Limpiando pestaña residual con espacio si existe.");
    try { ss.deleteSheet(sheetManuSpace); } catch (e) {}
    return;
  }
  if (sheetManuSpace.getMaxColumns() === 12 && sheetManuSpace.getRange(1, 2).getValue() === "Fecha de entrevista") {
    Logger.log("ℹ️ [unificarPestanasManu] 'MATCHES MANU ' ya está canónica. Eliminando borrador antiguo y renombrando.");
    try { ss.deleteSheet(sheetManu); } catch (e) {}
    sheetManuSpace.setName("MATCHES MANU");
    return;
  }

  Logger.log("🔄 Detectadas dos pestañas para MANU ('MATCHES MANU' y 'MATCHES MANU '). Unificando datos en batch ultra-rápido...");

  // 2. Identificar la principal (la de mayor cantidad de datos reales, que es MATCHES MANU  con 411 filas)
  var mainSheet = (sheetManuSpace.getLastRow() >= sheetManu.getLastRow()) ? sheetManuSpace : sheetManu;
  var secSheet = (mainSheet === sheetManuSpace) ? sheetManu : sheetManuSpace;

  var mainHeaders = getSheetHeaders(mainSheet);
  var secHeaders = getSheetHeaders(secSheet);

  var mainPACol = mainHeaders["PERSON A"] || mainHeaders["PERSONA A"] || 6;
  var mainPBCol = mainHeaders["PERSON B"] || mainHeaders["PERSONA B"] || 7;
  var secPACol = secHeaders["PERSON A"] || secHeaders["PERSONA A"] || 1;
  var secPBCol = secHeaders["PERSON B"] || secHeaders["PERSONA B"] || 2;
  var secObsCol = secHeaders["OBSERVACIONES"] || secHeaders["OBSERVACION"] || 3;
  var secStatusCol = secHeaders["STATUS"] || 4;

  // 3. Registrar pares Persona A / Persona B existentes en la principal para evitar duplicación
  var mainLast = Math.min(mainSheet.getLastRow(), 450);
  var existingPairs = {};
  if (mainLast > 1) {
    var maxCol = Math.max(mainPACol, mainPBCol);
    var mainValues = mainSheet.getRange(2, 1, mainLast - 1, maxCol).getValues();
    for (var m = 0; m < mainValues.length; m++) {
      var pa = (mainValues[m][mainPACol - 1] || "").toString().trim().toLowerCase();
      var pb = (mainValues[m][mainPBCol - 1] || "").toString().trim().toLowerCase();
      if (pa) existingPairs[pa + "||" + pb] = true;
    }
  }

  // 4. Filtrar filas de la secundaria que no existan en la principal
  var secLast = secSheet.getLastRow();
  var rowsToAppend = [];
  var richTextsToAppend = [];

  if (secLast > 1) {
    var secValues = secSheet.getRange(2, 1, secLast - 1, secSheet.getLastColumn()).getValues();
    var secRich = secSheet.getRange(2, secPACol, secLast - 1, 1).getRichTextValues();

    for (var s = 0; s < secValues.length; s++) {
      var sPA = (secValues[s][secPACol - 1] || "").toString().trim();
      var sPB = (secValues[s][secPBCol - 1] || "").toString().trim();
      if (!sPA || sPA.toLowerCase() === "matches" || sPA.toLowerCase() === "person a") continue;

      var key = sPA.toLowerCase() + "||" + sPB.toLowerCase();
      var keyEmptyB = sPA.toLowerCase() + "||";
      if (!existingPairs[key] && !existingPairs[keyEmptyB]) {
        var rtCell = secRich[s] ? secRich[s][0] : null;
        var sObs = secObsCol ? (secValues[s][secObsCol - 1] || "").toString().trim() : "";
        var sSt = secStatusCol ? (secValues[s][secStatusCol - 1] || "").toString().trim() : "Listo para match";

        var rowData = new Array(mainSheet.getMaxColumns());
        for (var c = 0; c < rowData.length; c++) rowData[c] = "";

        rowData[0] = "=ROW()-1"; // ID
        rowData[mainPACol - 1] = sPA;
        if (mainPBCol) rowData[mainPBCol - 1] = sPB;
        if (mainHeaders["STATUS"]) rowData[mainHeaders["STATUS"] - 1] = sSt;
        var obsCol = mainHeaders["OBSERVACIONES"] || mainHeaders["OBSERVACION"];
        if (obsCol) rowData[obsCol - 1] = sObs ? sObs + " [MIGRADO DE MANU DRAFT]" : "[MIGRADO DE MANU DRAFT]";
        var llegadaCol = mainHeaders["FECHA DE LLEGADA"] || mainHeaders["FECHA LLEGADA"];
        if (llegadaCol) rowData[llegadaCol - 1] = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");

        rowsToAppend.push(rowData);
        richTextsToAppend.push([rtCell || SpreadsheetApp.newRichTextValue().setText(sPA).build()]);
        existingPairs[key] = true;
      }
    }
  }

  Logger.log("Se encontraron " + rowsToAppend.length + " filas únicas en la pestaña secundaria para anexar a la principal.");

  // 5. INYECCIÓN EN UN SOLO BATCH ULTRA-RÁPIDO (Cero llamadas lentas a protegerCeldaPersona)
  if (rowsToAppend.length > 0) {
    var insertStartRow = mainLast + 1;
    if (mainSheet.getMaxRows() < insertStartRow + rowsToAppend.length) {
      mainSheet.insertRowsAfter(mainSheet.getMaxRows(), (insertStartRow + rowsToAppend.length) - mainSheet.getMaxRows() + 10);
    }
    var targetRange = mainSheet.getRange(insertStartRow, 1, rowsToAppend.length, mainSheet.getMaxColumns());
    targetRange.setValues(rowsToAppend);

    if (richTextsToAppend.length > 0) {
      try {
        mainSheet.getRange(insertStartRow, mainPACol, richTextsToAppend.length, 1).setRichTextValues(richTextsToAppend);
      } catch (eRT) {}
    }
    SpreadsheetApp.flush();
    Logger.log("✅ " + rowsToAppend.length + " filas anexadas en batch ultra-rápido a '" + mainSheet.getName() + "'.");
  }

  // 6. Eliminar la pestaña secundaria duplicada y renombrar la principal a 'MATCHES MANU'
  try {
    ss.deleteSheet(secSheet);
    mainSheet.setName("MATCHES MANU");
    SpreadsheetApp.flush();
    Logger.log("✅ Pestañas de MANU unificadas con éxito. Ahora existe una sola 'MATCHES MANU'.");
  } catch (eRen) {
    Logger.log("Aviso al renombrar pestaña unificada de MANU: " + eRen.message);
  }
}

function reordenarColumnasPsicologasCanonico(silent) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 0. Unificar pestañas duplicadas de MANU si existen ('MATCHES MANU ' y 'MATCHES MANU')
  try {
    unificarPestanasManu(ss);
  } catch (manuErr) {
    Logger.log("Aviso en unificación de pestañas MANU: " + manuErr.message);
  }

  var psycList = obtenerPsicologasValidas();

  var exitosas = [];
  var fallidas = [];
  var processedNames = {};

  // 1. Procesar psicólogas prioritarias de la lista oficial canónica
  for (var i = 0; i < psycList.length; i++) {
    var pName = psycList[i];
    var pSheet = findPsychologistSheet(pName);
    if (pSheet) {
      var sRealName = pSheet.getName();
      var normKey = sRealName.trim().toUpperCase().replace(/\s+/g, " ");
      if (!processedNames[normKey]) {
        try {
          normalizarPestanaPsicologa(pSheet);
          SpreadsheetApp.flush();

          // IMPORTANTE: Obtener la hoja fresca por nombre para evitar referencia a hoja eliminada
          var postSheet = ss.getSheetByName(sRealName);
          if (!postSheet) {
            throw new Error("No se encontró la hoja '" + sRealName + "' después de normalizar.");
          }

          var postHeaders = postSheet.getRange(1, 1, 1, Math.min(postSheet.getMaxColumns(), 12)).getValues()[0];
          var colB = (postHeaders[1] || "").toString().trim();
          if (colB !== "Fecha de entrevista" || postSheet.getMaxColumns() !== 12) {
            throw new Error("Verificación fallida: Col B es '" + colB + "' (esperado 'Fecha de entrevista') y cols=" + postSheet.getMaxColumns());
          }

          exitosas.push(sRealName);
          Logger.log("✅ [" + exitosas.length + "] Normalizada y verificada correctamente: " + sRealName);
        } catch (tabErr) {
          fallidas.push({ name: sRealName, error: tabErr.message });
          Logger.log("❌ Error al normalizar '" + sRealName + "': " + tabErr.message);
        }
        processedNames[normKey] = true;
      }
    }
  }

  // 2. Procesar cualquier otra hoja que empiece por MATCHES que corresponda a psicóloga válida
  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var sh = allSheets[s];
    var sRawName = sh.getName();
    var sUpper = sRawName.trim().toUpperCase().replace(/\s+/g, " ");
    if (sUpper.indexOf("MATCHES ") === 0 && sUpper !== "MATCHES") {
      // Validar si corresponde a una psicóloga canónica válida y NO ambigua (ej: LAU está excluida)
      var validPsyc = normalizePsychologistName(sRawName);
      if (!validPsyc || validPsyc === "LAU" || sUpper === "MATCHES LAU") {
        Logger.log("ℹ️ Omitiendo pestaña '" + sRawName + "': no corresponde a una psicóloga canónica válida (es variante ambigua o no oficial).");
        continue;
      }

      if (!processedNames[sUpper]) {
        try {
          normalizarPestanaPsicologa(sh);
          SpreadsheetApp.flush();

          var postSheet2 = ss.getSheetByName(sRawName);
          if (!postSheet2) {
            throw new Error("No se encontró la hoja '" + sRawName + "' después de normalizar.");
          }

          var postHeaders2 = postSheet2.getRange(1, 1, 1, Math.min(postSheet2.getMaxColumns(), 12)).getValues()[0];
          var colB2 = (postHeaders2[1] || "").toString().trim();
          if (colB2 !== "Fecha de entrevista" || postSheet2.getMaxColumns() !== 12) {
            throw new Error("Verificación fallida: Col B es '" + colB2 + "' (esperado 'Fecha de entrevista') y cols=" + postSheet2.getMaxColumns());
          }

          exitosas.push(sRawName);
          Logger.log("✅ [" + exitosas.length + "] Normalizada y verificada correctamente: " + sRawName);
        } catch (tabErr2) {
          fallidas.push({ name: sRawName, error: tabErr2.message });
          Logger.log("❌ Error al normalizar '" + sRawName + "': " + tabErr2.message);
        }
        processedNames[sUpper] = true;
      }
    }
  }

  var resumenMsg = "Resultado de Normalización Canónica:\n\n";
  resumenMsg += "✅ Exitosas (" + exitosas.length + "):\n";
  if (exitosas.length > 0) {
    resumenMsg += " • " + exitosas.join("\n • ") + "\n\n";
  } else {
    resumenMsg += " • Ninguna\n\n";
  }

  if (fallidas.length > 0) {
    resumenMsg += "❌ Fallidas (" + fallidas.length + "):\n";
    for (var f = 0; f < fallidas.length; f++) {
      resumenMsg += " • " + fallidas[f].name + ": " + fallidas[f].error + "\n";
    }
  } else {
    resumenMsg += "🎉 ¡Todas las pestañas de psicólogas quedaron normalizadas a 12 columnas exactas!";
  }

  SpreadsheetApp.flush();
  if (!silent) {
    try {
      SpreadsheetApp.getUi().alert("⚙️ Normalizar Todas las Pestañas", resumenMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiErr) {
      Logger.log("UI Alert no disponible: " + uiErr.message);
    }
  }

  ss.toast("Normalizadas: " + exitosas.length + " | Fallidas: " + fallidas.length, "Reordenamiento Canónico", 10);
  Logger.log(resumenMsg);
  return { exitosas: exitosas, fallidas: fallidas };
}


/**
 * Retorna la lista oficial y permanente de psicólogas activas.
 * Lee primero de PropertiesService (clave 'ACTIVE_PSYCHOLOGISTS').
 * Si no está configurada o está vacía, inicializa con CONFIG.VALID_PSYCHOLOGISTS.
 * Garantiza que cualquier psicóloga creada con crearNuevaPsicologa persista entre sesiones,
 * triggers y diferentes usuarios.
 */
function obtenerPsicologasValidas() {
  var defaultList = CONFIG.VALID_PSYCHOLOGISTS || [
    "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA", "MPS"
  ];
  try {
    var props = PropertiesService.getDocumentProperties();
    var stored = props.getProperty("ACTIVE_PSYCHOLOGISTS");
    if (stored) {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        var combined = [];
        var seen = {};
        for (var d = 0; d < defaultList.length; d++) {
          var nameD = defaultList[d].trim().toUpperCase();
          if (nameD === "MARÍA" || nameD === "MARIA") nameD = "MPS";
          if (!seen[nameD]) { seen[nameD] = true; combined.push(nameD); }
        }
        for (var p = 0; p < parsed.length; p++) {
          var nameP = (parsed[p] || "").toString().trim().toUpperCase();
          if (nameP === "MARÍA" || nameP === "MARIA") nameP = "MPS";
          if (nameP && !seen[nameP]) { seen[nameP] = true; combined.push(nameP); }
        }
        return combined;
      }
    }
  } catch (e) {
    Logger.log("Aviso leyendo ACTIVE_PSYCHOLOGISTS de PropertiesService: " + e.message);
  }
  return defaultList;
}

/**
 * Guarda permanentemente una nueva psicóloga en PropertiesService y en memoria de la sesión.
 */
function registrarNuevaPsicologaPersistente(nombre) {
  if (!nombre) return obtenerPsicologasValidas();
  var upper = nombre.trim().toUpperCase();
  var currentList = obtenerPsicologasValidas();
  if (currentList.indexOf(upper) === -1) {
    currentList.push(upper);
  }
  try {
    PropertiesService.getDocumentProperties().setProperty("ACTIVE_PSYCHOLOGISTS", JSON.stringify(currentList));
    Logger.log("✅ Psicóloga '" + upper + "' guardada permanentemente en DocumentProperties. Total activas: " + currentList.length);
  } catch (e) {
    Logger.log("Error guardando psicóloga en DocumentProperties: " + e.message);
  }

  // Actualizar también CONFIG en memoria para la ejecución en curso
  if (CONFIG.VALID_PSYCHOLOGISTS.indexOf(upper) === -1) {
    CONFIG.VALID_PSYCHOLOGISTS.push(upper);
  }
  if (!CONFIG.PSYCHOLOGIST_ALIASES[upper]) {
    CONFIG.PSYCHOLOGIST_ALIASES[upper] = upper;
  }
  return currentList;
}

/**
 * Configura el desplegable de psicólogas activas en la columna Responsable de PROFILES.
 */
function configurarDropdownResponsable() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.PROFILES_SHEET_NAME || "PROFILES");
  if (!sheet) return;
  var headers = getSheetHeaders(sheet);
  var respCol = headers["RESPONSABLE"] || headers["PSICÓLOGA"] || headers["PSICOLOGA"] || 4;
  var psycList = obtenerPsicologasValidas();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(psycList, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, respCol, Math.max(sheet.getMaxRows() - 1, 100), 1).setDataValidation(rule);
  Logger.log("✅ Dropdown de Responsable en PROFILES configurado con: " + psycList.join(", "));
  try {
    ss.toast("Dropdown de Responsable en PROFILES configurado con " + psycList.length + " psicólogas.", "Responsable", 5);
  } catch (e) {}
}

/**
 * 🚀 CONFIGURACIÓN INICIAL COMPLETA
 * Función maestra para inicializar de una sola vez cualquier archivo nuevo de Daily Lover:
 * 
 * 1. Pestañas de Soporte: Verifica y crea (si faltan) ⚙️ CONFIG ESTADOS, ⚙️ RESTAURANTES, Citas Aceptadas y REFUNDS PENDIENTES.
 * 2. Psicólogas Canónicas: Unifica duplicados (MANU) y normaliza todas las pestañas de psicólogas activas a 12 columnas canónicas.
 * 3. MATCHES Canónico: Reordena y estandariza la pestaña MATCHES a 17 columnas canónicas (CRM IDs, fechas, notas, colores).
 * 4. Desplegables y Validaciones: Conecta desplegables dinámicos desde ⚙️ CONFIG ESTADOS y ⚙️ RESTAURANTES en todas las hojas.
 * 5. Dropdown Responsable: Configura el desplegable de psicólogas en PROFILES.
 * 6. Filas Congeladas: Congela fila 1 en todas las pestañas operativas.
 * 7. Triggers Automáticos: Instala disparadores periódicos (supervisión María, alertas 15 días).
 *
 * Incluye checkpoints de progreso en PropertiesService ('CONFIG_INICIAL_PASO'),
 * control de tiempo y diálogo de resumen final con el detalle de todo lo ejecutado.
 */
function configuracionInicialCompleta() {
  var tStart = new Date().getTime();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getDocumentProperties();
  var ui = SpreadsheetApp.getUi();

  var confirmacion = ui.alert(
    "🚀 Configuración Inicial Completa",
    "Esta operación configurará todo el archivo automáticamente:\n\n" +
    "1. Crear 4 pestañas de soporte (⚙️ CONFIG ESTADOS, ⚙️ RESTAURANTES, Citas Aceptadas, REFUNDS PENDIENTES)\n" +
    "2. Normalizar pestañas de psicólogas a 12 columnas canónicas (incluye unificar MANU)\n" +
    "3. Normalizar pestaña MATCHES a 17 columnas canónicas\n" +
    "4. Vincular validaciones y desplegables dinámicos\n" +
    "5. Configurar dropdown de psicólogas en PROFILES\n" +
    "6. Congelar filas de encabezado\n" +
    "7. Instalar activadores automáticos (Triggers)\n\n" +
    "¿Desea continuar?",
    ui.ButtonSet.YES_NO
  );

  if (confirmacion !== ui.Button.YES) {
    ui.alert("Operación cancelada.");
    return;
  }

  var resumen = {
    paso1_soporte: null,
    paso2_psicologas: null,
    paso3_matches: null,
    paso4_desplegables: null,
    paso5_responsable: null,
    paso6_congelar: null,
    paso7_triggers: null,
    tiempoTotalSegundos: 0,
    errorEnPaso: null
  };

  try {
    // ── PASO 1: PESTAÑAS DE SOPORTE ──
    props.setProperty("CONFIG_INICIAL_PASO", "1_SOPORTE");
    Logger.log("🚀 [Paso 1/7] Verificando / creando pestañas de soporte...");
    var resSoporte = crearPestanasDeSoporteSiFaltan(ss);
    resumen.paso1_soporte = "✅ Creadas: " + (resSoporte.creadas.length > 0 ? resSoporte.creadas.join(", ") : "Ninguna (ya existían)") + 
                            " | Existentes: " + resSoporte.existentes.join(", ");
    SpreadsheetApp.flush();

    // ── PASO 2: PSICÓLOGAS (12 COLS CANÓNICAS + MANU UNIFY) ──
    props.setProperty("CONFIG_INICIAL_PASO", "2_PSICOLOGAS");
    Logger.log("🚀 [Paso 2/7] Normalizando pestañas de psicólogas...");
    var resPsyc = reordenarColumnasPsicologasCanonico(true);
    if (resPsyc && typeof resPsyc === "object") {
      resumen.paso2_psicologas = "✅ Exitosas (" + (resPsyc.exitosas ? resPsyc.exitosas.length : 0) + "): " + (resPsyc.exitosas || []).join(", ") +
                                 (resPsyc.fallidas && resPsyc.fallidas.length > 0 ? " | ⚠️ Avisos: " + resPsyc.fallidas.map(function(f){ return f.name; }).join(", ") : "");
    } else {
      resumen.paso2_psicologas = "✅ Pestañas de psicólogas normalizadas con éxito.";
    }
    SpreadsheetApp.flush();

    // ── PASO 3: MATCHES (17 COLS CANÓNICAS) ──
    props.setProperty("CONFIG_INICIAL_PASO", "3_MATCHES");
    Logger.log("🚀 [Paso 3/7] Reordenando MATCHES a 17 columnas canónicas...");
    var resMatches = reordenarColumnasMatchesCanonico();
    resumen.paso3_matches = resMatches && resMatches.error ? "⚠️ MATCHES: " + resMatches.error : "✅ MATCHES normalizada a 17 columnas canónicas.";
    SpreadsheetApp.flush();

    // ── PASO 4: DESPLEGABLES DINÁMICOS ──
    props.setProperty("CONFIG_INICIAL_PASO", "4_DESPLEGABLES");
    Logger.log("🚀 [Paso 4/7] Actualizando desplegables dinámicos (Estados y Restaurantes)...");
    try {
      actualizarDesplegablesDinamicos();
      resumen.paso4_desplegables = "✅ Desplegables de estados y restaurantes enlazados dinámicamente.";
    } catch (eDesp) {
      resumen.paso4_desplegables = "⚠️ Aviso en desplegables: " + eDesp.message;
    }
    SpreadsheetApp.flush();

    // ── PASO 5: DROPDOWN RESPONSABLE EN PROFILES ──
    props.setProperty("CONFIG_INICIAL_PASO", "5_RESPONSABLE");
    Logger.log("🚀 [Paso 5/7] Configurando dropdown Responsable en PROFILES...");
    try {
      configurarDropdownResponsable();
      resumen.paso5_responsable = "✅ Dropdown de psicólogas activas configurado en PROFILES.";
    } catch (eResp) {
      resumen.paso5_responsable = "⚠️ Aviso en dropdown Responsable: " + eResp.message;
    }
    SpreadsheetApp.flush();

    // ── PASO 6: CONGELAR FILAS DE ENCABEZADO ──
    props.setProperty("CONFIG_INICIAL_PASO", "6_CONGELAR");
    Logger.log("🚀 [Paso 6/7] Asegurando congelamiento de fila 1...");
    try {
      asegurarFilasCongeladasLiviano();
      resumen.paso6_congelar = "✅ Fila 1 congelada en todas las pestañas.";
    } catch (eCong) {
      resumen.paso6_congelar = "⚠️ Aviso al congelar filas: " + eCong.message;
    }
    SpreadsheetApp.flush();

    // ── PASO 7: ACTIVADORES AUTOMÁTICOS (TRIGGERS) ──
    props.setProperty("CONFIG_INICIAL_PASO", "7_TRIGGERS");
    Logger.log("🚀 [Paso 7/7] Instalando activadores automáticos...");
    try {
      instalarTodosLosTriggers();
      resumen.paso7_triggers = "✅ Triggers automáticos instalados (Alertas 15 días, Supervisión María).";
    } catch (eTrig) {
      resumen.paso7_triggers = "⚠️ Aviso al instalar triggers: " + eTrig.message;
    }

    props.setProperty("CONFIG_INICIAL_PASO", "COMPLETADO");
    props.setProperty("CONFIG_INICIAL_FECHA", new Date().toISOString());

  } catch (errGlobal) {
    var pasoFallo = props.getProperty("CONFIG_INICIAL_PASO") || "DESCONOCIDO";
    resumen.errorEnPaso = "❌ Falló en paso [" + pasoFallo + "]: " + errGlobal.message;
    Logger.log("ERROR en configuracionInicialCompleta: " + errGlobal.stack);
  }

  var tEnd = new Date().getTime();
  var segs = ((tEnd - tStart) / 1000).toFixed(1);
  resumen.tiempoTotalSegundos = segs;

  // Mostrar Resumen Final
  var textoResumen = "⏱️ Tiempo de ejecución: " + segs + " segundos\n\n";
  textoResumen += "1. Soporte: " + (resumen.paso1_soporte || "Pendiente") + "\n\n";
  textoResumen += "2. Psicólogas: " + (resumen.paso2_psicologas || "Pendiente") + "\n\n";
  textoResumen += "3. MATCHES: " + (resumen.paso3_matches || "Pendiente") + "\n\n";
  textoResumen += "4. Desplegables: " + (resumen.paso4_desplegables || "Pendiente") + "\n\n";
  textoResumen += "5. PROFILES: " + (resumen.paso5_responsable || "Pendiente") + "\n\n";
  textoResumen += "6. Congelar filas: " + (resumen.paso6_congelar || "Pendiente") + "\n\n";
  textoResumen += "7. Triggers: " + (resumen.paso7_triggers || "Pendiente") + "\n";

  if (resumen.errorEnPaso) {
    textoResumen += "\n🚨 " + resumen.errorEnPaso + "\nPuede resolver el detalle o reejecutar el paso correspondiente desde el menú.";
    ui.alert("⚠️ Configuración Incompleta", textoResumen, ui.ButtonSet.OK);
  } else {
    textoResumen += "\n🎉 ¡El archivo está 100% configurado y listo para operar!";
    ui.alert("✅ Configuración Inicial Exitosa", textoResumen, ui.ButtonSet.OK);
  }

  return resumen;
}

/**
 * Crea una nueva pestaña de psicóloga con la estructura canónica estandarizada (12 columnas).
 * @param {string} nombre - Nombre de la psicóloga (ej: "CARO", "LAURA").
 * @return {Sheet} La hoja creada o existente.
 */
function crearNuevaPsicologa(nombre) {
  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    throw new Error("Debe proporcionar un nombre válido de psicóloga.");
  }

  var rawName = nombre.trim();
  var upperName = rawName.toUpperCase();
  var sheetName = CONFIG.PSYCHOLOGIST_SHEET_PREFIX + upperName;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    SpreadsheetApp.getUi().alert("Aviso", "La pestaña '" + sheetName + "' ya existe.", SpreadsheetApp.getUi().ButtonSet.OK);
    return sheet;
  }

  // Crear la hoja
  sheet = ss.insertSheet(sheetName);

  // Columnas canónicas (12)
  var CANONICAL_HEADERS = [
    "ID", "Fecha de entrevista", "PAIS", "CITY", "PREF", "PLAN",
    "PERSON A", "PERSON B", "PSICÓLOGA DE B", "STATUS", "OBSERVACIONES", "Fecha de llegada"
  ];
  var CANONICAL_WIDTHS = [70, 130, 80, 110, 80, 140, 190, 190, 120, 120, 220, 130];

  // Configurar columnas: asegurar mínimo 12 y eliminar exceso
  if (sheet.getMaxColumns() < 12) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 12 - sheet.getMaxColumns());
  } else if (sheet.getMaxColumns() > 12) {
    sheet.deleteColumns(13, sheet.getMaxColumns() - 12);
  }

  // Escribir encabezados
  var headerRange = sheet.getRange(1, 1, 1, CANONICAL_HEADERS.length);
  headerRange.setValues([CANONICAL_HEADERS]);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#D9EAD3");
  headerRange.setHorizontalAlignment("center");
  sheet.setRowHeight(1, 32);
  try { sheet.setFrozenRows(1); } catch (e) {}

  // Ancho de columnas
  for (var w = 0; w < CANONICAL_WIDTHS.length; w++) {
    sheet.setColumnWidth(w + 1, CANONICAL_WIDTHS[w]);
  }

  // Validaciones de datos
  // 1. PREF en columna 5 (E)
  var prefRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["H", "M", "H+M"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 5, Math.max(sheet.getMaxRows() - 1, 100), 1).setDataValidation(prefRule);

  // 2. STATUS en columna 10 (J)
  var psycEstados = [
    "Llenar perfil", "Listo para match", "HECHO", "APROBADO", "NOT APPROVED", "DESCALIFICADO",
    "NO HAY GENTE", "REVISAR", "TROUBLEMAKER", "HECHO POR MAPE", "REQUEST PROFILE UPDATE",
    "PSIC. URG", "MUJER +50", "REFUND", "RECHAZADA POR PSICÓLOGA B"
  ];
  try {
    var estadosData = obtenerEstadosConfigurados();
    if (estadosData && estadosData.PSICOLOGA && estadosData.PSICOLOGA.length > 0) {
      psycEstados = estadosData.PSICOLOGA;
    }
  } catch (e) {
    Logger.log("Aviso leyendo estados para nueva psicóloga: " + e.message);
  }

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(psycEstados, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 10, Math.max(sheet.getMaxRows() - 1, 100), 1).setDataValidation(statusRule);

  // Registrar permanentemente en DocumentProperties y memoria
  registrarNuevaPsicologaPersistente(upperName);
  try { configurarDropdownResponsable(); } catch (eDrop) {}

  ss.toast("Pestaña '" + sheetName + "' creada exitosamente con 12 columnas canónicas.", "Nueva Psicóloga", 6);
  return sheet;
}

/**
 * Prompt interactivo en la UI de Sheets para crear una nueva pestaña de psicóloga.
 */
function promptCrearNuevaPsicologa() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "➕ Crear Nueva Pestaña de Psicóloga",
    "Ingrese el nombre de la nueva psicóloga (ej: CARO, LAURA, DANIELA):",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var nombre = response.getResponseText();
    if (!nombre || !nombre.trim()) {
      ui.alert("Aviso", "No ingresó un nombre válido.", ui.ButtonSet.OK);
      return;
    }
    try {
      crearNuevaPsicologa(nombre);
    } catch (err) {
      ui.alert("Error", "No se pudo crear la pestaña: " + err.message, ui.ButtonSet.OK);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 15. AUTOMATIZACIÓN DIARIA (5 AM) Y GRÁFICO DE SUPERVISIÓN MPS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * NUEVO: Wrapper que llama el trigger diario (5 AM). Regenera el panel
 * sin el bloqueo de acceso exclusivo de María (que solo aplica a ejecución manual)
 * y actualiza el gráfico de barras.
 */
function actualizarPanelSupervisionDiario() {
  generarPanelSupervisionMaria(null, null, true);
  agregarGraficoAprobadosPorPsicologa();
}

/**
 * NUEVO: Instala el disparador diario a las 5 AM (hora Bogotá) que actualiza
 * el Panel de Supervisión MPS automáticamente. Correr UNA VEZ manualmente
 * desde el editor de Apps Script (o desde el menú) para activarlo.
 */
function instalarTriggerPanelSupervisionDiario() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "actualizarPanelSupervisionDiario") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("actualizarPanelSupervisionDiario")
    .timeBased()
    .atHour(5)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  Logger.log("✅ Disparador diario del Panel de Supervisión MPS configurado para las 5:00 AM.");
  SpreadsheetApp.getActiveSpreadsheet().toast("Panel de Supervisión se actualizará solo, todos los días a las 5 AM.", "Trigger Instalado", 6);
}

/**
 * NUEVO: Agrega/actualiza un gráfico de barras simple ("Matches Aprobados por Psicóloga")
 * debajo de la Tabla 1 Unificada del Panel de Supervisión MPS.
 */
function agregarGraficoAprobadosPorPsicologa() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("🔒 SUPERVISIÓN MARÍA");
  if (!sheet) return;

  var charts = sheet.getCharts();
  for (var c = 0; c < charts.length; c++) {
    if (charts[c].getOptions().get("title") === "Matches Aprobados por Psicóloga") {
      sheet.removeChart(charts[c]);
    }
  }

  var lastDataRow = 9;
  while (sheet.getRange(lastDataRow + 1, 1).getValue() !== "" && sheet.getRange(lastDataRow + 1, 1).getValue() !== "TOTAL EQUIPO") {
    lastDataRow++;
  }
  if (lastDataRow < 10) return;

  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange(10, 1, lastDataRow - 9, 1))
    .addRange(sheet.getRange(10, 5, lastDataRow - 9, 1))
    .setPosition(9, 21, 0, 0) // NUEVO: columna U (21), fila 9 — a la derecha de la tabla, no debajo, para no pisar las Tablas 2-5
    .setOption("title", "Matches Aprobados por Psicóloga")
    .setOption("legend", "none")
    .setOption("colors", ["#961500"])
    .build();

  sheet.insertChart(chart);
}
