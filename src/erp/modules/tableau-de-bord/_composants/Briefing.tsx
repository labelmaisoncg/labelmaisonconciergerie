import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Copy } from 'lucide-react';
import { construireBriefing, journeeDe, liste, texteDuBriefing, type CleSujet } from '../../../data/briefing';
import { AUJOURDHUI, MAINTENANT } from '../../../data/format';
import { ACTION_JOURNAL_REPULL } from '../../../data/repull';
import { logementById } from '../../../data/selectors';
import { useErp } from '../../../data/store';
import { MenuActions, TON_LAVIS, cn } from '../../../ui';
import { ATraiter } from './ATraiter';
import type { ElementATraiter, TypeATraiter } from './aTraiter';

/** Dernière mise à jour des plateformes : réussie (son heure) ou en échec. */
function synchro(journal: { action: string; horodatage: string; details: string }[]) {
  const derniere = journal.filter((j) => j.action === ACTION_JOURNAL_REPULL).sort((a, b) => b.horodatage.localeCompare(a.horodatage))[0];
  if (!derniere) return {};
  return /erreur/i.test(derniere.details) ? { synchroEnEchec: true } : { derniereSynchro: derniere.horodatage };
}

/** Sujet du briefing de chaque ligne de « À faire » : le texte copié suit l'ordre de la carte. */
const SUJET_DE: Partial<Record<TypeATraiter, CleSujet>> = {
  agent: 'fiches_agent',
  signalement: 'signalements',
  message: 'messages',
  urgence: 'urgences',
  incident: 'incidents',
  avisHote: 'avis_deposer',
  avis: 'notes',
  crm: 'crm',
  facture: 'factures',
  prix: 'prix',
  double: 'alertes',
  suspecte: 'alertes',
  prix_anormal: 'alertes',
  integrite: 'alertes',
  charge: 'alertes',
  synchro: 'alertes',
};

/** Durée de la confirmation « Copié » dans l'en-tête. */
const DUREE_CONFIRMATION_MS = 2500;

/**
 * « Votre journée » : le briefing du matin en haut de l'Accueil, un seul
 * bloc. La première ligne dit la journée (arrivées, départs, logements
 * occupés ce soir) ; les suivantes sont les sujets de « À faire », chacun
 * en une phrase qui mène au bon écran. Le même contenu part en notification
 * (« Briefing du matin ») et se copie depuis le menu, dans l'ordre de la
 * carte. Calculé sans IA (data/briefing.ts), selon le rôle : prix et
 * factures pour le gérant.
 */
export function Briefing({ elements }: { elements: ElementATraiter[] }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant';
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);
  const minuteur = useRef<number>();
  useEffect(() => () => window.clearTimeout(minuteur.current), []);
  const briefing = useMemo(
    () => construireBriefing({ ...d.donnees, aujourdhui: AUJOURDHUI, maintenant: MAINTENANT, gerant, ...synchro(d.journal) }),
    [d.donnees, d.journal, gerant],
  );
  // Texte copié dans l'ordre des lignes de la carte.
  const ordre = useMemo(
    () => [...new Set(elements.map((e) => (e.id === 'agent-controle' ? 'controle_agent' : SUJET_DE[e.type])).filter((x): x is CleSujet => !!x))],
    [elements],
  );
  const { arrivees, departs } = useMemo(() => journeeDe(d.reservations, AUJOURDHUI), [d.reservations]);
  const journee = briefing.sujets.find((s) => s.cle === 'journee');
  const nom = (id: string) => logementById(d, id)?.nom ?? 'un logement';
  // Les prénoms seulement (le logement de chacun est dans le texte copié) : la ligne tient sur un téléphone.
  const qui = [
    arrivees.length ? `${arrivees.length > 1 ? 'Arrivent' : 'Arrive'} : ${liste(arrivees.map((r) => (r.voyageur?.nom ?? '').trim().split(/\s+/)[0] || 'un voyageur'))}` : '',
    departs.length ? `${departs.length > 1 ? 'Partent' : 'Part'} : ${liste(departs.map((r) => nom(r.logementId)))}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texteDuBriefing(briefing.sujets, ordre));
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
    window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => setCopie(null), DUREE_CONFIRMATION_MS);
  };

  return (
    <ATraiter
      titre="Votre journée"
      elements={elements}
      statut={
        copie === 'ok' ? (
          <>
            <Check className="text-(--lm-succes-texte)" aria-hidden />
            Copié
          </>
        ) : copie === 'echec' ? (
          'Copie impossible'
        ) : null
      }
      actions={<MenuActions label="Plus d’actions sur votre journée" actions={[{ libelle: 'Copier le briefing', icone: <Copy />, onClick: copier }]} />}
      premiere={
        <li className="flex items-start gap-3 px-4 py-3">
          <span aria-hidden className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4', TON_LAVIS.or)}>
            <CalendarDays />
          </span>
          <div className="min-w-0 flex-1">
            <Link to={journee?.lien ?? '/erp/reservations'} className="inline-flex min-h-8 items-center text-[13.5px] font-semibold text-(--lm-encre) hover:text-(--lm-or-texte) hover:underline">
              {(journee?.court ?? '').replace(/\.$/, '')}
            </Link>
            {/* Jamais coupé : les départs restent visibles sur un téléphone. */}
            {(qui || !elements.length) && <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">{qui || 'Rien d’autre ne vous attend.'}</p>}
          </div>
        </li>
      }
    />
  );
}
