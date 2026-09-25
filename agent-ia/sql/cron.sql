-- Cadence des tâches planifiées, côté Supabase.
--
-- Pourquoi ici et pas sur Vercel : l'offre Hobby ne permet qu'un déclenchement
-- par jour, alors que les filets de rattrapage doivent tourner plusieurs fois
-- par heure.
--
-- Les messages voyageurs et les réservations arrivent en temps réel par le
-- webhook Repull (/api/repull-webhook). Les tâches ci-dessous ne sont que des
-- filets : un webhook perdu ne doit pas rester sans réponse. Leur cadence est
-- modérée parce que chaque appel compte dans le quota mensuel Repull.
--
-- Remplacer AGENT_URL et CRON_SECRET avant d'exécuter.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Messages voyageurs : rattrapage toutes les 10 minutes.
-- Seuls les fils actifs depuis moins de trois jours sont relus.
select cron.schedule(
  'agent-messages-voyageurs',
  '*/10 * * * *',
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

-- Veille autonome : toutes les 4 heures pendant la journée. L'agent décide
-- lui-même s'il a quelque chose à dire — et se tait le plus souvent.
select cron.schedule(
  'agent-veille',
  '20 */4 * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=veille',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);

-- Rattrapage des réservations : toutes les 15 minutes. Relit ce qui a changé
-- chez Repull depuis 35 minutes ; ce que le webhook a déjà signalé n'est pas
-- renotifié.
select cron.schedule(
  'agent-reservations',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'AGENT_URL/api/cron?tache=reservations',
    headers := '{"Authorization": "Bearer CRON_SECRET"}'::jsonb
  );
  $$
);
