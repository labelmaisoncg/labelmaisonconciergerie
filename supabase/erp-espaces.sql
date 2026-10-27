-- =============================================================================
-- ERP : espaces séparés dans la même base (Label Maison, puis Sens…)
-- =============================================================================
--
-- Chaque ligne de l'ERP appartient désormais à un ESPACE. Un compte ne voit et
-- ne modifie que les espaces dont il est membre. L'espace de Label Maison
-- existe d'office et reçoit TOUTES les données actuelles : rien ne change pour
-- l'équipe, personne n'est déconnecté.
--
-- À coller en entier dans Supabase → SQL Editor → New query → Run, en DEUX
-- passes (même fichier, une seule ligne à changer plus bas) :
--
--   Passe 1 (tout de suite) : ajoute les espaces sans rien casser. L'ERP en
--     ligne (ancien comme nouveau code) continue de fonctionner normalement.
--   Passe 2 (au moins 24 h APRÈS le plus tardif des deux : la mise en ligne
--     du nouveau code ET la passe 1) : passe les clés des tables à
--     (espace, …), ce qui permet le même identifiant dans deux espaces.
--     Après la passe 2, ne savent plus écrire : l'ancien code, et une page du
--     nouveau code ouverte AVANT la passe 1 (elle se croit sur la base
--     d'avant jusqu'à son rechargement, qui a lieu chaque nuit). D'où les 24 h.
--
-- Un autre espace que Label Maison ne peut être créé qu'APRÈS la passe 2
-- (refus explicite avant) : avant, ses lignes techniques (repull/etat,
-- agent/etat…) heurteraient celles de Label Maison.
--
-- Nouveaux espaces : sur invitation de Label Maison seulement (Paramètres →
-- Espaces, erp.inviter_espace). La personne invitée crée son compte, l'active
-- avec le code à usage unique de son lien (erp.activer), puis crée son
-- espace depuis l'ERP (erp.creer_espace) et en devient gérante ; elle y
-- range elle-même sa clé Repull (erp.enregistrer_secret_espace, coffre).
--
-- Comptes : un membre n'est reconnu que par SON compte (erp.membres.uid),
-- jamais par la seule adresse. La passe 1 relie une fois les membres
-- d'aujourd'hui à leur compte confirmé ; les suivants s'activent avec le
-- code de leur invitation (erp.inviter_membre, erp.activer).
--
-- Idempotent : chaque passe peut être relancée sans risque.
-- Prérequis : supabase/erp-installation.sql déjà passé (ne PAS le relancer
-- ensuite : il refusera, et c'est voulu — relancez plutôt ce fichier).
--
-- Compte technique du serveur : avant la passe 1 (ou avant de la relancer),
-- créer dans Authentication → Users → Add user le compte
-- serveur@labelmaisoncg.fr (mot de passe long au choix, « Auto Confirm
-- User »), puis mettre ce mot de passe dans Vercel : ERP_SERVEUR_MOT_DE_PASSE.
-- Ce script lui donne son rôle. Il ne voit un espace que lorsque le serveur le
-- nomme (en-tête x-erp-espace) ; sans en-tête, il ne voit rien.
--
-- Le résultat (onglet « Results ») dit si tout est prêt : voir le bilan à la
-- fin. Retour en arrière : bloc en commentaire tout en bas.
-- =============================================================================

-- ▼▼▼ La seule ligne à modifier : '1' pour la passe 1, '2' pour la passe 2. ▼▼▼
select set_config('erp.passe', '1', false);
-- ▲▲▲ ---------------------------------------------------------------------- ▲▲▲

do $$
begin
  if coalesce(current_setting('erp.passe', true), '') not in ('1', '2') then
    raise exception 'Choisissez la passe en haut du fichier : ''1'' ou ''2''.';
  end if;
  if to_regclass('erp.enregistrements') is null then
    raise exception 'Base de l''ERP absente : lancez d''abord supabase/erp-installation.sql.';
  end if;
end;
$$;

-- --------------------------------------------------------------- espaces

create table if not exists erp.espaces (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique
                   check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(code) between 2 and 40),
  nom              text not null check (length(btrim(nom)) between 1 and 80),
  actif            boolean not null default true,
  -- Repull : identifiant du workspace de l'espace (en-tête X-Workspace-Id),
  -- quand il partage le compte Repull de Label Maison. Les clés propres à un
  -- espace vont dans le coffre (erp.ranger_secret), jamais ici.
  repull_workspace text check (repull_workspace is null or repull_workspace ~ '^[A-Za-z0-9_-]{1,64}$'),
  -- Réglages non secrets : {"agent": {"plafondMois": 300}, "repull": {"budgetMois": 400}}
  config           jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  cree_le          timestamptz not null default now()
);
comment on table erp.espaces is
  'Espaces de l''ERP (une équipe chacun). Label Maison : 4c4d0000-0000-4000-8000-000000000001.';

-- Identifiant fixe de l'espace Label Maison (le même dans le code : src/erp/data/espaces.ts).
create or replace function erp.id_label_maison() returns uuid
language sql immutable set search_path = ''
as $$ select '4c4d0000-0000-4000-8000-000000000001'::uuid $$;

insert into erp.espaces (id, code, nom)
values ('4c4d0000-0000-4000-8000-000000000001', 'label-maison', 'Label Maison')
on conflict (id) do nothing;

-- ------------------------------------------- colonne espace sur chaque table
-- Valeur par défaut constante : ajout instantané, toutes les lignes actuelles
-- vont à Label Maison, et l'ancien code (qui n'envoie pas d'espace) y écrit.

alter table erp.enregistrements      add column if not exists espace uuid not null
  default '4c4d0000-0000-4000-8000-000000000001' references erp.espaces (id);
alter table erp.etat_automatisations add column if not exists espace uuid not null
  default '4c4d0000-0000-4000-8000-000000000001' references erp.espaces (id);
alter table erp.membres              add column if not exists espace uuid not null
  default '4c4d0000-0000-4000-8000-000000000001' references erp.espaces (id);
alter table erp.historique           add column if not exists espace uuid not null
  default '4c4d0000-0000-4000-8000-000000000001' references erp.espaces (id);

-- La clé primaire d'une table contient-elle déjà la colonne espace (passe 2 faite) ?
create or replace function erp.cle_par_espace(p_table regclass) returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = p_table and c.contype = 'p' and a.attname = 'espace');
$$;
revoke all on function erp.cle_par_espace(regclass) from public, anon, authenticated;

-- Clés du nouveau code (espace, …). Elles coexistent avec les anciennes jusqu'à
-- la passe 2, qui en fait les clés primaires (après elle, rien à recréer).
do $$
begin
  if not erp.cle_par_espace('erp.enregistrements') then
    create unique index if not exists enregistrements_espace_cle on erp.enregistrements (espace, collection, id);
  end if;
  if not erp.cle_par_espace('erp.etat_automatisations') then
    create unique index if not exists etat_automatisations_espace_cle on erp.etat_automatisations (espace, id);
  end if;
  if not erp.cle_par_espace('erp.membres') then
    create unique index if not exists membres_espace_cle on erp.membres (espace, email);
  end if;
end;
$$;
create unique index if not exists membres_espace_email_minuscules on erp.membres (espace, lower(email));

-- ------------------------------------------ comptes liés aux membres
-- Un membre n'est reconnu que par SON compte (auth.users.id, colonne uid),
-- jamais par la seule adresse : quelqu'un qui créerait le premier un compte à
-- l'adresse d'un futur membre (puis le ferait confirmer par lui, qui attend
-- justement un e-mail) n'obtient rien. Une ligne sans compte lié s'active
-- avec le code à usage unique de son invitation (erp.activer), au moment où
-- la personne choisit son mot de passe ; lie_le date cette activation : les
-- jetons de session émis avant elle ne valent rien (erp.jeton_apres).
-- Une seule fois, à l'ajout de la colonne : les membres d'aujourd'hui sont
-- liés au compte confirmé de même adresse et entrent comme avant, sans code.
-- Relancer le fichier ne relie plus rien par l'adresse (cas particulier,
-- compte créé à la main dans Supabase : erp.lier_compte, SQL Editor).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'erp' and table_name = 'membres' and column_name = 'uid') then
    alter table erp.membres add column uid uuid;
    alter table erp.membres add column lie_le timestamptz;
    update erp.membres m set uid = u.id
      from auth.users u
     where lower(u.email) = lower(m.email) and u.email_confirmed_at is not null;
  end if;
end;
$$;
create index if not exists membres_uid on erp.membres (uid);

-- Adresse changée dans la fiche du membre : le lien au compte tombe (nouvelle invitation).
create or replace function erp.membre_adresse_changee() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if lower(new.email) is distinct from lower(old.email) then
    new.uid := null;
    new.lie_le := null;
  end if;
  return new;
end;
$$;
revoke all on function erp.membre_adresse_changee() from public, anon, authenticated;
drop trigger if exists membres_adresse_changee on erp.membres;
create trigger membres_adresse_changee before update of email on erp.membres
  for each row execute function erp.membre_adresse_changee();

-- Un autre espace que Label Maison s'ouvre après la passe 2 seulement : avant,
-- ses lignes techniques (repull/etat, agent/etat, etat_automatisations/global)
-- auraient la même clé que celles de Label Maison.
create or replace function erp.garder_espaces() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id <> erp.id_label_maison()
     and not erp.cle_par_espace('erp.enregistrements')
     and coalesce(current_setting('erp.recette', true), '') <> 'en_cours' then
    raise exception 'Passe 2 d''abord : un autre espace que Label Maison s''ouvre après la passe 2 de supabase/erp-espaces.sql.';
  end if;
  return new;
end;
$$;
revoke all on function erp.garder_espaces() from public, anon, authenticated;
drop trigger if exists espaces_apres_passe_2 on erp.espaces;
create trigger espaces_apres_passe_2 before insert or update of id on erp.espaces
  for each row execute function erp.garder_espaces();
create index if not exists historique_espace_element_idx on erp.historique (espace, collection, id, archive_le desc);

-- ------------------------------------------------------------- fonctions

-- Espace demandé par l'en-tête x-erp-espace (PostgREST le recopie dans
-- request.headers). null : pas d'en-tête. Valeur illisible : un espace qui
-- n'existe pas (on ne voit alors rien, plutôt que tout).
create or replace function erp.espace_entete() returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v text;
begin
  v := nullif(current_setting('request.headers', true), '')::json ->> 'x-erp-espace';
  if v is null then
    return null;
  end if;
  if v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return '00000000-0000-0000-0000-000000000000'::uuid;
  end if;
  return v::uuid;
exception when others then
  return '00000000-0000-0000-0000-000000000000'::uuid;
end;
$$;

-- Compte technique du serveur ? (app_metadata.erp_role, posé plus bas par ce
-- script ; un utilisateur ne peut jamais modifier son app_metadata.)
create or replace function erp.est_serveur() returns boolean
language sql stable set search_path = ''
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'erp_role', '') = 'serveur' $$;

-- Le jeton de session a-t-il été émis APRÈS cet instant (activation d'un
-- compte) ? Sans instant (membre lié d'office) : oui. Un jeton plus ancien,
-- celui de quelqu'un qui se serait connecté avant l'activation, ne vaut rien.
create or replace function erp.jeton_apres(p_instant timestamptz) returns boolean
language sql stable set search_path = ''
as $$
  select p_instant is null
      or coalesce(nullif(auth.jwt() ->> 'iat', '')::numeric, 0) > extract(epoch from p_instant);
$$;

-- Espaces (actifs) et rôle du compte connecté, restreints à l'espace de
-- l'en-tête s'il y en a un. Le compte serveur n'a que l'espace de l'en-tête,
-- avec les droits d'un gérant ; sans en-tête, aucun. Un membre l'est par SON
-- compte lié (uid), jamais par la seule adresse.
create or replace function erp.mes_espaces() returns table (espace uuid, role text)
language sql stable security definer set search_path = ''
as $$
  with e as (select erp.espace_entete() as entete, erp.est_serveur() as serveur)
  select s.id, 'gerant'::text
  from erp.espaces s, e
  where e.serveur and s.actif and s.id = e.entete
  union all
  select m.espace, m.role
  from erp.membres m
  join erp.espaces s on s.id = m.espace and s.actif, e
  where not e.serveur
    and m.uid is not null and m.uid = auth.uid()
    and erp.jeton_apres(m.lie_le)
    and (e.entete is null or m.espace = e.entete);
$$;

create or replace function erp.espaces_lecture() returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(espace), '{}') from erp.mes_espaces() where role in ('gerant', 'operations', 'lecture') $$;

create or replace function erp.espaces_ecriture() returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(espace), '{}') from erp.mes_espaces() where role in ('gerant', 'operations') $$;

create or replace function erp.espaces_gerant() returns uuid[]
language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(espace), '{}') from erp.mes_espaces() where role = 'gerant' $$;

-- Rôle et droits dans UN espace.
create or replace function erp.role_membre(p_espace uuid) returns text
language sql stable security definer set search_path = ''
as $$ select role from erp.mes_espaces() where espace = p_espace limit 1 $$;

