-- =============================================================================
-- ERP Label Maison : installation de la base de données
-- =============================================================================
--
-- À coller en entier dans Supabase → SQL Editor → New query → Run.
-- Le script est idempotent : on peut le relancer sans risque (rien n'est
-- effacé, les tables existantes sont conservées, les règles sont recréées).
--
-- Modèle « magasin de documents » : chaque élément de l'ERP (un propriétaire,
-- un logement, une réservation, une ligne de journal...) est UNE ligne de
-- erp.enregistrements, avec son contenu complet en JSON dans `donnees`.
-- La collection (proprietaires, logements, reservations...) et l'identifiant
-- forment la clé. Aucune correspondance de colonnes à maintenir : l'ERP écrit
-- exactement ce qu'il affiche.
--
-- Sécurité : seuls les comptes connectés (Supabase Auth) dont l'e-mail figure
-- dans erp.membres voient ou modifient quelque chose. Rien pour les visiteurs
-- anonymes (clé « anon » publique du site).
--
-- Les migrations de supabase/migrations/ (schéma normalisé) sont une cible
-- future : NE PAS les appliquer sur ce projet.
-- =============================================================================

create schema if not exists erp;

-- ----------------------------------------------------------------- tables

create table if not exists erp.enregistrements (
  collection text not null,
  id         text not null,
  donnees    jsonb not null,
  maj_le     timestamptz not null default now(),
  maj_par    text,
  primary key (collection, id)
);
comment on table erp.enregistrements is
  'ERP Label Maison : un élément par ligne (collection + id), contenu complet dans donnees.';

create index if not exists enregistrements_maj_le_idx on erp.enregistrements (maj_le desc);

create table if not exists erp.etat_automatisations (
  id         text primary key default 'global',
  actives    jsonb not null default '{}'::jsonb,
  evenements jsonb not null default '[]'::jsonb,
  maj_le     timestamptz not null default now()
);
comment on table erp.etat_automatisations is
  'Interrupteurs des règles d''automatisation et derniers constats du moteur (une seule ligne : global).';

create table if not exists erp.membres (
  email   text primary key,
  nom     text,
  role    text not null default 'gerant'
          check (role in ('gerant', 'operations', 'prestataire', 'lecture')),
  cree_le timestamptz not null default now()
);
comment on table erp.membres is
  'Comptes autorisés dans l''ERP (e-mail du compte Supabase Auth, nom affiché, rôle).';

-- Une adresse ne peut figurer qu'une fois, majuscules comprises.
create unique index if not exists membres_email_minuscules on erp.membres (lower(email));

-- Filet de sécurité : chaque version remplacée ou supprimée est archivée ici.
-- Rien n'est jamais perdu, même après une fausse manœuvre.
create table if not exists erp.historique (
  num         bigint generated always as identity primary key,
  collection  text not null,
  id          text not null,
  operation   text not null check (operation in ('modification', 'suppression')),
  donnees     jsonb not null,
  maj_par     text,
  archive_le  timestamptz not null default now()
);
create index if not exists historique_element_idx on erp.historique (collection, id, archive_le desc);

-- ------------------------------------------------------------- fonctions

-- Rôle du compte connecté dans l'ERP (null s'il n'est pas membre).
-- security definer : lit erp.membres sans repasser par ses propres règles.
create or replace function erp.role_membre() returns text
language sql stable security definer set search_path = ''
as $$
  select m.role
  from erp.membres m
  where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

-- Lecture : gérant, opérations, lecture seule. (Le rôle « prestataire » n'a
-- encore aucun accès : il faudra des règles dédiées à ses seules missions.)
create or replace function erp.acces_lecture() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(erp.role_membre() in ('gerant', 'operations', 'lecture'), false); $$;

-- Écriture : gérant et opérations.
create or replace function erp.acces_ecriture() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(erp.role_membre() in ('gerant', 'operations'), false); $$;

-- Gestion des membres : gérant uniquement.
create or replace function erp.acces_gerant() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(erp.role_membre() = 'gerant', false); $$;

revoke all on function erp.role_membre()    from public, anon;
revoke all on function erp.acces_lecture()  from public, anon;
revoke all on function erp.acces_ecriture() from public, anon;
revoke all on function erp.acces_gerant()   from public, anon;
grant execute on function erp.role_membre()    to authenticated;
grant execute on function erp.acces_lecture()  to authenticated;
grant execute on function erp.acces_ecriture() to authenticated;
grant execute on function erp.acces_gerant()   to authenticated;

