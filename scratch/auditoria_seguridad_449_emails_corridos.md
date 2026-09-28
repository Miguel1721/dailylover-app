# Auditoría de Seguridad (Solo Lectura): ¿Se Usaron los 449 Emails Corridos (Tabla 2) para Enviar Comunicaciones Reales?

> [!IMPORTANT]
> **Respuesta corta y verificada:** **NO se ha enviado ningún correo real ni recibo de pago a la persona equivocada**, gracias a que **(1)** Stripe envía los recibos al correo ingresado directamente en el Checkout de Stripe (no lee `users.email` de nuestra BD), **(2)** el servidor `dl_api` tiene `SMTP_USER=""` y `SMTP_PASSWORD=""` (modo simulación/log sin despacho SMTP externo), y **(3)** el despachador de correos post-cita (`scheduled_dates`) ha operado exclusivamente en modo piloto (`simulation_mode=True` → `agente.sti.col@gmail.com`).
>
> **PERO identificamos un riesgo latente crítico que habría ocurrido al activar el envío real (`simulation_mode=False`):** en **`57` despachos de prueba** de evaluación post-cita (`scheduled_dates`), la función `resolve_person_email_and_id()` buscó por nombre en `users` y seleccionó la fila `+57300000...` con **email corrido de otra persona** (por ejemplo, para la cita de *Miguel Angel Duarte Sánchez* seleccionó el correo de *Daniel Céspedes*; para *Manuel Alejandro Beltrán* seleccionó el correo de *Tatiana Jaramillo*).

---

## 1. Verificación Canal por Canal (449 Filas con Email Corrido — `0` filas tocadas o fusionadas)

| Canal / Flujo | ¿Lee `users.email` de la BD? | ¿Se envió comunicación real a un tercero equivocado? | Evidencia Técnica en Producción (`dl_api`) |
|---|---|---|---|
| **1. Recibos de Pago de Stripe** (`checkout.session.completed` / `charge.succeeded`) | **NO** — Stripe envía el recibo al `customer_email` digitado por el comprador en la pasarela de Stripe. | **NO (`0` casos)** | De los `138` pagos cuyo correo coincide con alguno de los 449 emails, `137` fueron pagados por el **dueño real** de ese correo (`Side B`) y `1` por *Francy Yamile Tatar* usando su correo real `tatargarnica@yahoo.es` en Stripe. |
| **2. Correos de Bienvenida / Agendamiento Plan VIP 650k** (`webhooks.py` L262-299) | **NO** — Usa `c_final_email = customer_email` proveniente del payload de Stripe. | **NO (`0` casos)** | `vip_650k_payments_in_table2 = 0`. Además, `SMTP_USER` no está configurado en el contenedor (`[SMTP MOCK/LOG]`). |
| **3. Correos de Evaluación Post-Cita** (`scheduled_dates` / `matchmaking.py` L4050-4220) | **SÍ** — `resolve_person_email_and_id(db, person_name)` busca en `users` por `LOWER(TRIM(u.name))` priorizando filas con `email != ''`. | **NO en el mundo real (`0` envíos reales)**, pero **SÍ en `23` pruebas internas (`ENVIADO_TEST`)** enviadas a `agente.sti.col@gmail.com`. | El `100%` de las citas con `feedback_email_sent_at IS NOT NULL` (`544` registros) tienen `feedback_email_status = 'ENVIADO_TEST'` y `feedback_email_target = 'agente.sti.col@gmail.com'`. Sin embargo, en **`23` de esas citas**, el correo resuelto para el cliente era un **email corrido de Tabla 2 perteneciente a otra persona**. |
| **4. Correos de Evaluación en `historical_matches`** (`admin.py` L2854) | **SÍ** (`LEFT JOIN users ON ...`) | **NO (`0` casos)** | `SELECT COUNT(*) FROM historical_matches WHERE feedback_email_sent_at IS NOT NULL` = **`0`**. |
| **5. Notificaciones y Contacto por WhatsApp** (`wa.me/...`) | **NO** — Usa `users.phone`. | **NO (`0` casos)** | Las filas corridas de Tabla 2 tienen teléfonos sintéticos `+57300000...` (inválidos en WhatsApp), no teléfonos de otros clientes. |
| **6. Acceso al Portal de Clientes** (`POST /api/v1/auth/client-login` en `auth.py` L187) | **SÍ** (`WHERE lower(u.email) = :email LIMIT 1`) | **NO (`0` contraseñas activas)** | `table2_rows_with_hashed_password = 0` (ninguna de las 449 filas tiene `hashed_password`). No obstante, si el dueño real del correo (`Side B`) intentara iniciar sesión por email, el `LIMIT 1` sin `ORDER BY` podría chocar con la fila basura `Side A`. |

