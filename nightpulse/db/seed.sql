-- ═══════════════════════════════════════════════════════════════
-- NightPulse AI — Demo Seed Data
-- Datos simulados de 5 marcas de Grupo Evedesa
-- ═══════════════════════════════════════════════════════════════

-- ─── BRANDS ───────────────────────────────────────────────────
INSERT INTO brands (name, slug, genre, accent_color, city, capacity, description) VALUES
('Matildelina', 'matildelina', 'Vallenato Premium', '#D4A574', 'Bogotá', 600, 'Vallenato y música tropical en ambiente premium. Referente del entretenimiento con identidad colombiana.'),
('Furia', 'furia', 'Electrónica', '#DC2626', 'Bogotá', 800, 'Club de música electrónica y techno. Experiencia inmersiva con producción de clase mundial.'),
('Casa D', 'casa-d', 'Crossover', '#2563EB', 'Bogotá', 550, 'Crossover elegante con los mejores DJs del momento. En expansión a Cartagena, Cali, Medellín y Barranquilla.'),
('África', 'africa', 'Afrobeat / Tropical', '#16A34A', 'Bogotá', 450, 'Afrobeat, dancehall y música tropical. La vibra más internacional de Bogotá.'),
('Gyal', 'gyal', 'Reggaetón', '#EC4899', 'Bogotá', 700, 'Club de reggaetón. La fiesta urbana más grande de la ciudad.');

-- ─── VENUES ───────────────────────────────────────────────────
INSERT INTO venues (brand_id, name, address, city, capacity, num_bars) VALUES
(1, 'Matildelina Bogotá', 'Zona T, Cra 12 #83-71', 'Bogotá', 600, 3),
(2, 'Furia Bogotá', 'Zona T, Cra 13 #82-40', 'Bogotá', 800, 4),
(2, 'Furia Miami', '1234 Collins Ave, Miami Beach', 'Miami', 500, 3),
(3, 'Casa D Bogotá', 'Zona T, Cra 12 #83-12', 'Bogotá', 550, 3),
(3, 'Casa D Cartagena', 'Centro Histórico, Cl 36 #3-80', 'Cartagena', 400, 2),
(4, 'África Bogotá', 'Zona T, Cra 14 #82-16', 'Bogotá', 450, 2),
(5, 'Gyal Bogotá', 'Zona T, Cra 13 #82-58', 'Bogotá', 700, 4);

-- ─── PRODUCT CATEGORIES ──────────────────────────────────────
INSERT INTO product_categories (name, type) VALUES
('Whisky', 'licor'),
('Vodka', 'licor'),
('Ron', 'licor'),
('Ginebra', 'licor'),
('Tequila', 'licor'),
('Champagne', 'licor'),
('Cerveza', 'cerveza'),
('Cocteles', 'coctel'),
('Aguardiente', 'licor'),
('Agua/Gaseosas', 'sin_alcohol');

-- ─── PRODUCTS ─────────────────────────────────────────────────
INSERT INTO products (category_id, name, sku, unit, cost_price, sell_price, ml_per_unit, ml_per_serve) VALUES
-- Whisky
(1, 'Buchanan''s 12 Años', 'WHI-BUCH12', 'botella', 180000, 450000, 750, 45),
(1, 'Johnnie Walker Black', 'WHI-JWBLK', 'botella', 150000, 380000, 750, 45),
(1, 'Johnnie Walker Blue', 'WHI-JWBLU', 'botella', 850000, 1800000, 750, 45),
(1, 'Old Parr 12 Años', 'WHI-OLDP12', 'botella', 120000, 320000, 750, 45),
(1, 'Chivas Regal 12', 'WHI-CHIV12', 'botella', 140000, 350000, 750, 45),
-- Vodka
(2, 'Absolut Original', 'VOD-ABSOL', 'botella', 65000, 180000, 750, 45),
(2, 'Grey Goose', 'VOD-GRGOO', 'botella', 180000, 420000, 750, 45),
(2, 'Belvedere', 'VOD-BELVE', 'botella', 200000, 480000, 750, 45),
-- Ron
(3, 'Ron Medellín 8 Años', 'RON-MED8', 'botella', 45000, 150000, 750, 45),
(3, 'Havana Club 7', 'RON-HAV7', 'botella', 85000, 220000, 750, 45),
(3, 'Ron Zacapa 23', 'RON-ZAC23', 'botella', 250000, 550000, 750, 45),
-- Ginebra
(4, 'Hendrick''s', 'GIN-HENDR', 'botella', 160000, 380000, 750, 45),
(4, 'Tanqueray', 'GIN-TANQU', 'botella', 80000, 220000, 750, 45),
-- Tequila
(5, 'Don Julio Reposado', 'TEQ-DJREP', 'botella', 200000, 450000, 750, 45),
(5, 'Patrón Silver', 'TEQ-PATSI', 'botella', 220000, 500000, 750, 45),
-- Champagne
(6, 'Moët & Chandon', 'CHP-MOET', 'botella', 280000, 650000, 750, 120),
(6, 'Veuve Clicquot', 'CHP-VEUV', 'botella', 350000, 800000, 750, 120),
-- Cerveza
(7, 'Club Colombia Dorada', 'CRV-CLUBD', 'unidad', 3500, 12000, 330, 330),
(7, 'Corona Extra', 'CRV-CORON', 'unidad', 4000, 15000, 355, 355),
(7, 'Heineken', 'CRV-HEINK', 'unidad', 4500, 16000, 330, 330),
-- Aguardiente
(9, 'Aguardiente Antioqueño', 'AGU-ANTIO', 'botella', 35000, 120000, 750, 45),
(9, 'Aguardiente Nectar', 'AGU-NECT', 'botella', 32000, 110000, 750, 45),
-- Sin Alcohol
(10, 'Agua Sin Gas', 'SIN-AGUA', 'unidad', 1000, 8000, 600, 600),
(10, 'Red Bull', 'SIN-REDB', 'unidad', 5000, 18000, 250, 250);

