import { useState } from 'react';
import { Check, Plus, Rocket, X } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import { prestataireConforme } from '../../../data/selectors';
import { ButtonLink, Card, IconButton, ProgressBar, cn } from '../../../ui';

const CLE_MASQUE = 'lm-erp-demarrage-masque';

interface Etape {
  titre: string;
  detail: string;
  fait: boolean;
  lien: string;
  action: string;
}

function lireMasque(): boolean {
  try {
    return window.localStorage.getItem(CLE_MASQUE) === '1';
  } catch {
    return false;
  }
}

/**
 * Mise en service de l'ERP sur une base vide : les cinq saisies qui rendent
 * tout le reste utile (automatisations, finance, pilotage). La carte disparaît
 * d'elle-même quand tout est fait.
 */
export function Demarrage() {
  const d = useErp();
  const [masque, setMasque] = useState(lireMasque);

  const etapes: Etape[] = [
    {
      titre: 'Ajouter les propriétaires',
      detail: 'Contact, adresse, type (particulier, SCI, société).',
      fait: d.proprietaires.length > 0,
      lien: '/erp/proprietaires?nouveau=1',
      action: 'Nouveau propriétaire',
    },
    {
      titre: 'Ajouter les logements',
      detail: 'Fiche, couchages, accès, dotation de linge, checklist de lancement.',
      fait: d.logements.length > 0,
      lien: '/erp/logements?nouveau=1',
      action: 'Nouveau logement',
    },
    {
      titre: 'Créer les mandats (commission)',
      detail: 'Commission, frais de ménage, dates : sans mandat signé, un logement ne passe pas actif.',
      fait: d.mandats.length > 0,
      lien: '/erp/mandats?nouveau=1',
      action: 'Nouveau mandat',
    },
    {
      titre: 'Ajouter les prestataires et leurs documents',
      detail: 'Contrat, RC Pro et attestation URSSAF valides : sinon aucune mission ne peut leur être confiée.',
      fait: d.prestataires.some((p) => p.statut === 'actif' && prestataireConforme(p).ok),
      lien: '/erp/prestataires?nouveau=1',
      action: 'Nouveau prestataire',
    },
    {
      titre: 'Saisir les réservations à venir',
      detail: 'Airbnb et Booking.com arrivent seuls par Repull ; saisissez ici les réservations directes. Chaque départ crée automatiquement son ménage.',
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
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or) [&_svg]:size-[18px]">
          <Rocket />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="demarrage-titre" className="text-[16px] font-semibold text-(--lm-encre)">
            Démarrage
          </h2>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">
            Cinq saisies pour mettre l’ERP en service avec vos données réelles. Les automatisations prennent le relais ensuite.
          </p>
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
          <li key={e.titre} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                  e.fait ? 'bg-(--lm-succes) text-white' : i === prochaine ? 'bg-(--lm-or) text-white' : 'bg-(--lm-surface-2) text-(--lm-encre-2)',
                )}
              >
                {e.fait ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn('text-[14px] font-medium', e.fait ? 'text-(--lm-encre-2) line-through decoration-(--lm-encre-3)' : 'text-(--lm-encre)')}>
                  {e.titre}
                  <span className="sr-only">{e.fait ? ' (fait)' : ' (à faire)'}</span>
                </p>
                <p className="text-[12.5px] text-(--lm-encre-3)">{e.detail}</p>
              </div>
            </div>
            <ButtonLink to={e.lien} size="sm" variant={i === prochaine ? 'primary' : 'secondary'} icone={<Plus />} className="self-start sm:self-center">
              {e.action}
            </ButtonLink>
          </li>
        ))}
      </ol>
    </Card>
  );
}
