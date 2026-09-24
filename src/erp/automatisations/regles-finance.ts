/**
 * Règles financières : paiements prestataires, retards, facturation mensuelle (SPEC §2.4, §2.7).
 */
import { ajouterJours, euros, jourMois, moisAnnee } from '../data/format';
import { mandatDuLogement, releveProprietaire } from '../data/selectors';
import type { Facture, Id, Mission, PaiementPrestataire } from '../data/types';
import { collecteur, moisPrecedent, moisSuivant } from './outils';
import type { Regle } from './types';

/** Premier mois facturé automatiquement. */
const PREMIER_MOIS = '2026-06';

const memes = (a: Id[], b: Id[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Tri stable des ids de missions : par date puis par id. */
function parId(missions: Mission[]) {
  const dates = new Map(missions.map((m) => [m.id, m.date]));
  return (a: Id, b: Id) => (dates.get(a) ?? '').localeCompare(dates.get(b) ?? '') || a.localeCompare(b);
}

export const paiementsPrestataires: Regle = {
  cle: 'paiement-prestataire',
  nom: 'Paiement des missions validées',
  description:
    'Quand une mission est validée, alors elle est ajoutée au paiement du prestataire pour son mois. Les missions non validées n’y entrent pas : pas de validation, pas de paiement.',
  spec: '§2.4',
  domaine: 'finance',
  declencheur: 'mission',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const courant = ctx.date.slice(0, 7);
    const ouvertes = [moisPrecedent(courant), courant];
    const groupes = new Map<string, Mission[]>();
    for (const m of d.missions) {
      if (m.statut !== 'validee' || !m.prestataireId || m.tarifCentimes <= 0) continue;
      const periode = m.date.slice(0, 7);
      if (!ouvertes.includes(periode)) continue;
      const cle = `${m.prestataireId}|${periode}`;
      groupes.set(cle, [...(groupes.get(cle) ?? []), m]);
    }
    for (const [cle, missions] of groupes) {
      const [prestataireId, periode] = cle.split('|');
      const p = d.prestataires.find((x) => x.id === prestataireId);
      const ids = missions.map((m) => m.id).sort(parId(d.missions));
      const montant = missions.reduce((s, m) => s + m.tarifCentimes, 0);
      const existant = d.paiementsPrestataires.find((x) => x.prestataireId === prestataireId && x.periode === periode);
      if (existant?.statut === 'paye') continue;
      if (existant) {
        if (memes(ids, [...existant.missions].sort(parId(d.missions))) && existant.montantCentimes === montant) continue;
        c.modifier('paiementsPrestataires', { ...existant, missions: ids, montantCentimes: montant }, `Paiement mis à jour : ${euros(montant)}.`);
        c.evenement('action', `${existant.id}:${ids.length}:${montant}`,
          `Paiement de ${p?.nom ?? prestataireId} (${moisAnnee(periode)}) mis à jour : ${ids.length} missions, ${euros(montant)}.`, 'paiement', existant.id);
        continue;
      }
      const id = `auto-pay-${prestataireId.replace(/^pre-/, '')}-${periode}`;
      const refusees = d.missions.filter((m) => m.prestataireId === prestataireId && m.statut === 'refusee' && m.date.startsWith(periode));
      const paiement: PaiementPrestataire = {
        id, prestataireId, periode, missions: ids, montantCentimes: montant,
        retenueCentimes: refusees.reduce((s, m) => s + m.tarifCentimes, 0),
        motifRetenue: refusees.length ? 'Mission refusée au contrôle : pas de validation, pas de paiement.' : undefined,
        statut: p?.statut === 'actif' ? 'a_payer' : 'bloque',
      };
      c.creer('paiementsPrestataires', paiement, `Paiement ${moisAnnee(periode)} ouvert.`);
      c.evenement('action', `${id}:${ids.length}:${montant}`,
        `Paiement de ${p?.nom ?? prestataireId} (${moisAnnee(periode)}) préparé : ${ids.length} missions, ${euros(montant)}.`, 'paiement', id);
    }
    return c.res;
  },
};

export const relanceFactures: Regle = {
  cle: 'relance-factures',
  nom: 'Relance des factures en retard',
  description: 'Quand une facture émise dépasse son échéance, alors elle passe « en retard » et une relance automatique est envoyée au propriétaire.',
  spec: '§2.7',
  domaine: 'finance',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    for (const f of d.factures) {
      if (f.statut !== 'emise' || f.echeance >= ctx.date) continue;
      const pro = d.proprietaires.find((p) => p.id === f.proprietaireId);
      c.modifier('factures', { ...f, statut: 'en_retard' }, 'Échéance dépassée.');
      c.evenement('action', `retard:${f.id}`,
        `Facture ${f.numero} en retard (échéance ${jourMois(f.echeance)}) : relance automatique envoyée${pro ? ` à ${pro.nom}` : ''}.`, 'facture', f.id);
    }
    return c.res;
  },
};