-- ─── INVENTORY (Stock actual por venue/barra) ─────────────────
-- Matildelina Bogotá
INSERT INTO inventory (venue_id, product_id, bar_number, stock_bottles, min_stock) VALUES
(1, 1, 1, 12, 5), (1, 1, 2, 8, 4), (1, 1, 3, 6, 3),
(1, 2, 1, 10, 4), (1, 4, 1, 15, 5), (1, 5, 1, 8, 3),
(1, 6, 1, 6, 3), (1, 9, 1, 20, 8), (1, 10, 1, 12, 4),
(1, 12, 1, 4, 2), (1, 21, 1, 30, 10), (1, 22, 1, 25, 10);

-- Furia Bogotá
INSERT INTO inventory (venue_id, product_id, bar_number, stock_bottles, min_stock) VALUES
(2, 6, 1, 20, 8), (2, 6, 2, 15, 6), (2, 6, 3, 12, 5), (2, 6, 4, 10, 5),
(2, 7, 1, 8, 3), (2, 8, 1, 6, 2),
(2, 12, 1, 10, 4), (2, 12, 2, 8, 3),
(2, 24, 1, 50, 20), (2, 24, 2, 40, 15);

-- Gyal Bogotá
INSERT INTO inventory (venue_id, product_id, bar_number, stock_bottles, min_stock) VALUES
(7, 1, 1, 18, 8), (7, 1, 2, 14, 6),
(7, 6, 1, 12, 5), (7, 14, 1, 10, 4), (7, 15, 1, 8, 3),
(7, 21, 1, 40, 15), (7, 22, 1, 35, 12),
(7, 24, 1, 60, 25);

-- ─── NIGHTLY SALES (Últimas 2 semanas) ────────────────────────
-- Viernes 11 de julio 2025 — Matildelina
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(1, '2025-07-11', 1, 8, 3600000, 'Carlos M.', 1, 22),
(1, '2025-07-11', 1, 6, 2700000, 'María P.', 2, 23),
(1, '2025-07-11', 4, 5, 1600000, 'Carlos M.', 1, 23),
(1, '2025-07-11', 9, 12, 1800000, 'Andrea L.', 3, 22),
(1, '2025-07-11', 21, 45, 5400000, 'Carlos M.', 1, 0),
(1, '2025-07-11', 22, 38, 4180000, 'María P.', 2, 1),
(1, '2025-07-11', 24, 80, 1440000, 'Andrea L.', 3, 23);

-- Sábado 12 de julio 2025 — Matildelina (noche con artista)
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(1, '2025-07-12', 1, 15, 6750000, 'Carlos M.', 1, 22),
(1, '2025-07-12', 1, 12, 5400000, 'María P.', 2, 23),
(1, '2025-07-12', 2, 8, 3040000, 'Carlos M.', 1, 0),
(1, '2025-07-12', 3, 3, 5400000, 'María P.', 2, 1),
(1, '2025-07-12', 4, 10, 3200000, 'Andrea L.', 3, 23),
(1, '2025-07-12', 9, 18, 2700000, 'Carlos M.', 1, 22),
(1, '2025-07-12', 16, 4, 2600000, 'María P.', 2, 0),
(1, '2025-07-12', 21, 70, 8400000, 'Andrea L.', 3, 23),
(1, '2025-07-12', 22, 55, 6050000, 'Carlos M.', 1, 1),
(1, '2025-07-12', 24, 120, 2160000, 'María P.', 2, 0);

