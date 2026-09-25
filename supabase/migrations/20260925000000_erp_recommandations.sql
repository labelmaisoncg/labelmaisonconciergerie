-- CIBLE FUTURE, NON APPLIQUÉE : ne pas lancer sur le projet actuel.
-- L'ERP en production utilise supabase/erp-installation.sql (voir supabase/migrations/README.md).
-- =============================================================================
-- ERP Label Maison : suivi des améliorations proposées aux propriétaires
-- (module Performance des biens, SPEC §10). Miroir de
-- RecommandationProprietaire dans src/erp/data/types.ts.
--
-- Identifiant texte (et non uuid) : l'automatisation « revue de performance »
-- crée des ids déterministes « reco-<logement>-<code> » pour ne jamais créer
-- deux fois la même suggestion. Une contrainte d'unicité (logement, code)
-- garantit la même chose côté base.
-- =============================================================================

create table erp.recommandations (
  id                           text primary key,
  logement_id                  uuid not null references erp.logements (id) on delete cascade,
  proprietaire_id              uuid not null references erp.proprietaires (id) on delete restrict,
  code                         text not null,
  titre                        text not null,
  detail                       text not null default '',
  impact_estime_centimes_mois  bigint,
  impact_sur                   text check (impact_sur in ('revenu_bien', 'marge_label_maison')),
  porteur                      text not null check (porteur in ('proprietaire', 'label_maison')),
  statut                       text not null default 'a_proposer'
                               check (statut in ('a_proposer', 'proposee', 'acceptee', 'refusee', 'realisee')),
  proposee_le                  date,
  decidee_le                   date,
  realisee_le                  date,
  cout_centimes                bigint check (cout_centimes >= 0),
  resultat_observe             text,
  cree_le                      date not null default current_date,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  unique (logement_id, code),
  -- Cohérence du cycle de vie : une décision suppose une proposition,
  -- une réalisation suppose une acceptation.
  check (statut = 'a_proposer' or proposee_le is not null),
  check (statut not in ('acceptee', 'refusee', 'realisee') or decidee_le is not null),
  check (statut <> 'realisee' or realisee_le is not null)
);
create index recommandations_proprietaire_idx on erp.recommandations (proprietaire_id, statut);
create index recommandations_statut_idx on erp.recommandations (statut);

create trigger recommandations_updated_at before update on erp.recommandations
  for each row execute function erp.maj_updated_at();

-- RLS identique aux autres tables métier : l'équipe (gérant, opérations) a
-- tous les droits, le rôle « lecture » consulte, les prestataires n'y ont
-- pas accès.
alter table erp.recommandations enable row level security;
create policy equipe_tout on erp.recommandations
  for all to authenticated using (erp.est_equipe()) with check (erp.est_equipe());
create policy lecture_seule on erp.recommandations
  for select to authenticated using (erp.peut_lire());

grant select, insert, update, delete on erp.recommandations to authenticated;
