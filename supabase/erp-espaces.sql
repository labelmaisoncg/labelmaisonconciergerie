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

-- Espaces (actifs) et rôle du compte connecté, restreints à l'espace de
-- l'en-tête s'il y en a un. Le compte serveur n'a que l'espace de l'en-tête,
-- avec les droits d'un gérant ; sans en-tête, aucun.
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
    and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
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
revoke all on function erp.archiver_version()      from public, anon, authenticated;
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

-- ------------------------------------------------------- appels de l'ERP

-- Qui est connecté, et dans quels espaces (l'ERP choisit l'espace à ouvrir).
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
        and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
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

revoke all on function erp.qui_suis_je()                      from public, anon;
revoke all on function erp.espaces_actifs()                   from public, anon;
revoke all on function erp.secret_espace(uuid, text)          from public, anon;
revoke all on function erp.ranger_secret(text, text, text)    from public, anon, authenticated;
grant execute on function erp.qui_suis_je()             to authenticated;
grant execute on function erp.espaces_actifs()          to authenticated;
grant execute on function erp.secret_espace(uuid, text) to authenticated;

-- ---------------------------------------------- invitations (étape suivante)
-- Préparée ici, utilisée plus tard par « Créer un compte » : un code à usage
-- unique (seule son empreinte SHA-256 est gardée), valable 7 jours. Aucune
-- règle d'accès : illisible par l'application tant que l'étape n'existe pas.
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
alter table erp.invitations enable row level security;
revoke all on erp.invitations from anon, authenticated;

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
create policy "chacun lit sa ligne"    on erp.membres for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
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
create policy "membres lisent" on erp.historique for select to authenticated
  using (espace = any ((select erp.espaces_lecture())::uuid[]));

-- ------------------------------------------------------------------ droits

revoke all on erp.espaces from anon;
grant select on erp.espaces to authenticated;

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
  j jsonb;
