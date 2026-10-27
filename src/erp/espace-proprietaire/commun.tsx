/**
 * Briques de l'espace propriétaire, partagées par la page du propriétaire
 * (/espace-proprietaire), l'aperçu du gérant et la démo.
 */
import type { ComponentType, ReactNode } from 'react';
import { Home } from 'lucide-react';
import { dateCourte, moisAnnee } from '../data/format';
import { estLabelMaison } from '../data/espaces';
import type { CanalReservation } from '../data/types';
import type { VueProprietaire } from '../data/types-proprietaire';
import { ENTREPRISE_LIGNE } from '../modules/finance/_composants/entreprise';
import { cn, useLienFichier } from '../ui';

/**
 * Ligne imprimée en tête d'un bilan ou d'une facture : l'identité légale de
 * Label Maison pour l'espace de Label Maison seulement (décidé par son
 * identifiant, jamais par le nom affiché) ; sinon le nom de la conciergerie.
 */
export const enteteImprime = (c: VueProprietaire['conciergerie']): string => (c.espace && estLabelMaison(c.espace) ? ENTREPRISE_LIGNE : c.nom);

export type OngletEspace = 'accueil' | 'logements' | 'calendrier' | 'bilans' | 'factures' | 'documents';
export const ONGLETS_ESPACE: OngletEspace[] = ['accueil', 'logements', 'calendrier', 'bilans', 'factures', 'documents'];

/** Lien d'ouverture d'un document (API signée pour le propriétaire, fichier de l'ERP pour le gérant). */
export type LienDocumentProps = { id: string; className?: string; children: ReactNode };
export type LienDocument = ComponentType<LienDocumentProps>;

export const CANAL: Record<CanalReservation, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  direct: 'Réservation directe',
  autre: 'Autre plateforme',
};

/** « Septembre 2026 ». */
/** Plus aucun logement : cédés à un autre propriétaire (depuis quand), ou pas encore. */
export function sansLogement(vue: Pick<VueProprietaire, 'logementsCedes'>): string {
  const dernier = vue.logementsCedes[0];
  return dernier ? `Plus de logement en gestion depuis le ${dateCourte(dernier.jusquAu)}. Vos chiffres et vos bilans de cette période restent ici.` : 'Aucun logement en gestion pour l’instant.';
}

export const titreMois = (mois: string) => {
  const t = moisAnnee(mois);
  return t.charAt(0).toLocaleUpperCase('fr') + t.slice(1);
};

/** « de Label Maison », « d’Essonne Conciergerie » (élision devant une voyelle). */
export const deNom = (nom: string) => (/^[aàâeéèêiîoôuûAÀÂEÉÈÊIÎOÔUÛ]/.test(nom) ? `d’${nom}` : `de ${nom}`);

/** « Bilan de septembre 2026 », « Bilan d’août 2026 » (élision devant une voyelle). */
export const bilanDuMois = (mois: string) => {
  const t = moisAnnee(mois).toLocaleLowerCase('fr');
  return `Bilan ${/^[aàâeéèêiîoôuû]/.test(t) ? 'd’' : 'de '}${t}`;
};

/** Photo de couverture d'un logement (lien signé résolu au besoin), sinon une vignette neutre. */
export function PhotoLogement({ url, nom, className }: { url?: string; nom: string; className?: string }) {
  const lien = useLienFichier(url);
  if (!lien) {
    return (
      <div className={cn('grid place-items-center bg-(--lm-surface-2) text-(--lm-encre-3)', className)} aria-hidden>
        <Home className="size-7" />
      </div>
    );
  }
  return <img src={lien} alt={`Photo de ${nom}`} loading="lazy" decoding="async" className={cn('object-cover', className)} />;
}

/** Titre de page de l'espace, en serif comme sur le site. */
export function TitreEspace({ titre, description }: { titre: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="lm-serif text-[26px] leading-tight text-(--lm-brun) sm:text-[30px]">{titre}</h1>
      {description && <p className="mt-1 max-w-2xl text-[14px] text-(--lm-encre-2)">{description}</p>}
    </div>
  );
}

/** Titre de rubrique. */
export function Rubrique({ titre, action, children, className }: { titre: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-8 min-w-0', className)}>
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
