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
--
-- Après supabase/erp-espaces.sql, ce script refuse de tourner (il remettrait
-- les règles d'avant les espaces) : c'est erp-espaces.sql qu'on relance.
-- =============================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'erp' and table_name = 'enregistrements' and column_name = 'espace') then
    raise exception 'Base déjà passée aux espaces : relancez supabase/erp-espaces.sql, pas ce script.';
  end if;
end;
$$;

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

-- Collection technique « connecteurs » (connexion de Claude au CRM : empreintes
-- des codes et jetons OAuth, date de révocation) : gérants seulement, en
-- lecture comme en écriture. Règle RESTRICTIVE : elle s'ajoute aux règles
-- ci-dessus sans rien ouvrir. Le serveur passe par le compte d'équipe (gérant).
drop policy if exists "connecteurs reserves aux gerants" on erp.enregistrements;
create policy "connecteurs reserves aux gerants" on erp.enregistrements
  as restrictive for all to authenticated
  using (collection <> 'connecteurs' or erp.acces_gerant())
  with check (collection <> 'connecteurs' or erp.acces_gerant());

-- Accès des propriétaires et des opérations, relances de paiement et leurs
-- réglages : gérants seulement (même raison ; voir erp-acces-gerants.sql).
drop policy if exists "acces exterieurs reserves aux gerants" on erp.enregistrements;
create policy "acces exterieurs reserves aux gerants" on erp.enregistrements
  as restrictive for all to authenticated
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances') or erp.acces_gerant())
  with check (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances') or erp.acces_gerant());

-- Écritures réservées aux gérants (le serveur passe par le compte d'équipe,
-- gérant) ; la lecture ne change pas. Ce que seul le serveur écrit (envois
-- et état des messages automatiques, état de l'agent et de la
-- synchronisation, passages des factures mensuelles, état des prix) et ce
-- que seul un gérant change (factures, réglages des prix, modèles des
-- messages automatiques, identité de la société, numérotation des factures).
-- Même règle que dans erp-espaces.sql (par espace).
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
  with check (not erp.ecriture_gerant_seulement(collection, id) or erp.acces_gerant());
create policy "ecritures reservees aux gerants (modification)" on erp.enregistrements
  as restrictive for update to authenticated
  using (not erp.ecriture_gerant_seulement(collection, id) or erp.acces_gerant())
  with check (not erp.ecriture_gerant_seulement(collection, id) or erp.acces_gerant());
create policy "ecritures reservees aux gerants (suppression)" on erp.enregistrements
  as restrictive for delete to authenticated
  using ((not erp.ecriture_gerant_seulement(collection, id) and not (collection = 'reglages' and id = 'agent')) or erp.acces_gerant());

-- Réglages de l'agent réservés au gérant (reglages / agent) : marche ou pause,
-- niveau d'autonomie, horaires, ce qu'il vous confie, délai avant de vous
-- prévenir (REGLAGES_AGENT_GERANT, src/erp/data/messagerie-ia.ts) ; ton,
-- signature, langues et Telegram restent à l'équipe. Déclencheur (une règle
-- RLS ne compare pas l'avant et l'après) ; ajout sans ligne enregistrée :
-- aucune de ces clés. Même déclencheur que dans erp-espaces.sql.
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
     and (new.collection <> 'reglages' or new.id <> 'agent') and not erp.acces_gerant() then
    raise exception 'Seul un gérant change ces réglages de l''agent.' using errcode = '42501';
  end if;
  if new.collection <> 'reglages' or new.id <> 'agent' or erp.acces_gerant() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.collection = 'reglages' and old.id = 'agent' then
    avant := old.donnees;
  else
    select e.donnees into avant from erp.enregistrements e where e.collection = 'reglages' and e.id = 'agent';
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
-- retours à la ligne, espaces insécables ou invisibles). Même fonction que
-- dans erp-espaces.sql.
create or replace function erp.numero_normalise(p text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''),
    '^[[:space:]' || chr(160) || chr(8199) || chr(8203) || chr(8239) || chr(65279) || ']+|[[:space:]'
      || chr(160) || chr(8199) || chr(8203) || chr(8239) || chr(65279) || ']+$', '', 'g')
