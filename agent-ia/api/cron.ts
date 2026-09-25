/**
 * Tâches planifiées.
 *
 *   /api/cron?tache=reservations  rattrapage des réservations Repull — toutes les 15 min
 *   /api/cron?tache=messages   rattrapage des messages voyageurs — toutes les 10 min
 *   /api/cron?tache=matin      résumé du jour — n'agit qu'à 8 h heure de Paris
 *   /api/cron?tache=sante      santé des connexions OTA — à 5 h heure de Paris
 *
 * Les crons tournent en UTC, pas en heure de Paris : un « 8 h » figé en UTC
 * devient 10 h l'été et 9 h l'hiver. On déclenche donc TOUTES LES HEURES et on
 * ne fait le travail qu'à la bonne heure locale. C'est la seule façon d'avoir
 * une heure vraiment fixe des deux côtés du changement d'heure.
 *
 * Le temps réel passe par le webhook Repull ; ces tâches sont des filets.
 * Vercel Hobby ne permet qu'un déclenchement par jour : leur cadence vient de
 * `pg_cron` côté Supabase (cf. sql/cron.sql).
 */

import { traiterMessagesVoyageurs } from '../src/messagerie.js';
import { veiller } from '../src/veille.js';
import { releverReservations } from '../src/reservations.js';
import { synchroniserAnnonces } from '../src/comptes.js';
import * as repull from '../src/repull.js';
import * as store from '../src/store.js';
import { envoyerMessage } from '../src/telegram.js';
import { aujourdhui, enFrancais, heureParis } from '../src/dates.js';
import { egalTempsConstant } from '../src/config.js';

const HEURE_RESUME = 8;
const HEURE_SANTE = 5;

export default async function handler(req: any, res: any) {
  const attendu = process.env.CRON_SECRET;
  const fourni =
    String(req.headers.authorization ?? '').replace(/^Bearer /, '') || String(req.query?.cle ?? '');
  if (!egalTempsConstant(attendu, fourni)) {
    console.warn('[cron] appel non autorisé.');
    return res.status(401).json({ ok: false });
  }

  const tache = String(req.query?.tache ?? 'messages');
  const forcer = req.query?.forcer === '1';

  try {
    const conciergeries = await store.toutesConciergeries();

    if (tache === 'messages') {
      let repondus = 0;
      let escalades = 0;
      // Les fils couvrent tout l'espace Repull : UNE lecture par passage,
      // partagée entre toutes les conciergeries — et non une par conciergerie.
      let fils: repull.FilMessages[];
      try {
        fils = await repull.filsDeMessages();
      } catch (err) {
        console.error('[cron] fils de messages illisibles :', err);
        return res.status(502).json({ ok: false, tache, error: 'fils de messages illisibles' });
      }
      for (const c of conciergeries) {
        const r = await traiterMessagesVoyageurs(c, fils);
        repondus += r.repondus;
        escalades += r.escalades;
      }
      return res.status(200).json({ ok: true, tache, conciergeries: conciergeries.length, repondus, escalades });
    }

    if (tache === 'matin') {
      if (!forcer && heureParis() !== HEURE_RESUME) {
        return res.status(200).json({ ok: true, tache, ignore: `pas ${HEURE_RESUME} h à Paris` });
      }
      let envoyes = 0;
      for (const c of conciergeries) envoyes += await resumeDuMatin(c);
      return res.status(200).json({ ok: true, tache, envoyes });
    }

    if (tache === 'sante') {
      if (!forcer && heureParis() !== HEURE_SANTE) {
        return res.status(200).json({ ok: true, tache, ignore: `pas ${HEURE_SANTE} h à Paris` });
      }
      let alertes = 0;
      for (const c of conciergeries) alertes += await verifierSante(c);
      return res.status(200).json({ ok: true, tache, alertes });
    }

    if (tache === 'reservations') {
      // Rattrapage : une seule lecture pour tous les logements, toutes
      // conciergeries confondues.
      const r = await releverReservations();
      return res.status(200).json({ ok: true, tache, ...r });
    }

    if (tache === 'veille') {
      let parle = 0;
      for (const c of conciergeries) if (await veiller(c)) parle++;
      return res.status(200).json({
        ok: true,
        tache,
        examinees: conciergeries.length,
        messages_envoyes: parle,
      });
    }

    return res.status(400).json({ ok: false, error: `Tâche inconnue : ${tache}` });
  } catch (err) {
    console.error('[cron] échec :', err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'inconnu' });
  }
}

