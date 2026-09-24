/**
 * Règles d'opérations : attribution, contrôle qualité, preuves (SPEC §2.3 à §2.5).
 */
import { checklistMenageVierge, SEUIL_NOTE_CONTROLE } from '../data/constantes';
import { ajouterJours, jourMois } from '../data/format';
import { logementById, prestataireConforme, reservationById } from '../data/selectors';
import type { Logement, Mission, Prestataire } from '../data/types';
import { collecteur, hachage, heureDe } from './outils';
import type { Regle } from './types';

const INACTIVES: Mission['statut'][] = ['annulee', 'refusee'];

/** Le prestataire couvre-t-il la ville du logement (ville exacte, ou département) ? */
function couvre(p: Prestataire, l: Logement): boolean {
  if (p.zone.includes(l.ville)) return true;
  if (l.codePostal.startsWith('91') && p.zone.includes('Essonne')) return true;
  if (l.codePostal.startsWith('75') && p.zone.includes('Paris')) return true;
  return false;
}

/** Ménages qu'un prestataire peut enchaîner dans la fenêtre départ-arrivée. */
const CAPACITE_MENAGES_JOUR = 2;

export const attribuerAutomatiquement: Regle = {
  cle: 'attribution-auto',
  nom: 'Attribution automatique',
  description:
    'Quand un ménage est à attribuer, alors il est confié au meilleur prestataire conforme (contrat, RC Pro, URSSAF valides), actif, qui couvre la ville et n’a pas atteint sa capacité du jour (2 ménages, enchaînés entre 11 h et 16 h) : meilleure note d’abord, puis le moins chargé ce jour-là.',
  spec: '§2.3',
  domaine: 'operations',
  declencheur: 'mission',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    // Copie de travail : les attributions faites dans ce passage comptent pour les suivantes.
    const planning: Mission[] = d.missions.filter((m) => m.prestataireId && !INACTIVES.includes(m.statut));
    const aAttribuer = d.missions
      .filter((m) => m.type === 'menage' && m.statut === 'a_attribuer' && m.date >= ctx.date)
      .sort((a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut));
    for (const m of aAttribuer) {
      const l = logementById(d, m.logementId);
      if (!l) continue;
      const candidats = d.prestataires
        .filter((p) => p.type === 'menage' && p.statut === 'actif' && prestataireConforme(p, ctx.date).ok && couvre(p, l))
        .map((p) => ({ p, charge: planning.filter((x) => x.prestataireId === p.id && x.date === m.date).length }))
        // Un ménage prend environ 2 h dans la fenêtre 11 h - 16 h : deux par jour, enchaînés.
        .filter(({ charge }) => charge < CAPACITE_MENAGES_JOUR)
        .sort((a, b) => (b.p.noteMoyenne ?? 0) - (a.p.noteMoyenne ?? 0) || a.charge - b.charge || a.p.nom.localeCompare(b.p.nom));
      const choix = candidats[0]?.p;
      if (!choix) {
        c.evenement('alerte', `aucun:${m.id}`, `Aucun prestataire conforme disponible pour le ménage de ${l.nom} le ${jourMois(m.date)}. À attribuer à la main.`, 'mission', m.id);
        continue;
      }
      const tarif = choix.tarifs.find((t) => t.typeLogement === l.type)?.montantCentimes ?? m.tarifCentimes;
      const attribuee: Mission = { ...m, prestataireId: choix.id, statut: 'attribuee', tarifCentimes: tarif };
      planning.push(attribuee);
      c.modifier('missions', attribuee, `Attribuée à ${choix.nom}.`);
      c.evenement('action', `${m.id}:${choix.id}`, `Ménage de ${l.nom} du ${jourMois(m.date)} attribué à ${choix.nom}.`, 'mission', m.id);
    }
    return c.res;
  },
};

