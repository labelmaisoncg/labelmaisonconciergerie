-- Réservations déjà vues et notifiées.
--
-- Le nom de la table date de l'ancien gestionnaire de canaux, qui exigeait un
-- acquittement. Avec Repull, `revision_id` porte la clé `<id>@<updatedAt>` :
-- une version précise de la réservation, commune au webhook et au rattrapage,
-- pour qu'aucune alerte ne parte deux fois.
create table if not exists reservations_acquittees (
  revision_id     text primary key,
  booking_id      text,
  conciergerie_id uuid references conciergeries(id) on delete set null,
  logement_id     uuid references logements(id) on delete set null,
  statut          text,
  arrivee         date,
  depart          date,
  acquittee_le    timestamptz not null default now()
);
create index if not exists reservations_acquittees_date_idx
  on reservations_acquittees(conciergerie_id, arrivee);
