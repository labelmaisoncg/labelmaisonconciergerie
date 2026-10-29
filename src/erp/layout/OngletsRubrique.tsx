import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../ui';
import { moduleDuChemin, modulesDe, rubriqueDe } from '../modules/registry';
import { useCompteurs } from './useCompteurs';

/**
 * Petite barre d'onglets commune à une rubrique (ex. Opérations : Ménages,
 * Linge, Incidents, Prestataires). Affichée par le layout, sous l'en-tête,
 * dès qu'une rubrique regroupe plusieurs pages. Défile horizontalement sur
 * mobile.
 */
export function OngletsRubrique() {
  const { pathname } = useLocation();
  const compteurs = useCompteurs();
  const rubrique = rubriqueDe(moduleDuChemin(pathname));
  const pages = rubrique ? modulesDe(rubrique.cle) : [];
  if (pages.length < 2) return null;

  return (
    <nav
      aria-label={`Pages de la rubrique ${rubrique!.libelle}`}
      className="lm-sans-impression lm-defilement -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-(--lm-bord) px-4 sm:-mx-6 sm:px-6"
    >
      {pages.map((m) => {
        const n = m.compteur ? compteurs[m.compteur] : 0;
        return (
          <NavLink
            key={m.key}
            to={m.path}
            end={m.segment === ''}
            className={({ isActive }) =>
              cn(
                // Onglets d'Airbnb (comme ui/Tabs) : l'actif à l'encre, en 600, souligné de 2 px.
                'relative inline-flex h-11 shrink-0 items-center gap-1.5 px-3 text-[14px] whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5',
                isActive
                  ? 'font-semibold text-(--lm-encre) after:bg-(--lm-encre)'
                  : 'font-medium text-(--lm-encre-2) hover:text-(--lm-encre) hover:after:bg-(--lm-bord-fort)',
              )
            }
          >
            {m.label}
            {n > 0 && (
              <span className="lm-chiffres rounded-full bg-(--lm-encre) px-1.5 text-[11px] font-semibold text-white">
                {n}
                <span className="sr-only"> à regarder</span>
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
