/**
 * Règles déclenchées par les réservations (SPEC §2.4).
 */
import { checklistMenageVierge } from '../data/constantes';
import { jourMois } from '../data/format';
import { logementById, prestataireConforme } from '../data/selectors';
import type { ErpDonnees, Logement } from '../data/types';
import { collecteur } from './outils';
import type { Regle } from './types';

const TARIF_MENAGE_DEFAUT = 3500;

/** Tarif du ménage : prestataire habituel du logement, sinon le moins cher des conformes, sinon défaut. */
export function tarifMenage(d: ErpDonnees, logement: Logement, date: string): number {
  const habituel = [...d.missions]
    .filter((m) => m.type === 'menage' && m.logementId === logement.id && m.prestataireId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const p = d.prestataires.find((x) => x.id === habituel?.prestataireId);
  const tarifHabituel = p?.tarifs.find((t) => t.typeLogement === logement.type)?.montantCentimes;
  if (tarifHabituel) return tarifHabituel;
  const tarifs = d.prestataires
    .filter((x) => x.type === 'menage' && prestataireConforme(x, date).ok)
    .map((x) => x.tarifs.find((t) => t.typeLogement === logement.type)?.montantCentimes)
    .filter((t): t is number => t !== undefined);
  return tarifs.length ? Math.min(...tarifs) : TARIF_MENAGE_DEFAUT;
}

export const creerMenageAuDepart: Regle = {
  cle: 'menage-au-depart',
  nom: 'Ménage créé à chaque départ',
  description:
    'Quand une réservation est confirmée, alors une mission de ménage est créée le jour du départ, entre l’heure de départ et l’heure d’arrivée suivante, avec la checklist type.',
  spec: '§2.4',
  domaine: 'reservations',
  declencheur: 'reservation',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const couvertes = new Set(d.missions.filter((m) => m.type === 'menage' && m.reservationId).map((m) => m.reservationId));
    for (const r of d.reservations) {
      if ((r.statut !== 'confirmee' && r.statut !== 'en_cours') || r.depart < ctx.date || couvertes.has(r.id)) continue;
      const l = logementById(d, r.logementId);
      if (!l || l.statut === 'sorti') continue;
      const id = `auto-menage-${r.id}`;
      c.creer(
        'missions',
        {
          id,
          type: 'menage',
          logementId: l.id,
          reservationId: r.id,
          date: r.depart,
          heureDebut: l.fiche.heureDepart,
          heureFinMax: l.fiche.heureArrivee,
          statut: 'a_attribuer',
          checklist: checklistMenageVierge(),
          photos: [],
          tarifCentimes: tarifMenage(d, l, ctx.date),
          controleQualite: false,
        },
        `Ménage du ${jourMois(r.depart)} créé pour ${l.nom}.`,
      );
      c.evenement('action', id, `Ménage créé pour ${l.nom} le ${jourMois(r.depart)} (départ de ${r.voyageur.nom}).`, 'mission', id);
    }
    return c.res;
  },
};

export const annulerMenageSiAnnulation: Regle = {
  cle: 'menage-annulation',
  nom: 'Ménage annulé avec la réservation',
  description:
    'Quand une réservation est annulée, alors la mission de ménage associée est annulée si elle n’a pas commencé, et le prestataire est libéré.',
  spec: '§2.4',
  domaine: 'reservations',
  declencheur: 'reservation',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const annulees = new Set(d.reservations.filter((r) => r.statut === 'annulee').map((r) => r.id));
    for (const m of d.missions) {
      if (m.type !== 'menage' || !m.reservationId || !annulees.has(m.reservationId)) continue;
      if (m.statut !== 'a_attribuer' && m.statut !== 'attribuee') continue;
      const l = logementById(d, m.logementId);
      c.modifier('missions', { ...m, statut: 'annulee' }, 'Ménage annulé (réservation annulée).');
      c.evenement('action', m.id, `Ménage du ${jourMois(m.date)} annulé à ${l?.nom ?? 'un logement'} : la réservation a été annulée.`, 'mission', m.id);
    }
    return c.res;
  },
};
