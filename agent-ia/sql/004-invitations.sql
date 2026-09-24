-- Authentification des conciergeries.
--
-- Un bot Telegram est public : n'importe qui peut lui écrire. Jusqu'ici seule
-- une liste de chat_id en variable d'environnement faisait barrage, ce qui ne
-- tient pas au-delà d'une cliente.
--
-- Mécanisme retenu, natif à Telegram : l'éditeur émet une invitation, la
-- cliente ouvre un lien `t.me/<bot>?start=<code>`, et son chat_id est rattaché
-- à sa conciergerie. Le code est à usage unique et se périme.

create table if not exists invitations (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  nom_conciergerie text not null,
  email            text,
  -- Rempli à l'usage : la conciergerie est créée au moment du rattachement.
  conciergerie_id  uuid references conciergeries(id) on delete set null,
  chat_id_utilise  text,
  utilise_le       timestamptz,
  emise_par        text,                     -- chat_id de l'éditeur
  cree_le          timestamptz not null default now(),
  expire_le        timestamptz not null default now() + interval '30 days'
);
create index if not exists invitations_code_idx on invitations(code);

-- Rôle « editeur » : celui qui peut inviter. Distinct de « proprietaire »,
-- qui ne voit que sa propre conciergerie.
alter table membres drop constraint if exists membres_role_check;
alter table membres add constraint membres_role_check
  check (role in ('editeur', 'proprietaire', 'equipe', 'prestataire'));

-- `channex_group_id` est unique : une chaîne vide entrerait en collision dès la
-- deuxième conciergerie enrôlée. On accepte donc NULL, et le groupe Channex
-- n'est créé qu'au premier besoin réel.
alter table conciergeries alter column channex_group_id drop not null;
update conciergeries set channex_group_id = null where channex_group_id = '';
