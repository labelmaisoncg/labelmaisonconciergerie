-- CIBLE FUTURE, NON APPLIQUÉE : ne pas lancer sur le projet actuel.
-- L'ERP en production utilise supabase/erp-installation.sql (voir supabase/migrations/README.md).
-- =============================================================================
-- ERP Label Maison : schéma Postgres miroir de src/erp/data/types.ts
--
-- Application :
--   supabase link --project-ref <ref>   puis   supabase db push
--   (ou coller ce fichier dans l'éditeur SQL du tableau de bord Supabase).
--
-- Conventions :
--   - schéma dédié « erp », identifiants uuid ;
--   - noms de colonnes en snake_case (ibanMasque -> iban_masque) ;
--   - montants en centimes, bigint, jamais de flottant pour l'argent ;
--   - énumérations en CHECK (plus simples à faire évoluer que des types enum) ;
--   - listes imbriquées du modèle TypeScript (lits, fiche, checklist, photos,
--     documents, lignes...) en jsonb, comme dans le front ;
--   - RLS activé partout : gérant et opérations ont tous les droits, lecture
--     seule pour « lecture », un prestataire ne voit que ses missions.
-- =============================================================================

create schema if not exists erp;

-- -------------------------------------------------------------- utilitaires

create or replace function erp.maj_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------ utilisateurs

create table erp.utilisateurs (
  id              uuid primary key references auth.users (id) on delete cascade,
  nom             text not null,
  email           text not null unique,
  role            text not null check (role in ('gerant', 'operations', 'prestataire', 'lecture')),
  prestataire_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Fonctions de rôle : security definer pour lire erp.utilisateurs sans
-- déclencher récursivement ses propres politiques RLS.
create or replace function erp.role_courant() returns text
language sql stable security definer set search_path = erp, public as $$
  select role from erp.utilisateurs where id = auth.uid()
$$;

create or replace function erp.est_equipe() returns boolean
language sql stable security definer set search_path = erp, public as $$
  select coalesce(erp.role_courant() in ('gerant', 'operations'), false)
$$;

create or replace function erp.peut_lire() returns boolean
language sql stable security definer set search_path = erp, public as $$
  select coalesce(erp.role_courant() in ('gerant', 'operations', 'lecture'), false)
$$;

create or replace function erp.prestataire_courant() returns uuid
language sql stable security definer set search_path = erp, public as $$
  select prestataire_id from erp.utilisateurs where id = auth.uid() and role = 'prestataire'
$$;

-- ------------------------------------------------------------- référentiel

create table erp.proprietaires (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('particulier', 'sci', 'societe')),
  nom          text not null,
  contact      jsonb not null default '{}'::jsonb,          -- { email, telephone }
  adresse      text not null default '',
  iban_masque  text not null default '',
  notes        text not null default '',
  cree_le      date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table erp.logements (
  id                      uuid primary key default gen_random_uuid(),
  nom                     text not null,
  adresse                 text not null,
  ville                   text not null,
  code_postal             text not null,
  type                    text not null check (type in ('studio', 'T1', 'T2', 'T3', 'T4', 'maison', 'autre')),
  surface_m2              integer not null check (surface_m2 > 0),
  capacite                integer not null check (capacite > 0),
  chambres                integer not null default 0,
  lits                    jsonb not null default '[]'::jsonb,   -- [{ type, nombre }]
  statut                  text not null default 'lancement' check (statut in ('lancement', 'actif', 'pause', 'sorti')),
  proprietaire_id         uuid not null references erp.proprietaires (id) on delete restrict,
  residence_principale    boolean not null default false,
  numero_enregistrement   text,
  dpe                     text check (dpe in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  serrure                 text not null check (serrure in ('connectee', 'boite_a_cles', 'cles')),
  fiche                   jsonb not null default '{}'::jsonb,   -- wifi, horaires, accès, règles, équipements
  dotation_linge          jsonb not null default '[]'::jsonb,   -- [{ article, quantite }]
  channex_property_id     text unique,
  annonces                jsonb not null default '[]'::jsonb,   -- [{ canal, url, connecte }]
  checklist_lancement     jsonb not null default '[]'::jsonb,   -- [{ cle, libelle, fait, preuve }]
  photo_url               text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index logements_proprietaire_idx on erp.logements (proprietaire_id);

create table erp.mandats (
  id                     uuid primary key default gen_random_uuid(),
  proprietaire_id        uuid not null references erp.proprietaires (id) on delete restrict,
  logement_id            uuid not null references erp.logements (id) on delete restrict,
  reference              text not null unique,
  statut                 text not null default 'brouillon' check (statut in ('brouillon', 'envoye', 'signe', 'resilie')),
  commission_pct         numeric(5, 2) not null check (commission_pct >= 0 and commission_pct <= 100),
  frais_menage_centimes  bigint not null default 0 check (frais_menage_centimes >= 0),
  date_debut             date not null,
  date_fin               date,
  periode_essai_fin      date,
  preavis_jours          integer not null default 90,
  signe_le               date,
  resilie_le             date,
  motif_resiliation      text,
  document_url           text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Règle §2.1 : un mandat signé porte sa date de signature.
  constraint mandat_signe_date check (statut <> 'signe' or signe_le is not null)
);
create index mandats_logement_idx on erp.mandats (logement_id);
create index mandats_proprietaire_idx on erp.mandats (proprietaire_id);

-- ------------------------------------------------------------ prestataires

create table erp.prestataires (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text not null,
  raison_sociale      text,
  siret               text,
  type                text not null check (type in ('menage', 'linge', 'maintenance', 'serrurier', 'autre')),
  telephone           text not null,
  email               text,
  zone                text[] not null default '{}',
  statut              text not null default 'actif' check (statut in ('actif', 'suspendu', 'sorti')),
  tarifs              jsonb not null default '[]'::jsonb,   -- [{ typeLogement, montantCentimes }]
  documents           jsonb not null default '[]'::jsonb,   -- [{ type, valideJusquau, url, statut }]
  note_moyenne        numeric(3, 2),
  missions_realisees  integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table erp.utilisateurs
  add constraint utilisateurs_prestataire_fk foreign key (prestataire_id) references erp.prestataires (id) on delete set null;

-- ----------------------------------------------------------- distribution

create table erp.reservations (
  id                               uuid primary key default gen_random_uuid(),
  logement_id                      uuid not null references erp.logements (id) on delete restrict,
  canal                            text not null check (canal in ('airbnb', 'booking', 'direct', 'autre')),
  voyageur                         jsonb not null,             -- { nom, pays, nbPersonnes }
  arrivee                          date not null,
  depart                           date not null,
  nuits                            integer generated always as (depart - arrivee) stored,
  statut                           text not null default 'confirmee' check (statut in ('confirmee', 'annulee', 'en_cours', 'terminee')),
  montant_brut_centimes            bigint not null check (montant_brut_centimes >= 0),
  commission_plateforme_centimes   bigint not null default 0,
  frais_menage_centimes            bigint not null default 0,
  note_voyageur                    numeric(2, 1) check (note_voyageur between 1 and 5),
  commentaire_voyageur             text,
  channex_booking_id               text unique,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  constraint reservation_dates check (depart > arrivee)
);
create index reservations_logement_arrivee_idx on erp.reservations (logement_id, arrivee);
create index reservations_logement_depart_idx on erp.reservations (logement_id, depart);

-- ------------------------------------------------------ relation voyageur

create table erp.fils_messages (
  id                  uuid primary key default gen_random_uuid(),
  reservation_id      uuid references erp.reservations (id) on delete set null,
  logement_id         uuid not null references erp.logements (id) on delete restrict,
  canal               text not null check (canal in ('airbnb', 'booking', 'direct', 'autre')),
  voyageur            text not null,
  statut              text not null default 'ouvert' check (statut in ('ouvert', 'escalade', 'clos')),
  messages            jsonb not null default '[]'::jsonb,   -- [{ id, auteur, texte, envoyeLe }]
  dernier_message_le  timestamptz not null default now(),
  traite_par          text not null default 'en_attente' check (traite_par in ('agent', 'humain', 'en_attente')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index fils_logement_date_idx on erp.fils_messages (logement_id, dernier_message_le desc);

-- -------------------------------------------------------------- opérations

create table erp.missions (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('menage', 'linge', 'controle', 'maintenance')),
  logement_id       uuid not null references erp.logements (id) on delete restrict,
  reservation_id    uuid references erp.reservations (id) on delete set null,
  prestataire_id    uuid references erp.prestataires (id) on delete set null,
  date              date not null,
  heure_debut       time not null,
  heure_fin_max     time not null,
  statut            text not null default 'a_attribuer'
                    check (statut in ('a_attribuer', 'attribuee', 'en_cours', 'a_valider', 'validee', 'refusee', 'annulee')),
  checklist         jsonb not null default '[]'::jsonb,   -- [{ libelle, fait }]
  photos            jsonb not null default '[]'::jsonb,   -- [{ url, moment, prisLe }]
  tarif_centimes    bigint not null default 0 check (tarif_centimes >= 0),
  controle_qualite  boolean not null default false,
  note_controle     smallint check (note_controle between 1 and 5),
  commentaire       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Règle §2.4 : pas de validation sans photos avant ET après.
  constraint mission_validee_photos check (
    statut <> 'validee' or type <> 'menage' or (
      jsonb_path_exists(photos, '$[*] ? (@.moment == "avant")') and
      jsonb_path_exists(photos, '$[*] ? (@.moment == "apres")')
    )
  )
);
create index missions_logement_date_idx on erp.missions (logement_id, date);
create index missions_prestataire_date_idx on erp.missions (prestataire_id, date);
create index missions_statut_idx on erp.missions (statut) where statut in ('a_attribuer', 'a_valider');

create table erp.mouvements_linge (
  id              uuid primary key default gen_random_uuid(),
  logement_id     uuid not null references erp.logements (id) on delete restrict,
  date            date not null,
  type            text not null check (type in ('sortie_sale', 'envoi_blanchisserie', 'retour_propre', 'mise_en_place', 'perte', 'rebut')),
  articles        jsonb not null default '[]'::jsonb,   -- [{ article, quantite }]
  prestataire_id  uuid references erp.prestataires (id) on delete set null,
  mission_id      uuid references erp.missions (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index mouvements_linge_logement_date_idx on erp.mouvements_linge (logement_id, date);

create table erp.incidents (
  id              uuid primary key default gen_random_uuid(),
  logement_id     uuid not null references erp.logements (id) on delete restrict,
  reservation_id  uuid references erp.reservations (id) on delete set null,
  date            date not null,
  categorie       text not null check (categorie in ('menage', 'linge', 'casse', 'panne', 'acces', 'voyageur', 'autre')),
  gravite         text not null check (gravite in ('faible', 'moyenne', 'haute')),
  description     text not null,
  statut          text not null default 'ouvert' check (statut in ('ouvert', 'en_cours', 'resolu')),
  responsable     text,
  cout_centimes   bigint check (cout_centimes >= 0),
  refacturable    text not null default 'aucun' check (refacturable in ('proprietaire', 'voyageur', 'prestataire', 'aucun')),
  preuves         text[] not null default '{}',
  resolu_le       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index incidents_logement_date_idx on erp.incidents (logement_id, date);

-- ------------------------------------------------------------------ finance

create table erp.factures (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,
  type                 text not null check (type in ('commission', 'menage', 'prestation', 'avoir')),
  destinataire         text not null check (destinataire in ('proprietaire', 'voyageur', 'autre')),
  proprietaire_id      uuid references erp.proprietaires (id) on delete restrict,
  date_emission        date not null,
  echeance             date not null,
  montant_ht_centimes  bigint not null,
  tva_pct              numeric(4, 2) not null default 20,
  statut               text not null default 'brouillon' check (statut in ('brouillon', 'emise', 'payee', 'en_retard', 'annulee')),
  payee_le             date,
  lignes               jsonb not null default '[]'::jsonb,   -- [{ libelle, quantite, puCentimes }]
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index factures_proprietaire_date_idx on erp.factures (proprietaire_id, date_emission);

create table erp.paiements_prestataires (
  id                uuid primary key default gen_random_uuid(),
  prestataire_id    uuid not null references erp.prestataires (id) on delete restrict,
  periode           text not null check (periode ~ '^\d{4}-\d{2}$'),
  missions          uuid[] not null default '{}',
  montant_centimes  bigint not null default 0,
  retenue_centimes  bigint not null default 0,
  motif_retenue     text,
  statut            text not null default 'a_payer' check (statut in ('a_payer', 'paye', 'bloque')),
  paye_le           date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (prestataire_id, periode)
);

create table erp.charges (
  id                uuid primary key default gen_random_uuid(),
  date              date not null,
  libelle           text not null,
  categorie         text not null check (categorie in ('linge', 'produits', 'transport', 'logiciel', 'assurance', 'serrurerie', 'autre')),
  montant_centimes  bigint not null,
  logement_id       uuid references erp.logements (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index charges_logement_date_idx on erp.charges (logement_id, date);

-- --------------------------------------------------------------- commercial

create table erp.prospects (
  id                              uuid primary key default gen_random_uuid(),
  nom                             text not null,
  ville                           text not null,
  source                          text not null check (source in ('seo', 'parrainage', 'cercle', 'reseau', 'appel_entrant', 'autre')),
  type_bien                       text not null default '',
  revenu_estime_annuel_centimes   bigint not null default 0,
  etape                           text not null default 'nouveau'
                                  check (etape in ('nouveau', 'contact', 'visite', 'proposition', 'negociation', 'signe', 'perdu')),
  prochaine_action                text,
  prochaine_action_le             date,
  responsable                     text not null default 'abdel' check (responsable in ('abdel', 'kamel')),
  notes                           text not null default '',
  cree_le                         date not null default current_date,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index prospects_etape_idx on erp.prospects (etape);

-- ------------------------------------------------------------------ journal

create table erp.journal (
  id          uuid primary key default gen_random_uuid(),
  horodatage  timestamptz not null default now(),
  auteur      text not null,
  action      text not null,
  entite      text not null,
  entite_id   text not null,
  details     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index journal_entite_idx on erp.journal (entite, entite_id);
create index journal_horodatage_idx on erp.journal (horodatage desc);

-- --------------------------------------------- triggers updated_at + RLS

do $$
declare
  t text;
begin
  foreach t in array array[
    'utilisateurs', 'proprietaires', 'logements', 'mandats', 'prestataires', 'reservations',
    'fils_messages', 'missions', 'mouvements_linge', 'incidents', 'factures',
    'paiements_prestataires', 'charges', 'prospects', 'journal'
  ] loop
    execute format('create trigger %I before update on erp.%I for each row execute function erp.maj_updated_at()', t || '_updated_at', t);
    execute format('alter table erp.%I enable row level security', t);
    -- Gérant et opérations : accès complet.
    execute format('create policy equipe_tout on erp.%I for all to authenticated using (erp.est_equipe()) with check (erp.est_equipe())', t);
    -- Rôle « lecture » (cabinet comptable...) : consultation seule.
    execute format('create policy lecture_seule on erp.%I for select to authenticated using (erp.peut_lire())', t);
  end loop;
end;
$$;

-- Le journal est un registre d'audit : ni modification ni suppression, même
-- pour l'équipe. On remplace la politique générique par insertion + lecture.
drop policy equipe_tout on erp.journal;
create policy equipe_insere on erp.journal for insert to authenticated with check (erp.est_equipe());

-- Chaque utilisateur lit sa propre fiche (nécessaire pour connaître son rôle).
create policy soi_meme on erp.utilisateurs for select to authenticated using (id = auth.uid());

-- Prestataire : lecture et mise à jour de ses seules missions (checklist,
-- photos, statut). Il ne peut ni se réattribuer ni changer de mission.
create policy prestataire_lit_ses_missions on erp.missions
  for select to authenticated
  using (prestataire_id is not null and prestataire_id = erp.prestataire_courant());

create policy prestataire_maj_ses_missions on erp.missions
  for update to authenticated
  using (prestataire_id is not null and prestataire_id = erp.prestataire_courant())
  with check (
    prestataire_id = erp.prestataire_courant()
    and statut in ('en_cours', 'a_valider')
  );

-- Prestataire : fiche des logements où il a une mission (adresse, accès).
create policy prestataire_lit_logements on erp.logements
  for select to authenticated
  using (exists (
    select 1 from erp.missions m
    where m.logement_id = logements.id and m.prestataire_id = erp.prestataire_courant()
  ));

-- Accès au schéma via l'API (PostgREST) : à ajouter aussi dans
-- Settings → API → Exposed schemas.
grant usage on schema erp to authenticated;
grant select, insert, update, delete on all tables in schema erp to authenticated;
grant execute on all functions in schema erp to authenticated;