create or replace function erp.acces_lecture(p_espace uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(erp.role_membre(p_espace) in ('gerant', 'operations', 'lecture'), false) $$;

create or replace function erp.acces_ecriture(p_espace uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(erp.role_membre(p_espace) in ('gerant', 'operations'), false) $$;

create or replace function erp.acces_gerant(p_espace uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(erp.role_membre(p_espace) = 'gerant', false) $$;

-- Anciennes fonctions sans espace (scripts d'avant) : l'espace de l'en-tête,
-- Label Maison à défaut. Plus aucune règle ne s'en sert.
create or replace function erp.role_membre() returns text
language sql stable security definer set search_path = ''
as $$ select erp.role_membre(coalesce(erp.espace_entete(), erp.id_label_maison())) $$;

create or replace function erp.acces_lecture() returns boolean
language sql stable security definer set search_path = ''
as $$ select erp.acces_lecture(coalesce(erp.espace_entete(), erp.id_label_maison())) $$;

create or replace function erp.acces_ecriture() returns boolean
language sql stable security definer set search_path = ''
as $$ select erp.acces_ecriture(coalesce(erp.espace_entete(), erp.id_label_maison())) $$;

create or replace function erp.acces_gerant() returns boolean
language sql stable security definer set search_path = ''
as $$ select erp.acces_gerant(coalesce(erp.espace_entete(), erp.id_label_maison())) $$;

-- Espace d'un fichier du stockage : premier dossier quand c'est l'identifiant
-- d'un espace (« <espace>/menages/… »), Label Maison sinon (fichiers d'avant).
create or replace function erp.espace_du_chemin(p_nom text) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.id from erp.espaces s
      where s.id = case
        when split_part(p_nom, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(p_nom, '/', 1)::uuid
      end),
    erp.id_label_maison());
$$;

-- Archive de l'ancienne version, avec son espace.
create or replace function erp.archiver_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into erp.historique (espace, collection, id, operation, donnees, maj_par)
    values (old.espace, old.collection, old.id, 'suppression', old.donnees, old.maj_par);
    return old;
  end if;
  if new.donnees is distinct from old.donnees then
    insert into erp.historique (espace, collection, id, operation, donnees, maj_par)
    values (old.espace, old.collection, old.id, 'modification', old.donnees, old.maj_par);
  end if;
  return new;
end;
$$;

revoke all on function erp.id_label_maison()       from public, anon;
revoke all on function erp.espace_entete()         from public, anon;
revoke all on function erp.est_serveur()           from public, anon;
revoke all on function erp.mes_espaces()           from public, anon;
revoke all on function erp.espaces_lecture()       from public, anon;
revoke all on function erp.espaces_ecriture()      from public, anon;
revoke all on function erp.espaces_gerant()        from public, anon;
revoke all on function erp.role_membre(uuid)       from public, anon;
revoke all on function erp.acces_lecture(uuid)     from public, anon;
revoke all on function erp.acces_ecriture(uuid)    from public, anon;
revoke all on function erp.acces_gerant(uuid)      from public, anon;
revoke all on function erp.espace_du_chemin(text)  from public, anon;
revoke all on function erp.jeton_apres(timestamptz) from public, anon;
revoke all on function erp.archiver_version()      from public, anon, authenticated;
grant execute on function erp.jeton_apres(timestamptz) to authenticated;
grant execute on function erp.id_label_maison()      to authenticated;
grant execute on function erp.espace_entete()        to authenticated;
grant execute on function erp.est_serveur()          to authenticated;
grant execute on function erp.mes_espaces()          to authenticated;
grant execute on function erp.espaces_lecture()      to authenticated;
grant execute on function erp.espaces_ecriture()     to authenticated;
grant execute on function erp.espaces_gerant()       to authenticated;
grant execute on function erp.role_membre(uuid)      to authenticated;
grant execute on function erp.acces_lecture(uuid)    to authenticated;
grant execute on function erp.acces_ecriture(uuid)   to authenticated;
grant execute on function erp.acces_gerant(uuid)     to authenticated;
grant execute on function erp.espace_du_chemin(text) to authenticated;

-- ------------------------------------- invitations à ouvrir un espace (table)
-- Un gérant de Label Maison invite une conciergerie : son nom et l'adresse de
-- la personne qui ouvrira l'espace. L'invitation porte l'empreinte SHA-256
-- d'un code à usage unique (envoyé dans le lien, jamais gardé en clair) ;
-- elle n'est rattachée à un compte (uid, lie_le) qu'avec ce code
-- (erp.activer), valable 14 jours, une fois. Aucune règle d'accès : seules
-- les fonctions plus bas la lisent ou l'écrivent.
create table if not exists erp.invitations_espace (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(btrim(email)) and length(email) between 3 and 200 and position('@' in email) > 1),
  nom         text not null check (length(btrim(nom)) between 1 and 80),
  cree_par    text,
  cree_le     timestamptz not null default now(),
  expire_le   timestamptz not null default now() + interval '14 days',
  annulee_le  timestamptz,
  utilisee_le timestamptz,
  -- Espace ouvert avec cette invitation (une fois utilisée).
  espace      uuid references erp.espaces (id) on delete set null
);
comment on table erp.invitations_espace is
  'Invitations de Label Maison à ouvrir un espace : liées à une adresse, 14 jours, usage unique (erp.creer_espace).';
-- Une seule invitation en attente par adresse (réinviter la renouvelle).
create unique index if not exists invitations_espace_en_attente on erp.invitations_espace (email)
  where utilisee_le is null and annulee_le is null;
alter table erp.invitations_espace add column if not exists empreinte text check (empreinte ~ '^[0-9a-f]{64}$');
alter table erp.invitations_espace add column if not exists uid uuid;
alter table erp.invitations_espace add column if not exists lie_le timestamptz;
alter table erp.invitations_espace enable row level security;
revoke all on erp.invitations_espace from anon, authenticated;

-- Invitations d'un membre de l'équipe (« Créer mon compte ») : l'empreinte
-- du code à usage unique envoyé dans le lien, l'espace et l'adresse de la
-- ligne de membre qu'il active (erp.activer). Aucune règle d'accès.
create table if not exists erp.invitations (
  empreinte  text primary key,
  espace     uuid references erp.espaces (id) on delete cascade,
  nom_espace text,
  email      text,
  role       text not null default 'gerant' check (role in ('gerant', 'operations', 'lecture')),
  cree_par   text,
  cree_le    timestamptz not null default now(),
  expire_le  timestamptz not null default now() + interval '7 days',
  utilise_le timestamptz
);
create index if not exists invitations_espace_email on erp.invitations (espace, lower(email));
alter table erp.invitations enable row level security;
revoke all on erp.invitations from anon, authenticated;

-- Empreinte d'un code d'invitation (SHA-256 en hexadécimal, comme le serveur).
create or replace function erp.empreinte_code(p_code text) returns text
language sql immutable set search_path = ''
as $$ select encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex') $$;
revoke all on function erp.empreinte_code(text) from public, anon, authenticated;

-- Adresse du compte connecté si elle est confirmée (lien reçu à
-- l'inscription), sinon null. Jamais pour le compte serveur. Pendant la
-- recette (transaction annulée), un compte fictif est confirmé s'il le dit.
create or replace function erp.email_confirme() returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if e = '' or erp.est_serveur() then
    return null;
  end if;
  if coalesce(current_setting('erp.recette', true), '') = 'en_cours' then
    return case when auth.jwt() ->> 'recette_confirme' = 'oui' then e end;
  end if;
  return (select e from auth.users u
          where u.id = auth.uid() and u.email_confirmed_at is not null and lower(u.email) = e
          limit 1);
end;
$$;
revoke all on function erp.email_confirme() from public, anon, authenticated;

-- ------------------------------------------------------- appels de l'ERP

-- Qui est connecté, dans quels espaces (l'ERP choisit l'espace à ouvrir), et
-- ses invitations à ouvrir un espace encore valables. Forme (lue telle quelle
-- par la page d'accès, middleware.ts, et par l'ERP) :
--   { "email": "…", "serveur": false,
--     "espaces": [ { "id", "code", "nom", "role" } ],
--     "invitations_espace": [ { "nom_espace": "Sens", "expire_le": "2026-11-03T10:00:00+00:00" } ],
--     "espaces_suspendus": [ { "nom": "Sens" } ],
--     "invitations_espace_closes": [ { "nom_espace": "Sens", "motif": "expiree" | "annulee" } ] }
-- Les deux dernières listes n'ouvrent rien : elles disent seulement pourquoi
-- un compte sans espace n'entre pas.
-- invitations_espace est toujours une liste : les invitations rattachées à CE
-- compte par leur code (erp.activer), encore valables ; vide sinon. Espaces
-- et invitations ne comptent que pour le compte lié (uid) et un jeton émis
-- après son activation : un compte créé par un autre à la même adresse n'y
-- voit rien. Un compte sans espace mais avec une invitation rattachée peut
-- entrer pour créer son espace (erp.creer_espace).
create or replace function erp.qui_suis_je() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'email', lower(coalesce(auth.jwt() ->> 'email', '')),
    'serveur', erp.est_serveur(),
    'espaces', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', s.id, 'code', s.code, 'nom', s.nom, 'role', m.role)
        order by (s.id = erp.id_label_maison()) desc, s.nom)
      from erp.membres m
      join erp.espaces s on s.id = m.espace and s.actif
      where not erp.est_serveur()
        and m.uid is not null and m.uid = auth.uid()
        and erp.jeton_apres(m.lie_le)
    ), '[]'::jsonb),
    'invitations_espace', coalesce((
      select jsonb_agg(jsonb_build_object('nom_espace', i.nom, 'expire_le', i.expire_le) order by i.cree_le desc)
      from erp.invitations_espace i
      where not erp.est_serveur()
        and i.uid is not null and i.uid = auth.uid()
        and erp.jeton_apres(i.lie_le)
        and i.utilisee_le is null and i.annulee_le is null and i.expire_le > now()
    ), '[]'::jsonb),
    -- Pour dire pourquoi on n'entre pas (sans rien ouvrir) : espaces suspendus
    -- du compte lié, et invitation d'espace expirée ou annulée de son adresse
    -- confirmée, quand aucune autre n'est valable.
    'espaces_suspendus', coalesce((
      select jsonb_agg(jsonb_build_object('nom', s.nom) order by s.nom)
      from erp.membres m
      join erp.espaces s on s.id = m.espace and not s.actif
      where not erp.est_serveur()
        and m.uid is not null and m.uid = auth.uid()
        and erp.jeton_apres(m.lie_le)
    ), '[]'::jsonb),
    'invitations_espace_closes', coalesce((
      select jsonb_agg(jsonb_build_object('nom_espace', i.nom,
               'motif', case when i.annulee_le is not null then 'annulee' else 'expiree' end) order by i.cree_le desc)
      from erp.invitations_espace i
      where not erp.est_serveur()
        and i.email = erp.email_confirme()
        and (i.uid is null or i.uid = auth.uid())
        and i.utilisee_le is null
        and (i.annulee_le is not null or i.expire_le <= now())
        and not exists (select 1 from erp.invitations_espace v
                         where v.email = i.email and v.utilisee_le is null and v.annulee_le is null and v.expire_le > now())
    ), '[]'::jsonb)
  );
$$;

-- Espaces actifs : tous pour le serveur (passages planifiés, webhooks), ceux
-- du compte sinon. Label Maison d'abord.
create or replace function erp.espaces_actifs()
returns table (id uuid, code text, nom text, repull_workspace text, config jsonb)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.code, s.nom, s.repull_workspace, s.config
  from erp.espaces s
  where s.actif
    and (erp.est_serveur() or s.id in (select m.espace from erp.mes_espaces() m))
  order by (s.id = erp.id_label_maison()) desc, s.cree_le;
$$;

-- Secret d'un espace rangé dans le coffre (Vault), pour le serveur seulement,
-- et seulement pour l'espace que nomme l'en-tête x-erp-espace. Label Maison
-- n'en a jamais : ses clés restent dans Vercel.
create or replace function erp.secret_espace(p_espace uuid, p_nom text) returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not erp.est_serveur() or p_nom not in ('repull_cle', 'repull_webhook') or p_espace = erp.id_label_maison()
     or p_espace is distinct from erp.espace_entete() then
    return null;
  end if;
  return (select d.decrypted_secret from vault.decrypted_secrets d
          where d.name = 'erp_' || p_espace::text || '_' || p_nom limit 1);
exception when others then
  return null;
end;
$$;

