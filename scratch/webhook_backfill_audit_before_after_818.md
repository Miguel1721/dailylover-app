# Respaldo de Auditoría Pre-Backfill: 818 Usuarios Activos (Antes → Después)

- **Fecha de generación (UTC, previo al UPDATE):** `2026-09-28T17:07:18.989802Z`
- **Total de usuarios activos que cambian (`merged_into_id IS NULL`):** `818` de `1,956` con eventos en `webhook_events_raw`
- **Regla aplicada:** 100% aditiva / no destructiva (`before: null/vacío → after: valor de webhook_events_raw`, `0` sobreescrituras de datos existentes).

## 1. Diagnóstico de los 7 `crm_id` sin coincidencia directa en `users.crm_id`

Los 7 `crm_id` corresponden a registros duplicados en SmartMatchApp cuyo teléfono **ya existe** en `users` bajo su `crm_id` principal activo (por lo que no se crean filas duplicadas en `users`):

| `crm_id` en Webhook | Teléfono | Usuario Activo Existente en BD (`user_id` / `crm_id` actual) | Acción |
|---|---|---|---|
| `3918` | `+573008569098` | `user_id=13571` (Juliana Vanegas Guerra, `crm_id=3922`) | LINK/SKIP (phone already in users) |
| `3934` | `+573157868521` | `user_id=9579` (Diego Muñoz, `crm_id=3916`) | LINK/SKIP (phone already in users) |
| `4791` | `+573197843310` | `user_id=15995` (Nathaliacmrgo (@Nathaliacmrgo), `crm_id=4790`) | LINK/SKIP (phone already in users) |
| `4793` | `+573114918219` | `user_id=8757` (Manuela Fajardo, `crm_id=4794`) | LINK/SKIP (phone already in users) |
| `4810` | `+573153254278` | `user_id=16113` (Juan Posada 98 (@juan_posada_98), `crm_id=4811`) | LINK/SKIP (phone already in users) |
| `4840` | `+573168216867` | `user_id=15924` (Alejacarvajalino (@Alejacarvajalino), `crm_id=4841`) | LINK/SKIP (phone already in users) |
| `4843` | `+573046318638` | `user_id=15666` (Sofiaduranbejarano (@sofiaduranbejarano), `crm_id=4846`) | LINK/SKIP (phone already in users) |

---

## 2. Listado Completo de los 818 Usuarios (`Antes → Después`)

