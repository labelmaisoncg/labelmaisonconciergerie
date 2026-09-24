-- Cadence des tâches planifiées, côté Supabase.
--
-- Pourquoi ici et pas sur Vercel : l'offre Hobby ne permet qu'un déclenchement
-- par jour, alors que les messages voyageurs demandent une vérification toutes
-- les deux minutes — Channex n'expose aucun webhook dessus.
--
-- Remplacer AGENT_URL et CRON_SECRET avant d'exécuter.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Messages voyageurs : toutes les 2 minutes.
-- C'est le seul travail qui tourne en continu, donc le seul dont le coût
-- augmente avec le nombre de conciergeries.
select cron.schedule(
  'agent-messages-voyageurs',
  '*/2 * * * *',
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

-- Rattrapage du flux de réservations : toutes les 15 minutes.
-- Channex l'EXIGE en complément du webhook, même quand celui-ci fonctionne :
-- un webhook perdu est une réservation manquée, donc un surbooking.
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
