/**
 * « À faire » de l'accueil : ce qui demande une action, trié par priorité.
 * Channel manager (octobre 2026) : seulement les voyageurs, les logements,
 * les contacts et la synchronisation ; plus de ménages, linge, factures ni
 * prestataires (sortis de l'ERP).
 */
import { aTraiterLe } from '../../../data/crm';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { AUJOURDHUI, ajouterJours } from '../../../data/format';
import { ACTION_JOURNAL_REPULL } from '../../../data/repull';
import { logementById } from '../../../data/selectors';
import type { ErpDonnees } from '../../../data/types';
import type { Ton } from '../../../ui';
import { completudeFiche } from '../../logements/_composants/stats';

export type TypeATraiter = 'message' | 'avis' | 'agent' | 'crm' | 'synchro';

export interface ElementATraiter {
  id: string;
  type: TypeATraiter;
  /** 1 = aujourd'hui, 2 = cette semaine. */
  priorite: 1 | 2;
  ton: Ton;
  titre: string;
  details: string[];
  to: string;
}

/** Une note voyageur sous ce seuil (sur 5) mérite d'être lue : le même partout dans l'ERP. */
const NOTE_A_LIRE = SEUIL_NOTE_CONTROLE;

export function construireATraiter(d: ErpDonnees, aujourdhui = AUJOURDHUI): ElementATraiter[] {
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
      titre: avis.length > 1 ? `${avis.length} avis sous ${String(NOTE_A_LIRE).replace('.', ',')}/5 à lire` : `Un avis sous ${String(NOTE_A_LIRE).replace('.', ',')}/5 à lire`,
      details: avis.map((r) => `${r.voyageur.nom} : ${String(r.noteVoyageur).replace('.', ',')}/5 (${nom(r.logementId)})`),
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

  const aAppeler = d.crm.filter((c) => aTraiterLe(c, aujourdhui));
  if (aAppeler.length)
    liste.push({
      id: 'crm', type: 'crm', priorite: 2, ton: 'or', to: '/erp/crm',
      titre: aAppeler.length > 1 ? `${aAppeler.length} personnes à appeler aujourd’hui` : 'Une personne à appeler aujourd’hui',
      details: aAppeler.map((c) => `${c.nom}${c.ville ? ` (${c.ville})` : ''}`),
    });

  return liste.sort((a, b) => a.priorite - b.priorite);
}
