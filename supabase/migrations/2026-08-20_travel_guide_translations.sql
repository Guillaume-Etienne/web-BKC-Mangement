-- Travel Guide — traductions EN + ES des textes FR rédigés par gui (2026-08-20).
--
-- ⚠️ NE TOUCHE JAMAIS AU FRANÇAIS. Chaque UPDATE ne réécrit que les clés 'en' et
-- 'es' du JSONB, via jsonb_set : le 'fr' de gui est la source, il reste intact
-- même si ce fichier est rejoué. Idempotent — rejouable sans dommage.
--
-- Écrit avec to_jsonb('...'::text) plutôt qu'avec du JSON tapé à la main : les
-- textes contiennent des guillemets ("no thank you", « ayudarle ») et de la
-- ponctuation typographique qu'un littéral JSON aurait obligé à échapper à la
-- main — une source d'erreur pour rien.
--
-- À appliquer sur TEST **et** PROD (les deux bases portent les mêmes 6 sections,
-- avec les mêmes id tg1..tg6).

BEGIN;

-- ── tg1 · Cash ───────────────────────────────────────────────
UPDATE document_templates SET
  title = jsonb_set(jsonb_set(title,
            '{en}', to_jsonb('Cash'::text)),
            '{es}', to_jsonb('Dinero en efectivo'::text)),
  content = jsonb_set(jsonb_set(content,
            '{en}', to_jsonb('Please bring cash in EUR. ATMs are scarce in Bilene and do not always work. The amounts you can withdraw are very limited, and so is the number of withdrawals per day. Plan for enough to cover your whole stay.
We recommend changing some of it into Meticais (the local currency) as soon as you land, at the official exchange desks in the airport — the rates there are well above what you will get elsewhere. Do ask our taxi driver to point them out to you.'::text)),
            '{es}', to_jsonb('Le rogamos traer efectivo en EUR. Los cajeros automáticos son escasos en Bilene y no siempre funcionan. Además, los importes que se pueden retirar son muy limitados, al igual que el número de operaciones por día. Prevea lo suficiente para toda su estancia.
Le recomendamos cambiar una parte en Meticales (la moneda local) nada más aterrizar, en las casas de cambio oficiales del aeropuerto: allí las tasas son muy superiores a las que obtendrá en otros sitios. No dude en pedir a nuestro taxista que se las indique.'::text))
WHERE doc_type = 'travel_guide' AND id = 'tg1';

-- ── tg2 · Update — changing your cash into Meticais ───────────────────────────────────────────────
UPDATE document_templates SET
  title = jsonb_set(jsonb_set(title,
            '{en}', to_jsonb('Update — changing your cash into Meticais'::text)),
            '{es}', to_jsonb('Actualización — cambio de efectivo en Meticales'::text)),
  content = jsonb_set(jsonb_set(content,
            '{en}', to_jsonb('We recommend changing most of your euros into Meticais at those exchange desks. If you have any left over, we will change them back for you at the official rate when you leave.'::text)),
            '{es}', to_jsonb('Le recomendamos cambiar la mayor parte de sus euros en Meticales en esas casas de cambio. Si le sobra algo, se lo cambiaremos a su salida al tipo de cambio oficial.'::text))
WHERE doc_type = 'travel_guide' AND id = 'tg2';

-- ── tg3 · What to bring ───────────────────────────────────────────────
UPDATE document_templates SET
  title = jsonb_set(jsonb_set(title,
            '{en}', to_jsonb('What to bring'::text)),
            '{es}', to_jsonb('Qué traer'::text)),
  content = jsonb_set(jsonb_set(content,
            '{en}', to_jsonb('High-protection sunscreen (SPF 50+), a rash vest or light wetsuit, sunglasses with a strap for kite and wing sessions — on the spot the sun is often right in front of you —, a hat, flip-flops and light clothing, plus a sweatshirt and a pair of trousers for the cooler evenings. Tap water is not drinkable: plan on buying bottled water locally. It is sold in plenty of shops in Bilene.'::text)),
            '{es}', to_jsonb('Protector solar de alta protección (SPF 50+), licra o traje de neopreno ligero, gafas de sol con cordón para el kite y el wing — en el spot el sol suele dar de frente —, gorra, chanclas y ropa ligera, además de una sudadera y un pantalón para las noches frescas. El agua del grifo no es potable: prevea comprar agua embotellada en el lugar. Se vende en numerosas tiendas de Bilene.'::text))
WHERE doc_type = 'travel_guide' AND id = 'tg3';

-- ── tg4 · Health ───────────────────────────────────────────────
UPDATE document_templates SET
  title = jsonb_set(jsonb_set(title,
            '{en}', to_jsonb('Health'::text)),
            '{es}', to_jsonb('Salud'::text)),
  content = jsonb_set(jsonb_set(content,
            '{en}', to_jsonb('Yellow fever vaccination is not required for Mozambique. Antimalarial treatment is recommended if you are planning to visit densely populated areas or a wildlife park. — Check with your doctor before you travel.'::text)),
            '{es}', to_jsonb('La vacuna contra la fiebre amarilla no es obligatoria para Mozambique. Se recomienda un tratamiento antipalúdico si tiene previsto visitar zonas muy pobladas o un parque de fauna salvaje. — Consulte a su médico antes de viajar.'::text))
WHERE doc_type = 'travel_guide' AND id = 'tg4';

-- ── tg5 · Getting here ───────────────────────────────────────────────
UPDATE document_templates SET
  title = jsonb_set(jsonb_set(title,
            '{en}', to_jsonb('Getting here'::text)),
            '{es}', to_jsonb('Cómo llegar'::text)),
  content = jsonb_set(jsonb_set(content,
            '{en}', to_jsonb('Fly to Maputo (MPM). A taxi will be waiting for you at the airport to take you straight to the centre — around 2.5 hours on the road. Please let us know your landing time in advance.
Allow a little patience at the arrival checks — they rarely take long, but it is better not to be in a hurry. Keep the receipt and/or the paper proof they give you safe for your whole stay in Mozambique.

In the checks area, stay focused and keep your belongings close. It is not unusual for an officer to offer to speed things up in exchange for a small note — a smile, eye contact, and a "no thank you" that leaves no room for doubt.

Unofficial porters may also come up and offer to "help" you with your luggage. Same answer: a smile, and a polite but firm no. Our driver is waiting just past the checks — and from there, you are in good hands. He takes care of everything, luggage included.'::text)),
            '{es}', to_jsonb('Vuelo hasta Maputo (MPM). Un taxi le esperará en el aeropuerto para llevarle directamente al centro: unas 2 h 30 de carretera. Le rogamos que nos comunique con antelación su hora de aterrizaje.
Tenga algo de paciencia en los controles de llegada: rara vez se alargan, pero conviene no tener prisa. Conserve cuidadosamente el recibo y/o el justificante en papel que le entreguen durante toda su estancia en Mozambique.

En la zona de controles, manténgase atento y no pierda de vista sus pertenencias. No es raro que un agente se ofrezca a agilizar los trámites a cambio de un billete: una sonrisa, mirarle a los ojos y un «no, gracias» que no deje lugar a dudas.

También pueden acercarse maleteros espontáneos para «ayudarle» con el equipaje. La misma respuesta: una sonrisa y un rechazo amable pero firme. Nuestro chofer le espera justo después de los controles y, a partir de ahí, está en buenas manos. Él se ocupa de todo, equipaje incluido.'::text))
WHERE doc_type = 'travel_guide' AND id = 'tg5';

-- ── tg6 · Visa ───────────────────────────────────────────────
UPDATE document_templates SET
  title = jsonb_set(jsonb_set(title,
            '{en}', to_jsonb('Visa'::text)),
            '{es}', to_jsonb('Visado'::text)),
  content = jsonb_set(jsonb_set(content,
            '{en}', to_jsonb('Since 2025, nationals of many countries — including France, Belgium, Switzerland, Spain, Italy, Germany, Portugal, the United Kingdom, the Netherlands and others — must obtain an ETA (Electronic Travel Authorization) before departure, through the official portal evisa.gov.mz. It costs around $48, and it is worth applying several weeks ahead so you can stop thinking about it — your airline will check the document at boarding. A passport valid for more than 6 months beyond your arrival date is mandatory. We will send you the accommodation letter your application requires.'::text)),
            '{es}', to_jsonb('Desde 2025, los ciudadanos de numerosos países —entre ellos Francia, Bélgica, Suiza, España, Italia, Alemania, Portugal, el Reino Unido, los Países Bajos y otros— deben obtener una ETA (Electronic Travel Authorization) antes de viajar, a través del portal oficial evisa.gov.mz. Cuesta unos 48 $ y conviene solicitarla con varias semanas de antelación para viajar tranquilo: su aerolínea comprobará el documento al embarcar. Es obligatorio un pasaporte con una validez superior a 6 meses después de la fecha de llegada. Le enviaremos la carta de alojamiento necesaria para su expediente.'::text))
WHERE doc_type = 'travel_guide' AND id = 'tg6';

COMMIT;

-- ── Vérifications ────────────────────────────────────────────────────────────
--
-- 1) Le français est intact — doit renvoyer 0 ligne :
--    SELECT id FROM document_templates
--     WHERE doc_type = 'travel_guide'
--       AND (title->>'fr' IS NULL OR content->>'fr' IS NULL);
--
-- 2) Les trois langues sont remplies partout — doit renvoyer 0 ligne :
--    SELECT id, sort_order FROM document_templates
--     WHERE doc_type = 'travel_guide'
--       AND (title->>'en' IS NULL OR title->>'es' IS NULL
--            OR content->>'en' IS NULL OR content->>'es' IS NULL);
--
-- 3) Les longueurs se ressemblent enfin. C'était le symptôme du 2026-08-18 :
--    un EN cinq fois plus court que le FR voulait dire "texte par défaut, jamais
--    traduit". Elles ne seront pas identiques (l'espagnol est plus long que
--    l'anglais), mais du même ordre :
--    SELECT sort_order,
--           length(content->>'fr') AS fr,
--           length(content->>'en') AS en,
--           length(content->>'es') AS es
--      FROM document_templates WHERE doc_type = 'travel_guide' ORDER BY sort_order;
--
-- 4) À l'écran : Documents → Travel Guide, basculer FR / EN / ES.
