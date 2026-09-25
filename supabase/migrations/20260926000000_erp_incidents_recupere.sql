-- CIBLE FUTURE, NON APPLIQUÉE : ne pas lancer sur le projet actuel.
-- L'ERP en production utilise supabase/erp-installation.sql (voir supabase/migrations/README.md).
-- =============================================================================
-- ERP Label Maison : suivi du recouvrement des incidents refacturables.
-- Miroir de Incident.recupereLe dans src/erp/data/types.ts.
--
-- recupere_le : date à laquelle la somme refacturée (propriétaire, voyageur ou
-- prestataire) a été effectivement récupérée. Tant qu'elle est vide, le coût
-- d'un incident refacturable compte dans « Refacturable à récupérer ».
-- =============================================================================

alter table erp.incidents
  add column recupere_le date;

-- Une somme ne se récupère que sur un incident résolu et refacturable.
alter table erp.incidents
  add constraint incidents_recupere_coherent check (
    recupere_le is null or (statut = 'resolu' and refacturable <> 'aucun')
  );

-- Liste « à récupérer » : incidents refacturables résolus sans recouvrement.
create index incidents_a_recuperer_idx on erp.incidents (refacturable)
  where refacturable <> 'aucun' and recupere_le is null;
