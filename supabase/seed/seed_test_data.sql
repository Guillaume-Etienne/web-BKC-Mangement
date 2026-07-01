-- ============================================================================
--  SEED — Jeu de démo réaliste pour la base TEST
--  Kitesurf Center Management
-- ----------------------------------------------------------------------------
--  Période couverte : mi-septembre → mi-octobre 2026
--  5 groupes clients variés qui exercent TOUTE l'appli (voir README.md).
--
--  Ce script :
--    1. WIPE tout le contenu transactionnel + shared_links (garde config/prix)
--    2. Remet le compteur booking_number à 1  → bookings #1..#5
--    3. Réutilise la config existante (maisons, chauffeurs, moniteurs,
--       prestataires, logement externe...) et n'en crée une version démo
--       QUE si elle manque en TEST (fallback adaptatif)
--    4. Insère les 5 groupes + finances + taxis + activités + dining + expenses
--    5. Recrée quelques shared_links prêts à cliquer (forecast/taxi/driver/
--       manager/client #1)
--
--  ⚠️  À N'EXÉCUTER QUE SUR LA BASE TEST. Idempotent : ré-exécutable à volonté.
--  Pour tout enlever d'un coup : teardown_test_data.sql
-- ============================================================================

BEGIN;

-- ── 1. WIPE contenu + shared_links (config/prix conservés) ──────────────────
DELETE FROM email_logs;
DELETE FROM lesson_rate_overrides;
DELETE FROM lessons;
DELETE FROM equipment_rentals;
DELETE FROM activity_payments;
DELETE FROM activity_bookings;
DELETE FROM taxi_trips;
DELETE FROM taxi_manager_payments;
DELETE FROM payments;
DELETE FROM booking_room_prices;
DELETE FROM external_accommodation_bookings;
DELETE FROM booking_participants;
DELETE FROM booking_rooms;
DELETE FROM dining_events;
DELETE FROM day_activities;
DELETE FROM instructor_debts;
DELETE FROM instructor_payments;
DELETE FROM house_rentals;
DELETE FROM expenses;
DELETE FROM form_submissions;
DELETE FROM bookings;
DELETE FROM clients;
DELETE FROM shared_links;

-- ── 2. Compteur booking → #1 ────────────────────────────────────────────────
ALTER SEQUENCE booking_number_seq RESTART WITH 1;


-- ── 3+4+5. Config adaptative + insertion des données ────────────────────────
DO $$
DECLARE
  -- config (réutilisée si présente, créée en démo sinon)
  v_house_a  uuid; v_a_f uuid; v_a_b uuid;   -- maison entière (groupe 1)
  v_house_b  uuid; v_b_f uuid; v_b_b uuid;   -- 2 chambres    (groupe 3)
  v_house_c  uuid; v_c_r uuid;               -- 1 chambre     (groupe 5)
  v_bung     uuid; v_bung_r uuid;            -- bungalow Palmeiras (groupe 4)
  v_ext      uuid;                            -- logement externe (groupe 2)
  v_driver1  uuid; v_driver2 uuid;
  v_inst1    uuid; v_inst2 uuid;
  v_prov_act uuid; v_prov_saf uuid;
  v_kite     uuid; v_board uuid;
  v_season   uuid;

  -- clients / bookings / participants
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_b1 uuid; v_b2 uuid; v_b3 uuid; v_b4 uuid; v_b5 uuid;
  v_b1_p1 uuid; v_b1_p2 uuid; v_b1_p3 uuid; v_b1_p4 uuid;
  v_b2_p1 uuid; v_b2_p2 uuid;
  v_b3_p1 uuid; v_b3_p2 uuid; v_b3_p3 uuid; v_b3_p4 uuid;
  v_b4_p1 uuid;
  v_b5_p1 uuid; v_b5_p2 uuid;
BEGIN
  -- ---- CONFIG : maison A (entière) -----------------------------------------
  SELECT id INTO v_house_a FROM accommodations WHERE type='house' AND is_active ORDER BY name LIMIT 1;
  IF v_house_a IS NULL THEN
    INSERT INTO accommodations(name,type,total_rooms) VALUES ('H-1 (demo)','house',2) RETURNING id INTO v_house_a;
  END IF;
  SELECT id INTO v_a_f FROM rooms WHERE accommodation_id=v_house_a ORDER BY name LIMIT 1;
  IF v_a_f IS NULL THEN INSERT INTO rooms(accommodation_id,name,capacity) VALUES (v_house_a,'F',2) RETURNING id INTO v_a_f; END IF;
  SELECT id INTO v_a_b FROM rooms WHERE accommodation_id=v_house_a AND id<>v_a_f ORDER BY name LIMIT 1;
  IF v_a_b IS NULL THEN INSERT INTO rooms(accommodation_id,name,capacity) VALUES (v_house_a,'B',2) RETURNING id INTO v_a_b; END IF;

  -- ---- CONFIG : maison B (2 chambres) --------------------------------------
  SELECT id INTO v_house_b FROM accommodations WHERE type='house' AND is_active AND id<>v_house_a ORDER BY name LIMIT 1;
  IF v_house_b IS NULL THEN
    INSERT INTO accommodations(name,type,total_rooms) VALUES ('H-2 (demo)','house',2) RETURNING id INTO v_house_b;
  END IF;
  SELECT id INTO v_b_f FROM rooms WHERE accommodation_id=v_house_b ORDER BY name LIMIT 1;
  IF v_b_f IS NULL THEN INSERT INTO rooms(accommodation_id,name,capacity) VALUES (v_house_b,'F',2) RETURNING id INTO v_b_f; END IF;
  SELECT id INTO v_b_b FROM rooms WHERE accommodation_id=v_house_b AND id<>v_b_f ORDER BY name LIMIT 1;
  IF v_b_b IS NULL THEN INSERT INTO rooms(accommodation_id,name,capacity) VALUES (v_house_b,'B',2) RETURNING id INTO v_b_b; END IF;

  -- ---- CONFIG : maison C (1 chambre, groupe provisional) -------------------
  SELECT id INTO v_house_c FROM accommodations WHERE type='house' AND is_active AND id NOT IN (v_house_a,v_house_b) ORDER BY name LIMIT 1;
  IF v_house_c IS NULL THEN
    INSERT INTO accommodations(name,type,total_rooms) VALUES ('H-3 (demo)','house',2) RETURNING id INTO v_house_c;
  END IF;
  SELECT id INTO v_c_r FROM rooms WHERE accommodation_id=v_house_c ORDER BY name LIMIT 1;
  IF v_c_r IS NULL THEN INSERT INTO rooms(accommodation_id,name,capacity) VALUES (v_house_c,'F',2) RETURNING id INTO v_c_r; END IF;

  -- ---- CONFIG : bungalow Palmeiras -----------------------------------------
  SELECT id INTO v_bung FROM accommodations WHERE type='bungalow' AND is_active ORDER BY name LIMIT 1;
  IF v_bung IS NULL THEN
    INSERT INTO accommodations(name,type,total_rooms,cost_per_night) VALUES ('Palmeiras Bungalow (demo)','bungalow',1,25) RETURNING id INTO v_bung;
  END IF;
  SELECT id INTO v_bung_r FROM rooms WHERE accommodation_id=v_bung ORDER BY name LIMIT 1;
  IF v_bung_r IS NULL THEN INSERT INTO rooms(accommodation_id,name,capacity) VALUES (v_bung,'Bungalow',2) RETURNING id INTO v_bung_r; END IF;

  -- ---- CONFIG : logement externe (Palmeiras de préférence) -----------------
  SELECT id INTO v_ext FROM external_accommodations WHERE is_active ORDER BY (provider='palmeiras') DESC LIMIT 1;
  IF v_ext IS NULL THEN
    INSERT INTO external_accommodations(name,provider,cost_per_night,sell_price_per_night)
    VALUES ('Palmeiras Room (demo)','palmeiras',30,45) RETURNING id INTO v_ext;
  END IF;

  -- ---- CONFIG : chauffeurs --------------------------------------------------
  SELECT id INTO v_driver1 FROM taxi_drivers ORDER BY created_at LIMIT 1;
  IF v_driver1 IS NULL THEN
    INSERT INTO taxi_drivers(name,phone,vehicle,seats,default_price_eur,default_driver_mzn,default_manager_mzn)
    VALUES ('Amade (demo)','+258 84 000 0001','Toyota HiAce',7,120,6000,1000) RETURNING id INTO v_driver1;
  END IF;
  SELECT id INTO v_driver2 FROM taxi_drivers WHERE id<>v_driver1 ORDER BY created_at LIMIT 1;
  IF v_driver2 IS NULL THEN
    INSERT INTO taxi_drivers(name,phone,vehicle,seats,default_price_eur,default_driver_mzn,default_manager_mzn)
    VALUES ('Jofrisse (demo)','+258 84 000 0002','Nissan pickup',4,110,5500,1000) RETURNING id INTO v_driver2;
  END IF;

  -- ---- CONFIG : moniteurs ---------------------------------------------------
  SELECT id INTO v_inst1 FROM instructors ORDER BY created_at LIMIT 1;
  IF v_inst1 IS NULL THEN
    INSERT INTO instructors(first_name,last_name,specialties,rate_private,rate_group,rate_supervision)
    VALUES ('Kite','Instructor (demo)','{kite,wing}',40,25,15) RETURNING id INTO v_inst1;
  END IF;
  SELECT id INTO v_inst2 FROM instructors WHERE id<>v_inst1 ORDER BY created_at LIMIT 1;
  IF v_inst2 IS NULL THEN
    INSERT INTO instructors(first_name,last_name,specialties,rate_private,rate_group,rate_supervision)
    VALUES ('Wing','Coach (demo)','{wing}',38,22,15) RETURNING id INTO v_inst2;
  END IF;

  -- ---- CONFIG : prestataires activité / safari ------------------------------
  SELECT id INTO v_prov_act FROM activity_providers WHERE type='activity' AND is_active ORDER BY created_at LIMIT 1;
  IF v_prov_act IS NULL THEN
    INSERT INTO activity_providers(name,type,show_prices) VALUES ('Quad & Bikes (demo)','activity',true) RETURNING id INTO v_prov_act;
  END IF;
  SELECT id INTO v_prov_saf FROM activity_providers WHERE type='safari' AND is_active ORDER BY created_at LIMIT 1;
  IF v_prov_saf IS NULL THEN
    INSERT INTO activity_providers(name,type,show_prices) VALUES ('Bazaruto Safari (demo)','safari',false) RETURNING id INTO v_prov_saf;
  END IF;

  -- ---- CONFIG : matériel (kite + board pour les locations) ------------------
  SELECT id INTO v_kite FROM equipment WHERE category='kite' AND is_active ORDER BY created_at LIMIT 1;
  IF v_kite IS NULL THEN INSERT INTO equipment(name,category,brand,size) VALUES ('Kite 9m (demo)','kite','Duotone','9m') RETURNING id INTO v_kite; END IF;
  SELECT id INTO v_board FROM equipment WHERE category='board' AND is_active ORDER BY created_at LIMIT 1;
  IF v_board IS NULL THEN INSERT INTO equipment(name,category,brand,size) VALUES ('Twintip 138 (demo)','board','Duotone','138') RETURNING id INTO v_board; END IF;

  -- ---- CONFIG : saison couvrant la période ----------------------------------
  SELECT id INTO v_season FROM seasons WHERE start_date <= DATE '2026-09-14' AND end_date >= DATE '2026-10-16' LIMIT 1;
  IF v_season IS NULL THEN
    INSERT INTO seasons(label,start_date,end_date) VALUES ('2026-2027','2026-09-01','2027-05-31') RETURNING id INTO v_season;
  END IF;

  -- Coût de location d'une maison pour la saison (teste AccountingDashboard) --
  INSERT INTO house_rentals(accommodation_id,start_date,end_date,total_cost,notes)
  VALUES (v_house_a,'2026-09-01','2026-10-31',1800,'[SEED] Seasonal owner rent');


  -- ==========================================================================
  --  GROUPE 1 — Famille Martin (maison entière, kite + wing + loc + own-gear)
  -- ==========================================================================
  INSERT INTO clients(first_name,last_name,email,phone,nationality,kite_level,import_id,notes)
  VALUES ('Julie','Martin','julie.martin@example.com','+33 6 12 34 56 78','France','beg-total','SEED-c1','[SEED]')
  RETURNING id INTO v_c1;

  INSERT INTO bookings(client_id,check_in,check_out,status,couples_count,children_count,
      taxi_arrival,taxi_departure,luggage_count,boardbag_count,arrival_time,departure_time,
      num_lessons,num_equipment_rentals,num_wing_lessons,num_center_access,center_access_rate,
      amount_paid,import_id,notes)
  VALUES (v_c1,'2026-09-14','2026-09-21','confirmed',1,2,
      true,true,4,2,'13:00','10:00',
      1,1,1,1,5,
      500,'SEED-b1','[SEED] Family holiday, mixed activities')
  RETURNING id INTO v_b1;

  INSERT INTO booking_participants(booking_id,first_name,last_name,client_id,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b1,'Julie','Martin',v_c1,'beg-total',true,true,'[SEED] mum, kite beginner') RETURNING id INTO v_b1_p1;
  INSERT INTO booking_participants(booking_id,first_name,last_name,kite_level,does_kite,brings_own_gear,notes)
    VALUES (v_b1,'Marc','Martin','advanced',true,true,'[SEED] dad, own gear → center access') RETURNING id INTO v_b1_p2;
  INSERT INTO booking_participants(booking_id,first_name,last_name,wants_wing_lessons,notes)
    VALUES (v_b1,'Léa','Martin',true,'[SEED] daughter, wing lessons') RETURNING id INTO v_b1_p3;
  INSERT INTO booking_participants(booking_id,first_name,last_name,does_kite,wants_kite_rental,kite_level,notes)
    VALUES (v_b1,'Tom','Martin',true,true,'beg-total','[SEED] son, kite rental') RETURNING id INTO v_b1_p4;

  -- maison entière = 2 chambres
  INSERT INTO booking_rooms(booking_id,room_id) VALUES (v_b1,v_a_f),(v_b1,v_a_b);
  INSERT INTO booking_room_prices(booking_id,room_id,price_per_night) VALUES
    (v_b1,v_a_f,COALESCE((SELECT price_per_night FROM room_rates WHERE room_id=v_a_f::text LIMIT 1),50)),
    (v_b1,v_a_b,COALESCE((SELECT price_per_night FROM room_rates WHERE room_id=v_a_b::text LIMIT 1),50));

  -- leçons : 1 kite privée (Julie) + 1 wing (Léa)
  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b1,v_inst1,ARRAY[v_b1_p1],'2026-09-15','09:00',2,'private','[SEED] Kite intro');
  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b1,v_inst2,ARRAY[v_b1_p3],'2026-09-16','10:00',1.5,'private','[SEED] Wing lesson');

  -- location (Tom) sur 2 matinées
  INSERT INTO equipment_rentals(equipment_id,booking_id,participant_id,date,slot,price,notes) VALUES
    (v_kite,v_b1,v_b1_p4,'2026-09-16','morning',25,'[SEED]'),
    (v_board,v_b1,v_b1_p4,'2026-09-17','morning',15,'[SEED]');

  -- taxis A/R (chauffeur 1, managé)
  INSERT INTO taxi_trips(date,start_time,type,status,taxi_driver_id,booking_id,nb_persons,nb_luggage,nb_boardbags,price_eur,price_driver_mzn,margin_manager_mzn,notes) VALUES
    ('2026-09-14','13:30','aero-to-center','confirmed',v_driver1,v_b1,4,4,2,120,6000,1000,'[SEED] Arrival transfer'),
    ('2026-09-21','08:00','center-to-aero','confirmed',v_driver1,v_b1,4,4,2,120,6000,1000,'[SEED] Departure transfer');

  -- paiements : acompte + versement (solde restant dû)
  INSERT INTO payments(booking_id,date,amount,method,is_deposit,is_verified,notes) VALUES
    (v_b1,'2026-07-01',300,'transfer',true,true,'[SEED] Deposit'),
    (v_b1,'2026-09-14',200,'cash_eur',false,true,'[SEED] On arrival');


  -- ==========================================================================
  --  GROUPE 2 — Couple Schmidt (logement externe Palmeiras + safari/activité)
  --             + taxi PRIVÉ (margin_manager=0 → badge 🔒)
  -- ==========================================================================
  INSERT INTO clients(first_name,last_name,email,phone,nationality,kite_level,import_id,notes)
  VALUES ('Anna','Schmidt','anna.schmidt@example.de','+49 151 2345678','Germany','intermediate','SEED-c2','[SEED]')
  RETURNING id INTO v_c2;

  INSERT INTO bookings(client_id,check_in,check_out,status,couples_count,
      taxi_arrival,taxi_departure,luggage_count,boardbag_count,arrival_time,
      num_lessons,num_equipment_rentals,center_access_rate,amount_paid,import_id,notes)
  VALUES (v_c2,'2026-09-20','2026-09-27','confirmed',1,
      true,false,2,1,'16:00',
      1,1,5,760,'SEED-b2','[SEED] Couple, stays at Palmeiras, safari day')
  RETURNING id INTO v_b2;

  INSERT INTO booking_participants(booking_id,first_name,last_name,client_id,kite_level,does_kite,wants_kite_rental,notes)
    VALUES (v_b2,'Anna','Schmidt',v_c2,'intermediate',true,true,'[SEED] rents gear') RETURNING id INTO v_b2_p1;
  INSERT INTO booking_participants(booking_id,first_name,last_name,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b2,'Paul','Schmidt','beg-total',true,true,'[SEED] beginner lessons') RETURNING id INTO v_b2_p2;

  -- logement EXTERNE (pas de booking_rooms)
  INSERT INTO external_accommodation_bookings(booking_id,external_accommodation_id,check_in,check_out,cost_per_night,sell_price_per_night,notes)
    VALUES (v_b2,v_ext,'2026-09-20','2026-09-27',30,45,'[SEED] Palmeiras room');

  -- leçon + location
  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b2,v_inst1,ARRAY[v_b2_p2],'2026-09-22','09:00',2,'private','[SEED] Beginner course');
  INSERT INTO equipment_rentals(equipment_id,booking_id,participant_id,date,slot,price,notes)
    VALUES (v_kite,v_b2,v_b2_p1,'2026-09-23','full_day',40,'[SEED]');

  -- activités : safari (we_pay_provider) + quad (provider_pays_us)
  INSERT INTO activity_bookings(provider_id,booking_id,date,label,nb_persons,participant_ids,price_client,price_provider,payment_flow,notes)
    VALUES (v_prov_saf,v_b2,'2026-09-24','Bazaruto day safari',2,ARRAY[v_b2_p1,v_b2_p2],240,180,'we_pay_provider','[SEED]');
  INSERT INTO activity_bookings(provider_id,booking_id,date,label,nb_persons,participant_ids,price_client,price_provider,payment_flow,notes)
    VALUES (v_prov_act,v_b2,'2026-09-25','Quad sunset tour',2,ARRAY[v_b2_p1,v_b2_p2],0,90,'provider_pays_us','[SEED] client pays provider directly');
  INSERT INTO activity_payments(provider_id,date,amount,direction,notes)
    VALUES (v_prov_saf,'2026-09-24',180,'to_provider','[SEED] Safari settlement');
  INSERT INTO activity_payments(provider_id,date,amount,direction,notes)
    VALUES (v_prov_act,'2026-09-26',90,'from_provider','[SEED] Quad commission back');

  -- taxi PRIVÉ (arrivée seulement, margin_manager=0)
  INSERT INTO taxi_trips(date,start_time,type,status,taxi_driver_id,booking_id,nb_persons,nb_luggage,nb_boardbags,price_eur,price_driver_mzn,margin_manager_mzn,notes)
    VALUES ('2026-09-20','16:30','aero-to-center','confirmed',v_driver2,v_b2,2,2,1,100,6000,0,'[SEED] Private taxi (off-manager)');

  -- payé en totalité
  INSERT INTO payments(booking_id,date,amount,method,is_deposit,is_verified,notes)
    VALUES (v_b2,'2026-09-01',760,'transfer',true,true,'[SEED] Paid in full');


  -- ==========================================================================
  --  GROUPE 3 — Amis Bernard (2 chambres, cours GROUPE, taxis A/R)
  -- ==========================================================================
  INSERT INTO clients(first_name,last_name,email,phone,nationality,kite_level,import_id,notes)
  VALUES ('Lucas','Bernard','lucas.bernard@example.com','+33 6 98 76 54 32','France','intermediate','SEED-c3','[SEED]')
  RETURNING id INTO v_c3;

  INSERT INTO bookings(client_id,check_in,check_out,status,couples_count,
      taxi_arrival,taxi_departure,luggage_count,boardbag_count,arrival_time,departure_time,
      num_lessons,num_equipment_rentals,center_access_rate,amount_paid,import_id,notes)
  VALUES (v_c3,'2026-09-28','2026-10-05','confirmed',2,
      true,true,4,4,'12:00','11:00',
      3,1,5,900,'SEED-b3','[SEED] Group of friends, group course')
  RETURNING id INTO v_b3;

  INSERT INTO booking_participants(booking_id,first_name,last_name,client_id,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b3,'Lucas','Bernard',v_c3,'intermediate',true,true,'[SEED]') RETURNING id INTO v_b3_p1;
  INSERT INTO booking_participants(booking_id,first_name,last_name,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b3,'Emma','Roux','beg-bodydrag',true,true,'[SEED]') RETURNING id INTO v_b3_p2;
  INSERT INTO booking_participants(booking_id,first_name,last_name,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b3,'Nils','Petit','beg-total',true,true,'[SEED]') RETURNING id INTO v_b3_p3;
  INSERT INTO booking_participants(booking_id,first_name,last_name,kite_level,does_kite,wants_kite_rental,notes)
    VALUES (v_b3,'Sara','Blanc','advanced',true,true,'[SEED] rents gear') RETURNING id INTO v_b3_p4;

  -- 2 chambres (pas maison entière)
  INSERT INTO booking_rooms(booking_id,room_id) VALUES (v_b3,v_b_f),(v_b3,v_b_b);
  INSERT INTO booking_room_prices(booking_id,room_id,price_per_night) VALUES
    (v_b3,v_b_f,COALESCE((SELECT price_per_night FROM room_rates WHERE room_id=v_b_f::text LIMIT 1),50)),
    (v_b3,v_b_b,COALESCE((SELECT price_per_night FROM room_rates WHERE room_id=v_b_b::text LIMIT 1),50));

  -- cours GROUPE (3 participants) → teste le pricing groupe ×participants
  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b3,v_inst1,ARRAY[v_b3_p1,v_b3_p2,v_b3_p3],'2026-09-30','09:00',2,'group','[SEED] Group lesson');
  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b3,v_inst1,ARRAY[v_b3_p1,v_b3_p2,v_b3_p3],'2026-10-01','09:00',2,'group','[SEED] Group lesson day 2');

  INSERT INTO equipment_rentals(equipment_id,booking_id,participant_id,date,slot,price,notes)
    VALUES (v_board,v_b3,v_b3_p4,'2026-09-29','afternoon',15,'[SEED]');

  -- taxis A/R (chauffeur 2, managé)
  INSERT INTO taxi_trips(date,start_time,type,status,taxi_driver_id,booking_id,nb_persons,nb_luggage,nb_boardbags,price_eur,price_driver_mzn,margin_manager_mzn,notes) VALUES
    ('2026-09-28','12:30','aero-to-center','confirmed',v_driver2,v_b3,4,4,4,110,5500,1000,'[SEED] Arrival'),
    ('2026-10-05','09:00','center-to-aero','confirmed',v_driver2,v_b3,4,4,4,110,5500,1000,'[SEED] Departure');

  -- activité collective sur le planning
  INSERT INTO day_activities(date,slot,name,notes) VALUES ('2026-10-02','afternoon','Downwind session','[SEED]');

  -- paiement partiel (solde dû)
  INSERT INTO payments(booking_id,date,amount,method,is_deposit,is_verified,notes) VALUES
    (v_b3,'2026-08-01',500,'transfer',true,true,'[SEED] Deposit'),
    (v_b3,'2026-09-28',400,'cash_eur',false,false,'[SEED] Partial, unverified');


  -- ==========================================================================
  --  GROUPE 4 — Sophie Dubois (SOLO, bungalow Palmeiras, supervision + loc)
  --             + un paiement DISCOUNT
  -- ==========================================================================
  INSERT INTO clients(first_name,last_name,email,phone,nationality,kite_level,import_id,notes)
  VALUES ('Sophie','Dubois','sophie.dubois@example.com','+33 7 11 22 33 44','France','advanced','SEED-c4','[SEED]')
  RETURNING id INTO v_c4;

  INSERT INTO bookings(client_id,check_in,check_out,status,
      taxi_arrival,taxi_departure,luggage_count,boardbag_count,arrival_time,
      num_equipment_rentals,center_access_rate,amount_paid,import_id,notes)
  VALUES (v_c4,'2026-10-03','2026-10-10','confirmed',
      true,false,1,1,'15:00',
      1,5,420,'SEED-b4','[SEED] Solo advanced rider, bungalow')
  RETURNING id INTO v_b4;

  INSERT INTO booking_participants(booking_id,first_name,last_name,client_id,kite_level,does_kite,wants_kite_rental,notes)
    VALUES (v_b4,'Sophie','Dubois',v_c4,'advanced',true,true,'[SEED] supervision + rental') RETURNING id INTO v_b4_p1;

  -- bungalow (booking_rooms sur la chambre du bungalow)
  INSERT INTO booking_rooms(booking_id,room_id) VALUES (v_b4,v_bung_r);
  INSERT INTO booking_room_prices(booking_id,room_id,price_per_night)
    VALUES (v_b4,v_bung_r,COALESCE((SELECT price_per_night FROM room_rates WHERE room_id=v_bung_r::text LIMIT 1),40));

  -- supervision + location
  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b4,v_inst1,ARRAY[v_b4_p1],'2026-10-04','14:00',2,'supervision','[SEED] Supervised session');
  INSERT INTO equipment_rentals(equipment_id,booking_id,participant_id,date,slot,price,notes) VALUES
    (v_kite,v_b4,v_b4_p1,'2026-10-05','full_day',40,'[SEED]'),
    (v_kite,v_b4,v_b4_p1,'2026-10-06','full_day',40,'[SEED]');

  -- taxi arrivée (chauffeur 1, managé)
  INSERT INTO taxi_trips(date,start_time,type,status,taxi_driver_id,booking_id,nb_persons,nb_luggage,nb_boardbags,price_eur,price_driver_mzn,margin_manager_mzn,notes)
    VALUES ('2026-10-03','15:30','aero-to-center','confirmed',v_driver1,v_b4,1,1,1,120,6000,1000,'[SEED] Arrival');

  -- payé + remise (is_discount → n'entre pas dans amount_paid)
  INSERT INTO payments(booking_id,date,amount,method,is_deposit,is_verified,notes)
    VALUES (v_b4,'2026-09-15',420,'transfer',true,true,'[SEED] Paid in full');
  INSERT INTO payments(booking_id,date,amount,method,is_verified,is_discount,notes)
    VALUES (v_b4,'2026-09-15',30,'cash_eur',true,true,'[SEED] Loyalty discount');


  -- ==========================================================================
  --  GROUPE 5 — Tom Wilson (PROVISIONAL, 1 chambre, cours kite, solde total dû)
  -- ==========================================================================
  INSERT INTO clients(first_name,last_name,email,phone,nationality,kite_level,import_id,notes)
  VALUES ('Tom','Wilson','tom.wilson@example.co.uk','+44 7700 900123','United Kingdom','beg-total','SEED-c5','[SEED]')
  RETURNING id INTO v_c5;

  INSERT INTO bookings(client_id,check_in,check_out,status,couples_count,
      taxi_arrival,taxi_departure,luggage_count,boardbag_count,arrival_time,
      num_lessons,center_access_rate,amount_paid,import_id,notes)
  VALUES (v_c5,'2026-10-11','2026-10-16','provisional',1,
      false,false,2,1,'14:00',
      2,5,0,'SEED-b5','[SEED] Provisional — awaiting deposit')
  RETURNING id INTO v_b5;

  INSERT INTO booking_participants(booking_id,first_name,last_name,client_id,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b5,'Tom','Wilson',v_c5,'beg-total',true,true,'[SEED]') RETURNING id INTO v_b5_p1;
  INSERT INTO booking_participants(booking_id,first_name,last_name,kite_level,does_kite,wants_kite_lessons,notes)
    VALUES (v_b5,'Kate','Wilson','beg-total',true,true,'[SEED]') RETURNING id INTO v_b5_p2;

  INSERT INTO booking_rooms(booking_id,room_id) VALUES (v_b5,v_c_r);
  INSERT INTO booking_room_prices(booking_id,room_id,price_per_night)
    VALUES (v_b5,v_c_r,COALESCE((SELECT price_per_night FROM room_rates WHERE room_id=v_c_r::text LIMIT 1),50));

  INSERT INTO lessons(booking_id,instructor_id,participant_ids,date,start_time,duration_hours,type,notes)
    VALUES (v_b5,v_inst1,ARRAY[v_b5_p1,v_b5_p2],'2026-10-12','09:00',2,'private','[SEED] Couple beginner course');
  -- pas de paiement → apparaît en Outstanding


  -- ==========================================================================
  --  GLOBAL — dining, standalone taxi, expenses, instructor accounting,
  --           taxi manager advances (Geraldo), shared_links prêts à cliquer
  -- ==========================================================================

  -- Dining events (avec attendees au bon format EventAttendee)
  INSERT INTO dining_events(name,date,time,type,price_per_person,notes,attendees)
  VALUES ('Welcome dinner','2026-09-14','19:30','menu',18,'[SEED]',
    jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid()::text,'person_id',v_b1_p1::text,'person_type','participant','person_name','Julie Martin','room_label','H-1/F','is_attending',true,'starter','','main','','side',''),
      jsonb_build_object('id',gen_random_uuid()::text,'person_id',v_b1_p2::text,'person_type','participant','person_name','Marc Martin','room_label','H-1/B','is_attending',true,'starter','','main','','side','')
    ));
  INSERT INTO dining_events(name,date,time,type,price_per_person,notes,attendees)
  VALUES ('Beach BBQ','2026-10-01','20:00','count',22,'[SEED]','[]'::jsonb);

  -- Trajet taxi STANDALONE (sans booking) → computeStandaloneTaxiRevenue
  INSERT INTO taxi_trips(date,start_time,type,status,taxi_driver_id,nb_persons,price_eur,price_driver_mzn,margin_manager_mzn,notes)
    VALUES ('2026-09-26','10:00','center-to-town','done',v_driver1,3,40,2000,1000,'[SEED] Standalone town run');

  -- Dépenses variées
  INSERT INTO expenses(date,category,amount,description) VALUES
    ('2026-09-10','Fuel',85,'[SEED] Boat fuel'),
    ('2026-09-18','Groceries',140,'[SEED] Weekly groceries'),
    ('2026-10-02','Maintenance',260,'[SEED] Compressor service');

  -- Compta moniteur (dette + paiement)
  INSERT INTO instructor_debts(instructor_id,date,amount,description)
    VALUES (v_inst1,'2026-09-01',150,'[SEED] Cash advance');
  INSERT INTO instructor_payments(instructor_id,date,amount,method,notes)
    VALUES (v_inst1,'2026-09-30',400,'cash_mzn','[SEED] September settlement');

  -- Avances au manager taxi (Geraldo) : saldo = Σmargin_manager − Σpaid
  INSERT INTO taxi_manager_payments(date,amount_mzn,notes) VALUES
    ('2026-09-22',2000,'[SEED] Advance to Geraldo'),
    ('2026-10-06',1000,'[SEED] Advance to Geraldo');

  -- Shared links prêts à cliquer (on a wipé les anciens)
  INSERT INTO shared_links(token,type,label,params) VALUES
    ('forecast_seeddemo','forecast','[SEED] Season forecast','{}'::jsonb),
    ('taxi_seeddemo01','taxi','[SEED] Public Taxi Schedule','{}'::jsonb),
    ('taximgr_seeddem','taxi_manager','[SEED] Taxi Manager GERALDO schedule','{}'::jsonb),
    ('driver_seeddemo', 'driver','[SEED] Taxi Driver Schedule', jsonb_build_object('driver_id',v_driver1)),
    ('client_seeddemo','client','[SEED] Client Account — Martin #1','{"booking_number": 1}'::jsonb);

END $$;

COMMIT;

-- ── Vérif rapide (facultatif) ───────────────────────────────────────────────
-- SELECT booking_number, status, check_in, check_out FROM bookings ORDER BY booking_number;
-- SELECT type, label, token FROM shared_links ORDER BY type;