-- Ranger (ou remplacer) un secret d'un espace, depuis le SQL Editor :
--   select erp.ranger_secret('sens', 'repull_cle', 'sk_live_…');
create or replace function erp.ranger_secret(p_code text, p_nom text, p_valeur text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  e uuid;
  n text;
  s uuid;
begin
  select id into e from erp.espaces where code = p_code;
  if e is null then
    raise exception 'Espace inconnu : %', p_code;
  end if;
  if e = erp.id_label_maison() then
    raise exception 'Label Maison garde ses clés dans Vercel.';
  end if;
  if p_nom not in ('repull_cle', 'repull_webhook') then
    raise exception 'Secret inconnu : % (repull_cle ou repull_webhook).', p_nom;
  end if;
  if coalesce(btrim(p_valeur), '') = '' then
    raise exception 'Valeur vide.';
  end if;
  n := 'erp_' || e::text || '_' || p_nom;
  select id into s from vault.secrets where name = n;
  if s is null then
    perform vault.create_secret(btrim(p_valeur), n, 'ERP, espace ' || p_code || ' : ' || p_nom);
  else
    perform vault.update_secret(s, btrim(p_valeur));
  end if;
  return 'Secret rangé : ' || p_nom || ' de l''espace ' || p_code || '.';
end;
$$;

-- ------------------------------------------ espaces ouverts par invitation
-- Label Maison est la plateforme : seul un de ses gérants, en personne (pas
-- le compte serveur), invite une conciergerie, voit les espaces, suspend.
create or replace function erp.gerant_plateforme() returns boolean
language sql stable security definer set search_path = ''
as $$ select not erp.est_serveur() and erp.acces_gerant(erp.id_label_maison()) $$;
revoke all on function erp.gerant_plateforme() from public, anon, authenticated;

-- Nom d'un espace : 1 à 80 caractères, sans caractère de contrôle (retour à
-- la ligne compris), jamais « Label Maison » (casse et accents ignorés).
-- Rend le message d'erreur, ou null s'il convient.
create or replace function erp.nom_espace_refuse(p_nom text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when length(btrim(coalesce(p_nom, ''))) not between 1 and 80 then 'Nom de la conciergerie : entre 1 et 80 caractères.'
    when p_nom ~ '[[:cntrl:]]' then 'Nom de la conciergerie : une seule ligne, sans caractère spécial invisible.'
    when regexp_replace(lower(translate(p_nom,
           'ÀÂÄÁÃÅĀÇÉÈÊËĒÎÏÍÌĪÑÔÖÓÒÕØŌÛÜÚÙŪŸÝŒÆàâäáãåāçéèêëēîïíìīñôöóòõøōûüúùūÿýœæ',
           'AAAAAAACEEEEEIIIIINOOOOOOOUUUUUYYOAaaaaaaaceeeeeiiiiinooooooouuuuuyyoa')), '[^a-z0-9]', '', 'g') like 'labelmaison%'
      then 'Ce nom est réservé : choisissez celui de la conciergerie.'
  end;
$$;
revoke all on function erp.nom_espace_refuse(text) from public, anon, authenticated;

-- Inviter une conciergerie (ou renouveler son invitation en attente) :
-- 14 jours, liée à l'adresse, avec l'empreinte du code à usage unique que le
-- serveur envoie dans le lien (le code ne passe jamais par la base). Après la
-- passe 2 seulement. Renouveler remplace le code et détache tout compte.
create or replace function erp.inviter_espace(p_nom text, p_email text, p_empreinte text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  n text := btrim(coalesce(p_nom, ''));
  refus text := erp.nom_espace_refuse(p_nom);
  i erp.invitations_espace;
begin
  if not erp.gerant_plateforme() then
    raise exception 'Réservé aux gérants de Label Maison.' using errcode = '42501';
  end if;
  if not erp.cle_par_espace('erp.enregistrements') and coalesce(current_setting('erp.recette', true), '') <> 'en_cours' then
    raise exception 'Passe 2 d''abord : une conciergerie ouvre son espace après la passe 2 de supabase/erp-espaces.sql.';
  end if;
  if refus is not null then
    raise exception '%', refus using errcode = '22023';
  end if;
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(e) > 200 then
    raise exception 'Adresse e-mail invalide.';
  end if;
  if coalesce(p_empreinte, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Code d''invitation illisible.' using errcode = '22023';
  end if;
  -- Déjà membre d'un espace : l'ERP ouvrirait celui-là, jamais la création du sien.
  if exists (select 1 from erp.membres m where lower(m.email) = e) then
    raise exception 'Cette adresse a déjà accès à un espace de l''ERP : invitez une adresse propre à cette conciergerie.' using errcode = '22023';
  end if;
  update erp.invitations_espace
     set nom = n, cree_par = lower(auth.jwt() ->> 'email'), cree_le = now(), expire_le = now() + interval '14 days',
         empreinte = p_empreinte, uid = null, lie_le = null
   where email = e and utilisee_le is null and annulee_le is null
  returning * into i;
  if i.id is null then
    insert into erp.invitations_espace (email, nom, cree_par, empreinte)
    values (e, n, lower(auth.jwt() ->> 'email'), p_empreinte)
    returning * into i;
  end if;
  return jsonb_build_object('id', i.id, 'email', i.email, 'nom', i.nom, 'expire_le', i.expire_le);
end;
$$;
drop function if exists erp.inviter_espace(text, text);

-- Inviter un membre de l'équipe à activer son accès (« Créer mon compte ») :
-- gérant de l'espace, ligne de membre déjà ajoutée (Paramètres → Équipe) et
-- pas encore liée à un compte. Garde l'empreinte du code envoyé dans le lien
-- (14 jours, une fois) ; une nouvelle invitation remplace la précédente.
-- Ligne déjà liée : { "deja": true }, rien n'est gardé.
create or replace function erp.inviter_membre(p_espace uuid, p_email text, p_empreinte text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  m erp.membres;
  fin timestamptz := now() + interval '14 days';
begin
  if erp.est_serveur() or p_espace is null or not erp.acces_gerant(p_espace) then
    raise exception 'Réservé aux gérants de cet espace.' using errcode = '42501';
  end if;
  if coalesce(p_empreinte, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Code d''invitation illisible.' using errcode = '22023';
  end if;
  select * into m from erp.membres x where x.espace = p_espace and lower(x.email) = e limit 1;
  if m.email is null then
    raise exception 'Ajoutez d''abord cette adresse à l''équipe, puis envoyez l''invitation.' using errcode = '22023';
  end if;
  if m.uid is not null then
    return jsonb_build_object('deja', true);
  end if;
  delete from erp.invitations where espace = p_espace and lower(email) = e and utilise_le is null;
  insert into erp.invitations (empreinte, espace, email, role, cree_par, expire_le)
  values (p_empreinte, p_espace, e, case when m.role in ('gerant', 'operations', 'lecture') then m.role else 'lecture' end,
          lower(auth.jwt() ->> 'email'), fin);
  return jsonb_build_object('deja', false, 'expire_le', fin);
end;
$$;

-- Activer son accès avec le code de son invitation, au moment où l'on choisit
-- son mot de passe (la page d'accès le fait dans la même étape : un mot de
-- passe posé avant par quelqu'un d'autre cesse de valoir). Adresse confirmée,
-- même adresse que l'invitation, code valable et pas encore servi :
--   - invitation d'un membre : sa ligne est liée à CE compte (uid, lie_le) ;
--   - invitation à ouvrir un espace : elle est rattachée à CE compte, qui
--     peut ensuite créer l'espace (erp.creer_espace).
-- Le code est consommé ; les jetons émis avant l'activation ne valent rien
-- (erp.jeton_apres) : la session se renouvelle juste après. Tout autre cas :
-- refus (42501), le même message, quoi qu'il manque.
create or replace function erp.activer(p_code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e text := erp.email_confirme();
  h text;
  im erp.invitations;
  ie erp.invitations_espace;
begin
  if e is null or auth.uid() is null or coalesce(p_code, '') !~ '^[A-Za-z0-9_-]{20,100}$' then
    raise exception 'Invitation introuvable ou plus valable.' using errcode = '42501';
  end if;
  -- Un autre moyen d'entrer que l'adresse et le mot de passe (téléphone, autre
  -- fournisseur), ajouté avant l'activation par qui aurait ouvert le compte,
  -- survivrait au nouveau mot de passe et à la fermeture des sessions : refus.
  if exists (select 1 from auth.users u where u.id = auth.uid() and coalesce(u.phone, '') <> '')
     or exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider <> 'email') then
    raise exception 'Invitation introuvable ou plus valable.' using errcode = '42501';
  end if;
  h := erp.empreinte_code(p_code);
  select * into im from erp.invitations
   where empreinte = h and lower(email) = e and utilise_le is null and expire_le > now()
   for update;
  if im.empreinte is not null then
    update erp.membres set uid = auth.uid(), lie_le = now()
     where espace = im.espace and lower(email) = e and uid is null;
    if not found then
      raise exception 'Invitation introuvable ou plus valable.' using errcode = '42501';
    end if;
    update erp.invitations set utilise_le = now() where empreinte = h;
    return jsonb_build_object('genre', 'membre', 'espace', im.espace);
  end if;
  select * into ie from erp.invitations_espace
   where empreinte = h and email = e and uid is null
     and utilisee_le is null and annulee_le is null and expire_le > now()
   for update;
  if ie.id is not null then
    update erp.invitations_espace set uid = auth.uid(), lie_le = now() where id = ie.id;
    return jsonb_build_object('genre', 'espace', 'nom', ie.nom);
  end if;
  raise exception 'Invitation introuvable ou plus valable.' using errcode = '42501';
end;
$$;

-- SQL Editor seulement : lier à la main le compte confirmé d'une adresse à sa
-- ligne de membre (compte créé par un gérant dans Supabase, sans invitation) :
--   select erp.lier_compte('prenom@exemple.fr', 'label-maison');
create or replace function erp.lier_compte(p_email text, p_code_espace text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  u uuid;
begin
  select id into u from auth.users where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if u is null then
    raise exception 'Aucun compte confirmé pour %.', p_email;
  end if;
  update erp.membres m set uid = u, lie_le = null
    from erp.espaces s
   where s.id = m.espace and s.code = p_code_espace and lower(m.email) = lower(btrim(p_email));
  if not found then
    raise exception 'Aucune ligne de membre pour % dans %.', p_email, p_code_espace;
  end if;
  return 'Compte lié : ' || lower(btrim(p_email)) || ' (' || p_code_espace || ').';
end;
$$;
revoke all on function erp.lier_compte(text, text) from public, anon, authenticated;

-- Annuler une invitation en attente.
create or replace function erp.annuler_invitation_espace(p_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not erp.gerant_plateforme() then
    raise exception 'Réservé aux gérants de Label Maison.' using errcode = '42501';
  end if;
  update erp.invitations_espace set annulee_le = now()
   where id = p_id and utilisee_le is null and annulee_le is null;
  return found;
end;
$$;

-- Suspendre (actif = false) ou rouvrir un espace ; jamais Label Maison.
-- Suspendu : ses membres, ses propriétaires et ses équipes n'y entrent plus,
-- ses passages planifiés s'arrêtent ; rien n'est effacé.
create or replace function erp.suspendre_espace(p_espace uuid, p_actif boolean) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not erp.gerant_plateforme() then
    raise exception 'Réservé aux gérants de Label Maison.' using errcode = '42501';
  end if;
  if p_espace is null or p_espace = erp.id_label_maison() then
    raise exception 'L''espace de Label Maison ne se suspend pas.' using errcode = '42501';
  end if;
  update erp.espaces set actif = coalesce(p_actif, false) where id = p_espace;
  return found;
end;
$$;

-- Espaces (tous, suspendus compris) et invitations en attente, pour les
-- gérants de Label Maison.
create or replace function erp.espaces_plateforme() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not erp.gerant_plateforme() then
    raise exception 'Réservé aux gérants de Label Maison.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'espaces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'code', s.code, 'nom', s.nom, 'actif', s.actif, 'cree_le', s.cree_le,
        'contact', (select j.email from erp.invitations_espace j where j.espace = s.id order by j.utilisee_le desc limit 1),
        'membres', (select count(*) from erp.membres m where m.espace = s.id))
        order by (s.id = erp.id_label_maison()) desc, s.cree_le)
      from erp.espaces s), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'nom', i.nom, 'cree_le', i.cree_le, 'expire_le', i.expire_le,
        'expiree', i.expire_le <= now())
        order by i.cree_le desc)
      from erp.invitations_espace i
      where i.utilisee_le is null and i.annulee_le is null), '[]'::jsonb));
end;
$$;

-- Créer l'espace de sa conciergerie, avec l'invitation rattachée à SON
-- compte par le code du lien (erp.activer), au nom donné par Label Maison :
-- l'espace est créé, la personne en devient gérante, l'invitation est
-- consommée. Idempotent : un nouvel appel (double clic, coupure) rend
-- l'espace déjà créé, jamais un second. Sans invitation activée par ce
-- compte (code jamais saisi, autre compte à la même adresse, jeton d'avant
-- l'activation) : refusé.
drop function if exists erp.creer_espace(text);
create or replace function erp.creer_espace() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e text := erp.email_confirme();
  i erp.invitations_espace;
  s erp.espaces;
  n text;
  base text;
  c text;
  k int := 1;
begin
  if e is null or auth.uid() is null then
    raise exception 'Confirmez d''abord votre adresse e-mail (lien reçu à l''inscription), puis reconnectez-vous.' using errcode = '42501';
  end if;
  -- Verrou sur l'invitation : deux appels simultanés ne créent qu'un espace.
  select * into i from erp.invitations_espace
   where email = e and uid = auth.uid() and erp.jeton_apres(lie_le)
     and utilisee_le is null and annulee_le is null and expire_le > now()
   order by cree_le desc
   limit 1
   for update;
  if i.id is null then
    -- Déjà créé avec une invitation de ce compte, et toujours gérant : le même espace.
    select s2.* into s
      from erp.invitations_espace j
      join erp.espaces s2 on s2.id = j.espace
     where j.uid = auth.uid() and j.utilisee_le is not null
       and exists (select 1 from erp.membres m where m.espace = s2.id and m.uid = auth.uid()
                     and erp.jeton_apres(m.lie_le) and m.role = 'gerant')
     order by j.utilisee_le desc
     limit 1;
    if s.id is not null then
      return jsonb_build_object('id', s.id, 'code', s.code, 'nom', s.nom, 'deja', true);
    end if;
    raise exception 'Aucune invitation valable pour ce compte : ouvrez le lien de l''invitation reçue par e-mail, ou demandez-en une nouvelle à Label Maison.' using errcode = '42501';
  end if;
  n := btrim(i.nom);
  if erp.nom_espace_refuse(n) is not null then
    raise exception '%', erp.nom_espace_refuse(n) using errcode = '22023';
  end if;
  -- Code lisible tiré du nom (« Sens » → « sens », « Côte & Mer » → « cote-mer »).
  base := lower(translate(n,
    'ÀÂÄÁÃÅĀÇÉÈÊËĒÎÏÍÌĪÑÔÖÓÒÕØŌÛÜÚÙŪŸÝŒÆàâäáãåāçéèêëēîïíìīñôöóòõøōûüúùūÿýœæ',
    'AAAAAAACEEEEEIIIIINOOOOOOOUUUUUYYOAaaaaaaaceeeeeiiiiinooooooouuuuuyyoa'));
  base := btrim(left(btrim(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '-'), 36), '-');
  if length(base) < 2 then
    base := 'espace';
  end if;
  c := base;
  while exists (select 1 from erp.espaces x where x.code = c) loop
    k := k + 1;
    c := base || '-' || k;
  end loop;
  insert into erp.espaces (code, nom) values (c, n) returning * into s;
  -- Lié à ce compte depuis l'activation de l'invitation : sa session (renouvelée
  -- juste après l'activation) ouvre l'espace sans nouvelle connexion.
  insert into erp.membres (espace, email, nom, role, uid, lie_le) values (s.id, e, null, 'gerant', auth.uid(), i.lie_le);
  update erp.invitations_espace set utilisee_le = now(), espace = s.id where id = i.id;
  return jsonb_build_object('id', s.id, 'code', s.code, 'nom', s.nom, 'deja', false);
end;
$$;

-- Secrets d'un espace (sa clé Repull, le secret de son webhook) rangés dans
-- le coffre par un gérant de CET espace (ou le compte serveur avec l'en-tête
-- de l'espace). Jamais pour Label Maison (ses clés restent dans Vercel), et
-- jamais relus par le navigateur : erp.reglages_repull_espace dit seulement
-- s'ils sont enregistrés.
create or replace function erp.enregistrer_secret_espace(p_espace uuid, p_nom text, p_valeur text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_valeur, ''));
  n text;
  s uuid;
begin
  if p_espace is null or p_espace = erp.id_label_maison() then
    raise exception 'Label Maison garde ses clés dans Vercel.' using errcode = '42501';
  end if;
  if not erp.acces_gerant(p_espace) then
    raise exception 'Réservé aux gérants de cet espace.' using errcode = '42501';
  end if;
  if p_nom not in ('repull_cle', 'repull_webhook') then
    raise exception 'Secret inconnu : % (repull_cle ou repull_webhook).', p_nom;
  end if;
  if v = '' or length(v) > 500 or v ~ '[[:space:]]' then
    raise exception 'Valeur vide ou illisible : collez la clé telle que Repull la donne.';
  end if;
  n := 'erp_' || p_espace::text || '_' || p_nom;
  select id into s from vault.secrets where name = n;
  if s is null then
    perform vault.create_secret(v, n, 'ERP, espace ' || p_espace::text || ' : ' || p_nom);
  else
    perform vault.update_secret(s, v);
  end if;
  return true;
end;
$$;

-- Workspace Repull de SA clé (facultatif ; vide : aucun). Distinct de la
-- colonne repull_workspace, qui désigne un workspace sur le compte Repull de
-- Label Maison et que seul Label Maison déclare (SQL Editor).
create or replace function erp.regler_repull_espace(p_espace uuid, p_workspace text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  w text := btrim(coalesce(p_workspace, ''));
begin
  if p_espace is null or p_espace = erp.id_label_maison() then
    raise exception 'Label Maison garde ses réglages Repull dans Vercel.' using errcode = '42501';
  end if;
  if not erp.acces_gerant(p_espace) then
    raise exception 'Réservé aux gérants de cet espace.' using errcode = '42501';
  end if;
  if w <> '' and w !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'Numéro de workspace illisible : lettres, chiffres, « - » ou « _ ».';
  end if;
  update erp.espaces
     set config = config || jsonb_build_object('repull',
           case when w = '' then coalesce(config -> 'repull', '{}'::jsonb) - 'workspace'
                else coalesce(config -> 'repull', '{}'::jsonb) || jsonb_build_object('workspace', w) end)
   where id = p_espace;
  return found;
end;
$$;

-- Réglages Repull d'un espace, pour ses gérants : clé et secret du webhook
-- enregistrés ou non (jamais leur valeur), workspace de sa clé, code (adresse
-- de son webhook).
create or replace function erp.reglages_repull_espace(p_espace uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_espace is null or p_espace = erp.id_label_maison() or not erp.acces_gerant(p_espace) then
    raise exception 'Réservé aux gérants de cet espace.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'code', s.code,
      'workspace', s.config -> 'repull' ->> 'workspace',
      'cle', exists (select 1 from vault.secrets v where v.name = 'erp_' || s.id::text || '_repull_cle'),
      'webhook', exists (select 1 from vault.secrets v where v.name = 'erp_' || s.id::text || '_repull_webhook'))
    from erp.espaces s where s.id = p_espace);
end;
$$;

revoke all on function erp.qui_suis_je()                      from public, anon;
revoke all on function erp.espaces_actifs()                   from public, anon;
revoke all on function erp.secret_espace(uuid, text)          from public, anon;
revoke all on function erp.ranger_secret(text, text, text)    from public, anon, authenticated;
revoke all on function erp.inviter_espace(text, text, text)            from public, anon;
revoke all on function erp.inviter_membre(uuid, text, text)            from public, anon;
revoke all on function erp.activer(text)                               from public, anon;
revoke all on function erp.annuler_invitation_espace(uuid)             from public, anon;
revoke all on function erp.suspendre_espace(uuid, boolean)             from public, anon;
revoke all on function erp.espaces_plateforme()                        from public, anon;
revoke all on function erp.creer_espace()                              from public, anon;
revoke all on function erp.enregistrer_secret_espace(uuid, text, text) from public, anon;
revoke all on function erp.regler_repull_espace(uuid, text)            from public, anon;
revoke all on function erp.reglages_repull_espace(uuid)                from public, anon;
grant execute on function erp.qui_suis_je()             to authenticated;
grant execute on function erp.espaces_actifs()          to authenticated;
grant execute on function erp.secret_espace(uuid, text) to authenticated;
grant execute on function erp.inviter_espace(text, text, text)            to authenticated;
grant execute on function erp.inviter_membre(uuid, text, text)            to authenticated;
grant execute on function erp.activer(text)                               to authenticated;
grant execute on function erp.annuler_invitation_espace(uuid)             to authenticated;
grant execute on function erp.suspendre_espace(uuid, boolean)             to authenticated;
grant execute on function erp.espaces_plateforme()                        to authenticated;
grant execute on function erp.creer_espace()                              to authenticated;
grant execute on function erp.enregistrer_secret_espace(uuid, text, text) to authenticated;
grant execute on function erp.regler_repull_espace(uuid, text)            to authenticated;
grant execute on function erp.reglages_repull_espace(uuid)                to authenticated;

-- ------------------------------------------------------------ sécurité (RLS)
-- Toutes les règles portent sur la colonne espace : on ne voit que les lignes
-- des espaces dont on est membre (et de l'en-tête, s'il y en a un).
-- « (select …)::uuid[] » : calculé une fois par requête, pas une fois par ligne.

alter table erp.espaces enable row level security;
drop policy if exists "membres lisent leurs espaces" on erp.espaces;
create policy "membres lisent leurs espaces" on erp.espaces for select to authenticated
  using (id = any ((select erp.espaces_lecture())::uuid[]));

-- enregistrements
drop policy if exists "membres lisent"     on erp.enregistrements;
drop policy if exists "membres ajoutent"   on erp.enregistrements;
drop policy if exists "membres modifient"  on erp.enregistrements;
drop policy if exists "membres suppriment" on erp.enregistrements;
drop policy if exists "connecteurs reserves aux gerants" on erp.enregistrements;
drop policy if exists "acces exterieurs reserves aux gerants" on erp.enregistrements;
drop policy if exists "cloison des espaces" on erp.enregistrements;
create policy "membres lisent"     on erp.enregistrements for select to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]));
create policy "membres ajoutent"   on erp.enregistrements for insert to authenticated
  with check (espace = any ((select erp.espaces_ecriture())::uuid[]));