-- Viernes 11 — Furia
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(2, '2025-07-11', 6, 25, 4500000, 'Diego R.', 1, 23),
(2, '2025-07-11', 6, 18, 3240000, 'Luisa V.', 2, 0),
(2, '2025-07-11', 7, 6, 2520000, 'Diego R.', 1, 1),
(2, '2025-07-11', 12, 8, 3040000, 'Camila S.', 3, 23),
(2, '2025-07-11', 24, 150, 2700000, 'Luisa V.', 2, 0);

-- Sábado 12 — Furia
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(2, '2025-07-12', 6, 35, 6300000, 'Diego R.', 1, 22),
(2, '2025-07-12', 6, 28, 5040000, 'Luisa V.', 2, 23),
(2, '2025-07-12', 7, 10, 4200000, 'Diego R.', 1, 0),
(2, '2025-07-12', 8, 5, 2400000, 'Camila S.', 3, 1),
(2, '2025-07-12', 12, 12, 4560000, 'Diego R.', 1, 23),
(2, '2025-07-12', 24, 200, 3600000, 'Luisa V.', 2, 0);

-- Sábado 12 — Gyal
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(7, '2025-07-12', 1, 20, 9000000, 'Andrés G.', 1, 22),
(7, '2025-07-12', 1, 16, 7200000, 'Valentina R.', 2, 23),
(7, '2025-07-12', 14, 8, 3600000, 'Andrés G.', 1, 0),
(7, '2025-07-12', 15, 6, 3000000, 'Valentina R.', 2, 1),
(7, '2025-07-12', 21, 80, 9600000, 'Andrés G.', 1, 23),
(7, '2025-07-12', 22, 60, 6600000, 'Valentina R.', 2, 0),
(7, '2025-07-12', 24, 180, 3240000, 'Andrés G.', 1, 22);

-- Sábado 12 — Casa D
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(4, '2025-07-12', 1, 10, 4500000, 'Felipe A.', 1, 22),
(4, '2025-07-12', 2, 8, 3040000, 'Laura M.', 2, 23),
(4, '2025-07-12', 7, 4, 1680000, 'Felipe A.', 1, 0),
(4, '2025-07-12', 11, 3, 1650000, 'Laura M.', 2, 1),
(4, '2025-07-12', 16, 2, 1300000, 'Felipe A.', 1, 23),
(4, '2025-07-12', 18, 30, 360000, 'Laura M.', 2, 22);

-- Sábado 12 — África
INSERT INTO nightly_sales (venue_id, sale_date, product_id, quantity_sold, revenue, bartender_name, bar_number, hour_sold) VALUES
(6, '2025-07-12', 10, 6, 1320000, 'Sebastián D.', 1, 22),
(6, '2025-07-12', 9, 8, 1200000, 'Natalia C.', 2, 23),
(6, '2025-07-12', 6, 10, 1800000, 'Sebastián D.', 1, 0),
(6, '2025-07-12', 14, 5, 2250000, 'Natalia C.', 2, 1),
(6, '2025-07-12', 18, 40, 480000, 'Sebastián D.', 1, 22);

