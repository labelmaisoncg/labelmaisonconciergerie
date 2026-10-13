import type { ReactNode } from 'react';

// =============================================================================
// Faits légaux communs aux pages « Mentions légales », « Politique de
// confidentialité » et « Conditions du Studio » : une seule source, pour que
// les trois pages disent toujours la même chose.
//
// ⚠ On n'invente rien : seul le SIRET reste à renseigner (constante SIRET
// ci-dessous). C'est une donnée officielle ; tant qu'elle est vide, les pages
// affichent « à compléter ». Dès qu'elle est saisie, la mention disparaît
// partout.
// =============================================================================

// Renseigner le numéro SIRET ici : il s'affichera automatiquement dans les
// mentions légales (obligatoire pour une vente en ligne à des particuliers).
export const SIRET = '';

export const EDITEUR = 'Label Maison Conciergerie';
export const ACTIVITE = 'conciergerie et gestion locative courte durée — Paris, France';
export const EMAIL = 'labelmaisonconciergerie@gmail.com';
export const TEL = '+33 7 49 54 83 55';
export const SITE_URL = 'https://labelmaisoncg.fr';
export const SITE_LIBELLE = 'labelmaisoncg.fr';
export const HEBERGEUR = {
  nom: 'Vercel Inc.',
  adresse: '340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis',
  site: 'vercel.com',
};

// Palette des pages « document » (sobres, lisibles, sans fioriture).
export const GOLD = '#A97C30';
export const GOLD_DARK = '#7C561D';
export const INK = '#2C2418';
export const INK_2 = '#6B6252';
export const IVORY = '#FBF9F4';
export const LINE = '#E6DDC9';

/** Section titrée d'une page « document ». */
export function Bloc({ titre, id, children }: { titre: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-[110px]">
      <h2 className="font-serif-title text-[24px] md:text-[30px] leading-tight" style={{ color: INK }}>
        {titre}
      </h2>
      <div className="mt-3 grid gap-3 text-[15px] leading-relaxed" style={{ color: INK_2 }}>
        {children}
      </div>
    </section>
  );
}

/** Information officielle pas encore fournie : on l'affiche comme telle, jamais inventée. */
export function ACompleter() {
  return (
    <span className="px-2 py-0.5 rounded" style={{ background: '#F6EAD6', color: GOLD_DARK, fontSize: '13px' }}>
      à compléter
    </span>
  );
}

/** Le SIRET s'il est renseigné, sinon « à compléter ». */
export function Siret() {
  return <>{SIRET || <ACompleter />}</>;
}

/** Lien e-mail de contact, à la couleur des pages « document ». */
export function LienEmail() {
  return (
    <a href={`mailto:${EMAIL}`} style={{ color: GOLD_DARK }}>
      {EMAIL}
    </a>
  );
}
