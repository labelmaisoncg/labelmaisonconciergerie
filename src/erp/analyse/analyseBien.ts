/**
 * Analyse d'un bien : indicateurs interprétés, rentabilité, défauts,
 * recommandation (garder, développer, surveiller, renégocier, sortir) et
 * améliorations à proposer au propriétaire. Fonction pure (SPEC §10).
 *
 * ─────────────────────────────────────────────── LOGIQUE DE DÉCISION
 * Évaluée dans cet ordre, la première condition vraie l'emporte :
 * 1. SORTIR     si un point de conformité bloque la location (n° manquant,
 *               DPE G), OU 3 mois consécutifs de marge négative ET note < 4,5,
 *               OU marge négative sur 90 j avec 3 défauts graves ou plus.
 * 2. RENÉGOCIER si la marge est fragile (< 250 €/mois ou < 35 % du CA) ET
 *               qu'un levier contractuel existe : commission < 18 % ou frais
 *               de ménage qui ne couvrent pas le coût du ménage.
 * 3. DÉVELOPPER si rentable ET note ≥ 4,8 ET occupation ≥ 70 % ET aucun
 *               défaut grave ET au plus un défaut moyen.
 * 4. SURVEILLER si non rentable, OU au moins un défaut grave, OU au moins
 *               deux défauts moyens.
 * 5. GARDER     sinon.
 * Un bien avec moins de 30 jours de données est « à surveiller ».
 * ─────────────────────────────────────────────────────────────────────
 */
import { euros, nombre, pourcentage } from '../data/format';
import { fenetreJours, mandatDuLogement, nuitsAnnee, aPhotosAvantApres } from '../data/selectors';
import type { DateISO, ErpDonnees, Id } from '../data/types';
import { suggererAmeliorations } from './ameliorations';
import { borner, debutObservation, delaiReponseMoyen, finances, margesMensuelles } from './calculs';
import { contexteParc } from './contexte';
import { detecterDefauts, plaintesParTheme, type Mesures } from './defauts';
import { interpreter, scoreDpe, SEUILS, type CleKpi } from './seuils';
import type { AnalyseBien, KpiBien, Recommandation } from './types';

const JOURS_MINIMUM = 30;

function kpi(cle: CleKpi, valeur: number | undefined, detail?: string, affichage?: string): KpiBien {
  const s = SEUILS[cle];
  if (valeur === undefined || !Number.isFinite(valeur)) {
    return { cle, libelle: s.libelle, affichage: '-', detail: detail ?? 'Pas assez de données', explication: s.description };
  }
  const { niveau, explication } = interpreter(cle, valeur);
  return { cle, libelle: s.libelle, valeur, affichage: affichage ?? s.formater(valeur), detail, niveau, explication };
}

