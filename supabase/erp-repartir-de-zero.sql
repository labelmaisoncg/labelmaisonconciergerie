select set_config('lm.repartir_de_zero', 'NON', false);
-- =============================================================================
-- Repartir de zéro dans Label Maison, sauf le CRM (le reste de l'ERP ne bouge pas).
-- =============================================================================
-- À lancer À LA MAIN, une fois, dans Supabase → SQL Editor → New query → Run,
-- après avoir lu « Repartir de zéro sauf le CRM » dans docs/erp/README.md.
-- Fermez d'abord l'ERP sur tous vos appareils (ordinateur, téléphone, app) :
-- une page restée ouverte pourrait réécrire ce qui vient d'être effacé.
--
-- Ce que ça efface, dans l'espace Label Maison seulement : logements,
-- réservations, conversations, ménages, linge, incidents, contrôles, charges,
-- paiements des prestataires, dossiers, mandats, recommandations, textes
-- d'annonce, documents partagés, bilans, affectations, signalements, actions
-- de l'IA, demandes des propriétaires, annonces à l'équipe, journal, décisions
-- sur les prix, factures en brouillon, liens entre annonces ; la trace des
-- messages automatiques des séjours finis depuis plus de 30 jours.
--
-- Ce que ça garde :
--   - le CRM (contacts et prospects) ;
--   - les propriétaires, l'équipe, les prestataires, les accès et les comptes ;
--   - les réglages (messages automatiques, agent, société, numérotation),
--     les factures émises (elles ne s'effacent pas), les autres espaces ;
--   - la trace des messages automatiques des séjours récents ou à venir et
--     celle des avis déjà publiés : quand vous reconnecterez vos comptes et
--     que leurs réservations reviendront, rien ne repartira deux fois aux
--     voyageurs ;
--   - le compteur d'appels du mois et le choix des annonces (Connexions) ;
--   - l'historique de la base : la dernière version de chaque fiche effacée
--     y reste.
--
-- Ensuite : rien ne revient tout seul tant qu'aucune plateforme n'est
-- connectée. En reconnectant Airbnb ou Booking.com et en cochant vos
-- annonces, leurs logements, réservations et conversations reviennent depuis
-- les plateformes ; une notification ne part que pour les séjours en cours ou
-- à venir.
--
-- Pour lancer : remplacez NON par OUI à la ligne 1. Rien ne s'efface tant
-- qu'elle dit NON. Tout passe en une seule transaction.
-- =============================================================================
do $$
declare
  confirme   text := current_setting('lm.repartir_de_zero', true);
  lm         uuid := erp.id_label_maison();
  limite     text := to_char(current_date - 30, 'YYYY-MM-DD');
  n_envois   int;
  n_fiches   int;
  n_factures int;
  n_conseils int;
  n_liens    int;
begin
  if confirme is distinct from 'OUI' then
    raise exception 'Non confirmé : remplacez NON par OUI à la première ligne du script.';
  end if;
  if lm is null then
    raise exception 'Espace Label Maison introuvable : rien n''est effacé.';
  end if;
  -- 1. Trace des messages automatiques : seulement celle des séjours finis depuis plus de 30 jours
  --    (ou dont la réservation n'existe plus), AVANT d'effacer les réservations.
  delete from erp.enregistrements e
   where e.espace = lm and e.collection = 'envoisProgrammes'
     and not exists (
       select 1 from erp.enregistrements r
        where r.espace = lm and r.collection = 'reservations'
          and r.id = e.donnees ->> 'reservationId'
          and coalesce(r.donnees ->> 'depart', '') >= limite);
  get diagnostics n_envois = row_count;
  -- 2. Tout ce qui tient aux logements et à leur exploitation. Lancé par le propriétaire de la
  --    base (pas le rôle authenticated) : les gardes de l'application ne s'appliquent pas ici.
  delete from erp.enregistrements
   where espace = lm and collection in (
     'logements', 'reservations', 'filsMessages', 'missions', 'mouvementsLinge', 'incidents', 'controles',
     'charges', 'paiementsPrestataires', 'dossiers', 'mandats', 'recommandations', 'versionsAnnonce',
     'documentsProprietaire', 'bilansProprietaire', 'affectations', 'signalementsLogement', 'actionsAgent',
     'demandesProprietaires', 'annoncesEquipe', 'journal');
  get diagnostics n_fiches = row_count;
  delete from erp.enregistrements
   where espace = lm and collection = 'factures' and coalesce(donnees ->> 'statut', '') = 'brouillon';
  get diagnostics n_factures = row_count;
  -- Prix conseillés : les décisions partent, les réglages (reglages, etat) restent.
  delete from erp.enregistrements
   where espace = lm and collection = 'conseilsPrix' and id not in ('reglages', 'etat');
  get diagnostics n_conseils = row_count;
  delete from erp.enregistrements
   where espace = lm and collection = 'repull' and id in ('annonces-reliees', 'relire', 'verrou');
  get diagnostics n_liens = row_count;
  -- Tout sera relu au premier passage après la reconnexion (annonces, avis, pays) ;
  -- le compteur d'appels du mois reste.
  update erp.enregistrements
     set donnees = donnees - 'dernieresPhases'
   where espace = lm and collection = 'repull' and id = 'etat';
  raise notice 'Fait : % fiches, % factures en brouillon, % décisions de prix, % traces de messages anciennes, % éléments de liens effacés dans Label Maison.',
    n_fiches, n_factures, n_conseils, n_envois, n_liens;
end $$;

-- Bilan (onglet Results) : logements, réservations et conversations à 0 ; contacts_crm inchangé.
select
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'logements')    as logements,
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'reservations') as reservations,
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'filsMessages') as conversations,
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'crm')          as contacts_crm,
  (select count(*) from erp.enregistrements where espace <> erp.id_label_maison())                                as fiches_autres_espaces;