-- Horodatage serveur de chaque modification.
create or replace function erp.toucher_maj_le() returns trigger
language plpgsql
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

drop trigger if exists enregistrements_maj_le on erp.enregistrements;
create trigger enregistrements_maj_le
  before insert or update on erp.enregistrements
  for each row execute function erp.toucher_maj_le();

drop trigger if exists etat_automatisations_maj_le on erp.etat_automatisations;
create trigger etat_automatisations_maj_le
  before insert or update on erp.etat_automatisations
  for each row execute function erp.toucher_maj_le();

-- Archive de l'ancienne version (modification réelle ou suppression).
create or replace function erp.archiver_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into erp.historique (collection, id, operation, donnees, maj_par)
    values (old.collection, old.id, 'suppression', old.donnees, old.maj_par);
    return old;
  end if;
  if new.donnees is distinct from old.donnees then
    insert into erp.historique (collection, id, operation, donnees, maj_par)
    values (old.collection, old.id, 'modification', old.donnees, old.maj_par);
  end if;
  return new;
end;
$$;
revoke all on function erp.archiver_version() from public, anon, authenticated;

drop trigger if exists enregistrements_historique on erp.enregistrements;
create trigger enregistrements_historique
  after update or delete on erp.enregistrements
  for each row execute function erp.archiver_version();

-- ------------------------------------------------------------ sécurité (RLS)

alter table erp.enregistrements      enable row level security;
alter table erp.etat_automatisations enable row level security;
alter table erp.membres              enable row level security;
alter table erp.historique           enable row level security;

-- enregistrements
drop policy if exists "membres lisent"   on erp.enregistrements;
drop policy if exists "membres ajoutent" on erp.enregistrements;
drop policy if exists "membres modifient" on erp.enregistrements;
drop policy if exists "membres suppriment" on erp.enregistrements;
create policy "membres lisent"     on erp.enregistrements for select to authenticated using (erp.acces_lecture());
create policy "membres ajoutent"   on erp.enregistrements for insert to authenticated with check (erp.acces_ecriture());
create policy "membres modifient"  on erp.enregistrements for update to authenticated using (erp.acces_ecriture()) with check (erp.acces_ecriture());
create policy "membres suppriment" on erp.enregistrements for delete to authenticated using (erp.acces_ecriture());

-- etat_automatisations
drop policy if exists "membres lisent"    on erp.etat_automatisations;
drop policy if exists "membres ajoutent"  on erp.etat_automatisations;
drop policy if exists "membres modifient" on erp.etat_automatisations;
create policy "membres lisent"    on erp.etat_automatisations for select to authenticated using (erp.acces_lecture());
create policy "membres ajoutent"  on erp.etat_automatisations for insert to authenticated with check (erp.acces_ecriture());
create policy "membres modifient" on erp.etat_automatisations for update to authenticated using (erp.acces_ecriture()) with check (erp.acces_ecriture());

-- membres : chacun lit sa propre ligne (l'ERP sait ainsi si le compte est
-- autorisé), l'équipe lit la liste, seul un gérant ajoute, modifie ou retire.
drop policy if exists "chacun lit sa ligne" on erp.membres;
drop policy if exists "equipe lit les membres" on erp.membres;
drop policy if exists "gerant ajoute" on erp.membres;
drop policy if exists "gerant modifie" on erp.membres;
drop policy if exists "gerant retire" on erp.membres;
create policy "chacun lit sa ligne"    on erp.membres for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "equipe lit les membres" on erp.membres for select to authenticated using (erp.acces_lecture());
create policy "gerant ajoute"  on erp.membres for insert to authenticated with check (erp.acces_gerant());
create policy "gerant modifie" on erp.membres for update to authenticated using (erp.acces_gerant()) with check (erp.acces_gerant());
create policy "gerant retire"  on erp.membres for delete to authenticated using (erp.acces_gerant());

-- historique : lecture seule pour l'équipe (écrit uniquement par le déclencheur).
drop policy if exists "membres lisent" on erp.historique;
create policy "membres lisent" on erp.historique for select to authenticated using (erp.acces_lecture());

-- ------------------------------------------------------------------ droits

