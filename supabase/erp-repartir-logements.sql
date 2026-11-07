select set_config('lm.repartir_logements', 'NON', false);
-- =============================================================================
-- Repartir de zéro pour les logements de Label Maison (le reste ne bouge pas).
-- =============================================================================
-- À lancer À LA MAIN, une fois, dans Supabase → SQL Editor → New query → Run,
-- après avoir lu « Repartir de zéro pour les logements » dans docs/erp/README.md.
-- Fermez d'abord l'ERP sur tous vos appareils (ordinateur, téléphone, app) :
-- une page restée ouverte pourrait réécrire un logement effacé.
--
-- Ce que ça efface, dans l'espace Label Maison seulement :
--   - toutes les fiches logement (importées d'une annonce ou faites à la main),
--     avec ce qui y a été saisi dans l'ERP (fiche voyageur, repères
--     techniques, contacts, couleur…) ;
--   - les liens entre annonces (« Relier l'annonce Booking.com ») et l'état
--     de ces liens (repull/annonces-reliees, relire, verrou).
--
-- Ce que ça garde :
--   - les réservations, les conversations, les ménages, le linge, les
--     incidents, les contrôles, les factures, les bilans, les documents ;
--   - les propriétaires, l'équipe, le CRM, les réglages (messages
--     automatiques, agent, société), le journal, la trace des messages déjà
--     envoyés (rien ne repart deux fois aux voyageurs) ;
--   - le choix des annonces (Logements → Connexions) et le compteur d'appels ;
--   - les autres espaces, tous les comptes ;
--   - l'historique de la base : la dernière version de chaque fiche effacée
--     y reste (rien n'est perdu pour de bon).
--   Les réservations ne sont pas effacées exprès : réimportées, chacune
--   enverrait une notification « nouvelle réservation ».
--
-- Ensuite : les logements des annonces cochées reviennent au passage suivant
-- de la synchronisation (Paramètres → Plateformes → « Synchroniser », ou le
-- passage de la nuit), avec le même identifiant : leurs réservations,
-- messages et ménages s'y raccrochent tout seuls. Un logement fait à la main
-- ne revient pas. Une annonce décochée revient quand on la coche ; dite
-- « même logement que… », ce qui portait son ancienne fiche la rejoint.
--
-- Pour lancer : remplacez NON par OUI à la ligne 1. Rien ne s'efface tant
-- qu'elle dit NON. Tout passe en une seule transaction.
-- =============================================================================
do $$
declare
  confirme    text := current_setting('lm.repartir_logements', true);
  lm          uuid := erp.id_label_maison();
  n_logements int;
  n_liens     int;
begin
  if confirme is distinct from 'OUI' then
    raise exception 'Non confirmé : remplacez NON par OUI à la première ligne du script.';
  end if;
  if lm is null then
    raise exception 'Espace Label Maison introuvable : rien n''est effacé.';
  end if;
  -- Lancé par le propriétaire de la base (pas le rôle authenticated) : la garde
  -- « un logement qui a vécu ne se supprime pas » ne s'applique pas ici.
  delete from erp.enregistrements where espace = lm and collection = 'logements';
  get diagnostics n_logements = row_count;
  delete from erp.enregistrements
   where espace = lm and collection = 'repull' and id in ('annonces-reliees', 'relire', 'verrou');
  get diagnostics n_liens = row_count;
  -- Relevé des annonces au prochain passage (sinon jusqu'à 20 h d'attente) :
  -- seul son horodatage est retiré, le compteur d'appels du mois reste.
  update erp.enregistrements
     set donnees = donnees #- '{dernieresPhases,annonces}'
   where espace = lm and collection = 'repull' and id = 'etat';
  raise notice 'Fait : % fiches logement et % éléments de liens effacés dans Label Maison. Rouvrez l''ERP, puis Paramètres → Plateformes → Synchroniser.',
    n_logements, n_liens;
end $$;

-- Bilan (onglet Results) : logements = 0 ; le reste comme avant.
select
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'logements')    as logements,
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'reservations') as reservations,
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'filsMessages') as conversations,
  (select count(*) from erp.enregistrements where espace = erp.id_label_maison() and collection = 'crm')          as contacts_crm,
  (select count(*) from erp.enregistrements where espace <> erp.id_label_maison())                                as fiches_autres_espaces;
