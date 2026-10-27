/**
 * « À faire » de l'accueil : ce qui demande une action, trié par priorité.
 * Channel manager (octobre 2026) : seulement les voyageurs, les logements,
 * les contacts et la synchronisation ; plus de ménages, linge, factures ni
 * prestataires (sortis de l'ERP). Les incidents signalés depuis l'espace
 * opérations et les « Ce logement n’est pas à moi » y remontent aussi.
 */
import { aTraiterLe } from '../../../data/crm';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { AUJOURDHUI, ajouterJours } from '../../../data/format';
import { incidentsATraiter, lienIncident } from '../../../data/incidents-erp';
import { sansChargeLe } from '../../../data/operations';
import { extrait } from '../../../data/notifications';
import { ACTION_JOURNAL_REPULL } from '../../../data/repull';
import { logementById } from '../../../data/selectors';
import { avisATraiter, prenomDe } from '../../../data/messages-programmes';
import { ID_ALERTE_CONTROLE, type AlerteControleAgent } from '../../../data/controle-reponse';
import type { ErpDonnees } from '../../../data/types';
import type { Ton } from '../../../ui';
import { completudeFiche } from '../../logements/_composants/stats';
import { elementsPrixEtAnomalies } from './aTraiterAnalyse';

export type TypeATraiter =
  | 'message' | 'avis' | 'avisHote' | 'agent' | 'crm' | 'synchro' | 'urgence' | 'incident' | 'signalement' | 'charge'
  // Prix conseillés et anomalies (aTraiterAnalyse.ts).
  | 'prix' | 'double' | 'suspecte' | 'prix_anormal' | 'integrite';

export interface ElementATraiter {
  id: string;
  type: TypeATraiter;
  /** 1 = aujourd'hui, 2 = cette semaine. */
  priorite: 1 | 2;
  ton: Ton;
  titre: string;
  details: string[];
  /** Ligne montrée dans la carte à la place du premier détail (ex. les logements concernés). */
  apercu?: string;
  /** Lien de chaque détail (même ordre), quand chacun mène ailleurs. */
  liens?: string[];
  to: string;
}

/** Une note voyageur sous ce seuil (sur 5) mérite d'être lue : le même partout dans l'ERP. */
const NOTE_A_LIRE = SEUIL_NOTE_CONTROLE;

