import { euros, pourcentage } from '../../../data/format';
import { METHODE_PREVISION, type Previsionnel } from '../../../data/previsionnel';
import { Card } from '../../../ui';

/** Même nom partout pour ces chiffres : « Prévisionnel » (Accueil et page du logement). */
export const TITRE_PREVISIONNEL = 'Prévisionnel';

/**
 * Prévisionnel à 30, 60 et 90 jours dans une seule carte : l'occupation
 * attendue en grand, le revenu attendu dessous (« … prévus »), et la
 * méthode en une ligne.
 * Rien à montrer (pas de séjour ni d'historique) : la carte n'est pas
 * affichée (voir data/previsionnel).
 */
export function CartePrevisionnel({ prevision, titre }: { prevision: Previsionnel; titre?: string }) {
  return (
    <Card flush>
      {titre && <h3 className="px-3 pt-3.5 text-[13.5px] font-semibold text-(--lm-encre) sm:px-5 sm:pt-4">{titre}</h3>}
      <dl className="grid grid-cols-3 divide-x divide-(--lm-bord)">
        {prevision.horizons.map((h) => (
          <div key={h.jours} className="min-w-0 px-3 py-3 sm:px-5 sm:py-3.5">
            <dt className="truncate text-[12px] font-medium text-(--lm-encre-2) sm:text-[12.5px]">{h.jours} jours</dt>
            <dd className="lm-chiffres mt-1 text-[19px] leading-tight font-semibold text-(--lm-encre) sm:text-[22px]" aria-label={`Occupation attendue ${pourcentage(h.occupation)}`}>
              {pourcentage(h.occupation)}
            </dd>
            <dd className="mt-0.5 truncate text-[12px] text-(--lm-encre-2)" aria-label={`Revenu attendu ${euros(h.revenu, true)}`}>
              {euros(h.revenu, true)} prévus
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-(--lm-bord) px-3 py-2 text-[11.5px] text-(--lm-encre-3) sm:px-5">
        {prevision.projection ? METHODE_PREVISION : 'Déjà réservé seulement : pas encore assez de séjours pour prévoir la suite.'}
      </p>
    </Card>
  );
}