revoke all on schema erp from anon;
revoke all on all tables in schema erp from anon;
grant usage on schema erp to authenticated;
grant select, insert, update, delete on erp.enregistrements      to authenticated;
grant select, insert, update         on erp.etat_automatisations to authenticated;
grant select, insert, update, delete on erp.membres              to authenticated;
grant select                         on erp.historique           to authenticated;

-- ------------------------------------------------- temps réel (Realtime)
-- Les deux fondateurs voient les modifications de l'autre en direct.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'erp' and tablename = 'enregistrements'
  ) then
    alter publication supabase_realtime add table erp.enregistrements;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'erp' and tablename = 'etat_automatisations'
  ) then
    alter publication supabase_realtime add table erp.etat_automatisations;
  end if;
end;
$$;

-- --------------------------------------------- fichiers (photos de ménage)
-- Espace de stockage privé : photos avant / après des ménages. Accès réservé
-- aux membres, jamais public (liens signés à durée limitée).

-- Bloc protégé : si le stockage refuse une instruction, le reste de
-- l'installation est conservé (message dans l'onglet « Messages »).
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('erp-fichiers', 'erp-fichiers', false)
  on conflict (id) do nothing;

  execute 'drop policy if exists "erp fichiers lecture" on storage.objects';
  execute 'drop policy if exists "erp fichiers ajout" on storage.objects';
  execute 'drop policy if exists "erp fichiers modification" on storage.objects';
  execute 'drop policy if exists "erp fichiers suppression" on storage.objects';
  execute $p$create policy "erp fichiers lecture" on storage.objects for select to authenticated
    using (bucket_id = 'erp-fichiers' and erp.acces_lecture())$p$;
  execute $p$create policy "erp fichiers ajout" on storage.objects for insert to authenticated
    with check (bucket_id = 'erp-fichiers' and erp.acces_ecriture())$p$;
  execute $p$create policy "erp fichiers modification" on storage.objects for update to authenticated
    using (bucket_id = 'erp-fichiers' and erp.acces_ecriture())
    with check (bucket_id = 'erp-fichiers' and erp.acces_ecriture())$p$;
  execute $p$create policy "erp fichiers suppression" on storage.objects for delete to authenticated
    using (bucket_id = 'erp-fichiers' and erp.acces_ecriture())$p$;
exception when others then
  raise notice 'Stockage des photos non configuré (%). Créer le bucket privé erp-fichiers dans Storage.', sqlerrm;
end;
$$;

-- ------------------------------------------------ exposition à l'API (REST)
-- Rend le schéma erp accessible à l'application. Si l'ERP affiche encore
-- « La base de données n'est pas encore installée » après ce script :
-- Supabase → Project Settings → Data API (ou Settings → API) → Exposed schemas
-- → ajouter « erp » → Save.

do $$
begin
  alter role authenticator set pgrst.db_schemas = 'public, graphql_public, erp';
exception when others then
  raise notice 'Exposition automatique impossible (%) : ajouter erp dans Exposed schemas.', sqlerrm;
end;
$$;
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- ------------------------------------------------------ membres de l'équipe
-- 1) Créer d'abord les comptes dans Authentication → Users → Add user
--    (e-mail + mot de passe, cocher « Auto Confirm User »).
-- 2) Puis retirer les deux tirets en début des lignes ci-dessous, remplacer
--    les adresses par les vraies, et relancer UNIQUEMENT ce bloc (Run).
--
-- insert into erp.membres (email, nom, role) values ('EMAIL_ABDEL', 'Abdel', 'gerant') on conflict (email) do update set nom = excluded.nom, role = excluded.role;
-- insert into erp.membres (email, nom, role) values ('EMAIL_KAMEL', 'Kamel', 'gerant') on conflict (email) do update set nom = excluded.nom, role = excluded.role;

-- Vérification : doit lister les membres saisis.
-- select * from erp.membres;

-- --------------------------------------------------------------- bilan
-- Dernière instruction : son résultat s'affiche dans l'onglet « Results ».
-- Attendu : tables_erp = 4, temps_reel = 2, stockage_photos = true,
-- politiques_photos = 4 (membres = 0 tant que le bloc ci-dessus n'est pas lancé).
select
  (select count(*) from information_schema.tables where table_schema = 'erp') as tables_erp,
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'erp') as temps_reel,
  exists (select 1 from storage.buckets where id = 'erp-fichiers') as stockage_photos,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'erp fichiers%') as politiques_photos,
  (select count(*) from erp.membres) as membres;
