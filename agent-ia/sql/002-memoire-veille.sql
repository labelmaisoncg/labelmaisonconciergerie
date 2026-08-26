-- Mémoire longue et veille autonome.
-- À exécuter après schema.sql.

-- Ce que l'agent a retenu, et qu'aucun historique de conversation ne
-- porterait : préférences, corrections, habitudes de la maison.
-- Distinct des `connaissances`, qui servent à répondre aux VOYAGEURS ;
-- ici c'est ce qu'il sait de la CONCIERGERIE elle-même.
create table if not exists souvenirs (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  contenu         text not null,
  categorie       text not null default 'fait'
                  check (categorie in ('preference', 'correction', 'fait', 'habitude')),
  cree_le         timestamptz not null default now(),
  vu_le           timestamptz not null default now()
);
create index if not exists souvenirs_conciergerie_idx on souvenirs(conciergerie_id);

-- Résumé de la conversation au-delà de la fenêtre relue. Sans lui, tout ce qui
-- précède les vingt derniers messages disparaît.
alter table conciergeries add column if not exists resume_conversation text;
alter table conciergeries add column if not exists resume_jusqua timestamptz;

-- Ce que la veille a déjà signalé. Sans cette trace, l'agent répéterait la
-- même alerte à chaque passage — et deviendrait insupportable en deux jours.
create table if not exists initiatives (
  id              uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  sujet           text not null,      -- clé de déduplication, ex. « fiche-incomplete:Studio »
  message         text not null,
  cree_le         timestamptz not null default now()
);
create unique index if not exists initiatives_sujet_idx on initiatives(conciergerie_id, sujet);
create index if not exists initiatives_date_idx on initiatives(cree_le desc);