export function analyserBien(d: ErpDonnees, logementId: Id, date: DateISO): AnalyseBien {
  const l = d.logements.find((x) => x.id === logementId);
  if (!l) throw new Error(`Logement inconnu : ${logementId}`);
  const ctx = contexteParc(d, date);
  const debut = debutObservation(d, l, ctx);
  const w90 = borner(fenetreJours(90, date), debut);
  const w12 = borner(fenetreJours(365, date), debut);
  const f90 = finances(d, l, w90, ctx);
  const f12 = finances(d, l, w12, ctx);
  const aDonnees = f90.jours >= JOURS_MINIMUM;
  const mandat = mandatDuLogement(d.mandats, l.id);

  const occupation90 = f90.jours ? f90.nuits / f90.jours : 0;
  const adr90 = f90.nuits ? Math.round(f90.revenuHebergement / f90.nuits) : 0;
  const revpar90 = f90.jours ? Math.round(f90.revenuHebergement / f90.jours) : 0;
  const parMois = (c: number) => (f90.jours ? Math.round((c * 30) / f90.jours) : 0);
  const margeMois = parMois(f90.marge);
  const margePct = f90.ca > 0 ? f90.marge / f90.ca : undefined;

  const resas12 = d.reservations.filter((r) => r.logementId === l.id && r.statut !== 'annulee' && r.depart >= w12.debut && r.depart < w12.fin);
  const notes = resas12.filter((r) => r.noteVoyageur !== undefined).map((r) => r.noteVoyageur!);
  const note12 = notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : undefined;
  const incidents12 = d.incidents.filter((i) => i.logementId === l.id && i.date >= w12.debut && i.date <= date);
  const missions12 = d.missions.filter((m) => m.logementId === l.id && m.date >= w12.debut && m.date < date && m.statut !== 'annulee');
  const menages12 = missions12.filter((m) => m.type === 'menage' && m.statut === 'validee');
  const coutMenageMoyen = menages12.length ? menages12.reduce((s, m) => s + m.tarifCentimes, 0) / menages12.length : undefined;
  const couvertureMenage = mandat && coutMenageMoyen ? mandat.fraisMenageCentimes / coutMenageMoyen : undefined;
  const pertesLinge12 = d.mouvementsLinge
    .filter((m) => m.logementId === l.id && (m.type === 'perte' || m.type === 'rebut') && m.date >= w12.debut)
    .reduce((s, m) => s + m.articles.reduce((t, a) => t + a.quantite, 0), 0);
  const menages90 = d.missions.filter((m) => m.logementId === l.id && m.type === 'menage' && m.statut !== 'annulee' && m.date >= w90.debut && m.date < date);
  const tauxPhotos = menages90.length ? menages90.filter((m) => m.statut === 'validee' && aPhotosAvantApres(m)).length / menages90.length : undefined;
  const interventions12 = {
    missions: missions12.filter((m) => m.type === 'maintenance').length,
    incidents: incidents12.length,
    controles: missions12.filter((m) => m.type === 'controle' || m.controleQualite).length,
  };
  const par30Nuits = (n: number) => (f12.nuits ? (n * 30) / f12.nuits : undefined);
  const chargeOps = par30Nuits(interventions12.missions + interventions12.incidents + interventions12.controles);
  const delaiReponse = delaiReponseMoyen(d, l.id);
  const annee = l.residencePrincipale ? nuitsAnnee(d.reservations, l.id, Number(date.slice(0, 4))).nuits : undefined;

  const mois = margesMensuelles(d, l, date, ctx);
  let moisNegatifsConsecutifs = 0;
  for (const m of [...mois].reverse()) {
    if (m.partiel || !m.avecDonnees) continue;
    if (m.marge < 0) moisNegatifsConsecutifs += 1;
    else break;
  }

  const mesures: Mesures = {
    logement: l,
    occupation90,
    medianeOccupation: ctx.medianeOccupation,
    ratioAdr: ctx.medianeAdr ? adr90 / ctx.medianeAdr : 1,
    ratioRevpar: ctx.medianeRevpar ? revpar90 / ctx.medianeRevpar : 1,
    note12,
    nbAvis12: notes.length,
    plaintes: plaintesParTheme(resas12),
    incidents12,
    pertesLinge12,
    commissionPct: mandat?.commissionPct,
    couvertureMenage,
    coutMenageMoyen,
    fraisMenageMandat: mandat?.fraisMenageCentimes,
    nuitsAnnee: annee,
    margeMois,
    marge90: f90.marge,
    moisNegatifsConsecutifs,
    tauxPhotos,
    delaiReponse,
    aDonnees,
  };
  const defauts = detecterDefauts(mesures);

  const kpis: KpiBien[] = [
    kpi('margeMois', aDonnees ? margeMois : undefined, `CA ${euros(parMois(f90.ca), true)} / mois`),
    kpi('margePct', aDonnees ? margePct : undefined),
    kpi('occupation', aDonnees ? occupation90 : undefined, `${nombre(f90.nuits)} nuits sur ${f90.jours} jours`),
    kpi('adr', aDonnees && f90.nuits ? mesures.ratioAdr : undefined, `médiane du parc ${euros(ctx.medianeAdr, true)}`, euros(adr90, true)),
    kpi('revpar', aDonnees ? mesures.ratioRevpar : undefined, `médiane du parc ${euros(ctx.medianeRevpar, true)}`, euros(revpar90, true)),
    kpi('note', note12, `${notes.length} avis sur 12 mois`),
    kpi('commission', mandat?.commissionPct, mandat ? `mandat ${mandat.reference}` : 'aucun mandat'),
    kpi('couvertureMenage', couvertureMenage, mandat && coutMenageMoyen ? `${euros(mandat.fraisMenageCentimes, true)} facturés, ${euros(Math.round(coutMenageMoyen), true)} payés` : undefined),
    kpi('incidents', par30Nuits(incidents12.length), `${incidents12.length} incident${incidents12.length > 1 ? 's' : ''} sur 12 mois`),
    kpi('chargeOps', chargeOps, `${interventions12.incidents} incidents, ${interventions12.missions} maintenances, ${interventions12.controles} contrôles`),
    kpi('menagesPhotos', tauxPhotos, `${menages90.length} ménages sur 90 jours`),
    kpi('delaiReponse', delaiReponse),
    ...(annee !== undefined ? [kpi('nuitsRestantes', 120 - annee, `${annee} nuits vendues en ${date.slice(0, 4)}`)] : []),
    kpi('dpe', scoreDpe(l.dpe), l.dpe ? undefined : 'DPE non renseigné'),
  ];

  const rentable = aDonnees && margeMois > 0;
  const verdictRentabilite = !aDonnees
    ? `Pas encore assez de recul : ${f90.jours} jour${f90.jours > 1 ? 's' : ''} de données.`
    : rentable
      ? `Rentable pour Label Maison : ${euros(margeMois, true)} de marge par mois.`
      : `Non rentable pour Label Maison : le bien coûte ${euros(-margeMois, true)} par mois.`;

  const { recommandation, justification } = l.statut === 'lancement'
    ? { recommandation: 'surveiller' as const, justification: ['Bien en lancement : les points manquants se règlent dans la checklist de lancement, l’analyse démarre après 30 jours en ligne.'] }
    : l.statut === 'sorti'
      ? { recommandation: 'sortir' as const, justification: ['Bien sorti du parc : analyse conservée pour mémoire.'] }
      : decider({ aDonnees, rentable, margeMois, margePct, note12, occupation90, moisNegatifsConsecutifs, defauts, joursDonnees: f90.jours });

  const ameliorations = suggererAmeliorations({
    logement: l,
    defauts,
    mesures,
    f90,
    revenuMois: parMois(f90.revenuBrut),
    sejoursMois: f90.jours ? (f90.sejours * 30) / f90.jours : 0,
    baseMois: mandat && mandat.commissionPct ? (parMois(f90.commission) * 100) / mandat.commissionPct : 0,
    medianeOccupation: ctx.medianeOccupation,
  });

  return {
    logement: l, date, f90, f12, occupation90, adr90, revpar90, note12, nbAvis12: notes.length, margeMois, margePct,
    margeParNuit: f90.nuits ? Math.round(f90.marge / f90.nuits) : undefined,
    commissionPct: mandat?.commissionPct, interventions12, kpis, mois, rentable, verdictRentabilite, defauts,
    recommandation, justification, ameliorations,
  };
}