| # | `user_id` | `crm_id` | Nombre | Campos Modificados (`Antes → Después`) |
|---|---|---|---|---|
| 1 | `5305` | `3972` | Ana Sofia Vargas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Trabajo mucho, me estreso fácil, no me gusta esperar, soy sensible"]` |
| 2 | `5706` | `762` | Andrea Escorcia | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Alto/a", "Barba", "Piel clara", "Bien vestido/a"]` |
| 3 | `5993` | `4037` | Gabriel Hernandez | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No personas tacañas, no personas resentidas, no personas mentirosas"]` |
| 4 | `7965` | `4809` | Juan Pedraza | **`profiles.love_language`**: `null` → `"Tiempo de calidad"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"No"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Principiante"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`lifestyle.politics`**: `null` → `"Center"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Honestidad", "Aventura"]`<br>**`lifestyle.housing_status`**: `null` → `"Familia"`<br>**`lifestyle.financial_vibe`**: `null` → `"Introvertido"`<br>**`lifestyle.free_time`**: `null` → `"Arte, museos y teatro; Cine, películas y series; Ver deportes"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.non_negotiables`**: `null` → `["Falta de respeto", "Vida de fiesta extrema", "Mentir"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Deportista", "Piel clara"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Estilo, Natural"`<br>**`search_preferences.min_age`**: `null` → `24`<br>**`search_preferences.max_age`**: `null` → `31` |
| 5 | `7974` | `508` | David Esteban Beltran Gacharna | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 6 | `7991` | `4838` | Salomé García Benitez | **`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`search_preferences.preferred_looks`**: `null` → `["Alto/a", "Pelo oscuro", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd, Soft girl/boy, Natural, Atlético, Minimalista"` |
| 7 | `8114` | `4119` | David Vanegas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 8 | `8182` | `1123` | Santiago Quintana Echavarria | **`profiles.neighborhood`**: `null` → `"80A-20  Tv 100A"` |
| 9 | `8322` | `1719` | Santiago Castaño | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 10 | `8345` | `1764` | Juan Felipe Toro Salgado | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 11 | `8451` | `2158` | Emilia Peralta Villegas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 12 | `8466` | `2209` | Mateo Cortes Betancur | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 13 | `8569` | `2549` | Luisa Maria Lozano Lopez | **`lifestyle.body_type`**: `null` → `"Average"`<br>**`lifestyle.drinks_alcohol`**: `null` → `"Socially"`<br>**`lifestyle.has_pets`**: `null` → `"Yes"`<br>**`lifestyle.fitness_preferences`**: `null` → `"Running"`<br>**`lifestyle.rumba`**: `null` → `"Occasional"` |
| 14 | `8604` | `4114` | María José Baldovino | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 15 | `8631` | `3960` | Maria Jose Rodriguez Novoa | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Sobreanalizar, sensibilidad a la inconsistencia, exigencia"]` |
| 16 | `8745` | `4333` | Camila Gongora | **`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd, Alternativo, Atlético, Corporate"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentiras, lealtad, tacaño, fiestero, sin ganas de vivir, sin propósito"]` |
| 17 | `8757` | `4794` | Manuela Fajardo | **`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`search_preferences.preferred_looks`**: `null` → `["Alto/a", "Deportista", "Barba", "Piel clara", "Buenas manos", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Estilo, Natural, Artístico, Atlético, Corporate, Minimalista"`<br>**`search_preferences.preferred_height`**: `null` → `"174 a 189 cm"`<br>**`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `33` |
| 18 | `8777` | `3956` | Juan Torrijos | **`search_preferences.partner_red_flags`**: `null` → `["Que solo piense en dinero, que solo piense en si misma, que sea alguien superficial"]` |
| 19 | `8788` | `3139` | Andrea Karina Jimenez Bustos | **`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"`<br>**`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `34` |
| 20 | `8799` | `3167` | Maria Luisa Lindo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 21 | `8816` | `3247` | Carlos Raigoso | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 22 | `8848` | `3321` | Daniela Barrera Cubides | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 23 | `8849` | `3322` | Andrea Paola Torrado Lopez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Athletic, Corporate"` |
| 24 | `8862` | `3363` | Sara Valentina Valencia Jiménez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 25 | `8869` | `3376` | Jose Alfredo Sedano | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 26 | `8872` | `3387` | Emmanuel Garcia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 27 | `8882` | `3401` | Cristian Pascumal | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"150 a 165 cm"` |
| 28 | `8909` | `3439` | Anyela Katerine Ballesteros Barrantes | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 29 | `8932` | `3481` | Carolina Álvarez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 30 | `8936` | `3492` | Milagro Munive Juvinao | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 31 | `8938` | `3503` | Diana Camila Beltran Bonilla | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 32 | `8939` | `3504` | Francisco Ruiz | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 33 | `8941` | `3518` | Ruben Duque | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 34 | `8942` | `3520` | Natalia Ines Rubio Valencia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 35 | `8943` | `3529` | Isabela Guzman | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 36 | `8944` | `3531` | Laura Natalia Cruz Gonzalez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 37 | `8945` | `3532` | Laura Katherine Rivera Suárez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 38 | `8946` | `3539` | JOSTHIN ANDRES BARON ORADA | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 39 | `8947` | `3541` | Isabella Lopez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 40 | `8948` | `3542` | Jose Javier Chacón Rojo | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 41 | `8949` | `3544` | Santiago Acuña Reyes | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 42 | `8950` | `3545` | Danny Atiencia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 43 | `8951` | `3554` | Maria Fernanda Diaz Velasquez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 44 | `8952` | `3555` | Viviana Ortiz | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 45 | `8953` | `3559` | Ricardo Cuervo Arevalo | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 46 | `8954` | `3560` | Juan David Bolívar Vargas | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 47 | `8955` | `3563` | Lina Maria Prieto Abad | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 48 | `8958` | `3568` | Juan Felipe Carreño | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 49 | `8959` | `3569` | María Paula Triana Rincon | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 50 | `8961` | `3572` | Sonia Pinzon | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 51 | `8962` | `3574` | Kelly Gonzalez Payares | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 52 | `8963` | `3575` | HOLLMAN RENE MONROY ZAPATA | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 53 | `8964` | `3576` | Johana Alejandra Guarnizo Villanueva | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 54 | `8965` | `3578` | Daniel Lizarazo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 55 | `8966` | `3579` | Jenny Paola Buitrago Bonilla | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 56 | `8967` | `3581` | Elizabeth Mosquera Ortiz | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 57 | `8968` | `3582` | Rene Alejandro Muñeton | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 58 | `8970` | `3584` | Johanna Maricela Lopez Velandia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 59 | `8971` | `3585` | Maria Angelica Velasquez Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 60 | `8972` | `3586` | Joel Finkelstein | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 61 | `8973` | `3587` | Liliana Gomez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 62 | `8974` | `3588` | Cristobal Perez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 63 | `8976` | `3590` | Pedro Atehortua | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 64 | `8977` | `3591` | Andres Leonardo Delgadillo Niño | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 65 | `8978` | `3592` | Juan Carlos Neira | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 66 | `8979` | `3593` | Gabriel Collazos | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 67 | `8980` | `3598` | Karol Morales | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 68 | `8982` | `3601` | Carlos Javier Urbano | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 69 | `8983` | `3603` | Diana Hernandez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 70 | `8984` | `3607` | Pablo Dueñas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 71 | `8985` | `3608` | Melissa Delgado | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 72 | `8986` | `3609` | Maritza Zabala Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 73 | `8987` | `3610` | Brigitte Zambrano | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 74 | `8988` | `3613` | Daymar Becerra | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 75 | `8989` | `3614` | Paula De Gamboa | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 76 | `8991` | `3617` | David Eduardo Fajardo Ariza | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 77 | `8993` | `3619` | Michael Luna | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 78 | `8994` | `3611` | Alejandro Bustos | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 79 | `8995` | `3621` | Valentina Aroca Figueroa | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 80 | `8996` | `3622` | Juan Jose Pinzon Ortiz | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 81 | `8997` | `3624` | Daniella Cala | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 82 | `8999` | `3626` | Isabella Lucia Castilla Ibarra | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 83 | `9000` | `3627` | Maria Jose Arias Arango | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 84 | `9001` | `3628` | Daniela Ortegon Jimenez | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 85 | `9002` | `3629` | Daniela Olmos Becerra | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 86 | `9003` | `3630` | Iris Milena Rincon Bustamante | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 87 | `9005` | `3632` | Estefania Diaz | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 88 | `9006` | `3634` | Diego Fernando Sanchez Montana | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 89 | `9007` | `3635` | Brian Hernan Molina Bolivar | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 90 | `9008` | `3637` | Fabian Cardenas Utreras | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 91 | `9009` | `3639` | Ingrid Stephanie Leon | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 92 | `9010` | `3641` | Juan Camilo Ovalle Quintero | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 93 | `9011` | `3642` | Ximena Andrea Alfonso | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 94 | `9012` | `3643` | Felipe Pinzon Gomez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 95 | `9013` | `3644` | Isabella Monsalve Garcia | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 96 | `9014` | `3647` | Claudia ines García alvarez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 97 | `9015` | `3648` | Alejandra Sardoth | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 98 | `9016` | `3650` | Camilo Valencia Espinal | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 99 | `9017` | `3927` | JOSE EDUARDO HERNANDEZ BUSTAMANTE | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["PUEDO LLEGAR A SER MUY DISTRAIDO, NO CAPTO INDIRECTAS AVECES"]` |
| 100 | `9018` | `3652` | Nicolas Rivera Martinez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 101 | `9019` | `3657` | Oscar Vergez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 102 | `9020` | `3659` | Mariana McEwen | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 103 | `9021` | `3660` | Jean Lopez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 104 | `9035` | `3977` | Estefany Lopez Avellaneda | **`search_preferences.partner_red_flags`**: `null` → `["Mi tiempo con mi familia y amigos."]` |
| 105 | `9116` | `3770` | Fabio Rincón | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 106 | `9117` | `3771` | David Felipe Velandia Parra | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 107 | `9118` | `3772` | Adriana Sanchez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 108 | `9119` | `3773` | Juan Manuel Viveros | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 109 | `9120` | `3774` | Miguel Campins | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 110 | `9121` | `3775` | Juanita Zuluaga | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 111 | `9122` | `3776` | JORGE EDUARDO ALDANA CASTAÑO | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 112 | `9123` | `3778` | Sebastian Castro | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 113 | `9124` | `3779` | Mario Fernando Castrillon | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 114 | `9125` | `3780` | Camilo Saavedra Gonzalez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 115 | `9126` | `3781` | Juan Pablo Cardona | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 116 | `9127` | `3782` | Anais Osorio | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 117 | `9128` | `3783` | Heidy Carolina Torres Hernández | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 118 | `9129` | `3784` | Diego Mauricio Ramirez Buitrago | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 119 | `9130` | `3785` | Johana Patricia Castañeda bautista | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 120 | `9131` | `3786` | Sandra Reyes | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 121 | `9132` | `3787` | Johann Galeano | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 122 | `9134` | `3789` | Alejandro Rico | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 123 | `9135` | `3790` | Ricardo Andres Mejia | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 124 | `9136` | `3791` | Christian Uribe | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 125 | `9137` | `3792` | Victor Espinosa | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 126 | `9138` | `3793` | Prince Alejandra Pardo Díaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 127 | `9139` | `3794` | LUIS FERNANDO MELO | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 128 | `9140` | `3795` | Cristina Arbelaez | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 129 | `9141` | `3796` | Diego Vieira | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 130 | `9142` | `3797` | Gabriel Orozco | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 131 | `9143` | `3798` | Natalia Gutierrez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 132 | `9144` | `3799` | Sandra Gómez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 133 | `9145` | `3800` | Dylan Escobar | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 134 | `9146` | `3801` | Jessica Cabrera | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 135 | `9147` | `3802` | Jose Polo herrera | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 136 | `9149` | `3804` | David Ramirez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 137 | `9150` | `3805` | Daniela Castaño Muñoz | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 138 | `9151` | `3806` | Nicolas Moreno Gonzalez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 139 | `9152` | `3807` | Federico Arango | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 140 | `9153` | `3808` | Dario Pineda | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 141 | `9154` | `3809` | Juan Camilo Gutierrez Alfonso | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 142 | `9155` | `3810` | Maria Fernanda Bohorquez Arias | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 143 | `9156` | `3811` | Angela Molina | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 144 | `9157` | `3812` | Marcela Patiño Rojas | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 145 | `9158` | `3813` | Marcela Villa | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 146 | `9159` | `3814` | Domingo Fontiveros | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 147 | `9160` | `3815` | Santiago Lopez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 148 | `9162` | `3817` | Santiago Franco Cuevas | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 149 | `9163` | `3818` | Martin Luna | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 150 | `9164` | `3819` | Caterin Perez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 151 | `9165` | `3820` | Alejandro Navarro | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 152 | `9166` | `3821` | Arlinsson Ortega chavarro | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 153 | `9167` | `3822` | MarIa Magnolia Jurado Gutiérrez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 154 | `9168` | `3823` | Jhony Cruz | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 155 | `9169` | `3824` | Herich Arboleda | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 156 | `9170` | `3825` | Nicolas Diaz Pinilla | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 157 | `9171` | `3826` | Ana Maria Ruiz Naranjo | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 158 | `9172` | `3827` | Orlando Novoa | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 159 | `9173` | `3828` | Giovanny Cobos Zambrano | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 160 | `9174` | `3829` | Santiago Laino Florez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 161 | `9175` | `3830` | Denisse Padilla | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 162 | `9176` | `3831` | Alfonso Palacio | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 163 | `9177` | `3832` | Diego Segura | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 164 | `9178` | `3833` | Stephanie Tavera | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 165 | `9179` | `3834` | Jhonatan Londono | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 166 | `9180` | `3835` | Daniela Laharenas | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 167 | `9181` | `3836` | Daniel Cuervo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 168 | `9182` | `3837` | Álvaro Uzcategui | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 169 | `9183` | `3839` | Luis Sanchez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 170 | `9184` | `3840` | Esteban Garcia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 171 | `9185` | `3841` | Juan Pablo Perdomo Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 172 | `9186` | `3842` | Sebastian Pineda | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 173 | `9187` | `3843` | giancarlo gutierrez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 174 | `9188` | `3844` | dayanna pantano | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.red_flags`**: `[]` → `["Disrespect", "Poor communication", "Extreme party lifestyle", "Lying"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Beard", "Nice teeth"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Stylish, Natural, Artistic, Minimalist"` |
| 175 | `9189` | `3845` | Daniel Bonil | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 176 | `9190` | `3846` | Daniela Garcia Chiappe | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 177 | `9191` | `3847` | Lizeth Benitez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 178 | `9192` | `3848` | Santiago Aguilar | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 179 | `9193` | `3849` | Diego Rubiano | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 180 | `9194` | `3850` | Cesar Andres Mejia Contento | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 181 | `9195` | `3851` | Luisa Robayo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 182 | `9196` | `3852` | Alejandro Rojas | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 183 | `9197` | `3853` | Fabio Alexander Torres Barrera | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 184 | `9198` | `3854` | Daniela Corrales | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 185 | `9199` | `3855` | Diego Jose Poveda Muñoz | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 186 | `9200` | `3856` | Carolina Rojas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 187 | `9201` | `3857` | Gina Tamara Giraldo Berrio | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 188 | `9202` | `3858` | ALEJANDRA NORATO | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 189 | `9203` | `3859` | diego ramirez | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 190 | `9204` | `3860` | Abi Abhishek Tamboli | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 191 | `9205` | `3861` | Cristian Lima | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 192 | `9206` | `3862` | Alexandra Moreno Contreras | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 193 | `9208` | `3864` | Laura Carolina Castro Blanco | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 194 | `9209` | `3865` | Daniel Samper | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 195 | `9210` | `3866` | Nicolas Bernal Puentes | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 196 | `9211` | `3867` | Daniela Miranda | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 197 | `9212` | `3868` | Frantz Colimon | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 198 | `9214` | `3870` | MARIA CLAUDIA SAENZ RESTREPO | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 199 | `9216` | `3872` | Juan Calero | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 200 | `9217` | `3873` | Jorge Perez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 201 | `9218` | `3874` | Stephen Berniker | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 202 | `9219` | `3875` | CARLOS LOPEZ | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 203 | `9220` | `3876` | Alejandro Arango | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 204 | `9221` | `3877` | Judith Mejia Arango | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 205 | `9222` | `3878` | Francisco Julio Orjuela Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentiras, infidelidad, deslealtad, que ya tenga hijos, que sea más alta que yo, que no sea católica, que fume o tenga algún vicio, que sea muy bajita por debajo del promedio."]` |
| 206 | `9223` | `3879` | Adriana Vivas | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 207 | `9224` | `3881` | Laura Vanessa Yañez Alvarez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 208 | `9225` | `3882` | Natalia Torres | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 209 | `9226` | `3883` | Juan Pablo Angel Mojica | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 210 | `9227` | `3884` | Daniela Fuentes Lopez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 211 | `9228` | `3885` | Marcela Chiaradia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 212 | `9229` | `3886` | Maria Camila Ruiz Torres | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 213 | `9230` | `3887` | valentina Gomez Zambrano | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 214 | `9231` | `3888` | Sergio Erazo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 215 | `9232` | `3889` | Leonardo Antonio Castañeda Celis | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 216 | `9233` | `3890` | Daniela Gomez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 217 | `9234` | `3891` | Leidy Alarcon | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 218 | `9427` | `1096` | Andres Martinez Montenegro | **`lifestyle.pet_type`**: `null` → `"Gatos, Perros, Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 219 | `9485` | `4820` | Gabriela Vasquez Ramirez | **`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.financial_vibe`**: `null` → `"Sociable"`<br>**`lifestyle.free_time`**: `null` → `"Cine, películas y series; Leer; Pintar, dibujar, manualidades; Deportes y vida fit"`<br>**`search_preferences.red_flags`**: `[]` → `["Falta de respeto", "Mala comunicación", "No tener ambición", "No saber socializar o ser grosero", "Mentir", "Falta de iniciativa", "Ser conflictivo o dramático", "Cero energía o apatía total", "No gustarle los animales", "Inestabilidad emocional fuerte"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Alto/a", "Deportista", "Piel clara", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd, Atlético"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Para mí es importante la iniciativa y el tiempo de calidad, a pesar que soy una chica ocupada siempre le sacaré tiempo"` |
| 220 | `9559` | `3385` | David Esteban García Agudelo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 221 | `9567` | `3897` | Andres Felipe Gómez Marín | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 222 | `9568` | `3898` | Natalia Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 223 | `9569` | `3902` | Alexander Umbarila Castillo | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 224 | `9570` | `3905` | Rosmary Soto | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 225 | `9571` | `3906` | María Fernanda Salas | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Un poco desordenada pero nada grave, me enamoro rápido"]` |
| 226 | `9572` | `3907` | Gabriel Rojas | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 227 | `9575` | `3912` | Marcela Guacheta | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"` |
| 228 | `9576` | `3913` | Wildens Garcia ardila | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 229 | `9577` | `3914` | Andres Rey Torres | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no sea buena persona"]` |
| 230 | `9578` | `3915` | Laura Cristancho | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Confundo esfuerzo con compatibilidad, insistir aún cuando ya fui clara"]` |
| 231 | `9579` | `3916` | Diego Muñoz | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Terco"]` |
| 232 | `9580` | `3917` | Paola Bojaca | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No tan delgado"]` |
| 233 | `9581` | `3919` | Joanna Cardoso Zapata | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no respete mi tiempo, que me quiera controlar, que no tenga carro 🫣"]` |
| 234 | `9582` | `3921` | Charlie Reyes Lodbrok | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No sea insegura: revise celular, no permita salidas y compartir con amigos"]` |
| 235 | `9583` | `3923` | Luisa Gomez | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["tacaño, pereza, gashligting, falta de empatía, agresividad"]` |
| 236 | `9584` | `3924` | Ayquel Vasconez | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 237 | `9585` | `3925` | Alejandra Sabogal | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Vulgar, deshonesto"]` |
| 238 | `9586` | `3926` | Vanessa Hernández Maldonado | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Me cuesta mucho abrirme al amor, tiendo a desconfiar"]` |
| 239 | `9587` | `3928` | Jenny Lizeth Martinez Castro | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mis red flags podrían ser impaciente y ser muy directa"]` |
| 240 | `9588` | `3929` | Laura Velasquez Arevalo | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 241 | `9589` | `3930` | David Villanueva | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 242 | `9591` | `3932` | Carlos Romero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Creo que ya las mencioné, pero agregaría el mal aliento o que no se vista bien"]` |
| 243 | `9592` | `3933` | Angie Diaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Independencia excesiva"]` |
| 244 | `9593` | `3935` | Mathias Gomez Suarez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Sobrepensar mucho"]` |
| 245 | `9595` | `3937` | Rosana Serrano | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Baja estatura, descuidado con su apariencia"]` |
| 246 | `9596` | `3938` | Sendy Sanchez | **`lifestyle.pet_type`**: `null` → `"Cats, Dogs"`<br>**`lifestyle.temperament`**: `null` → `"Balanced"`<br>**`search_preferences.preferred_looks`**: `null` → `["Athletic", "Beard", "Tattoos", "Nice teeth"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Stylish, Natural, Athletic, Corporate"`<br>**`search_preferences.personal_red_flags`**: `null` → `["Avoidance", "Inconsistent messaging", "Prolonged silence or isolation", "Constant need for attention", "Sudden mood swings"]` |
| 247 | `9597` | `3940` | Nelson Mauricio Cervantes Contreras | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que sea tóxica, que no quiera darme mi espacio, que no sea amable, que no sea familiar."]` |
| 248 | `9598` | `3941` | John Edisson Rojas Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Exclusividad"]` |
| 249 | `9599` | `3943` | Juan David Ordonez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Sin hijos"]` |
| 250 | `9600` | `3944` | Diego Alvarez | **`lifestyle.pet_type`**: `null` → `"Gatos"` |
| 251 | `9601` | `3945` | Manuel Avila | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Red flag que no me atrae, falta de interés y que no pregunte sobre mi"]` |
| 252 | `9602` | `3946` | Katerine Ramirez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["La falta de comunicación, alguien que sea evitativo, que no tenga responsabilidad afectiva,falta de iniciativa, que sólo hablen de ellos"]` |
| 253 | `9603` | `3947` | Sebastián Benítez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Perfeccionista, no me gusta pedir ayuda, me gusta tomarme mi tiempo para procesar cosas antes de hablarlas"]` |
| 254 | `9604` | `3942` | Stefanny Gomez Rodriguez | **`search_preferences.partner_red_flags`**: `null` → `["No permito el ingreso de personas a mi vida fácilmente, a la primera red flag que no se pueda controlar en la otra persona, me voy. Soy exigente"]` |
| 255 | `9605` | `3949` | Ginna Margareth Niño Suárez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Buscar sólo sexo sin compromiso."]` |
| 256 | `9606` | `3950` | James Piccirillo | **`lifestyle.ideal_weekend`**: `null` → `"Alta energía"`<br>**`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Soft girl/boy, Estilo, Natural, Atlético"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Tiene hijos"]` |
| 257 | `9607` | `3952` | Valeria Perez sarabia | **`lifestyle.pet_type`**: `null` → `"Cats"`<br>**`search_preferences.preferred_looks`**: `null` → `["Tall", "Athletic", "Beard", "Dark hair", "Nice teeth"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Soft girl/boy, Natural, Athletic"` |
| 258 | `9608` | `3953` | María Luisa Romero Martínez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que le interese el crecimiento personal y profesional y esté alineado conmigo"]` |
| 259 | `9609` | `3954` | Sergio Iván Morales Padilla | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Me encanta pasarla bien. En todo"]` |
| 260 | `9610` | `3955` | Karen Tobar | **`lifestyle.ideal_weekend`**: `null` → `"Calm"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentiras, celos"]` |
| 261 | `9611` | `3957` | Andrés Mauricio Osorio Arizabaleta | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 262 | `9612` | `3958` | Juan Pablo Rubiano | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Alto/a", "Deportista", "Tatuajes", "Piel clara", "Pelo oscuro", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd"`<br>**`search_preferences.personal_red_flags`**: `null` → `["Overthinking", "Evitación", "Celos", "Mensajes inconsistentes", "Silencio prolongado o aislamiento", "Necesidad constante de atención"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["Trabajo micho"]` |
| 263 | `9613` | `3959` | Amr Elewa | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 264 | `9614` | `3961` | Jaime Andres Alvarez Ospina | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Superficialidad, descuido personal, poca escucha y empatia"]` |
| 265 | `9615` | `3962` | Karen Mendez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Bebedor en exceso, no caballero, creencias limitantes, tacañez"]` |
| 266 | `9616` | `3963` | Marcelo Ponce Bravo | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.red_flags`**: `[]` → `["Disrespect", "Poor communication", "Extreme party lifestyle", "Lying"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["Exclusividad en la relación. Tiempo de calidad."]` |
| 267 | `9617` | `3964` | Sara Ochoa Soto | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Un hombre que solo hable de él y no sepa escuchar, un hombre que no sea familiar, un hombre antisocial"]` |
| 268 | `9618` | `3965` | Andrea DIAZ | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Alguien que viva con sus papás, que no trabaje"]` |
| 269 | `9619` | `3966` | Mireya Rodríguez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No irrespetuoso"]` |
| 270 | `9620` | `3967` | Carolina Peña castaño | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que tenga adicciones"]` |
| 271 | `9621` | `3968` | Maria del Rosario Arias | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 272 | `9622` | `3969` | Catalina Bejarano Rojas | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que sea un tibio, que no pueda definirse"]` |
| 273 | `9623` | `3970` | Andres Forigua | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que porque sea temperamental trate mal a las personas"]` |
| 274 | `9624` | `3971` | María Alejandra Ramírez Pérez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mala comunicación, grosero, poco atento y respetuoso. Que se crea más que todos, inmaduro, que no tenga empatía y esté cegado por su propio mundo. Que sea agresivo, celoso e inseguro"]` |
| 275 | `9625` | `4004` | Ana Sofía Vargas Lozano | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de empatía, falta de solidaridad, masculinidad frágil, no cree en la terapia"]` |
| 276 | `9626` | `3973` | Laura Medina | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Sobre pensar, miedo a decepcionar, exigirme demasiado, buscar control en momentos de incertidumbre,"]` |
| 277 | `9627` | `3974` | Michael Barrera | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No tenga la intención de salir adelante. No quiera construir un proyecto de vida. No le guste salir y descubrir nuevas cosas. No sea honesta."]` |
| 278 | `9628` | `3975` | Marcela Buitrago | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que minimice mis metas profesionales o que espere que yo reduzca mi creciminto para acomodarme a su vida. Incosistencia entre palabras y acciones, celos/control excesivo, poca ambición o disciplina, incapacidad para comunicar lo que siente y falta de interés genuino por construir una relación."]` |
| 279 | `9629` | `3976` | Oscar David Amador Rios | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 280 | `9630` | `3978` | CARLOS GALLI | **`lifestyle.temperament`**: `null` → `"Balanced"`<br>**`search_preferences.preferred_looks`**: `null` → `["Athletic", "Nice teeth", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Natural, Athletic"`<br>**`search_preferences.personal_red_flags`**: `null` → `["Overthinking", "Difficulty expressing emotions", "Social isolation"]` |
| 281 | `9631` | `3980` | Alejandro Parra | **`lifestyle.ideal_weekend`**: `null` → `"Calm"`<br>**`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.red_flags`**: `[]` → `["Poor communication", "Lying"]` |
| 282 | `9632` | `3981` | Paula Camila Olivares | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No acepto bi, gais enclosetados, que no le guste las mascotas, tacaños"]` |
| 283 | `9633` | `3982` | Daniel Angarita | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 284 | `9634` | `3983` | Maria Gnecco | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 285 | `9635` | `3984` | Felipe Gaviria | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 286 | `9636` | `3985` | Daniel Santiago Martinez Santoya | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Las mentiras, no saberse comunicar y que no quiera construir una familia."]` |
| 287 | `9637` | `3986` | Danny Cuervo | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mala comunicación y no ser contable"]` |
| 288 | `9638` | `3987` | Andres Felipe Tamayo Celis | **`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd, Alternativo, Atlético, Minimalista"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentiras o falta de transparencia, infidelidad o cualquier comportamiento que rompa la confianza. No me gusta sentirme controlado o limitado; creo que, cuando existe confianza mutua, cada uno debe poder mantener su propio espacio, intereses y vida personal. No aceptaría manipulación emocional ni formas poco sanas de manejar los conflictos. También sería difícil para mí una relación con alguien financieramente irresponsable, con una necesidad excesiva de aparentar o buscar validación externa, o que no respete los límites de la relación con otras personas."]` |
| 289 | `9639` | `3988` | Adriana del Pilar Cortes Ferro | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["egocentrismo , groserias , violencia"]` |
| 290 | `9640` | `3989` | John Ortiz | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de comunicación, salir de rumba sin la pareja, desaparecerse por dias"]` |
| 291 | `9641` | `3990` | Fernanda Arango Ramírez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 292 | `9642` | `3991` | Carolina Gomez Forero | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Actividad física, hombre 50/50, izquierda, escolaridad"]` |
| 293 | `9643` | `3992` | Daniel Santiago Valdes Mendez | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Personas de closet"]` |
| 294 | `9644` | `3993` | Julian Alvarez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Lealtad, respeto, emotional maturity, independencia, reciprocidad, comunicacion"]` |
| 295 | `9645` | `3994` | Juan Martin Robles Vega | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Soy muy crítico de mi por mi desarrollo personal así que quiero que la otra persona alcance su máximo potencial, siento que soy quien lidera a la otra persona para conseguir una mejor vida o ser una mejor persona"]` |
| 296 | `9646` | `3995` | Gloria Varela | **`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Persona irritable, mujeriego"]` |
| 297 | `9647` | `3996` | Camilo Lopez Florian | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto mutuo, honestidad, lealtad y comunicación"]` |
| 298 | `9648` | `3997` | Juan Mesa | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 299 | `9650` | `4000` | David Peña | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 300 | `9652` | `4002` | Carlos Yovanny Perez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mujeres que quieran tener hijos"]` |
| 301 | `9653` | `4003` | Silvia Jaimes | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Independencia extrema"]` |
| 302 | `9654` | `4005` | Laura De la Rosa | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Trabajo, cercano a la familia"]` |
| 303 | `9655` | `4006` | Kevin Santanilla | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 304 | `9656` | `4007` | María Camila Jimenez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No poliamor ni relaciones abiertas"]` |
| 305 | `9657` | `4008` | Sara Arboleda Brand | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Comunicación (evitar ley del hielo, ghosting), respetar los espacios de cada uno, las demostraciones de afecto (aftercare), coherencia entre las palabras y las acciones."]` |
| 306 | `9658` | `4009` | Diana Morales Rozo | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Machista, violento, grosero, agresivo"]` |
| 307 | `9659` | `4010` | Alma Burgos | **`lifestyle.temperament`**: `null` → `"Calm"`<br>**`search_preferences.preferred_looks`**: `null` → `["Tall", "Athletic", "Beard", "Dark hair", "Nice hands", "Nice teeth", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerdy, Stylish, Natural, Athletic, Corporate"`<br>**`search_preferences.personal_red_flags`**: `null` → `["Overthinking", "Inconsistent messaging", "Difficulty expressing emotions"]` |
| 308 | `9660` | `4011` | Javier Felipe Cifuentes Sabogal | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Espero que quiera familia, sea o no creyente que quiera matrimonio"]` |
| 309 | `9661` | `4013` | Luis Giraldo | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["La mentiras"]` |
| 310 | `9662` | `4014` | Gina Baquero | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Busco una relación basada en respeto, fidelidad, comunicación honesta y estabilidad emocional y económica. No negocio la infidelidad, la violencia en ninguna forma, el consumo de drogas, el machismo ni la falta de responsabilidad afectiva. Quiero alguien con objetivos claros y que trabaje por ellos."]` |
| 311 | `9663` | `4015` | Arianny Arteaga | **`lifestyle.pet_type`**: `null` → `"Cats, Dogs"`<br>**`search_preferences.preferred_looks`**: `null` → `["Tall", "Athletic", "Beard", "Tattoos", "Fair skin", "Nice teeth", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerdy, Stylish, Athletic"` |
| 312 | `9665` | `4017` | Mariana Zapata Henao | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de respeto, no educación, no familiar"]` |
| 313 | `9666` | `4018` | Juan Perez | **`lifestyle.temperament`**: `null` → `"Calm"` |
| 314 | `9667` | `4019` | Juan Diego Villa Mesa | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que sea perezoso, que sea sucio, que sea tacaño, que sea insensible, que sea maleducado"]` |
| 315 | `9668` | `4020` | Stephany Esther Valdez Delgado | **`search_preferences.preferred_looks`**: `null` → `["Tall", "Athletic", "Nice hands", "Nice teeth", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Athletic"` |
| 316 | `9669` | `4021` | Stephany Flores | **`search_preferences.preferred_looks`**: `null` → `["Tall", "Athletic", "Nice teeth", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Stylish, Natural, Athletic"` |
| 317 | `9670` | `4022` | Valentina Cabrera Peña | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Estoy haciendo una especialización y esa es mi prioridad"]` |
| 318 | `9671` | `4023` | Alejandro Luciano Rodriguez Acosta | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto, Honestidad Fidelidad"]` |
| 319 | `9672` | `4024` | Isabella Buritica | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Trato bonito y 0 faltas de respeto. Que no sea consumidor activo de sustancias ilícitas."]` |
| 320 | `9673` | `4025` | Alejandra Pastor | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Hablar mal de la exnovia / love bombing y luego ghosting / Gas lighting / incoherencias en el discurso / Musulmán"]` |
| 321 | `9674` | `4027` | Sara Lorena Villa Palacios | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no respete mi fé o se burle de ella, que no tenga ninguna apertura hacia la espiritualidad/religion, que sea irrespetuoso con la gente de servicio, que no busque hacer actos de caridad o servicio,"]` |
| 322 | `9675` | `4030` | Juliana Rodriguez Zea | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Calm"`<br>**`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que trate mal a los demás, que pase encima de los demás, que sea irrespetuoso, que no tenga objetivos claros, que no sea propositivo, que no esté dispuesto a dilogar, que pueda apoyarme en mis sueños como yo en los de él"]` |
| 323 | `9676` | `4029` | Alejandro Salazar | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.ideal_weekend`**: `null` → `"High energy"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.personal_red_flags`**: `null` → `["Prolonged silence or isolation"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["Humillativo"]` |
| 324 | `9677` | `4031` | Ricardo Baron | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Tenga estudios. No tenga hijos. Las mentiras. Faltas de respeto. No más alta que yo. Tenga valores de familia. Tenga actividad física activa. Que no sea posesiva. No vegana. Las"]` |
| 325 | `9678` | `4032` | Wendy Licceth Pasos Berdugo | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto absoluto, inteligencia emocional, ambición y propósito, estabilidad económica."]` |
| 326 | `9679` | `4033` | Ivana Mogollon | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No ser comunicativo"]` |
| 327 | `9680` | `4034` | Karen Lorena Leon Perez | **`lifestyle.pet_type`**: `null` → `"Gatos"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Cero manipulación , responsabilidad afectiva"]` |
| 328 | `9681` | `4035` | Natalia Medina | **`lifestyle.ideal_weekend`**: `null` → `"High energy"`<br>**`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 329 | `9682` | `4036` | Laura Stefane Alba Santa | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Tiendo a resolverlo todo yo Asumo demasiada carga emocional o práctica Me vuelvo muy exigente cuando siento que la otra persona no responde Pierdo admiración rápido cuando percibo pasividad o falta de criterio Tengo poca tolerancia a la inconsistencia Espero un nivel alto de atención y presencia Sobreanalizo cambios en la comunicación Tiendo a medir el interés por acciones concretas Me cuesta soltar el control cuando algo me importa Convierto los problemas de pareja en cosas que tengo que gestionar o solucionar Soy tan autónoma que a veces dejo poco espacio para que me cuiden Acumulo frustración antes de decir que algo me está molestando Me cierro emocionalmente cuando pierdo confianza Soy tajante cuando ya tomé una decisión Espero reciprocidad de una forma muy parecida a como yo la doy Confundo mi capacidad para hacerme cargo con la obligación de hacerlo Cuando estoy decepcionada, puedo convertir demasiadas cosas en no negociables"]` |
| 330 | `9683` | `4038` | Gabriel Hernandez | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["fumar, salir todas las noches, llevar vidas caóticas"]` |
| 331 | `9684` | `4039` | Sandra Carolina Jimenez Fonseca | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentiras"]` |
| 332 | `9685` | `4040` | Hans PARRA | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Conversaciones /chats inapropiados / sexting"]` |
| 333 | `9686` | `4041` | Natalie Pelaez | **`lifestyle.ideal_weekend`**: `null` → `"High energy"`<br>**`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Desinterés"]` |
| 334 | `9687` | `4043` | Camilo Andres Carrillo Rojas | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de alegría en la comunicación, negatividad constante y drama permanente."]` |
| 335 | `9688` | `4044` | John Alexander Centeno Forero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Celos excesivos, conductas controladoras, invasión de la privacidad, mentiras frecuentes, conflictos constantes con exparejas, falta de estabilidad emocional, dependencia excesiva, agresividad, falta de ambición o metas y dificultad para comunicarse."]` |
| 336 | `9689` | `4045` | Camila Casas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Bebedor y drogadicto, perezoso, que no sea disciplinado"]` |
| 337 | `9690` | `4046` | Daniela Sepulveda Vargas | **`lifestyle.ideal_weekend`**: `null` → `"High energy"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Carácter fuerte, EXCESIVAMENTE independiente, muy directa"]` |
| 338 | `9691` | `4047` | Diana Elizabeth Ocampo | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de paciencia"]` |
| 339 | `9692` | `4048` | Yamilet Medina | **`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Egocentrico tacano mo educado narcisista"]` |
| 340 | `9693` | `4049` | Alejandro Márquez | **`lifestyle.temperament`**: `null` → `"Calmo"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Comunicación , espiritualidad, amabilidad , persona que se cuide"]` |
| 341 | `9694` | `4050` | Santiago Bermudez | **`search_preferences.preferred_looks`**: `null` → `["Slim", "Athletic", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Natural, Athletic, Corporate"` |
| 342 | `9695` | `4051` | Stiven Botache | **`search_preferences.preferred_looks`**: `null` → `["Slim", "Very slim", "Athletic", "Tattoos"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural, Artistic, Athletic"` |
| 343 | `9696` | `4052` | Juan Felipe Torres Garcia | **`lifestyle.ideal_weekend`**: `null` → `"Calm"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Slim"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute"`<br>**`search_preferences.partner_red_flags`**: `null` → `["La vida social de mi potencial pareja no puede girar alrededor de la rumba/el alcohol. No vape."]` |
| 344 | `9697` | `4053` | Laura Mora | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 345 | `9698` | `4055` | Maria Carolina Duran Chacon | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentira, agresividad, toxicidad, celos, no gusto por las mascotas"]` |
| 346 | `9699` | `4057` | Maria Camila Noguera | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de respeto, mentiras, infidelidad, mala comunicación y falta de reciprocidad."]` |
| 347 | `9700` | `4058` | Melisa Arredondo Montoya | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Como límite tengo que me rodeo de personas que les gusta la naturaleza. Prefiero si no fuman. Me gusta relacionarme con personas que tengan algo que enseñarme y sean apasionadas por su trabajo o profesión. Me gustan las personas a las que les gusta viajar."]` |
| 348 | `9701` | `4059` | Marly Morales | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No negocio el respeto, la honestidad ni la libertad individual dentro de una relación. No quiero una relación basada en controlar con quién sale el otro, qué hace, cómo se viste o qué decisiones puede tomar. Para mí estar en pareja significa elegirnos, no pertenecernos. Tampoco negocio la comunicación: puedo tener conversaciones incómodas, aceptar diferencias y reconocer cuando me equivoco, pero no me funcionan los silencios como castigo, la manipulación, los ultimátums ni las amenazas de terminar cada vez que hay un conflicto. Y necesito una persona que tenga su propia vida, intereses, amigos y proyectos. Quiero compartir una vida con alguien, no convertirme en toda su vida."]` |
| 349 | `9702` | `4060` | Angel Arteaga | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Con hijos"]` |
| 350 | `9703` | `4061` | Estefania Torres Vergara | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Financialmente irresponsable, mala relación familiar, dishonest, no crea en dios"]` |
| 351 | `9704` | `4062` | Sebastian Eljach | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Uso de drogas fuertes"]` |
| 352 | `9705` | `4063` | Lina Maria Borrero | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 353 | `9706` | `4064` | JUAN PABLO RENDON | **`lifestyle.pet_type`**: `null` → `"Perros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Piel clara", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["Sin responsabilidad afectiva, Celos y control"]` |
| 354 | `9707` | `4065` | Paula Galvis | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Alto/a", "Piel clara", "Dientes lindos"]` |
| 355 | `9708` | `4066` | Margarita Carrasco | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Incertidumbre"]` |
| 356 | `9709` | `4067` | Eloy Briceño | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Piel clara", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["Intentar resolver todo y concentrarme en hacer en vez de sentir (working on it :D)"]` |
| 357 | `9710` | `4068` | Monica Patricia Reyes Otero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no fume, que tenga buena buena relación con su familia, que le guste viajar"]` |
| 358 | `9711` | `4069` | Gabriela Cadavid | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Alto/a", "Deportista", "Piel clara", "Buenas manos", "Dientes lindos"]` |
| 359 | `9712` | `4070` | Miguel angel Bello rojas | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Tatuajes", "Pelo oscuro", "Buenas manos", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["Poco tiempo libre - tímido - introvertido - callado"]` |
| 360 | `9713` | `4071` | simon Vasquez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 361 | `9714` | `4072` | Carolina Lopez O | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Inconsistencia entre sus palabras y acciones, ambigüedad sobre lo que busca, poca iniciativa, indisponibilidad emocional, mala comunicación, celos excesivos, irresponsabilidad financiera, falta de disciplina o ambición, mentalidad permanente de víctima, descuido de su salud e higiene y tratar mal a su familia, exparejas o personas de servicio. También considero una señal de alerta que espere recibir mucho sin demostrar reciprocidad ni disposición para construir en equipo."]` |
| 362 | `9715` | `4073` | Shiv Lakhani | **`lifestyle.pet_type`**: `null` → `"Gatos, Perros"`<br>**`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 363 | `9716` | `4075` | Juan David Ramírez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Tiendo a ser algo impaciente con algunas cosas, también siempre busco la lógica en cualquier cosa, por lo que tiendo a sobrepensar en muchas ocasiones."]` |
| 364 | `9717` | `4076` | Estefania Riaño | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No me gustan las personas muy superficiales, ni las que no saben atender o escuchar otras opiniones"]` |
| 365 | `9718` | `4077` | Monica Vasquez Velez | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Temas económicos, personas muy egocentricas, que estén buscando algo diferente aLo que yo quiero"]` |
| 366 | `9719` | `4078` | Victor Garcia | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["paso mucho tiempo en videojuegos"]` |
| 367 | `9720` | `4079` | Mabel Moreno | **`lifestyle.ideal_weekend`**: `null` → `"High energy"`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerdy, Soft girl/boy, Stylish, Natural, Alternative, Corporate, Minimalist"` |
| 368 | `9721` | `4080` | Paola Andrea Rodríguez Fernández | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 369 | `9722` | `4081` | Juliana Quijano Lopez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Desordenado con sus finanzas, mentiras"]` |
| 370 | `9723` | `4082` | Juan Esteban Granada | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Es Petrista, no trabaja/estudia, sus padres son sobreprotectores, ser picky con la comida"]` |
| 371 | `9724` | `4083` | Alejandra Carvajal | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["que viva con la mama, que no tenga hijos pequenos o adolecentes"]` |
| 372 | `9725` | `4084` | Gabriela Figueroa rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Otro : tacaño , que tenga muchas amigas , que sea muy sociable"]` |
| 373 | `9726` | `4085` | Katherine Millán | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 374 | `9727` | `4086` | Fabiana Cardona Jaramillo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mal genio"]` |
| 375 | `9728` | `4087` | Lirkhanna De San Vicente | **`lifestyle.pet_type`**: `null` → `"Otros"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que hagan Ghosting o actitudes similares"]` |
| 376 | `9729` | `4088` | Oscar Iván Camargo Chaparro | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 377 | `9731` | `4090` | Gabriela Sanchez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 378 | `9732` | `4091` | Mariana Martinez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 379 | `10360` | `4325` | Hundry Marquina | **`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.financial_vibe`**: `null` → `"Balanceado"`<br>**`lifestyle.free_time`**: `null` → `"Historia / Filosofía; Deportes y vida fit; Ciencia"`<br>**`search_preferences.red_flags`**: `[]` → `["Falta de respeto", "Mala comunicación", "No tener ambición", "Mentir", "No gustarle los animales"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Muy delgado/a", "Piel clara", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd, Estilo, Atlético, Corporate, Minimalista"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Cero relaciones casuales."` |
| 380 | `10533` | `1255` | Olga Bohorquez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 381 | `11092` | `2179` | Oscar Rojas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 382 | `11470` | `2867` | Danilo Andres Villamil | **`search_preferences.partner_red_flags`**: `null` → `["Ansiedad en incertidumbre, idealizar rápido, me centro en esa persona"]` |
| 383 | `11660` | `3122` | Esteban Caycedo | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 384 | `11790` | `3305` | Juan Jose Giraldo Bustamante | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 385 | `11830` | `3361` | Paulina Arboleda Carmona | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 386 | `11843` | `3380` | Alexander Mejia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 387 | `11852` | `3407` | Eduardo Espinosa | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 388 | `11862` | `3435` | Paola Gonzalez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 389 | `11870` | `3448` | Irina del Pilar Bernal Castro | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 390 | `11882` | `3469` | Sebastian Gomez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 391 | `11890` | `3484` | Daniel Castro | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 392 | `11900` | `3496` | Juliana Villarreal | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 393 | `11921` | `3519` | Alexis Palacio | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 394 | `11930` | `3530` | Sara Prieto | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 395 | `11940` | `3546` | Juan Jose Medina | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 396 | `11950` | `3558` | Alejandro Jimenez Restrepo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 397 | `11977` | `3616` | Adriana Gomez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 398 | `11982` | `3623` | Andres Herrera | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 399 | `12003` | `3658` | CAROLINA GARCIA | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 400 | `12031` | `3777` | Richard Moreno | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 401 | `12096` | `3880` | Daniel Moreno Agudelo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 402 | `12105` | `3892` | Andrea Rincon | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 403 | `12111` | `3899` | Oscar Ivan Rojas | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["inestabilidad emocional, falta de responsabilidad, la necesidad constante de validación. la necesidad constante de control, celos disfrazados de amor."]` |
| 404 | `12120` | `3911` | Edwin Danilo Mejia Tobon | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Nerd, Estilo, Natural, Atlético, Corporate, Minimalista"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que sea muy complicada para viajar, tipo por ejemplo que un hotel o un destino tiene que tener una característica especial que si no está no viaja"]` |
| 405 | `12142` | `3951` | Camilo Garcia | **`lifestyle.ideal_weekend`**: `null` → `"Calm"`<br>**`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de honestidad"]` |
| 406 | `12156` | `3979` | Francisco Navarro | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que ame los animales, que haga algún tipo de actividad fisica"]` |
| 407 | `12175` | `4012` | Valeria Pajaro | **`search_preferences.partner_red_flags`**: `null` → `["Hombre atento, detallista, cariñoso, leal, que esté claro en lo que quiere y que ya haya cerrado ciclos pasados."]` |
| 408 | `12184` | `4026` | David Quintero | **`lifestyle.temperament`**: `null` → `"Calm"`<br>**`search_preferences.preferred_looks`**: `null` → `["Slim", "Very slim", "Nice hands", "Nice teeth", "Well dressed"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Stylish, Natural"`<br>**`search_preferences.personal_red_flags`**: `null` → `["Overthinking", "Inconsistent messaging"]` |
| 409 | `12200` | `4056` | Nicolas Suarez | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Universidad, nada de derecha extrema o facho"]` |
| 410 | `12210` | `4098` | Carlos Mario Florez Jaramillo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 411 | `12220` | `4108` | Nataly Tinoco | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 412 | `12230` | `4118` | Adriana Romero | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 413 | `12240` | `4128` | Carlos Torrado | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 414 | `12250` | `4138` | Jaime Garrido García | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 415 | `12272` | `276` | Manuela Londoño Martinez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 416 | `12277` | `296` | Nicolas Munevar | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 417 | `12283` | `317` | Daniel Barranco | **`profiles.neighborhood`**: `null` → `"gran granada"` |
| 418 | `12321` | `472` | Miguel Hernando Rivera Becerra | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 419 | `12460` | `914` | Carol Orozco | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 420 | `12741` | `1535` | Rosario Gutierrez Bernal | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 421 | `12827` | `1767` | Camilo Andres Gutierrez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 422 | `13005` | `2202` | Carlos Andres Prieto Suarez | **`lifestyle.financial_vibe`**: `null` → `"Introverted"` |
| 423 | `13043` | `2270` | Lizeth Tatiana Fuquen Soler | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 424 | `13054` | `2326` | Santiago Cortes Mora | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 425 | `13086` | `2402` | Camilo Carvajal | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 426 | `13268` | `2936` | Sebastian Botero | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 427 | `13320` | `3022` | Camila Matallana | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 428 | `13356` | `3092` | Juan Esteban Corredor Camacho | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 429 | `13390` | `3151` | Juanita Diaz | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 430 | `13391` | `3152` | Francisco Martinez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 431 | `13408` | `3185` | Laura Gabriela Parrado Herrera | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 432 | `13417` | `3201` | Andres Ochoa | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 433 | `13431` | `3223` | Jazlin Perez Sumoza | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 434 | `13462` | `3277` | Juan Jose Ocoro | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 435 | `13465` | `3284` | Johanna Hernandez Gutierrez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 436 | `13468` | `3294` | Marcy Macias | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 437 | `13469` | `3297` | Santiago Ballesteros | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 438 | `13472` | `3302` | Vanessa Rodriguez Moreno | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 439 | `13473` | `3304` | Maria Isabel Cuervo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 440 | `13475` | `3309` | Luis Enrique Gomez Zambrano | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 441 | `13480` | `3325` | Elisabeth Vanegas Mateus | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 442 | `13494` | `3358` | Luis Ortega | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 443 | `13495` | `3359` | Maria Mujica | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 444 | `13496` | `3360` | ANDREA DURAN YEPES | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 445 | `13497` | `3362` | Eduardo Umaña | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 446 | `13498` | `3373` | Sergio Ruiz | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 447 | `13501` | `3382` | Laura Pelaez Soto | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 448 | `13502` | `3386` | Sara Arcila Cano | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 449 | `13503` | `3396` | Yuly Cristina Motta | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 450 | `13506` | `3437` | Juan Jose Coronel Rueda | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 451 | `13507` | `3446` | Valeria Quintero Montes | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 452 | `13511` | `3479` | Santiago Mancera | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 453 | `13512` | `3491` | Veronica Duarte salazar | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 454 | `13513` | `3497` | NATHALIE RODRIGUEZ ORTIZ | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 455 | `13515` | `3499` | Nicolas Puerto | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 456 | `13517` | `3502` | Gustavo Cifuentes | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 457 | `13518` | `3505` | Maria Patricia Reyes Quintero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 458 | `13519` | `3506` | Daniela Ballesteros Londoño | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 459 | `13520` | `3507` | Paola Andrea Pachon | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 460 | `13521` | `3509` | Camila Diaz Oliveros | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 461 | `13522` | `3510` | Carolina Bernal | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 462 | `13523` | `3511` | Vanessa Jimenez Gomez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 463 | `13524` | `3512` | Isaac Estrada | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 464 | `13526` | `3515` | Angela Maria Casas Abril | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 465 | `13527` | `3517` | Laura Garzon | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 466 | `13528` | `3521` | Fabian Quintero Cardenas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 467 | `13529` | `3522` | Jose Melguizo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 468 | `13531` | `3524` | Maria Camila Rivera Alarcon | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 469 | `13532` | `3525` | Lorena Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 470 | `13533` | `3526` | Maria Triana | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 471 | `13534` | `3533` | Juan Felipe Cardona salazar | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 472 | `13535` | `3534` | Fernando Navarro Gomez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 473 | `13536` | `3535` | Carolina Dorado | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 474 | `13538` | `3538` | Manuela Diaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 475 | `13539` | `3540` | Felipe Diaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 476 | `13540` | `3543` | Samara Gaviria | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 477 | `13541` | `3547` | Juanita Tellez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 478 | `13542` | `3548` | Sebastian Rendon | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 479 | `13543` | `3549` | Alberto Mercheyer | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 480 | `13544` | `3550` | Claudia Guzman Silva | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 481 | `13546` | `3553` | Melissa Fernandez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 482 | `13547` | `3556` | Manuel Blanco | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 483 | `13549` | `3561` | Santiago Botero Giraldo | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 484 | `13550` | `3565` | Felipe Pinilla | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 485 | `13551` | `3567` | Anthonny Betancourt | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 486 | `13552` | `3573` | Laura Camila Ramos | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 487 | `13553` | `3577` | Julian Cubillos | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 488 | `13554` | `3625` | Juan Camilo Arango | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 489 | `13559` | `3893` | David Escandon | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 490 | `13560` | `3894` | Paola Mosquera | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 491 | `13561` | `3895` | Juan Camilo Arce | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 492 | `13562` | `3896` | Maria Fernanda Pacheco | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["No le gusta un hombre tacaño"]` |
| 493 | `13563` | `3900` | Ximena Plazas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 494 | `13564` | `3901` | Juan Sebastian Gomez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 495 | `13565` | `3903` | Santiago Chaustre | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 496 | `13566` | `3904` | Valeria Linero | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 497 | `13569` | `3910` | Moises Barron | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural"`<br>**`search_preferences.partner_red_flags`**: `null` → `["No"]` |
| 498 | `13570` | `3920` | Miguel Cardenas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto ante todo, estoy entre trabajos en este momento pero continúo construyendo mi futuro, busco a alguien que quiera ayudarme a construir."]` |
| 499 | `13571` | `3922` | Juliana Vanegas Guerra | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Trabajando en ellos: tiendo a tomar rol de \"salvadora\", caigo en el error de buscar que la respuesta del otro confirme mi valía, tolero ambigüedad o falta de interés, doy el 100% antes de tiempo (sin ver primero que si haya interés recíproco)"]` |
| 500 | `13572` | `4074` | Jorge Marquez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Muchos tatuajes,  cigarrillos o sus derivados"]` |
| 501 | `13573` | `4772` | Susana Ramírez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Me gustaría que entendiera que estoy en un proceso de aprender y crecer, y que no tengo todo resuelto. Estoy trabajando en mí, en mi bienestar emocional, físico y financiero, y en construir la vida y la familia que sueño. Valoro mucho poder compartir ese proceso con alguien que también quiera evolucionar, apoyarnos y construir una vida juntos."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Mentiras, infidelidad, manipulación, celos excesivos, control, falta de respeto, poca empatía e inmadurez emocional. También son una red flag las personas emocionalmente intermitentes, ambivalentes o poco disponibles, que no tienen claridad sobre lo que quieren. Busco alguien que tenga disposición para una relación y sea claro desde el inicio sobre querer construir un vínculo. También me genera alerta alguien que evite conversaciones importantes, tenga dificultad para asumir errores o pedir perdón, no tenga metas personales o dependa constantemente de los demás para tomar decisiones."]` |
| 502 | `13574` | `4093` | Carolina Morales Reyes | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 503 | `13575` | `4094` | Manuela Fernández Montoya | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 504 | `13576` | `4095` | Guilermo Ramirez | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 505 | `13577` | `4096` | Santiago Cadavid | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 506 | `13578` | `4097` | Angelica Maria Fernández Garcia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 507 | `13579` | `4099` | Kevin Restrepo | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 508 | `13580` | `4100` | Roberto Berganza | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 509 | `13581` | `4101` | Manuela Tellez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 510 | `13582` | `4102` | Nicole Victoria Perez Montezuma | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 511 | `13583` | `4331` | Antonella Gaffurri | **`profiles.neighborhood`**: `null` → `"Calle 112#1669"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Dientes, fumador, mentiras"]` |
| 512 | `13584` | `4104` | marina davila | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 513 | `13585` | `4105` | Daniela Vanegas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 514 | `13586` | `4106` | Enrique Andres Gonzalez Araujo | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 515 | `13587` | `4107` | Francy Catherine Villalobos Piñeros | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 516 | `13589` | `4110` | Carlos Roberto Solorzano Rojas | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 517 | `13591` | `4112` | KAREN TATIANA CASTRO GORDO | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 518 | `13592` | `4113` | Geraldine Orozco | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 519 | `13593` | `4115` | María Alejandra Zamora Hilarión | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 520 | `13594` | `4116` | Sebastian Salazar | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 521 | `13595` | `4117` | Miguel Trujillo | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 522 | `13596` | `4120` | Giancarlo Melani | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 523 | `13597` | `4121` | Angelica Sanchez Ramirez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 524 | `13598` | `4122` | Nicolas Perez Garcia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 525 | `13599` | `4123` | Manuel Guillermo Angulo Bermudez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 526 | `13600` | `4124` | Nathaly Sepulveda Ramos | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 527 | `13601` | `4125` | Andres Giraldo | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 528 | `13602` | `4126` | Juan Felipe Zúñiga Astaiza | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 529 | `13603` | `4127` | Juan Oquendo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 530 | `13604` | `4129` | Daniela Giraldo | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 531 | `13605` | `4130` | Maria Sanz de Santamaría | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 532 | `13606` | `4131` | Mateo Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 533 | `13607` | `4137` | Alberto Telch | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 534 | `13608` | `4133` | Pilar Ceballos | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 535 | `13609` | `4134` | María José Quiroga Gómez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 536 | `13610` | `4135` | Alejandro Santoyo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 537 | `13611` | `4136` | Miguel Castro | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 538 | `13612` | `4139` | Daniel Giraldo J | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 539 | `13623` | `4140` | Oscar Alejandro Mina Carvajal | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 540 | `13624` | `4141` | MARIA ALEJANDRA ANGULO SALCEDO | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 541 | `13625` | `4143` | Enrique Triana | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 542 | `13626` | `4144` | Maria Tere Gonzalez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 543 | `13627` | `4145` | Maria Camila Guerrero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 544 | `13628` | `4146` | Lina María Díaz Peña | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 545 | `13629` | `4147` | Faber Andrés Calderón Henao | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 546 | `13630` | `4148` | Juan Sebastian Vargas Duarte | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 547 | `13631` | `4149` | Santiago Pulido | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 548 | `13632` | `4150` | Diana Marcela Ortega loaiza | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 549 | `13633` | `4151` | Carlos Felipe Niño Bernal | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 550 | `13634` | `4152` | Laura Camila Ortiz Alvarado | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 551 | `13635` | `4154` | David Carvajal | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 552 | `13636` | `4155` | Alvaro López | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 553 | `13637` | `4156` | Mateo Parra Serrano | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 554 | `13638` | `4157` | Ana Sofia Bernal Bejarano | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 555 | `13639` | `4158` | Alvaro Juliao | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 556 | `13640` | `4159` | Geraldine Bravo | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 557 | `13641` | `4160` | Angie Diaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 558 | `13642` | `4161` | María Soledad Bastidas | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 559 | `13643` | `4162` | Santiago Martinez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 560 | `13644` | `4163` | Jorge David Peñafiel Ojeda | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 561 | `13645` | `4164` | Jorge Alberto Gomez Vigoya | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 562 | `13646` | `4165` | Felipe Mugno Londoño | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 563 | `13647` | `4166` | Luisa Fernanda Avendaño | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 564 | `13648` | `4167` | Miguel D Garcia Polanco | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 565 | `13649` | `4168` | Valeria Giraldo | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 566 | `13650` | `4169` | Jimmi Larrahondo Velasco | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 567 | `13651` | `4170` | Luis Felipe Morales | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 568 | `13652` | `4171` | Milagros Ramos | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"` |
| 569 | `13653` | `4172` | Carolina Mejia | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 570 | `13654` | `4173` | Sergio Díaz | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 571 | `13655` | `4174` | Dana Gabriela Villanueva Cogollo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 572 | `13656` | `4175` | Paola Agreda | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 573 | `13657` | `4176` | Gino Merlano | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 574 | `13658` | `4177` | David Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 575 | `13659` | `4178` | Daniela Ordoñez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 576 | `13660` | `4179` | Susana Escobar soto | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 577 | `13661` | `4180` | Valeria Goyeneche | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 578 | `13662` | `4182` | Enrique Guimera Tur | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 175 cm"` |
| 579 | `13663` | `4183` | Carlos David Castañeda Zafra | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 580 | `13664` | `4184` | Natalia Ovalle Celis | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 581 | `13665` | `4185` | Felipe Gonzalez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 582 | `13666` | `4186` | Diego Romero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 583 | `13667` | `4187` | Lina Maria Rodriguez Cortes | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 584 | `13668` | `4188` | Milena Agudelo | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 585 | `13669` | `4189` | Sara Cristina Niño Sánchez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 586 | `13670` | `4191` | Stacy Kelly | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 587 | `13671` | `4192` | Paula Viviana Sanchez Salcedo | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 588 | `13672` | `4193` | Grace Avilez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 589 | `13673` | `4194` | Alejandra Lozano Alejo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 590 | `13674` | `4195` | Manuela Arbelaez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 591 | `13675` | `4196` | Leonardo Plata | **`profiles.neighborhood`**: `null` → `"chapinero"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 592 | `13676` | `4197` | Paula Avila | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 593 | `13677` | `4198` | María Juliana Gaviria Giraldo | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 594 | `13678` | `4199` | Paola Arias | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 595 | `13679` | `4343` | Francy Preciado | **`search_preferences.preferred_vibe`**: `null` → `"Atlético"` |
| 596 | `13680` | `4201` | Linda Catalina Ospina Rubiano | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 597 | `13681` | `4202` | Juan Guillermo Tamayo Diaz | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 598 | `13682` | `4203` | Javier Sanchez Diaz | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 599 | `13683` | `4204` | Jorge Montoya | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 600 | `13684` | `4205` | Juan José Valencia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 601 | `13685` | `4206` | Akshata Ashok | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"` |
| 602 | `13686` | `4207` | Angelica Ruiz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 603 | `13687` | `4208` | Nicolas Rodriguez Leon | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 604 | `13688` | `4209` | Oscar Eduardo Lopez Lara | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 605 | `13689` | `4210` | Nicolas Rojas Hernandez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 606 | `13690` | `4211` | CAROL HANSEN | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 607 | `13691` | `4212` | Natalia Vasquez pedreros | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"` |
| 608 | `13692` | `4213` | Thomas Santiago Montero Cardenas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 609 | `13693` | `4214` | Vanessa Koegler | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 610 | `13694` | `4215` | Eleonora Castillo Peña | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 611 | `13695` | `4216` | Valeria Torres Lozano | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 612 | `13696` | `4217` | Luis Sanabria | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 613 | `13697` | `4218` | Carlos alberto Bermudez garcia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 614 | `13698` | `4219` | Luis Felipe Torres | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 615 | `13699` | `4220` | Viviana Rubiano | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 616 | `13700` | `4221` | Natalia Raad | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 617 | `13701` | `4222` | Maria Bernarda De la hoz ospino | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 618 | `13702` | `4223` | Yohana Buenaventura | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 619 | `13703` | `4224` | Juan Camilo Riveros Velandia | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 620 | `13704` | `4225` | Mario Alejandro Vallejo Yacelga | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 621 | `13705` | `4226` | Paula Franco | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 622 | `13706` | `4227` | Tatiana Velasquez Lopez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 623 | `13707` | `4228` | Daniela Valencia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"` |
| 624 | `13708` | `4229` | Laura Gomez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 625 | `13709` | `4230` | Mario Aranguren | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 626 | `13710` | `4231` | Henry Chacon | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 627 | `13711` | `4232` | Angie Carolina Garcia Hernandez | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 628 | `13712` | `4233` | José María Silva | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 176 cm"` |
| 629 | `13713` | `4234` | Jennifer Morales González | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 630 | `13714` | `4235` | Felipe Sánchez Mejía | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 173 cm"` |
| 631 | `13715` | `4237` | Sara Sofia Aguirre Velandia | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 632 | `13716` | `4238` | Juan Katime | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 633 | `13717` | `4239` | Julian Mauricio Rodriguez Hidalgo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 634 | `13718` | `4240` | Juan Camilo Villamizar Borrero | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 635 | `13719` | `4241` | Maria Callejas | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 636 | `13720` | `4242` | Sonia Yasmin Huertas Martinez | **`profiles.neighborhood`**: `null` → `"Colina"`<br>**`profiles.education`**: `null` → `"Profesional"`<br>**`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`lifestyle.free_time`**: `null` → `"Algunia fines de semana voy a la finca, tengo ganado."`<br>**`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no tenga hijos"]` |
| 637 | `13721` | `4243` | Sebastian Balcucho | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 638 | `13722` | `4244` | Pablo del Pino Mejia | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 639 | `13723` | `4245` | Santiago Troncoso | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 640 | `13724` | `4246` | Laura Alfonso | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 641 | `13725` | `4247` | Camilo Medrano | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 642 | `13726` | `4248` | HÉCTOR MIGUEL IBÁÑEZ | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"` |
| 643 | `13727` | `4249` | Karen Lizeth Fuentes León | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 644 | `13728` | `4250` | Diana Ortiz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 645 | `13729` | `4251` | Robinson Andres Calderon | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"160 a 170 cm"` |
| 646 | `13730` | `4252` | Angela Garcia | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 647 | `13731` | `4253` | Cristian Rodriguez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 648 | `13732` | `4255` | Marcela Herrera | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 649 | `13733` | `4256` | Angela Mejia | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 650 | `13734` | `4257` | Maria Valentina Perdomo Córdoba | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 651 | `13735` | `4258` | Tatiana Toro Cala | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"` |
| 652 | `13736` | `4259` | Luisa Maria Bermudez Jara | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 653 | `13737` | `4260` | jesus Felipe Mateus | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 166 cm"` |
| 654 | `13738` | `4261` | Sonia Natalia Maldonado Vargas | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 655 | `13739` | `4262` | Adriana Estrada | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 656 | `13740` | `4263` | María Juliana Gutierrez Calle | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"` |
| 657 | `13741` | `4264` | Sofía García | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 166 cm"` |
| 658 | `13742` | `4265` | Nahim Navas | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 175 cm"` |
| 659 | `13743` | `4266` | Luz Adriana Mendoza | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 660 | `13744` | `4267` | alfonso quinones | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 661 | `13745` | `4268` | Luisa Fernanda Torres | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 662 | `13746` | `4269` | Mariana Agudelo | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 173 cm"` |
| 663 | `13747` | `4270` | Daniella Lozada | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 664 | `13749` | `4272` | Luna Lily García Piedra | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 665 | `13752` | `4275` | Pablo Aguilar | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 666 | `13753` | `4276` | Juan Esteban Paca Ramirez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 667 | `13754` | `4277` | Sofía Otero | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 668 | `13756` | `4279` | Julian Gonzalez Espinal | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 669 | `13757` | `4280` | Manuel Espitia | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 670 | `13758` | `4281` | Manuela Osorio Restrepo | **`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"` |
| 671 | `13759` | `4282` | Jonatan Rodríguez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 672 | `13760` | `4283` | Santiago Ocampo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 673 | `13761` | `4284` | Sebastian Acosta Rangel | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 674 | `13762` | `4285` | Luis Lemus | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 675 | `13763` | `4286` | Juan Esteban Muriel | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 676 | `13764` | `4287` | Sebastian Zapata | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 677 | `13765` | `4288` | Jimena Andrea Chavez | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."` |
| 678 | `13766` | `4289` | Jacobo Quijano | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 150 cm"` |
| 679 | `13767` | `4290` | Andres Felipe Namen | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 680 | `13768` | `4291` | Arturo Melgarejo Paredes | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 681 | `13769` | `4292` | Juan Yaya | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 682 | `13770` | `4293` | David Sanchez | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 683 | `13771` | `4294` | Juan Pablo González | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 684 | `13772` | `4295` | Sebastian Ramirez | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 685 | `13773` | `4297` | Diego Felipe Eslava Vera | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 168 cm"` |
| 686 | `13774` | `4298` | David Alejandro Mercado | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 687 | `13775` | `4299` | Daniela Palacio Mejia | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 688 | `13776` | `4300` | Verónica Arango | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"` |
| 689 | `13777` | `4301` | Pedro Pablo Mora | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"150 a 162 cm"` |
| 690 | `13778` | `4302` | Michelle russi quiroz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 691 | `13779` | `4303` | Stefany Maria Acosta Diaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 163 cm"` |
| 692 | `13780` | `4304` | Valentina Agudelo | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"` |
| 693 | `13781` | `4305` | Santiago Murcia Sarmiento | **`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 150 cm"` |
| 694 | `13782` | `4306` | Daniel Acosta | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 695 | `13783` | `4308` | Mariana Restrepo | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 696 | `13784` | `4309` | Angie Lorena Ruiz Garcia | **`profiles.neighborhood`**: `null` → `"Hayuelos"`<br>**`lifestyle.values`**: `null` → `["Familia", "Empatía", "Crecimiento personal"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Personas radicales en politica o religión. Arrogancia. No empatia"]` |
| 697 | `13785` | `4310` | Juan manuel Moncadq | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 168 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Sea de izquierda en la política"]` |
| 698 | `13786` | `4311` | Luis Eduardo Jimenez | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 699 | `13787` | `4312` | Cristian Moreno | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"165 a 175 cm"` |
| 700 | `13788` | `4313` | Andreina Cardenas | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"` |
| 701 | `13789` | `4314` | Rafael Latorre | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 702 | `13790` | `4315` | Juan Nicolas Gutierrez Bayona | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 163 cm"` |
| 703 | `13791` | `4317` | Edisson Santiago Gutierrez Paipilla | **`search_preferences.preferred_height`**: `null` → `"Hasta 165 cm"` |
| 704 | `13793` | `4319` | Roberto Carrizosa Gómez | **`search_preferences.preferred_height`**: `null` → `"Desde 160 cm"` |
| 705 | `14400` | `4016` | Jose David Reyes | **`profiles.neighborhood`**: `null` → `"Puebte largo"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Honestidad lealtad"]` |
| 706 | `14404` | `4801` | Javier Cardenas | **`profiles.estatura`**: `null` → `"180 cm"`<br>**`profiles.education`**: `null` → `"Professional Degree (politecnico grancolombiano)"`<br>**`profiles.religion`**: `null` → `"Spiritual"`<br>**`profiles.love_language`**: `null` → `"Quality time"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"Yes"`<br>**`lifestyle.body_type`**: `null` → `"Average"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.drinks_alcohol`**: `null` → `"No"`<br>**`lifestyle.has_pets`**: `null` → `"Yes"`<br>**`lifestyle.fitness_level`**: `null` → `"Consistent (2–3 times/week)"`<br>**`lifestyle.fitness_preferences`**: `null` → `"Gym, Outdoor activities"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanced"`<br>**`lifestyle.temperament`**: `null` → `"Calm"`<br>**`lifestyle.rumba`**: `null` → `"Does not party"`<br>**`lifestyle.politics`**: `null` → `"Moderate right"`<br>**`lifestyle.values`**: `null` → `["Family", "Loyalty", "Honesty"]`<br>**`lifestyle.work_style`**: `null` → `"Productive"`<br>**`lifestyle.housing_status`**: `null` → `"Family"`<br>**`lifestyle.financial_vibe`**: `null` → `"Balanced"`<br>**`lifestyle.free_time`**: `null` → `"Painting, drawing, crafts"`<br>**`search_preferences.preferred_gender`**: `null` → `"Female"`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural, Minimalist"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 175 cm"`<br>**`search_preferences.min_age`**: `null` → `25`<br>**`search_preferences.max_age`**: `null` → `32` |
| 707 | `14528` | `3948` | Karen Stefanny Gomez Rodriguez | **`profiles.row_created`**: `false` → `true`<br>**`profiles.city`**: `null` → `"Tenjo"`<br>**`profiles.neighborhood`**: `null` → `"Chince"`<br>**`profiles.gender`**: `null` → `"Mujer"`<br>**`profiles.orientation`**: `null` → `"hetero"`<br>**`profiles.bio_notes`**: `null` → `"IG: @steffy2808"`<br>**`lifestyle.body_type`**: `null` → `"Promedio/Promedia"`<br>**`lifestyle.politics`**: `null` → `"Center"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"`<br>**`search_preferences.min_age`**: `null` → `32`<br>**`search_preferences.max_age`**: `null` → `45`<br>**`search_preferences.partner_red_flags`**: `null` → `["Trabajando en la confianza hacía los demás"]` |
| 708 | `15559` | `4773` | Felipe Rueda Rivera | **`profiles.neighborhood`**: `null` → `"CL 4 C BIS 50 60"`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Atlético, Corporate, Minimalista"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 172 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Relación abierta, no quiero eso, que sea proactiva y ambiciosa"]` |
| 709 | `15560` | `4340` | Thomas Jansasoy | **`profiles.neighborhood`**: `null` → `"Rosales"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 170 cm"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"El mundo es mucho más amplio de lo que a veces alcanzamos a imaginar. Está compuesto por personas de distintos orígenes, estratos, experiencias y maneras de entender la vida. A mí me encanta acercarme a esa diversidad, adaptarme a diferentes contextos y conocer otras perspectivas y formas de ver el mundo.\r\nCreo que el mundo no es estático, está lleno de posibilidades y experiencias únicas. Puedo disfrutar tanto de algo sencillo, como comer un atún en lata, como de una experiencia especial, como probar un buen pulpo en el país vasco. Me gustan las cosas simples, pero también valoro aquello que requiere esfuerzo y representa un logro.\r\nDisfruto la alegría de lo cotidiano, el amor, la amistad, una buena conversación, los pequeños momentos y todo aquello que le da sentido a la vida. Me muevo con naturalidad entre lo sencillo y lo sofisticado, porque para mí el valor de una experiencia no depende únicamente de su precio, sino de lo que significa y de la forma en que se vive.\r\nMe gusta vivir con tranquilidad, respeto y buena comunicación. Quiero mucho a mis amigos y soy una persona leal. Puedo adaptarme a distintos ambientes y asumir diferentes facetas, pero también valoro que exista la oportunidad de mostrar quién soy realmente. Para mí, vivir consiste en disfrutar, aprender, compartir y reconocer que cada experiencia puede ser una oportunidad."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto, honestidad, reciprocidad y ante todo coherencia."]` |
| 710 | `15588` | `4190` | Leonardo Marquez Pineda | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 711 | `15589` | `4132` | Alberto Telch Otalora | **`lifestyle.income_range`**: `null` → `"Entre 12 y 20 SMMLV."` |
| 712 | `15590` | `4329` | German Felipe Valencia Bernal | **`lifestyle.values`**: `null` → `["Lealtad", "Independencia", "Empatía"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Estilo, Corporate"`<br>**`search_preferences.preferred_height`**: `null` → `"165 a 175 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Nada de consumo de sustancias, nada de fumadores"]` |
| 713 | `15591` | `4338` | Ricardo Colon | **`profiles.neighborhood`**: `null` → `"Cra 41aa # 19 sur 21"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Prefiero sin tatuajes"]` |
| 714 | `15592` | `4341` | Sebastian Alexis Najar Castaño | **`profiles.neighborhood`**: `null` → `"Boita"`<br>**`profiles.education`**: `null` → `"Universidad Antonio Nariño"`<br>**`lifestyle.free_time`**: `null` → `"Cine, conciertos, música en vivo, baile"`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 170 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Puedo ghostear si la persona no aporta para tener una conversación agradable, A veces no pienso mucho antes de actuar y puedo cometer errores, mi tranquilidad en algunos aspectos personas no lo soportan, a veces cuando intento impulsar a alguien puede sonar como regaños"]` |
| 715 | `15593` | `4336` | Ivan Mattar | **`profiles.neighborhood`**: `null` → `"Carrera 13 #93-69, oficina 201"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 173 cm"`<br>**`search_preferences.min_age`**: `null` → `25`<br>**`search_preferences.max_age`**: `null` → `35`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Que las cosas importantes toman tiempo y cuidado"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Una mujer que no tenga metas, ambiciones o que sienta que le da pereza hacer cosas en la vida o tomar retos."]` |
| 716 | `15594` | `4767` | Juan Manuel Botero | **`profiles.neighborhood`**: `null` → `"Calle 104 # 19a - 39"`<br>**`lifestyle.values`**: `null` → `["Familia", "Honestidad", "Aventura"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Soft girl/boy, Natural, Atlético"`<br>**`search_preferences.preferred_height`**: `null` → `"155 a 170 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Por ser amable paso por coqueto"]` |
| 717 | `15595` | `4335` | Sebastian Diaz Chavez | **`lifestyle.values`**: `null` → `["Familia", "Disciplina", "Empatía"]`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 170 cm"`<br>**`search_preferences.min_age`**: `null` → `24`<br>**`search_preferences.max_age`**: `null` → `29`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"."` |
| 718 | `15596` | `4775` | Erika Jurado | **`profiles.neighborhood`**: `null` → `"Casa Segundo Piso"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.politics`**: `null` → `"Center"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 175 cm"` |
| 719 | `15597` | `4344` | David Zapata Espinosa | **`profiles.neighborhood`**: `null` → `"Cra 59 # 27b - 442"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Disciplina", "Honestidad"]`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Principalmente el manejo del tiempo. A veces por trabajo las cosas se juntan y es un poco complicado hacer planes en semana (trabajo remoto y en cualquier momento dentro del horario laboral puedo ocuparme sin previo aviso)"` |
| 720 | `15598` | `4347` | Sofia Huertas | **`profiles.neighborhood`**: `null` → `"Calle 124 #9-39"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Honestidad", "Empatía"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Corporate, Minimalista"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"` |
| 721 | `15599` | `4780` | Andres Silva | **`lifestyle.wants_children`**: `null` → `"Sí"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 170 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Monogamia, Estabilidad emocional, Deporte, Femenina, Buen trabajo"]` |
| 722 | `15600` | `4792` | Gloria Lucia Gomez Gil | **`profiles.neighborhood`**: `null` → `"calle 1 no 35 90 apto 202 poblado"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 160 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["tendencia socialista o progress"]` |
| 723 | `15601` | `4779` | Ivan Dario Lopez Perez | **`profiles.neighborhood`**: `null` → `"Chapinero Alto"`<br>**`profiles.education`**: `null` → `"Profesional"`<br>**`lifestyle.temperament`**: `null` → `"Calmo"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 175 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Toxica , Muy celosa o controladora"]` |
| 724 | `15602` | `4799` | Maria Ximena Ramirez | **`profiles.neighborhood`**: `null` → `"Calle 110 # 15-51"`<br>**`profiles.education`**: `null` → `"Maestría"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 160 cm"` |
| 725 | `15603` | `4771` | Luisa Vargas Ramirez | **`profiles.neighborhood`**: `null` → `"Entre Rios"`<br>**`lifestyle.values`**: `null` → `["Honestidad", "Empatía", "Crecimiento personal"]`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Mi forma de comunicación, necesidad de espacio, mi sensibilidad social e interés por lo internacional. Mis ambiciones profesionales. La dinámica familiar de una familia de migrantes."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de honestidad, respeto, minimizar los sentimientos-percepciones del otro, comportamientos violentos"]` |
| 726 | `15604` | `4795` | Ricardo Justinico | **`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 158 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Inconsistencia en lo que dice y lo que hace"]` |
| 727 | `15605` | `4769` | Juanita Mesa Rosas | **`profiles.neighborhood`**: `null` → `"Calle 10 # 28-70"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Estilo, Alternativo, Corporate"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["No crypto bros🙃"]` |
| 728 | `15606` | `4770` | Maria Carolina Cortes | **`profiles.neighborhood`**: `null` → `"calle 114#56-89"`<br>**`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Natural, Corporate"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 170 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Drogas"]` |
| 729 | `15607` | `4766` | Jeyson Ruiz Sandoval | **`profiles.neighborhood`**: `null` → `"Calle 10a #28-18"`<br>**`lifestyle.values`**: `null` → `["Familia", "Estabilidad", "Disciplina"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Natural"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 175 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto, honestidad y madurez emocional"]` |
| 730 | `15608` | `4806` | Eneth Duncan | **`profiles.neighborhood`**: `null` → `"Olaya"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 166 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no sea honesto,  que no tenga planes a futuro (trabajo, familia, estabilidad), que sepa comunicar y escuchar, no tenga excesos como alcohol y sustancias"]` |
| 731 | `15609` | `4808` | Alonso Acosta | **`profiles.neighborhood`**: `null` → `"Bolivia"`<br>**`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 171 cm"` |
| 732 | `15610` | `4337` | Domingo Vasquez | **`profiles.estatura`**: `null` → `"173 cm"`<br>**`profiles.education`**: `null` → `"Professional Degree"`<br>**`lifestyle.income_range`**: `null` → `"Más de 20 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 170 cm"`<br>**`search_preferences.min_age`**: `null` → `31`<br>**`search_preferences.max_age`**: `null` → `40`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Soy una persona independiente, curiosa y bastante tranquila. Disfruto descubrir lugares nuevos, aprender, viajar y también pasar tiempo en casa. Valoro mucho mi carrera y mis proyectos personales, pero también disfruto compartir mi vida con alguien especial. Creo que las mejores relaciones surgen cuando dos personas pueden ser ellas mismas, divertirse juntas y construir algo bonito de manera natural."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de respeto, celos o control excesivo"]` |
| 733 | `15611` | `4805` | Laura Reyes | **`profiles.neighborhood`**: `null` → `"La Calleja"`<br>**`profiles.education`**: `null` → `"Profesional"`<br>**`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 174 cm"`<br>**`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `35`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Me gustaría que mi futura pareja entendiera que para mí amar a alguien no significa dejar de ser yo. Soy una persona que se entrega mucho a lo que ama, y cuando quiero a alguien también quiero hacerlo de verdad. Pero he aprendido que un amor sano no debería pedirme abandonar las otras partes de mi vida.\r\n\r\nQue entienda que puedo ser muy independiente y, al mismo tiempo, querer sentirme cuidada. Estoy acostumbrada a resolver, trabajar, organizarme, perseguir mis metas y salir adelante, pero eso no significa que no quiera un amor tierno. Quiero poder bajar la guardia con alguien, sentir que también puedo apoyarme en él y que no tengo que ser siempre la que tiene todo bajo control."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Para mi es muy importante una persona que comparta mi fe. Soy una persona que vive su fe activamente, y que realiza muchas actividades en su vida entorno a su espiritualidad (ej. retiros, voluntariados, etc). Honesto, respetuoso"]` |
| 734 | `15612` | `4786` | Juan David Cerquera | **`profiles.neighborhood`**: `null` → `"Cra 80 a #17-85"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.preferred_height`**: `null` → `"160 a 180 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que tenga hijos"]` |
| 735 | `15613` | `4835` | Juliana Perez Lopez | **`profiles.neighborhood`**: `null` → `"Santa Barbara"`<br>**`lifestyle.has_pets`**: `null` → `"Sí"`<br>**`lifestyle.rumba`**: `null` → `"Ocasional"`<br>**`search_preferences.partner_red_flags`**: `null` → `["ghosting"]` |
| 736 | `15614` | `4787` | Julian Giraldo | **`profiles.neighborhood`**: `null` → `"Carrera 14A #102-25"`<br>**`profiles.education`**: `null` → `"Profesional"`<br>**`search_preferences.preferred_height`**: `null` → `"Hasta 162 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que sea deshonesta, irrespetuosa"]` |
| 737 | `15615` | `4768` | Maria Alejandra Luque | **`profiles.neighborhood`**: `null` → `"TV 35 2910"`<br>**`lifestyle.values`**: `null` → `["Honestidad", "Empatía", "Aventura"]`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Que soy callada hasta que tomo confianza"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no le gusten los animales , que no sea generoso y consentidor , que no sea un caballero"]` |
| 738 | `15616` | `4797` | Laura Calvo Duque | **`profiles.neighborhood`**: `null` → `"Cll 3 #20-101 sendero de la julita"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 167 cm"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de ambición, conformismo, poca inteligencia emocional, dificultad para expresar lo que siente conmigo, que no le vaya bien económicamente."]` |
| 739 | `15618` | `4778` | Santiago Vargas | **`profiles.neighborhood`**: `null` → `"Calle 160 #60 - 07"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"` |
| 740 | `15619` | `4788` | Mariana Forero | **`profiles.neighborhood`**: `null` → `"Calle 96 #13a-03"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que fume, que no le gusten los animales, no tenga tiempo, no le guste hablar por WhatsApp, no tenga iniciativa"]` |
| 741 | `15620` | `4822` | Fabrizzio Castelli | **`profiles.neighborhood`**: `null` → `"10231 Sw 4th ct , Unit 302"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Que sea capaz de entender mis metas y apoyar incondicionalmente igual que yo lo haría"` |
| 742 | `15621` | `4800` | Ivonne Arias | **`search_preferences.partner_red_flags`**: `null` → `["Narcisismo, viva con los padres, hijos con custodia compartida, gustos por las drogas o narcóticos,"]` |
| 743 | `15622` | `4781` | Luz Gomez | **`profiles.neighborhood`**: `null` → `"Kra 45 n 3 o"` |
| 744 | `15623` | `4803` | Isabella Lomonaco | **`profiles.neighborhood`**: `null` → `"Calle 146 #21-75"`<br>**`profiles.education`**: `null` → `"Estudiante"`<br>**`lifestyle.temperament`**: `null` → `"Calmo"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Soy muy terca y a veces con un ego muy grande."]` |
| 745 | `15628` | `4832` | Juan Hosman | **`search_preferences.partner_red_flags`**: `null` → `["Que digan que no son celosas"]` |
| 746 | `15631` | `4796` | Diana Paola Gomez Mendez | **`profiles.neighborhood`**: `null` → `"Cra12 a3/81"`<br>**`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Impuntualidad"]` |
| 747 | `15639` | `4834` | Tatisrojas (@tatisrojas) | **`search_preferences.min_age`**: `null` → `28`<br>**`search_preferences.max_age`**: `null` → `35` |
| 748 | `15655` | `4826` | Kmilacanolasprilla (@Kmilacanolasprilla) | **`profiles.neighborhood`**: `null` → `"Carrera 83a #48-24"`<br>**`lifestyle.values`**: `null` → `["Familia", "Lealtad", "Honestidad"]`<br>**`search_preferences.partner_red_flags`**: `null` → `["El maltrato, vicios, desinterés, falta de autocuidado"]` |
| 749 | `15657` | `3869` | Emilith Yaneth Blanco Cabrera | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 750 | `15664` | `4776` | Malarjandragallo (@Malarjandragallo_) | **`profiles.neighborhood`**: `null` → `"Dade"`<br>**`lifestyle.wants_children`**: `null` → `"Sí"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Respeto, comunicacion, fidelidad , consistencia, responsabilidad afectiva, responsabilidad financiera, Honestidad, metas propias , paz"]` |
| 751 | `15665` | `4825` | Jmberdugoq (@jmberdugoq) | **`profiles.estatura`**: `null` → `"174 cm"`<br>**`profiles.education`**: `null` → `"Profesional (Universidad de los Andes)"`<br>**`profiles.religion`**: `null` → `"Espiritual"`<br>**`profiles.love_language`**: `null` → `"Palabras"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"Tal vez"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Principiante"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.politics`**: `null` → `"Moderate right"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Honestidad", "Espiritualidad"]`<br>**`lifestyle.work_style`**: `null` → `"Balanceado"`<br>**`lifestyle.housing_status`**: `null` → `"Vive solo"`<br>**`lifestyle.financial_vibe`**: `null` → `"Sociable"`<br>**`lifestyle.free_time`**: `null` → `"Historia / Filosofía; Arte, museos y teatro; Leer; Fotografía; Terapia y desarrollo personal"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.non_negotiables`**: `null` → `["Mala comunicación", "Mentir", "Ser invasivo o muy encima"]`<br>**`search_preferences.red_flags`**: `null` → `["Mala comunicación", "Mentir", "Ser invasivo o muy encima"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Alto/a", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Natural, Alternativo"`<br>**`search_preferences.preferred_height`**: `null` → `"160 a 184 cm"`<br>**`search_preferences.min_age`**: `null` → `30`<br>**`search_preferences.max_age`**: `null` → `38`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Dos cosas. Primero, que soy una persona que siempre tendrá las conversaciones incómodas desde el amor. Segundo, que suelo demorarme en procesar, pero que siempre me le mido a cualquier aventura."` |
| 752 | `15667` | `4804` | Jcsb1111 (@jcsb1111) | **`profiles.neighborhood`**: `null` → `"Calle 1a sur 31-114"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"` |
| 753 | `15670` | `4819` | Alexfigueroa88 (@Alexfigueroa88) | **`profiles.estatura`**: `null` → `"174 cm"`<br>**`profiles.education`**: `null` → `"Maestría (Universidad Nacional de Colombia)"`<br>**`profiles.religion`**: `null` → `"Católico"`<br>**`profiles.love_language`**: `null` → `"Contacto físico"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"Sí"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Principiante"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`lifestyle.politics`**: `null` → `"Moderate right"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Ambición", "Disciplina"]`<br>**`lifestyle.work_style`**: `null` → `"Productivo"`<br>**`lifestyle.housing_status`**: `null` → `"Vive solo"`<br>**`lifestyle.financial_vibe`**: `null` → `"Sociable"`<br>**`lifestyle.free_time`**: `null` → `"Historia / Filosofía; Cine, películas y series; Astrología; Leer; Deportes y vida fit"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.non_negotiables`**: `null` → `["Falta de respeto", "Vida de fiesta extrema", "No tener ambición", "Mentir", "Falta de iniciativa", "Ser invasivo o muy encima", "Inestabilidad emocional fuerte"]`<br>**`search_preferences.red_flags`**: `null` → `["Falta de respeto", "Vida de fiesta extrema", "No tener ambición", "Mentir", "Falta de iniciativa", "Ser invasivo o muy encima", "Inestabilidad emocional fuerte"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Nerd, Soft girl/boy, Natural, Artístico, Atlético, Corporate, Minimalista"`<br>**`search_preferences.preferred_height`**: `null` → `"153 a 174 cm"`<br>**`search_preferences.min_age`**: `null` → `23`<br>**`search_preferences.max_age`**: `null` → `36`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Me gusta pasar tiempo a solas, para meditar y pensar."` |
| 754 | `15672` | `4774` | R Villabon (@r.villabon) | **`profiles.neighborhood`**: `null` → `"Neiva"`<br>**`profiles.education`**: `null` → `"Fet"`<br>**`lifestyle.values`**: `null` → `["Familia", "Honestidad", "Crecimiento personal"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Estilo, Natural"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Las mentiras"]` |
| 755 | `15677` | `4813` | Gonzal0 I (@gonzal0_i) | **`profiles.education`**: `null` → `"Universidad Nacional"`<br>**`lifestyle.fitness_preferences`**: `null` → `"Gimnasio, Running, Ciclismo, Hiking"`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Que soy un hombre muy enfocado que ayudo mucho a mi mamá económicamente y que me gusta que me demuestren mucho amor"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Me considero que no tengo"]` |
| 756 | `15679` | `4824` | Ngomez G (@ngomez_g) | **`profiles.estatura`**: `null` → `"170 cm"`<br>**`profiles.education`**: `null` → `"Estudiante (Pontificia Universidad Javeriana)"`<br>**`profiles.religion`**: `null` → `"Católico"`<br>**`profiles.love_language`**: `null` → `"Contacto físico"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"Sí"`<br>**`lifestyle.smoker`**: `null` → `"Occasionally"`<br>**`lifestyle.fitness_level`**: `null` → `"Principiante"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.politics`**: `null` → `"Center"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Creatividad", "Honestidad", "Empatía"]`<br>**`lifestyle.work_style`**: `null` → `"Workaholic"`<br>**`lifestyle.housing_status`**: `null` → `"Familia"`<br>**`lifestyle.financial_vibe`**: `null` → `"Sociable"`<br>**`lifestyle.free_time`**: `null` → `"Historia / Filosofía; Arte, museos y teatro; Cine, películas y series; Leer; Fotografía"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer, No binario"`<br>**`search_preferences.non_negotiables`**: `null` → `["Falta de respeto", "Mala comunicación", "Mentir"]`<br>**`search_preferences.red_flags`**: `null` → `["Falta de respeto", "Mala comunicación", "Mentir"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Piel clara", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Natural"`<br>**`search_preferences.preferred_height`**: `null` → `"160 a 170 cm"`<br>**`search_preferences.min_age`**: `null` → `18`<br>**`search_preferences.max_age`**: `null` → `22` |
| 757 | `15703` | `4798` | Cata Cal (@cata_cal) | **`search_preferences.min_age`**: `null` → `30`<br>**`search_preferences.max_age`**: `null` → `40` |
| 758 | `15719` | `4764` | Eljuanvm (@eljuanvm) | **`search_preferences.min_age`**: `null` → `23`<br>**`search_preferences.max_age`**: `null` → `28` |
| 759 | `15721` | `4831` | Carls Feels (@carls.feels) | **`search_preferences.min_age`**: `null` → `22`<br>**`search_preferences.max_age`**: `null` → `36` |
| 760 | `15724` | `4828` | Benjipipe (@benjipipe) | **`profiles.neighborhood`**: `null` → `"Cr 8d # 106 - 70"`<br>**`lifestyle.rumba`**: `null` → `"Moderada"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Las mentiras y la higiene"]` |
| 761 | `15749` | `4346` | Linajc134 (@Linajc134) | **`search_preferences.min_age`**: `null` → `34`<br>**`search_preferences.max_age`**: `null` → `41` |
| 762 | `15755` | `4350` | Dannatorojas (@Dannatorojas) | **`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `31` |
| 763 | `15759` | `4829` | Marceyuma (@marceyuma) | **`search_preferences.min_age`**: `null` → `34`<br>**`search_preferences.max_age`**: `null` → `42` |
| 764 | `15768` | `2614` | Maria Jose Baldovino Ribon | **`lifestyle.body_type`**: `null` → `"Average"` |
| 765 | `15772` | `4348` | Caroasm (@caroasm) | **`search_preferences.preferred_vibe`**: `null` → `"Estilo, Natural"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no le guste viajar , que no sepa lo que quiere"]` |
| 766 | `15787` | `4765` | Juliperezl (@Juliperezl) | **`profiles.neighborhood`**: `null` → `"Santa Bárbara"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Disciplina", "Honestidad"]`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Que tengo un trabajo absorbente, que no quiero hijos, que me quiero casar, que a veces soy obsesiva con el orden y el aseo. Que me gusta que estén pendientes de mí."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Desinterés , frialdad, ghosting"]` |
| 767 | `15792` | `4812` | Davand20 (@davand20) | **`search_preferences.min_age`**: `null` → `24`<br>**`search_preferences.max_age`**: `null` → `32` |
| 768 | `15804` | `4782` | J Zamo 17 (@J.zamo_17) | **`search_preferences.min_age`**: `null` → `23`<br>**`search_preferences.max_age`**: `null` → `35` |
| 769 | `15810` | `4777` | Candes11Candes (@Candes11candes) | **`search_preferences.min_age`**: `null` → `28`<br>**`search_preferences.max_age`**: `null` → `35` |
| 770 | `15813` | `4332` | Fernandaheidy (@Fernandaheidy) | **`profiles.neighborhood`**: `null` → `"Conjunto torres de ipacarai II"` |
| 771 | `15817` | `4814` | Ivanside (@ivanside) | **`profiles.neighborhood`**: `null` → `"Carrera 56 #152b 71"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Hijos,desinterés, Sin superar EX, sin pasado resulto, no estar abierto a tener una relación,"]` |
| 772 | `15823` | `4821` | Luigui21 Cool (@luigui21_cool) | **`search_preferences.min_age`**: `null` → `25`<br>**`search_preferences.max_age`**: `null` → `33` |
| 773 | `15836` | `4342` | Pamelaaguilarp (@pamelaaguilarp) | **`profiles.neighborhood`**: `null` → `"Cedritos"` |
| 774 | `15837` | `4349` | Https://Www Instagram Com/Fredyalberto Hernandezcorredor?Stkn=Mxjznje0Bgx4Cgvjea== (@https://www.instagram.com/fredyalberto.hernandezcorredor?stkn=MXJzNjE0bGx4cGVjeA==) | **`profiles.neighborhood`**: `null` → `"Carrera 68b #75a-17"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Falta de honestidad, doble discurso, o no tener claridad sobre lo que se busca en una relación"]` |
| 775 | `15839` | `4328` | Idamr18 (@idamr18) | **`search_preferences.min_age`**: `null` → `38`<br>**`search_preferences.max_age`**: `null` → `45` |
| 776 | `15848` | `4827` | Ldelaurenth (@ldelaurenth) | **`search_preferences.min_age`**: `null` → `27` |
| 777 | `15851` | `4845` | Cliente CRM #4845 | **`profiles.education`**: `null` → `"Maestría (CESA)"`<br>**`profiles.religion`**: `null` → `"Agnóstico"`<br>**`profiles.love_language`**: `null` → `"Tiempo de calidad"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"No"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Constante (2–3/semana)"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"`<br>**`lifestyle.politics`**: `null` → `"Center"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Estabilidad", "Empatía"]`<br>**`lifestyle.work_style`**: `null` → `"Productivo"`<br>**`lifestyle.housing_status`**: `null` → `"Vive solo"`<br>**`lifestyle.financial_vibe`**: `null` → `"Balanceado"`<br>**`lifestyle.free_time`**: `null` → `"Historia / Filosofía; Cine, películas y series; Leer"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.non_negotiables`**: `null` → `["Falta de respeto", "No tener ambición", "No saber socializar o ser grosero", "Mentir", "Inestabilidad emocional fuerte"]`<br>**`search_preferences.red_flags`**: `null` → `["Falta de respeto", "No tener ambición", "No saber socializar o ser grosero", "Mentir", "Inestabilidad emocional fuerte"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Tatuajes", "Buenas manos", "Dientes lindos", "Bien vestido/a"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Nerd, Natural, Corporate"`<br>**`search_preferences.preferred_height`**: `null` → `"175 a 180 cm"`<br>**`search_preferences.min_age`**: `null` → `37`<br>**`search_preferences.max_age`**: `null` → `45` |
| 778 | `15871` | `4200` | Francy Preciado | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 779 | `15877` | `4327` | Tefagarzon19 (@tefagarzon19) | **`search_preferences.min_age`**: `null` → `25`<br>**`search_preferences.max_age`**: `null` → `30` |
| 780 | `15900` | `4830` | William Ber 21 (@William_ber_21) | **`profiles.estatura`**: `null` → `"177 cm"`<br>**`profiles.education`**: `null` → `"Profesional (Universidad Libre)"`<br>**`profiles.religion`**: `null` → `"Católico"`<br>**`profiles.love_language`**: `null` → `"Tiempo de calidad"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"Sí"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Fitness Lover (4–6/semana)"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Calmo"`<br>**`lifestyle.politics`**: `null` → `"Moderate right"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Ambición", "Honestidad"]`<br>**`lifestyle.work_style`**: `null` → `"Productivo"`<br>**`lifestyle.housing_status`**: `null` → `"Familia"`<br>**`lifestyle.financial_vibe`**: `null` → `"Introvertido"`<br>**`lifestyle.free_time`**: `null` → `"Historia / Filosofía; Cine, películas y series; Leer"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.non_negotiables`**: `null` → `["Falta de respeto", "Vida de fiesta extrema", "Impuntualidad crónica"]`<br>**`search_preferences.red_flags`**: `null` → `["Falta de respeto", "Vida de fiesta extrema", "Impuntualidad crónica"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Deportista"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Artístico"`<br>**`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `30` |
| 781 | `15901` | `3649` | Fabio Rincon | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 782 | `15902` | `4823` | Https://Www Facebook Com/Alejandroillera25 (@https://www.facebook.com/alejandroillera25) | **`profiles.neighborhood`**: `null` → `"Cra. 50a #127c-60"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que sea una persona equilibrada en la medida de lo posible"]` |
| 783 | `15914` | `4339` | Lau C22 (@lau_c22) | **`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `30` |
| 784 | `15920` | `4236` | Maria Paula Almansa Castellar | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 785 | `15924` | `4841` | Alejacarvajalino (@Alejacarvajalino) | **`search_preferences.min_age`**: `null` → `37`<br>**`search_preferences.max_age`**: `null` → `45` |
| 786 | `15936` | `4839` | Https://Www Instagram Com/Nicolascorrales6/ (@https://www.instagram.com/nicolascorrales6/) | **`search_preferences.min_age`**: `null` → `25`<br>**`search_preferences.max_age`**: `null` → `38` |
| 787 | `15947` | `4802` | Anamariac Ag (@anamariac.ag) | **`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `34` |
| 788 | `15949` | `4783` | Alejandroguzmanco (@alejandroguzmanco) | **`search_preferences.min_age`**: `null` → `18`<br>**`search_preferences.max_age`**: `null` → `32` |
| 789 | `15952` | `4054` | Limahu (@limahu) | **`profiles.neighborhood`**: `null` → `"calle"`<br>**`profiles.religion`**: `null` → `"Católico"` |
| 790 | `15953` | `3455` | Maicol Fonseca | **`lifestyle.income_range`**: `null` → `"Entre 1 y 2 SMMLV."` |
| 791 | `15971` | `4818` | H Suescun (@h.suescun) | **`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `33` |
| 792 | `15974` | `3633` | Diego Fabian Castrillón Segura | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 793 | `15985` | `4296` | Cristian Geovanny Rodriguez Montaña | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."` |
| 794 | `15987` | `3562` | Juan Sebastian Alzate Zuluaga | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 795 | `15995` | `4790` | Nathaliacmrgo (@Nathaliacmrgo) | **`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `40` |
| 796 | `16003` | `3536` | María Fernanda Diaz | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 797 | `16027` | `4326` | No Tengo (@No tengo) | **`profiles.neighborhood`**: `null` → `"Carrera 58 #125b-78"`<br>**`lifestyle.fitness_level`**: `null` → `"Fitness Lover (4–6/semana)"`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 165 cm"` |
| 798 | `16032` | `3346` | Nicolás Rodríguez | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 799 | `16048` | `4844` | Karenariasv (@karenariasv) | **`search_preferences.min_age`**: `null` → `29`<br>**`search_preferences.max_age`**: `null` → `40` |
| 800 | `16051` | `4847` | O O Paula Polo (@o.o_paula_polo) | **`search_preferences.min_age`**: `null` → `30`<br>**`search_preferences.max_age`**: `null` → `35` |
| 801 | `16057` | `4334` | Cristian Cardenas7 (@Cristian.cardenas7) | **`search_preferences.min_age`**: `null` → `20`<br>**`search_preferences.max_age`**: `null` → `26` |
| 802 | `16060` | `4816` | Juanitagaitan (@Juanitagaitan_) | **`profiles.estatura`**: `null` → `"168 cm"`<br>**`profiles.education`**: `null` → `"Maestría (Universidad del Rosario)"`<br>**`profiles.religion`**: `null` → `"Católico"`<br>**`profiles.love_language`**: `null` → `"Actos de servicio"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.wants_children`**: `null` → `"Tal vez"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Constante (2–3/semana)"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Alta energía"`<br>**`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`lifestyle.politics`**: `null` → `"Moderate right"`<br>**`lifestyle.values`**: `null` → `["Lealtad", "Ambición", "Empatía"]`<br>**`lifestyle.work_style`**: `null` → `"Productivo"`<br>**`lifestyle.housing_status`**: `null` → `"Familia"`<br>**`lifestyle.financial_vibe`**: `null` → `"Sociable"`<br>**`lifestyle.free_time`**: `null` → `"Cine, películas y series; Leer; Pintar, dibujar, manualidades; Deportes y vida fit; Ver deportes"`<br>**`search_preferences.preferred_gender`**: `null` → `"Hombre"`<br>**`search_preferences.non_negotiables`**: `null` → `["Falta de respeto", "Mentir", "Ser conflictivo o dramático"]`<br>**`search_preferences.red_flags`**: `null` → `["Falta de respeto", "Mentir", "Ser conflictivo o dramático"]`<br>**`search_preferences.preferred_looks`**: `null` → `["Alto/a", "Barba", "Buenas manos", "Dientes lindos"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Nerd, Natural, Corporate"`<br>**`search_preferences.preferred_height`**: `null` → `"175 a 190 cm"`<br>**`search_preferences.min_age`**: `null` → `30`<br>**`search_preferences.max_age`**: `null` → `45` |
| 803 | `16070` | `4330` | Hugoparraola (@hugoparraola) | **`lifestyle.values`**: `null` → `["Lealtad", "Independencia", "Aventura"]`<br>**`search_preferences.preferred_vibe`**: `null` → `"Cute, Natural, Corporate"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Relación con sus ex"]` |
| 804 | `16089` | `4785` | Lula O (@lula_o_) | **`search_preferences.min_age`**: `null` → `38`<br>**`search_preferences.max_age`**: `null` → `43` |
| 805 | `16093` | `4092` | Susana Ramírez | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."` |
| 806 | `16095` | `4103` | Antonella Gaffurri | **`lifestyle.income_range`**: `null` → `"Entre 8 y 12 SMMLV."`<br>**`search_preferences.preferred_height`**: `null` → `"Desde 168 cm"` |
| 807 | `16104` | `4807` | Juanmorati (@juanmorati) | **`profiles.estatura`**: `null` → `"181 cm"`<br>**`profiles.education`**: `null` → `"Profesional"`<br>**`profiles.religion`**: `null` → `"Agnóstico"`<br>**`profiles.love_language`**: `null` → `"Tiempo de calidad"`<br>**`lifestyle.has_children`**: `null` → `"No"`<br>**`lifestyle.smoker`**: `null` → `"No"`<br>**`lifestyle.fitness_level`**: `null` → `"Fitness Lover (4–6/semana)"`<br>**`lifestyle.ideal_weekend`**: `null` → `"Balanceado"`<br>**`lifestyle.temperament`**: `null` → `"Fuerte"`<br>**`lifestyle.housing_status`**: `null` → `"Vive solo"`<br>**`lifestyle.financial_vibe`**: `null` → `"Sociable"`<br>**`lifestyle.free_time`**: `null` → `"Deportes y vida fit; Viaje en moto, futbol, muay Thai"`<br>**`search_preferences.preferred_gender`**: `null` → `"Mujer"`<br>**`search_preferences.preferred_looks`**: `null` → `["Delgado/a", "Alto/a"]`<br>**`search_preferences.preferred_height`**: `null` → `"160 a 180 cm"`<br>**`search_preferences.min_age`**: `null` → `21`<br>**`search_preferences.max_age`**: `null` → `35`<br>**`search_preferences.what_searches_in_partner`**: `null` → `"Humor"` |
| 808 | `16112` | `3313` | Ana Maria Pachon | **`lifestyle.income_range`**: `null` → `"Entre 3 y 5 SMMLV."` |
| 809 | `16113` | `4811` | Juan Posada 98 (@juan_posada_98) | **`search_preferences.min_age`**: `null` → `22`<br>**`search_preferences.max_age`**: `null` → `32` |
| 810 | `16123` | `3651` | JOSE EDUARDO HERNANDEZ  BUSTAMANTE | **`lifestyle.ideal_weekend`**: `null` → `"High energy"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.personal_red_flags`**: `null` → `["Talking too much or overwhelming communication"]` |
| 811 | `16129` | `4815` | Moisesroh (@moisesroh) | **`search_preferences.max_age`**: `null` → `40` |
| 812 | `16177` | `4817` | Dominiquekhalil (@dominiquekhalil) | **`search_preferences.min_age`**: `null` → `30`<br>**`search_preferences.max_age`**: `null` → `40` |
| 813 | `16184` | `3514` | Camilo Humberto Prieto Fetiva | **`lifestyle.income_range`**: `null` → `"Entre 5 y 8 SMMLV."` |
| 814 | `16186` | `4784` | Piacottrino (@piacottrino) | **`profiles.neighborhood`**: `null` → `"Santa Barbara"`<br>**`lifestyle.wants_children`**: `null` → `"Sí"`<br>**`lifestyle.temperament`**: `null` → `"Equilibrado"` |
| 815 | `16197` | `4789` | Lmguzmang (@lmguzmang) | **`profiles.neighborhood`**: `null` → `"Los monjes"`<br>**`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Impuntualidad Cambio de planes a último momento Que huela mal que no haga nada de actividad fisica que no le guste viajar"]` |
| 816 | `16199` | `3656` | Cliente CRM #3656 | **`search_preferences.min_age`**: `null` → `27`<br>**`search_preferences.max_age`**: `null` → `33` |
| 817 | `16201` | `4833` | Hernando  31 (@hernando _31) | **`profiles.neighborhood`**: `null` → `"Villas de Granada"`<br>**`search_preferences.partner_red_flags`**: `null` → `["Buscar profundidad donde quizá solo hay incompatibilidad, exigirme mucho a mi mismo."]` |
| 818 | `16202` | `2565` | Luz Marina Toro Toro | **`lifestyle.income_range`**: `null` → `"Entre 2 y 3 SMMLV."`<br>**`search_preferences.partner_red_flags`**: `null` → `["Que no quiera compromiso, que incumpla acuerdos, que se desaparezca por horas"]` |
