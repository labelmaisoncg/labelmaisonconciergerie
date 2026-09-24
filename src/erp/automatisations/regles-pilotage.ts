/**
 * Règles de référentiel et de pilotage : activation, conformité, relances, escalades.
 */
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../data/constantes';
import { ecartJours, jourMois } from '../data/format';
import { actionsCommercialesDues, logementActivable, logementById, nuitsAnnee } from '../data/selectors';
import { collecteur, heuresEntre } from './outils';
import type { Regle } from './types';

const SEUIL_ALERTE_NUITS = 110;
const NOMS = { abdel: 'Abdel', kamel: 'Kamel' } as const;

export const activationLogement: Regle = {
  cle: 'activation-logement',
  nom: 'Mise en ligne des logements prêts',
  description: 'Quand un logement en lancement a son mandat signé ET sa checklist de lancement complète, alors il passe automatiquement « actif ».',
  spec: '§2.1',
  domaine: 'referentiel',
  declencheur: 'logement',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    for (const l of d.logements) {
      if (l.statut !== 'lancement' || !logementActivable(l, d.mandats).ok) continue;
      c.modifier('logements', { ...l, statut: 'actif' }, 'Checklist complète et mandat signé : actif.');
      c.evenement('action', l.id, `${l.nom} est passé actif : mandat signé et checklist de lancement complète.`, 'logement', l.id);
    }
    return c.res;
  },
};

export const plafondResidencePrincipale: Regle = {
  cle: 'plafond-120-nuits',
  nom: 'Compteur 120 nuits',
  description:
    `Quand une résidence principale atteint ${SEUIL_ALERTE_NUITS} nuits vendues dans l’année, alors une alerte est levée ; à ${PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits, l’ERP demande de fermer le calendrier.`,
  spec: '§2.10',
  domaine: 'pilotage',
  declencheur: 'reservation',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const annee = Number(ctx.date.slice(0, 4));
    for (const l of d.logements) {
      if (!l.residencePrincipale || l.statut === 'sorti') continue;
      const { nuits } = nuitsAnnee(d.reservations, l.id, annee);
      if (nuits >= PLAFOND_NUITS_RESIDENCE_PRINCIPALE) {
        c.evenement('alerte', `${annee}:plafond:${l.id}`, `${l.nom} : ${nuits} nuits vendues en ${annee}, plafond atteint. Fermer le calendrier.`, 'logement', l.id);
      } else if (nuits >= SEUIL_ALERTE_NUITS) {
        c.evenement('alerte', `${annee}:seuil:${l.id}`,
          `${l.nom} : ${nuits} nuits vendues en ${annee}, plus que ${PLAFOND_NUITS_RESIDENCE_PRINCIPALE - nuits} avant le plafond.`, 'logement', l.id);
      }
    }
    return c.res;
  },
};

export const rappelsCommerciaux: Regle = {
  cle: 'rappels-commerciaux',
  nom: 'Rappels commerciaux',
  description: 'Quand la prochaine action d’un prospect arrive à échéance, alors un rappel est envoyé à son responsable.',
  domaine: 'pilotage',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    for (const p of actionsCommercialesDues(d.prospects, ctx.date)) {
      const quand = p.prochaineActionLe === ctx.date ? 'aujourd’hui' : `prévu le ${jourMois(p.prochaineActionLe!)}`;
      c.evenement('info', `${p.id}:${p.prochaineActionLe}`,
        `Rappel à ${NOMS[p.responsable]} : ${p.prochaineAction ?? 'relancer'} (${p.nom}, ${quand}).`, 'prospect', p.id);
    }
    return c.res;
  },
};

export const messagesEnAttente: Regle = {
  cle: 'messages-en-attente',
  nom: 'Messages voyageurs sans réponse',
  description:
    'Quand un message voyageur attend une réponse depuis plus d’une heure, alors une alerte est levée ; quand l’agent escalade un fil, alors Abdel est prévenu pour répondre.',
  spec: '§2.8',
  domaine: 'pilotage',
  declencheur: 'message',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    for (const f of d.filsMessages) {
      if (f.statut === 'clos') continue;
      const l = logementById(d, f.logementId);
      if (f.statut === 'escalade') {
        c.evenement('action', `escalade:${f.id}:${f.dernierMessageLe}`,
          `Fil escaladé : Abdel doit répondre à ${f.voyageur} (${l?.nom ?? 'logement'}).`, 'message', f.id);
      } else if (f.traitePar === 'en_attente' && heuresEntre(f.dernierMessageLe, ctx.maintenant) > 1) {
        const h = Math.floor(heuresEntre(f.dernierMessageLe, ctx.maintenant));
        c.evenement('alerte', `attente:${f.id}:${f.dernierMessageLe}`,
          `${f.voyageur} attend une réponse depuis ${h} h (${l?.nom ?? 'logement'}).`, 'message', f.id);
      }
    }
    return c.res;
  },
};

export const escaladeIncidents: Regle = {
  cle: 'escalade-incidents',
  nom: 'Escalade des incidents graves',
  description: 'Quand un incident de gravité haute reste ouvert plus de 24 heures, alors il est escaladé au gérant.',
  domaine: 'pilotage',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    for (const i of d.incidents) {
      if (i.gravite !== 'haute' || i.statut !== 'ouvert' || ecartJours(i.date, ctx.date) < 1) continue;
      const l = logementById(d, i.logementId);
      c.evenement('alerte', i.id, `Incident grave ouvert depuis le ${jourMois(i.date)} à ${l?.nom ?? 'un logement'} : escaladé au gérant.`, 'incident', i.id);
    }
    return c.res;
  },
};
