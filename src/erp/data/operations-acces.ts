/**
 * Accès des responsables de pôle et agents de terrain à l'espace opérations,
 * sans compte ni SQL, exactement comme l'espace propriétaire : lien à usage
 * unique (empreinte SHA-256 seulement en base), session signée de 30 jours,
 * revérifiée dans la base de l'espace qui a invité à chaque appel.
 *
 * Liens, sessions et cookies : communs aux deux espaces (acces-externe.ts,
 * proprietaire-acces.ts, api/_acces-externe.ts). Ici, seulement ce qui est
 * propre aux opérations : l'invitation d'un membre de l'équipe et les messages.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import { espaceDe } from './acces-externe.js';
import type { RefusLien } from './proprietaire-acces.js';
import type { Id } from './types';
import type { AccesOperations } from './types-operations';

export { avecNouveauLien, emailValide, empreinteJeton, normaliserEmail, nouveauJeton, retirer, utiliserLien } from './proprietaire-acces.js';

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Invitation (ou nouvelle invitation) du gérant, dans son espace. Une autre
 * adresse ferme les sessions ouvertes et oublie les liens envoyés à l'ancienne.
 */
export function inviterMembre(
  precedent: AccesOperations | undefined,
  o: { membreId: Id; espace?: string; email: string; par: string; maintenantMs: number },
): AccesOperations {
  const email = String(o.email ?? '').trim().toLowerCase();
  const espace = espaceDe(o.espace ?? precedent?.espace);
  if (!precedent) {
    return { id: o.membreId, membreId: o.membreId, espace, email, statut: 'invite', inviteLe: iso(o.maintenantMs), invitePar: o.par, version: 1, liens: [] };
  }
  const autreAdresse = precedent.email !== email;
  const { retireLe: _retire, ...reste } = precedent;
  return {
    ...reste,
    id: o.membreId,
    membreId: o.membreId,
    espace,
    email,
    statut: precedent.statut === 'actif' && !autreAdresse ? 'actif' : 'invite',
    inviteLe: iso(o.maintenantMs),
    invitePar: o.par,
    version: autreAdresse && precedent.statut === 'actif' ? precedent.version + 1 : precedent.version,
    liens: autreAdresse ? [] : (precedent.liens ?? []),
  };
}

export const MESSAGES_REFUS_OPS: Record<RefusLien, string> = {
  inconnu: 'Ce lien n’est pas valable. Demandez un nouveau lien avec votre adresse e-mail.',
  expire: 'Ce lien a expiré. Demandez un nouveau lien avec votre adresse e-mail.',
  utilise: 'Ce lien a déjà servi. Demandez un nouveau lien avec votre adresse e-mail.',
  retire: 'Votre accès à l’espace opérations a été retiré. Contactez votre gérant.',
};
