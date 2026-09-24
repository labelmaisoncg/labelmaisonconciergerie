/**
 * Règles prestataires et linge (SPEC §2.3, §2.6).
 */
import { ajouterJours, ecartJours, jourMois } from '../data/format';
import { ecartsLinge, libelleDocument, logementById, prestataireConforme, statutDocument } from '../data/selectors';
import type { DocumentPrestataire, Mission } from '../data/types';
import { collecteur } from './outils';
import type { Regle } from './types';

const OBLIGATOIRES: DocumentPrestataire['type'][] = ['contrat', 'rc_pro', 'urssaf'];

export const documentsPrestataires: Regle = {
  cle: 'documents-prestataires',
  nom: 'Documents et suspension',
  description:
    'Quand un document de prestataire expire, alors il passe « expiré » ; si c’est le contrat, la RC Pro ou l’URSSAF, le prestataire est suspendu et ses missions à venir repartent en attribution. Trente jours avant l’échéance, une relance lui est envoyée.',
  spec: '§2.3',
  domaine: 'prestataires',
  declencheur: 'document',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    for (const p of d.prestataires) {
      if (p.statut === 'sorti') continue;
      let modifie = false;
      const documents = p.documents.map((doc) => {
        if (doc.statut === 'valide' && statutDocument(doc, ctx.date) === 'expire') {
          modifie = true;
          return { ...doc, statut: 'expire' as const };
        }
        return doc;
      });
      const expires = documents.filter((doc) => OBLIGATOIRES.includes(doc.type) && doc.statut === 'expire');
      const suspendre = p.statut === 'actif' && expires.length > 0;
      if (modifie || suspendre) {
        c.modifier('prestataires', { ...p, documents, statut: suspendre ? 'suspendu' : p.statut }, suspendre ? 'Prestataire suspendu.' : 'Documents expirés.');
      }
      if (suspendre) {
        const liste = expires.map((doc) => libelleDocument(doc.type)).join(', ');
        c.evenement('alerte', `suspendu:${p.id}`, `${p.nom} suspendu automatiquement : ${liste} expiré(e).`, 'prestataire', p.id);
      }
      for (const doc of documents) {
        if (doc.statut !== 'valide' || !doc.valideJusquau) continue;
        const jours = ecartJours(ctx.date, doc.valideJusquau);
        if (jours < 0 || jours > 30) continue;
        c.evenement('info', `relance:${p.id}:${doc.type}:${doc.valideJusquau}`,
          `Relance envoyée à ${p.nom} : ${libelleDocument(doc.type)} expire le ${jourMois(doc.valideJusquau)} (dans ${jours} j).`, 'prestataire', p.id);
      }
    }
    // Missions à venir d'un prestataire qui ne peut plus en recevoir : retour en attribution.
    const bloques = new Set(
      d.prestataires
        .filter((p) => p.statut !== 'actif' || !prestataireConforme(p, ctx.date).ok ||
          p.documents.some((doc) => OBLIGATOIRES.includes(doc.type) && doc.statut === 'valide' && statutDocument(doc, ctx.date) === 'expire'))
        .map((p) => p.id),
    );
    for (const m of d.missions) {
      if (!m.prestataireId || !bloques.has(m.prestataireId) || m.statut !== 'attribuee' || m.date < ctx.date) continue;
      const p = d.prestataires.find((x) => x.id === m.prestataireId);
      const libre: Mission = { ...m, prestataireId: undefined, statut: 'a_attribuer' };
      c.modifier('missions', libre, `Retirée à ${p?.nom ?? 'un prestataire'} (non conforme).`);
      c.evenement('action', `retrait:${m.id}:${m.prestataireId}`,
        `Mission du ${jourMois(m.date)} retirée à ${p?.nom ?? 'un prestataire'} (non conforme) et remise en attribution.`, 'mission', m.id);
    }
    return c.res;
  },
};

export const suiviLinge: Regle = {
  cle: 'suivi-linge',
  nom: 'Traçabilité du linge',
  description:
    'Quand un ménage de départ est passé sans mouvement de linge enregistré, alors une alerte est levée ; quand du linge envoyé en blanchisserie n’est pas revenu dans les 5 jours, alors un incident linge est ouvert.',
  spec: '§2.6',
  domaine: 'operations',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const debut = ajouterJours(ctx.date, -14);
    for (const m of d.missions) {
      if (m.type !== 'menage' || m.date >= ctx.date || m.date < debut) continue;
      if (m.statut === 'annulee' || m.statut === 'refusee' || m.statut === 'a_attribuer') continue;
      const trace = d.mouvementsLinge.some(
        (x) => x.missionId === m.id ||
          (x.logementId === m.logementId && x.date === m.date && (x.type === 'sortie_sale' || x.type === 'mise_en_place')),
      );
      if (trace) continue;
      const l = logementById(d, m.logementId);
      c.evenement('alerte', `sans-mouvement:${m.id}`, `Aucun mouvement de linge enregistré pour le ménage de ${l?.nom ?? 'un logement'} du ${jourMois(m.date)}.`, 'mission', m.id);
    }
    const parEnvoi = new Map<string, ReturnType<typeof ecartsLinge>>();
    for (const e of ecartsLinge(d.mouvementsLinge, 5, ctx.date)) parEnvoi.set(e.envoiId, [...(parEnvoi.get(e.envoiId) ?? []), e]);
    for (const [envoiId, ecarts] of parEnvoi) {
      const { logementId, date } = ecarts[0];
      const id = `auto-inc-linge-${envoiId}`;
      const existe = d.incidents.some((i) => i.id === id || (i.categorie === 'linge' && i.logementId === logementId && i.date === date));
      if (existe) continue;
      const l = logementById(d, logementId);
      const detail = ecarts.map((e) => `${e.manquant} ${e.article.toLowerCase()}`).join(', ');
      c.creer('incidents', {
        id, logementId, date: ctx.date, categorie: 'linge', gravite: 'faible',
        description: `Écart d’inventaire : ${detail} non revenu(s) de blanchisserie (envoi du ${jourMois(date)}).`,
        statut: 'ouvert', responsable: 'Kamel', refacturable: 'prestataire', preuves: [],
      }, 'Incident linge ouvert.');
      c.evenement('alerte', id, `Incident linge ouvert pour ${l?.nom ?? 'un logement'} : ${detail} manquant(s).`, 'incident', id);
    }
    return c.res;
  },
};
