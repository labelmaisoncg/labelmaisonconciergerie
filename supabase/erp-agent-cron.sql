-- =============================================================================
-- ERP Label Maison : réveil de l'agent IA de la messagerie toutes les 30 min
-- =============================================================================
--
-- Pourquoi : l'offre gratuite de Vercel ne lance un cron qu'une fois par
-- jour. Supabase (pg_cron + pg_net, inclus dans l'offre gratuite) appelle
-- donc /api/erp-agent toutes les 30 minutes, de 8 h à 23 h (heure de Paris).
-- L'agent relit ses réglages à chaque passage (pause, horaires) : ce réveil
-- ne coûte rien quand il n'a rien à faire.
--
-- À faire UNE fois : Supabase → SQL Editor → New query, coller ce fichier,
-- remplacer les deux valeurs ci-dessous, puis Run. Le script est idempotent :
-- le relancer remplace le réveil et le secret, sans doublon.
--
--   1. REMPLACER_PAR_CRON_SECRET : la valeur de CRON_SECRET dans Vercel
--      (Settings → Environment Variables). Elle est rangée dans le coffre
--      chiffré de Supabase (Vault), jamais en clair dans la tâche.
--   2. L'adresse du site, si ce n'est pas https://www.labelmaisoncg.fr
--
-- Vérifier : select * from cron.job where jobname = 'erp-agent';
--            select * from cron.job_run_details order by start_time desc limit 5;
--            select status_code, content from net._http_response order by created desc limit 5;
-- Arrêter  : select cron.unschedule('erp-agent');
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secret partagé avec Vercel (CRON_SECRET), dans le coffre chiffré.
do $$
begin
  if exists (select 1 from vault.secrets where name = 'erp_agent_cron_secret') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'erp_agent_cron_secret'),
      'REMPLACER_PAR_CRON_SECRET'
    );
  else
    perform vault.create_secret('REMPLACER_PAR_CRON_SECRET', 'erp_agent_cron_secret', 'CRON_SECRET de Vercel, pour /api/erp-agent');
  end if;
end $$;

-- Ancien réveil retiré (relance sans doublon).
select cron.unschedule(jobid) from cron.job where jobname = 'erp-agent';

-- pg_cron compte en heure UTC : 6 h–22 h UTC couvre 8 h–23 h à Paris toute
-- l'année (heure d'été et d'hiver). Les heures de réponse fines se règlent
-- dans l'ERP (Messagerie agentique → Configurer mon agent).
select cron.schedule(
  'erp-agent',
  '*/30 6-22 * * *',
  $$
  select net.http_post(
    url := 'https://www.labelmaisoncg.fr/api/erp-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'erp_agent_cron_secret')
    ),
    body := '{"action":"lancer"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
