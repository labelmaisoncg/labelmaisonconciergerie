import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { AUJOURDHUI, ecartJours } from '../../../data/format';
import { prestataireConforme, statutDocument } from '../../../data/selectors';
import type { DocumentPrestataire, Prestataire, TypeDocument } from '../../../data/types';
import { Alert, Badge, type Ton } from '../../../ui';

export type EtatDocument = 'valide' | 'expire' | 'manquant' | 'expire_bientot';

/** Documents exigés, dans l'ordre d'affichage. */
export const DOCUMENTS_REQUIS: { type: TypeDocument; libelle: string; bloquant: boolean; aide: string }[] = [
  { type: 'contrat', libelle: 'Contrat de prestation signé', bloquant: true, aide: 'Interdit la sous-traitance en cascade.' },
  { type: 'rc_pro', libelle: 'Attestation RC Pro', bloquant: true, aide: 'Responsabilité civile professionnelle en cours.' },
  { type: 'urssaf', libelle: 'Attestation de vigilance URSSAF', bloquant: true, aide: 'Valable 6 mois à compter de sa délivrance.' },
  { type: 'kbis', libelle: 'Extrait Kbis ou avis Sirene', bloquant: false, aide: 'Justifie l’immatriculation.' },
];

export function etatDocument(doc: DocumentPrestataire | undefined, jours = 30): EtatDocument {
  if (!doc) return 'manquant';
  const s = statutDocument(doc);
  if (s !== 'valide') return s;
  if (doc.valideJusquau && ecartJours(AUJOURDHUI, doc.valideJusquau) <= jours) return 'expire_bientot';
  return 'valide';
}

export const ETAT_DOC: Record<EtatDocument, { libelle: string; ton: Ton }> = {
  valide: { libelle: 'Valide', ton: 'succes' },
  expire_bientot: { libelle: 'Expire bientôt', ton: 'alerte' },
  expire: { libelle: 'Expiré', ton: 'danger' },
  manquant: { libelle: 'Manquant', ton: 'danger' },
};

export function BadgeDocument({ etat }: { etat: EtatDocument }) {
  return (
    <Badge tone={ETAT_DOC[etat].ton} point>
      {ETAT_DOC[etat].libelle}
    </Badge>
  );
}

export function BadgeConformite({ prestataire }: { prestataire: Prestataire }) {
  const v = prestataireConforme(prestataire);
  return v.ok ? (
    <Badge tone="succes" icone={<ShieldCheck />}>Conforme</Badge>
  ) : (
    <Badge tone="danger" icone={<ShieldAlert />} title={v.raisons.join(' ')}>Non conforme</Badge>
  );
}

/** Rappel de la règle SPEC §2.3, affiché en tête des écrans prestataires. */
export function RegleConformite({ className }: { className?: string }) {
  return (
    <Alert tone="or" titre="Règle 2.3 : prestataires" className={className}>
      Aucune mission ne peut être attribuée sans contrat signé, RC Pro et attestation URSSAF valides. Sous-traitance en cascade interdite.
    </Alert>
  );
}
