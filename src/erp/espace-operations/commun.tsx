/**
 * Briques de l'espace opérations (/espace-operations), partagées par la page
 * de la personne connectée, l'aperçu du gérant et la démo.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ActionOperations } from '../data/espace-operations';
import type { Prevenus } from '../data/notifications-operations';
import type { Id } from '../data/types';
import type { VueOperations } from '../data/types-operations';
import { Badge, cn } from '../ui';

export type OngletOps = 'aujourdhui' | 'logements' | 'incidents' | 'controles' | 'equipe';
export const ONGLETS_OPS: OngletOps[] = ['aujourdhui', 'logements', 'incidents', 'controles', 'equipe'];

/** Ce qui est ouvert à l'écran (gardé dans l'adresse : retour arrière du téléphone). */
export interface Ecran {
  onglet: OngletOps;
  incident?: string;
  logement?: string;
  controle?: string;
  /** Logement de l'incident à signaler ('' : à choisir). */
  signaler?: string;
  absence?: string;
}

export type ResultatOps = { ok: true; message: string; id?: string } | { ok: false; erreur: string };

/** Ce que l'espace sait faire : le serveur en vrai, le jeu de démonstration sinon. */
export interface ActionsOps {
  agir: (operation: ActionOperations) => Promise<ResultatOps>;
  /** Dépose une photo (réduite dans le navigateur) ; rend l'adresse à joindre et un aperçu. */
  photo: (fichier: File) => Promise<{ url: string; apercu?: string } | { erreur: string }>;
  /** Qui serait vraiment prévenu d'une urgence sur ce logement : téléphones (« Clara D. ») et gérant ; absent : le gérant seul. */
  prevenus?: (logementId: string) => Promise<Prevenus>;
}

export interface ContexteOps {
  vue: VueOperations;
  actions: ActionsOps;
  naviguer: (e: Partial<Ecran>) => void;
  /** Message de retour d'une action, en haut de l'écran. */
  annoncer: (message: string, ton?: 'succes' | 'danger') => void;
  /** Aperçu du gérant : tout se voit, rien ne s'envoie. */
  apercu?: boolean;
}

export const Ops = createContext<ContexteOps | null>(null);
export function useOps(): ContexteOps & {
  pole: boolean;
  nomLogement: (id?: Id) => string;
  nomMembre: (id?: Id) => string;
  agir: (operation: ActionOperations) => Promise<boolean>;
} {
  const c = useContext(Ops);
  if (!c) throw new Error('useOps hors de l’espace opérations');
  return {
    ...c,
    pole: c.vue.moi.role === 'pole',
    nomLogement: (id) => c.vue.logements.find((l) => l.id === id)?.nom ?? 'Logement',
    nomMembre: (id) => court(c.vue.equipe.find((m) => m.id === id)?.nom),
    agir: async (operation) => {
      const r = await c.actions.agir(operation);
      c.annoncer(r.ok ? r.message : r.erreur, r.ok ? 'succes' : 'danger');
      return r.ok;
    },
  };
}

/** « Clara Dumas » → « Clara D. ». */
export function court(nom?: string): string {
  const [p, n] = String(nom ?? '').trim().split(/\s+/);
  return p ? `${p}${n ? ` ${n[0]}.` : ''}` : '';
}

/** Titre de page, en serif comme sur le site. */
export function TitreEspace({ titre, description, action }: { titre: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="lm-serif text-[26px] leading-tight text-(--lm-brun) sm:text-[30px]">{titre}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-(--lm-encre-2)">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Rubrique titrée d'une page. */
export function Rubrique({ titre, action, children, className }: { titre: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mb-7 min-w-0', className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-(--lm-encre)">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Lien d'action discret (« Tout voir »). */
export function LienAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-8 items-center rounded-md px-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
    >
      {children}
    </button>
  );
}

export type TonLigne = 'neutre' | 'danger' | 'alerte' | 'succes';

/** Liste de lignes dans une carte (séparateurs fins). */
export function Liste({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre)">
      {children}
    </ul>
  );
}

/** Ligne de liste cliquable : une ligne principale (deux au plus), une secondaire, une fin à droite. */
export function Ligne({
  icone,
  titre,
  deuxLignes,
  sousTitre,
  fin,
  onClick,
  ton = 'neutre',
}: {
  icone: ReactNode;
  titre: ReactNode;
  deuxLignes?: boolean;
  sousTitre?: ReactNode;
  fin?: ReactNode;
  onClick?: () => void;
  ton?: TonLigne;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--lm-surface-2) focus-visible:bg-(--lm-surface-2) focus:outline-none"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4',
            ton === 'danger' && 'bg-(--lm-danger-lavis) text-(--lm-danger)',
            ton === 'alerte' && 'bg-(--lm-alerte-lavis) text-(--lm-alerte)',
            ton === 'succes' && 'bg-(--lm-succes-lavis) text-(--lm-succes)',
            ton === 'neutre' && 'bg-(--lm-neutre-lavis) text-(--lm-encre-2)',
          )}
        >
          {icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[14px] font-medium text-(--lm-encre)', deuxLignes ? 'line-clamp-2' : 'truncate')}>{titre}</span>
          {sousTitre && <span className="mt-0.5 block truncate text-[12.5px] text-(--lm-encre-2)">{sousTitre}</span>}
        </span>
        {fin && <span className="flex shrink-0 items-center gap-1.5">{fin}</span>}
        <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
      </button>
    </li>
  );
}

/** « Urgent » : le seul niveau qui change une décision (le reste est normal, sans badge). */
export const PastilleUrgent = ({ urgent }: { urgent: boolean }) => (urgent ? <Badge tone="danger">Urgent</Badge> : null);

/**
 * Photo réduite dans le navigateur avant l'envoi (1 600 px au plus, JPEG) :
 * une photo de téléphone passe de 4 à 8 Mo à 300 à 600 Ko.
 */
export async function reduirePhoto(fichier: File, cote = 1600): Promise<{ donnees: string; type: string }> {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob>((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Photo illisible.'))), 'image/jpeg', 0.82));
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return { donnees: btoa(binaire), type: 'image/jpeg' };
}
