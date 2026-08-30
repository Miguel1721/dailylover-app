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
 *    (Extensiones > Apps Script > el ícono "+" al lado de "Archivos").
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
  MARIA_EMAIL: "agente.col.bot@gmail.com", // Correo de PRUEBA para el rol de María — reemplazar por el real antes de producción
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
  } else if (sheetName === "REVISIÓN MARÍA" || sheetName === "REVISION MARIA") {
    claudeHandleRevisionMariaEdit(sheet, row, col, e.value);
  } else if (sheetName === "MATCHES") {
    claudeHandleCalendarioEdit(sheet, row, col, e.value);
  } else if (sheetName === "PROFILES" || sheetName.indexOf("PROFILES") === 0) {
    claudeHandleProfilesEdit(sheet, row, col, e.value);
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
      if (profile && profile.found) {
        // Reemplazar el texto plano por el nombre oficial, preservando el link si era una URL.
        // Se usa RichTextValue y NO =HYPERLINK(): la fórmula daba #ERROR! en producción.
        var cellRange = sheet.getRange(row, col);
        if (pastedValue.indexOf("http") === 0) {
          var rich = SpreadsheetApp.newRichTextValue()
            .setText(profile.name || pastedValue)
            .setLinkUrl(pastedValue)
            .build();
          cellRange.setRichTextValue(rich);
        } else if (profile.name) {
          cellRange.setValue(profile.name);
        }
        // Solo autocompletar CITY/PREF/PLAN si es Persona A (así se define el intake)
        if (isPersonA) {
          // CITY y PREF: si el CRM no los trae, la celda queda VACÍA y en amarillo.
          // Nunca se asume un valor (asumir la preferencia arma matches equivocados).
          claudeCompletarOMarcar(sheet, row, cityCol, profile.city, "la ciudad");
          claudeCompletarOMarcar(sheet, row, prefCol, profile.pref, "la preferencia");
          // PLAN: lo maneja Antigravity (Fase 1), acá solo se copia si viene.
          if (planCol && !sheet.getRange(row, planCol).getValue() && profile.plan_tier) {
            sheet.getRange(row, planCol).setValue(profile.plan_tier);
          }
        }
      }
      // Si no se encontró (found:false), no se toca nada — no se asume ningún dato.
    }

    // FASE 2: al escribir Persona B, avisar si la pareja ya existe
    if (!isPersonA) {
      claudeWithLock(function() {
        claudeVerificarDuplicado(sheet, row, col);
      });
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

  // ── B2. Si completaron A MANO la ciudad o la preferencia, se limpia la marca ─
  if ((cityCol && col === cityCol) || (prefCol && col === prefCol)) {
    var celdaEditada = sheet.getRange(row, col);
    if (celdaEditada.getValue().toString().trim()) {
      celdaEditada.setNote("");
      if ((celdaEditada.getBackground() || "").toUpperCase() === "#FFF2CC") {
        celdaEditada.setBackground(null);
      }
    }
  }

  // ── C. COLORES FIJOS (se aplican en cualquier edición de PREF/PLAN/STATUS) ─
  claudeAplicarColorFijo(sheet, row, statusCol, "STATUS_COLORS");
  claudeAplicarColorFijo(sheet, row, prefCol, "PREF_COLORS");
  claudeAplicarColorFijo(sheet, row, planCol, "PLAN_COLORS");
}

// ─── COMPLETAR DESDE EL CRM, O MARCAR EN AMARILLO SI NO VINO EL DATO ─────────
/**
 * Regla del equipo: nunca asumir un dato faltante en silencio, pero tampoco
 * bloquear el proceso. Si el CRM trae el valor, se escribe. Si no lo trae, la
 * celda queda VACÍA, en amarillo #FFF2CC y con una nota corta.
 * Nunca pisa algo que ya esté escrito a mano.
 */