create policy "membres modifient"  on erp.enregistrements for update to authenticated
  using (espace = any ((select erp.espaces_ecriture())::uuid[]))
  with check (espace = any ((select erp.espaces_ecriture())::uuid[]));
create policy "membres suppriment" on erp.enregistrements for delete to authenticated
  using (espace = any ((select erp.espaces_ecriture())::uuid[]));
-- Collection technique « connecteurs » (jetons de Claude) : gérants de l'espace seulement.
create policy "connecteurs reserves aux gerants" on erp.enregistrements
  as restrictive for all to authenticated
  using (collection <> 'connecteurs' or espace = any ((select erp.espaces_gerant())::uuid[]))
  with check (collection <> 'connecteurs' or espace = any ((select erp.espaces_gerant())::uuid[]));
-- Accès des propriétaires et des opérations (adresses, empreintes des liens),
-- relances de paiement et leurs réglages : gérants de l'espace (et le compte
-- serveur, gérant de l'espace nommé) seulement, en lecture comme en écriture.
-- Sans cette règle, un compte « opérations » pourrait écrire un accès avec
-- l'empreinte d'un jeton qu'il connaît et entrer dans l'espace d'un propriétaire.
create policy "acces exterieurs reserves aux gerants" on erp.enregistrements
  as restrictive for all to authenticated
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances')
         or espace = any ((select erp.espaces_gerant())::uuid[]))
  with check (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances')
              or espace = any ((select erp.espaces_gerant())::uuid[]));
-- Écritures réservées aux gérants de l'espace (et au compte serveur, gérant de
-- l'espace nommé) ; la lecture ne change pas. Ce sont :
--   - ce que seul le serveur écrit : envois des messages automatiques et leur
--     état (envoisProgrammes, programmes), état de l'agent (agent : verrou,
--     appels de l'IA du mois), état de la synchronisation (repull), passages
--     des factures mensuelles (passagesFacturesMensuelles), état du passage
--     des prix (conseilsPrix/etat), alerte « l'agent ne vérifie plus ses
--     réponses » (reglages/alerte-controle-agent : l'équipe la lit) ;
--   - ce que seul un gérant change dans l'ERP : factures (validation,
--     numéro), réglages des prix (conseilsPrix/reglages), modèles des
--     messages automatiques, identité de la société et numérotation des
--     factures (reglages : messages-programmes, societe, numerotation-factures).
-- Sans cette règle, un compte « opérations » pourrait, par l'API, réécrire un
-- message automatique (il partirait à tous les voyageurs), glisser un envoi
-- « en cours » avec le texte de son choix, poser un verrou sans fin, remettre
-- à zéro le compteur de l'IA ou numéroter une facture. Restent à l'équipe :
-- avis à déposer (« fait », « passé »), décisions sur les prix conseillés et
-- réglages de l'agent (ton, signature, langues, Telegram ; le reste : déclencheur plus bas).
create or replace function erp.ecriture_gerant_seulement(p_collection text, p_id text) returns boolean
language sql immutable set search_path = ''
as $$
  select p_collection in ('envoisProgrammes', 'programmes', 'agent', 'repull', 'factures', 'passagesFacturesMensuelles', 'annoncesEquipe')
      or (p_collection = 'conseilsPrix' and p_id in ('reglages', 'etat'))
      or (p_collection = 'reglages' and p_id in ('messages-programmes', 'societe', 'numerotation-factures', 'alerte-controle-agent'))
$$;
revoke all on function erp.ecriture_gerant_seulement(text, text) from public, anon;
grant execute on function erp.ecriture_gerant_seulement(text, text) to authenticated;
drop policy if exists "ecritures reservees aux gerants (ajout)" on erp.enregistrements;
drop policy if exists "ecritures reservees aux gerants (modification)" on erp.enregistrements;
drop policy if exists "ecritures reservees aux gerants (suppression)" on erp.enregistrements;
create policy "ecritures reservees aux gerants (ajout)" on erp.enregistrements
  as restrictive for insert to authenticated
  with check (not erp.ecriture_gerant_seulement(collection, id) or espace = any ((select erp.espaces_gerant())::uuid[]));
create policy "ecritures reservees aux gerants (modification)" on erp.enregistrements
  as restrictive for update to authenticated
  using (not erp.ecriture_gerant_seulement(collection, id) or espace = any ((select erp.espaces_gerant())::uuid[]))
  with check (not erp.ecriture_gerant_seulement(collection, id) or espace = any ((select erp.espaces_gerant())::uuid[]));
-- Supprimer : les mêmes, et les réglages de l'agent (les retirer rendrait son niveau d'autonomie par défaut).
create policy "ecritures reservees aux gerants (suppression)" on erp.enregistrements
  as restrictive for delete to authenticated
  using ((not erp.ecriture_gerant_seulement(collection, id) and not (collection = 'reglages' and id = 'agent'))
         or espace = any ((select erp.espaces_gerant())::uuid[]));

-- Réglages de l'agent réservés au gérant (reglages, élément « agent ») : marche
-- ou pause (actif), ce qu'il envoie seul (autonomie), ses horaires, ce qu'il
-- vous confie (transmettre) et le délai avant de vous prévenir
-- (delaiAlerteMinutes) ; même liste que REGLAGES_AGENT_GERANT
-- (src/erp/data/messagerie-ia.ts). Le reste (ton, signature, langues,
-- Telegram) reste à l'équipe. Une règle RLS ne compare pas l'avant et l'après
-- d'une ligne : c'est ce déclencheur qui refuse (42501). Ajout sans ligne
-- enregistrée : aucune de ces clés. Nom gardé (garder_autonomie_agent) pour
-- les installations existantes.
create or replace function erp.garder_autonomie_agent() returns trigger
language plpgsql set search_path = ''
as $$
declare
  cles constant text[] := array['actif', 'autonomie', 'horaires', 'transmettre', 'delaiAlerteMinutes'];
  avant jsonb;
  k text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.collection = 'reglages' and old.id = 'agent'
     and (new.collection <> 'reglages' or new.id <> 'agent' or new.espace is distinct from old.espace) and not erp.acces_gerant(old.espace) then
    raise exception 'Seul un gérant change ces réglages de l''agent.' using errcode = '42501';
  end if;
  if new.collection <> 'reglages' or new.id <> 'agent' or erp.acces_gerant(new.espace) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.collection = 'reglages' and old.id = 'agent' and old.espace is not distinct from new.espace then
    avant := old.donnees;
  else
    -- Ajout (ou ajout qui devient modification) : la ligne déjà là fait foi ; aucune : rien.
    select e.donnees into avant from erp.enregistrements e
      where e.espace = new.espace and e.collection = 'reglages' and e.id = 'agent';
  end if;
  avant := coalesce(avant, '{}'::jsonb);
  foreach k in array cles loop
    if (new.donnees -> k) is distinct from (avant -> k) then
      raise exception 'Seul un gérant change ces réglages de l''agent.' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function erp.garder_autonomie_agent() from public, anon;
drop trigger if exists garder_autonomie_agent on erp.enregistrements;
create trigger garder_autonomie_agent before insert or update on erp.enregistrements
  for each row execute function erp.garder_autonomie_agent();

-- Numéro de facture comparable : sans blancs autour (espaces, tabulations,
-- retours à la ligne, espaces insécables ou invisibles) ; vide si absent. Le
-- même partout : index d'unicité, numérotation et gardes des factures.
create or replace function erp.numero_normalise(p text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''),
    '^[[:space:]' || chr(160) || chr(8199) || chr(8203) || chr(8239) || chr(65279) || ']+|[[:space:]'
      || chr(160) || chr(8199) || chr(8203) || chr(8239) || chr(65279) || ']+$', '', 'g')
$$;
revoke all on function erp.numero_normalise(text) from public, anon;
grant execute on function erp.numero_normalise(text) to authenticated;

-- Factures : numéro attribué par la base, à la suite, jamais deux fois
-- (numérotation continue et unique exigée par la loi). Appel du navigateur :
-- rpc('numeroter_facture', { p_id }) avec l'en-tête de l'espace. Gérant de
-- l'espace seulement. En une transaction : verrou du compteur de l'espace
-- (reglages / numerotation-factures, créé s'il manque), numéro = le plus
-- grand de l'année (compteur ou factures de l'espace) + 1, au format
-- AAAA-NNNN (année de la date d'émission, sinon d'aujourd'hui à Paris), écrit
-- sur la facture avec le statut « émise » et l'heure de validation, compteur
-- mis à jour. Déjà numérotée : son numéro est rendu, rien ne change.
create or replace function erp.numeroter_facture(p_id text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_espace constant uuid := coalesce(erp.espace_entete(), erp.id_label_maison());
  v_facture jsonb;
  v_compteur jsonb;
  v_numero text;
  v_annee text;
  v_texte text;
  v_dernier int;
  v_max int;
  v_suite int;
  v_local timestamp;
  v_le text;
begin
  if not erp.acces_gerant(v_espace) then
    raise exception 'Seul un gérant de l''espace numérote une facture.' using errcode = '42501';
  end if;
  -- Compteur de l'espace, verrouillé : deux validations simultanées se suivent.
  insert into erp.enregistrements (espace, collection, id, donnees, maj_par)
    values (v_espace, 'reglages', 'numerotation-factures', '{"id": "numerotation-factures", "derniers": {}}', 'numerotation#serveur')
    on conflict do nothing;
  select e.donnees into v_compteur from erp.enregistrements e
    where e.espace = v_espace and e.collection = 'reglages' and e.id = 'numerotation-factures' for update;
  select e.donnees into v_facture from erp.enregistrements e
    where e.espace = v_espace and e.collection = 'factures' and e.id = p_id for update;
  if v_facture is null then
    raise exception 'Facture introuvable.' using errcode = 'P0002';
  end if;
  v_numero := erp.numero_normalise(v_facture ->> 'numero');
  if v_numero <> '' then
    return v_numero;
  end if;
  if coalesce(v_facture ->> 'statut', '') = 'annulee' then
    raise exception 'Facture annulée : elle ne reçoit pas de numéro.' using errcode = '22023';
  end if;
  v_local := now() at time zone 'Europe/Paris';
  v_annee := substr(coalesce(v_facture ->> 'dateEmission', ''), 1, 4);
  if v_annee !~ '^\d{4}$' then
    v_annee := to_char(v_local, 'YYYY');
  end if;
  v_texte := v_compteur -> 'derniers' ->> v_annee;
  v_dernier := case when v_texte ~ '^\d{1,9}$' then v_texte::int else 0 end;
  -- Numéros lus sans espaces autour, comme l'index unique qui les compare.
  select coalesce(max((substring(erp.numero_normalise(e.donnees ->> 'numero') from '^\d{4}-(\d{4,9})$'))::int), 0) into v_max
    from erp.enregistrements e
    where e.espace = v_espace and e.collection = 'factures' and erp.numero_normalise(e.donnees ->> 'numero') ~ ('^' || v_annee || '-\d{4,9}$');
  v_suite := greatest(v_dernier, v_max) + 1;
  v_numero := v_annee || '-' || lpad(v_suite::text, 4, '0');
  -- Heure de Paris avec son décalage, au format de l'ERP (« 2026-11-02T10:30:00+01:00 »).
  v_le := to_char(v_local, 'YYYY-MM-DD"T"HH24:MI:SS') || '+' || to_char(v_local - (now() at time zone 'UTC'), 'HH24:MI');
  -- Seule écriture qui pose un numéro (erp.reserver_numero_facture), le temps de cette mise à jour.
  perform set_config('erp.numerotation', 'on', true);
  update erp.enregistrements e
    set donnees = v_facture || jsonb_build_object('numero', v_numero, 'statut', 'emise')
                  || case when jsonb_typeof(v_facture -> 'mensuelle') = 'object'
                       then jsonb_build_object('mensuelle', (v_facture -> 'mensuelle') || jsonb_build_object('valideeLe', v_le))
                       else '{}'::jsonb end,
        maj_le = now(),
        maj_par = coalesce(nullif(auth.jwt() ->> 'email', ''), 'gerant') || '#numerotation'
    where e.espace = v_espace and e.collection = 'factures' and e.id = p_id;
  perform set_config('erp.numerotation', 'off', true);
  update erp.enregistrements e
    set donnees = coalesce(v_compteur, '{}'::jsonb)
                  || jsonb_build_object('id', 'numerotation-factures', 'majLe', v_le,
                       'derniers', coalesce(v_compteur -> 'derniers', '{}'::jsonb) || jsonb_build_object(v_annee, v_suite)),
        maj_le = now(),
        maj_par = coalesce(nullif(auth.jwt() ->> 'email', ''), 'gerant') || '#numerotation'
    where e.espace = v_espace and e.collection = 'reglages' and e.id = 'numerotation-factures';
  return v_numero;
end;
$$;
revoke all on function erp.numeroter_facture(text) from public, anon;
grant execute on function erp.numeroter_facture(text) to authenticated;

-- Facture numérotée : plus rien ne change, sauf le paiement (statut émise,
-- payée ou en retard, date de paiement) et le partage (partageeLe) ; elle ne
-- se supprime pas (une erreur se corrige par un avoir). Les relances vivent
-- dans leur propre collection. Ne vise que les écritures par l'API ; le
-- numéro lui-même est posé par erp.numeroter_facture (propriétaire de la base).
create or replace function erp.figer_facture_numerotee() returns trigger
language plpgsql set search_path = ''
as $$
declare
  libres constant text[] := array['statut', 'payeeLe', 'partageeLe'];
begin
  if current_user <> 'authenticated' or old.collection <> 'factures'
     or erp.numero_normalise(old.donnees ->> 'numero') = '' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Facture numérotée : elle ne se supprime pas (faites un avoir).' using errcode = 'LMF01';
  end if;
  if (to_jsonb(new) - 'donnees' - 'maj_le' - 'maj_par') is distinct from (to_jsonb(old) - 'donnees' - 'maj_le' - 'maj_par')
     or (new.donnees - libres) is distinct from (old.donnees - libres)
     or (coalesce(new.donnees ->> 'statut', '') not in ('emise', 'payee', 'en_retard')
         and (new.donnees -> 'statut') is distinct from (old.donnees -> 'statut')) then
    raise exception 'Facture numérotée : seuls le paiement et le partage changent encore.' using errcode = 'LMF01';
  end if;
  return new;
end;
$$;
revoke all on function erp.figer_facture_numerotee() from public, anon;
drop trigger if exists figer_facture_numerotee on erp.enregistrements;
create trigger figer_facture_numerotee before update or delete on erp.enregistrements
  for each row execute function erp.figer_facture_numerotee();

-- Numéro d'une facture : posé par erp.numeroter_facture seulement (elle
-- l'annonce par set_config('erp.numerotation', 'on', true) le temps de son
-- écriture). Toute autre écriture par l'API qui pose, change ou efface un
-- numéro est refusée (LMF02), gérant compris : un navigateur ne donne jamais
-- un numéro, même déjà pris. Ajout d'une facture déjà enregistrée : laissé
-- passer ici (« on conflict do nothing » reste silencieux ; « on conflict do
-- update » passe par la vérification de la modification) ; nouvelle facture :
-- sans numéro.
create or replace function erp.reserver_numero_facture() returns trigger
language plpgsql set search_path = ''
as $$
declare
  avant text := '';
begin
  if current_user <> 'authenticated' or new.collection <> 'factures'
     or coalesce(current_setting('erp.numerotation', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.collection = 'factures' and old.id = new.id and old.espace is not distinct from new.espace then
      avant := erp.numero_normalise(old.donnees ->> 'numero');
    end if;
  else
    -- Ligne déjà là, verrouillée le temps de l'ajout (elle ne disparaît pas entre ce test et le conflit).
    perform 1 from erp.enregistrements e
      where e.espace = new.espace and e.collection = 'factures' and e.id = new.id for key share;
    if found then
      return new;
    end if;
  end if;
  if erp.numero_normalise(new.donnees ->> 'numero') is distinct from avant then
    raise exception 'Facture : son numéro est attribué par la base à la validation (erp.numeroter_facture), jamais écrit directement.'
      using errcode = 'LMF02';
  end if;
  return new;
end;
$$;
revoke all on function erp.reserver_numero_facture() from public, anon;
drop trigger if exists reserver_numero_facture on erp.enregistrements;
create trigger reserver_numero_facture before insert or update on erp.enregistrements
  for each row execute function erp.reserver_numero_facture();

-- Une donnée ne change jamais d'espace par l'API (aucun écran ne le fait :
-- chaque écriture vise son espace, clé espace + collection + id). Sans cela,
-- un membre de deux espaces pourrait vider l'un au profit de l'autre (ex. les
-- réglages de l'agent, qui reviendraient aux valeurs par défaut). Refus 42501.
create or replace function erp.garder_espace_enregistrement() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.espace is distinct from old.espace then
    raise exception 'Une donnée ne change pas d''espace.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function erp.garder_espace_enregistrement() from public, anon;
drop trigger if exists garder_espace_enregistrement on erp.enregistrements;
create trigger garder_espace_enregistrement before update on erp.enregistrements
  for each row execute function erp.garder_espace_enregistrement();

-- Deux factures d'un même espace ne partagent jamais un numéro (index unique
-- partiel). Créé seulement si les données le permettent : sinon un
-- avertissement liste les numéros en double (colonne numeros_factures du
-- bilan), à corriger avant de relancer ce fichier ; la passe continue.
-- L'index d'avant les espaces (numéro seul) est retiré : chaque espace a sa
-- propre suite.
drop index if exists erp.enregistrements_numero_facture;
do $$
declare
  v_doublons text;
begin
  if to_regclass('erp.enregistrements_numero_facture_espace') is not null then
    if pg_get_indexdef('erp.enregistrements_numero_facture_espace'::regclass) like '%numero_normalise%' then
      return;
    end if;
    -- Index d'une version précédente (btrim seul) : recréé avec la normalisation de la numérotation.
    drop index erp.enregistrements_numero_facture_espace;
  end if;
  select string_agg(format('%s (%s fois)', d.numero, d.n), ', ' order by d.numero) into v_doublons
    from (select erp.numero_normalise(e.donnees ->> 'numero') as numero, count(*) as n from erp.enregistrements e
          where e.collection = 'factures' and erp.numero_normalise(e.donnees ->> 'numero') <> ''
          group by e.espace, erp.numero_normalise(e.donnees ->> 'numero') having count(*) > 1) d;
  if v_doublons is not null then
    raise warning 'Factures : numéros en double dans un même espace (%) ; index d''unicité pas créé. Corrigez-les, puis relancez ce fichier.', v_doublons;
    return;
  end if;
  create unique index enregistrements_numero_facture_espace on erp.enregistrements (espace, (erp.numero_normalise(donnees ->> 'numero')))
    where collection = 'factures' and erp.numero_normalise(donnees ->> 'numero') <> '';
end;
$$;
-- Cloison : RESTRICTIVE, elle tient même si une règle plus large est ajoutée un jour.
create policy "cloison des espaces" on erp.enregistrements
  as restrictive for all to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]))
  with check (espace = any ((select erp.espaces_ecriture())::uuid[]));