-- ─── CASH REGISTERS ──────────────────────────────────────────
INSERT INTO cash_registers (venue_id, register_date, cash_total, card_total, nequi_total, rappi_total, cover_total, pos_total, discrepancy, void_count, discount_count, courtesy_count, status, anomaly_score, ai_notes) VALUES
-- Viernes 11 julio
(1, '2025-07-11', 8500000, 7200000, 2100000, 800000, 3500000, 21720000, -380000, 3, 5, 2, 'reviewed', 25, 'Descuadre menor de $380K. 3 anulaciones en rango normal. 2 cortesías autorizadas por gerente.'),
(2, '2025-07-11', 6000000, 8500000, 1800000, 500000, 4200000, 16000000, -1200000, 8, 12, 5, 'flagged', 72, '⚠️ Descuadre significativo de $1.2M. 8 anulaciones — 5 del bartender Diego R. entre 1am-3am. 12 descuentos sin autorización detectados. Requiere revisión urgente.'),
(7, '2025-07-11', 12000000, 15000000, 4500000, 1200000, 6000000, 42240000, 540000, 2, 3, 1, 'approved', 8, 'Cierre limpio. Sobrante de $540K posiblemente por propinas no separadas. KPIs excelentes.'),
-- Sábado 12 julio
(1, '2025-07-12', 15000000, 18000000, 5500000, 2000000, 5500000, 45700000, -250000, 2, 4, 3, 'approved', 12, 'Noche de artista Carlos Vives. Ventas 87% superiores al promedio de sábados. Descuadre mínimo de $250K dentro del rango aceptable.'),
(2, '2025-07-12', 10000000, 14000000, 3200000, 1500000, 6500000, 26100000, -800000, 5, 8, 4, 'reviewed', 45, 'Descuadre de $800K. 5 anulaciones, 2 de ellas por valor superior a $500K. Patrón inusual en barra 3.'),
(4, '2025-07-12', 5000000, 6500000, 1800000, 600000, 2500000, 12530000, -130000, 1, 2, 1, 'approved', 5, 'Cierre perfecto. Casa D mantiene su consistencia operativa.'),
(6, '2025-07-12', 3500000, 4200000, 1200000, 400000, 1800000, 7050000, -150000, 2, 1, 0, 'approved', 10, 'Operación estable. Descuadre menor dentro de tolerancia.'),
(7, '2025-07-12', 18000000, 22000000, 6500000, 2500000, 8000000, 42240000, -2100000, 12, 18, 8, 'flagged', 85, '🚨 ALERTA CRÍTICA: Descuadre de $2.1M. 12 anulaciones — concentradas en mesero ID 142 entre 11pm-1am. 18 descuentos sin autorización. 8 cortesías exceden límite. Posible fraude interno.');

-- ─── CASH ANOMALIES ──────────────────────────────────────────
INSERT INTO cash_anomalies (register_id, type, severity, amount, description, employee_name) VALUES
(2, 'void_excess', 'high', 850000, '5 anulaciones consecutivas entre 1:00am y 3:00am en la misma terminal', 'Diego R.'),
(2, 'discount_unauthorized', 'medium', 350000, '12 descuentos aplicados sin código de autorización de gerente', 'Diego R.'),
(5, 'void_excess', 'medium', 520000, '2 anulaciones de valor superior a $500K — patrón inusual para barra 3', 'Camila S.'),
(8, 'void_excess', 'critical', 1200000, '8 anulaciones concentradas en 2 horas. Patrón consistente con robo hormiga.', 'Mesero #142'),
(8, 'discount_unauthorized', 'high', 650000, '18 descuentos sin autorización — 10 en la última hora de operación', 'Varios'),
(8, 'courtesy_over_limit', 'high', 480000, '8 cortesías de botella — política permite máximo 3 por noche', 'Mesero #142');

-- ─── EMPLOYEES ────────────────────────────────────────────────
INSERT INTO employees (full_name, document_id, role, phone, hourly_rate, is_permanent, hired_at) VALUES
('Carlos Martínez', '1020345678', 'bartender', '3001234567', 25000, TRUE, '2023-03-15'),
('María Pérez', '1020345679', 'bartender', '3001234568', 25000, TRUE, '2023-06-01'),
('Andrea López', '1020345680', 'bartender', '3001234569', 22000, TRUE, '2024-01-10'),
('Diego Ramírez', '1020345681', 'bartender', '3001234570', 25000, TRUE, '2022-11-20'),
('Luisa Vargas', '1020345682', 'bartender', '3001234571', 23000, TRUE, '2024-03-05'),
('Camila Sánchez', '1020345683', 'bartender', '3001234572', 22000, TRUE, '2024-06-15'),
('Andrés González', '1020345684', 'bartender', '3001234573', 25000, TRUE, '2023-01-20'),
('Valentina Ríos', '1020345685', 'bartender', '3001234574', 24000, TRUE, '2023-09-01'),
('Felipe Arango', '1020345686', 'bartender', '3001234575', 23000, TRUE, '2024-02-15'),
('Laura Muñoz', '1020345687', 'bartender', '3001234576', 22000, TRUE, '2024-04-01'),
('Sebastián Díaz', '1020345688', 'bartender', '3001234577', 23000, TRUE, '2023-08-10'),
('Natalia Castro', '1020345689', 'bartender', '3001234578', 22000, TRUE, '2024-05-20'),
('Juan Pablo Torres', '1020345690', 'mesero', '3001234579', 18000, TRUE, '2023-04-01'),
('Daniela Herrera', '1020345691', 'mesero', '3001234580', 18000, TRUE, '2023-07-15'),
('Santiago Ospina', '1020345692', 'seguridad', '3001234581', 20000, TRUE, '2022-06-01'),
('Alejandro Ruiz', '1020345693', 'gerente', '3001234582', 45000, TRUE, '2021-01-15'),
('Paola Mendoza', '1020345694', 'anfitrion', '3001234583', 20000, TRUE, '2023-10-01'),
('Ricardo Gómez', '1020345695', 'dj', '3001234584', 80000, FALSE, '2024-01-01'),
('Temporal Mesero 1', '1020345696', 'mesero', '3001234585', 16000, FALSE, '2025-06-01'),
('Temporal Mesero 2', '1020345697', 'mesero', '3001234586', 16000, FALSE, '2025-06-15');

