import { Link, useLocation } from 'react-router-dom';
import { cn } from '../ui';
import { GROUPES, moduleDuChemin, modulesDe, type GroupeModule } from '../modules/registry';
import { useCompteurs } from './useCompteurs';

/** Libellés courts sous l'icône (11 px). */
const COURT: Partial<Record<GroupeModule, string>> = { messagerie: 'Messages' };

/** Une conversation ouverte sur téléphone occupe tout l'écran, comme dans les apps de messagerie. */
const conversationOuverte = (chemin: string) => /^\/erp\/messagerie\/(?!activite\/?$|agent\/?$)[^/]+\/?$/.test(chemin);

/**
 * Barre d'onglets du téléphone (sous 1024 px), comme l'app Airbnb : fond
 * blanc et filet en haut, icônes de 24 px, libellés de 11 px ; l'onglet actif
 * en or (icône teintée et libellé en 600 : pas la couleur seule), les autres
 * en gris, les compteurs en pastille à l'encre.
 * Paramètres est dans le menu du compte (en haut à droite). La hauteur
 * réservée en bas du contenu est --lm-barre-onglets (erp.css).
 */
export function BarreOnglets() {
  const compteurs = useCompteurs();
  const { pathname } = useLocation();
  if (conversationOuverte(pathname)) return null;
  const active = moduleDuChemin(pathname)?.group;

  return (
    <nav
      aria-label="Menu principal"
      className="lm-sans-impression lm-barre-onglets fixed inset-x-0 bottom-0 z-30 border-t border-(--lm-bord) bg-(--lm-surface) lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {GROUPES.filter((g) => !g.bas).map((g) => {
          const n = modulesDe(g.cle).reduce((s, m) => s + (m.compteur ? compteurs[m.compteur] : 0), 0);
          const Icone = g.icon;
          const actif = active === g.cle;
          return (
            <li key={g.cle} className="min-w-0 flex-1">
              <Link
                to={g.path}
                aria-current={actif ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none transition-colors',
                  actif ? 'font-semibold text-(--lm-or-texte)' : 'font-medium text-(--lm-encre-2) active:text-(--lm-encre)',
                )}
              >
                <span className="relative">
                  <Icone className={cn('size-6', actif && 'fill-(--lm-or-lavis)')} strokeWidth={2} aria-hidden />
                  {n > 0 && (
                    <span className="lm-chiffres absolute -top-1.5 left-[15px] min-w-[18px] rounded-full bg-(--lm-encre) px-1 py-0.5 text-center text-[11px] leading-none font-semibold text-white ring-2 ring-(--lm-surface)">
                      {n > 99 ? '99+' : n}
                      <span className="sr-only"> à regarder</span>
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{COURT[g.cle] ?? g.libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
