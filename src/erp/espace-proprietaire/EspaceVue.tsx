import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Building2, CalendarDays, FolderOpen, Home, LogOut } from 'lucide-react';
import type { VueProprietaire } from '../data/types-proprietaire';
import { Tabs, cn } from '../ui';
import { Accueil } from './Accueil';
import { Bilans } from './Bilans';
import { Calendrier, type CalendrierEspace } from './Calendrier';
import { AssistantDemande, MesDemandes, type DemandesEspace } from './Demandes';
import { Documents } from './Documents';
import { Factures } from './Factures';
import { Logements } from './Logements';
import { TitreEspace, type LienDocument, type OngletEspace } from './commun';

const ONGLETS: { cle: OngletEspace; libelle: string; icone: ReactNode }[] = [
  { cle: 'accueil', libelle: 'Accueil', icone: <Home /> },
  { cle: 'logements', libelle: 'Logements', icone: <Building2 /> },
  { cle: 'calendrier', libelle: 'Calendrier', icone: <CalendarDays /> },
  // Bilans et factures sous un même onglet : cinq onglets au plus dans la barre du bas.
  { cle: 'bilans', libelle: 'Finances', icone: <BarChart3 /> },
  { cle: 'documents', libelle: 'Documents', icone: <FolderOpen /> },
];

export interface EspaceVueProps {
  vue: VueProprietaire;
  onglet: OngletEspace;
  onOnglet: (o: OngletEspace) => void;
  /** Bilan ouvert (mois « AAAA-MM »). */
  bilan?: string;
  onBilan: (mois?: string) => void;
  /** Fiche ouverte dans « Mes logements » ; sans `onLogement`, retenue ici. */
  logement?: string;
  /** Ouvre l'onglet « Mes logements » sur cette fiche (sans id : sur la liste). */
  onLogement?: (id?: string) => void;
  /** Facture ouverte ; sans `onFacture`, retenue ici. */
  facture?: string;
  /** Ouvre l'onglet des factures sur celle-ci (sans id : sur la liste). */
  onFacture?: (id?: string) => void;
  /** Mois du calendrier connus et chargeur d'une plage (serveur, démo ou calcul en mémoire). */
  calendrier: CalendrierEspace;
  LienDocument: LienDocument;
  onSortir?: () => void;
  /** Bandeau au-dessus de l'en-tête (aperçu du gérant, démo). */
  bandeau?: ReactNode;
  /** Ses demandes et leur envoi ; absent : ni « Faire une demande » ni « Mes demandes ». */
  demandes?: DemandesEspace;
  /** Demande ouverte dans « Mes demandes » ; sans `onDemande`, retenue ici. */
  demande?: string;
  /** Ouvre « Mes demandes » sur celle-ci (sans id : sur la liste). */
  onDemande?: (id?: string) => void;
}

/**
 * L'espace du propriétaire : quatre onglets, barre du bas sur téléphone
 * (comme une app), onglets dans l'en-tête sur ordinateur.
 */