export const controleQualite: Regle = {
  cle: 'controle-qualite',
  nom: 'Contrôle qualité automatique',
  description:
    `Quand un ménage est tiré au sort (1 sur 10) ou qu’un voyageur note le séjour sous ${String(SEUIL_NOTE_CONTROLE).replace('.', ',')}, alors une mission de contrôle physique est planifiée le lendemain.`,
  spec: '§2.5',
  domaine: 'operations',
  declencheur: 'mission',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const debut = ajouterJours(ctx.date, -7);
    for (const m of d.missions) {
      if (m.type !== 'menage' || INACTIVES.includes(m.statut) || m.date < debut) continue;
      const r = reservationById(d, m.reservationId);
      const noteBasse = r?.statut === 'terminee' && r.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE;
      const tire = hachage(m.id) % 10 === 0;
      if (!noteBasse && !tire && !m.controleQualite) continue;
      const l = logementById(d, m.logementId);
      const motif = noteBasse ? `note voyageur ${String(r?.noteVoyageur).replace('.', ',')}` : 'tirage au sort 1 sur 10';
      if (!m.controleQualite) c.modifier('missions', { ...m, controleQualite: true }, `Contrôle qualité demandé (${motif}).`);
      const id = `auto-controle-${m.id}`;
      const existe = d.missions.some(
        (x) => x.type === 'controle' && (x.id === id || (m.reservationId !== undefined && x.reservationId === m.reservationId)),
      );
      if (existe) continue;
      const lendemain = ajouterJours(m.date, 1);
      const date = lendemain < ctx.date ? ctx.date : lendemain;
      c.creer(
        'missions',
        {
          id,
          type: 'controle',
          logementId: m.logementId,
          reservationId: m.reservationId,
          date,
          heureDebut: '10:00',
          heureFinMax: '11:00',
          statut: 'attribuee',
          checklist: checklistMenageVierge(),
          photos: [],
          tarifCentimes: 0,
          controleQualite: true,
          commentaire: `Contrôle physique interne (Kamel), motif : ${motif}.`,
        },
        `Contrôle planifié le ${jourMois(date)}.`,
      );
      c.evenement('action', id, `Contrôle physique planifié à ${l?.nom ?? 'un logement'} le ${jourMois(date)} (${motif}).`, 'mission', id);
    }
    return c.res;
  },
};

export const preuvesManquantes: Regle = {
  cle: 'preuves-manquantes',
  nom: 'Relance des preuves photo',
  description:
    'Quand un ménage dépasse son heure de fin, alors il passe « à valider » ; s’il manque les photos après, une alerte part, et au bout d’un jour un incident « Preuves manquantes » est ouvert. Pas de validation, pas de paiement.',
  spec: '§2.4',
  domaine: 'operations',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const debut = ajouterJours(ctx.date, -30);
    const heure = heureDe(ctx.maintenant);
    for (const m of d.missions) {
      if (m.type !== 'menage' || m.date < debut) continue;
      if (m.statut !== 'attribuee' && m.statut !== 'en_cours' && m.statut !== 'a_valider') continue;
      const passee = m.date < ctx.date || (m.date === ctx.date && heure >= m.heureFinMax);
      if (!passee) continue;
      const l = logementById(d, m.logementId);
      const nom = l?.nom ?? 'un logement';
      if (m.statut !== 'a_valider') {
        c.modifier('missions', { ...m, statut: 'a_valider' }, 'Heure de fin dépassée : à valider.');
        c.evenement('action', `a-valider:${m.id}`, `Ménage de ${nom} du ${jourMois(m.date)} passé « à valider ».`, 'mission', m.id);
      }
      if (m.photos.some((p) => p.moment === 'apres')) continue;
      c.evenement('alerte', `photos:${m.id}`, `Photos après manquantes pour le ménage de ${nom} du ${jourMois(m.date)} : paiement bloqué.`, 'mission', m.id);
      const idIncident = `auto-inc-preuves-${m.id}`;
      if (ctx.date < ajouterJours(m.date, 1) || d.incidents.some((i) => i.id === idIncident)) continue;
      c.creer(
        'incidents',
        {
          id: idIncident,
          logementId: m.logementId,
          reservationId: m.reservationId,
          date: ctx.date,
          categorie: 'menage',
          gravite: 'moyenne',
          description: `Preuves manquantes : ménage du ${jourMois(m.date)} sans photos après. Mission non payable tant que les preuves ne sont pas fournies.`,
          statut: 'ouvert',
          responsable: 'Kamel',
          refacturable: 'aucun',
          preuves: [],
        },
        'Incident « Preuves manquantes » ouvert.',
      );
      c.evenement('alerte', idIncident, `Incident ouvert : preuves manquantes pour ${nom} (ménage du ${jourMois(m.date)}).`, 'incident', idIncident);
    }
    return c.res;
  },
};
