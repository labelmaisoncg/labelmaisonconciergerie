import { useId, useMemo } from 'react';
import { Check } from 'lucide-react';
import { COULEURS_LOGEMENT, couleursDesLogements, teintesDesLogements, type TeinteLogement } from '../../../data/couleurs-logement';
import { useErp } from '../../../data/store';
import type { CouleurLogement, Id } from '../../../data/types';
import { cn } from '../../../ui';

/** La couleur de chaque logement de l'espace (tous, pas seulement ceux affichés : la couleur ne dépend pas de l'écran). */
export function useCouleursLogements(): { couleurs: Map<Id, TeinteLogement>; teintes: Map<Id, string> } {
  const { logements } = useErp();
  return useMemo(() => {
    const couleurs = couleursDesLogements(logements);
    return { couleurs, teintes: teintesDesLogements(couleurs) };
  }, [logements]);
}

/**
 * Pastille de couleur d'un logement, devant son nom. Décorative : le nom est
 * toujours écrit à côté, les lecteurs d'écran ne la lisent pas.
 */
export function PastilleLogement({ couleur, className }: { couleur?: TeinteLogement; className?: string }) {
  if (!couleur) return null;
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: couleur.teinte }} />;
}

/**
 * Choix de la couleur d'un logement (« Modifier le logement ») : huit ronds
 * de 44 px au toucher, de vrais boutons radio (flèches du clavier), la
 * couleur retenue cochée d'un trait blanc. Au clavier, l'anneau d'encre
 * entoure le rond (motif de Checklist : le bouton radio caché n'a pas de
 * contour à lui).
 */
export function ChoixCouleurLogement({ valeur, onChange, className }: { valeur: CouleurLogement; onChange: (c: CouleurLogement) => void; className?: string }) {
  const nom = useId();
  const aideId = `${nom}-aide`;
  return (
    <fieldset className={cn('min-w-0', className)} aria-describedby={aideId}>
      <legend className="mb-1 text-[13px] font-semibold text-(--lm-encre)">Couleur dans les réservations</legend>
      <div className="-mx-1.5 flex flex-wrap">
        {COULEURS_LOGEMENT.map((c) => (
          <label key={c.cle} title={c.nom} className="group grid size-11 cursor-pointer place-items-center">
            <input type="radio" name={nom} value={c.cle} checked={valeur === c.cle} onChange={() => onChange(c.cle)} aria-label={c.nom} className="peer sr-only focus:outline-none" />
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full text-white transition-transform group-hover:scale-110 peer-focus-visible:ring-2 peer-focus-visible:ring-(--lm-encre) peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-(--lm-surface)"
              style={{ background: c.teinte }}
            >
              {valeur === c.cle && <Check className="size-4" strokeWidth={3} />}
            </span>
          </label>
        ))}
      </div>
      <p id={aideId} className="mt-1 text-[12px] text-(--lm-encre-3)">
        Sa pastille dans Planning, Mois et Séjours.
      </p>
    </fieldset>
  );
}
