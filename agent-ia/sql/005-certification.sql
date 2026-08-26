-- Éléments exigés par la certification Channex.
--
-- Une propriété seule ne suffit pas : il faut un type de chambre et un plan
-- tarifaire pour pouvoir pousser disponibilités, prix et restrictions. C'est
-- ce qui manquait, et c'est pourquoi le blocage de calendrier échouait sur
-- « aucun type de chambre configuré ».

alter table logements add column if not exists channex_room_type_id text;
alter table logements add column if not exists channex_rate_plan_id text;

-- Réservations déjà acquittées auprès de Channex. L'acquittement est
-- OBLIGATOIRE : sans lui, Channex renvoie indéfiniment la même réservation
-- dans le flux.
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
