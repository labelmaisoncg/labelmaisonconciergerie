/**
 * Contenu du détail d'un séjour, dans l'ordre où on le lit : le séjour, la
 * conversation avec le voyageur, les montants, puis son avis. Utilisé par le
 * tiroir du planning et la page dédiée.
 */
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, MessageSquare, Star } from 'lucide-react';
import { Badge, Card, CardHeader } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { dateHeure, dateJour, euros, note, pluriel, relatif } from '../../../data/format';
import { commissionReservation, logementById, mandatDuLogement, netProprietaire } from '../../../data/selectors';
import type { Reservation } from '../../../data/types';
import { VisuelLogement } from '../../logements/_composants/Visuel';
import { TEINTE_CANAL, recu } from './outils';

function Ligne({ libelle, valeur, fort, moins, separe }: { libelle: string; valeur: number; fort?: boolean; moins?: boolean; separe?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${separe ? 'mt-1 border-t border-(--lm-bord) pt-2.5' : ''} ${fort ? 'font-semibold text-(--lm-encre)' : 'text-(--lm-encre-2)'}`}
    >
      <dt className="text-[13.5px]">{libelle}</dt>
      <dd className={`lm-chiffres text-(--lm-encre) ${fort ? 'text-[15px]' : 'text-[13.5px]'}`}>{moins && valeur > 0 ? `− ${euros(valeur)}` : euros(valeur)}</dd>
    </div>
  );
}

/** La plateforme en texte, précédée de sa pastille de couleur (celle du planning). */
export function PastilleCanal({ canal }: { canal: Reservation['canal'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-(--lm-encre-2)">
      <span aria-hidden className="size-2 rounded-full" style={{ background: TEINTE_CANAL[canal].plein }} />
      {LIBELLES.canal[canal]}
    </span>
  );
}

export function FicheReservation({ r }: { r: Reservation }) {
  const d = useErp();
  const logement = logementById(d, r.logementId);
  const mandat = mandatDuLogement(d.mandats, r.logementId);
  const fils = d.filsMessages.filter((f) => f.reservationId === r.id);
  const annulee = r.statut === 'annulee';
  const reference = r.repull?.code ?? r.channexBookingId;

  return (
    <div className="grid gap-4">
      <Card>
        {logement ? (
          <Link to={`/erp/logements/${logement.id}`} className="group -m-1 mb-3 flex items-center gap-3 rounded-lg p-1 hover:bg-(--lm-surface-2)">
            <VisuelLogement logement={logement} taille="sm" className="size-12 shrink-0 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-(--lm-encre) group-hover:text-(--lm-or-texte)">{logement.nom}</span>
              <span className="block truncate text-[13px] text-(--lm-encre-2)">{logement.ville}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          </Link>
        ) : (
          <p className="mb-3 text-[14px] text-(--lm-encre-2)">Logement inconnu</p>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-(--lm-bord) pt-3 text-[13.5px]">
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Arrivée</dt>
            <dd className="font-medium text-(--lm-encre) first-letter:uppercase">{dateJour(r.arrivee)}</dd>
            <dd className="text-[12.5px] text-(--lm-encre-2)">
              {logement?.fiche.heureArrivee ? `Dès ${logement.fiche.heureArrivee} · ` : ''}
              {relatif(r.arrivee)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Départ</dt>
            <dd className="font-medium text-(--lm-encre) first-letter:uppercase">{dateJour(r.depart)}</dd>
            {logement?.fiche.heureDepart && <dd className="text-[12.5px] text-(--lm-encre-2)">Avant {logement.fiche.heureDepart}</dd>}
          </div>
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Voyageurs</dt>
            <dd className="lm-chiffres font-medium text-(--lm-encre)">
              {pluriel(r.voyageur.nbPersonnes, 'personne')}
              {r.voyageur.pays ? ` · ${r.voyageur.pays}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Durée</dt>
            <dd className="lm-chiffres font-medium text-(--lm-encre)">{pluriel(r.nuits, 'nuit')}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[12px] text-(--lm-encre-3)">Réservé sur</dt>
            <dd className="flex flex-wrap items-center gap-x-2">
              <PastilleCanal canal={r.canal} />
              {reference && <span className="lm-chiffres text-[12.5px] text-(--lm-encre-3)">Référence {reference}</span>}
            </dd>
          </div>
        </dl>
        {r.repull && !annulee && (
          <p className="mt-3 text-[12.5px] text-(--lm-encre-3)">
            Pour modifier ou annuler ce séjour, passez par {r.canal === 'direct' || r.canal === 'autre' ? 'la plateforme' : LIBELLES.canal[r.canal]} : la
            mise à jour arrive ici toute seule.
          </p>
        )}
      </Card>

      {fils.length > 0 && (
        <Card>
          <CardHeader titre="Conversation" />
          <ul className="-mx-2 grid gap-1">
            {fils.map((f) => {
              const dernier = f.messages[f.messages.length - 1];
              return (
                <li key={f.id}>
                  <Link to={`/erp/messagerie/${f.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-(--lm-surface-2)">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-(--lm-or-lavis) text-(--lm-or-texte) [&_svg]:size-4">
                      <MessageSquare />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-(--lm-encre)">{dernier?.texte ?? 'Conversation sans message'}</span>
                      <span className="block text-[12.5px] text-(--lm-encre-3)">
                        {pluriel(f.messages.length, 'message')} · dernier le {dateHeure(f.dernierMessageLe)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3) group-hover:text-(--lm-or-texte)" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader titre="Montants" />
        {annulee && <p className="mb-2 text-[13px] text-(--lm-encre-2)">Séjour annulé : montants donnés à titre indicatif.</p>}
        {r.repull?.devise && r.repull.devise !== 'EUR' && (
          <p className="mb-2 text-[12.5px] text-(--lm-alerte)">Montants en {r.repull.devise} (devise de la plateforme), non convertis.</p>
        )}
        <dl>
          <Ligne libelle={`${pluriel(r.nuits, 'nuit')}`} valeur={r.montantBrutCentimes - r.fraisMenageCentimes} />
          {r.fraisMenageCentimes > 0 && <Ligne libelle="Ménage" valeur={r.fraisMenageCentimes} />}
          <Ligne libelle="Total du séjour" valeur={r.montantBrutCentimes} separe />
          {r.commissionPlateformeCentimes > 0 && (
            <Ligne libelle={r.canal === 'direct' ? 'Frais de paiement' : 'Frais de la plateforme'} valeur={r.commissionPlateformeCentimes} moins />
          )}
          <Ligne libelle="Vous recevez" valeur={recu(r)} fort separe />
        </dl>
        {mandat && (
          <details className="mt-2 text-[13px]">
            <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 text-[12.5px] font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
              Part du propriétaire
              <ChevronDown className="size-3.5 transition-transform [details[open]_&]:rotate-180" aria-hidden />
            </summary>
            <dl>
              <Ligne libelle={`Commission Label Maison (${mandat.commissionPct} %)`} valeur={commissionReservation(r, mandat)} moins />
              <Ligne libelle="Pour le propriétaire" valeur={netProprietaire(r, mandat)} fort />
            </dl>
            <p className="mt-1 text-[12px] text-(--lm-encre-3)">Calculée hors ménage et hors frais de la plateforme.</p>
          </details>
        )}
      </Card>

      {(r.noteVoyageur !== undefined || r.commentaireVoyageur) && (
        <Card>
          <CardHeader
            titre="Avis du voyageur"
            actions={
              r.noteVoyageur !== undefined && (
                <Badge tone={r.noteVoyageur < SEUIL_NOTE_CONTROLE ? 'alerte' : 'succes'} icone={<Star />}>
                  <span className="sr-only">Note </span>
                  {note(r.noteVoyageur)}
                  <span className="sr-only"> sur 5</span>
                </Badge>
              )
            }
          />
          {r.commentaireVoyageur && <blockquote className="border-l-2 border-(--lm-or) pl-3 text-[13.5px] text-(--lm-encre-2) italic">« {r.commentaireVoyageur} »</blockquote>}
          {r.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE && (
            <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Note sous {note(SEUIL_NOTE_CONTROLE)} : à lire et, si besoin, à traiter avec l’équipe.</p>
          )}
        </Card>
      )}
    </div>
  );
}
