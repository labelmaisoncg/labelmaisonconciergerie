-- Liens de connexion aux plateformes, servis sous notre propre domaine.
--
-- Deux raisons d'exister :
--  1. La conciergerie ne voit jamais « channex.io » — elle reste chez nous.
--  2. Le jeton Channex ne vit que 15 minutes. En le fabriquant à l'OUVERTURE
--     de la page plutôt qu'à l'envoi du message, un lien reçu le lundi et
--     ouvert le jeudi fonctionne encore.

create table if not exists liens_connexion (
  id                 uuid primary key default gen_random_uuid(),
  conciergerie_id    uuid not null references conciergeries(id) on delete cascade,
  logement_id        uuid not null references logements(id) on delete cascade,
  canal              text not null check (canal in ('airbnb', 'booking')),
  channex_canal_id   text,
  ouvert_le          timestamptz,
  cree_le            timestamptz not null default now(),
  expire_le          timestamptz not null default now() + interval '7 days'
);
create index if not exists liens_connexion_conciergerie_idx on liens_connexion(conciergerie_id);