$$;
revoke all on function erp.numero_normalise(text) from public, anon;
grant execute on function erp.numero_normalise(text) to authenticated;

-- Facture numérotée : plus rien ne change, sauf le paiement (statut émise,
-- payée ou en retard, date de paiement) et le partage ; elle ne se supprime
-- pas. Même déclencheur que dans erp-espaces.sql.
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

-- Numéro d'une facture : jamais écrit par l'API, gérant compris (LMF02) ; il
-- est attribué par la base (erp.numeroter_facture, après erp-espaces.sql).
-- Deux factures ne partagent pas un numéro (index créé seulement sans
-- doublons ; sinon un avertissement les liste). Même déclencheur que dans
-- erp-espaces.sql.
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
    if old.collection = 'factures' and old.id = new.id then
      avant := erp.numero_normalise(old.donnees ->> 'numero');
    end if;
  else
    -- Déjà enregistrée (verrouillée le temps de l'ajout) : « on conflict do nothing » reste silencieux,
    -- « do update » est vérifié par la branche de modification.
    perform 1 from erp.enregistrements e where e.collection = 'factures' and e.id = new.id for key share;
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
do $$
declare
  v_doublons text;
begin
  if to_regclass('erp.enregistrements_numero_facture') is not null then
    if pg_get_indexdef('erp.enregistrements_numero_facture'::regclass) like '%numero_normalise%' then
      return;
    end if;
    drop index erp.enregistrements_numero_facture;
  end if;
  select string_agg(format('%s (%s fois)', d.numero, d.n), ', ' order by d.numero) into v_doublons
    from (select erp.numero_normalise(e.donnees ->> 'numero') as numero, count(*) as n from erp.enregistrements e
          where e.collection = 'factures' and erp.numero_normalise(e.donnees ->> 'numero') <> ''
          group by erp.numero_normalise(e.donnees ->> 'numero') having count(*) > 1) d;
  if v_doublons is not null then
    raise warning 'Factures : numéros en double (%) ; index d''unicité pas créé. Corrigez-les, puis relancez ce fichier.', v_doublons;
    return;
  end if;
  create unique index enregistrements_numero_facture on erp.enregistrements ((erp.numero_normalise(donnees ->> 'numero')))
    where collection = 'factures' and erp.numero_normalise(donnees ->> 'numero') <> '';
end;
$$;

-- historique : lecture seule pour l'équipe (écrit uniquement par le déclencheur).
drop policy if exists "membres lisent" on erp.historique;
create policy "membres lisent" on erp.historique for select to authenticated using (erp.acces_lecture());
-- Anciennes versions des collections réservées aux gérants (accès extérieurs,
-- relances, connecteurs) : gérants seulement, comme les enregistrements.
drop policy if exists "versions reservees aux gerants" on erp.historique;
create policy "versions reservees aux gerants" on erp.historique
  as restrictive for select to authenticated
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances', 'connecteurs') or erp.acces_gerant());

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
-- Compte d'équipe unique (même vue pour tous, connexion par mot de passe seul).
-- Le compte lui-même se crée dans Authentication → Users → Add user :
-- e-mail equipe@labelmaisoncg.fr, mot de passe au choix, « Auto Confirm User ».
insert into erp.membres (email, nom, role) values ('equipe@labelmaisoncg.fr', 'Équipe Label Maison', 'gerant')
  on conflict (email) do update set nom = excluded.nom, role = excluded.role;

-- Vérification : doit lister les membres saisis.
-- select * from erp.membres;

-- --------------------------------------------------------------- bilan
-- Dernière instruction : son résultat s'affiche dans l'onglet « Results ».
-- Attendu : tables_erp = 4, temps_reel = 2, stockage_photos = true,
-- politiques_photos = 4, membres = 1 (le compte d'équipe).
select
  (select count(*) from information_schema.tables where table_schema = 'erp') as tables_erp,
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'erp') as temps_reel,
  exists (select 1 from storage.buckets where id = 'erp-fichiers') as stockage_photos,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'erp fichiers%') as politiques_photos,
  (select count(*) from erp.membres) as membres;