-- etat_automatisations
drop policy if exists "membres lisent"    on erp.etat_automatisations;
drop policy if exists "membres ajoutent"  on erp.etat_automatisations;
drop policy if exists "membres modifient" on erp.etat_automatisations;
drop policy if exists "cloison des espaces" on erp.etat_automatisations;
create policy "membres lisent"    on erp.etat_automatisations for select to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]));
create policy "membres ajoutent"  on erp.etat_automatisations for insert to authenticated
  with check (espace = any ((select erp.espaces_ecriture())::uuid[]));
create policy "membres modifient" on erp.etat_automatisations for update to authenticated
  using (espace = any ((select erp.espaces_ecriture())::uuid[]))
  with check (espace = any ((select erp.espaces_ecriture())::uuid[]));
create policy "cloison des espaces" on erp.etat_automatisations
  as restrictive for all to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]))
  with check (espace = any ((select erp.espaces_ecriture())::uuid[]));

-- membres : chacun lit sa propre ligne, l'équipe lit les membres de son
-- espace, seul un gérant de l'espace ajoute, modifie ou retire.
drop policy if exists "chacun lit sa ligne"    on erp.membres;
drop policy if exists "equipe lit les membres" on erp.membres;
drop policy if exists "gerant ajoute"  on erp.membres;
drop policy if exists "gerant modifie" on erp.membres;
drop policy if exists "gerant retire"  on erp.membres;
drop policy if exists "cloison des espaces" on erp.membres;
-- Sa ligne : celle liée à SON compte (pas une ligne à son adresse que
-- quelqu'un d'autre aurait activée, ni une ligne pas encore activée), avec un
-- jeton émis après l'activation (comme le reste des données).
create policy "chacun lit sa ligne"    on erp.membres for select to authenticated
  using (uid is not null and uid = auth.uid() and erp.jeton_apres(lie_le));
create policy "equipe lit les membres" on erp.membres for select to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]));
create policy "gerant ajoute"  on erp.membres for insert to authenticated
  with check (espace = any ((select erp.espaces_gerant())::uuid[]));
create policy "gerant modifie" on erp.membres for update to authenticated
  using (espace = any ((select erp.espaces_gerant())::uuid[]))
  with check (espace = any ((select erp.espaces_gerant())::uuid[]));
create policy "gerant retire"  on erp.membres for delete to authenticated
  using (espace = any ((select erp.espaces_gerant())::uuid[]));
create policy "cloison des espaces" on erp.membres
  as restrictive for all to authenticated
  using (erp.espace_entete() is null or espace = erp.espace_entete())
  with check (espace = any ((select erp.espaces_gerant())::uuid[]));

-- historique : lecture seule, espace par espace.
drop policy if exists "membres lisent" on erp.historique;
drop policy if exists "versions reservees aux gerants" on erp.historique;
create policy "membres lisent" on erp.historique for select to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]));
-- Anciennes versions des collections réservées aux gérants (accès extérieurs,
-- relances, connecteurs) : gérants de l'espace seulement, comme les
-- enregistrements (sinon un compte « lecture » ou « opérations » y lirait
-- adresses et empreintes des liens).
create policy "versions reservees aux gerants" on erp.historique
  as restrictive for select to authenticated
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances', 'connecteurs')
         or espace = any ((select erp.espaces_gerant())::uuid[]));

-- ------------------------------------------------------------------ droits

revoke all on erp.espaces from anon;
grant select on erp.espaces to authenticated;
-- Le lien d'un membre à son compte (uid, lie_le) ne s'écrit que par
-- l'activation (erp.activer) : l'ERP ajoute et modifie les autres colonnes.
revoke insert, update on erp.membres from authenticated;
grant insert (espace, email, nom, role), update (espace, email, nom, role) on erp.membres to authenticated;

-- ------------------------------------------- fichiers (photos, guides…)
-- Même bucket privé ; un fichier appartient à l'espace de son premier dossier.

do $$
begin
  execute 'drop policy if exists "erp fichiers lecture" on storage.objects';
  execute 'drop policy if exists "erp fichiers ajout" on storage.objects';
  execute 'drop policy if exists "erp fichiers modification" on storage.objects';
  execute 'drop policy if exists "erp fichiers suppression" on storage.objects';
  execute $p$create policy "erp fichiers lecture" on storage.objects for select to authenticated
    using (bucket_id = 'erp-fichiers' and erp.espace_du_chemin(name) = any ((select erp.espaces_lecture())::uuid[]))$p$;
  execute $p$create policy "erp fichiers ajout" on storage.objects for insert to authenticated
    with check (bucket_id = 'erp-fichiers' and erp.espace_du_chemin(name) = any ((select erp.espaces_ecriture())::uuid[]))$p$;
  execute $p$create policy "erp fichiers modification" on storage.objects for update to authenticated
    using (bucket_id = 'erp-fichiers' and erp.espace_du_chemin(name) = any ((select erp.espaces_ecriture())::uuid[]))
    with check (bucket_id = 'erp-fichiers' and erp.espace_du_chemin(name) = any ((select erp.espaces_ecriture())::uuid[]))$p$;
  execute $p$create policy "erp fichiers suppression" on storage.objects for delete to authenticated
    using (bucket_id = 'erp-fichiers' and erp.espace_du_chemin(name) = any ((select erp.espaces_ecriture())::uuid[]))$p$;
exception when others then
  raise notice 'Règles des fichiers non mises à jour (%) : relancez ce script.', sqlerrm;
end;
$$;

-- --------------------------------------------------- compte du serveur
-- Rôle technique posé sur le compte serveur@labelmaisoncg.fr s'il existe déjà
-- (sinon : le créer, puis relancer ce script).