-- ─── EMPLOYEE VENUE ASSIGNMENTS ──────────────────────────────
INSERT INTO employee_venues (employee_id, venue_id, is_primary) VALUES
(1, 1, TRUE), (2, 1, TRUE), (3, 1, TRUE),          -- Matildelina
(4, 2, TRUE), (5, 2, TRUE), (6, 2, TRUE),          -- Furia
(7, 7, TRUE), (8, 7, TRUE),                         -- Gyal
(9, 4, TRUE), (10, 4, TRUE),                        -- Casa D
(11, 6, TRUE), (12, 6, TRUE),                       -- África
(13, 1, TRUE), (14, 7, TRUE),                       -- Meseros
(15, 2, TRUE),                                       -- Seguridad
(16, 1, TRUE);                                       -- Gerente

-- ─── SHIFTS (Sábado 12 julio) ────────────────────────────────
INSERT INTO shifts (employee_id, venue_id, shift_date, start_time, end_time, is_night, is_sunday, hours_worked, base_pay, surcharges, total_pay, status) VALUES
(1, 1, '2025-07-12', '20:00', '04:00', TRUE, TRUE, 8, 200000, 210000, 410000, 'completed'),
(2, 1, '2025-07-12', '20:00', '04:00', TRUE, TRUE, 8, 200000, 210000, 410000, 'completed'),
(3, 1, '2025-07-12', '21:00', '04:00', TRUE, TRUE, 7, 154000, 161700, 315700, 'completed'),
(4, 2, '2025-07-12', '21:00', '05:00', TRUE, TRUE, 8, 200000, 210000, 410000, 'completed'),
(5, 2, '2025-07-12', '21:00', '05:00', TRUE, TRUE, 8, 184000, 193200, 377200, 'completed'),
(6, 2, '2025-07-12', '22:00', '05:00', TRUE, TRUE, 7, 154000, 161700, 315700, 'completed'),
(7, 7, '2025-07-12', '20:00', '04:00', TRUE, TRUE, 8, 200000, 210000, 410000, 'completed'),
(8, 7, '2025-07-12', '20:00', '04:00', TRUE, TRUE, 8, 192000, 201600, 393600, 'completed'),
(9, 4, '2025-07-12', '21:00', '04:00', TRUE, TRUE, 7, 161000, 168000, 329000, 'completed'),
(10, 4, '2025-07-12', '21:00', '04:00', TRUE, TRUE, 7, 154000, 161700, 315700, 'completed'),
(13, 1, '2025-07-12', '20:00', '04:00', TRUE, TRUE, 8, 144000, 151200, 295200, 'completed'),
(14, 7, '2025-07-12', '20:00', '04:00', TRUE, TRUE, 8, 144000, 151200, 295200, 'completed'),
(15, 2, '2025-07-12', '19:00', '05:00', TRUE, TRUE, 10, 200000, 210000, 410000, 'completed'),
(19, 1, '2025-07-12', '21:00', '03:00', TRUE, TRUE, 6, 96000, 100800, 196800, 'completed'),
(20, 7, '2025-07-12', '21:00', '03:00', TRUE, TRUE, 6, 96000, 100800, 196800, 'completed');

-- ─── CUSTOMERS (CRM) ─────────────────────────────────────────
INSERT INTO customers (full_name, phone, email, instagram, birth_date, vip_tier, total_visits, total_spend, preferred_drink, no_show_score) VALUES
('Alejandra Martínez', '3101234567', 'ale.mtz@gmail.com', '@alemtz_', '1995-03-15', 'platinum', 48, 28500000, 'Moët & Chandon', 5),
('Sebastián Torres', '3101234568', 'seb.torres@gmail.com', '@sebtorres', '1993-08-22', 'gold', 35, 18200000, 'Buchanan''s 12', 12),
('Valentina Duque', '3101234569', 'val.duque@outlook.com', '@valduque', '1997-11-05', 'gold', 28, 14800000, 'Grey Goose', 8),
('Daniel Mejía', '3101234570', 'dan.mejia@gmail.com', '@danmejia', '1994-06-18', 'silver', 22, 9500000, 'Don Julio', 25),
('Carolina Ospina', '3101234571', 'caro.osp@gmail.com', '@caroospina', '1996-01-30', 'platinum', 52, 32000000, 'Veuve Clicquot', 3),
('Andrés Restrepo', '3101234572', 'andres.r@gmail.com', '@andresrpo', '1992-12-10', 'silver', 18, 7200000, 'Johnnie Walker Black', 18),
('Mariana Gómez', '3101234573', 'mari.gomez@gmail.com', '@marigomez', '1998-04-25', 'gold', 30, 16500000, 'Hendrick''s', 10),
('Felipe Herrera', '3101234574', 'feli.herr@gmail.com', '@feliherrera', '1991-09-08', 'regular', 12, 4800000, 'Ron Medellín', 35),
('Isabella López', '3101234575', 'isa.lopez@gmail.com', '@isalopez', '1999-07-14', 'silver', 20, 8900000, 'Absolut', 15),
('Nicolás Arango', '3101234576', 'nico.arango@gmail.com', '@nicoarango', '1990-02-28', 'platinum', 60, 42000000, 'Johnnie Walker Blue', 2);

