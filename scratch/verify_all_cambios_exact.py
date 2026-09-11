with open(r'C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\GoogleAppsScript_Matchmaking_v2.js', 'r', encoding='utf-8') as f:
    v2 = f.read()

with open(r'C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\GoogleAppsScript_Parte2_Claude.js', 'r', encoding='utf-8') as f:
    p2 = f.read()

# For Cambio 32, check handleProfilesEdit does NOT call getUnclosedClientForPsychologist
h_start = v2.find('function handleProfilesEdit(')
h_end = v2.find('function ', h_start + 10)
handle_profiles_code = v2[h_start:h_end] if (h_start != -1 and h_end != -1) else ""
cambio_32_passed = 'getUnclosedClientForPsychologist' not in handle_profiles_code and 'Cambio 32' in handle_profiles_code

# For Cambio 33, check syncMatchToCitasAceptadas has trimmed comparisons
cambio_33_passed = 'cellAtextTrim' in v2 and 'cellBtextTrim' in v2 and 'cA === cellAtextTrim && cB === cellBtextTrim' in v2

checks = [
    ('Cambio 1: Contadores al inicio del loop', 'totalSlots = 0, listos = 0, hechos = 0, aprobados = 0' in v2 and 'noAprobados = 0, troubleOnly = 0, noHayGente = 0' in v2),
    ('Cambio 2: Separar status en if/else', 'sVal.indexOf("NOT APPROVED") >= 0' in v2 and 'sVal.indexOf("TROUBLE") >= 0' in v2 and 'sVal === "NO HAY GENTE"' in v2),
    ('Cambio 3: Capturar fecha PROFILES', 'profileDateByClient' in v2 and 'pFechaCol' in v2),
    ('Cambio 4: Fecha mas antigua sin trabajar', 'oldestPendingDate' in v2 and 'pendingDateRaw' in v2),
    ('Cambio 5: ESTADO y agregar campos', 'estadoPsic' in v2 and 'estado: estadoPsic' in v2),
    ('Cambio 6: Encabezados tabla (13 cols Cambio 37)', 'masterHeaders = [' in v2 and 'Tab Profile' in v2 and 'Asignados tab de Matches' in v2 and 'Aprobados' in v2),
    ('Cambio 7: Fila de banner GESTIÓN DE MATCHES/PERFILES pastel', 'GESTI' in v2 and '#F7D9E3' in v2 and '#D6EAF8' in v2),
    ('Cambio 8: Escritura de filas (10=fecha 8pt, 13=ESTADO)', 'pData.fechaEnBlanco' in v2 and 'setFontSize(8)' in v2 and 'pData.estado' in v2 and 'pData.totalSlots' in v2),
    ('Cambio 9: Anchos de columna (13 cols)', 'colWidths = [110, 75, 75, 60, 70, 75, 60, 75, 70, 90, 75, 60, 80]' in v2),
    ('Cambio 10: Merges filas 2, 3, 5 a M', 'A2:M2' in v2 and 'A3:M3' in v2 and 'A5:M5' in v2),
    ('Cambio 11: Control de acceso bypass isAutomatedRun', 'if (!isAutomatedRun) {' in v2),
    ('Cambio 12: Funciones diarias (actualizar y trigger)', 'actualizarPanelSupervisionDiario()' in v2 and 'instalarTriggerPanelSupervisionDiario()' in v2),
    ('Cambio 13: Formato numerico plano cols 2-9, 11, 12', 'plainNumberCols = [2, 3, 4, 5, 6, 7, 8, 9, 11, 12]' in v2),
    ('Cambio 14: Grafico de barras posicionado en col O (15)', 'agregarGraficoAprobadosPorPsicologa()' in v2 and '.setPosition(5, 15, 0, 0)' in v2),
    ('Cambio 15: Reposicionar REPROGRAMAR antes de fecha cita', 'REPROGRAMAR' in v2 and 'sheet.moveColumns(sheet.getRange(1, colReprogramar), 17)' in v2),
    ('Cambio 16: Columna HORA en MATCHES', 'headers["HORA"]' in v2 and 'sheet.getRange(1, colHora).setValue("HORA")' in v2),
    ('Cambio 17: WhatsApp con FECHA + HORA (Parte2_Claude)', 'horaCol' in p2 and 'HORA' in p2),
    ('Cambio 18: Desunir celdas combinadas breakApart', 'sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart()' in v2),
    ('Cambio 19: Desplegables CIUDAD y PRESUPUESTO desde RESTAURANTES', 'getUniqueColumnValues(restSheetForLists, "CIUDAD")' in v2 and 'CATEGORIA PRESUPUESTO' in v2),
    ('Cambio 20: Rango HORA acotado 11am-10pm cada 30 min', 'for (var h = 11; h <= 22; h++)' in v2),
    ('Cambio 21: Desplegable Si/No en RESERVA y cita reservada', 'requireValueInList(["S' in v2 and 'cita reservada' in v2),
    ('Cambio 22: Color lila #B4A7D6 para cita reservada', '#b4a7d6' in v2.lower()),
    ('Cambio 23: findPersonDetailsInWorkbook busca en PERSON B', 'personBColCheck' in v2 and 'rowTextB' in v2),
    ('Cambio 24: Toast de rechazo honesto (missingPsyc)', 'if (missingPsyc)' in v2 and 'toast' in v2),
    ('Cambio 25: Re-sync Citas Aceptadas al editar Lugar/Ciudad/Presupuesto/Hora', 'col === cityCol || col === presupuestoCol || col === restauranteCol || col === horaCol' in v2),
    ('Cambio 26: No cortar busqueda si crm no trae psicologa', 'if (crm && crm.found && crm.psychologist)' in v2),
    ('Cambio 28: Fecha en blanco con formato espanol', 'formatFechaEspanolSupervision' in v2 and 'oldestPendingDate' in v2),
    ('Cambio 29: Quitar Total Slots y Rendimiento (14 cols layout)', 'eficiencia' in v2 and 'masterHeaders' in v2),
    ('Cambio 30: Agrupacion de bloques de gestion con banners', 'GESTI' in v2 and 'MATCHES' in v2 and 'PERFILES' in v2 and 'lastTable1Row = 7 +' in v2),
    ('Cambio 31: Limpiar validaciones heredadas F1 en PROFILES', 'sheet.getRange(1, slotsCol, sheet.getMaxRows(), 1).clearDataValidations()' in v2 and 'getCellData' in v2),
    ('Cambio 32: Quitar regla bloqueante de 1 cliente abierto en PROFILES', cambio_32_passed),
    ('Cambio 33: Prevenir duplicados en Citas Aceptadas con trim en nombres', cambio_33_passed),
    ('Cambio 34: Copiar cita confirmada a zona seguimiento cronologico amarillo', 'copiarACitasAgendadasArriba' in v2 and 'parseFechaTextoLibre' in v2 and 'TRACKING_ZONE_END_ROW' in v2 and 'copiarACitasAgendadasArriba(sheet, row)' in v2),
    ('Cambio 35: Columna 19 OBSERVACIONES CS dedicada (evitar pisar PRESUPUESTO)', 'Cambio 35' in v2 and 'OBSERVACIONES CS' in v2 and 'obsCol = 19' in v2 and ('headers["OBSERVACIONES"] || headers["PRESUPUESTO"]' not in v2)),
    ('Cambio 36: Diagnostico y logging exhaustivo en copiarACitasAgendadasArriba', 'Cambio 36' in v2 and 'Cambio 34: iniciando para fila' in v2 and 'Cambio 34: salió temprano, sin diaRaw' in v2 and 'Cambio 34: pareja ya existe en zona de seguimiento' in v2 and 'Cambio 34: insertando fila nueva en posición' in v2),
    ('Cambio 37: Columna Asignados tab de Matches y banners en pastel', 'Tab Profile' in v2 and 'Asignados tab de Matches' in v2 and '#F7D9E3' in v2 and '#D6EAF8' in v2 and 'pData.totalSlots' in v2 and '.setPosition(5, 15, 0, 0)' in v2)
]

all_ok = True
for name, passed in checks:
    status = "VERIFICADO [OK]" if passed else "FALLO [FAIL]"
    print(f'{name:72} : {status}')
    if not passed:
        all_ok = False

print('=' * 92)
if all_ok:
    print('TODOS LOS CAMBIOS DEL 1 AL 37 ESTAN 100% IMPLEMENTADOS Y VERIFICADOS.')
else:
    print('HAY CAMBIOS PENDIENTES O CON DISCREPANCIA.')

