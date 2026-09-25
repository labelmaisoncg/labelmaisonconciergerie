/**
 * Recherche globale : une palette ouverte par la barre de l'en-tête,
 * Ctrl/Cmd + K ou « / ». Cherche dans toutes les données (logements,
 * propriétaires, réservations, conversations, ménages, prestataires,
 * incidents, factures, contrats, prospects, historique), propose des
 * actions rapides et l'accès direct à chaque page. Plein écran sur mobile.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  CornerDownLeft,
  FileSignature,
  History,
  Home,
  Link2,
  MessagesSquare,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Target,
  User,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useErp } from '../data/store';
import { cn, useFenetre } from '../ui';
import { MODULES, rubriqueDe } from '../modules/registry';
import {
  construireIndex,
  correspondSouple,
  decouper,
  motsRequete,
  rechercher,
  type ElementIndex,
  type GroupeResultats,
  type TypeResultat,
} from './recherche/moteur';

const ICONES: Record<TypeResultat, LucideIcon> = {
  logement: Home,
  proprietaire: User,
  reservation: CalendarDays,
  conversation: MessagesSquare,
  mission: Sparkles,
  prestataire: Wrench,
  incident: AlertTriangle,
  facture: Receipt,
  mandat: FileSignature,
  prospect: Target,
  journal: History,
};

interface Raccourci {
  id: string;
  libelle: string;
  detail?: string;
  to: string;
  icone: LucideIcon;
  motsCles?: string;
}

const ACTIONS: Raccourci[] = [
  { id: 'a-resa', libelle: 'Nouvelle réservation', detail: 'Réservation directe, hors plateformes', to: '/erp/reservations?nouveau=1', icone: CalendarPlus, motsCles: 'ajouter créer séjour' },
  { id: 'a-proprio', libelle: 'Nouveau propriétaire', to: '/erp/proprietaires?nouveau=1', icone: UserPlus, motsCles: 'ajouter créer client' },
  { id: 'a-logement', libelle: 'Nouveau logement', to: '/erp/logements?nouveau=1', icone: Plus, motsCles: 'ajouter créer bien' },
  { id: 'a-incident', libelle: 'Signaler un incident', to: '/erp/incidents?nouveau=1', icone: AlertTriangle, motsCles: 'déclarer casse panne problème' },
  {
    id: 'a-connexion',
    libelle: 'Connecter Airbnb, Booking…',
    detail: 'Importer vos annonces et réservations',
    to: '/erp/logements/connexions',
    icone: Link2,
    motsCles: 'repull plateformes synchroniser importer',
  },
  { id: 'a-agent', libelle: 'Configurer mon agent', detail: 'Ton, horaires, ce qu’il vous transmet', to: '/erp/messagerie/agent', icone: Bot, motsCles: 'ia messagerie réglages' },
];

const PAGES: Raccourci[] = MODULES.map((m) => {
  const r = rubriqueDe(m);
  return {
    id: `p-${m.key}`,
    libelle: `Aller à ${m.label}`,
    detail: r && r.libelle !== m.label ? r.libelle : undefined,
    to: m.path,
    icone: r?.icon ?? ArrowRight,
    motsCles: `${m.label} ${r?.libelle ?? ''} ${m.motsCles ?? ''}`,
  };
});

const CLE_RECENTES = 'lm-erp-recherches-recentes';

function lireRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_RECENTES) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

function memoriser(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    const liste = [t, ...lireRecentes().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    localStorage.setItem(CLE_RECENTES, JSON.stringify(liste));
  } catch {
    /* stockage indisponible (navigation privée) : sans conséquence */
  }
}

/** Ligne navigable de la palette (résultat, action, page, recherche récente). */
type Ligne =
  | { genre: 'resultat'; e: ElementIndex }
  | { genre: 'raccourci'; r: Raccourci }
  | { genre: 'recente'; q: string }
  | { genre: 'tout'; g: GroupeResultats };

function Surligne({ texte, mots }: { texte: string; mots: string[] }) {
  return (
    <>
      {decouper(texte, mots).map((m, i) =>
        m.fort ? (
          <mark key={i} className="rounded-sm bg-(--lm-or-lavis) px-px text-inherit">
            {m.t}
          </mark>
        ) : (
          <span key={i}>{m.t}</span>
        ),
      )}
    </>
  );
}

function estSaisie(el: EventTarget | null) {
  const h = el as HTMLElement | null;
  return !!h && (h.tagName === 'INPUT' || h.tagName === 'TEXTAREA' || h.tagName === 'SELECT' || h.isContentEditable);
}

