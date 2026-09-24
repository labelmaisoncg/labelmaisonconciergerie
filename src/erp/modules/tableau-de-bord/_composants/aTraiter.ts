/**
 * Liste « À traiter » : tout ce qui demande une action humaine, trié par
 * priorité. Chaque entrée renvoie vers le module où l'action se fait.
 */
import { dateJour, euros, jourMois, pluriel, relatif } from '../../../data/format';
import {
  actionsCommercialesDues,
  avancementChecklist,
  documentsAlertes,
  ecartsLinge,
  facturesEnRetard,
  incidentsOuverts,
  libelleDocument,
  logementById,
  missionsAAttribuerSous,
  montantTtc,
  paiementsAFaire,
  prestataireById,
} from '../../../data/selectors';
import type { ErpDonnees } from '../../../data/types';
import type { Ton } from '../../../ui';

export type Vue = 'kamel' | 'abdel';

export type TypeATraiter =
  | 'incident_grave'
  | 'mission_attribuer'
  | 'document'
  | 'message'
  | 'mission_valider'
  | 'incident'
  | 'linge'
  | 'facture'
  | 'paiement'
  | 'lancement'
  | 'commercial';

export interface ElementATraiter {
  id: string;
  type: TypeATraiter;
  /** 1 = bloquant aujourd'hui, 2 = cette semaine, 3 = à planifier. */
  priorite: 1 | 2 | 3;
  ton: Ton;
  titre: string;
  details: string[];
  to: string;
  vues: Vue[];
}

const nom = (d: ErpDonnees, id?: string) => logementById(d, id)?.nom ?? 'Logement';
const TOUS: Vue[] = ['kamel', 'abdel'];

