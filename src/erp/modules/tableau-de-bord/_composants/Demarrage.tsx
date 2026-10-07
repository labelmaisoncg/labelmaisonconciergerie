import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plug, Plus, Rocket, X } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from '../../../data/repull';
import { prestataireConforme } from '../../../data/selectors';
import { ButtonLink, Card, IconButton, ProgressBar, cn } from '../../../ui';

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
    return window.localStorage.getItem(CLE_MASQUE) === '1';
  } catch {
    return false;
  }
}

/**
 * Mise en service de l'ERP sur une base vide : d'abord connecter les
 * plateformes et choisir les logements (page Connexions), puis les saisies
 * qui rendent tout le reste utile (automatisations, finance, pilotage). La
 * carte disparaît d'elle-même quand tout est fait.
 */
export function Demarrage() {
  const d = useErp();
  const [masque, setMasque] = useState(lireMasque);

  // Un logement venu d'une plateforme et gardé dans le choix : plateforme connectée et logement choisi.
  const importes = d.logements.filter((l) => l.repull?.id && !l.repull.horsSelection);
  const etapes: Etape[] = [
    {
      titre: 'Connectez Airbnb, Booking…',
      detail: 'et choisissez vos logements. Ils arrivent avec leurs réservations, leurs messages et leurs avis.',
      fait: importes.length > 0,
      lien: '/erp/logements/connexions',
      action: 'Connecter mes plateformes',
      icone: <Plug />,
    },
    {
      titre: 'Ajouter les propriétaires',
      detail: 'Reliez chaque logement importé à son propriétaire.',
      fait:
        d.proprietaires.some((p) => p.id !== ID_PROPRIETAIRE_A_RENSEIGNER) && !d.logements.some((l) => l.proprietaireId === ID_PROPRIETAIRE_A_RENSEIGNER),
      lien: '/erp/proprietaires?nouveau=1',
      action: 'Nouveau propriétaire',
    },
    {
      titre: 'Créer les contrats de gestion',
      detail: 'Votre commission, les frais de ménage et les dates. Sans contrat signé, un logement ne passe pas actif.',
      fait: d.mandats.length > 0,
      lien: '/erp/mandats?nouveau=1',
      action: 'Nouveau contrat',
    },
    {
      titre: 'Ajouter les prestataires et leurs documents',
      detail: 'Contrat, assurance RC Pro et attestation URSSAF à jour : sans eux, on ne peut pas leur confier de mission.',
      fait: d.prestataires.some((p) => p.statut === 'actif' && prestataireConforme(p).ok),
      lien: '/erp/prestataires?nouveau=1',
      action: 'Nouveau prestataire',
    },
    {
      titre: 'Ajouter les réservations directes',
      detail: 'Celles qui ne passent ni par Airbnb ni par Booking. Chaque départ crée tout seul son ménage.',
      fait: d.reservations.some((r) => r.statut !== 'annulee' && r.depart >= AUJOURDHUI),
      lien: '/erp/reservations?nouveau=1',
      action: 'Nouvelle réservation',
    },
  ];
  const faites = etapes.filter((e) => e.fait).length;
  if (faites === etapes.length || masque) return null;
  const prochaine = etapes.findIndex((e) => !e.fait);

  const masquer = () => {
    setMasque(true);
    try {
      window.localStorage.setItem(CLE_MASQUE, '1');
    } catch {
      /* préférence non retenue : la carte reviendra au prochain chargement */
    }
  };

  return (
    <Card className="mb-6 sm:mb-8" aria-labelledby="demarrage-titre">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or-texte) [&_svg]:size-[18px]">
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
                    <Link to={e.lien} className="hover:text-(--lm-or-texte) hover:underline">
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
