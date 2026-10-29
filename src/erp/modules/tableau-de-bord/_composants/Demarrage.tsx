import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BotMessageSquare, Check, KeyRound, Plug, Plus, Power, Rocket, UserPlus, Users, X } from 'lucide-react';
import { useErp } from '../../../data/store';
import { cleLocale, espaceOuvert, estLabelMaison } from '../../../data/espaces';
import { reglagesAgent } from '../../../data/reglages';
import { ButtonLink, Card, IconButton, ProgressBar, cn } from '../../../ui';
import { completudeFiche } from '../../logements/_composants/stats';
import { appelerRouteGerant } from '../../crm/_composants/api-connecteur';

/** Préférence de l'appareil, propre à chaque espace (inchangée pour Label Maison). */
const CLE_MASQUE = 'lm-erp-demarrage-masque';

interface Etape {
  titre: string;
  detail: string;
  fait: boolean;
  lien: string;
  action: string;
  icone?: ReactNode;
}

function lireMasque(): boolean {
  try {
    return window.localStorage.getItem(cleLocale(CLE_MASQUE)) === '1';
  } catch {
    return false;
  }
}

/**
 * Clé Repull de l'espace enregistrée ? (espace d'une conciergerie invitée,
 * gérant seulement ; undefined : pas encore su, ou sans objet).
 */
function useCleRepull(actif: boolean): boolean | undefined {
  const [cle, setCle] = useState<boolean>();
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    appelerRouteGerant<{ ok?: boolean; erreur?: string; cle?: boolean }>('/api/erp-espaces?action=repull')
      .then((r) => vivant && setCle(r.cle === true))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [actif]);
  return cle;
}

/**
 * Mise en service : connecter les plateformes et choisir les logements (page
 * Connexions), puis donner à l'agent les informations de chaque logement. La
 * carte disparaît d'elle-même quand tout est fait.
 *
 * Espace d'une conciergerie invitée (pas Label Maison) : ses premiers pas
 * en plus — relier son compte Repull, inviter son équipe, ses propriétaires
 * et responsables, puis allumer l'agent (en pause jusque-là).
 */
