import { LIBELLES } from '../data/libelles';
import { Badge } from './Badge';
import type { Ton } from './tons';

/**
 * Ton de chaque valeur de statut. Les libellés viennent de data/libelles.ts :
 * la couleur n'est jamais seule, le texte l'accompagne toujours.
 */
const TONS = {
  statutMandat: { brouillon: 'neutre', envoye: 'info', signe: 'succes', resilie: 'danger' },
  statutLogement: { lancement: 'or', actif: 'succes', pause: 'alerte', sorti: 'neutre' },
  statutReservation: { confirmee: 'info', annulee: 'danger', en_cours: 'or', terminee: 'neutre' },
  statutFil: { ouvert: 'info', escalade: 'danger', clos: 'neutre' },
  traitePar: { agent: 'or', humain: 'info', en_attente: 'alerte' },
  statutMission: {
    a_attribuer: 'alerte', attribuee: 'info', en_cours: 'or', a_valider: 'alerte',
    validee: 'succes', refusee: 'danger', annulee: 'neutre',
  },
  statutPrestataire: { actif: 'succes', suspendu: 'danger', sorti: 'neutre' },
  statutDocument: { valide: 'succes', expire: 'danger', manquant: 'alerte' },
  statutIncident: { ouvert: 'danger', en_cours: 'alerte', resolu: 'succes' },
  gravite: { faible: 'neutre', moyenne: 'alerte', haute: 'danger' },
  statutFacture: { brouillon: 'neutre', emise: 'info', payee: 'succes', en_retard: 'danger', annulee: 'neutre' },
  statutPaiement: { a_payer: 'alerte', paye: 'succes', bloque: 'danger' },
  etapeProspect: {
    nouveau: 'neutre', contact: 'info', visite: 'info', proposition: 'or',
    negociation: 'alerte', signe: 'succes', perdu: 'danger',
  },
} as const satisfies { [K in keyof typeof LIBELLES]?: { [V in keyof (typeof LIBELLES)[K]]: Ton } };

export type TypeStatut = keyof typeof TONS;
export type ValeurStatut<T extends TypeStatut> = keyof (typeof TONS)[T] & string;

export interface StatusBadgeProps<T extends TypeStatut> {
  type: T;
  valeur: ValeurStatut<T>;
  className?: string;
}

/** Badge coloré et libellé en français pour toute valeur de statut du modèle. */
export function StatusBadge<T extends TypeStatut>({ type, valeur, className }: StatusBadgeProps<T>) {
  return (
    <Badge tone={tonStatut(type, valeur)} point className={className}>
      {libelleStatut(type, valeur)}
    </Badge>
  );
}

export function tonStatut<T extends TypeStatut>(type: T, valeur: ValeurStatut<T>): Ton {
  return ((TONS[type] as Record<string, Ton>)[valeur] ?? 'neutre') as Ton;
}

export function libelleStatut<T extends TypeStatut>(type: T, valeur: ValeurStatut<T>): string {
  return (LIBELLES[type] as Record<string, string>)[valeur] ?? valeur;
}
