/**
 * Suppléments dans la conversation (cahier B7). Quand le voyageur demande
 * une arrivée plus tôt ou un départ plus tard (demande déjà lue par l'IA, ou
 * ses mots), l'équipe voit la proposition prête : le prix réglé pour le
 * logement, la disponibilité vérifiée sur les réservations et les ménages
 * prévus, et « Insérer » qui met le texte dans la zone de réponse. Elle
 * l'envoie comme une réponse normale.
 *
 * Rien n'est encaissé ni changé par l'ERP (ni offre spéciale, ni lien de
 * paiement, ni modification de la réservation).
 */
import { Link } from 'react-router-dom';
import { Clock, Gift, LogOut, Sparkles, type LucideIcon } from 'lucide-react';
import { Button, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import { langueFil, messagesSansReponse } from '../../../data/messagerie-ia';
import type { FilMessages, Logement, Reservation } from '../../../data/types';
import {
  CLES_SUPPLEMENTS,
  LIBELLES_SUPPLEMENTS,
  disponibiliteSupplement,
  reglagesSupplements,
  resumeSupplement,
  supplementDemande,
  supplementsDuLogement,
  texteProposition,
  type CleSupplement,
  type Disponibilite,
  type ReglageSupplement,
} from '../../../data/supplements';

const ICONES: Record<CleSupplement, LucideIcon> = { arrivee_anticipee: Clock, depart_tardif: LogOut, menage_supplementaire: Sparkles, navette: Gift };
/** Le mot dit l'état ; la couleur ne fait que l'appuyer. */
const STATUTS: Record<Disponibilite['statut'], { libelle: string; classe: string }> = {
  possible: { libelle: 'possible', classe: 'text-(--lm-succes)' },
  a_verifier: { libelle: 'à vérifier', classe: 'text-(--lm-alerte)' },
  impossible: { libelle: 'pas possible ce jour-là', classe: 'text-(--lm-encre-2)' },
};

export interface PropositionPrete {
  cle: CleSupplement;
  reglage: ReglageSupplement;
  disponibilite: Disponibilite;
  /** Texte prêt à envoyer ; absent quand rien ne peut être proposé (supplément pas réglé et possible). */
  texte?: string;
}

/** Les propositions de ce séjour, pour chaque supplément : réglage, disponibilité et texte. */
export function usePropositionsSupplements(fil: FilMessages, logement: Logement | undefined, reservation: Reservation | undefined, prenom: string, signature: string) {
  const d = useErp();
  if (!logement || !reservation || reservation.logementId !== logement.id) return { demande: undefined, propositions: [] as PropositionPrete[] };
  const reglages = supplementsDuLogement(reglagesSupplements(d), logement.id);
  const langue = langueFil(fil) === 'en' ? 'en' : 'fr';
  const propositions = CLES_SUPPLEMENTS.map((cle): PropositionPrete => {
    const reglage = reglages[cle];
    const disponibilite = disponibiliteSupplement(cle, reservation, { reservations: d.reservations, missions: d.missions }, reglage, logement.fiche, AUJOURDHUI);
    // Pas réglé pour ce logement : seule la réponse « pas possible » peut partir (elle ne cite aucun prix).
    const texte =
      reglage.actif || disponibilite.statut === 'impossible'
        ? texteProposition(cle, { reservation, fiche: logement.fiche, reglage, disponibilite, prenom, signature, langue })
        : undefined;
    return { cle, reglage, disponibilite, texte };
  });
  // Demande du voyageur encore sans réponse de l'équipe.
  const demande = messagesSansReponse(fil).length ? supplementDemande(fil) : undefined;
  return { demande, propositions };
}

/** Bandeau au-dessus de la zone de réponse : le supplément demandé et sa proposition prête. */
export function PropositionSupplement({ proposition: p, logementId, onInserer }: { proposition: PropositionPrete; logementId: string; onInserer: (texte: string) => void }) {
  const { utilisateur, lectureSeule } = useErp();
  const Icone = ICONES[p.cle];
  const titre = LIBELLES_SUPPLEMENTS[p.cle].titre;
  const statut = STATUTS[p.disponibilite.statut];
  const regle = p.reglage.actif;
  const prix = regle && p.disponibilite.statut !== 'impossible' ? ` · ${resumeSupplement(p.cle, p.reglage)}` : '';
  const constats = [...p.disponibilite.constats, ...(!regle && p.disponibilite.statut !== 'impossible' ? ['Pas proposé pour ce logement.'] : [])].join(' ');
  return (
    <div role="group" aria-label={`Demande : ${titre.toLowerCase()}`} className="flex items-center gap-2 rounded-lg bg-(--lm-surface-2) py-1.5 pr-1.5 pl-3 text-[13px]">
      <Icone className="size-4 shrink-0 text-(--lm-or-texte)" aria-hidden />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-medium text-(--lm-encre)">
          {titre}
          <span className="font-normal">
            {' · '}
            <span className={cn('font-medium', statut.classe)}>{statut.libelle}</span>
            <span className="lm-chiffres text-(--lm-encre-2)">{prix}</span>
          </span>
        </p>
        <p className="line-clamp-2 text-[12px] text-(--lm-encre-2)" title={constats}>
          {constats}
          {!regle && p.disponibilite.statut !== 'impossible' && utilisateur.role === 'gerant' && !lectureSeule && (
            <>
              {' '}
              <Link to={`/erp/logements/${encodeURIComponent(logementId)}`} className="font-medium text-(--lm-or-texte) hover:underline">
                Régler les suppléments
              </Link>
            </>
          )}
        </p>
      </div>
      {p.texte && (
        <Button size="sm" onClick={() => onInserer(p.texte!)} className="shrink-0" title={p.disponibilite.statut === 'impossible' ? 'Insérer une réponse polie : ce n’est pas possible ce jour-là' : 'Insérer la proposition avec le prix réglé'}>
          Insérer
        </Button>
      )}
    </div>
  );
}
