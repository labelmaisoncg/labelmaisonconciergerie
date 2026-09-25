-- CIBLE FUTURE, NON APPLIQUÉE : ne pas lancer sur le projet actuel.
-- L'ERP en production utilise supabase/erp-installation.sql (voir supabase/migrations/README.md).
-- =============================================================================
-- ERP Label Maison : versions mensuelles des annonces (SPEC §11). Miroir de
-- VersionAnnonce dans src/erp/data/types.ts.
--
-- Identifiant texte : l'automatisation « rafraîchissement mensuel des
-- annonces » crée des ids déterministes « ann-<logement>-<mois> » (révisions
-- manuelles « ...-r2 ») pour ne jamais proposer deux fois le même mois.
-- =============================================================================

create table erp.versions_annonce (
  id             text primary key,
  logement_id    uuid not null references erp.logements (id) on delete cascade,
  mois           text not null check (mois ~ '^\d{4}-\d{2}$'),
  statut         text not null default 'proposee'
                 check (statut in ('proposee', 'validee', 'publiee', 'rejetee')),
  titre          text not null check (char_length(titre) <= 50),
  description    text not null,
  accroche       text not null default '',
  raisons        text[] not null default '{}',
  source         text not null default 'agent' check (source in ('agent', 'humain')),
  cree_le        date not null default current_date,
  validee_par    text,
  validee_le     date,
  publiee_le     date,
  motif_rejet    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Validation humaine obligatoire avant publication, motif obligatoire au rejet.
  check (statut not in ('validee', 'publiee') or (validee_par is not null and validee_le is not null)),
  check (statut <> 'publiee' or publiee_le is not null),
  check (statut <> 'rejetee' or coalesce(motif_rejet, '') <> '')
);
create index versions_annonce_logement_idx on erp.versions_annonce (logement_id, mois);
create index versions_annonce_statut_idx on erp.versions_annonce (statut);

create trigger versions_annonce_updated_at before update on erp.versions_annonce
  for each row execute function erp.maj_updated_at();

alter table erp.versions_annonce enable row level security;
create policy equipe_tout on erp.versions_annonce
  for all to authenticated using (erp.est_equipe()) with check (erp.est_equipe());
create policy lecture_seule on erp.versions_annonce
  for select to authenticated using (erp.peut_lire());

grant select, insert, update, delete on erp.versions_annonce to authenticated;
