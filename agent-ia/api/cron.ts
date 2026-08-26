/**
 * Tâches planifiées.
 *
 *   /api/cron?tache=messages   messages voyageurs — toutes les 1 à 2 minutes
 *   /api/cron?tache=matin      résumé du jour — n'agit qu'à 8 h heure de Paris
 *   /api/cron?tache=sante      santé des connexions OTA — à 5 h heure de Paris
 *
 * Les crons tournent en UTC, pas en heure de Paris : un « 8 h » figé en UTC
 * devient 10 h l'été et 9 h l'hiver. On déclenche donc TOUTES LES HEURES et on
 * ne fait le travail qu'à la bonne heure locale. C'est la seule façon d'avoir
 * une heure vraiment fixe des deux côtés du changement d'heure.
 *
 * Vercel Hobby ne permet qu'un déclenchement par jour : la cadence des messages
 * voyageurs vient de `pg_cron` côté Supabase (cf. sql/cron.sql).
 */

import { traiterMessagesVoyageurs } from '../src/messagerie.js';
import { veiller } from '../src/veille.js';
import * as channex from '../src/channex.js';
import * as store from '../src/store.js';
import { envoyerMessage } from '../src/telegram.js';
import { aujourdhui, enFrancais, heureParis } from '../src/dates.js';

const HEURE_RESUME = 8;
const HEURE_SANTE = 5;

export default async function handler(req: any, res: any) {
  const attendu = process.env.CRON_SECRET;
  const fourni =
    String(req.headers.authorization ?? '').replace(/^Bearer /, '') || String(req.query?.cle ?? '');
  if (!attendu || fourni !== attendu) {
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
      for (const c of conciergeries) {
        const r = await traiterMessagesVoyageurs(c);
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
    if (!l.channexPropertyId) continue;
    try {
      const [departs, arrivees] = await Promise.all([
        channex.departsDu(l.channexPropertyId, date),
        channex.reservations(l.channexPropertyId, date, date),
      ]);
      for (const d of departs) {
        lignesMenages.push(`- ${l.nom}${d.voyageur ? ` (départ ${d.voyageur})` : ''}`);
      }
      for (const a of arrivees) {
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
  const logements = await store.logements(c.id);
  const casses: string[] = [];

  for (const l of logements) {
    if (!l.channexPropertyId) continue;
    try {
      const canaux = await channex.canauxDe(l.channexPropertyId);
      const airbnb = canaux.some((x) => x.code === 'AirBNB' && x.actif);
      const booking = canaux.some((x) => x.code === 'BookingCom' && x.actif);

      // On n'alerte que sur une RÉGRESSION : ce qui était connecté ne l'est plus.
      if (l.airbnbConnecte && !airbnb) casses.push(`${l.nom} — Airbnb déconnecté`);
      if (l.bookingConnecte && !booking) casses.push(`${l.nom} — Booking déconnecté`);

      await store.majLogement(l.id, { airbnbConnecte: airbnb, bookingConnecte: booking });
    } catch (err) {
      console.error(`[cron] santé illisible pour ${l.nom} :`, err);
    }
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
