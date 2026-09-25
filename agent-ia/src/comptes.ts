/**
 * Comptes Airbnb et Booking des conciergeries, et import de leurs annonces.
 *
 * Repull ne connaît qu'un seul espace — le nôtre. Quand une conciergerie
 * autorise son compte Airbnb via Repull Connect, ses annonces arrivent dans
 * cet espace à côté de celles des autres conciergeries. C'est donc NOTRE base
 * qui dit quel compte appartient à qui (`comptes_plateformes`), et quelle
 * annonce correspond à quel logement (`logements.repull_listing_id`).
 *
 * Reconnaître le compte qu'une conciergerie vient de connecter : on photographie
 * les comptes connus au moment où elle part vers Repull, et on compare au
 * retour. Un seul compte nouveau, et personne d'autre en train de connecter le
 * même canal → il est à elle. Sinon on n'attribue rien : un compte donné à la
 * mauvaise conciergerie lui ouvrirait les réservations et les voyageurs d'une
 * autre. Mieux vaut un « en cours » de plus qu'une fuite.
 */

import * as repull from './repull.js';
import * as store from './store.js';

export const urlPublique = (): string =>
  (process.env.APP_URL || 'https://agent-ia-ochre.vercel.app').replace(/\/$/, '');

/** Départ vers Repull : photographie des comptes, puis session de connexion. */
export async function demarrerConnexion(lien: store.LienConnexion): Promise<string> {
  const avant = await repull.comptesConnectes(lien.canal);
  await store.noterComptesAvant(
    lien.id,
    avant.map((c) => c.compteId),
  );
  return repull.lienConnexion(lien.canal, `${urlPublique()}/connexion/${lien.id}/retour`);
}

export type IssueConnexion =
  | { statut: 'connecte'; annoncesImportees: number }
  | { statut: 'en_attente' }
  | { statut: 'ambigu' }
  | { statut: 'deja_pris' };

/**
 * Retour de Repull (ou relance depuis l'outil `comptes_connectes`) : quel
 * compte est apparu depuis le départ, et est-il bien à cette conciergerie ?
 */
export async function finaliserConnexion(lien: store.LienConnexion): Promise<IssueConnexion> {
  if (lien.comptesAvant == null) return { statut: 'en_attente' };

  const [maintenant, attribues, concurrents] = await Promise.all([
    repull.comptesConnectes(lien.canal),
    store.comptesAttribues(lien.canal),
    store.autresLiensEnCours(lien.id, lien.canal),
  ]);
  const avant = new Set(lien.comptesAvant);
  const nouveaux = maintenant.filter((c) => c.actif && !avant.has(c.compteId) && !attribues.has(c.compteId));

  if (nouveaux.length === 0) {
    // Reconnexion d'un compte déjà à elle (jeton expiré, accès révoqué puis
    // rendu) : rien à attribuer, la connexion est bien là.
    const siens = maintenant.filter((c) => c.actif && attribues.get(c.compteId) === lien.conciergerieId);
    if (siens.length > 0) {
      await store.finaliserLien(lien.id);
      return { statut: 'connecte', annoncesImportees: await synchroniserAnnonces(lien.conciergerieId) };
    }
    // Parcours abandonné, ou Booking.com qui n'a pas encore validé.
    return { statut: 'en_attente' };
  }

  if (nouveaux.length > 1 || concurrents > 0) {
    console.warn(
      `[comptes] lien ${lien.id} : ${nouveaux.length} compte(s) ${lien.canal} nouveau(x), ` +
        `${concurrents} autre(s) lien(s) en cours — attribution suspendue.`,
    );
    return { statut: 'ambigu' };
  }

  const proprietaire = await store.attribuerCompte(lien.canal, nouveaux[0]!.compteId, lien.conciergerieId);
  if (proprietaire !== lien.conciergerieId) return { statut: 'deja_pris' };

  await store.finaliserLien(lien.id);
  return { statut: 'connecte', annoncesImportees: await synchroniserAnnonces(lien.conciergerieId) };
}

/**
 * Rattache une annonce Repull à un logement de la conciergerie : au logement
 * du même nom s'il existe et n'a pas encore d'annonce (sa fiche — codes, wifi,
 * consignes — est ainsi conservée), à un nouveau logement sinon. Idempotent.
 * Rend true si un rattachement a eu lieu.
 */
export async function importerAnnonce(conciergerieId: string, annonce: repull.AnnonceResumee): Promise<boolean> {
  const existant = await store.logementParRepullId(annonce.id);
  if (existant) return false;

  const tous = await store.logements(conciergerieId);
  const homonyme = tous.find((l) => !l.repullListingId && l.nom.trim().toLowerCase() === annonce.nom.trim().toLowerCase());
  if (homonyme) {
    await store.majLogement(homonyme.id, { repullListingId: annonce.id });
    return true;
  }
  await store.creerLogement(conciergerieId, annonce.nom, annonce.ville, annonce.id);
  return true;
}

/**
 * Importe les annonces de tous les comptes de la conciergerie et met à jour
 * l'état des connexions de chaque logement. Rend le nombre d'annonces
 * nouvellement rattachées.
 */
export async function synchroniserAnnonces(conciergerieId: string): Promise<number> {
  let importees = 0;
  for (const compte of await store.comptesDe(conciergerieId)) {
    try {
      for (const a of await repull.annoncesDuCompte(compte.canal, compte.compteId)) {
        if (await importerAnnonce(conciergerieId, a)) importees++;
      }
    } catch (err) {
      console.error(`[comptes] annonces du compte ${compte.canal} ${compte.compteId} illisibles :`, err);
    }
  }

  for (const l of await store.logements(conciergerieId)) {
    if (!l.repullListingId) continue;
    try {
      const canaux = await repull.canauxDe(l.repullListingId);
      await store.majLogement(l.id, { airbnbConnecte: canaux.airbnb, bookingConnecte: canaux.booking });
    } catch (err) {
      console.error(`[comptes] canaux de ${l.nom} illisibles :`, err);
    }
  }
  return importees;
}