/** Barre de recherche de l'en-tête (ouvre la palette). */
export function GlobalSearch({ className }: { className?: string }) {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const touche = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOuvert((o) => !o);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !estSaisie(e.target)) {
        e.preventDefault();
        setOuvert(true);
      }
    };
    document.addEventListener('keydown', touche);
    return () => document.removeEventListener('keydown', touche);
  }, []);

  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-label="Rechercher partout (raccourci Ctrl + K)"
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) px-2.5 text-left text-[13.5px] text-(--lm-encre-3) transition-colors hover:border-(--lm-bord-fort) hover:bg-(--lm-surface)"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <span className="sm:hidden">Rechercher</span>
          <span className="hidden sm:inline">Rechercher un voyageur, un logement, une facture…</span>
        </span>
        <kbd className="hidden shrink-0 rounded border border-(--lm-bord-fort) bg-(--lm-surface) px-1.5 font-sans text-[11px] text-(--lm-encre-3) md:inline">
          {mac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>
      {/* Hors de l'en-tête (backdrop-blur) : sinon « fixed » serait relatif à l'en-tête. */}
      {ouvert && createPortal(<Palette onFermer={() => setOuvert(false)} />, document.querySelector('.erp-root') ?? document.body)}
    </div>
  );
}

function Palette({ onFermer }: { onFermer: () => void }) {
  const d = useErp();
  const naviguer = useNavigate();
  const ref = useFenetre<HTMLDivElement>(true, onFermer);
  const champ = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const listeId = useId();
  const [q, setQ] = useState('');
  const [actif, setActif] = useState(0);
  const [deplie, setDeplie] = useState<TypeResultat | null>(null);
  const [recentes, setRecentes] = useState<string[]>(() => lireRecentes());

  // Index recalculé seulement quand les données changent.
  const index = useMemo(() => construireIndex(d.donnees), [d.donnees]);
  const mots = useMemo(() => motsRequete(q), [q]);
  const groupes = useMemo(() => rechercher(index, q, Infinity), [index, q]);

  const raccourcis = useMemo(() => {
    if (!q.trim()) return { actions: ACTIONS.slice(0, 5), pages: [] as Raccourci[] };
    const filtrer = (liste: Raccourci[], n: number) =>
      liste
        .map((r) => ({ r, s: correspondSouple(`${r.libelle} ${r.motsCles ?? ''}`, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, n)
        .map((x) => x.r);
    return { actions: filtrer(ACTIONS, 3), pages: filtrer(PAGES, 4) };
  }, [q]);

  useEffect(() => {
    setActif(0);
    setDeplie(null);
  }, [q]);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  // Sections affichées et lignes navigables au clavier, dans l'ordre.
  const sections = useMemo(() => {
    const s: { titre: string; compte?: number; lignes: Ligne[] }[] = [];
    if (!q.trim()) {
      if (recentes.length) s.push({ titre: 'Recherches récentes', lignes: recentes.map((x) => ({ genre: 'recente', q: x })) });
      s.push({ titre: 'Actions rapides', lignes: raccourcis.actions.map((r) => ({ genre: 'raccourci', r })) });
      return s;
    }
    for (const g of groupes) {
      const tout = deplie === g.groupe.type;
      const lignes: Ligne[] = g.elements.slice(0, tout ? 50 : 5).map((e) => ({ genre: 'resultat', e }));
      if (g.total > 5 && !tout) lignes.push({ genre: 'tout', g });
      s.push({ titre: g.groupe.libelle, compte: g.total, lignes });
    }
    if (raccourcis.actions.length) s.push({ titre: 'Actions', lignes: raccourcis.actions.map((r) => ({ genre: 'raccourci', r })) });
    if (raccourcis.pages.length) s.push({ titre: 'Pages', lignes: raccourcis.pages.map((r) => ({ genre: 'raccourci', r })) });
    return s;
  }, [q, groupes, raccourcis, recentes, deplie]);

  const lignes = useMemo(() => sections.flatMap((s) => s.lignes), [sections]);

  useEffect(() => {
    listeRef.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  const aller = useCallback(
    (to: string) => {
      memoriser(q);
      onFermer();
      naviguer(to);
    },
    [q, onFermer, naviguer],
  );

  const choisir = (l: Ligne | undefined) => {
    if (!l) return;
    if (l.genre === 'resultat') aller(l.e.to);
    else if (l.genre === 'raccourci') aller(l.r.to);
    else if (l.genre === 'recente') setQ(l.q);
    else if (l.g.groupe.liste) aller(l.g.groupe.liste(q.trim()));
    else setDeplie(l.g.groupe.type);
  };

  const clavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, lignes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choisir(lignes[actif]);
    }
  };

  const oublier = () => {
    try {
      localStorage.removeItem(CLE_RECENTES);
    } catch {
      /* rien */
    }
    setRecentes([]);
  };

  let n = -1;
  const rendu = (l: Ligne): ReactNode => {
    n += 1;
    const i = n;
    const sel = i === actif;
    const commun = {
      id: `${listeId}-${i}`,
      role: 'option' as const,
      'aria-selected': sel,
      'data-index': i,
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
      onMouseMove: () => actif !== i && setActif(i),
      onClick: () => choisir(l),
      className: cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2', sel && 'bg-(--lm-or-lavis)'),
    };
    if (l.genre === 'resultat') {
      const Icone = ICONES[l.e.type];
      return (
        <div key={`${l.e.type}-${l.e.id}`} {...commun}>
          <Icone className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">
              <Surligne texte={l.e.titre} mots={mots} />
            </span>
            <span className="block truncate text-[12px] text-(--lm-encre-3)">
              <Surligne texte={l.e.detail} mots={mots} />
            </span>
          </span>
          {sel && <CornerDownLeft className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-hidden />}
        </div>
      );
    }
    if (l.genre === 'raccourci') {
      const Icone = l.r.icone;
      return (
        <div key={l.r.id} {...commun}>
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md bg-(--lm-surface-2) text-(--lm-or) [&_svg]:size-4">
            <Icone />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">{l.r.libelle}</span>
            {l.r.detail && <span className="block truncate text-[12px] text-(--lm-encre-3)">{l.r.detail}</span>}
          </span>
          {sel && <CornerDownLeft className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-hidden />}
        </div>
      );
    }
    if (l.genre === 'recente') {
      return (
        <div key={`r-${l.q}`} {...commun}>
          <Clock className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-(--lm-encre-2)">{l.q}</span>
        </div>
      );
    }
    return (
      <div key={`tout-${l.g.groupe.type}`} {...commun} className={cn(commun.className, 'py-1.5')}>
        <ClipboardList className="size-4 shrink-0 text-(--lm-or)" aria-hidden />
        <span className="text-[13px] font-medium text-(--lm-or)">
          Voir tout ({l.g.total}){l.g.groupe.liste ? '' : ' ici'}
        </span>
      </div>
    );
  };

  const total = groupes.reduce((s, g) => s + g.total, 0);
  const cherche = q.trim().length > 0;
  const rien = cherche && mots.join('').length >= 2 && !groupes.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center sm:items-start sm:p-4 sm:pt-[10vh]">
      <div aria-hidden className="lm-apparition absolute inset-0 bg-[rgba(20,17,14,0.4)]" onClick={onFermer} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche dans l’ERP"
        tabIndex={-1}
        className="lm-apparition relative flex h-full w-full flex-col bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:h-auto sm:max-h-[75vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-(--lm-bord) px-3 py-2.5 sm:px-4">
          <Search className="size-5 shrink-0 text-(--lm-encre-3)" aria-hidden />
          <input
            ref={champ}
            type="text"
            role="combobox"
            aria-label="Que cherchez-vous ?"
            aria-expanded
            aria-controls={listeId}
            aria-autocomplete="list"
            aria-activedescendant={lignes[actif] ? `${listeId}-${actif}` : undefined}
            placeholder="Un nom, une ville, un numéro de réservation, un montant…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={clavier}
            className="h-10 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-(--lm-encre) placeholder:text-(--lm-encre-3)"
            style={{ outline: 'none' }}
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="rounded-md px-2 py-1 text-[12.5px] text-(--lm-encre-3) hover:text-(--lm-encre)">
              Effacer
            </button>
          )}
          <button type="button" onClick={onFermer} aria-label="Fermer la recherche" className="grid size-8 place-items-center rounded-md text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis)">
            <X className="size-4" />
          </button>
        </div>

        <div ref={listeRef} id={listeId} role="listbox" aria-label="Résultats" className="lm-defilement min-h-0 flex-1 overflow-y-auto p-2">
          {rien && (
            <div className="px-3 py-8 text-center">
              <p className="text-[14px] font-medium text-(--lm-encre)">Rien trouvé pour « {q.trim()} ».</p>
              <p className="mt-1 text-[13px] text-(--lm-encre-3)">Essayez un nom, une ville ou un numéro de réservation.</p>
            </div>
          )}
          {sections.map((s) => (
            <div key={s.titre} role="group" aria-label={s.titre} className="mb-1.5">
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <p className="text-[11px] font-semibold tracking-[0.06em] text-(--lm-encre-3) uppercase">
                  {s.titre}
                  {s.compte !== undefined && <span className="lm-chiffres ml-1.5 font-medium normal-case">{s.compte}</span>}
                </p>
                {s.titre === 'Recherches récentes' && (
                  <button type="button" onClick={oublier} className="text-[11.5px] text-(--lm-encre-3) hover:text-(--lm-or)">
                    Effacer l’historique
                  </button>
                )}
              </div>
              {s.lignes.map(rendu)}
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-4 border-t border-(--lm-bord) px-4 py-2 text-[11.5px] text-(--lm-encre-3) sm:flex">
          <span>↑ ↓ pour choisir</span>
          <span>Entrée pour ouvrir</span>
          <span>Échap pour fermer</span>
          {cherche && total > 0 && <span className="ml-auto lm-chiffres">{total} résultat{total > 1 ? 's' : ''}</span>}
        </div>
      </div>
    </div>
  );
}
