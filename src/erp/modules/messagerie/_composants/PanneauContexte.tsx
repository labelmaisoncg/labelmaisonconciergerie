/** Colonne de droite : réservation, logement, fiche et droit aux codes d'accès. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { ProgressBar, StatusBadge, cn } from '../../../ui';
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
            <span className="font-semibold">{codes.autorise ? 'Vous pouvez donner les codes' : 'Ne donnez pas les codes'}</span>
            <span className="block text-(--lm-encre-2)">({codes.raison})</span>
          </p>
        </div>
        <p className="mt-2 text-[12px] text-(--lm-encre-3)">Règle : réservation confirmée, arrivée sous 48 h ou déjà sur place.</p>
      </Bloc>

      <Bloc titre="Réservation">
        {reservation ? (
          <div className="space-y-1.5">
            <Link to={`/erp/reservations/${reservation.id}`} className="font-medium text-(--lm-or-texte) hover:underline">
              {dateCourte(reservation.arrivee)} au {dateCourte(reservation.depart)}
            </Link>
            <p className="text-(--lm-encre-2)">
              {pluriel(reservation.nuits, 'nuit')} · {pluriel(reservation.voyageur.nbPersonnes, 'personne')} · arrivée {relatif(reservation.arrivee)}
            </p>
            {reservation.statut !== 'confirmee' && <StatusBadge type="statutReservation" valeur={reservation.statut} />}
          </div>
        ) : (
          <p className="text-(--lm-encre-2)">
            Pas encore de réservation : répondez vite.
          </p>
        )}
      </Bloc>

      <Bloc titre="Logement">
        {logement ? (
          <div className="space-y-1">
            <Link to={`/erp/logements/${logement.id}`} className="font-medium text-(--lm-encre) hover:text-(--lm-or-texte) hover:underline">
              {logement.nom}
            </Link>
            <p className="text-(--lm-encre-2)">{logement.adresse}, {logement.ville}</p>
            <p className="text-(--lm-encre-2)">
              Arrivée dès {logement.fiche.heureArrivee || '?'}, départ avant {logement.fiche.heureDepart || '?'}
            </p>
          </div>
        ) : (
          <p className="text-(--lm-encre-3)">Ce logement n’existe plus dans l’ERP.</p>
        )}
      </Bloc>

      {/* Seulement s'il y a un trou : une fiche complète n'appelle aucune action. */}
      {!fiche.complete && (
        <Bloc titre="Ce que sait votre agent">
          <ProgressBar valeur={fiche.ratio} afficherValeur label="Fiche du logement remplie" tone="alerte" />
          <p className="mt-2 text-[12px] text-(--lm-alerte)">Il manque : {fiche.manquants.join(', ')}. Votre agent vous passe la main.</p>
        </Bloc>
      )}
    </div>
  );
}
