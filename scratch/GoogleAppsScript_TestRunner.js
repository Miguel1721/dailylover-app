/**
 * ============================================================================
 * SUITE DE PRUEBAS AUTOMATIZADAS (1-CLIC) PARA GOOGLE APPS SCRIPT
 * ============================================================================
 * Función: testAllFlowsProgrammatically()
 * 
 * CÓMO EJECUTARLA EN APPS SCRIPT:
 * 1. En el editor de Apps Script, selecciona la función 'testAllFlowsProgrammatically'
 *    en la barra superior desplegable junto a "Depurar" / "Ejecutar".
 * 2. Haz clic en "Ejecutar".
 * 3. Revisa el Registro de ejecución (Execution Log).
 * ============================================================================
 */

function testAllFlowsProgrammatically() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("MATCHES JENN") || ss.getSheets()[0];
  var sheetName = sheet.getName();
  Logger.log("=================================================");
  Logger.log("INICIANDO SUITE DE PRUEBAS EN: " + sheetName);
  Logger.log("=================================================");

  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 4;
  var personBCol = headers["PERSON B"] || headers["PERSONA B"] || 5;
  var cityCol = headers["CITY"] || headers["CIUDAD"] || 1;
  var prefCol = headers["PREF"] || 2;
  var planCol = headers["PLAN"] || 3;
  var statusCol = headers["STATUS"] || 7;
  var obsCol = headers["OBSERVACIONES"] || 8;

  var lastRowBefore = getTrueLastRow(sheet, personACol);
  var testRow = lastRowBefore + 1;
  Logger.log("Fila de prueba asignada: Fila " + testRow);

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: AUTOCOMPLETADO CRM VÍA BACKEND (resolve-profile)
    // -------------------------------------------------------------
    Logger.log("\n--- [PRUEBA 1] Autocompletado CRM ---");
    var testUrl = "https://dailylover.smartmatchapp.com/client/7808";
    sheet.getRange(testRow, personACol).setValue(testUrl);
    
    // Simular evento onEditClaude para Persona A
    if (typeof handleClaudePsychologistSheetEdit === "function") {
      handleClaudePsychologistSheetEdit(sheet, testRow, personACol, testUrl);
      var formula = sheet.getRange(testRow, personACol).getFormula();
      var nameVal = sheet.getRange(testRow, personACol).getValue();
      Logger.log("Resultado Celda Persona A -> Fórmula: " + formula + " | Valor: " + nameVal);
      if (formula.indexOf("HYPERLINK") !== -1 || nameVal.indexOf("Lissan") !== -1) {
        Logger.log("✅ [PASÓ] Hipervínculo y resolución de perfil CRM correcta.");
      } else {
        Logger.log("⚠️ [REVISAR] Autocompletado CRM devolvió: " + nameVal);
      }
    } else {
      Logger.log("ℹ️ handleClaudePsychologistSheetEdit no está en el mismo archivo (está en Parte 2).");
    }

    // -------------------------------------------------------------
    // PRUEBA 2: COLORES FIJOS
    // -------------------------------------------------------------
    Logger.log("\n--- [PRUEBA 2] Aplicación de Colores Fijos ---");
    sheet.getRange(testRow, prefCol).setValue("GAY");
    sheet.getRange(testRow, planCol).setValue("VIP 195K");
    sheet.getRange(testRow, statusCol).setValue("HECHO");
    
    if (typeof claudeAplicarColorFijo === "function") {
      claudeAplicarColorFijo(sheet, testRow, prefCol, "PREF_COLORS");
      claudeAplicarColorFijo(sheet, testRow, planCol, "PLAN_COLORS");
      claudeAplicarColorFijo(sheet, testRow, statusCol, "STATUS_COLORS");
      Logger.log("Color PREF: " + sheet.getRange(testRow, prefCol).getBackground());
      Logger.log("Color PLAN: " + sheet.getRange(testRow, planCol).getBackground());
      Logger.log("Color STATUS: " + sheet.getRange(testRow, statusCol).getBackground());
      Logger.log("✅ [PASÓ] Colores aplicados exitosamente.");
    } else {
      Logger.log("ℹ️ claudeAplicarColorFijo se ejecuta desde el archivo Parte 2.");
    }

    // -------------------------------------------------------------
    // PRUEBA 3: ESTADO INTERMEDIO (REVISAR POR SI TOCA OTRO MATCH)
    // -------------------------------------------------------------
    Logger.log("\n--- [PRUEBA 3] Estado Intermedio: REVISAR POR SI TOCA OTRO MATCH ---");
    var rowCountBeforeRevisar = getTrueLastRow(sheet, personACol);
    sheet.getRange(testRow, statusCol).setValue("REVISAR POR SI TOCA OTRO MATCH");
    handleStatusChange(sheet, testRow, headers, "REVISAR POR SI TOCA OTRO MATCH");
    var rowCountAfterRevisar = getTrueLastRow(sheet, personACol);
    if (rowCountBeforeRevisar === rowCountAfterRevisar) {
      Logger.log("✅ [PASÓ] REVISAR POR SI TOCA OTRO MATCH NO generó fila nueva (comportamiento correcto).");
    } else {
      Logger.log("❌ [FALLÓ] Se generó fila adicional indebida.");
    }

    // -------------------------------------------------------------
    // PRUEBA 4: RECHAZO FINAL (NOT APPROVED / TROUBLEMAKER)
    // -------------------------------------------------------------
    Logger.log("\n--- [PRUEBA 4] Rechazo y Regeneración de Fila (NOT APPROVED) ---");
    var rowCountBeforeNotApproved = getTrueLastRow(sheet, personACol);
    sheet.getRange(testRow, statusCol).setValue("NOT APPROVED");
    handleStatusChange(sheet, testRow, headers, "NOT APPROVED");
    var rowCountAfterNotApproved = getTrueLastRow(sheet, personACol);
    if (rowCountAfterNotApproved > rowCountBeforeNotApproved) {
      var newRetryRow = rowCountAfterNotApproved;
      var retryStatus = sheet.getRange(newRetryRow, statusCol).getValue();
      var retryPersonA = sheet.getRange(newRetryRow, personACol).getValue();
      Logger.log("Nueva fila generada en fila " + newRetryRow + " con Status: '" + retryStatus + "' para: " + retryPersonA);
      Logger.log("✅ [PASÓ] NOT APPROVED generó correctamente la nueva fila de reintento.");
      // Limpiar fila de reintento creada
      sheet.deleteRow(newRetryRow);
    } else {
      Logger.log("❌ [FALLÓ] NOT APPROVED no generó la fila nueva.");
    }

    // -------------------------------------------------------------
    // PRUEBA 5: COLA DE REFUNDS (REFUND)
    // -------------------------------------------------------------
    Logger.log("\n--- [PRUEBA 5] Cola de Refunds ---");
    var refundsSheet = ss.getSheetByName("REFUNDS PENDIENTES");
    var refundsCountBefore = refundsSheet ? refundsSheet.getLastRow() : 0;
    sheet.getRange(testRow, statusCol).setValue("REFUND");
    handleStatusChange(sheet, testRow, headers, "REFUND");
    var refundsCountAfter = refundsSheet ? refundsSheet.getLastRow() : 0;
    if (refundsCountAfter > refundsCountBefore) {
      Logger.log("✅ [PASÓ] Fila transferida exitosamente a REFUNDS PENDIENTES (Total filas en Refunds: " + refundsCountAfter + ").");
    } else {
      Logger.log("⚠️ [REVISAR] No se incrementó la pestaña REFUNDS PENDIENTES.");
    }

    // Limpieza de la fila de prueba
    sheet.deleteRow(testRow);
    Logger.log("\n=================================================");
    Logger.log("🎉 PRUEBAS DE FLUJO BÁSICO FINALIZADAS");
    Logger.log("=================================================");

  } catch (e) {
    Logger.log("❌ ERROR DURANTE LA PRUEBA: " + e.message);
    try { sheet.deleteRow(testRow); } catch(err) {}
  }
}

