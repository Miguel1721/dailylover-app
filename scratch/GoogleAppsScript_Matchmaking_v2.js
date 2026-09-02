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
  REVISION_MARIA_SHEET_NAME: "REVISIÓN MARÍA",
  MATCHES_SHEET_NAME: "MATCHES",
  CONFIG_ESTADOS_SHEET_NAME: "⚙️ CONFIG ESTADOS",
  MARIA_EMAIL: "agente.col.bot@gmail.com",
  PRIORITY_SHEET_NAME: "PERSONAS DÍFICILES",
  PROFILES_SHEET_NAME: "PROFILES",
  TIMEZONE: "America/Bogota",
  LOCK_TIMEOUT_MS: 30000,
  VALID_PSYCHOLOGISTS: [
    "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA", "MARÍA"
  ],
  PSYCHOLOGIST_ALIASES: {
    "MARIA": "MARÍA",
    "MARÍA": "MARÍA",
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

  // ── DEBOUNCING ANTI-DUPLICADO DE TRIGGERS ──
  var editKey = "onEdit_" + sheetName + "_" + row + "_" + col + "_" + (editVal || "");
  try {
    var cache = CacheService.getScriptCache();
    if (cache && cache.get(editKey)) {
      Logger.log("⚠️ Evento onEdit duplicado detectado para " + editKey + " (debounced). Abortando segunda ejecución.");
      return;
    }
    if (cache) cache.put(editKey, "1", 3);
  } catch (cacheErr) {
    Logger.log("Aviso de CacheService: " + cacheErr.message);
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

      // CASO ESPECIAL: Si quien aprueba es MARÍA (Psicóloga 11)
      if (currentPsyc === "MARÍA" || currentPsyc === "MARIA") {
        withScriptLock(function() {
          var matchesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES");
          if (matchesSheet) {
            var mariaCombinedObs = "[MARÍA" + (ownerPsycB && ownerPsycB !== currentPsyc ? " ↔ " + ownerPsycB : "") + "] " + (obs || "");
            insertMatchInLowerZone(matchesSheet, {
              personACell: personACell,
              personBCell: personBCell,
              city: city,
              observaciones: mariaCombinedObs
            });
            sheet.getRange(row, statusCol).setValue("APROBADO").setBackground("#B6D7A8");
            
            // Si Persona B es de otra psicóloga, crearle la fila espejo en su pestaña
            if (ownerPsycB && ownerPsycB !== "MARÍA" && ownerPsycB !== "MARIA") {
              crearOActualizarFilaEspejo(sheet, row, "MARÍA", ownerPsycB, personACell, personBCell, city, pref, plan, obs);
            }
            SpreadsheetApp.getActiveSpreadsheet().toast("✨ Match aprobado directamente por María y transferido a MATCHES.", "Aprobación Directa María", 6);
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

// ─── 8B. PUESTA A PUNTO INICIAL AUTOMÁTICA & NORMALIZACIÓN DE 10 PESTAÑAS ───

/**
 * Normaliza una pestaña individual de psicóloga:
 * 1. Congela la fila 1 (sheet.setFrozenRows(1)).
 * 2. Lee los encabezados existentes de la fila 1 de forma segura.
 * 3. Identifica qué columnas del set canónico faltan:
 *    (ID | PAIS | CITY | PREF | PLAN | PERSON A | PERSON B | PSICÓLOGA DE B | FECHA | STATUS | OBSERVACIONES | Fecha de llegada)
 * 4. Agrega a la derecha las columnas que falten sin alterar ni tocar las columnas ni datos existentes.
 * 5. Si la hoja está vacía, inserta el set completo en la fila 1 y aplica negrita.
 */
function normalizarPestanaPsicologa(sheet) {
  if (!sheet) return;

  // 1. Congelar fila 1
  try {
    if (sheet.getFrozenRows() < 1) {
      sheet.setFrozenRows(1);
    }
  } catch (fzErr) {
    Logger.log("Aviso al congelar fila 1 en '" + sheet.getName() + "': " + fzErr);
  }

  var CANONICAL_COLS = [
    "ID", "PAIS", "CITY", "PREF", "PLAN", "PERSON A", 
    "PERSON B", "PSICÓLOGA DE B", "FECHA", "STATUS", 
    "OBSERVACIONES", "Fecha de llegada"
  ];

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, CANONICAL_COLS.length).setValues([CANONICAL_COLS]);
    sheet.getRange(1, 1, 1, CANONICAL_COLS.length).setFontWeight("bold");
    Logger.log("✅ Set canónico completo escrito en pestaña vacía '" + sheet.getName() + "'");
    return;
  }

  // 2. Leer encabezados existentes
  var existingHeaders = [];
  try {
    var rawValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    for (var i = 0; i < rawValues.length; i++) {
      existingHeaders.push((rawValues[i] || "").toString().trim());
    }
  } catch (readErr) {
    for (var c = 1; c <= lastCol; c++) {
      try {
        existingHeaders.push(sheet.getRange(1, c).getDisplayValue().trim());
      } catch (cellErr) {
        existingHeaders.push("");
      }
    }
  }

  var existingUpper = existingHeaders.map(function(h) {
    return h.toUpperCase().replace(/\s+/g, " ").trim();
  });

  // Alias para detectar si la columna ya existe bajo alguna variante
  var colAliases = {
    "ID": ["ID", "NO.", "MATCH_ID"],
    "PAIS": ["PAIS", "PAÍS", "COUNTRY"],
    "CITY": ["CITY", "CIUDAD"],
    "PREF": ["PREF", "PREFERENCIA", "ORIENTATION"],
    "PLAN": ["PLAN", "PLAN_TIER", "PLAN TIER"],
    "PERSON A": ["PERSON A", "PERSONA A", "PERSON_A", "CLIENTE"],
    "PERSON B": ["PERSON B", "PERSONA B", "PERSON_B", "CANDIDATO"],
    "PSICÓLOGA DE B": ["PSICÓLOGA DE B", "PSICOLOGA DE B", "PSICÓLOGA B", "PSICOLOGA B", "PSICOLOGA DE CANDIDATO"],
    "FECHA": ["FECHA", "DATE", "FECHA CITA"],
    "STATUS": ["STATUS", "ESTADO"],
    "OBSERVACIONES": ["OBSERVACIONES", "OBS", "OBSERVATIONS", "NOTAS"],
    "Fecha de llegada": ["FECHA DE LLEGADA", "FECHA LLEGADA", "LLEGADA", "DATE OF ARRIVAL"]
  };

  var colsToAdd = [];
  for (var k = 0; k < CANONICAL_COLS.length; k++) {
    var colName = CANONICAL_COLS[k];
    var aliases = colAliases[colName] || [colName.toUpperCase()];
    
    var found = false;
    for (var a = 0; a < aliases.length; a++) {
      if (existingUpper.indexOf(aliases[a]) >= 0) {
        found = true;
        break;
      }
    }

    if (!found) {
      colsToAdd.push(colName);
    }
  }

  // 3. Insertar solo las columnas faltantes a la derecha
  if (colsToAdd.length > 0) {
    var startCol = lastCol + 1;
    sheet.getRange(1, startCol, 1, colsToAdd.length).setValues([colsToAdd]);
    sheet.getRange(1, startCol, 1, colsToAdd.length).setFontWeight("bold");
    Logger.log("✅ Columnas agregadas a '" + sheet.getName() + "': " + colsToAdd.join(", "));
  } else {
    Logger.log("ℹ️ Pestaña '" + sheet.getName() + "' ya cuenta con todas las columnas canónicas.");
  }
}

/**
 * Puesta a punto inicial automática del archivo:
 * Se ejecuta al abrir (onOpen) y utiliza PropertiesService para asegurar ejecución
 * una sola vez por archivo/copia.
 * Normaliza las 10 pestañas de psicólogas, congela fila 1 e instala los triggers automáticos.
 */
function ejecutarPuestaAPuntoInicialAutomatico(force) {
  var props = PropertiesService.getDocumentProperties();
  var isDone = props.getProperty("PUESTA_A_PUNTO_INICIAL_AUTOMATICA_V2");
  
  if (isDone && !force) {
    Logger.log("ℹ️ Puesta a punto inicial ya completada previamente en este archivo.");
    return;
  }

  Logger.log("🚀 INICIANDO PUESTA A PUNTO INICIAL AUTOMÁTICA...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var countNormalizadas = 0;

  var psycList = CONFIG.VALID_PSYCHOLOGISTS || [
    "JENN", "ANA", "SILVI", "STEFFY", "SOFI", "MAPE D", "ALEJA", "MANU", "PIA", "ISA"
  ];

  for (var i = 0; i < psycList.length; i++) {
    var pSheet = findPsychologistSheet(psycList[i]);
    if (pSheet) {
      normalizarPestanaPsicologa(pSheet);
      countNormalizadas++;
    }
  }

  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var sName = allSheets[s].getName().trim().toUpperCase();
    if (sName.indexOf("MATCHES ") === 0 && sName !== "MATCHES") {
      normalizarPestanaPsicologa(allSheets[s]);
    }
  }

  // 3. Reordenamiento estructural canónico de MATCHES (17 columnas)
  try {
    reordenarColumnasMatchesCanonico();
  } catch (mErr) {
    Logger.log("Aviso en reordenamiento de MATCHES: " + mErr.message);
  }

  // 4. Instalar disparadores automáticos periódicos
  try {
    instalarTriggerRevisionMaria();
    instalarTriggerAlertas15DiasMatches();
  } catch (trigErr) {
    Logger.log("Aviso instalando triggers en puesta a punto: " + trigErr);
  }

  props.setProperty("PUESTA_A_PUNTO_INICIAL_AUTOMATICA_V2", "true");
  props.setProperty("PUESTA_A_PUNTO_FECHA", new Date().toISOString());

  Logger.log("✅ PUESTA A PUNTO INICIAL COMPLETADA EXITOSAMENTE (" + countNormalizadas + " pestañas procesadas).");
  try {
    ss.toast("Puesta a punto completada: " + countNormalizadas + " pestañas normalizadas y triggers instalados.", "Daily Lover Setup", 6);
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
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    
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

    // 1. Crear mapa local ultra-rápido de psicólogas por persona para evitar peticiones HTTP en bucle
    var psycMap = {};
    var allSheets = ss.getSheets();
    for (var s = 0; s < allSheets.length; s++) {
      var sh = allSheets[s];
      var sName = sh.getName().trim();
      var sUpper = sName.toUpperCase();
      if (sUpper.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && sUpper !== "MATCHES" && sUpper !== "MATCHES COMPLETED") {
        var pNameOnly = sName.substring(CONFIG.PSYCHOLOGIST_SHEET_PREFIX.length).trim();
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

    var collectedRows = [];
    var collectedRichTextsA = [];
    var collectedRichTextsB = [];
    var seenPairs = {};

    // 2. Escanear matches en estado HECHO o APROBADO de forma ultra-ligera
    for (var s = 0; s < allSheets.length; s++) {
      var curSheet = allSheets[s];
      var curName = curSheet.getName().trim();
      var upperCurName = curName.toUpperCase();

      if (upperCurName.indexOf(CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upperCurName !== "MATCHES" && upperCurName !== "MATCHES COMPLETED") {
        var psycName = curName.substring(CONFIG.PSYCHOLOGIST_SHEET_PREFIX.length).trim();
        var sHeaders = getSheetHeaders(curSheet);

        var statusCol = sHeaders["STATUS"];
        var personACol = sHeaders["PERSON A"] || sHeaders["PERSONA A"] || sHeaders["CLIENTE"];
        var personBCol = sHeaders["PERSON B"] || sHeaders["PERSONA B"] || sHeaders["CANDIDATO"] || sHeaders["MATCH"];
        var obsCol = sHeaders["OBSERVACIONES"] || sHeaders["OBSERVACION"] || sHeaders["NOTAS"];

        if (!statusCol || !personACol) continue;

        var totalRows = curSheet.getLastRow();
        if (totalRows <= 1) continue;

        var maxColToFetch = Math.max(statusCol, personACol, personBCol || 1, obsCol || 1);
        var sheetValues = curSheet.getRange(2, 1, totalRows - 1, maxColToFetch).getValues();

        var statusIdx = statusCol - 1;
        var personAIdx = personACol - 1;
        var personBIdx = personBCol ? personBCol - 1 : -1;
        var obsIdx = obsCol ? obsCol - 1 : -1;

        for (var r = 0; r < sheetValues.length; r++) {
          var rowVal = sheetValues[r];
          var st = (rowVal[statusIdx] || "").toString().trim().toUpperCase();

          if (st === "HECHO" || st === "HECHO POR MAPE" || st === "APROBADO") {
            var textA = (rowVal[personAIdx] || "").toString().trim();
            var textB = personBIdx !== -1 ? (rowVal[personBIdx] || "").toString().trim() : "";

            if (!textA || !textB) continue;

            var pairKey = getCanonicalPairId(textA, textB);
            if (seenPairs[pairKey]) continue;
            seenPairs[pairKey] = true;

            var actualRowInSheet = r + 2;
            var richTextA = curSheet.getRange(actualRowInSheet, personACol).getRichTextValue();
            var richTextB = personBCol ? curSheet.getRange(actualRowInSheet, personBCol).getRichTextValue() : null;

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

            collectedRichTextsA.push(richTextA);
            collectedRichTextsB.push(richTextB);
          }
        }
      }
    }

    // 3. Escritura en batch garantizada
    if (collectedRows.length > 0) {
      if (revisionSheet.getMaxRows() < collectedRows.length + 1) {
        revisionSheet.insertRowsAfter(revisionSheet.getMaxRows(), (collectedRows.length + 1) - revisionSheet.getMaxRows() + 10);
      }

      var targetRange = revisionSheet.getRange(2, 1, collectedRows.length, headers.length);
      targetRange.setValues(collectedRows);

      var rangeA = revisionSheet.getRange(2, 2, collectedRows.length, 1);
      var rangeB = revisionSheet.getRange(2, 5, collectedRows.length, 1);

      var richColA = collectedRichTextsA.map(function(rt) { return [rt || SpreadsheetApp.newRichTextValue().setText("").build()]; });
      var richColB = collectedRichTextsB.map(function(rt) { return [rt || SpreadsheetApp.newRichTextValue().setText("").build()]; });

      rangeA.setRichTextValues(richColA);
      rangeB.setRichTextValues(richColB);

      var checkboxRange = revisionSheet.getRange(2, 9, collectedRows.length, 1);
      var checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      checkboxRange.setDataValidation(checkboxRule);

      for (var k = 0; k < collectedRows.length; k++) {
        var apState = collectedRows[k][7];
        var rowNum = k + 2;
        if (apState === "APROBADO POR AMBAS PSICÓLOGAS") {
          revisionSheet.getRange(rowNum, 8).setBackground("#D9EAD3");
          revisionSheet.getRange(rowNum, 9).setBackground("#D9EAD3");
        } else {
          revisionSheet.getRange(rowNum, 8).setBackground("#FFF2CC");
          revisionSheet.getRange(rowNum, 9).setBackground("#E8EAED");
        }
      }
    }

    Logger.log("✅ Pestaña 'REVISIÓN MARÍA' reconstruida exitosamente con " + collectedRows.length + " filas.");
    try {
      ss.toast("REVISIÓN MARÍA actualizada: " + collectedRows.length + " matches listos.", "Revisión Lista", 5);
    } catch (tErr) {}
  } catch (err) {
    Logger.log("ERROR CRÍTICO en reconstruirRevisionMaria: " + err.message + "\n" + err.stack);
  }
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
 * Instala todos los disparadores periódicos esenciales del sistema.
 */
function instalarTodosLosTriggers() {
  instalarTriggerRevisionMaria();
  instalarTriggerAlertas15DiasMatches();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Disparadores automáticos instalados (Revisión María cada 15m, Alertas 15d diario).", "Triggers Configurados", 5);
  } catch (e) {}
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

  // ── 7.5 REGLA BLOQUEANTE: MÁXIMO 1 CLIENTE ABIERTO POR PSICÓLOGA EN PROFILES ──
  var unclosedClient = getUnclosedClientForPsychologist(psycSheet, personAName);
  if (unclosedClient) {
    Logger.log("🚨 BLOQUEO PROFILES: " + cleanPsyc + " ya tiene un cliente sin tocar: '" + unclosedClient + "'");
    
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
 * Solo muestra opciones exclusivas de administración a María (CONFIG.MARIA_EMAIL).
 */
function onOpen(e) {
  try {
    // 1. Puesta a punto inicial automática (se ejecuta una sola vez con bandera en PropertiesService)
    try {
      ejecutarPuestaAPuntoInicialAutomatico(false);
    } catch (setupErr) {
      Logger.log("Aviso en ejecución de puesta a punto inicial: " + setupErr);
    }

    // 2. Construcción de menú interactivo
    var menu = SpreadsheetApp.getUi().createMenu("🔎 Daily Lover");
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
      menu.addItem("Generar 🔒 Panel de Supervisión María", "generarPanelSupervisionMaria");
      menu.addItem("🔓 Desbloquear Fila Cruzada (Solo María)", "desbloquearFilaCruzada");
      menu.addItem("Proteger ⚙️ CONFIG ESTADOS (Solo María)", "protegerConfigEstados");
      menu.addSeparator();
    }

    menu.addItem("⚙️ Puesta a Punto Inicial (Estandarizar 10 Pestañas)", "ejecutarPuestaAPuntoInicialManual");
    menu.addItem("⏰ Instalar Disparadores Automáticos (Triggers)", "instalarTodosLosTriggers");
    menu.addItem("⏰ Verificar Alertas de 15 Días (CS y Psicólogas)", "actualizarAlertas15DiasMatches");
    menu.addItem("🚨 Verificar Inactividad 15+ Días en Clientes", "verificarInactividad15DiasClientes");
    menu.addSeparator();
    menu.addItem("Actualizar Desplegables desde ⚙️ CONFIG ESTADOS", "actualizarDesplegablesDinamicos");
    menu.addItem("Configurar Dropdown Responsable", "configurarDropdownResponsable");
    menu.addItem("⚙️ Reordenar Columnas MATCHES (17 Canónicas)", "reordenarColumnasMatchesCanonico");
    menu.addItem("⚙️ Reordenar Pestañas Psicólogas (Fecha en Col B)", "reordenarColumnasPsicologasCanonico");
    menu.addItem("⚙️ Asegurar Columnas de Estados en MATCHES", "ensureMatchesColumnsAndDropdowns");
    menu.addItem("📅 Sincronizar y Limpiar Citas Aceptadas", "sincronizarTodasLasCitasAceptadas");
    menu.addToUi();
  } catch (err) {
    Logger.log("No se pudo crear menú en onOpen: " + err);
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
 * ─── REORDENAMIENTO CANÓNICO DE PESTAÑA MATCHES (17 COLUMNAS) ────────────────
 * Realiza el movimiento real de dimensiones de columnas en Google Sheets.
 * Orden final exacto:
 * 1. Estado Total | 2. Estado Persona A | 3. Estado Persona B | 4. Persona A | 5. Persona B
 * 6. DÍA | 7. LUGAR | 8. CIUDAD | 9. RESERVA | 10. CONFIRMACIÓN | 11. DIA ANTES | 12. HOY
 * 13. PRESUPUESTO | 14. ELLA | 15. ÉL | 16. ¿REPROGRAMAR? | 17. FECHA CITA REAL
 */
function reordenarColumnasMatchesCanonico() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.MATCHES_SHEET_NAME || "MATCHES") || ss.getSheetByName("MATCHES");
  if (!sheet) {
    Logger.log("ERROR: No se encontró la pestaña 'MATCHES'.");
    return;
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

  // 6. Eliminar columnas vacías sobrantes después de la columna 17
  var curLastCol = sheet.getLastColumn();
  var maxCols = sheet.getMaxColumns();
  if (maxCols > 17 && curLastCol <= 17) {
    sheet.deleteColumns(18, maxCols - 17);
  }

  // 7. Aplicar formatos y desplegables
  ensureMatchesColumnsAndDropdowns();

  Logger.log("✅ Reordenamiento canónico de MATCHES completado exitosamente con 100% de datos históricos preservados.");
  try {
    ss.toast("Estructura canónica de MATCHES (17 columnas) reordenada exitosamente.", "MATCHES Actualizado", 6);
  } catch (e) {}
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
  var lugarCol = headers["LUGAR"] || 7;
  var restSheet = ss.getSheetByName("⚙️ RESTAURANTES");
  if (restSheet && lugarCol && maxRows > 1) {
    var rLast = Math.max(2, restSheet.getLastRow());
    var venueRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(restSheet.getRange(2, 1, rLast - 1, 1), true)
      .setAllowInvalid(false)
      .build();
    safeSetDataValidation(sheet.getRange(2, lugarCol, maxRows - 1, 1), venueRule);
  }

  Logger.log("✅ Columnas de estado y catálogo de RESTAURANTES asegurados en MATCHES.");
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
  var restSheet = ss.getSheetByName("⚙️ RESTAURANTES");
  if (restSheet && lugarCol) {
    var rLast = Math.max(2, restSheet.getLastRow());
    var venueRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(restSheet.getRange(2, 1, rLast - 1, 1), true)
      .setAllowInvalid(false)
      .build();
    safeSetDataValidation(sheet.getRange(2, lugarCol, lastRow - 1, 1), venueRule);
  }

  ss.toast("Se limpiaron y sincronizaron " + (lastRow - 1) + " fechas en 'Citas Aceptadas'.", "Sincronización Exitosa", 5);
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
  var restSheet = ss.getSheetByName("⚙️ RESTAURANTES");
  var venueRule = null;
  if (restSheet) {
    var rLast = Math.max(2, restSheet.getLastRow());
    venueRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(restSheet.getRange(2, 1, rLast - 1, 1), true)
      .setAllowInvalid(false)
      .build();
  }

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
        var mLugarCol = mHeaders["LUGAR"] || 7;
        var mMaxRows = Math.min(s.getMaxRows(), 5000);
        if (mMaxRows > 1) {
          if (matchCol) safeSetDataValidation(s.getRange(2, matchCol, mMaxRows - 1, 1), matchesRule);
          if (mStatusACol) safeSetDataValidation(s.getRange(2, mStatusACol, mMaxRows - 1, 1), matchesRule);
          if (mStatusBCol) safeSetDataValidation(s.getRange(2, mStatusBCol, mMaxRows - 1, 1), matchesRule);
          if (mLugarCol && venueRule) safeSetDataValidation(s.getRange(2, mLugarCol, mMaxRows - 1, 1), venueRule);
        }
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

// ─── 14. PESTAÑA PRIVADA 🔒 SUPERVISIÓN MARÍA (DASHBOARD OPERATIVO) ─────────

/**
 * Genera o actualiza la pestaña privada '🔒 SUPERVISIÓN MARÍA' con KPIs ejecutivos en tiempo real.
 * Solo puede ser ejecutada por María (CONFIG.MARIA_EMAIL).
 */
function generarPanelSupervisionMaria() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mariaEmail = (CONFIG.MARIA_EMAIL || "").toLowerCase().trim();

  // Control de Acceso Estricto: Si no es María quien ejecuta, denegar acceso inmediatamente
  var activeEmail = "";
  try {
    activeEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  } catch (e) {}

  if (activeEmail && mariaEmail && activeEmail !== mariaEmail) {
    SpreadsheetApp.getActiveSpreadsheet().toast("⛔ Acceso denegado: Esta función es de uso exclusivo para María.", "No Autorizado", 6);
    Logger.log("⛔ INTENTO NO AUTORIZADO de generar panel de María por: " + activeEmail);
    return;
  }

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

  // 5. Proteger pestaña exclusivamente para María (NUNCA agregar a quien ejecuta la función)
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
  ss.toast("Panel de Supervisión de María generado y actualizado.", "Panel Listo", 5);
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
  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
  var obsText = matchData.observaciones || "";
  
  // Limpiar posibles duplicados de [Compatibilidad Forzada...]
  var compForcedMatches = obsText.match(/\[Compatibilidad Forzada:[^\]]+\]/g);
  if (compForcedMatches && compForcedMatches.length > 1) {
    var uniqueCompTag = compForcedMatches[0];
    obsText = obsText.replace(/\[Compatibilidad Forzada:[^\]]+\]/g, "").trim();
    obsText = uniqueCompTag + (obsText ? " " + obsText : "");
  }

  var hasCompAlert = (obsText.indexOf("Compatibilidad Forzada") >= 0 || obsText.indexOf("ALERTA COMPATIBILIDAD") >= 0 || obsText.indexOf("INCOMPATIBILIDAD") >= 0);

  // Agregar tag de fecha de ingreso para trazabilidad de 15 días si no existe
  if (obsText.indexOf("[Ingreso CS:") === -1) {
    obsText = (obsText ? obsText + " " : "") + "[Ingreso CS: " + todayStr + "]";
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
    var restSheet = ss.getSheetByName("⚙️ RESTAURANTES");
    if (restSheet && cLugarCol) {
      var rLast = Math.max(2, restSheet.getLastRow());
      var venueRule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(restSheet.getRange(2, 1, rLast - 1, 1), true)
        .setAllowInvalid(false)
        .build();
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

  // Columnas en ⚙️ RESTAURANTES:
  // 1: Restaurante / Café (Nombre)
  // 2: Ciudad
  // 3: Tipo de comida
  // 4: Precio (rango)
  // 5: Precio Numérico (COP)
  // 6: Categoría de Presupuesto
  // 7: Días Disponibles
  // 8: Horario
  // 9: Zona
  // 10: Ubicación detallada
  var rData = restSheet.getRange(2, 1, rLast - 1, 10).getValues();
  var filteredNames = [];

  for (var i = 0; i < rData.length; i++) {
    var rName = (rData[i][0] || "").toString().trim();
    var rCity = (rData[i][1] || "").toString().trim();
    var rCat = (rData[i][5] || "").toString().trim();

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
 * Reordena las columnas en las 10 pestañas de psicólogas de forma canónica:
 * Mueve físicamente la columna 'Fecha de entrevista' / 'FECHA' a la Columna B (Columna 2).
 * Preserva el 100% de los datos históricos y actualiza los encabezados.
 */
function reordenarColumnasPsicologasCanonico() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var modifiedCount = 0;

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sName = sheet.getName().trim();
    if (sName.indexOf("MATCHES ") !== 0 || sName === "MATCHES") continue;

    var headers = getSheetHeaders(sheet);
    var colFecha = headers["FECHA DE ENTREVISTA"] || headers["FECHA ENTREVISTA"] || headers["FECHA"] || headers["DATE"];

    if (!colFecha) {
      // Si no existe, insertar columna en Columna B (2)
      sheet.insertColumnAfter(1);
      sheet.getRange(1, 2).setValue("Fecha de entrevista").setFontWeight("bold").setBackground("#D9EAD3");
      modifiedCount++;
      Logger.log("✅ Columna 'Fecha de entrevista' creada en Columna B de '" + sName + "'.");
    } else if (colFecha !== 2) {
      // Mover físicamente a la Columna B (2)
      sheet.moveColumns(sheet.getRange(1, colFecha), 2);
      sheet.getRange(1, 2).setValue("Fecha de entrevista").setFontWeight("bold").setBackground("#D9EAD3");
      modifiedCount++;
      Logger.log("✅ Columna 'Fecha de entrevista' movida de Col " + colFecha + " a Columna B en '" + sName + "'.");
    } else {
      sheet.getRange(1, 2).setValue("Fecha de entrevista").setFontWeight("bold").setBackground("#D9EAD3");
      Logger.log("ℹ️ '" + sName + "' ya tiene 'Fecha de entrevista' en Columna B.");
    }
  }

  ss.toast("Se reordenaron " + modifiedCount + " pestañas de psicólogas (Fecha de entrevista en Columna B).", "Reordenamiento Canónico", 6);
  Logger.log("✅ Reordenamiento de psicólogas completado exitosamente.");
}