export function EspaceVue({
  vue,
  onglet,
  onOnglet,
  bilan,
  onBilan,
  logement: logementProp,
  onLogement,
  facture: factureProp,
  onFacture,
  calendrier,
  LienDocument,
  onSortir,
  bandeau,
  demandes,
  demande: demandeProp,
  onDemande,
}: EspaceVueProps) {
  const [demandeLocale, setDemandeLocale] = useState<string>();
  const demande = onDemande ? demandeProp : demandeLocale;
  /** « Mes demandes », sur une demande ou sur la liste. */
  const choisirDemande = (id?: string) => {
    if (onDemande) return onDemande(id);
    setDemandeLocale(id);
    onOnglet('demandes');
  };
  const [assistant, setAssistant] = useState(false);
  const [factureLocale, setFactureLocale] = useState<string>();
  const facture = onFacture ? factureProp : factureLocale;
  const choisirFacture = (id?: string) => {
    if (onFacture) return onFacture(id);
    setFactureLocale(id);
    onOnglet('factures');
  };
  const [logementLocal, setLogementLocal] = useState<string>();
  const logement = onLogement ? logementProp : logementLocal;
  /** « Mes logements », sur une fiche ou sur la liste. */
  const choisirLogement = (id?: string) => {
    if (onLogement) return onLogement(id);
    setLogementLocal(id);
    onOnglet('logements');
  };
  // Toucher « Logements » revient à la liste (de même pour les factures et les demandes).
  const allerA = (o: OngletEspace) =>
    o === 'logements' ? choisirLogement(undefined) : o === 'factures' ? choisirFacture(undefined) : o === 'demandes' ? choisirDemande(undefined) : onOnglet(o);
  const finances = onglet === 'bilans' || onglet === 'factures';
  /** Onglet allumé dans la barre : « Mes demandes » se range sous l'Accueil, les factures sous Finances. */
  const actif = (cle: OngletEspace) => cle === onglet || (cle === 'bilans' && finances) || (cle === 'accueil' && onglet === 'demandes');
  const aRegler = vue.factures.filter((f) => f.statut !== 'payee').length;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [onglet, bilan, logement, facture, demande]);

  return (
    <div className="min-h-screen bg-(--lm-fond)">
      {bandeau}
      <header className="lm-sans-impression sticky top-0 z-20 border-b border-(--lm-bord) bg-(--lm-surface)">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="lm-titre truncate text-[18px] leading-tight text-(--lm-brun)">{vue.conciergerie.nom}</p>
            <p className="truncate text-[11.5px] text-(--lm-encre-2)">Espace propriétaire</p>
          </div>
          <nav aria-label="Rubriques" className="hidden items-stretch gap-1 self-stretch sm:flex">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                type="button"
                aria-current={actif(o.cle) ? 'page' : undefined}
                onClick={() => allerA(o.cle)}
                className={cn(
                  'relative inline-flex h-full items-center gap-1.5 px-3 text-[14px] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 focus-visible:-outline-offset-2 [&_svg]:size-4',
                  actif(o.cle) ? 'font-semibold text-(--lm-encre) after:bg-(--lm-encre)' : 'font-medium text-(--lm-encre-2) hover:text-(--lm-encre) hover:after:bg-(--lm-bord-fort)',
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
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)"
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
        {onglet === 'accueil' && (
          <Accueil
            vue={vue}
            onOnglet={allerA}
            onBilan={onBilan}
            onLogement={choisirLogement}
            LienDocument={LienDocument}
            demandes={demandes}
            onNouvelleDemande={demandes ? () => setAssistant(true) : undefined}
          />
        )}
        {onglet === 'demandes' &&
          (demandes ? (
            <MesDemandes vue={vue} demandes={demandes} choisie={demande} onChoisir={choisirDemande} onNouvelle={() => setAssistant(true)} onRetour={() => onOnglet('accueil')} />
          ) : (
            <Accueil vue={vue} onOnglet={allerA} onBilan={onBilan} onLogement={choisirLogement} LienDocument={LienDocument} />
          ))}
        {onglet === 'logements' && <Logements vue={vue} choisi={logement} onChoisir={choisirLogement} />}
        {onglet === 'calendrier' && <Calendrier vue={vue} calendrier={calendrier} />}
        {finances && !(onglet === 'bilans' && bilan) && !(onglet === 'factures' && facture) && <TitreEspace titre="Finances" />}
        {finances && !(onglet === 'bilans' && bilan) && !(onglet === 'factures' && facture) && (
          <Tabs
            className="lm-sans-impression"
            label="Finances"
            actif={onglet}
            onChange={(c) => allerA(c as OngletEspace)}
            onglets={[
              { cle: 'bilans', libelle: 'Bilans mensuels' },
              { cle: 'factures', libelle: 'Factures', ...(aRegler ? { compteur: aRegler } : {}) },
            ]}
          />
        )}
        {onglet === 'bilans' && <Bilans vue={vue} choisi={bilan} onChoisir={onBilan} />}
        {onglet === 'factures' && <Factures vue={vue} choisie={facture} onChoisir={choisirFacture} LienDocument={LienDocument} />}
        {onglet === 'documents' && <Documents vue={vue} LienDocument={LienDocument} />}
      </main>

      {assistant && demandes && (
        <AssistantDemande
          vue={vue}
          envoyer={demandes.envoyer}
          onFermer={() => setAssistant(false)}
          onVoir={(d) => {
            setAssistant(false);
            choisirDemande(d.id);
          }}
        />
      )}

      <nav
        aria-label="Rubriques"
        className="lm-sans-impression fixed inset-x-0 bottom-0 z-20 border-t border-(--lm-bord) bg-(--lm-surface) pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="grid grid-cols-5">
          {ONGLETS.map((o) => (
            <li key={o.cle}>
              <button
                type="button"
                aria-current={actif(o.cle) ? 'page' : undefined}
                onClick={() => allerA(o.cle)}
                className={cn(
                  'flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] leading-none focus-visible:-outline-offset-2 [&_svg]:size-6 [&_svg]:stroke-2',
                  actif(o.cle) ? 'font-semibold text-(--lm-or-texte) [&_svg]:fill-(--lm-or-lavis)' : 'font-medium text-(--lm-encre-2)',
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