---

## 2. Hallazgo Crítico en `scheduled_dates`: Las `57` Citas donde el Modo Piloto Resolvió al Email Corrido de Otra Persona

Cuando el despachador de evaluación post-cita (`dispatch_automated_feedback_emails`) corrió en modo seguro (`ENVIADO_TEST` hacia `agente.sti.col@gmail.com`), la función `resolve_person_email_and_id` buscó por nombre del cliente y, al ver que la fila histórica `+57300000...` tenía un `email` no vacío (mientras que el perfil real del cliente no tenía email o tenía `id` menor), **asignó como destinatario configurado el correo de un tercero**:

| # | `scheduled_date_id` | Fecha Envío Test | Cliente en la Cita (`person_a` / `person_b`) | Fila `Side A` Leída (`UID`) | Email Corrido Configurado | Dueño Real de ese Email (`Side B`) | Estado / Destino Físico |
|---|---|---|---|---|---|---|---|
| 1 | `3431` | `2026-09-28 13:30:02` | **Isabella Luquetta** (`person_a`) | `UID=12011` | `isalu.luquetta@gmail.com` | **Diana Coral Guerrero** (`UID=5557`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 2 | `3439` | `2026-09-28 13:30:02` | **Laura Paola Oñate** (`person_a`) | `UID=6476` | `jhoanna.urrego@gmail.com` | **Johanna Urrego** (`UID=12878`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 3 | `3497` | `2026-09-27 13:30:01` | **DAVID DIAZ (DIPLOMÁTICO)** (`person_b`) | `UID=6493` | `nomarr53@gmail.com` | **Diego Vega** (`UID=12809`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 4 | `3521` | `2026-09-27 13:30:01` | **ANDREA UPEGUI (med)** (`person_a`) | `UID=6551` | `mariaquintero9810@gmail.com` | **Maria Juliana Quintero** (`UID=12836`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 5 | `3548` | `2026-09-27 13:30:01` | **Mónica Andrea Cardenas** (`person_a`) | `UID=7317` | `angelarboleda992@hotmail.com` | **Angela Arboleda** (`UID=13105`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 6 | `3551` | `2026-09-27 13:30:01` | **Juan Sebastian Riveros** (`person_a`) | `UID=6174` | `palaciososalaug@gmail.com` | **Gabriela Palacio** (`UID=12665`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 7 | `3569` | `2026-09-27 13:30:01` | **Claudia Fernanda Samboní** (`person_a`) | `UID=6185` | `emmajackelinemurzi@gmail.com` | **Jackeline Murzi** (`UID=12674`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 8 | `3575` | `2026-09-27 13:30:01` | **Adriana Cárdenas VIP** (`person_a`) | `UID=5894` | `hundrymarquina@gmail.com` | **Hundry Marquina** (`UID=13500`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 9 | `3631` | `2026-09-27 13:30:01` | **MARIANA JIMENEZ (VIP)** (`person_a`) | `UID=6576` | `kpl357ew@hotmail.com` | **Enrique Perilla Leal** (`UID=12881`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 10 | `3636` | `2026-09-27 13:30:01` | **Mariana Londoño** (`person_a`) | `UID=7438` | `diegcriollo2004@gmail.com` | **Diego Javier Criollo** (`UID=13365`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 11 | `3652` | `2026-09-26 13:30:01` | **Isabella Luquetta** (`person_b`) | `UID=12011` | `isalu.luquetta@gmail.com` | **Diana Coral Guerrero** (`UID=5557`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 12 | `3660` | `2026-09-26 13:30:01` | **Ghinna Maria Farfan** (`person_b`) | `UID=5793` | `jstiven98@hotmail.com` | **Stiven Martinez** (`UID=12452`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 13 | `3671` | `2026-09-26 13:30:01` | **Jorge Enrique Gallego** (`person_b`) | `UID=5822` | `lalamorantes18@gmail.com` | **Laura Morantes** (`UID=12425`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 14 | `3674` | `2026-09-26 13:30:01` | **Juan Pablo Mendoza** (`person_a`) | `UID=7463` | `vargaslozanovictor47@gmail.com` | **VICTOR VARGAS** (`UID=13352`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 15 | `3679` | `2026-09-26 13:30:01` | **Mariana Londoño** (`person_a`) | `UID=7438` | `diegcriollo2004@gmail.com` | **Diego Javier Criollo** (`UID=13365`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 16 | `3683` | `2026-09-26 13:30:01` | **Miguel Angel Duarte Sánchez** (`person_a`) | `UID=5407` | `cespedes.daniele2310@gmail.com` | **Daniel Cespedes** (`UID=9902`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 17 | `3691` | `2026-09-26 13:30:01` | **MANUEL ALEJANDRO BELTRAN** (`person_a`) | `UID=6662` | `tatianajaramillov@gmail.com` | **Tatiana Jaramillo** (`UID=12874`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 18 | `3705` | `2026-09-26 13:30:01` | **FRANK DURAN** (`person_a`) | `UID=6735` | `camilaruizes@gmail.com` | **Camila Ruiz** (`UID=12933`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 19 | `3731` | `2026-09-26 13:30:01` | **LAURA FEDULLO** (`person_a`) | `UID=6702` | `ser.garibello@gmail.com` | **Sergio Garibello** (`UID=10951`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 20 | `3845` | `2026-09-26 13:30:01` | **Isabella Luquetta** (`person_a`) | `UID=12011` | `isalu.luquetta@gmail.com` | **Diana Coral Guerrero** (`UID=5557`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 21 | `3853` | `2026-09-25 13:30:01` | **Laura Paola Oñate** (`person_a`) | `UID=6476` | `jhoanna.urrego@gmail.com` | **Johanna Urrego** (`UID=12878`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 22 | `3911` | `2026-09-25 13:30:01` | **DAVID DIAZ (DIPLOMÁTICO)** (`person_b`) | `UID=6493` | `nomarr53@gmail.com` | **Diego Vega** (`UID=12809`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 23 | `3935` | `2026-09-25 13:30:01` | **ANDREA UPEGUI (med)** (`person_a`) | `UID=6551` | `mariaquintero9810@gmail.com` | **Maria Juliana Quintero** (`UID=12836`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 24 | `3962` | `2026-09-25 13:30:01` | **Mónica Andrea Cardenas** (`person_a`) | `UID=7317` | `angelarboleda992@hotmail.com` | **Angela Arboleda** (`UID=13105`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 25 | `3965` | `2026-09-25 13:30:01` | **Juan Sebastian Riveros** (`person_a`) | `UID=6174` | `palaciososalaug@gmail.com` | **Gabriela Palacio** (`UID=12665`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 26 | `3983` | `2026-09-24 13:30:02` | **Claudia Fernanda Samboní** (`person_a`) | `UID=6185` | `emmajackelinemurzi@gmail.com` | **Jackeline Murzi** (`UID=12674`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 27 | `3989` | `2026-09-24 13:30:02` | **Adriana Cárdenas VIP** (`person_a`) | `UID=5894` | `hundrymarquina@gmail.com` | **Hundry Marquina** (`UID=13500`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 28 | `4045` | `2026-09-24 13:30:02` | **MARIANA JIMENEZ (VIP)** (`person_a`) | `UID=6576` | `kpl357ew@hotmail.com` | **Enrique Perilla Leal** (`UID=12881`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 29 | `4050` | `2026-09-24 13:30:02` | **Mariana Londoño** (`person_a`) | `UID=7438` | `diegcriollo2004@gmail.com` | **Diego Javier Criollo** (`UID=13365`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 30 | `4066` | `2026-09-24 13:30:02` | **Isabella Luquetta** (`person_b`) | `UID=12011` | `isalu.luquetta@gmail.com` | **Diana Coral Guerrero** (`UID=5557`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 31 | `4074` | `2026-09-24 13:30:02` | **Ghinna Maria Farfan** (`person_b`) | `UID=5793` | `jstiven98@hotmail.com` | **Stiven Martinez** (`UID=12452`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 32 | `4085` | `2026-09-24 13:30:02` | **Jorge Enrique Gallego** (`person_b`) | `UID=5822` | `lalamorantes18@gmail.com` | **Laura Morantes** (`UID=12425`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 33 | `4088` | `2026-09-24 13:30:02` | **Juan Pablo Mendoza** (`person_a`) | `UID=7463` | `vargaslozanovictor47@gmail.com` | **VICTOR VARGAS** (`UID=13352`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 34 | `4093` | `2026-09-24 13:30:02` | **Mariana Londoño** (`person_a`) | `UID=7438` | `diegcriollo2004@gmail.com` | **Diego Javier Criollo** (`UID=13365`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 35 | `4097` | `2026-09-24 13:30:02` | **Miguel Angel Duarte Sánchez** (`person_a`) | `UID=5407` | `cespedes.daniele2310@gmail.com` | **Daniel Cespedes** (`UID=9902`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 36 | `4105` | `2026-09-24 13:30:02` | **MANUEL ALEJANDRO BELTRAN** (`person_a`) | `UID=6662` | `tatianajaramillov@gmail.com` | **Tatiana Jaramillo** (`UID=12874`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 37 | `4119` | `2026-09-24 13:30:02` | **FRANK DURAN** (`person_a`) | `UID=6735` | `camilaruizes@gmail.com` | **Camila Ruiz** (`UID=12933`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 38 | `4145` | `2026-09-23 20:39:37` | **LAURA FEDULLO** (`person_a`) | `UID=6702` | `ser.garibello@gmail.com` | **Sergio Garibello** (`UID=10951`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 39 | `4256` | `2026-09-23 20:39:37` | **Isabella Luquetta** (`person_a`) | `UID=12011` | `isalu.luquetta@gmail.com` | **Diana Coral Guerrero** (`UID=5557`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 40 | `4264` | `2026-09-23 20:39:37` | **Laura Paola Oñate** (`person_a`) | `UID=6476` | `jhoanna.urrego@gmail.com` | **Johanna Urrego** (`UID=12878`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 41 | `4322` | `2026-09-23 20:39:37` | **DAVID DIAZ (DIPLOMÁTICO)** (`person_b`) | `UID=6493` | `nomarr53@gmail.com` | **Diego Vega** (`UID=12809`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 42 | `4346` | `2026-09-23 20:39:37` | **ANDREA UPEGUI (med)** (`person_a`) | `UID=6551` | `mariaquintero9810@gmail.com` | **Maria Juliana Quintero** (`UID=12836`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 43 | `4373` | `2026-09-23 20:38:21` | **Mónica Andrea Cardenas** (`person_a`) | `UID=7317` | `angelarboleda992@hotmail.com` | **Angela Arboleda** (`UID=13105`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 44 | `4376` | `2026-09-23 20:38:21` | **Juan Sebastian Riveros** (`person_a`) | `UID=6174` | `palaciososalaug@gmail.com` | **Gabriela Palacio** (`UID=12665`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 45 | `4394` | `2026-09-23 20:38:21` | **Claudia Fernanda Samboní** (`person_a`) | `UID=6185` | `emmajackelinemurzi@gmail.com` | **Jackeline Murzi** (`UID=12674`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 46 | `4400` | `2026-09-23 20:38:21` | **Adriana Cárdenas VIP** (`person_a`) | `UID=5894` | `hundrymarquina@gmail.com` | **Hundry Marquina** (`UID=13500`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 47 | `4456` | `2026-09-23 20:38:21` | **MARIANA JIMENEZ (VIP)** (`person_a`) | `UID=6576` | `kpl357ew@hotmail.com` | **Enrique Perilla Leal** (`UID=12881`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 48 | `4461` | `2026-09-23 20:38:21` | **Mariana Londoño** (`person_a`) | `UID=7438` | `diegcriollo2004@gmail.com` | **Diego Javier Criollo** (`UID=13365`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 49 | `4477` | `2026-09-23 20:38:21` | **Isabella Luquetta** (`person_b`) | `UID=12011` | `isalu.luquetta@gmail.com` | **Diana Coral Guerrero** (`UID=5557`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 50 | `4485` | `2026-09-23 20:38:21` | **Ghinna Maria Farfan** (`person_b`) | `UID=5793` | `jstiven98@hotmail.com` | **Stiven Martinez** (`UID=12452`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 51 | `4496` | `2026-09-23 20:38:21` | **Jorge Enrique Gallego** (`person_b`) | `UID=5822` | `lalamorantes18@gmail.com` | **Laura Morantes** (`UID=12425`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 52 | `4499` | `2026-09-23 20:38:21` | **Juan Pablo Mendoza** (`person_a`) | `UID=7463` | `vargaslozanovictor47@gmail.com` | **VICTOR VARGAS** (`UID=13352`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 53 | `4504` | `2026-09-23 20:38:21` | **Mariana Londoño** (`person_a`) | `UID=7438` | `diegcriollo2004@gmail.com` | **Diego Javier Criollo** (`UID=13365`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 54 | `4508` | `2026-09-23 20:38:21` | **Miguel Angel Duarte Sánchez** (`person_a`) | `UID=5407` | `cespedes.daniele2310@gmail.com` | **Daniel Cespedes** (`UID=9902`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 55 | `4516` | `2026-09-23 20:38:21` | **MANUEL ALEJANDRO BELTRAN** (`person_a`) | `UID=6662` | `tatianajaramillov@gmail.com` | **Tatiana Jaramillo** (`UID=12874`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 56 | `4530` | `2026-09-23 20:38:21` | **FRANK DURAN** (`person_a`) | `UID=6735` | `camilaruizes@gmail.com` | **Camila Ruiz** (`UID=12933`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |
| 57 | `4556` | `2026-09-23 20:38:21` | **LAURA FEDULLO** (`person_a`) | `UID=6702` | `ser.garibello@gmail.com` | **Sergio Garibello** (`UID=10951`) | `ENVIADO_TEST` → `agente.sti.col@gmail.com` |

---

## 3. Los 2 Pagos en `stripe_payments` cuya FK `user_id` Apuntó a una Fila de la Tabla 2

Revisamos los `138` pagos de Stripe que cruzan por `user_id` o `customer_email` con las 449 filas:
- **`136` pagos** tienen su FK `stripe_payments.user_id` apuntando correctamente al dueño real del correo (`Side B`).
- **Solo `2` pagos** quedaron con `stripe_payments.user_id` apuntando a `Side A`, y en **ninguno de los dos** se envió recibo a la persona equivocada:
  1. **`stripe_payment_id = 921`** (`2026-07-11`, `$38,000 COP`, *Evento HOT & SINGLE*): Pagó **Isabella Luquetta** ingresando su propio correo `isalu.luquetta@gmail.com` en Stripe Checkout, y la FK apuntó a `UID=12011` (*Isabella Luquetta*, `CRM=3680`). Estaba en Tabla 2 porque la fila antigua `UID=5557` (*Diana Coral Guerrero*, `+573000000167`) tiene pegado por error el correo de Isabella.
  2. **`stripe_payment_id = 1220`** (`2026-06-26`, `$60,000 COP`, *Plan Especial*): Pagó **Francy Yamile Tatar** ingresando su correo real `tatargarnica@yahoo.es` en Stripe Checkout (donde recibió su recibo). El webhook vinculó la FK a `UID=6291` (*Francy Yamile Tatar*, `+573000000900`) por coincidencia exacta de **nombre**, no por el email corrido `delmontevarelaveronica@gmail.com` que tenía esa fila.

---

## 4. Recomendación de Blindaje Técnico (Sin Fusionar las 449 Filas)

Para garantizar que **nunca** en el futuro (cuando se active `SMTP_USER` y `simulation_mode=False`) se pueda usar uno de esos 449 emails corridos por error:
1. **En `resolve_person_email_and_id` (`matchmaking.py` L3961) y en `webhooks.py` / `auth.py`**: priorizar siempre usuarios con perfil (`EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id)`) y excluir/ignorar el campo `email` de filas sin perfil con teléfono sintético `u.phone LIKE '+57300000%'`.
2. **Opcional (cuando tú lo autorices)**: poner `email = NULL` únicamente en las filas `+57300000...` sin perfil donde el mismo email ya pertenece a otro usuario con nombre distinto en `profiles` (sin fusionar las filas ni borrar los usuarios).
