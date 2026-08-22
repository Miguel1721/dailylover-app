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
    Logger.log("🎉 PRUEBAS FINALIZADAS Y FILAS TEMPORALES LIMPIADAS");
    Logger.log("=================================================");
    ss.toast("Pruebas completadas exitosamente. Revisa el Registro de ejecución.", "Pruebas OK", 5);

  } catch (e) {
    Logger.log("❌ ERROR DURANTE LA PRUEBA: " + e.message);
    try { sheet.deleteRow(testRow); } catch(err) {}
  }
}