/**
 * Résumé du matin. Composé sans appeler le modèle : c'est une liste de faits,
 * un gabarit la produit mieux, pour zéro centime et sans risque d'invention.
 */
async function resumeDuMatin(c: store.Conciergerie & { chatIds: string[] }): Promise<number> {
  const proprietaire = c.chatIds[0];
  if (!proprietaire) return 0;

  const date = aujourdhui();
  const logements = await store.logements(c.id);
  const lignesMenages: string[] = [];
  const lignesArrivees: string[] = [];

  for (const l of logements) {
    if (!l.repullListingId) continue;
    try {
      const [departs, arrivees] = await Promise.all([
        repull.departsDu(l.repullListingId, date),
        repull.reservations(l.repullListingId, date, date),
      ]);
      for (const d of departs) {
        lignesMenages.push(`- ${l.nom}${d.voyageur ? ` (départ ${d.voyageur})` : ''}`);
      }
      for (const a of arrivees.filter((x) => !repull.estAnnulee(x))) {
        lignesArrivees.push(
          `- ${l.nom}${a.voyageur ? ` : ${a.voyageur}` : ''}${a.personnes ? `, ${a.personnes} pers.` : ''}`,
        );
      }
    } catch (err) {
      console.error(`[cron] lecture impossible pour ${l.nom} :`, err);
    }
  }

  const texte = [
    `Bonjour. ${enFrancais(date)}.`,
    '',
    lignesMenages.length ? `Ménages (${lignesMenages.length}) :` : 'Aucun ménage aujourd’hui.',
    ...lignesMenages,
    '',
    lignesArrivees.length ? `Arrivées (${lignesArrivees.length}) :` : 'Aucune arrivée.',
    ...lignesArrivees,
  ]
    .filter((l, i, t) => !(l === '' && t[i - 1] === ''))
    .join('\n');

  await envoyerMessage(proprietaire, texte).catch(() => undefined);
  return 1;
}

/**
 * Santé des connexions.
 *
 * L'intérêt principal n'est pas de rafraîchir des données — les réservations
 * arrivent par webhook. C'est de détecter qu'une connexion est MORTE. Un jeton
 * Airbnb révoqué, une cliente qui déconnecte son compte par erreur : sans cette
 * vérification, l'agent continue de répondre avec des données figées et
 * personne ne s'en aperçoit pendant des semaines.
 */
async function verifierSante(c: store.Conciergerie & { chatIds: string[] }): Promise<number> {
  const proprietaire = c.chatIds[0];
  const avant = await store.logements(c.id);

  // Relit l'état des canaux de chaque annonce, et importe au passage les
  // annonces arrivées depuis sur les comptes déjà rattachés.
  try {
    await synchroniserAnnonces(c.id);
  } catch (err) {
    console.error(`[cron] santé illisible pour ${c.nom} :`, err);
    return 0;
  }
  const apres = new Map((await store.logements(c.id)).map((l) => [l.id, l]));

  // On n'alerte que sur une RÉGRESSION : ce qui était connecté ne l'est plus.
  const casses: string[] = [];
  for (const l of avant) {
    const maintenant = apres.get(l.id);
    if (!maintenant) continue;
    if (l.airbnbConnecte && !maintenant.airbnbConnecte) casses.push(`${l.nom} — Airbnb déconnecté`);
    if (l.bookingConnecte && !maintenant.bookingConnecte) casses.push(`${l.nom} — Booking déconnecté`);
  }

  if (casses.length === 0 || !proprietaire) return 0;

  await envoyerMessage(
    proprietaire,
    'Connexion perdue, à reconnecter :\n' +
      casses.map((x) => `- ${x}`).join('\n') +
      "\n\nTant que c'est coupé, je ne vois plus ni les réservations ni les messages de ces logements. Dis-moi et je regénère un lien.",
  ).catch(() => undefined);

  return casses.length;
}