function claudeCompletarOMarcar(sheet, row, col, valor, etiqueta) {
  if (!col) return;
  var celda = sheet.getRange(row, col);
  if (celda.getValue().toString().trim()) return; // ya tiene dato: no se toca

  var v = (valor || "").toString().trim();
  if (v) {
    celda.setValue(v);
    celda.setBackground(null).setNote("");
    return;
  }
  celda.setBackground("#FFF2CC");
  celda.setNote("Falta " + etiqueta + ": el CRM no la tiene. Completala a mano. " +
                "No bloquea el proceso, pero no se completa sola para no asumir un dato equivocado.");
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

// ─── APROBACIÓN DESDE REVISIÓN MARÍA (llama directo al bloqueo, sin depender de onEdit) ─
/**
 * Se dispara con onEditClaude cuando alguien edita la columna APROBAR
 * en la pestaña REVISIÓN MARÍA. Escribe APROBADO en la fila de origen
 * real (usando ORIGEN/FILA ORIGEN) y bloquea esa fila directamente,
 * sin depender de que el cambio programático dispare un onEdit
 * (los cambios hechos por código NO disparan triggers automáticamente).
 */
function claudeHandleRevisionMariaEdit(sheet, row, col, newValue) {
  var headers = claudeGetSheetHeaders(sheet);
  var aprobarCol = headers["APROBAR"];
  if (!aprobarCol || col !== aprobarCol) return;

  var val = (newValue || sheet.getRange(row, aprobarCol).getValue() || "").toString().trim().toUpperCase();
  if (val !== "SI" && val !== "SÍ" && val !== "TRUE" && val !== "APROBAR") return;

  var origenCol = headers["ORIGEN (PESTAÑA)"];
  var filaOrigenCol = headers["FILA ORIGEN"];
  if (!origenCol || !filaOrigenCol) return;

  var sourceSheetName = sheet.getRange(row, origenCol).getValue().toString().trim();
  var sourceRow = parseInt(sheet.getRange(row, filaOrigenCol).getValue(), 10);
  if (!sourceSheetName || !sourceRow || sourceRow <= 1) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName(sourceSheetName);
  if (!sourceSheet) {
    sheet.getRange(row, aprobarCol).setBackground("#F4CCCC").setNote("No se encontró la pestaña de origen '" + sourceSheetName + "'.");
    return;
  }

  var sourceHeaders = claudeGetSheetHeaders(sourceSheet);
  var sourceStatusCol = sourceHeaders["STATUS"];
  if (!sourceStatusCol) return;

  claudeWithLock(function() {
    // 1. Escribir APROBADO en la fila real
    sourceSheet.getRange(sourceRow, sourceStatusCol).setValue("APROBADO");
    claudeAplicarColorFijo(sourceSheet, sourceRow, sourceStatusCol, "STATUS_COLORS");

    // 2. Bloquear la fila real directamente (no depende de onEdit)
    claudeBloquearFila(sourceSheet, sourceRow, sourceHeaders);

    // 3. Marcar la fila de la vista como procesada (se limpiará en el próximo refresco)
    sheet.getRange(row, aprobarCol).setNote("Aprobado y bloqueado el " + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd HH:mm"));
  });
}

// ─── PESTAÑA "MATCHES" (CALENDARIO): SETUP DE MENSAJES + FLUJO DE REPROGRAMAR ──
var CLAUDE_NOMBRE_RESERVA = "María Paula Salinas";

/**
 * Corre esto UNA VEZ manualmente sobre la pestaña MATCHES real:
 * - Agrega la columna "¿REPROGRAMAR?" si no existe (no toca las demás).
 * - Pone la fórmula de CONFIRMACIÓN / DIA ANTES / HOY en las filas existentes
 *   y dejalas listas para nuevas filas (hasta la fila 500).
 * Es seguro correrlo más de una vez — no duplica columnas ni pisa datos que
 * no sean las 3 columnas de mensaje.
 */
function claudeSetupCalendarioMensajes() {
  var debugLines = [];
  function dbg(msg) { debugLines.push(msg); }
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    var cal = ss.getSheetByName("MATCHES");
    if (!cal) {
      dbg("ERROR: No se encontró la pestaña 'MATCHES'.");
      claudeEscribirDebug(ss, debugLines);
      return;
    }

    var headers = claudeGetSheetHeaders(cal);
    var diaCol = headers["DÍA"] || headers["DIA"];
    var lugarCol = headers["LUGAR"];
    var confCol = headers["CONFIRMACIÓN"] || headers["CONFIRMACION"];
    var diaAntesCol = headers["DIA ANTES"];
    var hoyCol = headers["HOY"];
    var reprogramarCol = headers["¿REPROGRAMAR?"] || headers["REPROGRAMAR"];

    if (!diaCol || !lugarCol) {
      dbg("ERROR: No se encontraron las columnas DÍA y/o LUGAR en MATCHES.");
      claudeEscribirDebug(ss, debugLines);
      return;
    }
    if (!confCol || !diaAntesCol || !hoyCol) {
      dbg("ERROR: No se encontraron las columnas CONFIRMACIÓN / DIA ANTES / HOY en MATCHES.");
      claudeEscribirDebug(ss, debugLines);
      return;
    }

    dbg("Iniciando. diaCol=" + diaCol + " lugarCol=" + lugarCol + " confCol=" + confCol + " diaAntesCol=" + diaAntesCol + " hoyCol=" + hoyCol);

    if (!reprogramarCol) {
      var lastCol = cal.getLastColumn();
      reprogramarCol = lastCol + 1;
      cal.getRange(1, reprogramarCol).setValue("¿REPROGRAMAR?")
        .setFontWeight("bold").setBackground("#4A2545").setFontColor("#FFFFFF");
      dbg("Columna ¿REPROGRAMAR? creada en columna " + reprogramarCol);
    }

    var diaLetter = claudeColLetter(diaCol);
    var lugarLetter = claudeColLetter(lugarCol);

    var formulaConfirmacion = function(fila) {
      var d = diaLetter + fila, l = lugarLetter + fila;
      return '=IF(AND(' + d + '<>"";' + l + '<>"");' +
        '"Para confirmarte tu date! \uD83D\uDC9B Fecha y hora: "&' + d + '&" en "&' + l + '&CHAR(10)&' +
        '"La reserva estará a nombre de ' + CLAUDE_NOMBRE_RESERVA + '."&CHAR(10)&' +
        '"El restaurante estará atento para ayudarte a ubicarte y acompañarte con cualquier detalle logístico o de seguridad. "&CHAR(10)&CHAR(10)&' +
        '"Además, ese mismo día en la mañana te escribiremos para estar pendientes de ti y acompañarte *antes, durante y después de la cita*, para que solo tengas que disfrutar la experiencia.\uD83D\uDC8C\uD83D\uDC8C"&CHAR(10)&' +
        '"Gracias por confiar en nosotras y por permitirnos ser parte de este momento\uD83D\uDC93";'+
        '"")';
    };
    var formulaDiaAntes = function(fila) {
      var d = diaLetter + fila, l = lugarLetter + fila;
      return '=IF(AND(' + d + '<>"";' + l + '<>"");' +
        '"Para recordarte tu date de mañana! \uD83D\uDC9B Fecha y hora: "&' + d + '&" en "&' + l + '&' +
        '" Esperamos tu confirmación para asegurarnos de que la cita este en pie!";'+
        '"")';
    };
    var formulaHoy = function(fila) {
      var d = diaLetter + fila, l = lugarLetter + fila;
      return '=IF(AND(' + d + '<>"";' + l + '<>"");' +
        '"Para recordarte tu date de hoy! \uD83D\uDC9B Fecha y hora: "&' + d + '&" en "&' + l + '&CHAR(10)&' +
        '"La reserva estará a nombre de ' + CLAUDE_NOMBRE_RESERVA + '!! Por favor avisanos cuando vayas en camino para estar pendiente de ti! Recuerda que hay alguien que te esta esperando, y la puntualidad vale X2!! Disfrútalo muchísimo, es solo una cita!! Avísanos cuando vayas en camino para estar pendiente de tiii!";'+
        '"")';
    };

    var numFilas = Math.max(cal.getMaxRows() - 1, cal.getLastRow() - 1) + 200;
    dbg("numFilas calculado: " + numFilas + " (maxRows=" + cal.getMaxRows() + ", lastRow=" + cal.getLastRow() + ")");

    var formulasConf = [], formulasDia = [], formulasHoy = [];
    for (var i = 2; i <= numFilas + 1; i++) {
      formulasConf.push([formulaConfirmacion(i)]);
      formulasDia.push([formulaDiaAntes(i)]);
      formulasHoy.push([formulaHoy(i)]);
    }
    dbg("Arrays construidos: " + formulasConf.length + " filas de fórmulas por columna.");

    if (cal.getMaxRows() < numFilas + 1) {
      var filasAAgregar = (numFilas + 1) - cal.getMaxRows();
      dbg("Agregando " + filasAAgregar + " filas nuevas a la hoja...");
      cal.insertRowsAfter(cal.getMaxRows(), filasAAgregar);
      dbg("Filas agregadas. Nuevo getMaxRows(): " + cal.getMaxRows());
    }

    dbg("Escribiendo CONFIRMACIÓN (columna " + confCol + ") en bloques...");
    claudeSetFormulasEnBloques(cal, 2, confCol, formulasConf, dbg);
    dbg("CONFIRMACIÓN escrita OK.");

    dbg("Escribiendo DIA ANTES (columna " + diaAntesCol + ") en bloques...");
    claudeSetFormulasEnBloques(cal, 2, diaAntesCol, formulasDia, dbg);
    dbg("DIA ANTES escrita OK.");

    dbg("Escribiendo HOY (columna " + hoyCol + ") en bloques...");
    claudeSetFormulasEnBloques(cal, 2, hoyCol, formulasHoy, dbg);
    dbg("HOY escrita OK.");

    if (numFilas + 1 >= 1580) {
      var verifRange = cal.getRange(1580, hoyCol);
      dbg("VERIFICACIÓN fila 1580 HOY -> Fórmula: '" + verifRange.getFormula() + "'");
    }

    dbg("TERMINADO OK para " + numFilas + " filas.");
    claudeEscribirDebug(ss, debugLines);

  } catch (err) {
    dbg("*** EXCEPCIÓN CAPTURADA: " + err.message);
    dbg("*** STACK: " + (err.stack || "sin stack"));
    claudeEscribirDebug(ss, debugLines);
  }
}

/**
 * Escribe todo el log acumulado en una pestaña "DEBUG" (columna A, una línea
 * por fila) para poder verlo directo en el Sheet sin depender del visor de
 * ejecuciones de Apps Script.
 */
function claudeEscribirDebug(ss, lines) {
  var debugSheet = ss.getSheetByName("DEBUG") || ss.insertSheet("DEBUG");
  debugSheet.clear();
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd HH:mm:ss");
  debugSheet.getRange(1, 1).setValue("Corrida: " + timestamp);
  var rows = lines.map(function(l) { return [l]; });
  if (rows.length > 0) {
    debugSheet.getRange(2, 1, rows.length, 1).setValues(rows);
  }
}

function claudeSetFormulasEnBloques(sheet, startRow, col, formulasArray, dbg) {
  var BLOQUE = 200;
  for (var i = 0; i < formulasArray.length; i += BLOQUE) {
    var chunk = formulasArray.slice(i, i + BLOQUE);
    sheet.getRange(startRow + i, col, chunk.length, 1).setFormulas(chunk);
    if (dbg) dbg("  Bloque escrito: filas " + (startRow + i) + " a " + (startRow + i + chunk.length - 1));
  }
}

function claudeColLetter(colNum) {
  var letter = "";
  while (colNum > 0) {
    var rem = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
}

/**
 * Cuando se marca ¿REPROGRAMAR? = Sí en una fila de MATCHES: la fila
 * original queda intacta (con su fecha vieja, como historial), y se agrega
 * una fila nueva al final con la misma pareja, sin fecha/lugar, para que
 * Servicio al Cliente ponga la nueva fecha ahí.
 */
function claudeHandleCalendarioEdit(sheet, row, col, newValue) {
  var headers = claudeGetSheetHeaders(sheet);
  var reprogramarCol = headers["¿REPROGRAMAR?"] || headers["REPROGRAMAR"];
  if (!reprogramarCol || col !== reprogramarCol) return;

  var val = (newValue || sheet.getRange(row, reprogramarCol).getValue() || "").toString().trim().toUpperCase();
  if (val !== "SI" && val !== "SÍ" && val !== "TRUE") return;

  var personACol = headers["PERSONA A"] || headers["PERSON A"];
  var personBCol = headers["PERSONA B"] || headers["PERSON B"];
  var ciudadCol = headers["CIUDAD"];
  if (!personACol) return;

  claudeWithLock(function() {
    var personACell = claudeGetCellData(sheet, row, personACol);
    var personBCell = personBCol ? claudeGetCellData(sheet, row, personBCol) : null;
    var ciudadVal = ciudadCol ? sheet.getRange(row, ciudadCol).getValue() : "";

    var lastCol = sheet.getLastColumn();
    var maxRows = sheet.getMaxRows();
    var colValues = sheet.getRange(1, personACol, maxRows, 1).getValues();
    var trueLastRow = 1;
    for (var r = colValues.length - 1; r >= 0; r--) {
      if (colValues[r][0] && colValues[r][0].toString().trim() !== "") { trueLastRow = r + 1; break; }
    }
    var newRow = trueLastRow + 1;

    if (personACell) claudeSetCellData(sheet, newRow, personACol, personACell);
    if (personBCell) claudeSetCellData(sheet, newRow, personBCol, personBCell);
    if (ciudadCol) sheet.getRange(newRow, ciudadCol).setValue(ciudadVal);

    sheet.getRange(row, reprogramarCol).setNote("Reprogramado el " + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Bogota", "yyyy-MM-dd HH:mm") + " — ver fila " + newRow);
  });
}

function claudeGetCellData(sheet, row, col) {
  if (!col) return null;
  var range = sheet.getRange(row, col);
  var richText = range.getRichTextValue();
  var value = range.getValue();
  return { text: richText ? richText.getText() : String(value || ""), value: value, richText: richText };
}

function claudeSetCellData(sheet, row, col, cellData) {
  if (!col || !cellData) return;
  var range = sheet.getRange(row, col);
  if (cellData.richText && cellData.richText.getLinkUrl()) {
    range.setRichTextValue(cellData.richText);
  } else {
    range.setValue(cellData.value !== undefined ? cellData.value : cellData.text);
  }
}

/**
 * DIAGNÓSTICO — no escribe nada, solo informa qué columna detectó para cada
 * encabezado clave de MATCHES. Correr esto y mandarme el resultado del log.
 */
function claudeDiagnosticoCalendario() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cal = ss.getSheetByName("MATCHES");
  if (!cal) {
    Logger.log("No se encontró la pestaña MATCHES.");
    return;
  }
  var headers = claudeGetSheetHeaders(cal);
  Logger.log("Encabezados detectados (texto -> columna):");
  for (var key in headers) {
    Logger.log("  '" + key + "' -> columna " + headers[key] + " (" + claudeColLetter(headers[key]) + ")");
  }
  Logger.log("---");
  Logger.log("DÍA -> " + (headers["DÍA"] || headers["DIA"]));
  Logger.log("LUGAR -> " + headers["LUGAR"]);
  Logger.log("CONFIRMACIÓN -> " + (headers["CONFIRMACIÓN"] || headers["CONFIRMACION"]));
  Logger.log("DIA ANTES -> " + headers["DIA ANTES"]);
  Logger.log("HOY -> " + headers["HOY"]);

  // Muestra el contenido real de la celda K2 (o donde haya quedado HOY) para ver si tiene fórmula
  var hoyCol = headers["HOY"];
  if (hoyCol) {
    var testRange = cal.getRange(2, hoyCol);
    Logger.log("Celda fila 2 de HOY -> Fórmula: '" + testRange.getFormula() + "' | Valor: '" + testRange.getValue() + "'");
  }

  Logger.log("---");
  Logger.log("cal.getMaxRows() -> " + cal.getMaxRows());
  Logger.log("cal.getLastRow() -> " + cal.getLastRow());
  var numFilasCalculado = Math.max(cal.getMaxRows() - 1, cal.getLastRow() - 1) + 200;
  Logger.log("numFilas que calcularía el setup -> " + numFilasCalculado + " (cubriría hasta la fila " + (numFilasCalculado + 1) + ")");

  if (hoyCol) {
    var testRange1580 = cal.getRange(1580, hoyCol);
    Logger.log("Celda fila 1580 de HOY -> Fórmula: '" + testRange1580.getFormula() + "' | Valor: '" + testRange1580.getValue() + "'");
  }
  var confCol2 = headers["CONFIRMACIÓN"] || headers["CONFIRMACION"];
  if (confCol2) {
    var testConf1580 = cal.getRange(1580, confCol2);
    Logger.log("Celda fila 1580 de CONFIRMACIÓN -> Fórmula: '" + testConf1580.getFormula() + "'");
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

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2 — HISTORIAL POR PERSONA (por ID del CRM) Y DETECCIÓN DE DUPLICADOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae el ID del CRM de una URL de SmartMatchApp.
 * Soporta .../client/7808, .../profile/7808, ?id=7808
 * Devuelve "" si no encuentra ID.
 */
function claudeExtraerCrmId(url) {
  if (!url) return "";
  var s = url.toString();
  var m = s.match(/(?:client|profile|view|user)[\/=](\d+)/i);
  if (m) return m[1];
  m = s.match(/[?&]id=(\d+)/i);
  if (m) return m[1];
  m = s.match(/\/(\d{3,})(?:[\/?#]|$)/);
  if (m) return m[1];
  return "";
}

/** Normaliza un nombre para comparar: minúsculas, sin tildes, sin espacios extra. */
function claudeNormalizarNombre(nombre) {
  if (!nombre) return "";
  return nombre.toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Lee las pestañas de psicóloga y TROUBLE en bloque y arma un índice liviano.
 * Devuelve array de: {p: pestaña, f: fila, a: personaA, b: personaB, s: status, d: fecha}
 * OPTIMIZADO: solo lee las columnas necesarias, sin rich text, con caché de 90s.
 */
function claudeConstruirIndicePersonas() {
  // Cache de 90 segundos: evita releer todo si se hacen varias consultas seguidas
  var cache = CacheService.getScriptCache();
  var cached = cache.get("idx_personas_v2");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var indice = [];

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var nombre = sh.getName().trim();
    var upper = nombre.toUpperCase();
    var esPsicologa = upper.indexOf(CLAUDE_CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upper !== "MATCHES";
    var esTrouble = upper.indexOf("TROUBLE") !== -1;
    if (!esPsicologa && !esTrouble) continue;

    var headers = claudeGetSheetHeaders(sh);
    var colA = headers["PERSON A"] || headers["PERSONA A"] || headers["CLIENTE"];
    var colB = headers["PERSON B"] || headers["PERSONA B"] || headers["CANDIDATO"] || headers["MATCH"];
    var colStatus = headers["STATUS"];
    var colFecha = headers["FECHA"];
    if (!colA) continue;

    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;

    // OPTIMIZACIÓN: leer SOLO el rango de columnas necesario, y NUNCA rich text
    // (getRichTextValues sobre miles de filas es lo que hacía esto lentísimo).
    var cols = [colA, colB, colStatus, colFecha].filter(function(x){ return x; });
    var minCol = Math.min.apply(null, cols);
    var maxCol = Math.max.apply(null, cols);
    var ancho = maxCol - minCol + 1;
    var datos = sh.getRange(2, minCol, lastRow - 1, ancho).getValues();

    var iA = colA - minCol;
    var iB = colB ? colB - minCol : -1;
    var iS = colStatus ? colStatus - minCol : -1;
    var iF = colFecha ? colFecha - minCol : -1;

    for (var r = 0; r < datos.length; r++) {
      var fila = datos[r];
      var aTxt = (fila[iA] || "").toString().trim();
      var bTxt = iB >= 0 ? (fila[iB] || "").toString().trim() : "";
      if (!aTxt && !bTxt) continue;

      indice.push({
        p: nombre,
        f: r + 2,
        a: aTxt,
        b: bTxt,
        s: iS >= 0 ? (fila[iS] || "").toString().trim().toUpperCase() : "",
        d: iF >= 0 ? (fila[iF] || "").toString().trim() : ""
      });
    }
  }

  try { cache.put("idx_personas_v2", JSON.stringify(indice), 90); } catch (e) {}
  return indice;
}

/**
 * MENÚ: Historial de una persona.
 * Acepta link del CRM o nombre (completo o parcial).
 * Si es link, primero resuelve el nombre oficial contra el backend y busca por ese.
 */
function claudeHistorialPersona() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt("Historial de persona",
    "Pegá el LINK del CRM (recomendado — resultado exacto),\nel ID del CRM (ej: 791),\no el nombre (puede ser parcial):",
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var entrada = resp.getResponseText().trim();
  if (!entrada) return;

  // Si es un link o un ID numérico, resolverlo contra el CRM para obtener
  // el nombre oficial Y el crm_id exacto (para descartar homónimos después).
  var nombreOficial = "";
  var crmIdBuscado = "";
  var esLink = entrada.indexOf("http") === 0;
  var esIdSuelto = /^\d{2,}$/.test(entrada);
  if (esLink || esIdSuelto) {
    var perfil = claudeResolveProfile(entrada);
    if (perfil && perfil.found && perfil.name) {
      nombreOficial = perfil.name;
      crmIdBuscado = (perfil.crm_id || claudeExtraerCrmId(entrada) || (esIdSuelto ? entrada : "")).toString();
    } else if (claudeExtraerCrmId(entrada) || esIdSuelto) {
      // El backend no respondió o no encontró a la persona, PERO el ID se puede
      // sacar del link igual. Buscamos directo por ID en los hipervínculos del
      // archivo (más lento, pero exacto y sin depender del CRM).
      crmIdBuscado = (claudeExtraerCrmId(entrada) || entrada).toString();
      var porId = claudeBuscarPorIdEnLinks(crmIdBuscado);
      claudeMostrarHistorial(ui, "CRM " + crmIdBuscado, crmIdBuscado, porId, 0, 0, true);
      return;
    } else {
      ui.alert("Historial", "No se pudo resolver ese link en el CRM. Probá escribiendo el nombre.", ui.ButtonSet.OK);
      return;
    }
  }

  var buscar = claudeNormalizarNombre(nombreOficial || entrada);
  if (!buscar) return;

  var indice = claudeConstruirIndicePersonas();
  var candidatos = [];

  for (var i = 0; i < indice.length; i++) {
    var e = indice[i];
    var na = claudeNormalizarNombre(e.a);
    var nb = claudeNormalizarNombre(e.b);
    var esA = na && (na.indexOf(buscar) !== -1 || buscar.indexOf(na) !== -1);
    var esB = nb && (nb.indexOf(buscar) !== -1 || buscar.indexOf(nb) !== -1);
    if (esA || esB) {
      candidatos.push({ e: e, rol: esA ? "A" : "B", pareja: esA ? e.b : e.a, nombre: esA ? e.a : e.b });
    }
  }

  // ── VERIFICACIÓN POR ID DEL CRM ──────────────────────────────────────────
  // Si el usuario pegó un link, tenemos el crm_id exacto. Leemos el hipervínculo
  // SOLO de las filas candidatas (no de todo el archivo) y confirmamos el ID.
  // Así un "Nicolás" no trae 40 personas distintas: solo la correcta.
  var hits = [], descartados = 0, sinLink = 0;
  if (crmIdBuscado) {
    var ss2 = SpreadsheetApp.getActiveSpreadsheet();
    for (var k = 0; k < candidatos.length; k++) {
      var cd = candidatos[k];
      var shC = ss2.getSheetByName(cd.e.p);
      if (!shC) continue;
      var hC = claudeGetSheetHeaders(shC);
      var colPersona = (cd.rol === "A")
        ? (hC["PERSON A"] || hC["PERSONA A"] || hC["CLIENTE"])
        : (hC["PERSON B"] || hC["PERSONA B"] || hC["CANDIDATO"] || hC["MATCH"]);
      if (!colPersona) { sinLink++; hits.push(cd); continue; }

      var rt = shC.getRange(cd.e.f, colPersona).getRichTextValue();
      var url = rt ? rt.getLinkUrl() : "";
      if (!url) {
        // Sin link: no se puede confirmar. Se muestra igual, pero marcado.
        cd.sinLink = true;
        sinLink++;
        hits.push(cd);
      } else if (claudeExtraerCrmId(url) === crmIdBuscado) {
        cd.confirmado = true;
        hits.push(cd);
      } else {
        descartados++; // mismo nombre, PERSONA DISTINTA — se descarta
      }
    }
  } else {
    hits = candidatos;
  }

  if (hits.length === 0) {
    // Distinguir "no existe" de "existe pero sin matches todavía": preguntar al CRM.
    var msgVacio;
    if (nombreOficial) {
      msgVacio = nombreOficial + " SÍ existe en el CRM" +
        (crmIdBuscado ? " (ID " + crmIdBuscado + ")" : "") +
        ", pero todavía NO tiene ningún match registrado en este archivo.\n\n" +
        "Es una persona nueva o que aún no entró al proceso.";
    } else {
      var chequeo = claudeResolveProfile(entrada);
      if (chequeo && chequeo.found && chequeo.name) {
        msgVacio = chequeo.name + " SÍ existe en el CRM" +
          (chequeo.crm_id ? " (ID " + chequeo.crm_id + ")" : "") +
          ", pero todavía NO tiene ningún match registrado en este archivo.\n\n" +
          "Es una persona nueva o que aún no entró al proceso.";
      } else {
        msgVacio = "No se encontró a \"" + entrada + "\" ni en este archivo ni en el CRM.\n\n" +
          "Revisá que el nombre esté bien escrito, o probá con solo el primer nombre o el apellido.";
      }
    }
    if (descartados > 0) {
      msgVacio += "\n\n(Se descartaron " + descartados + " filas con nombre parecido pero de OTRA persona.)";
    }
    ui.alert("Historial", msgVacio, ui.ButtonSet.OK);
    return;
  }

  var completadas = 0, rechazos = 0, enProceso = 0, cerrados = 0, otros = 0;
  var lineas = [];
  var nombresEncontrados = {};

  for (var h = 0; h < hits.length && h < 60; h++) {
    var x = hits[h], st = x.e.s;
    nombresEncontrados[x.nombre] = true;
    if (st.indexOf("TROUBLE") !== -1) rechazos++;
    else if (st === "APROBADO" || st === "MATCH DONE" || st === "CITA COMPLETADA") completadas++;
    else if (st === "HECHO" || st === "HECHO POR MAPE" || st === "LISTO PARA MATCH" ||
             st === "PENDIENTE" || st === "PENDIENTE PLAN" || st === "REVISAR" ||
             st === "REVISAR POR SI TOCA OTRO MATCH" || st === "URGENTE" || st === "EN ESPERA" ||
             st === "REQUEST PROFILE UPDATE" || st === "EN PAUSA" || st === "EN PAUSA INDEFINIDA") enProceso++;
    else if (st === "DESCALIFICADO" || st.indexOf("REFUND") !== -1 || st === "NOT APPROVED" ||
             st === "NO HAY GENTE" || st === "RESUELTO") cerrados++;
    else otros++;

    lineas.push("• [" + x.e.p + " f." + x.e.f + "] Persona " + x.rol +
      (x.pareja ? " con " + x.pareja : " (sin pareja)") +
      " — " + (st || "sin status") + (x.e.d ? " — " + x.e.d : "") +
      (x.sinLink ? "  [sin link — no verificado]" : ""));
  }

  var variantes = Object.keys(nombresEncontrados);
  var msg = "BÚSQUEDA: " + (nombreOficial || entrada) +
    (crmIdBuscado ? "  (CRM " + crmIdBuscado + ")" : "") + "\n" +
    "─────────────────────────────\n" +
    "Citas aprobadas/completadas: " + completadas + "\n" +
    "Veces rechazada (trouble):   " + rechazos + "\n" +
    "Matches en proceso:          " + enProceso + "\n" +
    "Cerrados (refund/descal.):   " + cerrados + "\n" +
    (otros > 0 ? "Sin clasificar:              " + otros + "\n" : "") +
    "Total de registros:          " + hits.length + "\n";

  if (crmIdBuscado) {
    if (descartados > 0) {
      msg += "\n✔ Se descartaron " + descartados + " filas con nombre parecido pero de OTRA persona (ID distinto).\n";
    }
    if (sinLink > 0) {
      msg += "\n⚠ " + sinLink + " fila(s) sin link del CRM: coinciden por nombre pero no se pudo confirmar que sean la misma persona.\n";
    }
  } else {
    msg += "\n⚠ Búsqueda por NOMBRE. Si hay varias personas con nombre parecido, pueden estar mezcladas. Pegá el link del CRM para resultados exactos.\n";
  }

  if (variantes.length > 1) {
    msg += "\n⚠ El nombre aparece escrito de " + variantes.length + " formas distintas:\n   " +
      variantes.join("  |  ") + "\n";
  }

  msg += "─────────────────────────────\nDETALLE:\n" + lineas.join("\n");
  if (hits.length > 60) msg += "\n\n(mostrando los primeros 60 de " + hits.length + ")";

  ui.alert("Historial de persona", msg, ui.ButtonSet.OK);
}

/**
 * Se dispara al escribir PERSON B: avisa si esa pareja (A+B, en cualquier
 * orden) ya existe en otra fila. No bloquea, solo marca en rojo con nota.
 */
function claudeVerificarDuplicado(sheet, row, colB) {
  var headers = claudeGetSheetHeaders(sheet);
  var colA = headers["PERSON A"] || headers["PERSONA A"];
  if (!colA || !colB) return;

  var aNom = claudeNormalizarNombre(sheet.getRange(row, colA).getValue());
  var bNom = claudeNormalizarNombre(sheet.getRange(row, colB).getValue());
  if (!aNom || !bNom) return;

  var indice = claudeConstruirIndicePersonas();
  var previos = [];
  var pestanaActual = sheet.getName();

  var pestanaActualNorm = claudeNormalizarNombre(pestanaActual);

  for (var i = 0; i < indice.length; i++) {
    var e = indice[i];
    var epNorm = claudeNormalizarNombre(e.p);
    if (epNorm === pestanaActualNorm && Number(e.f) === Number(row)) continue;
    if (!e.a || !e.b) continue;
    var ea = claudeNormalizarNombre(e.a), eb = claudeNormalizarNombre(e.b);
    // Misma pareja en cualquier orden (comparación exacta normalizada)
    if ((aNom === ea && bNom === eb) || (aNom === eb && bNom === ea)) {
      previos.push(e);
    }
  }

  var celdaB = sheet.getRange(row, colB);
  if (previos.length > 0) {
    var detalle = previos.slice(0, 8).map(function(p) {
      return "· " + p.p + " fila " + p.f + " — " + (p.s || "sin status") + (p.d ? " (" + p.d + ")" : "");
    }).join("\n");
    celdaB.setBackground("#F4CCCC").setNote(
      "MATCH REPETIDO\nEsta pareja ya existe " + previos.length + " vez/veces:\n" + detalle +
      "\n\n(Es solo un aviso — podés continuar si es a propósito.)");
  } else {
    var notaActual = celdaB.getNote();
    if (notaActual && notaActual.indexOf("MATCH REPETIDO") !== -1) {
      celdaB.setNote("").setBackground(null);
    }
  }
}

/** Crea el menú al abrir el archivo. */
// RENOMBRADA (antes "onOpen"): tapaba el menú de Antigravity porque Apps Script
// solo permite una función con ese nombre en todo el proyecto, y este archivo
// carga después de Parte1_Antigravity.gs. Ya no se dispara sola al abrir el
// archivo — correla a mano desde el editor si hace falta alguna de estas 3
// herramientas puntuales (el menú "🔎 Daily Lover" de Antigravity ya cubre
// historial de persona con más detalle, así que esto queda de respaldo).
function onOpenClaudeLegacy_YA_NO_SE_USA_AUTOMATICO() {
  SpreadsheetApp.getUi()
    .createMenu("🔎 Daily Lover (Claude - respaldo)")
    .addItem("Diagnóstico CRM", "claudeDiagnosticoCRM")
    .addItem("Probar duplicado en celda seleccionada", "claudeProbarDuplicadoAqui")
    .addToUi();
}

/**
 * Busca un crm_id directamente en los HIPERVÍNCULOS de todas las pestañas.
 * Más lento (lee rich text), pero exacto y sin depender del backend/CRM.
 * Se usa como respaldo cuando resolve-profile no responde o no encuentra.
 */
function claudeBuscarPorIdEnLinks(crmId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var hits = [];

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var upper = sh.getName().trim().toUpperCase();
    var esPsic = upper.indexOf(CLAUDE_CONFIG.PSYCHOLOGIST_SHEET_PREFIX) === 0 && upper !== "MATCHES";
    if (!esPsic && upper.indexOf("TROUBLE") === -1) continue;

    var h = claudeGetSheetHeaders(sh);
    var colA = h["PERSON A"] || h["PERSONA A"] || h["CLIENTE"];
    var colB = h["PERSON B"] || h["PERSONA B"] || h["CANDIDATO"] || h["MATCH"];
    var colS = h["STATUS"], colF = h["FECHA"];
    if (!colA) continue;

    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    var n = lastRow - 1;

    var richA = sh.getRange(2, colA, n, 1).getRichTextValues();
    var valA = sh.getRange(2, colA, n, 1).getValues();
    var richB = colB ? sh.getRange(2, colB, n, 1).getRichTextValues() : null;
    var valB = colB ? sh.getRange(2, colB, n, 1).getValues() : null;
    var valS = colS ? sh.getRange(2, colS, n, 1).getValues() : null;
    var valF = colF ? sh.getRange(2, colF, n, 1).getValues() : null;

    for (var r = 0; r < n; r++) {
      var ua = richA[r][0] ? richA[r][0].getLinkUrl() : "";
      var ub = (richB && richB[r][0]) ? richB[r][0].getLinkUrl() : "";
      var esA = ua && claudeExtraerCrmId(ua) === crmId;
      var esB = ub && claudeExtraerCrmId(ub) === crmId;
      if (!esA && !esB) continue;

      var nomA = (valA[r][0] || "").toString().trim();
      var nomB = valB ? (valB[r][0] || "").toString().trim() : "";
      hits.push({
        e: { p: sh.getName(), f: r + 2, a: nomA, b: nomB,
             s: valS ? (valS[r][0] || "").toString().trim().toUpperCase() : "",
             d: valF ? (valF[r][0] || "").toString().trim() : "" },
        rol: esA ? "A" : "B",
        pareja: esA ? nomB : nomA,
        nombre: esA ? nomA : nomB,
        confirmado: true
      });
    }
  }
  return hits;
}

/** Arma y muestra el cuadro de historial a partir de una lista de hits. */
function claudeMostrarHistorial(ui, titulo, crmId, hits, descartados, sinLink, viaLinks) {
  if (!hits || hits.length === 0) {
    ui.alert("Historial",
      "No se encontró ningún registro para " + titulo + ".\n\n" +
      (viaLinks
        ? "Se buscó por ID del CRM en los hipervínculos del archivo. Puede que esta persona no tenga matches todavía, o que sus filas no tengan el link pegado.\n\nProbá buscando por nombre."
        : ""),
      ui.ButtonSet.OK);
    return;
  }

  var completadas = 0, rechazos = 0, enProceso = 0, cerrados = 0, otros = 0;
  var lineas = [], nombres = {};

  for (var h = 0; h < hits.length && h < 60; h++) {
    var x = hits[h], st = x.e.s;
    if (x.nombre) nombres[x.nombre] = true;
    if (st.indexOf("TROUBLE") !== -1) rechazos++;
    else if (st === "APROBADO" || st === "MATCH DONE" || st === "CITA COMPLETADA") completadas++;
    else if (st === "HECHO" || st === "HECHO POR MAPE" || st === "LISTO PARA MATCH" ||
             st === "PENDIENTE" || st === "PENDIENTE PLAN" || st === "REVISAR" ||
             st === "REVISAR POR SI TOCA OTRO MATCH" || st === "URGENTE" || st === "EN ESPERA" ||
             st === "REQUEST PROFILE UPDATE" || st === "EN PAUSA" || st === "EN PAUSA INDEFINIDA") enProceso++;
    else if (st === "DESCALIFICADO" || st.indexOf("REFUND") !== -1 || st === "NOT APPROVED" ||
             st === "NO HAY GENTE" || st === "RESUELTO") cerrados++;
    else otros++;

    lineas.push("• [" + x.e.p + " f." + x.e.f + "] Persona " + x.rol +
      (x.pareja ? " con " + x.pareja : " (sin pareja)") +
      " — " + (st || "sin status") + (x.e.d ? " — " + x.e.d : "") +
      (x.sinLink ? "  [sin link — no verificado]" : ""));
  }

  var variantes = Object.keys(nombres);
  var msg = "BÚSQUEDA: " + titulo + "\n" +
    "─────────────────────────────\n" +
    "Citas aprobadas/completadas: " + completadas + "\n" +
    "Veces rechazada (trouble):   " + rechazos + "\n" +
    "Matches en proceso:          " + enProceso + "\n" +
    "Cerrados (refund/descal.):   " + cerrados + "\n" +
    (otros > 0 ? "Sin clasificar:              " + otros + "\n" : "") +
    "Total de registros:          " + hits.length + "\n";

  if (viaLinks) {
    msg += "\n✔ Búsqueda EXACTA por ID del CRM en los hipervínculos.\n" +
           "(El CRM no respondió, así que se buscó directo en el archivo.)\n";
  }
  if (descartados > 0) msg += "\n✔ Se descartaron " + descartados + " filas con nombre parecido pero de OTRA persona.\n";
  if (sinLink > 0) msg += "\n⚠ " + sinLink + " fila(s) sin link del CRM: coinciden por nombre pero sin confirmar.\n";
  if (variantes.length > 1) {
    msg += "\n⚠ El nombre aparece escrito de " + variantes.length + " formas:\n   " + variantes.join("  |  ") + "\n";
  }

  msg += "─────────────────────────────\nDETALLE:\n" + lineas.join("\n");
  if (hits.length > 60) msg += "\n\n(mostrando 60 de " + hits.length + ")";
  ui.alert("Historial de persona", msg, ui.ButtonSet.OK);
}

/**
 * DIAGNÓSTICO del endpoint resolve-profile.
 * Prueba varias formas de mandar el mismo cliente y escribe el resultado
 * crudo en la pestaña DEBUG, para ver qué responde realmente el backend.
 */
function claudeDiagnosticoCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lineas = [];
  var pruebas = [
    "https://dailylover.smartmatchapp.com/?#!/client/791/",
    "https://dailylover.smartmatchapp.com/#!/client/791/",
    "791"
  ];

  lineas.push("URL del endpoint: " + CLAUDE_CONFIG.BACKEND_RESOLVE_URL);
  lineas.push("");

  for (var i = 0; i < pruebas.length; i++) {
    var entrada = pruebas[i];
    lineas.push("── Prueba " + (i + 1) + ": " + entrada);
    lineas.push("   ID extraído localmente: '" + claudeExtraerCrmId(entrada) + "'");
    try {
      var resp = UrlFetchApp.fetch(CLAUDE_CONFIG.BACKEND_RESOLVE_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ url_or_query: entrada }),
        muteHttpExceptions: true
      });
      lineas.push("   Código HTTP: " + resp.getResponseCode());
      lineas.push("   Respuesta: " + resp.getContentText().substring(0, 500));
    } catch (err) {
      lineas.push("   EXCEPCIÓN: " + err.message);
    }
    lineas.push("");
  }
  claudeEscribirDebug(ss, lineas);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILES — LINK DEL CRM OBLIGATORIO (punto de entrada del sistema)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * En PROFILES, la psicóloga debe PEGAR LA URL del CRM, no escribir el nombre.
 * - Si pega una URL válida: se resuelve contra el CRM y la celda queda con el
 *   NOMBRE OFICIAL + el link incrustado (así el link viaja con la persona por
 *   todo el proceso).
 * - Si escribe texto a mano: se borra la celda y se avisa por qué.
 */
function claudeHandleProfilesEdit(sheet, row, col, newValue) {
  var headers = claudeGetSheetHeaders(sheet);
  var colPersona = headers["PERSON A"] || headers["PERSONA A"] || headers["PERSONA"] ||
                   headers["NOMBRE"] || headers["CLIENTE"] || headers["NAME"] || headers["FULLNAME"];
  if (!colPersona || col !== colPersona) return;

  var celda = sheet.getRange(row, col);
  var valor = (newValue || celda.getValue() || "").toString().trim();
  if (!valor) return;

  // Si ya tiene link incrustado y no es una URL suelta, ya está resuelta: no tocar.
  var rtActual = celda.getRichTextValue();
  if (rtActual && rtActual.getLinkUrl() && valor.indexOf("http") !== 0) return;

  var esUrl = (valor.indexOf("http") === 0);
  var notaPrevia = celda.getNote() || "";

  if (!esUrl) {
    // Escribieron texto a mano. Si antes había un link pendiente guardado en la
    // nota, lo recuperamos: el nombre que escribieron queda CON el link.
    var m = notaPrevia.match(/LINK_PENDIENTE:(\S+)/);
    if (m) {
      var rich2 = SpreadsheetApp.newRichTextValue()
        .setText(valor).setLinkUrl(m[1]).build();
      celda.setRichTextValue(rich2);
      celda.setBackground(null).setNote("");
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Nombre guardado con su link del CRM.", "Listo", 4);
      return;
    }
    // No hay link previo: se avisa, pero NO se borra lo escrito.
    celda.setBackground("#FFF2CC");
    celda.setNote("Falta el link del CRM.\n\nLo ideal es pegar la URL del perfil de " +
      "SmartMatchApp (así el link viaja con la persona por todo el proceso). " +
      "Podés continuar igual, pero esta fila queda marcada como pendiente de link.");
    return;
  }

  // Es una URL: resolverla contra el CRM
  var perfil = claudeResolveProfile(valor);
  if (!perfil || !perfil.found || !perfil.name) {
    // El CRM no lo tiene todavía. Guardamos el link en la nota y dejamos que
    // escriban el nombre a mano — el link se recupera solo cuando lo escriban.
    celda.setBackground("#FFF2CC");
    celda.setNote("LINK_PENDIENTE:" + valor + "\n\n" +
      "El CRM todavía no tiene este perfil sincronizado.\n\n" +
      "Escribí el nombre de la persona en esta misma celda: el link se va a " +
      "guardar automáticamente junto al nombre.");
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "El CRM no tiene ese perfil aún. Escribí el nombre acá y el link se conserva.",
      "Escribí el nombre", 8);
    return;
  }

  // Resuelto: dejar NOMBRE OFICIAL + link incrustado
  var rich = SpreadsheetApp.newRichTextValue()
    .setText(perfil.name).setLinkUrl(valor).build();
  celda.setRichTextValue(rich);
  celda.setBackground(null).setNote("");

  // Autocompletar los datos que vengan del CRM, sin pisar lo que ya esté escrito
  var mapa = {
    "CIUDAD": perfil.city, "CITY": perfil.city,
    "PREF": perfil.pref, "PREFERENCIA": perfil.pref,
    "PLAN": perfil.plan_tier, "PLAN TIER": perfil.plan_tier,
    "TELEFONO": perfil.phone, "TELÉFONO": perfil.phone, "PHONE": perfil.phone,
    "EMAIL": perfil.email, "CORREO": perfil.email
  };
  for (var k in mapa) {
    var cIdx = headers[k];
    if (cIdx && mapa[k]) {
      var destino = sheet.getRange(row, cIdx);
      if (!destino.getValue()) destino.setValue(mapa[k]);
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    perfil.name + " — datos traídos del CRM.", "Perfil resuelto", 5);
}

/**
 * PRUEBA MANUAL de detección de duplicados.
 * Seleccioná la celda de PERSON B de la fila que querés probar y ejecutá esto.
 * Escribe el resultado paso a paso en la pestaña DEBUG.
 */
function claudeProbarDuplicadoAqui() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var L = [];
  try {
    var sheet = ss.getActiveSheet();
    var celda = ss.getActiveRange();
    var row = celda.getRow(), col = celda.getColumn();
    L.push("Pestaña: " + sheet.getName());
    L.push("Celda seleccionada: fila " + row + ", columna " + col);

    var headers = claudeGetSheetHeaders(sheet);
    var colA = headers["PERSON A"] || headers["PERSONA A"];
    var colB = headers["PERSON B"] || headers["PERSONA B"];
    L.push("Columna PERSON A detectada: " + colA);
    L.push("Columna PERSON B detectada: " + colB);

    if (col !== colB) {
      L.push("");
      L.push("*** La celda seleccionada NO es PERSON B (columna " + colB + ").");
      L.push("*** Seleccioná la celda de PERSON B y volvé a ejecutar.");
      claudeEscribirDebug(ss, L); return;
    }

    var aVal = sheet.getRange(row, colA).getValue();
    var bVal = sheet.getRange(row, colB).getValue();
    L.push("Persona A en esta fila: '" + aVal + "'");
    L.push("Persona B en esta fila: '" + bVal + "'");
    L.push("Normalizados -> A: '" + claudeNormalizarNombre(aVal) + "' | B: '" + claudeNormalizarNombre(bVal) + "'");

    if (!aVal || !bVal) {
      L.push("");
      L.push("*** Falta Persona A o Persona B: la detección no corre sin las dos.");
      claudeEscribirDebug(ss, L); return;
    }

    CacheService.getScriptCache().remove("idx_personas_v2"); // forzar índice fresco
    var t0 = new Date().getTime();
    var idx = claudeConstruirIndicePersonas();
    L.push("Índice construido: " + idx.length + " filas, en " + ((new Date().getTime()-t0)/1000) + "s");

    var aN = claudeNormalizarNombre(aVal), bN = claudeNormalizarNombre(bVal);
    var encontrados = [];
    for (var i = 0; i < idx.length; i++) {
      var e = idx[i];
      if (e.p === sheet.getName() && e.f === row) continue;
      if (!e.a || !e.b) continue;
      var ea = claudeNormalizarNombre(e.a), eb = claudeNormalizarNombre(e.b);
      if ((aN === ea && bN === eb) || (aN === eb && bN === ea)) {
        encontrados.push(e.p + " fila " + e.f + " — " + (e.s || "sin status"));
      }
    }
    L.push("");
    L.push("Coincidencias encontradas: " + encontrados.length);
    for (var k = 0; k < encontrados.length; k++) L.push("  · " + encontrados[k]);

    L.push("");
    L.push("Ejecutando la marca real...");
    claudeVerificarDuplicado(sheet, row, colB);
    L.push("Color de fondo resultante: " + sheet.getRange(row, colB).getBackground());
    L.push("Nota resultante: " + (sheet.getRange(row, colB).getNote() || "(sin nota)"));
    L.push("LISTO.");
  } catch (err) {
    L.push("*** EXCEPCIÓN: " + err.message);
    L.push("*** " + (err.stack || ""));
  }
  claudeEscribirDebug(ss, L);
}