import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from './cn';

export interface Colonne<T> {
  cle: string;
  titre: ReactNode;
  rendu: (ligne: T) => ReactNode;
  /** Comparateur : rend la colonne triable. */
  tri?: (a: T, b: T) => number;
  align?: 'gauche' | 'droite' | 'centre';
  /** Classe de largeur, ex. 'w-32'. */
  largeur?: string;
  /** Masquée sous 640 px pour garder l'essentiel lisible. */
  masquerMobile?: boolean;
}

export interface TableProps<T> {
  colonnes: Colonne<T>[];
  lignes: T[];
  cleLigne: (ligne: T) => string;
  onLigneClick?: (ligne: T) => void;
  /** Libellé accessible du tableau. */
  legende?: string;
  vide?: ReactNode;
  triInitial?: { cle: string; sens: 'asc' | 'desc' };
  dense?: boolean;
  /** Ligne mise en évidence (sélection courante). */
  ligneActive?: string;
  className?: string;
}

const ALIGN = { gauche: 'text-left', droite: 'text-right', centre: 'text-center' };

/** Tableau responsive : défile horizontalement dans son conteneur, jamais la page. */
export function Table<T>({
  colonnes,
  lignes,
  cleLigne,
  onLigneClick,
  legende,
  vide,
  triInitial,
  dense,
  ligneActive,
  className,
}: TableProps<T>) {
  const [tri, setTri] = useState(triInitial);

  const triees = useMemo(() => {
    const col = tri && colonnes.find((c) => c.cle === tri.cle);
    if (!col?.tri) return lignes;
    const copie = [...lignes].sort(col.tri);
    return tri!.sens === 'desc' ? copie.reverse() : copie;
  }, [lignes, colonnes, tri]);

  const basculer = (cle: string) =>
    setTri((t) => (t?.cle === cle ? { cle, sens: t.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' }));

  const clavier = (e: KeyboardEvent, ligne: T) => {
    if (onLigneClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onLigneClick(ligne);
    }
  };

  const cellule = dense ? 'px-3 py-2' : 'px-3 py-2.5 sm:px-4';

  return (
    <div className={cn('lm-defilement w-full overflow-x-auto rounded-xl border border-(--lm-bord) bg-(--lm-surface)', className)}>
      <table className="w-full border-collapse text-[13.5px]">
        {legende && <caption className="sr-only">{legende}</caption>}
        <thead>
          <tr className="border-b border-(--lm-bord) bg-(--lm-surface-2)">
            {colonnes.map((c) => {
              const actif = tri?.cle === c.cle;
              return (
                <th
                  key={c.cle}
                  scope="col"
                  aria-sort={actif ? (tri!.sens === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    cellule,
                    'text-[12px] font-medium whitespace-nowrap text-(--lm-encre-2)',
                    ALIGN[c.align ?? 'gauche'],
                    c.largeur,
                    c.masquerMobile && 'hidden sm:table-cell',
                  )}
                >
                  {c.tri ? (
                    <button
                      type="button"
                      onClick={() => basculer(c.cle)}
                      className={cn('inline-flex items-center gap-1 hover:text-(--lm-encre)', actif && 'text-(--lm-encre)')}
                    >
                      {c.titre}
                      {actif ? (
                        tri!.sens === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    c.titre
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {triees.length === 0 ? (
            <tr>
              <td colSpan={colonnes.length} className="px-4 py-10 text-center text-sm text-(--lm-encre-3)">
                {vide ?? 'Aucun élément.'}
              </td>
            </tr>
          ) : (
            triees.map((ligne) => {
              const cle = cleLigne(ligne);
              return (
                <tr
                  key={cle}
                  onClick={onLigneClick ? () => onLigneClick(ligne) : undefined}
                  onKeyDown={onLigneClick ? (e) => clavier(e, ligne) : undefined}
                  tabIndex={onLigneClick ? 0 : undefined}
                  aria-selected={ligneActive ? ligneActive === cle : undefined}
                  className={cn(
                    'border-b border-(--lm-bord) last:border-b-0',
                    onLigneClick && 'cursor-pointer hover:bg-(--lm-surface-2) focus-visible:bg-(--lm-surface-2)',
                    ligneActive === cle && 'bg-(--lm-or-lavis) hover:bg-(--lm-or-lavis)',
                  )}
                >
                  {colonnes.map((c) => (
                    <td
                      key={c.cle}
                      className={cn(cellule, 'align-middle text-(--lm-encre)', ALIGN[c.align ?? 'gauche'], c.align === 'droite' && 'lm-chiffres', c.masquerMobile && 'hidden sm:table-cell')}
                    >
                      {c.rendu(ligne)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
