/**
 * Calculs financiers et opérationnels d'un bien sur une fenêtre de dates.
 *
 * Économie d'un bien pour Label Maison :
 *   CA     = commission (au % du mandat) + frais de ménage encaissés (départs)
 *   Coûts  = ménages validés payés aux prestataires (ménage, linge, contrôle)
 *          + charges affectées au bien
 *          + incidents à la charge de Label Maison (refacturable « aucun »)
 *          + quote-part des frais de structure (charges sans bien, réparties
 *            à parts égales entre logements actifs, au prorata des jours)
 *   Marge  = CA − Coûts
 * Les incidents refacturés au propriétaire, au voyageur ou au prestataire ne
 * pèsent pas sur la marge (ils sont suivis à part comme signaux de défaut).
 */
import { ajouterJours, debutMois, debutMoisSuivant, ecartJours } from '../data/format';
import {
  commissionLabelMaison,
  estActive,
  mandatDuLogement,
  nuitsDansFenetre,
  revenuBrut,
  revenuHebergement,
  type Fenetre,
} from '../data/selectors';
import type { ErpDonnees, Logement, Mission } from '../data/types';
import type { ContexteParc, Finances, MoisMarge } from './types';

/** Types de mission payés par Label Maison sur ses frais de ménage. */
const MISSIONS_MENAGE: ReadonlyArray<Mission['type']> = ['menage', 'linge', 'controle'];

/** Début effectif d'observation d'un bien : mandat et données disponibles. */
export function debutObservation(d: ErpDonnees, l: Logement, ctx: ContexteParc): string {
  const mandat = mandatDuLogement(d.mandats, l.id);
  const debutMandat = mandat?.dateDebut ?? ctx.debutDonnees;
  return debutMandat > ctx.debutDonnees ? debutMandat : ctx.debutDonnees;
}

/** Fenêtre bornée par le début d'observation (vide si le bien n'était pas géré). */
export function borner(f: Fenetre, debut: string): Fenetre {
  return { debut: f.debut > debut ? f.debut : debut, fin: f.fin };
}

export function finances(d: ErpDonnees, l: Logement, f: Fenetre, ctx: ContexteParc): Finances {
  const jours = Math.max(0, ecartJours(f.debut, f.fin));
  const resas = d.reservations.filter((r) => r.logementId === l.id);
  const actives = resas.filter(estActive);
  const nuits = actives.reduce((s, r) => s + nuitsDansFenetre(r, f), 0);
  const brut = revenuBrut(resas, f);
  const hebergement = actives.reduce(
    (s, r) => s + (r.nuits ? Math.round((revenuHebergement(r) * nuitsDansFenetre(r, f)) / r.nuits) : 0),
    0,
  );
  const commission = commissionLabelMaison(resas, d.mandats, f);
  const departs = actives.filter((r) => r.depart >= f.debut && r.depart < f.fin);
  const fraisMenage = departs.reduce((s, r) => s + r.fraisMenageCentimes, 0);
  const coutMenage = d.missions
    .filter((m) => m.logementId === l.id && m.statut === 'validee' && MISSIONS_MENAGE.includes(m.type) && m.date >= f.debut && m.date < f.fin)
    .reduce((s, m) => s + m.tarifCentimes, 0);
  const charges = d.charges
    .filter((c) => c.logementId === l.id && c.date >= f.debut && c.date < f.fin)
    .reduce((s, c) => s + c.montantCentimes, 0);
  const coutIncidents = d.incidents
    .filter((i) => i.logementId === l.id && i.refacturable === 'aucun' && i.date >= f.debut && i.date < f.fin)
    .reduce((s, i) => s + (i.coutCentimes ?? 0), 0);
  const structure = Math.round(ctx.structureParJour * jours);
  const ca = commission + fraisMenage;
  return {
    jours,
    nuits,
    revenuBrut: brut,
    revenuHebergement: hebergement,
    commission,
    fraisMenage,
    ca,
    coutMenage,
    charges,
    coutIncidents,
    structure,
    marge: ca - coutMenage - charges - coutIncidents - structure,
    sejours: departs.length,
  };
}

/** Marge mois par mois sur les 12 derniers mois (mois en cours inclus, partiel). */
export function margesMensuelles(d: ErpDonnees, l: Logement, date: string, ctx: ContexteParc): MoisMarge[] {
  const debut = debutObservation(d, l, ctx);
  const mois: MoisMarge[] = [];
  let curseur = debutMois(ajouterJours(debutMois(date), -330));
  for (let i = 0; i < 12; i++) {
    const suivant = debutMoisSuivant(curseur);
    const fin = suivant > date ? ajouterJours(date, 1) : suivant;
    const f = borner({ debut: curseur, fin }, debut);
    const avecDonnees = f.debut < f.fin;
    const fi = avecDonnees ? finances(d, l, f, ctx) : undefined;
    mois.push({
      mois: curseur.slice(0, 7),
      ca: fi?.ca ?? 0,
      couts: fi ? fi.ca - fi.marge : 0,
      marge: fi?.marge ?? 0,
      avecDonnees,
      partiel: suivant > date,
    });
    curseur = suivant;
  }
  return mois;
}

/** Délai moyen de réponse (minutes) aux messages voyageurs d'un bien. */
export function delaiReponseMoyen(d: ErpDonnees, logementId: string): number | undefined {
  const delais: number[] = [];
  for (const fil of d.filsMessages.filter((f) => f.logementId === logementId)) {
    const tries = [...fil.messages].sort((a, b) => a.envoyeLe.localeCompare(b.envoyeLe));
    for (let i = 0; i < tries.length; i++) {
      if (tries[i].auteur !== 'voyageur' || (i > 0 && tries[i - 1].auteur === 'voyageur')) continue;
      const reponse = tries.slice(i + 1).find((m) => m.auteur !== 'voyageur');
      if (reponse) delais.push((Date.parse(reponse.envoyeLe) - Date.parse(tries[i].envoyeLe)) / 60_000);
    }
  }
  return delais.length ? delais.reduce((s, x) => s + x, 0) / delais.length : undefined;
}

export function mediane(valeurs: number[]): number {
  if (!valeurs.length) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}
