# MANUAL 3: MANUAL ADMINISTRATIVO, FINANCIERO & DIRECCIÓN OPERATIVA (SOP-ADM-03)
## Daily Lover Matchmaking & Relationship Consulting
**Versión:** 2.0 | **Código Interno:** DL-SOP-ADM-03  
**Aprobado por:** Dirección General, Dirección de Matchmaking (MPS) & Dirección Financiera (Lina)  
**Alcance:** Dirección Operativa, Coordinación de Psicólogas, Administración y Finanzas.

---

## 1. PROPÓSITO DEL MANUAL
Este manual regula la **gestión de capacidad instalada, el control financiero de membresías, la política de garantías y reembolsos (Refunds)** y las rutinas de supervisión que garantizan la sostenibilidad y el estándar de excelencia de Daily Lover.

---

## 2. GOBIERNO DE CAPACIDAD Y ASIGNACIÓN DE CUPOS

### 2.1 Carga Máxima por Psicóloga
Para mantener un análisis clínico riguroso y evitar el agotamiento del equipo, cada psicóloga debe gestionar un cupo balanceado:
* **Capacidad óptima:** 30 clientes activos simultáneos.
* **Capacidad máxima permitida:** 45 clientes activos simultáneos.
* **Límite crítico:** Al alcanzar 45 clientes, el sistema bloquea automáticamente la asignación de nuevos clientes a esa psicóloga hasta que complete citas o cierre casos.

### 2.2 Cuotas de Búsqueda por Tipo de Plan (Slots)
La membresía de cada cliente determina el número de slots de emparejamiento activos que el sistema y la psicóloga deben procesar:

| Plan Contratado | Citas Garantizadas | Slots de Búsqueda Asignados | Plazo Máximo de Servicio |
| :--- | :---: | :---: | :---: |
| **Plan Básico** | 1 cita | 2 slots | 30 días calendario |
| **Plan Plus** | 3 citas | 6 slots | 90 días calendario |
| **Plan Premium / VIP**| 6 citas | 10 slots | 180 días calendario |

---

## 3. POLÍTICA OFICIAL DE GARANTÍAS, CONGELAMIENTO Y REEMBOLSOS (REFUNDS)

### 3.1 El Embudo de Retención de 3 Fases
Ningún reembolso se procesa de forma directa sin antes pasar por el embudo de acompañamiento liderado por Lina y Dirección MPS:

```
[Solicitud de Inconformidad]
            │
            ▼
[FASE 1: Cambio de Psicóloga] ──► Sesión clínica de re-enfoque gratuita (90% retención)
            │ (Si persiste inconformidad)
            ▼
[FASE 2: Congelamiento de Plan] ──► Pausa formal hasta por 6 meses (viajes/duelo)
            │ (Si cliente no desea continuar)
            ▼
[FASE 3: Evaluación de Reembolso] ──► Pestaña 'REFUNDS PENDIENTES'
```

### 3.2 Tabla de Cálculo de Reembolsos Económicos
Si el cliente no acepta el cambio de matchmaker ni el congelamiento, el reembolso se calcula aplicando deducciones de costos operativos ya causados:

* **Cancelación antes de la entrevista de admisión:** Reembolso del 90% del valor pagado (10% gasto administrativo y pasarela de pagos).
* **Cancelación tras la entrevista pero sin matches presentados:** Reembolso del 70% (30% honorarios clínicos de intake y baremación psicográfica).
* **Cancelación tras citas ejecutadas:**
  - Se deduce el costo unitario de cada cita ejecutada según tarifa de lista individual.
  - Se reembolsa únicamente el saldo remanente no causado de citas pendientes.

### 3.3 Flujo en la Pestaña `REFUNDS PENDIENTES`
1. CS registra el caso en la pestaña dedicada de Lina.
2. Estados permitidos para Lina:
   - `PENDIENTE LINA`: Caso en análisis y llamada de contacto.
   - `CLIENTE QUIERE ESPERAR`: Cliente decide pausar o congelar.
   - `REFUND APROBADO`: Aprobado para dispersión bancaria.
   - `REFUND RECHAZADO`: Solicitud improcedente por incumplimiento de términos.
   - `REFUND PROCESADO / DONE`: Comprobante bancario emitido y membresía cerrada.

---

## 4. RUTINAS DE SUPERVISIÓN DIARIA & COMITÉS

### 4.1 Rutinas Obligatorias
* **Comité Matutino de Citas (9:00 AM - 15 min):** Verificación de reservas del día, touchpoints enviados y balance de cupos con CS.
* **Comité Semanal de Revisión Clínica (Viernes 3:00 PM - 1 hora):**
  - Auditoría de clientes con estado `REVISAR POR SI TOCA OTRO MATCH` o `NOT APPROVED`.
  - Revisión de clientes con más de 15 días sin movimiento (alerta roja).
* **Supervisión Automatizada Diaria (5:00 AM):**
  - El trigger de Apps Script compila los tiempos de respuesta de CS y el volumen de aprobados por psicóloga en la pestaña de supervisión.

---

## 5. CONVENIOS COMERCIALES CON RESTAURANTES
* Todo restaurante aliado debe firmar el **Acuerdo de Hospitalidad y Discreción de Daily Lover**.
* Las reservas se gestionan mediante canal exclusivo de WhatsApp con los administradores de los restaurantes.
* Auditoría bimensual de calidad: Se evalúa trato del personal de sala, calidad de la comida y tiempos de servicio mediante la encuesta de feedback post-cita.
