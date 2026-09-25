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
      className="lm-sans-impression lm-defilement -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6"
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
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-(--lm-or) bg-(--lm-or-lavis) text-(--lm-brun)'
                  : 'border-(--lm-bord) bg-(--lm-surface) text-(--lm-encre-2) hover:border-(--lm-bord-fort) hover:text-(--lm-encre)',
              )
            }
          >
            {m.label}
            {n > 0 && (
              <span className="lm-chiffres rounded-full bg-(--lm-or) px-1.5 text-[11px] font-semibold text-white">
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
