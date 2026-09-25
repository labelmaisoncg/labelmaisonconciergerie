-- Liens de connexion aux plateformes, servis sous notre propre domaine.
--
-- Deux raisons d'exister :
--  1. La conciergerie part de chez nous, et c'est chez nous qu'elle revient.
--  2. La session de connexion Repull est fabriquée à l'OUVERTURE de la page
--     plutôt qu'à l'envoi du message : un lien reçu le lundi et ouvert le
--     jeudi fonctionne encore.

create table if not exists liens_connexion (
  id                 uuid primary key default gen_random_uuid(),
  conciergerie_id    uuid not null references conciergeries(id) on delete cascade,
  logement_id        uuid references logements(id) on delete cascade,
  canal              text not null check (canal in ('airbnb', 'booking')),
  comptes_avant      jsonb,        -- comptes Repull déjà connectés à l'ouverture
  ouvert_le          timestamptz,
  finalise_le        timestamptz,  -- retour de Repull traité
  cree_le            timestamptz not null default now(),
  expire_le          timestamptz not null default now() + interval '7 days'
);
create index if not exists liens_connexion_conciergerie_idx on liens_connexion(conciergerie_id);
