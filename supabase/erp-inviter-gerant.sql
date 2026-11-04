-- =============================================================================
-- Inviter un gérant sans passer par l'ERP (premier compte après une remise à
-- zéro, ou plus personne pour inviter).
-- =============================================================================
-- Supabase → SQL Editor → New query → coller ce fichier, mettre l'adresse de
-- la personne entre les guillemets, deuxième ligne de la requête → Run.
-- Le résultat est un lien « Créer mon compte » à envoyer à la personne (SMS,
-- WhatsApp…). Elle l'ouvre dans le navigateur de son téléphone, choisit son
-- mot de passe, puis se connecte : elle entre dans l'espace Label Maison comme
-- gérant. Le lien sert une fois, pendant 14 jours ; relancer le script en
-- fabrique un nouveau et l'ancien ne vaut plus.
--
-- La création du compte demande que Supabase puisse envoyer l'e-mail de
-- confirmation (Authentication → Emails → SMTP Settings, voir docs/erp/README.md,
-- « Remise à zéro »). Tant que ce n'est pas réglé : Authentication → Sign In /
-- Providers → Email → décocher « Confirm email » le temps que la personne crée
-- son compte, puis le recocher. Le code du lien reste exigé pour entrer.
-- =============================================================================
with p as (
  select lower(btrim('ADRESSE_DU_GERANT')) as email,
         replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as code
), m as (
  insert into erp.membres (espace, email, nom, role)
  select erp.id_label_maison(), p.email, null, 'gerant' from p
  where not exists (select 1 from erp.membres x where x.espace = erp.id_label_maison() and lower(x.email) = p.email)
  returning email
), r as (
  update erp.membres set role = 'gerant'
   where espace = erp.id_label_maison() and lower(email) = (select email from p) and role <> 'gerant'
  returning email
), d as (
  delete from erp.invitations
   where espace = erp.id_label_maison() and lower(email) = (select email from p) and utilise_le is null
  returning email
), i as (
  insert into erp.invitations (empreinte, espace, email, role, cree_par, expire_le)
  select erp.empreinte_code(p.code), erp.id_label_maison(), p.email, 'gerant', 'SQL Editor', now() + interval '14 days' from p
  returning email
)
select 'https://www.labelmaisoncg.fr/erp#creer=' || p.email || '&code=' || p.code as lien_a_envoyer
from p, i;