do $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"erp_role": "serveur"}'::jsonb
   where lower(email) = 'serveur@labelmaisoncg.fr'
     and coalesce(raw_app_meta_data ->> 'erp_role', '') <> 'serveur';
  -- Le compte serveur n'est jamais membre d'un espace (il passe par l'en-tête).
  delete from erp.membres where lower(email) = 'serveur@labelmaisoncg.fr';
exception when others then
  raise notice 'Rôle du compte serveur non posé (%).', sqlerrm;
end;
$$;

-- ----------------------------------------------------------------- passe 2
-- Clés primaires (espace, …) et plus de valeur par défaut : chaque écriture
-- dit son espace. Seulement quand le nouveau code est en ligne depuis 24 h.

do $$
declare
  t record;
  pk text;
begin
  if current_setting('erp.passe', true) <> '2' then
    return;
  end if;
  for t in
    select * from (values
      ('enregistrements', 'enregistrements_espace_cle'),
      ('etat_automatisations', 'etat_automatisations_espace_cle'),
      ('membres', 'membres_espace_cle')
    ) as v (tbl, idx)
  loop
    select c.conname into pk
    from pg_constraint c
    where c.conrelid = format('erp.%I', t.tbl)::regclass and c.contype = 'p';
    -- Déjà fait si la clé primaire contient la colonne espace.
    if not erp.cle_par_espace(format('erp.%I', t.tbl)::regclass) then
      if pk is not null then
        execute format('alter table erp.%I drop constraint %I, add constraint %I primary key using index %I', t.tbl, pk, t.tbl || '_pkey', t.idx);
      else
        execute format('alter table erp.%I add constraint %I primary key using index %I', t.tbl, t.tbl || '_pkey', t.idx);
      end if;
    end if;
  end loop;
  -- Une adresse peut maintenant être membre de plusieurs espaces.
  drop index if exists erp.membres_email_minuscules;
  alter table erp.enregistrements      alter column espace drop default;
  alter table erp.etat_automatisations alter column espace drop default;
  alter table erp.membres              alter column espace drop default;
  alter table erp.historique           alter column espace drop default;
end;
$$;

notify pgrst, 'reload schema';

-- ----------------------------------------------------------------- recette
-- Essai des règles avec des comptes fictifs, dans une transaction annulée :
-- rien n'est gardé. Renvoie « ok » ou la première anomalie.

create or replace function erp.recette_espaces() returns text
language plpgsql set search_path = ''
as $$
declare
  lm constant uuid := erp.id_label_maison();
  essai constant uuid := 'e55a1000-0000-4000-8000-0000000000e5';
  resultat text := 'ok';
  n int;
  k text;
  membres_par_espace boolean;
  j jsonb;
  cree uuid;
  -- Comptes fictifs (auth.users.id) et instants d'émission des jetons :
  -- « ancien » avant les activations faites ici, « neuf » après.
  u_lm constant uuid := 'e55a1000-0000-4000-8000-00000000a001';
  u_autre constant uuid := 'e55a1000-0000-4000-8000-00000000a002';
  u_plateforme constant uuid := 'e55a1000-0000-4000-8000-00000000a003';
  u_invite constant uuid := 'e55a1000-0000-4000-8000-00000000a004';
  u_nouveau constant uuid := 'e55a1000-0000-4000-8000-00000000a005';
  u_intrus constant uuid := 'e55a1000-0000-4000-8000-00000000a006';
  ancien constant bigint := floor(extract(epoch from now()))::bigint - 60;
  neuf constant bigint := floor(extract(epoch from now()))::bigint + 5;
  -- Codes d'invitation (le serveur en tire 43 caractères au hasard).
  c_membre constant text := 'recette-membre-0123456789abcdefghijklmnopq';
  c_espace constant text := 'recette-espace-0123456789abcdefghijklmnopq';
  c_expire constant text := 'recette-expire-0123456789abcdefghijklmnopq';
  c_expire_espace constant text := 'recette-expesp-0123456789abcdefghijklmnopq';
  c_faux constant text := 'recette-faux00-0123456789abcdefghijklmnopq';
  h_membre constant text := encode(sha256(convert_to(c_membre, 'UTF8')), 'hex');
  h_espace constant text := encode(sha256(convert_to(c_espace, 'UTF8')), 'hex');
  h_autre constant text := encode(sha256(convert_to('recette-autre0-0123456789abcdefghijklmnopq', 'UTF8')), 'hex');
  jeton constant text := '{"role": "authenticated", "email": "%s", "sub": "%s", "iat": %s%s}';
  j_lm constant text := format(jeton, 'recette-lm@exemple.invalid', u_lm, ancien, '');
  -- Même adresse qu'un membre, autre compte (créé par quelqu'un d'autre).
  j_lm_autre_compte constant text := format(jeton, 'recette-lm@exemple.invalid', u_intrus, neuf, ', "recette_confirme": "oui"');
  j_autre constant text := format(jeton, 'recette-autre@exemple.invalid', u_autre, ancien, ', "recette_confirme": "oui"');
  j_plateforme constant text := format(jeton, 'plateforme-recette@exemple.invalid', u_plateforme, ancien, '');
  j_serveur constant text := format(jeton, 'serveur@labelmaisoncg.fr', u_intrus, ancien, ', "app_metadata": {"erp_role": "serveur"}');
  j_sans constant text := format(jeton, 'sans-invitation@exemple.invalid', u_intrus, ancien, ', "recette_confirme": "oui"');
  j_expire constant text := format(jeton, 'expire-recette@exemple.invalid', u_intrus, ancien, ', "recette_confirme": "oui"');
  j_invite_non_confirme constant text := format(jeton, 'invite-recette@exemple.invalid', u_invite, ancien, '');
  j_invite_ancien constant text := format(jeton, 'invite-recette@exemple.invalid', u_invite, ancien, ', "recette_confirme": "oui"');
  j_invite constant text := format(jeton, 'invite-recette@exemple.invalid', u_invite, neuf, ', "recette_confirme": "oui"');
  j_nouveau_ancien constant text := format(jeton, 'recette-nouveau@exemple.invalid', u_nouveau, ancien, ', "recette_confirme": "oui"');
  j_nouveau constant text := format(jeton, 'recette-nouveau@exemple.invalid', u_nouveau, neuf, ', "recette_confirme": "oui"');
  j_nouveau_autre_compte constant text := format(jeton, 'recette-nouveau@exemple.invalid', u_intrus, neuf, ', "recette_confirme": "oui"');
  j_intrus constant text := format(jeton, 'intrus@exemple.invalid', u_intrus, neuf, ', "recette_confirme": "oui"');
begin
  begin
    -- Données d'essai : un espace, un membre dans chaque espace, une ligne chacun
    -- (l'espace d'essai est permis avant la passe 2 : tout est annulé à la fin).
    perform set_config('erp.recette', 'en_cours', true);
    insert into erp.espaces (id, code, nom) values (essai, 'recette-espaces', 'Recette');
    -- Membres liés à leur compte (comme ceux d'aujourd'hui, liés à la passe 1),
    -- et un membre ajouté à l'équipe, pas encore activé.
    insert into erp.membres (espace, email, nom, role, uid) values
      (lm, 'recette-lm@exemple.invalid', 'Recette LM', 'operations', u_lm),
      (essai, 'recette-autre@exemple.invalid', 'Recette autre', 'gerant', u_autre),
      (lm, 'plateforme-recette@exemple.invalid', 'Recette plateforme', 'gerant', u_plateforme),
      (essai, 'recette-nouveau@exemple.invalid', 'Recette nouveau', 'operations', null);
    -- Codes expirés : celui du nouveau membre, celui d'une invitation d'espace
    -- (une valable est créée plus bas par un gérant de Label Maison).
    insert into erp.invitations (empreinte, espace, email, role, expire_le)
    values (encode(sha256(convert_to(c_expire, 'UTF8')), 'hex'), essai, 'recette-nouveau@exemple.invalid', 'operations', now() - interval '1 day');
    insert into erp.invitations_espace (email, nom, cree_le, expire_le, empreinte)
    values ('expire-recette@exemple.invalid', 'Recette expirée', now() - interval '20 days', now() - interval '6 days',
            encode(sha256(convert_to(c_expire_espace, 'UTF8')), 'hex'));
    insert into erp.enregistrements (espace, collection, id, donnees) values
      (lm, 'recette', 'ligne-lm', '{"id": "ligne-lm"}'),
      (lm, 'accesProprietaires', 'recette', '{"id": "recette"}'),
      (essai, 'recette', 'ligne-autre', '{"id": "ligne-autre"}'),
      (essai, 'accesProprietaires', 'recette-version', '{"id": "recette-version"}');
    -- Anciennes versions d'accès : une dans chaque espace (l'enregistrement de
    -- l'autre espace est retiré, seule sa version reste).
    update erp.enregistrements set donnees = '{"id": "recette", "v": 2}' where espace = lm and collection = 'accesProprietaires' and id = 'recette';
    delete from erp.enregistrements where espace = essai and collection = 'accesProprietaires' and id = 'recette-version';
    -- Écritures réservées aux gérants : une ligne de chaque. Les ids des
    -- réglages sont les vrais : une ligne déjà là est gardée telle quelle
    -- (tout est annulé à la fin). Factures d'essai en 2099 : aucun vrai numéro.
    insert into erp.enregistrements (espace, collection, id, donnees) values
      (lm, 'envoisProgrammes', 'recette-envoi', '{"id": "recette-envoi"}'),
      (lm, 'reglages', 'messages-programmes', '{"id": "messages-programmes"}'),
      (lm, 'reglages', 'societe', '{"id": "societe"}'),
      (lm, 'conseilsPrix', 'reglages', '{"id": "reglages"}'),
      (lm, 'reglages', 'agent', '{"id": "agent"}'),
      (lm, 'factures', 'recette-fm-1', '{"id": "recette-fm-1", "numero": "", "statut": "brouillon", "dateEmission": "2099-01-15", "montantHtCentimes": 100, "mensuelle": {"mois": "2098-12"}}'),
      (lm, 'factures', 'recette-fm-2', '{"id": "recette-fm-2", "numero": "", "statut": "brouillon", "dateEmission": "2099-01-16", "montantHtCentimes": 200, "mensuelle": {"mois": "2098-12"}}'),
      -- Ancienne facture au numéro entouré de blancs (tabulation, espace insécable) : la suite part après elle (2099-0002).
      (lm, 'factures', 'recette-fm-0', jsonb_build_object('id', 'recette-fm-0', 'numero', chr(9) || '2099-0001' || chr(160), 'statut', 'payee'))
    on conflict do nothing;
    -- Deux factures d'un espace ne partagent pas un numéro (index unique), même
    -- écrites par le propriétaire de la base ; un autre espace a sa propre suite.
    if to_regclass('erp.enregistrements_numero_facture_espace') is not null then
      insert into erp.enregistrements (espace, collection, id, donnees) values
        (lm, 'factures', 'recette-doublon-1', '{"id": "recette-doublon-1", "numero": "2099-9999"}'),
        (essai, 'factures', 'recette-doublon-autre', '{"id": "recette-doublon-autre", "numero": "2099-9999"}');
      begin
        insert into erp.enregistrements (espace, collection, id, donnees) values
          (lm, 'factures', 'recette-doublon-2', '{"id": "recette-doublon-2", "numero": " 2099-9999"}');
        resultat := 'factures : deux factures d''un espace partagent un numéro'; raise exception 'stop';
      exception when unique_violation then null;
      end;
      -- Tabulation, retour à la ligne ou espace insécable autour : le même numéro.
      begin
        insert into erp.enregistrements (espace, collection, id, donnees) values
          (lm, 'factures', 'recette-doublon-3', jsonb_build_object('id', 'recette-doublon-3', 'numero', chr(9) || '2099-9999' || chr(10) || chr(160)));
        resultat := 'factures : un numéro entouré de tabulations ou d''espaces insécables passe en double'; raise exception 'stop';
      exception when unique_violation then null;
      end;
      delete from erp.enregistrements where collection = 'factures' and id in ('recette-doublon-1', 'recette-doublon-autre');
    end if;
    -- Après la passe 2, une adresse peut être membre de plusieurs espaces.
    membres_par_espace := erp.cle_par_espace('erp.membres'::regclass);

    perform set_config('role', 'authenticated', true);

    -- 1. Membre de Label Maison (lié à la passe 1, sans code) : sa ligne, pas celle de l'autre espace.
    perform set_config('request.headers', '{}', true);
    perform set_config('request.jwt.claims', j_lm, true);
    select count(*) into n from erp.enregistrements where collection = 'recette';
    if n <> 1 then resultat := format('un membre de Label Maison voit %s lignes au lieu de 1', n); raise exception 'stop'; end if;
    update erp.enregistrements set donnees = '{"id": "ligne-autre", "x": 1}' where collection = 'recette' and id = 'ligne-autre';
    get diagnostics n = row_count;
    if n <> 0 then resultat := 'un membre de Label Maison modifie une ligne d''un autre espace'; raise exception 'stop'; end if;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (essai, 'recette', 'intrus', '{}');
      resultat := 'un membre de Label Maison écrit dans un autre espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'connecteurs', 'recette', '{}');
      resultat := 'un compte « opérations » écrit dans les connecteurs';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    select count(*) into n from erp.enregistrements where collection = 'accesProprietaires';
    if n <> 0 then resultat := 'un compte « opérations » lit les accès des propriétaires'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'accesProprietaires';
    if n <> 0 then resultat := 'un compte « opérations » lit les anciennes versions des accès'; raise exception 'stop'; end if;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'accesProprietaires', 'intrus', '{}');
      resultat := 'un compte « opérations » écrit un accès propriétaire';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'reglagesRelances', 'relances', '{}');
      resultat := 'un compte « opérations » écrit les réglages des relances';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    select count(*) into n from erp.membres where email like 'recette-%';
    if n <> 1 then resultat := format('un membre de Label Maison voit %s membres d''essai au lieu de 1', n); raise exception 'stop'; end if;
    j := erp.qui_suis_je();
    if jsonb_array_length(j -> 'espaces') <> 1 or (j -> 'espaces' -> 0 ->> 'id')::uuid <> lm then
      resultat := 'un membre lié à la passe 1 n''entre pas sans code'; raise exception 'stop';
    end if;

    -- 1 ter. Écritures réservées aux gérants : refusées au compte « opérations ».
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'envoisProgrammes', 'recette-intrus', '{"statut": "en_cours"}');
      resultat := 'un compte « opérations » glisse un message automatique à envoyer'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'programmes', 'recette-intrus', '{"verrou": {"jusqua": 9999999999999}}');
      resultat := 'un compte « opérations » bloque les messages automatiques'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'agent', 'recette-intrus', '{}');
      resultat := 'un compte « opérations » écrit l''état de l''agent'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'passagesFacturesMensuelles', 'recette-intrus', '{}');
      resultat := 'un compte « opérations » écrit le passage des factures du mois'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'factures', 'recette-intrus', '{"id": "recette-intrus", "statut": "brouillon"}');
      resultat := 'un compte « opérations » écrit une facture'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    update erp.enregistrements set donnees = donnees || '{"recette": 1}'
      where espace = lm and ((collection = 'reglages' and id in ('messages-programmes', 'societe'))
                             or (collection = 'conseilsPrix' and id = 'reglages')
                             or (collection = 'envoisProgrammes' and id = 'recette-envoi'));
    get diagnostics n = row_count;
    if n <> 0 then resultat := 'un compte « opérations » modifie un modèle de message, la société ou les réglages des prix'; raise exception 'stop'; end if;
    delete from erp.enregistrements
      where espace = lm and ((collection = 'reglages' and id in ('messages-programmes', 'societe', 'agent'))
                             or (collection = 'envoisProgrammes' and id = 'recette-envoi'));
    get diagnostics n = row_count;
    if n <> 0 then resultat := 'un compte « opérations » supprime des réglages réservés aux gérants'; raise exception 'stop'; end if;
    begin
      update erp.enregistrements set donnees = donnees || '{"autonomie": "recette"}' where espace = lm and collection = 'reglages' and id = 'agent';
      resultat := 'un compte « opérations » change le niveau d''autonomie de l''agent'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Membre « opérations » ici et gérant d'un autre espace (possible après la passe 2) : il ne déplace
    -- rien de Label Maison vers l'autre (sous-bloc annulé : son second rôle disparaît ensuite).
    if membres_par_espace then
    begin
      perform set_config('role', 'none', true);
      insert into erp.membres (espace, email, nom, role, uid) values (essai, 'recette-lm@exemple.invalid', 'Recette LM', 'gerant', u_lm);
      perform set_config('role', 'authenticated', true);
      begin
        update erp.enregistrements set espace = essai where espace = lm and collection = 'reglages' and id = 'agent';
        resultat := 'un membre gérant d''un autre espace y déplace les réglages de l''agent'; raise exception 'stop';
      exception when insufficient_privilege then null;
      end;
      begin
        update erp.enregistrements set espace = essai where espace = lm and collection = 'recette' and id = 'ligne-lm';
        resultat := 'un membre déplace une donnée de Label Maison vers un autre espace'; raise exception 'stop';
      exception when insufficient_privilege then null;
      end;
      raise exception 'recette_sous_bloc';
    exception when others then
      if sqlerrm <> 'recette_sous_bloc' then
        raise;
      end if;
    end;
    end if;
    -- Les autres réglages de l'agent réservés au gérant : marche, horaires, ce qu'il confie, délai.
    foreach k in array array['actif', 'horaires', 'transmettre', 'delaiAlerteMinutes'] loop
      begin
        update erp.enregistrements set donnees = donnees || jsonb_build_object(k, 'recette') where espace = lm and collection = 'reglages' and id = 'agent';
        resultat := format('un compte « opérations » change le réglage « %s » de l''agent', k); raise exception 'stop';
      exception when insufficient_privilege then null;
      end;
    end loop;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees)
        select espace, collection, id, donnees || '{"actif": "recette"}' from erp.enregistrements
        where espace = lm and collection = 'reglages' and id = 'agent'
      on conflict (espace, collection, id) do update set donnees = excluded.donnees;
      resultat := 'un compte « opérations » met l''agent en marche par un envoi groupé'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.numeroter_facture('recette-fm-1');
      resultat := 'un compte « opérations » numérote une facture'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Ce qui reste à l'équipe : avis à déposer, décisions de prix, réglages de l'agent (ton et signature).
    insert into erp.enregistrements (espace, collection, id, donnees) values
      (lm, 'avisADeposer', 'recette-avis', '{"statut": "fait"}'),
      (lm, 'conseilsPrix', 'recette-decision', '{"decision": "fait"}');
    update erp.enregistrements set donnees = donnees || '{"recette": 1, "ton": "recette", "signature": "Recette"}' where espace = lm and collection = 'reglages' and id = 'agent';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un compte « opérations » ne modifie plus le ton ou la signature de l''agent'; raise exception 'stop'; end if;
    -- Pas encore de réglages de l'agent : l'équipe les crée avec le ton et la signature, jamais avec la marche ou les horaires.
    perform set_config('role', 'none', true);
    delete from erp.enregistrements where espace = lm and collection = 'reglages' and id = 'agent';
    perform set_config('role', 'authenticated', true);
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values
        (lm, 'reglages', 'agent', '{"id": "agent", "ton": "recette", "horaires": {"mode": "toujours"}}');
      resultat := 'un compte « opérations » crée les réglages de l''agent avec ses horaires'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    insert into erp.enregistrements (espace, collection, id, donnees) values
      (lm, 'reglages', 'agent', '{"id": "agent", "ton": "recette", "signature": "Recette"}');
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un compte « opérations » ne crée plus les réglages de l''agent (ton, signature)'; raise exception 'stop'; end if;

    -- 1 quater. Gérant de Label Maison : tout, et la numérotation des factures.
    perform set_config('request.jwt.claims', j_plateforme, true);
    update erp.enregistrements set donnees = donnees || '{"recette": 2, "autonomie": "recette"}'
      where espace = lm and ((collection = 'reglages' and id in ('messages-programmes', 'societe', 'agent'))
                             or (collection = 'conseilsPrix' and id = 'reglages')
                             or (collection = 'envoisProgrammes' and id = 'recette-envoi'));
    get diagnostics n = row_count;
    if n <> 5 then resultat := format('un gérant modifie %s des 5 lignes réservées aux gérants', n); raise exception 'stop'; end if;
    update erp.enregistrements
      set donnees = donnees || '{"actif": false, "horaires": {"mode": "toujours"}, "transmettre": {"horsFiche": true}, "delaiAlerteMinutes": 7}'
      where espace = lm and collection = 'reglages' and id = 'agent';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un gérant ne change plus la marche, les horaires ou le délai de l''agent'; raise exception 'stop'; end if;
    -- Le numéro ne s'écrit jamais directement, même par un gérant (LMF02) : ni
    -- sur un brouillon, ni sur une nouvelle facture, ni par un envoi groupé.
    begin
      update erp.enregistrements set donnees = donnees || '{"numero": "2099-0051"}' where espace = lm and collection = 'factures' and id = 'recette-fm-2';
      resultat := 'factures : un gérant écrit lui-même le numéro d''un brouillon'; raise exception 'stop';
    exception when sqlstate 'LMF02' then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values
        (lm, 'factures', 'recette-fm-3', '{"id": "recette-fm-3", "numero": "2099-0053", "statut": "emise"}');
      resultat := 'factures : un gérant crée une facture avec son numéro'; raise exception 'stop';
    exception when sqlstate 'LMF02' then null;
    end;
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values
        (lm, 'factures', 'recette-fm-2', '{"id": "recette-fm-2", "numero": "2099-0052", "statut": "emise"}')
      on conflict (espace, collection, id) do update set donnees = excluded.donnees;
      resultat := 'factures : un envoi du navigateur pose le numéro d''un brouillon'; raise exception 'stop';
    exception when sqlstate 'LMF02' then null;
    end;
    -- Validation comme dans l'ERP : contenu final enregistré sans numéro, puis numéro par la base.
    update erp.enregistrements set donnees = donnees || '{"montantHtCentimes": 250}' where espace = lm and collection = 'factures' and id = 'recette-fm-2';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'factures : un gérant ne prépare plus un brouillon'; raise exception 'stop'; end if;
    -- Après l'ancienne facture « 2099-0001 » (entourée d'espaces) : 2099-0002 puis 2099-0003.
    begin
      if erp.numeroter_facture('recette-fm-1') <> '2099-0002' or erp.numeroter_facture('recette-fm-2') <> '2099-0003' then
        resultat := 'factures : numéros pas à la suite'; raise exception 'stop';
      end if;
    exception when unique_violation then
      resultat := 'factures : la numérotation redonne un numéro déjà pris (numéro entouré d''espaces)'; raise exception 'stop';
    end;
    if erp.numeroter_facture('recette-fm-1') <> '2099-0002' then
      resultat := 'factures : un second appel change le numéro'; raise exception 'stop';
    end if;
    select count(*) into n from erp.enregistrements
      where espace = lm and collection = 'factures' and id = 'recette-fm-1'
        and donnees ->> 'statut' = 'emise' and donnees -> 'mensuelle' ->> 'valideeLe' is not null;
    if n <> 1 then resultat := 'factures : numérotée sans statut « émise » ni heure de validation'; raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements
      where espace = lm and collection = 'reglages' and id = 'numerotation-factures' and donnees -> 'derniers' ->> '2099' = '3';
    if n <> 1 then resultat := 'factures : compteur de l''année pas à jour'; raise exception 'stop'; end if;
    begin
      update erp.enregistrements set donnees = donnees || '{"montantHtCentimes": 1}' where espace = lm and collection = 'factures' and id = 'recette-fm-1';
      resultat := 'factures : une facture numérotée change de montant'; raise exception 'stop';
    exception when sqlstate 'LMF01' then null;
    end;
    begin
      update erp.enregistrements set donnees = donnees || '{"numero": "2099-0007"}' where espace = lm and collection = 'factures' and id = 'recette-fm-1';
      resultat := 'factures : une facture numérotée change de numéro'; raise exception 'stop';
    exception when sqlstate 'LMF01' or sqlstate 'LMF02' then null;
    end;
    begin
      delete from erp.enregistrements where espace = lm and collection = 'factures' and id = 'recette-fm-1';
      resultat := 'factures : une facture numérotée se supprime'; raise exception 'stop';
    exception when sqlstate 'LMF01' then null;
    end;
    update erp.enregistrements set donnees = donnees || '{"statut": "payee", "payeeLe": "2099-02-01", "partageeLe": "2099-01-20T10:00:00+01:00"}'
      where espace = lm and collection = 'factures' and id = 'recette-fm-1';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'factures : le paiement et le partage d''une facture numérotée ne s''écrivent plus'; raise exception 'stop'; end if;
    -- Envoi du navigateur (ajout qui devient modification) avec le même numéro : accepté.
    begin
      insert into erp.enregistrements (espace, collection, id, donnees)
        select espace, collection, id, donnees || '{"partageeLe": "2099-01-21T10:00:00+01:00"}' from erp.enregistrements
        where espace = lm and collection = 'factures' and id = 'recette-fm-2'
      on conflict (espace, collection, id) do update set donnees = excluded.donnees;
      get diagnostics n = row_count;
    exception when sqlstate 'LMF01' or sqlstate 'LMF02' then n := -1;
    end;
    if n <> 1 then resultat := 'factures : l''envoi du navigateur d''une facture numérotée (même numéro) est refusé'; raise exception 'stop'; end if;
    -- Ajout si absente (passage des brouillons, « on conflict do nothing ») sur une facture déjà numérotée : silencieux.
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values
        (lm, 'factures', 'recette-fm-1', '{"id": "recette-fm-1", "numero": "", "statut": "brouillon"}'),
        (lm, 'factures', 'recette-fm-2', '{"id": "recette-fm-2", "numero": "2099-0003", "statut": "emise"}')
      on conflict do nothing;
      get diagnostics n = row_count;
    exception when sqlstate 'LMF01' or sqlstate 'LMF02' then n := -1;
    end;
    if n <> 0 then resultat := 'factures : l''ajout d''une facture déjà là n''est plus silencieux'; raise exception 'stop'; end if;

    -- 1 quinquies. Gérant d'un autre espace : pas de numéro dans Label Maison.
    perform set_config('request.jwt.claims', j_autre, true);
    perform set_config('request.headers', json_build_object('x-erp-espace', lm)::text, true);
    begin
      perform erp.numeroter_facture('recette-fm-2');
      resultat := 'le gérant d''un autre espace numérote une facture de Label Maison'; raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.headers', '{}', true);

    -- 1 bis. Même adresse, autre compte (créé avant par quelqu'un d'autre) : rien.
    perform set_config('request.jwt.claims', j_lm_autre_compte, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := 'un autre compte à l''adresse d''un membre voit ses données'; raise exception 'stop'; end if;
    select count(*) into n from erp.membres;
    if n <> 0 then resultat := 'un autre compte à l''adresse d''un membre lit l''équipe'; raise exception 'stop'; end if;
    if jsonb_array_length(erp.qui_suis_je() -> 'espaces') <> 0 then
      resultat := 'qui_suis_je ouvre un espace à un autre compte de même adresse'; raise exception 'stop';
    end if;

    -- 2. Membre de l'autre espace : sa ligne seulement ; rien avec l'en-tête de Label Maison.
    perform set_config('request.jwt.claims', j_autre, true);
    select count(*) into n from erp.enregistrements where collection = 'recette' and espace = essai;
    if n <> 1 then resultat := format('le membre de l''autre espace voit %s de ses lignes au lieu de 1', n); raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements where espace = lm;
    if n <> 0 then resultat := 'le membre de l''autre espace voit Label Maison'; raise exception 'stop'; end if;
    update erp.enregistrements set donnees = '{"id": "ligne-autre", "v": 2}' where espace = essai and collection = 'recette' and id = 'ligne-autre';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'le gérant de l''autre espace ne peut pas modifier sa ligne'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'recette';
    if n <> 1 then resultat := format('historique : %s version(s) visibles au lieu de 1', n); raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'accesProprietaires';
    if n <> 1 then resultat := format('le gérant voit %s ancienne(s) version(s) d''accès au lieu de 1 (la sienne)', n); raise exception 'stop'; end if;
    perform set_config('request.headers', json_build_object('x-erp-espace', lm)::text, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := 'l''en-tête d''un espace étranger ouvre des données'; raise exception 'stop'; end if;
    perform set_config('request.headers', '{}', true);
    j := erp.qui_suis_je();
    if jsonb_array_length(j -> 'espaces') <> 1 or j -> 'espaces' -> 0 ->> 'code' <> 'recette-espaces' then
      resultat := 'qui_suis_je ne renvoie pas le bon espace'; raise exception 'stop';
    end if;
    if erp.secret_espace(essai, 'repull_cle') is not null then
      resultat := 'un membre lit un secret du coffre'; raise exception 'stop';
    end if;
    if erp.espace_du_chemin(essai::text || '/menages/a.jpg') <> essai or erp.espace_du_chemin('menages/a.jpg') <> lm then
      resultat := 'espace des fichiers mal reconnu'; raise exception 'stop';
    end if;

    -- 3. Compte serveur : rien sans en-tête, l'espace nommé avec.
    perform set_config('request.jwt.claims', j_serveur, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := format('le compte serveur voit %s lignes sans en-tête', n); raise exception 'stop'; end if;
    perform set_config('request.headers', json_build_object('x-erp-espace', essai)::text, true);
    select count(*) into n from erp.enregistrements;
    if n <> 1 then resultat := format('le compte serveur voit %s lignes de l''espace nommé au lieu de 1', n); raise exception 'stop'; end if;
    insert into erp.enregistrements (espace, collection, id, donnees) values (essai, 'connecteurs', 'recette', '{}');
    -- Id à part : avant la passe 2, la clé est encore (collection, id), sans l'espace.
    insert into erp.enregistrements (espace, collection, id, donnees) values (essai, 'accesProprietaires', 'recette-serveur', '{}');
    -- Ce que seul le serveur écrit : permis dans l'espace nommé.
    insert into erp.enregistrements (espace, collection, id, donnees) values
      (essai, 'envoisProgrammes', 'recette-serveur', '{}'),
      (essai, 'programmes', 'recette-serveur', '{}'),
      (essai, 'agent', 'recette-serveur', '{}');
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'recette', 'intrus', '{}');
      resultat := 'le compte serveur écrit hors de l''espace nommé';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.headers', json_build_object('x-erp-espace', 'pas-un-uuid')::text, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := 'un en-tête illisible ouvre des données'; raise exception 'stop'; end if;

    -- 4. Espaces ouverts par invitation. Les refus attendus sont des 42501.
    perform set_config('request.headers', '{}', true);
    begin
      select count(*) into n from erp.invitations_espace;
      resultat := 'les invitations d''espace se lisent directement';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      select count(*) into n from erp.invitations;
      resultat := 'les invitations des membres se lisent directement';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Inviter : un gérant de Label Maison seulement.
    perform set_config('request.jwt.claims', j_autre, true);
    begin
      perform erp.inviter_espace('Intrus', 'intrus@exemple.invalid', h_autre);
      resultat := 'le gérant d''un autre espace invite une conciergerie';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_lm, true);
    begin
      perform erp.inviter_espace('Intrus', 'intrus@exemple.invalid', h_autre);
      resultat := 'un compte « opérations » de Label Maison invite une conciergerie';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_serveur, true);
    perform set_config('request.headers', json_build_object('x-erp-espace', lm)::text, true);
    begin
      perform erp.inviter_espace('Intrus', 'intrus@exemple.invalid', h_autre);
      resultat := 'le compte serveur invite une conciergerie';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.headers', '{}', true);
    perform set_config('request.jwt.claims', j_plateforme, true);
    begin
      perform erp.inviter_espace('Déjà membre', 'Recette-Autre@exemple.invalid', h_autre);
      resultat := 'une adresse déjà membre d''un espace est invitée à en créer un';
      raise exception 'stop';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform erp.inviter_espace('Sans code', 'sans-code@exemple.invalid', 'pas-une-empreinte');
      resultat := 'une invitation d''espace est gardée sans l''empreinte de son code';
      raise exception 'stop';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform erp.inviter_espace('Label  Maison', 'copie@exemple.invalid', h_autre);
      resultat := 'une conciergerie est invitée sous le nom de Label Maison';
      raise exception 'stop';
    exception when invalid_parameter_value then null;
    end;
    j := erp.inviter_espace('Recette créée', ' Invite-Recette@Exemple.invalid ', h_espace);
    if j ->> 'email' <> 'invite-recette@exemple.invalid' then
      resultat := 'invitation : adresse mal enregistrée'; raise exception 'stop';
    end if;
    if not exists (select 1 from jsonb_array_elements(erp.espaces_plateforme() -> 'invitations') x where x ->> 'email' = 'invite-recette@exemple.invalid') then
      resultat := 'invitation absente de la liste des gérants de Label Maison'; raise exception 'stop';
    end if;
    begin
      perform erp.suspendre_espace(lm, false);
      resultat := 'l''espace de Label Maison se suspend';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.enregistrer_secret_espace(lm, 'repull_cle', 'sk_test_recette');
      resultat := 'un secret de Label Maison se range dans le coffre';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;

    -- Créer : sans invitation, adresse non confirmée, invitation d'une autre adresse, expirée : refusé.
    perform set_config('request.jwt.claims', j_sans, true);
    begin
      perform erp.creer_espace();
      resultat := 'un compte sans invitation crée un espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_invite_non_confirme, true);
    begin
      perform erp.activer(c_espace);
      resultat := 'une adresse non confirmée active une invitation';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.creer_espace();
      resultat := 'une adresse non confirmée crée un espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_autre, true);
    begin
      perform erp.activer(c_espace);
      resultat := 'le code d''une invitation sert à une autre adresse';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.creer_espace();
      resultat := 'l''invitation d''une autre adresse sert à créer un espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_expire, true);
    begin
      perform erp.activer(c_expire_espace);
      resultat := 'une invitation d''espace expirée s''active';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    j := erp.qui_suis_je();
    if j -> 'invitations_espace' <> '[]'::jsonb or j -> 'invitations_espace_closes' -> 0 ->> 'motif' is distinct from 'expiree'
       or j -> 'invitations_espace_closes' -> 0 ->> 'nom_espace' is distinct from 'Recette expirée' then
      resultat := 'qui_suis_je ne dit pas que l''invitation a expiré'; raise exception 'stop';
    end if;
    perform set_config('request.jwt.claims', format(jeton, 'expire-recette@exemple.invalid', u_intrus, ancien, ''), true);
    if erp.qui_suis_je() -> 'invitations_espace_closes' <> '[]'::jsonb then
      resultat := 'invitations closes montrées à une adresse non confirmée'; raise exception 'stop';
    end if;
    -- Invitation annulée par Label Maison : dite telle quelle, rien n'ouvre.
    perform set_config('request.jwt.claims', j_plateforme, true);
    j := erp.inviter_espace('Recette annulée', 'annulee-recette@exemple.invalid', h_autre);
    perform erp.annuler_invitation_espace((j ->> 'id')::uuid);
    perform set_config('request.jwt.claims', format(jeton, 'annulee-recette@exemple.invalid', u_intrus, neuf, ', "recette_confirme": "oui"'), true);
    j := erp.qui_suis_je();
    if j -> 'invitations_espace_closes' -> 0 ->> 'motif' is distinct from 'annulee' or jsonb_array_length(j -> 'espaces') <> 0 then
      resultat := 'qui_suis_je ne dit pas que l''invitation est annulée'; raise exception 'stop';
    end if;
    begin
      perform erp.creer_espace();
      resultat := 'une invitation expirée crée un espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;

    -- L'invité, adresse confirmée, sans le code (compte créé à son adresse par
    -- quelqu'un d'autre, ou lien jamais ouvert) : rien à voir, rien à créer.
    perform set_config('request.jwt.claims', j_invite_ancien, true);
    if erp.qui_suis_je() -> 'invitations_espace' <> '[]'::jsonb then
      resultat := 'invitation montrée à un compte qui n''a pas saisi son code'; raise exception 'stop';
    end if;
    begin
      perform erp.creer_espace();
      resultat := 'une invitation d''espace sert sans son code';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.activer(c_faux);
      resultat := 'un faux code active une invitation';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Avec le code : l'invitation est rattachée à CE compte ; un jeton émis
    -- avant l'activation (celui d'un autre qui connaîtrait l'ancien mot de passe) ne sert à rien.
    j := erp.activer(c_espace);
    if j ->> 'genre' <> 'espace' or j ->> 'nom' <> 'Recette créée' then
      resultat := 'activation de l''invitation d''espace mal rendue'; raise exception 'stop';
    end if;
    if erp.qui_suis_je() -> 'invitations_espace' <> '[]'::jsonb then
      resultat := 'invitation montrée à un jeton émis avant l''activation'; raise exception 'stop';
    end if;
    begin
      perform erp.creer_espace();
      resultat := 'un jeton émis avant l''activation crée l''espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.activer(c_espace);
      resultat := 'un code d''invitation d''espace sert deux fois';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Session renouvelée : il voit son invitation, crée son espace au nom donné, en est gérant, ne voit rien d'autre.
    perform set_config('request.jwt.claims', j_invite, true);
    j := erp.qui_suis_je();
    if jsonb_array_length(j -> 'invitations_espace') <> 1 or j -> 'invitations_espace' -> 0 ->> 'nom_espace' is distinct from 'Recette créée'
       or (j -> 'invitations_espace' -> 0 ->> 'expire_le')::timestamptz <= now() or jsonb_array_length(j -> 'espaces') <> 0 then
      resultat := 'qui_suis_je ne montre pas l''invitation en attente'; raise exception 'stop';
    end if;
    j := erp.creer_espace();
    cree := (j ->> 'id')::uuid;
    if j ->> 'nom' <> 'Recette créée' or j ->> 'code' <> 'recette-creee' then
      resultat := format('espace créé mal nommé (%s, %s)', j ->> 'nom', j ->> 'code'); raise exception 'stop';
    end if;
    j := erp.qui_suis_je();
    if jsonb_array_length(j -> 'espaces') <> 1 or (j -> 'espaces' -> 0 ->> 'id')::uuid <> cree
       or j -> 'espaces' -> 0 ->> 'role' <> 'gerant' or j -> 'invitations_espace' <> '[]'::jsonb then
      resultat := 'après création : pas gérant de son espace, ou invitation encore en attente'; raise exception 'stop';
    end if;
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := format('le nouvel espace voit %s lignes d''autres espaces', n); raise exception 'stop'; end if;
    insert into erp.enregistrements (espace, collection, id, donnees) values (cree, 'recette', 'ligne-creee', '{"id": "ligne-creee"}');
    -- Nouvel appel (double clic) : le même espace, jamais un second ; l'invitation ne resservira pas.
    j := erp.creer_espace();
    if (j ->> 'id')::uuid <> cree or (j ->> 'deja')::boolean is not true then
      resultat := 'un nouvel appel crée un second espace'; raise exception 'stop';
    end if;
    select count(*) into n from erp.espaces where code like 'recette-creee%';
    if n <> 1 then resultat := format('%s espaces créés avec une seule invitation', n); raise exception 'stop'; end if;
    -- Ses réglages Repull : les siens seulement.
    begin
      perform erp.enregistrer_secret_espace(essai, 'repull_cle', 'sk_test_intrus');
      resultat := 'un gérant range un secret dans l''espace d''un autre';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.reglages_repull_espace(essai);
      resultat := 'un gérant lit les réglages Repull d''un autre espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform erp.regler_repull_espace(cree, 'ws-recette');
    j := erp.reglages_repull_espace(cree);
    if j ->> 'workspace' is distinct from 'ws-recette' or (j ->> 'cle')::boolean or j ->> 'code' <> 'recette-creee' then
      resultat := 'réglages Repull de l''espace créé mal lus'; raise exception 'stop';
    end if;
    perform set_config('request.jwt.claims', j_lm, true);
    begin
      perform erp.enregistrer_secret_espace(cree, 'repull_cle', 'sk_test_intrus');
      resultat := 'un membre d''un autre espace range un secret dans l''espace créé';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_serveur, true);
    perform set_config('request.headers', json_build_object('x-erp-espace', essai)::text, true);
    begin
      perform erp.enregistrer_secret_espace(cree, 'repull_cle', 'sk_test_intrus');
      resultat := 'le compte serveur range un secret hors de l''espace nommé';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Suspendu par Label Maison : son gérant n'y entre plus, rien n'est effacé.
    perform set_config('request.headers', '{}', true);
    perform set_config('request.jwt.claims', j_plateforme, true);
    perform erp.suspendre_espace(cree, false);
    perform set_config('request.jwt.claims', j_invite, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 or jsonb_array_length(erp.qui_suis_je() -> 'espaces') <> 0 then
      resultat := 'un espace suspendu reste ouvert à son gérant'; raise exception 'stop';
    end if;
    if erp.qui_suis_je() -> 'espaces_suspendus' -> 0 ->> 'nom' is distinct from 'Recette créée' then
      resultat := 'qui_suis_je ne dit pas que l''espace est suspendu'; raise exception 'stop';
    end if;

    -- 5. Membre ajouté à l'équipe, compte créé à son adresse (par lui, ou par
    -- quelqu'un d'autre avant lui) : rien sans le code de son invitation.
    perform set_config('request.jwt.claims', j_nouveau_ancien, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 or jsonb_array_length(erp.qui_suis_je() -> 'espaces') <> 0 then
      resultat := 'une ligne de membre pas encore activée ouvre l''espace'; raise exception 'stop';
    end if;
    select count(*) into n from erp.membres;
    if n <> 0 then resultat := 'une ligne de membre pas encore activée se lit'; raise exception 'stop'; end if;
    begin
      perform erp.activer(c_expire);
      resultat := 'un code de membre expiré active le compte';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Inviter un membre : gérant de l'espace, ligne déjà ajoutée.
    perform set_config('request.jwt.claims', j_lm, true);
    begin
      perform erp.inviter_membre(essai, 'recette-nouveau@exemple.invalid', h_autre);
      resultat := 'un membre d''un autre espace invite dans l''espace';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.inviter_membre(lm, 'recette-lm@exemple.invalid', h_autre);
      resultat := 'un compte « opérations » invite un membre';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_serveur, true);
    perform set_config('request.headers', json_build_object('x-erp-espace', essai)::text, true);
    begin
      perform erp.inviter_membre(essai, 'recette-nouveau@exemple.invalid', h_autre);
      resultat := 'le compte serveur invite un membre';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.headers', '{}', true);
    perform set_config('request.jwt.claims', j_autre, true);
    begin
      perform erp.inviter_membre(essai, 'pas-dans-l-equipe@exemple.invalid', h_autre);
      resultat := 'une invitation de membre est gardée pour une adresse hors de l''équipe';
      raise exception 'stop';
    exception when invalid_parameter_value then null;
    end;
    begin
      perform erp.inviter_membre(essai, 'recette-nouveau@exemple.invalid', 'pas-une-empreinte');
      resultat := 'une invitation de membre est gardée sans l''empreinte de son code';
      raise exception 'stop';
    exception when invalid_parameter_value then null;
    end;
    j := erp.inviter_membre(essai, 'recette-autre@exemple.invalid', h_autre);
    if (j ->> 'deja')::boolean is not true then
      resultat := 'un membre déjà lié reçoit un code'; raise exception 'stop';
    end if;
    j := erp.inviter_membre(essai, ' Recette-Nouveau@exemple.invalid ', h_membre);
    if (j ->> 'deja')::boolean is not false or (j ->> 'expire_le')::timestamptz <= now() then
      resultat := 'invitation du membre mal rendue'; raise exception 'stop';
    end if;
    -- Le lien au compte ne s'écrit que par l'activation.
    begin
      update erp.membres set uid = u_autre where espace = essai and email = 'recette-nouveau@exemple.invalid';
      resultat := 'un gérant lie lui-même un compte à une ligne de membre';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.lier_compte('recette-nouveau@exemple.invalid', 'recette-espaces');
      resultat := 'erp.lier_compte s''appelle depuis l''ERP';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Le code ne sert qu'à son adresse, et pas faux.
    perform set_config('request.jwt.claims', j_intrus, true);
    begin
      perform erp.activer(c_membre);
      resultat := 'le code d''un membre sert à une autre adresse';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', j_nouveau_ancien, true);
    begin
      perform erp.activer(c_faux);
      resultat := 'un faux code active un membre';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      perform erp.activer(c_expire);
      resultat := 'l''ancien code d''un membre sert encore après une nouvelle invitation';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    j := erp.activer(c_membre);
    if j ->> 'genre' <> 'membre' or (j ->> 'espace')::uuid <> essai then
      resultat := 'activation du membre mal rendue'; raise exception 'stop';
    end if;
    -- Jeton d'avant l'activation (celui de qui avait créé le compte le premier) : rien.
    select count(*) into n from erp.enregistrements;
    if n <> 0 or jsonb_array_length(erp.qui_suis_je() -> 'espaces') <> 0 then
      resultat := 'un jeton émis avant l''activation ouvre l''espace'; raise exception 'stop';
    end if;
    begin
      perform erp.activer(c_membre);
      resultat := 'un code de membre sert deux fois';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Session renouvelée : l'espace s'ouvre, avec son rôle.
    perform set_config('request.jwt.claims', j_nouveau, true);
    j := erp.qui_suis_je();
    if jsonb_array_length(j -> 'espaces') <> 1 or (j -> 'espaces' -> 0 ->> 'id')::uuid <> essai
       or j -> 'espaces' -> 0 ->> 'role' <> 'operations' then
      resultat := 'le membre activé n''entre pas dans son espace'; raise exception 'stop';
    end if;
    select count(*) into n from erp.enregistrements where espace = essai and collection = 'recette';
    if n <> 1 then resultat := format('le membre activé voit %s lignes au lieu de 1', n); raise exception 'stop'; end if;
    -- Un autre compte à la même adresse, même avec un jeton neuf : rien.
    perform set_config('request.jwt.claims', j_nouveau_autre_compte, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 or jsonb_array_length(erp.qui_suis_je() -> 'espaces') <> 0 then
      resultat := 'un autre compte de même adresse entre après l''activation'; raise exception 'stop';
    end if;
    -- Adresse changée par le gérant (puis remise) : le lien au compte tombe, et
    -- le code déjà servi ne le refait pas.
    perform set_config('request.jwt.claims', j_autre, true);
    update erp.membres set email = 'recette-nouveau-2@exemple.invalid' where espace = essai and email = 'recette-nouveau@exemple.invalid';
    update erp.membres set email = 'recette-nouveau@exemple.invalid' where espace = essai and email = 'recette-nouveau-2@exemple.invalid';
    perform set_config('request.jwt.claims', j_nouveau, true);
    if jsonb_array_length(erp.qui_suis_je() -> 'espaces') <> 0 then
      resultat := 'le lien au compte reste après un changement d''adresse'; raise exception 'stop';
    end if;
    begin
      perform erp.activer(c_membre);
      resultat := 'un code de membre déjà servi relie de nouveau le compte';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;

    raise exception 'recette_terminee';
  exception when others then
    if sqlerrm <> 'recette_terminee' and resultat = 'ok' then
      resultat := 'essai impossible : ' || sqlerrm;
    end if;
  end;
  return resultat;
end;
$$;
revoke all on function erp.recette_espaces() from public, anon, authenticated;

-- ------------------------------------------------------------------- bilan
-- Dernière instruction : son résultat s'affiche dans l'onglet « Results ».
-- Attendu après la passe 1 : espaces >= 1, colonnes_espace = 4,
--   cles_par_espace = 0, compte_serveur = prêt, numeros_factures = uniques,
--   recette = ok.
-- Attendu après la passe 2 : pareil, avec cles_par_espace = 3.
select
  current_setting('erp.passe', true) as passe,
  (select count(*) from erp.espaces) as espaces,
  (select count(*) from information_schema.columns
    where table_schema = 'erp' and column_name = 'espace'
      and table_name in ('enregistrements', 'etat_automatisations', 'membres', 'historique')) as colonnes_espace,
  (select count(*) from unnest(array['erp.enregistrements', 'erp.etat_automatisations', 'erp.membres']::regclass[]) t
    where erp.cle_par_espace(t)) as cles_par_espace,
  (select case
     when not exists (select 1 from auth.users where lower(email) = 'serveur@labelmaisoncg.fr')
       then 'à créer (Authentication → Add user), puis relancer'
     when exists (select 1 from auth.users where lower(email) = 'serveur@labelmaisoncg.fr'
                   and raw_app_meta_data ->> 'erp_role' = 'serveur')
       then 'prêt'
     else 'rôle absent : relancer ce script'
   end) as compte_serveur,
  (select case
     when to_regclass('erp.enregistrements_numero_facture_espace') is not null then 'uniques'
     when exists (select 1 from erp.enregistrements e
                  where e.collection = 'factures' and erp.numero_normalise(e.donnees ->> 'numero') <> ''
                  group by e.espace, erp.numero_normalise(e.donnees ->> 'numero') having count(*) > 1)
       then 'en double : corriger les numéros listés en avertissement, puis relancer'
     else 'index absent : relancer ce fichier'
   end) as numeros_factures,
  erp.recette_espaces() as recette;

-- =============================================================================
-- RETOUR EN ARRIÈRE (seulement en cas de problème, et tant qu'aucun autre
-- espace n'a de données). Copier le bloc dans une nouvelle requête, retirer
-- les « -- » de début de ligne, Run, puis relancer erp-installation.sql
-- AUSSITÔT : jusque-là, erp.archiver_version lit encore old.espace (colonne
-- retirée) et chaque modification de l'ERP échoue.
-- =============================================================================
-- begin;
-- -- Données des autres espaces d'abord, tant que les clés primaires sont là :
-- -- les tables du temps réel (publication supabase_realtime) refusent une
-- -- suppression sans clé (« does not have a replica identity »).
-- delete from erp.enregistrements      where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- delete from erp.etat_automatisations where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- delete from erp.membres              where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- delete from erp.historique           where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- -- Si la passe 2 a été faite : anciennes clés primaires.
-- alter table erp.enregistrements      drop constraint if exists enregistrements_pkey;
-- alter table erp.etat_automatisations drop constraint if exists etat_automatisations_pkey;
-- alter table erp.membres              drop constraint if exists membres_pkey;
-- alter table erp.enregistrements      add primary key (collection, id);
-- alter table erp.etat_automatisations add primary key (id);
-- alter table erp.membres              add primary key (email);
-- create unique index if not exists membres_email_minuscules on erp.membres (lower(email));
-- -- Colonnes, règles et fonctions des espaces (cascade : les règles qui en dépendent).
-- alter table erp.enregistrements      drop column espace cascade;
-- alter table erp.etat_automatisations drop column espace cascade;
-- alter table erp.membres              drop column espace cascade;
-- alter table erp.historique           drop column espace cascade;
-- drop trigger if exists membres_adresse_changee on erp.membres;
-- alter table erp.membres drop column if exists uid cascade, drop column if exists lie_le cascade;
-- drop function if exists erp.inviter_espace(text, text, text), erp.annuler_invitation_espace(uuid),
--   erp.suspendre_espace(uuid, boolean), erp.espaces_plateforme(), erp.creer_espace(),
--   erp.enregistrer_secret_espace(uuid, text, text), erp.regler_repull_espace(uuid, text),
--   erp.reglages_repull_espace(uuid), erp.gerant_plateforme(), erp.email_confirme(),
--   erp.inviter_membre(uuid, text, text), erp.activer(text), erp.lier_compte(text, text),
--   erp.nom_espace_refuse(text), erp.empreinte_code(text), erp.jeton_apres(timestamptz),
--   erp.membre_adresse_changee() cascade;
-- grant insert, update on erp.membres to authenticated;
-- drop function if exists erp.recette_espaces(), erp.qui_suis_je(), erp.espaces_actifs(),
--   erp.secret_espace(uuid, text), erp.ranger_secret(text, text, text),
--   erp.role_membre(uuid), erp.acces_lecture(uuid), erp.acces_ecriture(uuid), erp.acces_gerant(uuid),
--   erp.espace_du_chemin(text), erp.espaces_lecture(), erp.espaces_ecriture(), erp.espaces_gerant(),
--   erp.garder_espaces(), erp.cle_par_espace(regclass) cascade;
-- -- Numérotation des factures, gardes des réglages de l'agent, du numéro des factures et
-- -- de l'espace d'une donnée (lisent la colonne espace) ; erp-installation.sql remet les
-- -- deux premières gardes et l'index des numéros, version d'avant les espaces.
-- drop function if exists erp.numeroter_facture(text), erp.garder_autonomie_agent(),
--   erp.reserver_numero_facture(), erp.garder_espace_enregistrement() cascade;
-- drop table if exists erp.invitations_espace, erp.invitations, erp.espaces cascade;
-- drop function if exists erp.mes_espaces(), erp.est_serveur(), erp.espace_entete(), erp.id_label_maison() cascade;
-- commit;
-- -- Puis : relancer supabase/erp-installation.sql (règles et fonctions d'origine).
