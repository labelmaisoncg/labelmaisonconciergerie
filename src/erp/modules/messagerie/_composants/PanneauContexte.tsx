/**
 * Séjour et logement d'une conversation : 3ᵉ colonne sur grand écran, sinon
 * dans un panneau (bouton « i » de l'en-tête). Ce qu'il faut savoir pour
 * répondre : les dates, le logement, et si l'on peut donner les codes.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, ShieldX } from 'lucide-react';
import { StatusBadge, cn } from '../../../ui';
import { dateJour, pluriel, relatif } from '../../../data/format';
import type { FilMessages, Logement, Reservation } from '../../../data/types';
import { photosLogement } from '../../logements/_composants/stats';
import { completudeFiche, eligibiliteCodes } from './logique';

interface Props {
  fil: FilMessages;
  logement?: Logement;
  reservation?: Reservation;
  /** Dans un panneau latéral : il donne déjà les marges. */
  enTiroir?: boolean;
}

function Bloc({ titre, children, enTiroir }: { titre: string; children: ReactNode; enTiroir?: boolean }) {
  return (
    <section className={cn('border-b border-(--lm-bord) py-4 last:border-b-0', enTiroir ? 'first:pt-0' : 'px-4')}>
      <h3 className="mb-2.5 text-[12px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">{titre}</h3>
      {children}
    </section>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-(--lm-encre-2)">{libelle}</dt>
      <dd className="text-right font-medium text-(--lm-encre)">{children}</dd>
    </div>
  );
}

export function PanneauContexte({ fil, logement, reservation, enTiroir }: Props) {
  const codes = eligibiliteCodes(fil, reservation);
  const fiche = completudeFiche(logement);
  const photo = logement ? photosLogement(logement)[0] : undefined;

  return (
    <div className="text-[13.5px]">
      <Bloc titre="Séjour" enTiroir={enTiroir}>
        {reservation ? (
          <>
            <dl>
              <Ligne libelle="Arrivée">
                <span className="inline-block first-letter:uppercase">{dateJour(reservation.arrivee)}</span>
                {logement?.fiche.heureArrivee && <span className="font-normal text-(--lm-encre-2)"> · {logement.fiche.heureArrivee}</span>}
              </Ligne>
              <Ligne libelle="Départ">
                <span className="inline-block first-letter:uppercase">{dateJour(reservation.depart)}</span>
                {logement?.fiche.heureDepart && <span className="font-normal text-(--lm-encre-2)"> · {logement.fiche.heureDepart}</span>}
              </Ligne>
              <Ligne libelle="Voyageurs">{pluriel(reservation.voyageur.nbPersonnes, 'personne')}</Ligne>
              <Ligne libelle="Durée">{pluriel(reservation.nuits, 'nuit')}</Ligne>
            </dl>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {reservation.statut === 'confirmee' ? (
                <span className="text-[12.5px] text-(--lm-encre-3)">Arrivée {relatif(reservation.arrivee)}</span>
              ) : (
                <StatusBadge type="statutReservation" valeur={reservation.statut} />
              )}
              <Link to={`/erp/reservations/${reservation.id}`} className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                Voir la réservation <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </>
        ) : (
          <p className="text-(--lm-encre-2)">Pas encore de réservation : ce voyageur se renseigne.</p>
        )}
      </Bloc>

      <Bloc titre="Codes d’accès" enTiroir={enTiroir}>
        <p className="flex items-start gap-2">
          {codes.autorise ? (
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-(--lm-succes)" aria-hidden />
          ) : (
            <ShieldX className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          )}
          <span>
            <span className="font-medium text-(--lm-encre)">{codes.autorise ? 'Vous pouvez les donner' : 'Ne les donnez pas'}</span>
            <span className="block text-[12.5px] text-(--lm-encre-2)">
              {/* La raison commence par une minuscule : on la met en forme de phrase. */}
              <span className="inline-block first-letter:uppercase">{codes.raison}</span>. Règle : réservation confirmée, arrivée sous 48 h ou voyageur sur place.
            </span>
          </span>
        </p>
      </Bloc>

      <Bloc titre="Logement" enTiroir={enTiroir}>
        {logement ? (
          <div className="space-y-2.5">
            {photo && <img src={photo} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-xl object-cover" />}
            <div>
              <Link to={`/erp/logements/${logement.id}`} className="font-medium text-(--lm-encre) hover:text-(--lm-or-texte) hover:underline">
                {logement.nom}
              </Link>
              <p className="text-(--lm-encre-2)">{[logement.adresse, logement.ville].filter(Boolean).join(', ')}</p>
            </div>
            {/* Seulement s'il y a un trou : une fiche complète n'appelle aucune action. */}
            {!fiche.complete && (
              <p className="text-[12.5px] text-(--lm-encre-2)">
                L’agent répondra mieux avec les infos du logement.{' '}
                <Link to={`/erp/logements/${logement.id}?onglet=fiche`} className="font-medium text-(--lm-or-texte) hover:underline">
                  Compléter
                </Link>
              </p>
            )}
          </div>
        ) : (
          <p className="text-(--lm-encre-3)">Ce logement n’existe plus dans l’ERP.</p>
        )}
      </Bloc>
    </div>
  );
}