begin
  begin
    -- Données d'essai : un espace, un membre dans chaque espace, une ligne chacun
    -- (l'espace d'essai est permis avant la passe 2 : tout est annulé à la fin).
    perform set_config('erp.recette', 'en_cours', true);
    insert into erp.espaces (id, code, nom) values (essai, 'recette-espaces', 'Recette');
    insert into erp.membres (espace, email, nom, role) values
      (lm, 'recette-lm@exemple.invalid', 'Recette LM', 'operations'),
      (essai, 'recette-autre@exemple.invalid', 'Recette autre', 'gerant');
    insert into erp.enregistrements (espace, collection, id, donnees) values
      (lm, 'recette', 'ligne-lm', '{"id": "ligne-lm"}'),
      (essai, 'recette', 'ligne-autre', '{"id": "ligne-autre"}');

    perform set_config('role', 'authenticated', true);

    -- 1. Membre de Label Maison : sa ligne, pas celle de l'autre espace.
    perform set_config('request.headers', '{}', true);
    perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "recette-lm@exemple.invalid"}', true);
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
    select count(*) into n from erp.membres where email like 'recette-%';
    if n <> 1 then resultat := format('un membre de Label Maison voit %s membres d''essai au lieu de 1', n); raise exception 'stop'; end if;

    -- 2. Membre de l'autre espace : sa ligne seulement ; rien avec l'en-tête de Label Maison.
    perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "recette-autre@exemple.invalid"}', true);
    select count(*) into n from erp.enregistrements where collection = 'recette' and espace = essai;
    if n <> 1 then resultat := format('le membre de l''autre espace voit %s de ses lignes au lieu de 1', n); raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements where espace = lm;
    if n <> 0 then resultat := 'le membre de l''autre espace voit Label Maison'; raise exception 'stop'; end if;
    update erp.enregistrements set donnees = '{"id": "ligne-autre", "v": 2}' where espace = essai and collection = 'recette' and id = 'ligne-autre';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'le gérant de l''autre espace ne peut pas modifier sa ligne'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'recette';
    if n <> 1 then resultat := format('historique : %s version(s) visibles au lieu de 1', n); raise exception 'stop'; end if;
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
    perform set_config('request.jwt.claims',
      '{"role": "authenticated", "email": "serveur@labelmaisoncg.fr", "app_metadata": {"erp_role": "serveur"}}', true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := format('le compte serveur voit %s lignes sans en-tête', n); raise exception 'stop'; end if;
    perform set_config('request.headers', json_build_object('x-erp-espace', essai)::text, true);
    select count(*) into n from erp.enregistrements;
    if n <> 1 then resultat := format('le compte serveur voit %s lignes de l''espace nommé au lieu de 1', n); raise exception 'stop'; end if;
    insert into erp.enregistrements (espace, collection, id, donnees) values (essai, 'connecteurs', 'recette', '{}');
    begin
      insert into erp.enregistrements (espace, collection, id, donnees) values (lm, 'recette', 'intrus', '{}');
      resultat := 'le compte serveur écrit hors de l''espace nommé';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.headers', json_build_object('x-erp-espace', 'pas-un-uuid')::text, true);
    select count(*) into n from erp.enregistrements;
    if n <> 0 then resultat := 'un en-tête illisible ouvre des données'; raise exception 'stop'; end if;

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
--   cles_par_espace = 0, compte_serveur = prêt, recette = ok.
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
  erp.recette_espaces() as recette;

-- =============================================================================
-- RETOUR EN ARRIÈRE (seulement en cas de problème, et tant qu'aucun autre
-- espace n'a de données). Copier le bloc dans une nouvelle requête, retirer
-- les « -- » de début de ligne, Run, puis relancer erp-installation.sql
-- AUSSITÔT : jusque-là, erp.archiver_version lit encore old.espace (colonne
-- retirée) et chaque modification de l'ERP échoue.
-- =============================================================================
-- begin;
-- -- Si la passe 2 a été faite : anciennes clés primaires.
-- alter table erp.enregistrements      drop constraint if exists enregistrements_pkey;
-- alter table erp.etat_automatisations drop constraint if exists etat_automatisations_pkey;
-- alter table erp.membres              drop constraint if exists membres_pkey;
-- delete from erp.enregistrements      where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- delete from erp.etat_automatisations where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- delete from erp.membres              where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- delete from erp.historique           where espace <> '4c4d0000-0000-4000-8000-000000000001';
-- alter table erp.enregistrements      add primary key (collection, id);
-- alter table erp.etat_automatisations add primary key (id);
-- alter table erp.membres              add primary key (email);
-- create unique index if not exists membres_email_minuscules on erp.membres (lower(email));
-- -- Colonnes, règles et fonctions des espaces (cascade : les règles qui en dépendent).
-- alter table erp.enregistrements      drop column espace cascade;
-- alter table erp.etat_automatisations drop column espace cascade;
-- alter table erp.membres              drop column espace cascade;
-- alter table erp.historique           drop column espace cascade;
-- drop function if exists erp.recette_espaces(), erp.qui_suis_je(), erp.espaces_actifs(),
--   erp.secret_espace(uuid, text), erp.ranger_secret(text, text, text),
--   erp.role_membre(uuid), erp.acces_lecture(uuid), erp.acces_ecriture(uuid), erp.acces_gerant(uuid),
--   erp.espace_du_chemin(text), erp.espaces_lecture(), erp.espaces_ecriture(), erp.espaces_gerant(),
--   erp.garder_espaces(), erp.cle_par_espace(regclass) cascade;
-- drop table if exists erp.invitations, erp.espaces cascade;
-- drop function if exists erp.mes_espaces(), erp.est_serveur(), erp.espace_entete(), erp.id_label_maison() cascade;
-- commit;
-- -- Puis : relancer supabase/erp-installation.sql (règles et fonctions d'origine).