export function Demarrage() {
  const d = useErp();
  const [masque, setMasque] = useState(lireMasque);
  const nouvelEspace = !estLabelMaison(espaceOuvert());
  const gerant = d.utilisateur.role === 'gerant';
  const cleRepull = useCleRepull(d.mode === 'reel' && nouvelEspace && gerant);

  // Un logement venu d'une plateforme et gardé dans le choix : plateforme connectée et logement choisi.
  const importes = d.logements.filter((l) => l.repull?.id && !l.repull.horsSelection);
  const incomplet = d.logements.find((l) => l.statut === 'actif' && completudeFiche(l.fiche).manquants.length);
  const etapes: Etape[] = [
    ...(nouvelEspace && gerant
      ? [
          {
            titre: 'Reliez votre compte Repull',
            detail: 'Repull relie vos comptes Airbnb, Booking… à l’ERP. Collez la clé de votre compte Repull : vérifiée, puis gardée dans un coffre chiffré.',
            fait: cleRepull === true || importes.length > 0,
            lien: '/erp/parametres/plateformes',
            action: 'Ajouter ma clé Repull',
            icone: <KeyRound />,
          },
        ]
      : []),
    {
      titre: 'Connectez Airbnb, Booking…',
      detail: 'et choisissez vos logements. Ils arrivent avec leurs réservations, leurs messages et leurs avis.',
      fait: importes.length > 0,
      lien: '/erp/logements/connexions',
      action: 'Connecter mes plateformes',
      icone: <Plug />,
    },
    {
      titre: 'Renseignez les infos pour votre agent',
      detail: 'Arrivée, accès, wifi, règles : votre agent répond aux voyageurs avec ces informations.',
      fait: importes.length > 0 && !incomplet,
      lien: incomplet ? `/erp/logements/${incomplet.id}?onglet=fiche` : '/erp/logements',
      action: 'Compléter les infos',
      icone: <BotMessageSquare />,
    },
    ...(nouvelEspace && gerant
      ? [
          {
            titre: 'Invitez votre équipe',
            detail: 'Ajoutez son adresse et son rôle, puis envoyez l’invitation : chacun crée son compte avec le lien reçu.',
            fait: d.utilisateurs.length > 1,
            lien: '/erp/parametres',
            action: 'Inviter mon équipe',
            icone: <Users />,
          },
          {
            titre: 'Invitez propriétaires et responsables',
            detail: 'Chacun reçoit un lien vers son espace : ses logements, ses bilans, ses tâches du jour.',
            fait: d.accesProprietaires.length + d.accesOperations.length > 0,
            lien: '/erp/parametres/acces',
            action: 'Inviter',
            icone: <UserPlus />,
          },
          {
            titre: 'Allumez votre agent quand tout est prêt',
            detail: 'Il est en pause : il ne répond à aucun voyageur tant que vous ne l’allumez pas. Ses réponses sont limitées chaque mois.',
            fait: reglagesAgent(d).actif,
            lien: '/erp/messagerie/agent',
            action: 'Régler votre agent',
            icone: <Power />,
          },
        ]
      : []),
  ];
  const faites = etapes.filter((e) => e.fait).length;
  if (faites === etapes.length || masque) return null;
  const prochaine = etapes.findIndex((e) => !e.fait);

  const masquer = () => {
    setMasque(true);
    try {
      window.localStorage.setItem(cleLocale(CLE_MASQUE), '1');
    } catch {
      /* préférence non retenue : la carte reviendra au prochain chargement */
    }
  };

  return (
    <Card className="mb-6 sm:mb-8" aria-labelledby="demarrage-titre">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre) [&_svg]:size-[18px]">
          <Rocket />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="demarrage-titre" className="text-[16px] font-semibold text-(--lm-encre)">
            Démarrage
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar valeur={faites / etapes.length} className="max-w-xs flex-1" />
            <span className="lm-chiffres text-[12.5px] text-(--lm-encre-2)">
              {faites} sur {etapes.length}
            </span>
          </div>
        </div>
        <IconButton label="Masquer la carte Démarrage" size="sm" onClick={masquer}>
          <X />
        </IconButton>
      </div>
      <ol className="mt-4 divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
        {etapes.map((e, i) => (
          <li
            key={e.titre}
            className={cn(
              'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4',
              i === prochaine && '-mx-2 my-1 rounded-lg border-0 bg-(--lm-or-lavis) px-2 sm:-mx-3 sm:px-3',
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                  e.fait ? 'bg-(--lm-succes) text-white' : i === prochaine ? 'bg-(--lm-or-texte) text-white' : 'bg-(--lm-surface-2) text-(--lm-encre-2)',
                )}
              >
                {e.fait ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn('text-[14px] font-medium', e.fait ? 'text-(--lm-encre-2) line-through decoration-(--lm-encre-3)' : 'text-(--lm-encre)')}>
                  {/* Les autres étapes restent accessibles par leur titre, sans bouton concurrent. */}
                  {!e.fait && i !== prochaine ? (
                    <Link to={e.lien} className="-my-1.5 inline-flex min-h-8 items-center hover:underline">
                      {e.titre}
                    </Link>
                  ) : (
                    e.titre
                  )}
                  <span className="sr-only">{e.fait ? ' (fait)' : ' (à faire)'}</span>
                </p>
                {/* Le « pourquoi » seulement pour l'étape en cours : les autres tiennent sur une ligne. */}
                {i === prochaine && <p className="text-[12.5px] text-(--lm-encre-2)">{e.detail}</p>}
              </div>
            </div>
            {/* Une seule action mise en avant : l'étape suivante. Les autres restent accessibles, en retrait. */}
            {i === prochaine && (
              <ButtonLink
                to={e.lien}
                variant="primary"
                size="sm"
                icone={e.icone ?? <Plus />}
                className="self-start sm:self-center"
              >
                {e.action}
              </ButtonLink>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