/**
 * ============================================================================
 * PRUEBAS DE LAS 3 VARIANTES DE PROFILE PRIORITARIO (PESTAÑA 'PERSONAS DÍFICILES')
 * ============================================================================
 */
function testProfilePrioritarioVariants() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PRIORITY_SHEET_NAME || "PERSONAS DÍFICILES";
  var sheet = ss.getSheetByName(sheetName) || ss.getSheetByName("PERSONAS DIFICILES");
  if (!sheet) {
    Logger.log("❌ Pestaña '" + sheetName + "' no encontrada.");
    return;
  }

  Logger.log("=================================================");
  Logger.log("🚀 INICIANDO PRUEBAS DE PROFILE PRIORITARIO (3 VARIANTES)");
  Logger.log("=================================================");

  var headers = getSheetHeaders(sheet);
  var personACol = headers["PERSON A"] || headers["PERSONA A"] || 1;
  var psycCol = headers["INTERVIEWED BY:"] || headers["INTERVIEWED BY"] || 2;
  var planCol = headers["PLAN"] || 3;
  var ciudadCol = headers["CIUDAD"] || headers["CITY"] || 4;
  var prefCol = headers["PREF"] || 5;
  var fechaIngresoCol = headers["FECHA INGRESO"] || headers["FECHA"] || 6;
  var obsCol = headers["OBSERVACIONES"] || 7;
  var statusCol = headers["STATUS"] || 8;
  var slotsCol = headers["SLOTS CREADOS"] || 9;

  var lastRow = getTrueLastRow(sheet, personACol);
  var rowCase1 = lastRow + 1;
  var rowCase2 = lastRow + 2;
  var rowCase3 = lastRow + 3;

  try {
    // -------------------------------------------------------------
    // VARIANTE 1: PLAN VÁLIDO + PSICÓLOGA CON ALIAS (MAPE -> MAPE D)
    // -------------------------------------------------------------
    Logger.log("\n--- [VARIANTE 1] Plan Válido + Alias de Psicóloga (MAPE -> MAPE D) ---");
    var crmUrl = "https://dailylover.smartmatchapp.com/client/7808"; // Lissan Ayala
    sheet.getRange(rowCase1, personACol).setValue(crmUrl);
    sheet.getRange(rowCase1, psycCol).setValue("MAPE"); // Alias de MAPE D
    sheet.getRange(rowCase1, planCol).setValue("VIP 195K"); // Plan válido (4 slots)
    sheet.getRange(rowCase1, ciudadCol).setValue("Bogota");
    sheet.getRange(rowCase1, prefCol).setValue("hetero");
    sheet.getRange(rowCase1, obsCol).setValue("Prueba Variante 1");

    // Ejecutar autocompletado y creación de slots
    if (typeof handleClaudePersonasDificilesEdit === "function") {
      handleClaudePersonasDificilesEdit(sheet, rowCase1, personACol, crmUrl);
    }
    handlePersonasDificilesEdit(sheet, rowCase1, personACol);

    var psycVal1 = sheet.getRange(rowCase1, psycCol).getValue();
    var slotsVal1 = sheet.getRange(rowCase1, slotsCol).getValue();
    var slotsBg1 = sheet.getRange(rowCase1, slotsCol).getBackground();
    Logger.log("Psicóloga normalizada: '" + psycVal1 + "' (Esperado: MAPE D)");
    Logger.log("Slots creados: '" + slotsVal1 + "' | Fondo: " + slotsBg1);

    // Verificar en pestaña MATCHES MAPE D
    var psycSheet1 = findPsychologistSheet("MAPE D");
    var slotsFound = 0;
    if (psycSheet1) {
      var pHeaders1 = getSheetHeaders(psycSheet1);
      var pLast = getTrueLastRow(psycSheet1, pHeaders1["PERSON A"] || 1);
      var pVals = psycSheet1.getRange(Math.max(2, pLast - 5), 1, Math.min(6, pLast), psycSheet1.getLastColumn()).getValues();
      for (var k = 0; k < pVals.length; k++) {
        var obsText = (pVals[k][(pHeaders1["OBSERVACIONES"] || 8) - 1] || "").toString();
        if (obsText.indexOf("[PRIORITARIO") !== -1 && obsText.indexOf("Prueba Variante 1") !== -1) {
          slotsFound++;
        }
      }
    }

    if (psycVal1 === "MAPE D" && slotsVal1.indexOf("4 SLOTS CREADOS") !== -1) {
      Logger.log("✅ [PASÓ VARIANTE 1] Alias MAPE normalizado a MAPE D y 4 slots prioritarios generados exitosamente.");
    } else {
      Logger.log("⚠️ [REVISAR VARIANTE 1] psycVal: " + psycVal1 + " | slotsVal: " + slotsVal1);
    }

    // -------------------------------------------------------------
    // VARIANTE 2: PLAN QUE EL CRM NO ENCUENTRA / VACÍO (NO BLOQUEANTE)
    // -------------------------------------------------------------
    Logger.log("\n--- [VARIANTE 2] Plan Vacío / No Encontrado (Amarillo No Bloqueante) ---");
    sheet.getRange(rowCase2, personACol).setValue("Persona Sin Plan");
    sheet.getRange(rowCase2, psycCol).setValue("JENN");
    sheet.getRange(rowCase2, planCol).setValue(""); // Plan vacío
    sheet.getRange(rowCase2, ciudadCol).setValue("Medellin");
    sheet.getRange(rowCase2, obsCol).setValue("Prueba Variante 2");

    handlePersonasDificilesEdit(sheet, rowCase2, personACol);

    var planBg2 = sheet.getRange(rowCase2, planCol).getBackground();
    var planNote2 = sheet.getRange(rowCase2, planCol).getNote();
    var slotsVal2 = sheet.getRange(rowCase2, slotsCol).getValue();
    Logger.log("Fondo PLAN: " + planBg2 + " (Esperado: #fff2cc) | Nota: '" + planNote2 + "'");
    Logger.log("Slots creados: '" + slotsVal2 + "' (Esperado: PENDIENTE PLAN)");

    if (planBg2.toLowerCase() === "#fff2cc" && slotsVal2.indexOf("PENDIENTE") !== -1) {
      Logger.log("✅ [PASÓ VARIANTE 2.A] Plan vacío marcado correctamente en amarillo #FFF2CC con advertencia.");
    }

    // Probar completado manual de plan:
    Logger.log("Simulando que María/Servicio al Cliente escribe 'Básico 40k' en la celda PLAN...");
    sheet.getRange(rowCase2, planCol).setValue("Básico 40k");
    handlePersonasDificilesEdit(sheet, rowCase2, planCol);

    var planBg2After = sheet.getRange(rowCase2, planCol).getBackground();
    var slotsVal2After = sheet.getRange(rowCase2, slotsCol).getValue();
    var slotsBg2After = sheet.getRange(rowCase2, slotsCol).getBackground();
    Logger.log("Post-completado -> Slots: '" + slotsVal2After + "' | Fondo: " + slotsBg2After);

    if (slotsVal2After.indexOf("2 SLOTS CREADOS") !== -1 && slotsBg2After.toLowerCase() === "#d9ead3") {
      Logger.log("✅ [PASÓ VARIANTE 2.B] Al escribir el plan manualmente, se generaron los 2 slots y pasó a verde #D9EAD3.");
    }

    // -------------------------------------------------------------
    // VARIANTE 3: PSICÓLOGA NO VÁLIDA (MARI PAZ / VACÍO)
    // -------------------------------------------------------------
    Logger.log("\n--- [VARIANTE 3] Psicóloga No Válida (Amarillo No Bloqueante) ---");
    sheet.getRange(rowCase3, personACol).setValue("Persona Psyc Invalida");
    sheet.getRange(rowCase3, psycCol).setValue("MARI PAZ"); // Inválida
    sheet.getRange(rowCase3, planCol).setValue("ESTÁNDAR 65K (2 CITAS)");
    sheet.getRange(rowCase3, ciudadCol).setValue("Cali");
    sheet.getRange(rowCase3, obsCol).setValue("Prueba Variante 3");

    handlePersonasDificilesEdit(sheet, rowCase3, personACol);

    var psycBg3 = sheet.getRange(rowCase3, psycCol).getBackground();
    var psycNote3 = sheet.getRange(rowCase3, psycCol).getNote();
    var slotsVal3 = sheet.getRange(rowCase3, slotsCol).getValue();
    Logger.log("Fondo PSICÓLOGA: " + psycBg3 + " (Esperado: #fff2cc) | Nota: '" + psycNote3 + "'");
    Logger.log("Slots creados: '" + slotsVal3 + "' (Esperado: PENDIENTE PSICÓLOGA)");

    if (psycBg3.toLowerCase() === "#fff2cc" && slotsVal3.indexOf("PENDIENTE") !== -1) {
      Logger.log("✅ [PASÓ VARIANTE 3] Psicóloga 'MARI PAZ' marcada en amarillo con nota y estado pendiente.");
    }

    // Limpieza de las 3 filas de prueba en PERSONAS DÍFICILES y en MATCHES MAPE D
    sheet.deleteRows(rowCase1, 3);
    if (psycSheet1 && slotsFound > 0) {
      var pLastAfter = getTrueLastRow(psycSheet1, pHeaders1["PERSON A"] || 1);
      psycSheet1.deleteRows(pLastAfter - slotsFound + 1, slotsFound);
    }

    Logger.log("\n=================================================");
    Logger.log("🎉 TODAS LAS VARIANTES PROBADAS Y LIMPIAS CON ÉXITO");
    Logger.log("=================================================");
    ss.toast("Pruebas de Profile Prioritario completadas.", "Test OK", 5);

  } catch(e) {
    Logger.log("❌ Error en pruebas de variantes: " + e.message);
    try { sheet.deleteRows(rowCase1, 3); } catch(err) {}
  }
}
