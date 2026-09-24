/** Colonne de droite : réservation, logement, fiche et droit aux codes d'accès. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge, ProgressBar, StatusBadge, cn } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { dateCourte, pluriel, relatif } from '../../../data/format';
import type { FilMessages, Logement, Reservation } from '../../../data/types';
import { completudeFiche, eligibiliteCodes } from './logique';

interface Props {
  fil: FilMessages;
  logement?: Logement;
  reservation?: Reservation;
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="border-b border-(--lm-bord) px-4 py-3.5 last:border-b-0">
      <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">{titre}</h3>
      {children}
    </section>
  );
}

export function PanneauContexte({ fil, logement, reservation }: Props) {
  const codes = eligibiliteCodes(fil, reservation);
  const fiche = completudeFiche(logement);

  return (
    <div className="text-[13px]">
      <Bloc titre="Codes d’accès">
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2.5',
            codes.autorise ? 'bg-(--lm-succes-lavis) text-(--lm-succes)' : 'bg-(--lm-danger-lavis) text-(--lm-danger)',
          )}
        >
          {codes.autorise ? <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <p>
            <span className="font-semibold">Codes d’accès : {codes.autorise ? 'autorisés' : 'non autorisés'}</span>
            <span className="block text-(--lm-encre-2)">({codes.raison})</span>
          </p>
        </div>
        <p className="mt-2 text-[12px] text-(--lm-encre-3)">
          Boîte à clés, serrure et wifi : uniquement pour une réservation confirmée, arrivée sous 48 h ou séjour en cours.
        </p>
      </Bloc>

      <Bloc titre="Réservation">
        {reservation ? (
          <div className="space-y-1.5">
            <Link to={`/erp/reservations/${reservation.id}`} className="font-medium text-(--lm-or) hover:underline">
              {dateCourte(reservation.arrivee)} au {dateCourte(reservation.depart)}
            </Link>
            <p className="text-(--lm-encre-2)">
              {pluriel(reservation.nuits, 'nuit')} · {pluriel(reservation.voyageur.nbPersonnes, 'personne')}
              {reservation.voyageur.pays ? ` · ${reservation.voyageur.pays}` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge type="statutReservation" valeur={reservation.statut} />
              <Badge>{LIBELLES.canal[reservation.canal]}</Badge>
            </div>
            <p className="text-[12px] text-(--lm-encre-3)">Arrivée {relatif(reservation.arrivee)}</p>
          </div>
        ) : (
          <p className="text-(--lm-encre-2)">
            Aucune réservation : demande d’information avant réservation. Une vente est en jeu, à traiter en priorité.
          </p>
        )}
      </Bloc>

      <Bloc titre="Logement">
        {logement ? (
          <div className="space-y-1">
            <Link to={`/erp/logements/${logement.id}`} className="font-medium text-(--lm-encre) hover:text-(--lm-or) hover:underline">
              {logement.nom}
            </Link>
            <p className="text-(--lm-encre-2)">{logement.adresse}, {logement.ville}</p>
            <p className="flex items-center gap-1.5 text-(--lm-encre-2)">
              <KeyRound className="size-3.5" aria-hidden /> {LIBELLES.serrure[logement.serrure]}
            </p>
            <p className="text-(--lm-encre-2)">
              Arrivée dès {logement.fiche.heureArrivee || '?'}, départ avant {logement.fiche.heureDepart || '?'}
            </p>
          </div>
        ) : (
          <p className="text-(--lm-encre-3)">Logement introuvable.</p>
        )}
      </Bloc>

      <Bloc titre="Fiche logement (source de l’agent)">
        <ProgressBar valeur={fiche.ratio} afficherValeur label="Complétude" tone={fiche.complete ? 'succes' : 'alerte'} />
        {fiche.complete ? (
          <p className="mt-2 text-[12px] text-(--lm-succes)">Fiche complète : l’agent peut répondre sur ce logement.</p>
        ) : (
          <p className="mt-2 text-[12px] text-(--lm-alerte)">
            Manquant : {fiche.manquants.join(', ')}. Messagerie automatique bloquée pour ce logement.
          </p>
        )}
      </Bloc>
    </div>
  );
}