export function construireATraiter(d: ErpDonnees): ElementATraiter[] {
  const liste: ElementATraiter[] = [];
  const pousser = (e: ElementATraiter, n: number) => n > 0 && liste.push(e);

  const ouverts = incidentsOuverts(d.incidents);
  const graves = ouverts.filter((i) => i.gravite === 'haute');
  pousser({
    id: 'incident_grave', type: 'incident_grave', priorite: 1, ton: 'danger', vues: TOUS, to: '/erp/incidents',
    titre: `${pluriel(graves.length, 'incident')} de gravité haute`,
    details: graves.map((i) => `${nom(d, i.logementId)} : ${i.description}`),
  }, graves.length);

  const aAttribuer = missionsAAttribuerSous(d.missions, 48).sort((a, b) => (a.date + a.heureDebut).localeCompare(b.date + b.heureDebut));
  pousser({
    id: 'mission_attribuer', type: 'mission_attribuer', priorite: 1, ton: 'danger', vues: ['kamel'], to: '/erp/menages',
    titre: `${pluriel(aAttribuer.length, 'mission')} à attribuer sous 48 h`,
    details: aAttribuer.map((m) => `${nom(d, m.logementId)}, ${relatif(m.date)} à ${m.heureDebut}`),
  }, aAttribuer.length);

  const docs = documentsAlertes(d.prestataires, 30);
  const docsBloquants = docs.filter((a) => a.statut !== 'expire_bientot');
  pousser({
    id: 'document', type: 'document', priorite: docsBloquants.length ? 1 : 2, ton: docsBloquants.length ? 'danger' : 'alerte',
    vues: ['kamel'], to: '/erp/prestataires',
    titre: `${pluriel(docs.length, 'document prestataire', 'documents prestataires')} expiré${docs.length > 1 ? 's' : ''} ou expirant`,
    details: docs.map((a) =>
      `${a.prestataire.nom} : ${libelleDocument(a.document.type)} ${
        a.statut === 'manquant' ? 'manquant' : a.statut === 'expire' ? 'expiré' : `expire le ${jourMois(a.document.valideJusquau!)}`
      }`),
  }, docs.length);

  const messages = d.filsMessages.filter((f) => f.statut === 'escalade' || f.traitePar === 'en_attente');
  pousser({
    id: 'message', type: 'message', priorite: 1, ton: 'alerte', vues: TOUS, to: '/erp/messagerie',
    titre: `${pluriel(messages.length, 'conversation')} escaladée${messages.length > 1 ? 's' : ''} ou en attente`,
    details: messages.map((f) => `${f.voyageur} (${nom(d, f.logementId)})${f.statut === 'escalade' ? ', escaladée' : ''}`),
  }, messages.length);

  const aValider = d.missions.filter((m) => m.statut === 'a_valider');
  pousser({
    id: 'mission_valider', type: 'mission_valider', priorite: 2, ton: 'alerte', vues: ['kamel'], to: '/erp/menages',
    titre: `${pluriel(aValider.length, 'mission')} à valider (pas de validation, pas de paiement)`,
    details: aValider.map((m) => `${nom(d, m.logementId)}, ${dateJour(m.date)}, ${prestataireById(d, m.prestataireId)?.nom ?? 'sans prestataire'}`),
  }, aValider.length);

  const autres = ouverts.filter((i) => i.gravite !== 'haute').sort((a, b) => (a.gravite === 'moyenne' ? -1 : 1) - (b.gravite === 'moyenne' ? -1 : 1));
  pousser({
    id: 'incident', type: 'incident', priorite: 2, ton: 'alerte', vues: ['kamel'], to: '/erp/incidents',
    titre: `${pluriel(autres.length, 'autre incident ouvert', 'autres incidents ouverts')}`,
    details: autres.map((i) => `${nom(d, i.logementId)} : ${i.description}`),
  }, autres.length);

  const ecarts = ecartsLinge(d.mouvementsLinge);
  pousser({
    id: 'linge', type: 'linge', priorite: 2, ton: 'alerte', vues: ['kamel'], to: '/erp/linge',
    titre: `${pluriel(ecarts.length, 'écart')} d’inventaire de linge`,
    details: ecarts.map((e) => `${nom(d, e.logementId)} : ${e.manquant} × ${e.article} (envoi du ${jourMois(e.date)})`),
  }, ecarts.length);

  const retard = facturesEnRetard(d.factures);
  pousser({
    id: 'facture', type: 'facture', priorite: 2, ton: 'danger', vues: TOUS, to: '/erp/finance',
    titre: `${pluriel(retard.length, 'facture')} en retard`,
    details: retard.map((f) => `${f.numero} : ${euros(montantTtc(f))}, échue le ${jourMois(f.echeance)}`),
  }, retard.length);

  const paiements = paiementsAFaire(d);
  pousser({
    id: 'paiement', type: 'paiement', priorite: 3, ton: 'info', vues: ['kamel'], to: '/erp/finance',
    titre: `${pluriel(paiements.length, 'paiement prestataire', 'paiements prestataires')} à faire`,
    details: paiements.map((p) => `${prestataireById(d, p.prestataireId)?.nom ?? 'Prestataire'} : ${euros(p.montantCentimes - p.retenueCentimes)} (${p.periode})`),
  }, paiements.length);

  for (const l of d.logements.filter((x) => x.statut === 'lancement')) {
    const a = avancementChecklist(l);
    const restants = l.checklistLancement.filter((c) => !c.fait);
    pousser({
      id: `lancement-${l.id}`, type: 'lancement', priorite: 2, ton: 'or', vues: TOUS, to: `/erp/logements/${l.id}`,
      titre: `${l.nom} bloqué en lancement (${a.faits}/${a.total})`,
      details: restants.map((c) => c.libelle),
    }, restants.length);
  }

  const dues = actionsCommercialesDues(d.prospects);
  pousser({
    id: 'commercial', type: 'commercial', priorite: 2, ton: 'or', vues: ['abdel'], to: '/erp/commercial',
    titre: `${pluriel(dues.length, 'action commerciale', 'actions commerciales')} due${dues.length > 1 ? 's' : ''}`,
    details: dues.map((p) => `${p.nom} : ${p.prochaineAction ?? 'relance'} (${relatif(p.prochaineActionLe!)})`),
  }, dues.length);

  return liste.sort((a, b) => a.priorite - b.priorite);
}