/** `gerant` : lignes réservées au gérant (« pas à moi », logements sans personne en charge), qui mènent à Accès. */
export function construireATraiter(d: ErpDonnees, aujourdhui = AUJOURDHUI, { gerant = true }: { gerant?: boolean } = {}): ElementATraiter[] {
  const liste: ElementATraiter[] = [];
  const nom = (id?: string) => logementById(d, id)?.nom ?? 'Logement';

  // Même règle que « À répondre » dans la Messagerie : une conversation terminée
  // (« Pas besoin de répondre ») n'attend plus rien, jusqu'au prochain message du voyageur.
  const messages = d.filsMessages.filter((f) => f.statut !== 'clos' && (f.statut === 'escalade' || f.traitePar === 'en_attente'));
  if (messages.length)
    liste.push({
      id: 'message', type: 'message', priorite: 1, ton: 'alerte', to: '/erp/messagerie',
      titre: messages.length > 1 ? `${messages.length} voyageurs attendent votre réponse` : 'Un voyageur attend votre réponse',
      details: messages.map((f) => `${f.voyageur} (${nom(f.logementId)})${f.statut === 'escalade' ? ', confié par votre agent' : ''}`),
    });

  // Incidents : les urgences d'abord (le seul rouge), puis les autres ouverts.
  const { urgences, autres } = incidentsATraiter(d);
  const ligneIncident = (i: (typeof urgences)[number]) => `${nom(i.logementId)} : ${extrait(i.description, 80)}`;
  if (urgences.length)
    liste.push({
      id: 'urgence', type: 'urgence', priorite: 1, ton: 'danger', to: lienIncident(urgences[0]),
      titre: urgences.length > 1 ? `${urgences.length} urgences signalées` : 'Une urgence signalée',
      details: urgences.map(ligneIncident),
      ...(urgences.length > 1 ? { liens: urgences.map(lienIncident) } : {}),
    });
  if (autres.length)
    liste.push({
      id: 'incident', type: 'incident', priorite: 2, ton: 'alerte', to: lienIncident(autres[0]),
      titre: autres.length > 1 ? `${autres.length} incidents ouverts` : 'Un incident ouvert',
      details: autres.map(ligneIncident),
      ...(autres.length > 1 ? { liens: autres.map(lienIncident) } : {}),
    });

  // Avis à déposer sur Airbnb après chaque départ : aucun séjour terminé sans son avis traité.
  const aDeposer = avisATraiter(d, aujourdhui);
  if (aDeposer.length) {
    const lien = (id: string) => `/erp/reservations/${encodeURIComponent(id)}`;
    liste.push({
      id: 'avisHote', type: 'avisHote', priorite: aDeposer.some((a) => a.joursRestants <= 2) ? 1 : 2, ton: 'or', to: lien(aDeposer[0].reservation.id),
      titre: aDeposer.length > 1 ? `${aDeposer.length} avis à déposer` : 'Un avis à déposer',
      details: aDeposer.map((a) => `${prenomDe(a.reservation.voyageur.nom)} (${nom(a.reservation.logementId)})${a.statut === 'a_relire' ? ', à relire' : ''} · encore ${a.joursRestants} j`),
      liens: aDeposer.map((a) => lien(a.reservation.id)),
    });
  }

  // Logements où personne n'a la charge aujourd'hui (ni choix ni seul agent, ou absent sans relais) :
  // codes et incidents sans destinataire. Une absence sans relais compte pour aujourd'hui.
  const sansCharge = gerant && d.equipe && d.affectations ? sansChargeLe({ ...d, absences: d.absences ?? [] }, aujourdhui) : [];
  if (sansCharge.length) {
    const membre = (id: string) => d.equipe?.find((m) => m.id === id)?.nom ?? 'La personne en charge';
    liste.push({
      id: 'charge', type: 'charge', priorite: sansCharge.some((x) => x.absent) ? 1 : 2, ton: 'alerte', to: `/erp/logements/${encodeURIComponent(sansCharge[0].logementId)}`,
      titre: sansCharge.length > 1 ? `${sansCharge.length} logements sans personne en charge aujourd’hui` : `${nom(sansCharge[0].logementId)} : sans personne en charge aujourd’hui`,
      details: sansCharge.map((x) => (x.absent ? `${nom(x.logementId)} : ${membre(x.absent)} en absence, personne ne prend le relais` : `${nom(x.logementId)} : choisir qui s’en occupe au quotidien`)),
      liens: sansCharge.map((x) => `/erp/logements/${encodeURIComponent(x.logementId)}`),
    });
  }

  const signalements = gerant ? (d.signalementsLogement ?? []).filter((s) => s.statut === 'ouvert') : [];
  if (signalements.length) {
    const personne = (id: string) => d.equipe?.find((m) => m.id === id)?.nom ?? 'Un membre';
    liste.push({
      id: 'signalement', type: 'signalement', priorite: 2, ton: 'or', to: '/erp/parametres/acces',
      titre: signalements.length > 1 ? `${signalements.length} logements signalés « pas à moi »` : 'Un logement signalé « pas à moi »',
      details: signalements.map((s) => `${personne(s.membreId)} : ${nom(s.logementId)}`),
    });
  }

  const journal = [...d.journal].filter((j) => j.action === ACTION_JOURNAL_REPULL).sort((a, b) => b.horodatage.localeCompare(a.horodatage));
  if (journal[0] && /erreur/i.test(journal[0].details))
    liste.push({
      id: 'synchro', type: 'synchro', priorite: 1, ton: 'danger', to: '/erp/parametres',
      titre: 'La dernière mise à jour Airbnb et Booking a échoué',
      details: ['Réservations et messages ne sont peut-être plus à jour.'],
    });

  const depuis = ajouterJours(aujourdhui, -14);
  const avis = d.reservations
    .filter((r) => r.noteVoyageur !== undefined && r.noteVoyageur < NOTE_A_LIRE && r.depart >= depuis && r.depart <= aujourdhui)
    .sort((a, b) => b.depart.localeCompare(a.depart));
  if (avis.length)
    liste.push({
      id: 'avis', type: 'avis', priorite: 2, ton: 'alerte', to: `/erp/reservations/${avis[0].id}`,
      titre: avis.length > 1 ? `${avis.length} avis sous ${String(NOTE_A_LIRE).replace('.', ',')} à lire` : `Un avis sous ${String(NOTE_A_LIRE).replace('.', ',')} à lire`,
      details: avis.map((r) => `${r.voyageur.nom}, note ${String(r.noteVoyageur).replace('.', ',')} (${nom(r.logementId)})`),
    });

  const incompletes = d.logements
    .filter((l) => l.statut === 'actif')
    .map((l) => ({ l, manquants: completudeFiche(l.fiche).manquants }))
    .filter((x) => x.manquants.length);
  if (incompletes.length)
    liste.push({
      id: 'agent', type: 'agent', priorite: 2, ton: 'or', to: `/erp/logements/${incompletes[0].l.id}?onglet=fiche`,
      titre: incompletes.length > 1 ? `L’agent manque d’informations sur ${incompletes.length} logements` : `L’agent manque d’informations sur ${incompletes[0].l.nom}`,
      details: incompletes.map((x) => `${x.l.nom} : ${x.manquants.slice(0, 3).join(', ').toLowerCase()}${x.manquants.length > 3 ? '…' : ''}`),
    });

  // L'agent ne peut plus faire contrôler ses réponses (échecs en série) : il les garde toutes à valider.
  const alerteControle = (d.reglages ?? []).find((r): r is AlerteControleAgent => r?.id === ID_ALERTE_CONTROLE);
  if (alerteControle?.active)
    liste.push({
      id: 'agent-controle', type: 'agent', priorite: 1, ton: 'alerte', to: '/erp/messagerie/agent',
      titre: alerteControle.message,
      details: ['Rien ne part seul : ses réponses vous attendent dans la Messagerie, à relire et envoyer.'],
    });

  const aAppeler = d.crm.filter((c) => aTraiterLe(c, aujourdhui));
  if (aAppeler.length)
    liste.push({
      id: 'crm', type: 'crm', priorite: 2, ton: 'or', to: '/erp/crm',
      titre: aAppeler.length > 1 ? `${aAppeler.length} personnes à appeler aujourd’hui` : 'Une personne à appeler aujourd’hui',
      details: aAppeler.map((c) => `${c.nom}${c.ville ? ` (${c.ville})` : ''}`),
    });

  // Prix à revoir (une ligne groupée) et anomalies.
  liste.push(...elementsPrixEtAnomalies(d, aujourdhui, { gerant }));

  return liste.sort((a, b) => a.priorite - b.priorite);
}