interface EntreeDecision {
  aDonnees: boolean;
  rentable: boolean;
  margeMois: number;
  margePct?: number;
  note12?: number;
  occupation90: number;
  moisNegatifsConsecutifs: number;
  defauts: AnalyseBien['defauts'];
  joursDonnees: number;
}

/** Applique la logique de décision documentée en tête de fichier. */
export function decider(e: EntreeDecision): { recommandation: Recommandation; justification: string[] } {
  const codes = new Set(e.defauts.map((x) => x.code));
  const hautes = e.defauts.filter((x) => x.gravite === 'haute');
  const moyennes = e.defauts.filter((x) => x.gravite === 'moyenne');
  const j: string[] = [];
  const note = e.note12;

  const bloquant = e.defauts.filter((x) => x.code === 'numero_manquant' || (x.code === 'dpe' && x.titre.endsWith('G')));
  if (bloquant.length) {
    return { recommandation: 'sortir', justification: [...bloquant.map((x) => `${x.titre} : ${x.detail}`), 'La location ne peut pas continuer en l’état.'] };
  }
  if (!e.aDonnees) {
    return { recommandation: 'surveiller', justification: [`Seulement ${e.joursDonnees} jours de données : verdict dans ${JOURS_MINIMUM - e.joursDonnees} jours.`] };
  }
  const pertesDurables = e.moisNegatifsConsecutifs >= 3 && note !== undefined && note < 4.5;
  if (pertesDurables || (!e.rentable && hautes.length >= 3)) {
    if (pertesDurables) j.push(`${e.moisNegatifsConsecutifs} mois consécutifs de marge négative.`, `Note de ${nombre(note!, 2)}, sous 4,5 : le bien abîme la réputation de Label Maison.`);
    else j.push(`Marge négative (${euros(e.margeMois, true)} par mois) et ${hautes.length} défauts graves.`);
    j.push('Proposer au propriétaire un plan de travaux ; sans engagement, ne pas renouveler le mandat.');
    return { recommandation: 'sortir', justification: j };
  }
  const fragile = e.margeMois < SEUILS.margeMois.bon || (e.margePct ?? 0) < SEUILS.margePct.bon;
  const leviers = e.defauts.filter((x) => x.code === 'commission_basse' || x.code === 'menage_sous_facture');
  if (fragile && leviers.length) {
    j.push(`Marge fragile : ${euros(e.margeMois, true)} par mois${e.margePct !== undefined ? `, ${pourcentage(e.margePct)} du CA` : ''}.`);
    for (const x of leviers) j.push(`${x.titre} : ${x.detail}`);
    j.push('Renégocier au renouvellement du mandat plutôt que sortir : le bien tourne.');
    return { recommandation: 'renegocier', justification: j };
  }
  if (e.rentable && note !== undefined && note >= 4.8 && e.occupation90 >= 0.7 && !hautes.length && moyennes.length <= 1) {
    j.push(`Rentable : ${euros(e.margeMois, true)} de marge par mois.`, `Note ${nombre(note, 2)} et occupation ${pourcentage(e.occupation90)}.`);
    j.push('Bien vitrine : demander au propriétaire un parrainage, proposer une montée en gamme.');
    return { recommandation: 'developper', justification: j };
  }
  if (!e.rentable || hautes.length || moyennes.length >= 2) {
    if (!e.rentable) j.push(`Non rentable : ${euros(e.margeMois, true)} par mois.`);
    for (const x of [...hautes, ...moyennes].slice(0, 3)) j.push(`${x.titre} : ${x.detail}`);
    j.push('Revoir le bien dans 30 jours avec les améliorations engagées.');
    return { recommandation: 'surveiller', justification: j };
  }
  j.push(`Rentable : ${euros(e.margeMois, true)} de marge par mois.`);
  if (note !== undefined) j.push(`Note ${nombre(note, 2)}, occupation ${pourcentage(e.occupation90)}.`);
  if (codes.size) j.push(`${codes.size} point${codes.size > 1 ? 's' : ''} d’amélioration mineur${codes.size > 1 ? 's' : ''}.`);
  return { recommandation: 'garder', justification: j };
}
