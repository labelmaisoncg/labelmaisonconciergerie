// =============================================================================
// /api/espace-operations — l'espace en ligne des responsables de pôle et des
// agents de terrain (hors du channel manager).
//
// Gérant (Authorization: Bearer <session Supabase>, membre gérant de l'espace
// nommé par l'en-tête x-erp-espace) :
//   GET  ?action=etat                        espace ouvert ? e-mails envoyés ?
//   POST { action: 'inviter', membreId, email }  lien d'invitation (7 jours)
//   POST { action: 'retirer', membreId }         accès retiré, sessions fermées
//
// Personne de terrain (sans compte) :
//   POST { action: 'lien', email }          lien de connexion par e-mail, dans
//                                           chaque espace où elle a un accès
//                                           (réponse toujours identique)
//   POST { action: 'entrer', jeton, espace } lien à usage unique → cookie de session
//   GET  ?action=vue                        son espace (session)
//   POST { action: 'agir', operation: {…} } signaler, contrôle, confier, absence…
//   POST { action: 'photo', donnees, type } photo déposée → « stockage://… »
//   POST { action: 'sortir' }
//
// Tout se lit et s'écrit dans la base de l'espace qui a invité. Écritures
// limitées aux collections opérations (incidents, contrôles, absences,
// affectations, signalements) ; rien vers les plateformes, jamais de prix,
// calendrier, disponibilité ni annonce. Règles : src/erp/data/espace-operations.ts.
// =============================================================================

import { appliquerAction, avecEcritures, conflitEcritures, fusionnerEcritures, vueOperations, type ActionOperations } from '../src/erp/data/espace-operations.js';
import {
  MESSAGES_REFUS_OPS,
  avecNouveauLien,
  emailValide,
  empreinteJeton,
  inviterMembre,
  normaliserEmail,
  nouveauJeton,
  retirer,
} from '../src/erp/data/operations-acces.js';
import { lirePhoto, photoOperations } from '../src/erp/data/operations-fichiers.js';
import { dateParisISO } from '../src/erp/data/proprietaire.js';
import { estLabelMaison } from '../src/erp/data/espaces.js';
import type { AccesOperations } from '../src/erp/data/types-operations';
import { continuerApresReponse, lireCorps, repondre } from './_erp-repull.js';
import { adresseIp, freinEnvois, provenanceSite } from './_garde-formulaire.js';
import { GENRES, accesParEmail, avecEmailFiche, baseAcces, cookieSessionEfface, entrerAvecLien, ficheEspace, lienDAcces, lireSessionAcces } from './_acces-externe.js';
import {
  deposerPhoto,
  ecrireAccesOps,
  ecrireOps,
  entreesOps,
  envoyerLienOps,
  etatEspaceOps,
  gerantDeLEspace,
  lireAccesOps,
  lireMembre,
  photosFermees,
  prefixePhotos,
  prevenirGerant,
  relireOps,
  signeurPhotos,
} from './_operations.js';

const tropDeDemandes = freinEnvois(5, 60 * 60_000);
const tropPourCetteAdresse = freinEnvois(3, 60 * 60_000);
const tropDEssais = freinEnvois(20, 15 * 60_000);
const tropDePhotos = freinEnvois(60, 15 * 60_000);

const ACCES_RETIRE = 'Votre accès a été retiré. Contactez votre conciergerie.';

const REPONSE_LIEN = 'Si cette adresse a accès à un espace opérations, un lien de connexion vient de lui être envoyé. Pensez à regarder dans les indésirables.';