-- ─── CUSTOMER BRAND VISITS ───────────────────────────────────
INSERT INTO customer_brand_visits (customer_id, brand_id, visit_count, last_visit, avg_spend) VALUES
(1, 5, 20, '2025-07-12', 650000), (1, 4, 15, '2025-07-05', 480000), (1, 1, 13, '2025-06-28', 520000),
(2, 1, 18, '2025-07-12', 520000), (2, 3, 12, '2025-07-05', 450000), (2, 5, 5, '2025-06-21', 380000),
(3, 2, 15, '2025-07-12', 580000), (3, 5, 8, '2025-07-05', 420000), (3, 4, 5, '2025-06-14', 350000),
(4, 5, 12, '2025-07-12', 430000), (4, 1, 6, '2025-06-28', 380000), (4, 3, 4, '2025-06-07', 350000),
(5, 1, 22, '2025-07-12', 615000), (5, 3, 18, '2025-07-05', 580000), (5, 2, 12, '2025-06-28', 520000),
(6, 3, 10, '2025-07-05', 400000), (6, 1, 5, '2025-06-21', 350000), (6, 4, 3, '2025-06-07', 380000),
(7, 2, 15, '2025-07-12', 550000), (7, 4, 10, '2025-07-05', 480000), (7, 5, 5, '2025-06-14', 420000),
(8, 1, 8, '2025-06-28', 400000), (8, 4, 4, '2025-06-14', 350000),
(9, 5, 12, '2025-07-12', 445000), (9, 2, 5, '2025-06-28', 380000), (9, 3, 3, '2025-06-07', 350000),
(10, 1, 25, '2025-07-12', 700000), (10, 3, 20, '2025-07-05', 650000), (10, 2, 15, '2025-06-28', 680000);

-- ─── RESERVATIONS ─────────────────────────────────────────────
INSERT INTO reservations (customer_id, venue_id, reservation_date, party_size, type, status, bottle_package, estimated_spend, deposit_paid, special_notes) VALUES
(1, 7, '2025-07-19', 8, 'vip', 'confirmed', '2x Moët + 1x Grey Goose', 2800000, 500000, 'Mesa cerca de la tarima. Cumpleaños de amiga.'),
(5, 1, '2025-07-19', 6, 'bottle_service', 'confirmed', '1x Johnnie Walker Blue + 1x Veuve Clicquot', 3200000, 800000, 'Cliente platinum. Atención prioritaria.'),
(10, 4, '2025-07-19', 10, 'vip', 'confirmed', '3x Buchanan''s + 2x Don Julio', 4500000, 1000000, 'Reserva corporativa. Necesita recibo.'),
(3, 2, '2025-07-19', 4, 'table', 'pending', NULL, 800000, 0, NULL),
(4, 5, '2025-07-19', 6, 'vip', 'pending', '1x Buchanan''s', 900000, 0, 'Posible no-show — scoring alto.'),
(7, 6, '2025-07-19', 5, 'table', 'confirmed', NULL, 650000, 100000, NULL),
(2, 1, '2025-07-26', 8, 'birthday', 'pending', '2x Buchanan''s + 1x Moët + Torta', 2200000, 0, 'Cumpleaños 32. Decoración especial solicitada.'),
(9, 7, '2025-07-26', 4, 'table', 'confirmed', NULL, 500000, 100000, NULL);

