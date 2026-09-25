/**
 * Liste « À traiter » : tout ce qui demande une action humaine, trié par
 * priorité. Chaque entrée renvoie vers le module où l'action se fait.
 */
import { dateJour, euros, jourMois, relatif } from '../../../data/format';
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
}

const nom = (d: ErpDonnees, id?: string) => logementById(d, id)?.nom ?? 'Logement';

export function construireATraiter(d: ErpDonnees): ElementATraiter[] {
  const liste: ElementATraiter[] = [];
  const pousser = (e: ElementATraiter, n: number) => n > 0 && liste.push(e);

  const ouverts = incidentsOuverts(d.incidents);
  const graves = ouverts.filter((i) => i.gravite === 'haute');
  pousser({
    id: 'incident_grave', type: 'incident_grave', priorite: 1, ton: 'danger', to: '/erp/incidents',
    titre: graves.length > 1 ? `${graves.length} problèmes graves à régler` : 'Un problème grave à régler',
    details: graves.map((i) => `${nom(d, i.logementId)} : ${i.description}`),
  }, graves.length);

  const aAttribuer = missionsAAttribuerSous(d.missions, 48).sort((a, b) => (a.date + a.heureDebut).localeCompare(b.date + b.heureDebut));
  pousser({
    id: 'mission_attribuer', type: 'mission_attribuer', priorite: 1, ton: 'danger', to: '/erp/menages',
    titre: aAttribuer.length > 1 ? `${aAttribuer.length} ménages sans personne dans les 48 h` : 'Un ménage sans personne dans les 48 h',
    details: aAttribuer.map((m) => `${nom(d, m.logementId)}, ${relatif(m.date)} à ${m.heureDebut}`),
  }, aAttribuer.length);

  const docs = documentsAlertes(d.prestataires, 30);
  const docsBloquants = docs.filter((a) => a.statut !== 'expire_bientot');
  pousser({
    id: 'document', type: 'document', priorite: docsBloquants.length ? 1 : 2, ton: docsBloquants.length ? 'danger' : 'alerte',
    to: '/erp/prestataires',
    titre: docs.length > 1 ? `${docs.length} papiers de prestataires à renouveler` : 'Un papier de prestataire à renouveler',
    details: docs.map((a) =>
      `${a.prestataire.nom} : ${libelleDocument(a.document.type)} ${
        a.statut === 'manquant' ? 'manquant' : a.statut === 'expire' ? 'expiré' : `expire le ${jourMois(a.document.valideJusquau!)}`
      }`),
  }, docs.length);

  const messages = d.filsMessages.filter((f) => f.statut === 'escalade' || f.traitePar === 'en_attente');
  pousser({
    id: 'message', type: 'message', priorite: 1, ton: 'alerte', to: '/erp/messagerie',
    titre: messages.length > 1 ? `${messages.length} voyageurs attendent votre réponse` : 'Un voyageur attend votre réponse',
    details: messages.map((f) => `${f.voyageur} (${nom(d, f.logementId)})${f.statut === 'escalade' ? ', confié par votre agent' : ''}`),
  }, messages.length);

  const aValider = d.missions.filter((m) => m.statut === 'a_valider');
  pousser({
    id: 'mission_valider', type: 'mission_valider', priorite: 2, ton: 'alerte', to: '/erp/menages',
    titre: aValider.length > 1 ? `${aValider.length} ménages terminés à vérifier` : 'Un ménage terminé à vérifier',
    details: aValider.map((m) => `${nom(d, m.logementId)}, ${dateJour(m.date)}, ${prestataireById(d, m.prestataireId)?.nom ?? 'sans prestataire'}`),
  }, aValider.length);

  const autres = ouverts.filter((i) => i.gravite !== 'haute').sort((a, b) => (a.gravite === 'moyenne' ? -1 : 1) - (b.gravite === 'moyenne' ? -1 : 1));
  pousser({
    id: 'incident', type: 'incident', priorite: 2, ton: 'alerte', to: '/erp/incidents',
    titre: autres.length > 1 ? `${autres.length} petits problèmes en cours` : 'Un petit problème en cours',
    details: autres.map((i) => `${nom(d, i.logementId)} : ${i.description}`),
  }, autres.length);

  const ecarts = ecartsLinge(d.mouvementsLinge);
  pousser({
    id: 'linge', type: 'linge', priorite: 2, ton: 'alerte', to: '/erp/linge',
    titre: ecarts.length > 1 ? `Du linge manque dans ${ecarts.length} cas` : 'Du linge manque',
    details: ecarts.map((e) => `${nom(d, e.logementId)} : ${e.manquant} × ${e.article} (envoyé le ${jourMois(e.date)})`),
  }, ecarts.length);

  const retard = facturesEnRetard(d.factures);
  pousser({
    id: 'facture', type: 'facture', priorite: 2, ton: 'danger', to: '/erp/finance',
    titre: retard.length > 1 ? `${retard.length} factures pas encore payées` : 'Une facture pas encore payée',
    details: retard.map((f) => `${f.numero} : ${euros(montantTtc(f))}, à payer depuis le ${jourMois(f.echeance)}`),
  }, retard.length);

  const paiements = paiementsAFaire(d);
  pousser({
    id: 'paiement', type: 'paiement', priorite: 3, ton: 'info', to: '/erp/finance',
    titre: paiements.length > 1 ? `${paiements.length} prestataires à payer` : 'Un prestataire à payer',
    details: paiements.map((p) => `${prestataireById(d, p.prestataireId)?.nom ?? 'Prestataire'} : ${euros(p.montantCentimes - p.retenueCentimes)} (${p.periode})`),
  }, paiements.length);

  for (const l of d.logements.filter((x) => x.statut === 'lancement')) {
    const a = avancementChecklist(l);
    const restants = l.checklistLancement.filter((c) => !c.fait);
    pousser({
      id: `lancement-${l.id}`, type: 'lancement', priorite: 2, ton: 'or', to: `/erp/logements/${l.id}`,
      titre: `${l.nom} : encore ${a.total - a.faits} étape${a.total - a.faits > 1 ? 's' : ''} avant la mise en ligne`,
      details: restants.map((c) => c.libelle),
    }, restants.length);
  }

  const dues = actionsCommercialesDues(d.prospects);
  pousser({
    id: 'commercial', type: 'commercial', priorite: 2, ton: 'or', to: '/erp/commercial',
    titre: dues.length > 1 ? `${dues.length} propriétaires à recontacter` : 'Un propriétaire à recontacter',
    details: dues.map((p) => `${p.nom} : ${p.prochaineAction ?? 'relance'} (${relatif(p.prochaineActionLe!)})`),
  }, dues.length);

  return liste.sort((a, b) => a.priorite - b.priorite);
}