export const facturationMensuelle: Regle = {
  cle: 'facturation-mensuelle',
  nom: 'Facture de commission et relevé mensuel',
  description:
    'Quand un mois se termine, alors la facture de commission de chaque propriétaire est générée (une ligne par logement) et son relevé mensuel est prêt à envoyer.',
  spec: '§2.7',
  domaine: 'finance',
  declencheur: 'mensuel',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const precedent = moisPrecedent(ctx.date.slice(0, 7));
    for (let periode = PREMIER_MOIS; periode <= precedent; periode = moisSuivant(periode)) {
      for (const pro of d.proprietaires) {
        const court = pro.id.replace(/^pro-/, '').toUpperCase();
        const id = `auto-fac-${pro.id}-${periode}`;
        const suivant = moisSuivant(periode);
        const existe = d.factures.some(
          (f) => f.id === id || (f.type === 'commission' && f.proprietaireId === pro.id && f.dateEmission.startsWith(suivant)),
        );
        const releve = releveProprietaire(d, pro.id, periode);
        if (!releve.lignes.length) continue;
        if (periode === precedent) {
          c.evenement('info', `releve:${pro.id}:${periode}`,
            `Relevé de ${moisAnnee(periode)} prêt pour ${pro.nom} : net ${euros(releve.totaux.net)}, commission ${euros(releve.totaux.commission)}.`, 'proprietaire', pro.id);
        }
        if (existe || releve.totaux.commission <= 0) continue;
        const parLogement = new Map<string, typeof releve.lignes>();
        for (const l of releve.lignes) parLogement.set(l.logement.id, [...(parLogement.get(l.logement.id) ?? []), l]);
        const lignes: Facture['lignes'] = [...parLogement.values()].map((ls) => {
          const pct = mandatDuLogement(d.mandats, ls[0].logement.id)?.commissionPct ?? 0;
          return {
            libelle: `Commission de gestion ${pct} % · ${ls[0].logement.nom} (${ls.length} séjours)`,
            quantite: 1,
            puCentimes: ls.reduce((s, x) => s + x.commission, 0),
          };
        });
        const cinq = `${suivant}-05`;
        const emission = cinq <= ctx.date ? cinq : ctx.date;
        c.creer('factures', {
          id, numero: `LM-${periode}-${court}`, type: 'commission', destinataire: 'proprietaire', proprietaireId: pro.id,
          dateEmission: emission, echeance: ajouterJours(emission, 15),
          montantHtCentimes: lignes.reduce((s, l) => s + l.quantite * l.puCentimes, 0), tvaPct: 20, statut: 'emise', lignes,
        }, `Facture de commission ${moisAnnee(periode)}.`);
        c.evenement('action', id, `Facture de commission LM-${periode}-${court} générée pour ${pro.nom} (${euros(releve.totaux.commission)} HT).`, 'facture', id);
      }
    }
    return c.res;
  },
};