/** La vue de la personne, photos signées, au nom de la conciergerie de son espace. */
async function vueSignee(espace: string, e: Awaited<ReturnType<typeof entreesOps>>, membreId: string) {
  const aujourdhui = dateParisISO();
  // Le nom de l'espace ; Label Maison seulement s'il l'est vraiment (fiche illisible : « votre conciergerie »).
  const conciergerie = (await ficheEspace(espace).catch(() => undefined))?.nom ?? (estLabelMaison(espace) ? 'Label Maison' : 'votre conciergerie');
  const brute = vueOperations(e, membreId, { aujourdhui, conciergerie });
  if (!brute) return null;
  const urls = [
    ...brute.logements.map((l) => l.photo ?? ''),
    ...brute.incidents.flatMap((i) => i.photos),
    ...[...brute.controles.map((c) => c.controle), ...brute.historiqueControles].flatMap((c) => (c?.points ?? []).map((p) => p.photo ?? '')),
  ].filter(Boolean);
  const photo = await signeurPhotos(espace, urls);
  return vueOperations(e, membreId, { aujourdhui, conciergerie, photo });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  res.setHeader('Referrer-Policy', 'no-referrer');
  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? '');
  const etat = etatEspaceOps();

  try {
    /* ------------------------------------------------------------ gérant */
    if (action === 'etat' || action === 'inviter' || action === 'retirer') {
      const g = await gerantDeLEspace(req);
      if (!g.ok) return repondre(res, g.statut, { ok: false, erreur: g.erreur });
      if (action === 'etat') return repondre(res, 200, { ok: true, actif: etat.actif, email: etat.email, ...(etat.raison ? { raison: etat.raison } : {}) });
      if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: etat.raison });
      const b = baseAcces(g.espace);
      const membreId = String(corps.membreId ?? '');
      const membre = await lireMembre(b, membreId);
      // Fiche tout juste créée dans l'ERP, pas encore arrivée dans la base : l'écran réessaie.
      if (!membre) return repondre(res, 404, { ok: false, code: 'pas_encore', erreur: 'Fiche pas encore enregistrée : réessayez dans un instant.' });
      const precedent = await lireAccesOps(b, membreId);
      const maintenant = Date.now();

      if (action === 'retirer') {
        if (!precedent || precedent.statut === 'retire') return repondre(res, 200, { ok: true });
        await ecrireAccesOps(b, retirer(precedent, maintenant));
        return repondre(res, 200, { ok: true });
      }

      if (!membre.actif) return repondre(res, 400, { ok: false, erreur: 'Cette personne ne fait plus partie de l’équipe.' });
      const email = normaliserEmail(corps.email);
      if (!emailValide(email)) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail invalide.' });
      // Seulement l'adresse de la fiche : réinviter l'ancienne après un changement rouvrirait l'accès à qui est parti.
      const deLaFiche = normaliserEmail(membre.email ?? '');
      if (deLaFiche && deLaFiche !== email) {
        return repondre(res, 409, { ok: false, code: 'fiche', erreur: 'Cette adresse n’est pas celle de la fiche : enregistrez-la dans sa fiche, puis réessayez.' });
      }
      const jeton = await nouveauJeton();
      // L'adresse de la fiche est relevée : si elle change ensuite sans « Retirer », l'accès ne vaut plus.
      const invite = avecEmailFiche('operations', inviterMembre(precedent, { membreId, espace: g.espace, email, par: g.email, maintenantMs: maintenant }), membre);
      const acces = avecNouveauLien(invite, await empreinteJeton(jeton), 'invitation', maintenant);
      await ecrireAccesOps(b, acces);
      const lien = lienDAcces(req, 'operations', g.espace, jeton);
      const envoye = await envoyerLienOps(await ficheEspace(g.espace).catch(() => undefined), { email, nom: membre.nom, lien, motif: 'invitation' });
      return repondre(res, 200, { ok: true, lien, envoye, expireLe: acces.liens[acces.liens.length - 1].expireLe });
    }

    /* ------------------------------------------------ personne de terrain */
    if (!etat.actif) return repondre(res, 503, { ok: false, code: 'inactif', erreur: 'L’espace opérations n’est pas encore ouvert. Contactez votre gérant.' });

    if (action === 'lien' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace opérations.' });
      const email = normaliserEmail(corps.email);
      if (!emailValide(email)) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail invalide.' });
      if (tropDeDemandes(adresseIp(req)) || tropPourCetteAdresse(email)) return repondre(res, 200, { ok: true, message: REPONSE_LIEN });
      // Écriture et envoi après la réponse quand la plateforme le permet : même délai de réponse, que l'adresse ait un accès ou non.
      const envoi = (async () => {
        for (const { fiche, acces, base, version } of await accesParEmail<AccesOperations>('operations', email)) {
          const membre = await lireMembre(base, acces.membreId);
          if (!membre?.actif) continue;
          const maintenant = Date.now();
          const jeton = await nouveauJeton();
          // Conditionnelle : n'écrase pas un lien utilisé au même moment (il redeviendrait valable).
          if (!(await base.remplacerSi(GENRES.operations.collection, avecNouveauLien(acces, await empreinteJeton(jeton), 'connexion', maintenant), version, 'espace-operations'))) continue;
          await envoyerLienOps(fiche, { email, nom: membre.nom, lien: lienDAcces(req, 'operations', fiche.id, jeton), motif: 'connexion' });
        }
      })().catch((e) => console.error('[espace-operations] lien', e instanceof Error ? e.message : e));
      if (!continuerApresReponse(envoi)) await envoi;
      return repondre(res, 200, { ok: true, message: REPONSE_LIEN });
    }

    if (action === 'entrer' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : ouvrez le lien reçu par e-mail.' });
      if (tropDEssais(adresseIp(req))) return repondre(res, 429, { ok: false, erreur: 'Trop d’essais : patientez quelques minutes.' });
      const r = await entrerAvecLien<AccesOperations>('operations', corps.jeton, corps.espace);
      if (!r.ok) return repondre(res, 401, { ok: false, code: r.raison, erreur: MESSAGES_REFUS_OPS[r.raison] });
      res.setHeader('Set-Cookie', r.cookie);
      return repondre(res, 200, { ok: true });
    }

    if (action === 'sortir' && req.method === 'POST') {
      res.setHeader('Set-Cookie', cookieSessionEfface('operations'));
      return repondre(res, 200, { ok: true });
    }

    // Tout le reste : la session, revérifiée dans la base de son espace ; un accès retiré est dit tel quel.
    const s = await lireSessionAcces<AccesOperations>(req, 'operations');
    if (!s.ok) {
      res.setHeader('Set-Cookie', cookieSessionEfface('operations'));
      return repondre(res, 401, s.raison === 'retire' ? { ok: false, code: 'retire', erreur: ACCES_RETIRE } : { ok: false, code: 'session', erreur: 'Connectez-vous pour ouvrir votre espace.' });
    }
    const membreId = s.acces.membreId;

    if (action === 'vue' && req.method === 'GET') {
      const vue = await vueSignee(s.espace, await entreesOps(s.base), membreId);
      // Plus dans l'équipe : même message que pour un accès retiré.
      if (!vue) return repondre(res, 403, { ok: false, code: 'retire', erreur: ACCES_RETIRE });
      return repondre(res, 200, { ok: true, vue, espace: s.espace });
    }

    if (action === 'agir' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace opérations.' });
      const entrees = await entreesOps(s.base);
      const prefixe = prefixePhotos(s.espace);
      const r = appliquerAction(entrees, membreId, (corps.operation ?? {}) as ActionOperations, {
        aujourdhui: dateParisISO(),
        maintenant: new Date().toISOString(),
        nouvelId: (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        photoAcceptee: (u) => photoOperations(u, prefixe, membreId),
      });
      if (!r.ok) return repondre(res, r.statut, { ok: false, erreur: r.erreur });
      // Relu juste avant d'écrire : seuls les champs changés par l'action sont repris (rien d'écrasé de ce qui a changé entre-temps).
      const relus = await relireOps(s.base, r.ecritures);
      const conflit = conflitEcritures(entrees, r.ecritures, relus);
      if (conflit) return repondre(res, 409, { ok: false, erreur: conflit, vue: await vueSignee(s.espace, await entreesOps(s.base), membreId) });
      const ecritures = fusionnerEcritures(entrees, r.ecritures, relus);
      await ecrireOps(s.base, ecritures);
      const apres = avecEcritures(entrees, ecritures);
      const notifier = prevenirGerant(s.base, apres, r.aNotifier);
      if (!continuerApresReponse(notifier)) await notifier;
      return repondre(res, 200, { ok: true, message: r.message, ...(r.id ? { id: r.id } : {}), vue: await vueSignee(s.espace, apres, membreId) });
    }

    if (action === 'photo' && req.method === 'POST') {
      if (!provenanceSite(req)) return repondre(res, 403, { ok: false, erreur: 'Demande refusée : utilisez la page de l’espace opérations.' });
      if (tropDePhotos(adresseIp(req))) return repondre(res, 429, { ok: false, erreur: 'Trop de photos d’un coup : patientez quelques minutes.' });
      // Stockage impossible pour cet espace (compte serveur pas prêt) : le dire, plutôt qu'un « réessayez » sans issue.
      if (await photosFermees(s.espace)) return repondre(res, 409, { ok: false, erreur: 'L’envoi de photos n’est pas encore ouvert pour cet espace.' });
      const photo = lirePhoto(corps.donnees, corps.type);
      if (!photo) return repondre(res, 400, { ok: false, erreur: 'Photo illisible : choisissez une image JPEG, PNG ou WebP de moins de 3 Mo.' });
      const url = await deposerPhoto(s.espace, membreId, photo.octets, photo.type, photo.extension);
      if (!url) return repondre(res, 502, { ok: false, erreur: 'La photo n’a pas pu être enregistrée. Réessayez dans un instant.' });
      const signer = await signeurPhotos(s.espace, [url]);
      return repondre(res, 200, { ok: true, url, apercu: signer(url) ?? null });
    }

    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    console.error('[espace-operations] échec', action, e instanceof Error ? e.message : e);
    return repondre(res, 500, { ok: false, erreur: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
