import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, ClipboardCheck, House, LogOut, Users, X } from 'lucide-react';
import type { VueOperations } from '../data/types-operations';
import { Alert, IconButton, cn } from '../ui';
import { Aujourdhui } from './Aujourdhui';
import { Controles, FormulaireControle } from './Controles';
import { Equipe, PanneauAbsence } from './Equipe';
import { Incidents, PanneauIncident } from './Incidents';
import { Logements, PanneauLogement } from './Logements';
import { Signaler } from './Signaler';
import { Ops, type ActionsOps, type ContexteOps, type Ecran, type OngletOps } from './commun';

const ONGLETS: { cle: OngletOps; libelle: string; icone: ReactNode; pole?: boolean }[] = [
  { cle: 'aujourdhui', libelle: 'Aujourd’hui', icone: <House /> },
  { cle: 'logements', libelle: 'Logements', icone: <Building2 /> },
  { cle: 'incidents', libelle: 'Incidents', icone: <AlertTriangle /> },
  { cle: 'controles', libelle: 'Contrôles', icone: <ClipboardCheck /> },
  { cle: 'equipe', libelle: 'Équipe', icone: <Users />, pole: true },
];

export interface EspaceOpsProps {
  vue: VueOperations;
  ecran: Ecran;
  naviguer: (e: Partial<Ecran>) => void;
  actions: ActionsOps;
  onSortir?: () => void;
  /** Bandeau au-dessus de l'en-tête (aperçu du gérant, démo). */
  bandeau?: ReactNode;
  /** Aperçu du gérant : tout se voit, rien ne s'envoie. */
  apercu?: boolean;
  /** Nom de la conciergerie (en-tête). */
  conciergerie?: string;
}

/**
 * L'espace d'une personne de terrain : cinq onglets pour le responsable de
 * pôle (quatre pour l'agent), barre du bas sur téléphone comme une app,
 * onglets dans l'en-tête sur ordinateur.
 */
export function EspaceOps({ vue, ecran, naviguer, actions, onSortir, bandeau, apercu, conciergerie = vue.conciergerie?.nom ?? 'Label Maison' }: EspaceOpsProps) {
  const [retour, setRetour] = useState<{ texte: string; ton: 'succes' | 'danger' } | null>(null);
  const pole = vue.moi.role === 'pole';
  const onglets = ONGLETS.filter((o) => !o.pole || pole);
  const onglet = onglets.some((o) => o.cle === ecran.onglet) ? ecran.onglet : 'aujourdhui';

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [onglet, ecran.controle]);
  useEffect(() => {
    if (!retour || retour.ton === 'danger') return;
    const t = window.setTimeout(() => setRetour(null), 5000);
    return () => window.clearTimeout(t);
  }, [retour]);

  const contexte = useMemo<ContexteOps>(
    () => ({ vue, actions, naviguer, apercu, annoncer: (texte, ton = 'succes') => setRetour({ texte, ton }) }),
    [vue, actions, naviguer, apercu],
  );

  return (
    <Ops.Provider value={contexte}>
      <div className="min-h-screen bg-(--lm-fond)">
        {bandeau}
        <header className="sticky top-0 z-20 border-b border-(--lm-bord) bg-(--lm-surface)/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
            <div className="min-w-0">
              <p className="lm-serif truncate text-[18px] leading-tight text-(--lm-brun)">{conciergerie}</p>
              <p className="truncate text-[11.5px] text-(--lm-encre-2)">Espace opérations</p>
            </div>
            <nav aria-label="Rubriques" className="hidden items-center gap-1 sm:flex">
              {onglets.map((o) => (
                <button
                  key={o.cle}
                  type="button"
                  aria-current={o.cle === onglet ? 'page' : undefined}
                  onClick={() => naviguer({ onglet: o.cle, controle: undefined })}
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
          {retour && (
            <Alert
              tone={retour.ton}
              className="mb-5"
              actions={
                <IconButton label="Fermer le message" size="sm" onClick={() => setRetour(null)}>
                  <X />
                </IconButton>
              }
            >
              {retour.texte}
            </Alert>
          )}
          {ecran.controle ? (
            <FormulaireControle key={ecran.controle} cle={ecran.controle} onFermer={() => naviguer({ controle: undefined })} />
          ) : (
            <>
              {onglet === 'aujourdhui' && <Aujourdhui />}
              {onglet === 'logements' && <Logements />}
              {onglet === 'incidents' && <Incidents />}
              {onglet === 'controles' && <Controles />}
              {onglet === 'equipe' && <Equipe />}
            </>
          )}
        </main>

        {!ecran.controle && (
          <nav aria-label="Rubriques" className="fixed inset-x-0 bottom-0 z-20 border-t border-(--lm-bord) bg-(--lm-surface)/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
            <ul className={cn('grid', onglets.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
              {onglets.map((o) => (
                <li key={o.cle}>
                  <button
                    type="button"
                    aria-current={o.cle === onglet ? 'page' : undefined}
                    onClick={() => naviguer({ onglet: o.cle })}
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
        )}

        {ecran.incident && <PanneauIncident key={ecran.incident} id={ecran.incident} onFermer={() => naviguer({ incident: undefined })} />}
        {ecran.logement && !ecran.incident && <PanneauLogement key={ecran.logement} id={ecran.logement} onFermer={() => naviguer({ logement: undefined })} />}
        {ecran.absence && <PanneauAbsence key={ecran.absence} id={ecran.absence} onFermer={() => naviguer({ absence: undefined })} />}
        {ecran.signaler !== undefined && <Signaler logementId={ecran.signaler || undefined} onFermer={() => naviguer({ signaler: undefined })} />}
      </div>
    </Ops.Provider>
  );
}
