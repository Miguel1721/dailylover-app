# MANUAL 2: MANUAL DE SERVICIO AL CLIENTE & CONCIERGE DE CITAS (SOP-CS-02)
## Daily Lover Matchmaking & Relationship Consulting
**Versión:** 2.0 | **Código Interno:** DL-SOP-CS-02  
**Aprobado por:** Coordinación de Servicio al Cliente & Dirección General  
**Alcance:** Coordinadoras de Servicio al Cliente, Concierges y Especialistas en Logística de Experiencia.

---

## 1. PROPÓSITO Y TONO DE COMUNICACIÓN
El equipo de Servicio al Cliente (CS) es el **guardián de la experiencia** de Daily Lover. La interacción con los clientes debe proyectar **calidez, alta discreción, elegancia y seguridad**. No somos un bot ni un call center convencional; somos el concierge de confianza que cuida cada detalle de la cita para que los clientes solo se preocupen por conectar.

---

## 2. EL PROTOCOLO OFICIAL DEL "TRIPLE TOUCHPOINT" (WHATSAPP)

Toda cita confirmada debe seguir estrictamente la secuencia de los 3 contactos previos y el contacto de feedback:

```
[Touchpoint 1: Confirmación] ──► [Touchpoint 2: Día Antes] ──► [Touchpoint 3: Hoy] ──► [Touchpoint 4: Feedback]
   (Al pactar restaurante)         (10:00 AM día previo)        (4h antes de la cita)       (24h después)
```

### 2.1 Touchpoint 1: Confirmación de Cita (Inmediata)
Se envía en el momento exacto en que ambas partes aceptan la fecha, hora y lugar.
> *"¡Hola [Nombre]! Para confirmarte tu date 💛. Fecha y hora: [Día] a las [Hora] en [Restaurante]. La reserva estará a nombre de María Paula Salinas. El restaurante estará atento para ayudarte a ubicarte y acompañarte con cualquier detalle logístico o de seguridad. Además, ese mismo día en la mañana te escribiremos para estar pendientes de ti y acompañarte antes, durante y después de la cita, para que solo tengas que disfrutar la experiencia.💌 Gracias por confiar en nosotras y por permitirnos ser parte de este momento💓"*

### 2.2 Touchpoint 2: Día Antes (10:00 AM)
Objetivo: Re-confirmación preventiva, anticipar imprevistos y validar que la agenda siga en pie.
> *"¡Hola [Nombre]! Para recordarte tu date de mañana 💛. Fecha y hora: [Día] a las [Hora] en [Restaurante]. Esperamos tu confirmación para asegurarnos de que la cita esté en pie y coordinar los detalles con el restaurante. ¡Un abrazo!"*

### 2.3 Touchpoint 3: El Día de la Cita ("Hoy" - 4 horas antes)
Objetivo: Calmar los nervios, reforzar el compromiso de puntualidad y ofrecer canal de seguridad.
> *"¡Hola [Nombre]! Para recordarte tu date de hoy 💛. Fecha y hora: [Día] a las [Hora] en [Restaurante]. La reserva estará a nombre de María Paula Salinas. Por favor avísanos cuando vayas en camino para estar pendiente de ti. Recuerda que hay alguien que te está esperando, ¡y la puntualidad vale X2! Disfrútalo muchísimo, es solo una cita. Avísanos cuando vayas en camino para estar pendiente de tiii!"*

### 2.4 Touchpoint 4: Feedback Post-Cita (24 horas después)
Se envía al día siguiente a las 11:00 AM.
> *"¡Hola [Nombre]! Esperamos que hayas descansado. Queremos saber cómo te sentiste en tu date de ayer con [Nombre de contraparte]. Cuéntanos: ¿cómo estuvo la química, la conversación y el trato? Tu retroalimentación sincera es clave para tu psicóloga. ¡Estamos atentas a leerte!"*

---

## 3. CURADURÍA GASTRONÓMICA & MATRIZ DE RESTAURANTES

