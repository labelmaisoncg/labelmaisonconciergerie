-- =============================================================================
-- Remise à zéro de l'ERP : une base vierge, l'application telle quelle.
-- =============================================================================
-- À lancer À LA MAIN, une fois, dans Supabase → SQL Editor → New query → Run,
-- après avoir lu « Remise à zéro » dans docs/erp/README.md. Irréversible :
-- faites une sauvegarde avant (Database → Backups) si vous voulez pouvoir
-- revenir en arrière.
--
-- Ce que ça efface :
--   - toutes les fiches de tous les espaces (logements, réservations,
--     propriétaires, factures, bilans, incidents, contrôles, conversations,
--     avis, contacts du CRM, accès…), leur historique et l'état des
--     automatisations ;
--   - toutes les invitations ;
--   - tous les membres de l'équipe, sauf le compte technique ;
--   - tous les espaces sauf Label Maison, et leurs clés rangées au coffre ;
--   - bloc 2 (séparé) : tous les comptes Supabase (équipe et propriétaires),
--     sauf le compte technique.
--
-- Ce que ça garde :
--   - le schéma erp (tables, règles, déclencheurs, fonctions, temps réel) ;
--   - l'espace Label Maison et le compte technique de l'équipe (les fonctions
--     serveur écrivent avec lui, son mot de passe est ERP_PASSWORD) ;
--   - les réglages Supabase (Auth, URL de retour, SMTP), pg_cron, le bucket
--     erp-fichiers (à VIDER depuis le tableau de bord : Storage → erp-fichiers
--     → tout sélectionner → Delete ; un delete SQL laisserait les fichiers) ;
--   - les variables Vercel (clés Repull de Label Maison, clé IA…).
--
-- Pour lancer : remplacez NON par OUI à la ligne 1 (données), et à la ligne 2
-- seulement si vous voulez aussi supprimer les comptes. Rien ne s'efface tant
-- que la ligne 1 dit NON.
-- =============================================================================
select set_config('lm.remise_a_zero', 'NON', false);
select set_config('lm.supprimer_comptes', 'NON', false);
-- Adresse du compte technique (VITE_ERP_EMAIL_EQUIPE si vous l'avez changée).
select set_config('lm.compte_technique', 'equipe@labelmaisoncg.fr', false);

do $$
declare
  confirme   text := current_setting('lm.remise_a_zero', true);
  comptes    text := current_setting('lm.supprimer_comptes', true);
  technique  text := lower(btrim(coalesce(current_setting('lm.compte_technique', true), 'equipe@labelmaisoncg.fr')));
  lm         uuid := erp.id_label_maison();
  n_auto int; n_fiches int; n_hist int; n_inv int; n_inv_esp int; n_membres int; n_espaces int;
  n_vault int := 0; n_comptes int := 0;
begin
  if confirme is distinct from 'OUI' then
    raise exception 'Remise à zéro non confirmée : remplacez NON par OUI à la première ligne du script.';
  end if;
  if technique !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse du compte technique illisible : %', technique;
  end if;

  -- 1. Les données, dans l'ordre des dépendances. Lancé par le propriétaire
  --    de la base (pas le rôle authenticated) : les gardes de l'application
  --    laissent passer, les règles de lignes ne s'appliquent pas.
  delete from erp.etat_automatisations;            get diagnostics n_auto = row_count;
  delete from erp.enregistrements;                 get diagnostics n_fiches = row_count;
  delete from erp.historique;                      get diagnostics n_hist = row_count;
  delete from erp.invitations_espace;              get diagnostics n_inv_esp = row_count;
  delete from erp.invitations;                     get diagnostics n_inv = row_count;
  delete from erp.membres where lower(email) <> technique; get diagnostics n_membres = row_count;
  delete from erp.espaces where id <> lm;          get diagnostics n_espaces = row_count;

  -- Le compte technique reste gérant de Label Maison (il y est déjà en
  -- principe ; sinon on le remet, sans quoi les fonctions serveur ne peuvent
  -- plus écrire).
  if not exists (select 1 from erp.membres where lower(email) = technique) then
    insert into erp.membres (espace, email, nom, role) values (lm, technique, 'Compte d''équipe', 'gerant');
    raise notice 'Compte technique % remis comme gérant de Label Maison.', technique;
  end if;

  -- Clés du coffre des autres espaces (Label Maison garde les siennes dans Vercel).
  begin
    delete from vault.secrets where name like 'erp\_%'; get diagnostics n_vault = row_count;
  exception when undefined_table or invalid_schema_name or insufficient_privilege then
    n_vault := 0;
  end;

  -- 2. Les comptes, seulement si demandé : tout le monde sauf le compte
  --    technique (identités, sessions et jetons suivent en cascade).
  if comptes = 'OUI' then
    delete from auth.users where lower(coalesce(email, '')) <> technique; get diagnostics n_comptes = row_count;
  end if;

  raise notice 'Remise à zéro faite : % fiches, % versions d''historique, % états d''automatisation, % invitations, % invitations d''espace, % membres, % espaces, % clés du coffre, % comptes supprimés.',
    n_fiches, n_hist, n_auto, n_inv, n_inv_esp, n_membres, n_espaces, n_vault, n_comptes;
end $$;

-- Bilan (onglet Results) : tout à 0 sauf espaces = 1 (Label Maison) et
-- membres = 1 (le compte technique) ; comptes = 1 si le bloc 2 a été lancé.
select
  (select count(*) from erp.enregistrements)       as fiches,
  (select count(*) from erp.historique)            as historique,
  (select count(*) from erp.etat_automatisations)  as automatisations,
  (select count(*) from erp.invitations)           as invitations,
  (select count(*) from erp.invitations_espace)    as invitations_espace,
  (select count(*) from erp.membres)               as membres,
  (select count(*) from erp.espaces)               as espaces,
  (select count(*) from auth.users)                as comptes;