-- ─── EVENTS ───────────────────────────────────────────────────
INSERT INTO events (venue_id, name, event_date, artist_name, artist_cost, cover_price, expected_attendance, actual_attendance, total_revenue, total_cost, roi_percentage, status) VALUES
(1, 'Noche de Vallenato Premium', '2025-07-12', 'Silvestre Dangond', 35000000, 80000, 550, 580, 45700000, 42000000, 8.8, 'completed'),
(2, 'Furia Electronic Night', '2025-07-12', 'DJ Koze', 25000000, 60000, 700, 720, 26100000, 30000000, -13.0, 'completed'),
(7, 'Gyal Reggaetón Fest', '2025-07-12', 'Ryan Castro', 40000000, 70000, 650, 680, 42240000, 48000000, -12.0, 'completed'),
(4, 'Casa D Saturday', '2025-07-12', NULL, 0, 40000, 400, 380, 12530000, 8000000, 56.6, 'completed'),
(6, 'África Tropical Night', '2025-07-12', 'Grupo Niche', 20000000, 50000, 350, 320, 7050000, 25000000, -71.8, 'completed'),
(1, 'Matildelina Viernes Gold', '2025-07-18', NULL, 0, 50000, 400, NULL, NULL, NULL, NULL, 'scheduled'),
(2, 'Furia x Afterlife', '2025-07-19', 'Tale of Us', 80000000, 120000, 800, NULL, NULL, NULL, NULL, 'scheduled'),
(7, 'Gyal x Bad Bunny Night', '2025-07-19', NULL, 0, 60000, 600, NULL, NULL, NULL, NULL, 'scheduled');

-- ─── COMPLIANCE ITEMS ────────────────────────────────────────
INSERT INTO compliance_items (venue_id, category, item_name, due_date, status, responsible) VALUES
-- Matildelina
(1, 'DIAN', 'Facturación electrónica - Resolución vigente', '2025-12-31', 'completed', 'Contabilidad'),
(1, 'DIAN', 'Declaración IVA bimestral', '2025-07-15', 'pending', 'Contabilidad'),
(1, 'Sayco-Acinpro', 'Licencia de derechos de autor musical', '2025-09-30', 'completed', 'Jurídico'),
(1, 'Bomberos', 'Certificado técnico de seguridad', '2025-08-15', 'pending', 'Operaciones'),
(1, 'Aforo', 'Certificación de capacidad máxima', '2026-01-31', 'completed', 'Operaciones'),
(1, 'Ley Seca', 'Protocolo para elecciones - Oct 2025', '2025-10-25', 'pending', 'Gerencia'),
-- Furia
(2, 'DIAN', 'Facturación electrónica - Resolución vigente', '2025-12-31', 'completed', 'Contabilidad'),
(2, 'DIAN', 'Declaración IVA bimestral', '2025-07-15', 'overdue', 'Contabilidad'),
(2, 'Sayco-Acinpro', 'Licencia de derechos de autor musical', '2025-07-30', 'pending', 'Jurídico'),
(2, 'Bomberos', 'Certificado técnico de seguridad', '2025-08-15', 'pending', 'Operaciones'),
-- Gyal
(7, 'DIAN', 'Facturación electrónica - Resolución vigente', '2025-12-31', 'completed', 'Contabilidad'),
(7, 'DIAN', 'Declaración IVA bimestral', '2025-07-15', 'pending', 'Contabilidad'),
(7, 'Sayco-Acinpro', 'Licencia de derechos de autor musical', '2025-08-31', 'completed', 'Jurídico'),
(7, 'Bomberos', 'Certificado técnico de seguridad', '2025-07-20', 'overdue', 'Operaciones'),
(7, 'ReteFuente', 'Declaración mensual de retención', '2025-07-10', 'overdue', 'Contabilidad');

-- ─── AI INSIGHTS ─────────────────────────────────────────────
INSERT INTO ai_insights (venue_id, brand_id, type, severity, title, content, created_at) VALUES
(1, 1, 'daily_summary', 'info', 'Resumen Matildelina — Sábado 12 Jul',
'🎵 Noche espectacular con Silvestre Dangond. Ventas totales: $45.7M (+87% vs promedio sábados). Ticket promedio: $78K. Ocupación: 97% (580/600). El whisky Buchanan''s fue el producto estrella con 27 botellas vendidas. Cierre de caja limpio con descuadre mínimo de $250K (0.5%). Recomendación: considerar repetir artista de vallenato premium cada 3 semanas.',
'2025-07-13 08:00:00'),

(2, 2, 'anomaly', 'warning', '⚠️ Anomalía Furia — Viernes 11 Jul',
'Se detectó un patrón anómalo en el cierre de caja del viernes. 8 anulaciones concentradas entre 1am y 3am, 5 del bartender Diego R. El descuadre total fue de $1.2M (7.5% de las ventas). Este patrón es consistente con las últimas 3 semanas. Recomendación urgente: auditoría de cámara de la barra 1 entre 1am-3am.',
'2025-07-12 09:30:00'),

