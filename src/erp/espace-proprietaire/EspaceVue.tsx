import { useEffect, type ReactNode } from 'react';
import { BarChart3, CalendarDays, FolderOpen, Home, LogOut } from 'lucide-react';
import type { VueProprietaire } from '../data/types-proprietaire';
import { cn } from '../ui';
import { Accueil } from './Accueil';
import { Bilans } from './Bilans';
import { Calendrier } from './Calendrier';
import { Documents } from './Documents';
import type { LienDocument, OngletEspace } from './commun';

const ONGLETS: { cle: OngletEspace; libelle: string; icone: ReactNode }[] = [
  { cle: 'accueil', libelle: 'Accueil', icone: <Home /> },
  { cle: 'calendrier', libelle: 'Calendrier', icone: <CalendarDays /> },
  { cle: 'bilans', libelle: 'Bilans', icone: <BarChart3 /> },
  { cle: 'documents', libelle: 'Documents', icone: <FolderOpen /> },
];

export interface EspaceVueProps {
  vue: VueProprietaire;
  onglet: OngletEspace;
  onOnglet: (o: OngletEspace) => void;
  /** Bilan ouvert (mois « AAAA-MM »). */
  bilan?: string;
  onBilan: (mois?: string) => void;
  onMoisCalendrier: (mois: string) => void;
  calendrierEnCours?: boolean;
  LienDocument: LienDocument;
  onSortir?: () => void;
  /** Bandeau au-dessus de l'en-tête (aperçu du gérant, démo). */
  bandeau?: ReactNode;
}

/**
 * L'espace du propriétaire : quatre onglets, barre du bas sur téléphone
 * (comme une app), onglets dans l'en-tête sur ordinateur.
 */
export function EspaceVue({ vue, onglet, onOnglet, bilan, onBilan, onMoisCalendrier, calendrierEnCours, LienDocument, onSortir, bandeau }: EspaceVueProps) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [onglet, bilan]);

  return (
    <div className="min-h-screen bg-(--lm-fond)">
      {bandeau}
      <header className="lm-sans-impression sticky top-0 z-20 border-b border-(--lm-bord) bg-(--lm-surface)/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="lm-serif truncate text-[18px] leading-tight text-(--lm-brun)">Label Maison</p>
            <p className="truncate text-[11.5px] text-(--lm-encre-2)">Espace propriétaire</p>
          </div>
          <nav aria-label="Rubriques" className="hidden items-center gap-1 sm:flex">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                type="button"
                aria-current={o.cle === onglet ? 'page' : undefined}
                onClick={() => onOnglet(o.cle)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none [&_svg]:size-4',
                  o.cle === onglet ? 'bg-(--lm-or-lavis) text-(--lm-brun)' : 'text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)',
                )}
              >
                {o.icone}
                {o.libelle}
              </button>
            ))}
          </nav>
          {onSortir ? (
            <button
              type="button"
              onClick={onSortir}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="max-sm:sr-only">Se déconnecter</span>
            </button>
          ) : (
            <span className="w-9 sm:hidden" aria-hidden />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-14">
        {onglet === 'accueil' && <Accueil vue={vue} onOnglet={onOnglet} onBilan={onBilan} LienDocument={LienDocument} />}
        {onglet === 'calendrier' && <Calendrier vue={vue} onMois={onMoisCalendrier} enCours={calendrierEnCours} />}
        {onglet === 'bilans' && <Bilans vue={vue} choisi={bilan} onChoisir={onBilan} />}
        {onglet === 'documents' && <Documents vue={vue} LienDocument={LienDocument} />}
      </main>

      <nav
        aria-label="Rubriques"
        className="lm-sans-impression fixed inset-x-0 bottom-0 z-20 border-t border-(--lm-bord) bg-(--lm-surface)/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="grid grid-cols-4">
          {ONGLETS.map((o) => (
            <li key={o.cle}>
              <button
                type="button"
                aria-current={o.cle === onglet ? 'page' : undefined}
                onClick={() => onOnglet(o.cle)}
                className={cn(
                  'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset [&_svg]:size-5',
                  o.cle === onglet ? 'text-(--lm-or-texte)' : 'text-(--lm-encre-2)',
                )}
              >
                {o.icone}
                {o.libelle}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
