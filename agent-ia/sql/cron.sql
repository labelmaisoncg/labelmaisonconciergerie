-- Cadence des tâches planifiées, côté Supabase.
--
-- Pourquoi ici et pas sur Vercel : l'offre Hobby ne permet qu'un déclenchement
-- par jour, alors que les filets de rattrapage doivent tourner plusieurs fois
-- par heure.
--
-- CADENCE CALIBRÉE POUR L'OFFRE GRATUITE REPULL : 3 logements, 1 000 appels
-- par mois partagés avec l'ERP (l'agent en garde 600, REPULL_BUDGET_MENSUEL),
-- et PAS de webhook. Estimation mensuelle pour 3 logements :
--   messages      6 passages/jour × 1 lecture + fils qui ont bougé  ≈ 270
--   veille        1 passage/jour × 2 lectures × 3 logements         ≈ 180
--   matin / santé 1 fois par jour chacun                            ≈ 120
--   réservations  1 passage/jour                                    ≈  30
-- Total ≈ 600. Les voyageurs ont donc une réponse en 3 h au plus (de 8 h à
-- 23 h, heure de Paris d'été ; une heure plus tôt en hiver).
-- Avec l'offre Starter (webhooks, temps réel), revenir aux cadences notées
-- « Starter » ci-dessous et relever REPULL_BUDGET_MENSUEL.
--
-- Remplacer AGENT_URL et CRON_SECRET avant d'exécuter.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Messages voyageurs : toutes les 3 heures, de 6 h à 21 h UTC (Starter : '*/10 * * * *').
-- Seuls les fils actifs depuis moins de trois jours ET qui ont bougé sont relus.
select cron.schedule(
  'agent-messages-voyageurs',
  '0 6-21/3 * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=messages',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);

-- Résumé du matin et santé des connexions : déclenchés TOUTES LES HEURES.
-- Les crons tournent en UTC ; l'agent ne fait le travail qu'à la bonne heure
-- de Paris (8 h et 5 h). C'est la seule façon d'avoir une heure vraiment fixe
-- des deux côtés du changement d'heure.
select cron.schedule(
  'agent-resume-matin',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=matin',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);

select cron.schedule(
  'agent-sante-connexions',
  '10 * * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=sante',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);

-- Pour vérifier : select * from cron.job;
-- Pour retirer  : select cron.unschedule('agent-messages-voyageurs');

-- Veille autonome : une fois par jour, 16 h UTC (Starter : '20 */4 * * *').
-- L'agent décide lui-même s'il a quelque chose à dire — et se tait le plus souvent.
select cron.schedule(
  'agent-veille',
  '20 16 * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=veille',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);

-- Rattrapage des réservations : une fois par jour, 5 h 40 UTC (Starter : '*/15 * * * *').
-- Relit ce qui a changé chez Repull depuis la fenêtre RATTRAPAGE_RESERVATIONS_MIN ;
-- ce qui a déjà été signalé n'est pas renotifié.
select cron.schedule(
  'agent-reservations',
  '40 5 * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=reservations',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);
