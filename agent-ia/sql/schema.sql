-- Schéma de l'agent IA — Label Maison Conciergerie
--
-- À exécuter une fois sur une base Postgres vierge (Supabase, Neon, ou autre).
-- Puis renseigner DATABASE_URL dans .env.local et dans Vercel.
--
-- Cloisonnement : chaque table métier porte `conciergerie_id`. C'est ce qui
-- empêche une requête mal écrite de traverser d'une cliente à l'autre.

create extension if not exists "pgcrypto";

-- Une conciergerie cliente. `channex_group_id` est son cloisonnement côté Channex.
create table if not exists conciergeries (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null,
  channex_group_id text unique,
  style_profil     text,           -- voix de la conciergerie, dérivée de ses vraies réponses
  style_exemples   jsonb default '[]'::jsonb,  -- échantillon de vraies réponses
  actif            boolean not null default true,
  cree_le          timestamptz not null default now()
);

-- Qui a le droit de parler à l'agent, et à quel titre.
create table if not exists membres (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  chat_id         text not null unique,   -- identifiant Telegram
  prenom          text,
  role            text not null default 'proprietaire'
                  check (role in ('proprietaire', 'equipe', 'prestataire')),
  cree_le         timestamptz not null default now()
);
create index if not exists membres_chat_id_idx on membres(chat_id);

create table if not exists logements (
  id                  uuid primary key default gen_random_uuid(),
  conciergerie_id     uuid not null references conciergeries(id) on delete cascade,
  nom                 text not null,
  ville               text,
  channex_property_id text unique,
  airbnb_connecte     boolean not null default false,
  booking_connecte    boolean not null default false,
  -- Ce que l'API ne donne pas et que seul le livret d'accueil contient.
  cle_boite           text,
  wifi_nom            text,
  wifi_code           text,
  heure_arrivee       text,
  heure_depart        text,
  consignes           text,
  actif               boolean not null default true,
  cree_le             timestamptz not null default now()
);
create index if not exists logements_conciergerie_idx on logements(conciergerie_id);

-- Base de connaissances : les questions récurrentes des voyageurs.
-- Stockée EN LIGNES, jamais en bloc de texte : le jour où le volume impose une
-- recherche des entrées pertinentes plutôt que tout envoyer au modèle, rien
-- n'est à réécrire.
create table if not exists connaissances (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  logement_id     uuid references logements(id) on delete cascade,  -- null = vaut pour tous
  question        text not null,
  reponse         text not null,
  langue          text default 'fr',
  source          text default 'manuel',  -- manuel | import | conversations_passees
  cree_le         timestamptz not null default now()
);
create index if not exists connaissances_conciergerie_idx on connaissances(conciergerie_id);
create index if not exists connaissances_logement_idx on connaissances(logement_id);

create table if not exists menages (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  logement_id     uuid not null references logements(id) on delete cascade,
  date            date not null,
  heure           text,
  statut          text not null default 'a_assigner'
                  check (statut in ('a_assigner', 'assigne', 'fait', 'annule')),
  prestataire_id  uuid,
  booking_ref     text,
  notes           text,
  cree_le         timestamptz not null default now()
);
create index if not exists menages_date_idx on menages(conciergerie_id, date);

create table if not exists prestataires (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  nom             text not null,
  telephone       text,
  cree_le         timestamptz not null default now()
);

-- Mémoire de conversation. C'est ce qui permet de comprendre « et demain ? »
-- et de reprendre un onboarding interrompu trois jours plus tôt.
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  chat_id         text not null,
  conciergerie_id uuid references conciergeries(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  contenu         jsonb not null,   -- blocs Anthropic complets, outils compris
  cree_le         timestamptz not null default now()
);
create index if not exists conversations_chat_idx on conversations(chat_id, cree_le desc);

-- Actions en attente de confirmation par bouton. Une écriture ARI part chez
-- Airbnb en quelques secondes : pas de retour en arrière silencieux possible.
create table if not exists actions_en_attente (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  chat_id         text not null,
  outil           text not null,
  arguments       jsonb not null,
  recap           text not null,
  statut          text not null default 'attente'
                  check (statut in ('attente', 'confirmee', 'refusee', 'expiree')),
  cree_le         timestamptz not null default now(),
  expire_le       timestamptz not null default now() + interval '1 hour'
);

-- Journal d'audit. Indispensable le jour où une cliente conteste une action.
create table if not exists actions_log (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid references conciergeries(id) on delete set null,
  chat_id         text,
  outil           text not null,
  arguments       jsonb,
  resultat        jsonb,
  cout_eur        numeric(10, 5),
  cree_le         timestamptz not null default now()
);
create index if not exists actions_log_date_idx on actions_log(cree_le desc);

-- Fils de messages voyageurs déjà traités, pour ne pas répondre deux fois.
create table if not exists messages_traites (
  thread_id       text not null,
  message_id      text not null,
  conciergerie_id uuid references conciergeries(id) on delete cascade,
  reponse_envoyee text,
  traite_le       timestamptz not null default now(),
  primary key (thread_id, message_id)
);
