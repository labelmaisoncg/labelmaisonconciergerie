import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';

export interface Miette {
  libelle: string;
  to?: string;
}

export interface PageHeaderProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  /** Fil d'Ariane au-dessus du titre. */
  fil?: Miette[];
  /**
   * Une icône seule tout en haut à droite, à l'écart des actions (la corbeille
   * d'une fiche) : au même endroit sur téléphone et sur ordinateur.
   */
  coin?: ReactNode;
  className?: string;
}

export function PageHeader({ titre, sousTitre, actions, fil: filBrut, coin, className }: PageHeaderProps) {
  // La barre latérale et les onglets de rubrique disent déjà où l'on est : le
  // fil d'Ariane ne s'affiche que s'il ramène vers une page parente (fiche).
  const sansRacine = (filBrut ?? []).filter((m) => m.libelle !== 'ERP' && m.to !== '/erp');
  const fil = sansRacine.some((m) => m.to) ? sansRacine : undefined;
  // Page parente la plus proche : sur téléphone, un bouton retour rond (Airbnb) remplace le fil.
  const parent = fil && [...fil].reverse().find((m) => m.to);
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6', coin && 'relative', className)}>
      <div className={cn('min-w-0', coin && 'pr-12')}>
        {parent && (
          <Link
            to={parent.to!}
            aria-label={`Retour : ${parent.libelle}`}
            title={`Retour : ${parent.libelle}`}
            className="mb-3 grid size-10 place-items-center rounded-full bg-(--lm-surface-2) text-(--lm-encre) hover:bg-(--lm-neutre-lavis) sm:hidden"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        )}
        {fil && fil.length > 0 && (
          <nav aria-label="Fil d’Ariane" className="mb-1.5 hidden sm:block">
            <ol className="flex flex-wrap items-center gap-1 text-[13px] text-(--lm-encre-2)">
              {fil.map((m, i) => (
                <li key={`${m.libelle}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                  {m.to ? (
                    // Zone de toucher de 32 px ; les marges négatives gardent la hauteur de la ligne.
                    <Link to={m.to} className="-my-1.5 inline-flex min-h-8 items-center font-medium text-(--lm-encre) underline-offset-[3px] hover:underline">
                      {m.libelle}
                    </Link>
                  ) : (
                    <span aria-current={i === fil.length - 1 ? 'page' : undefined}>{m.libelle}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {/* Titre de page d'Airbnb : 24 px sur téléphone, 28 px au-delà, en 600 (police du jeton --lm-titre). */}
        <h1 className="lm-titre text-[24px] leading-tight text-(--lm-encre) sm:text-[28px]">{titre}</h1>
        {sousTitre && <p className="mt-1 max-w-3xl text-[15px] text-(--lm-encre-2)">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {/* Après le titre dans l'ordre de lecture (VoiceOver, tabulation), en haut à droite à l'écran. */}
      {coin && <div className="absolute top-0 right-0">{coin}</div>}
    </header>
  );
}