(7, 5, 'alert', 'critical', '🚨 Alerta Crítica Gyal — Sábado 12 Jul',
'Descuadre de $2.1M detectado. 12 anulaciones del mesero #142 concentradas entre 11pm y 1am. 18 descuentos sin autorización. 8 cortesías que exceden el límite de 3 por noche. Score de anomalía: 85/100. Acción requerida: investigación de fraude interno.',
'2025-07-13 07:00:00'),

(NULL, NULL, 'recommendation', 'info', '📊 Oportunidad Cross-Selling',
'Análisis del CRM revela que el 65% de los clientes Gold/Platinum visitan 2+ marcas del grupo. Los clientes de Gyal tienen 40% de probabilidad de visitar África en las próximas 2 semanas. Recomendación: campaña de WhatsApp a 120 clientes de Gyal con invitación especial para la noche tropical de África del 19 de julio.',
'2025-07-13 10:00:00'),

(NULL, NULL, 'recommendation', 'info', '💰 Optimización de Inventario',
'El análisis de las últimas 8 semanas muestra que Hendrick''s tiene rotación baja en Matildelina (2.1 botellas/semana) pero alta en Furia (6.8/semana). Recomendación: transferir 4 botellas de Hendrick''s de Matildelina a Furia para optimizar capital de trabajo.',
'2025-07-13 10:30:00');

-- ─── ALERTS ──────────────────────────────────────────────────
INSERT INTO alerts (venue_id, brand_id, type, severity, title, message, is_resolved, created_at) VALUES
(2, 2, 'stock_low', 'warning', 'Stock bajo: Absolut en Furia Barra 3', 'Quedan 2 botellas de Absolut en la barra 3. Al ritmo actual se agotará a las 12:30 AM.', FALSE, '2025-07-12 23:00:00'),
(7, 5, 'anomaly', 'critical', 'Posible fraude: Mesero #142 en Gyal', '12 anulaciones en 2 horas. Patrón consistente con robo hormiga. Se requiere investigación inmediata.', FALSE, '2025-07-13 03:00:00'),
(2, 2, 'compliance', 'high', 'IVA bimestral vencido — Furia', 'La declaración de IVA del bimestre mayo-junio venció el 15 de julio sin presentarse.', FALSE, '2025-07-13 08:00:00'),
(7, 5, 'compliance', 'high', 'Certificado Bomberos vencido — Gyal', 'El certificado técnico de seguridad de bomberos venció el 20 de julio. Riesgo de sanción.', FALSE, '2025-07-13 08:00:00'),
(1, 1, 'forecast', 'info', 'Predicción: Alto consumo de whisky el 19 Jul', 'Basado en el histórico, se espera un consumo 30% superior al promedio de viernes. Recomendación: pedir 8 botellas adicionales de Buchanan''s 12.', FALSE, '2025-07-14 10:00:00'),
(2, 2, 'stock_low', 'warning', 'Stock bajo: Hendrick''s en Furia', 'Quedan 3 botellas. Se proyecta agotamiento para el sábado 19 Jul.', TRUE, '2025-07-11 10:00:00'),
(4, 3, 'forecast', 'info', 'Casa D Cartagena: Temporada alta', 'Julio es históricamente el mejor mes para Casa D Cartagena. Se recomienda aumentar inventario en 40%.', FALSE, '2025-07-10 09:00:00');

-- ─── PLATFORM USERS ──────────────────────────────────────────
-- Password: admin123 (bcrypt hash)
INSERT INTO platform_users (email, password_hash, full_name, role, brand_access) VALUES
('admin@nightpulse.ai', '$2b$12$LQv3c1yqBo9SkvXS7QTJPOOhTGlOFqXhGUJvC9YVVcSaL6y5WJKHy', 'Admin NightPulse', 'superadmin', '{1,2,3,4,5}'),
('andres@evedesa.com', '$2b$12$LQv3c1yqBo9SkvXS7QTJPOOhTGlOFqXhGUJvC9YVVcSaL6y5WJKHy', 'Andrés González', 'admin', '{1,2,3,4,5}'),
('gerente.matildelina@evedesa.com', '$2b$12$LQv3c1yqBo9SkvXS7QTJPOOhTGlOFqXhGUJvC9YVVcSaL6y5WJKHy', 'Alejandro Ruiz', 'manager', '{1}'),
('viewer@evedesa.com', '$2b$12$LQv3c1yqBo9SkvXS7QTJPOOhTGlOFqXhGUJvC9YVVcSaL6y5WJKHy', 'Demo Viewer', 'viewer', '{1,2,3,4,5}');