### 3.1 Criterios de Selección del Lugar
* **Acústica y Ruido:** Quedan terminantemente prohibidos restaurantes con música en vivo estridente, DJs a alto volumen o mesas muy pegadas. La prioridad número 1 es poder conversar sin alzar la voz.
* **Iluminación:** Luz cálida, indirecta y tenue (evitar luces blancas frías de cafetería rápida).
* **Seguridad y Ubicación:** Sectores de alta seguridad con fácil acceso a parqueadero y transporte seguro (Bogotá: Usaquén, Zona G, Calle 93; Medellín: El Poblado, Laureles).
* **Reserva Corporativa:** Siempre reservar a nombre oficial de la empresa (*"María Paula Salinas"*). Esto garantiza trato VIP y protege la identidad de los comensales ante extraños.

### 3.2 Segmentación por Presupuesto en el Sheet
* **`Menos de 200k`:** Lugares relajados, cafés de autor, gastrobares casuales pero cuidados.
* **`200k - 300k`:** Bistrós gourmet, trattorias premium, cocina de autor contemporánea.
* **`Más de 300k`:** Restaurantes insignia, alta gastronomía, experiencias enológicas de mantel largo.

---

## 4. PROCEDIMIENTO TÉCNICO EN GOOGLE SHEETS (`MATCHES`)

### 4.1 La Guardia de Integridad (Evitar Promociones Prematuras)
El script de automatización (`onEditInstallable`) vigila la fila en la zona inferior de `MATCHES`.  
**Regla Absoluta:** La cita **NO** debe promoverse arriba al calendario si falta cualquiera de estos 5 datos:
1. `Estado Persona A` = "cita confirmada"
2. `Estado Persona B` = "cita confirmada"
3. `DÍA` = Fecha válida y seleccionada
4. `HORA` = Hora válida seleccionada (ej. 7:00 PM)
5. `LUGAR / RESTAURANTE` = Nombre de restaurante confirmado

### 4.2 Subida al Calendario Superior
Una vez completados los 5 campos:
* El script inserta automáticamente una fila nueva dentro del bloque del día correspondiente (ej. 12 de septiembre).
* La cita se posiciona **en orden cronológico ascendente** (ej. 7:00 PM se inserta antes de 7:30 PM).
* Se inyectan de forma automática las fórmulas de WhatsApp en las columnas L (`CONFIRMACIÓN`), M (`DÍA ANTES`) y N (`HOY`).
* Se coloca la nota de trazabilidad en la fila original inferior: `[Subido a calendario: Fila XXXX el YYYY-MM-DD HH:mm]`.

---

## 5. PROTOCOLOS DE GESTIÓN DE INCIDENTES Y FRICCIONES

### 5.1 Retrasos (>15 minutos)
1. Si un cliente avisa que va retrasado, CS debe escribir a la contraparte:  
   *"[Nombre], tu cita nos acaba de avisar que tiene un retraso por tráfico de aproximadamente 15 minutos. Te pedimos un poco de paciencia mientras llega; el equipo del restaurante ya te ubicará en la mesa para que te sientas muy cómodo/a."*
2. Ofrecer una bebida o café de cortesía coordinado con el restaurante.

### 5.2 Cancelación con Menos de 24 Horas
* **Causa de Fuerza Mayor (Enfermedad grave / Calamidad):** Se reprograma de inmediato sin penalización, pidiendo comprensión a la contraparte.
* **Cancelación Injustificada:** Se notifica a Dirección MPS. Según los términos de membresía, la cita podrá considerarse como consumida para el infractor.

### 5.3 Inasistencia sin Aviso (No-Show)
1. **Contención Inmediata:** La coordinadora debe llamar de inmediato a la persona afectada que quedó sola en el restaurante:  
   *"Lamentamos profundamente esta situación. Esto va completamente en contra de los valores de Daily Lover. Te acompañaremos en el restaurante, cubriremos tu consumo de cortesía y tu psicóloga te agendará un nuevo match prioritario sin costo."*
2. **Sanción al Infractor:** Suspensión preventiva, citación a descargos con Dirección y posible expulsión del servicio.
