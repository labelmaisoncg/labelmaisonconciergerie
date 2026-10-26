// =============================================================================
// Relances de paiement des factures partagées (espace propriétaire, phase 2).
//
// - passageRelances : passage quotidien d'un espace (api/erp-repull-sync.ts,
//   chaque espace actif) ; crée les relances dues, ferme celles devenues sans
//   objet et, en mode « automatique » seulement, les envoie.
// - envoyerRelance / annulerRelance : décision d'un gérant de l'espace.
//
// Tout se passe dans la base de l'espace (api/_acces-externe.ts : baseAcces) :
// factures, relances et réglages d'un espace ne croisent jamais ceux d'un
// autre. Envoi avec l'expéditeur de l'espace seulement ; sans expéditeur, la
// relance reste à valider (le gérant peut appeler ou écrire lui-même).
// Pour ne jamais envoyer deux fois, la relance est notée « envoyée » AVANT
// l'envoi, et remise « à valider » si l'envoi échoue.
//
// Règles pures : src/erp/data/relances.ts. Un fichier préfixé par « _ »
// n'est pas exposé comme route par Vercel.
// =============================================================================

import {
  COLLECTION_REGLAGES_RELANCES,
  COLLECTION_RELANCES,
  messageRelance,
  planifierRelances,
  reglagesRelances,
  relanceEnvoyable,
} from '../src/erp/data/relances.js';
import { espaceDe } from '../src/erp/data/acces-externe.js';
import { dateParisISO } from '../src/erp/data/proprietaire.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { Facture, Proprietaire } from '../src/erp/data/types';
import type { AccesProprietaire, RelancePaiement, ReglagesRelances } from '../src/erp/data/types-proprietaire';
import { GENRES, SITE_PAR_DEFAUT, baseAcces, envoyerEmailEspace, expediteurEspace } from './_acces-externe.js';
import { espacesActifs, type FicheEspace } from './_erp-espaces.js';

const AUTEUR = 'relances-paiement';

export async function lireReglagesRelances(base: BaseErp): Promise<ReglagesRelances> {
  const [r] = await base.lire<ReglagesRelances>(COLLECTION_REGLAGES_RELANCES, ['relances']);
  return reglagesRelances(r);
}

export async function ecrireReglagesRelances(base: BaseErp, brut: Partial<ReglagesRelances>, par: string): Promise<ReglagesRelances> {
  const r = { ...reglagesRelances(brut), majLe: new Date().toISOString(), majPar: par };
  await base.ecrire(COLLECTION_REGLAGES_RELANCES, [r], AUTEUR);
  return r;
}

export const lireRelances = (base: BaseErp): Promise<RelancePaiement[]> => base.lire<RelancePaiement>(COLLECTION_RELANCES);

/** Adresse du propriétaire : celle de son accès à l'espace, sinon celle de sa fiche. */
async function destinataire(base: BaseErp, p: Proprietaire): Promise<string | undefined> {
  const [acces] = await base.lire<AccesProprietaire>(GENRES.proprietaire.collection, [p.id]).catch(() => []);
  const email = (acces && acces.statut !== 'retire' ? acces.email : '') || p.contact?.email || '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? email.trim().toLowerCase() : undefined;
}

type Envoi = { ok: true; relance: RelancePaiement } | { ok: false; relance?: RelancePaiement; erreur: string };

/**
 * Envoi d'une relance encore à valider. `par` : « automatique » (passage
 * quotidien) ou l'adresse du gérant. Jamais deux fois : notée envoyée avant
 * l'envoi, remise à valider (avec le motif) si l'envoi n'a pas pu se faire.
 */
async function envoyer(base: BaseErp, fiche: FicheEspace | undefined, r: RelancePaiement, f: Facture, jours: number[], par: string): Promise<Envoi> {
  if (!relanceEnvoyable(r, f)) return { ok: false, relance: r, erreur: 'Cette relance n’est plus à envoyer (facture payée, relance déjà envoyée ou annulée).' };
  const [p] = await base.lire<Proprietaire>('proprietaires', [r.proprietaireId]);
  const motif = (m: RelancePaiement['motif'], erreur: string): Envoi => ({ ok: false, relance: { ...r, motif: m }, erreur });
  if (!expediteurEspace(fiche)) {
    const res = motif('sans_expediteur', 'Pas d’expéditeur d’e-mails pour cet espace : relancez le propriétaire par téléphone ou par votre messagerie.');
    await base.ecrire(COLLECTION_RELANCES, [res.relance!], AUTEUR);
    return res;
  }
  const email = p ? await destinataire(base, p) : undefined;
  if (!p || !email) {
    const res = motif('sans_adresse', 'Pas d’adresse e-mail pour ce propriétaire.');
    await base.ecrire(COLLECTION_RELANCES, [res.relance!], AUTEUR);
    return res;
  }
  const envoyee: RelancePaiement = { ...r, statut: 'envoyee', envoyeeLe: new Date().toISOString(), envoyeePar: par, destinataire: email };
  delete envoyee.motif;
  await base.ecrire(COLLECTION_RELANCES, [envoyee], AUTEUR);
  const m = messageRelance({
    relance: r,
    dernier: r.niveau >= jours.length,
    facture: f,
    proprietaire: p,
    conciergerie: fiche?.nom || 'Label Maison',
    lienEspace: `${SITE_PAR_DEFAUT}${GENRES.proprietaire.page}`,
  });
  if (await envoyerEmailEspace(fiche, { to: email, sujet: m.sujet, html: m.html, text: m.texte })) return { ok: true, relance: envoyee };
  const echec: RelancePaiement = { ...r, motif: 'echec_envoi' };
  await base.ecrire(COLLECTION_RELANCES, [echec], AUTEUR);
  return { ok: false, relance: echec, erreur: 'L’e-mail n’a pas pu partir. Réessayez dans un instant.' };
}

export interface BilanRelances {
  creees: number;
  envoyees: number;
  aValider: number;
  sansObjet: number;
}

/** Passage quotidien d'un espace : créer, fermer, et envoyer en mode automatique seulement. */
export async function passageRelances(fiche: FicheEspace, o: { aujourdhui?: string; maintenant?: string } = {}): Promise<BilanRelances> {
  const espace = espaceDe(fiche.id);
  const base = baseAcces(espace);
  const [factures, relances, reglages] = await Promise.all([base.lire<Facture>('factures'), lireRelances(base), lireReglagesRelances(base)]);
  const plan = planifierRelances({
    factures,
    relances,
    reglages,
    aujourdhui: o.aujourdhui ?? dateParisISO(),
    maintenant: o.maintenant ?? new Date().toISOString(),
    espace,
  });
  const ecrites = [...plan.modifiees, ...plan.nouvelles];
  if (ecrites.length) await base.ecrire(COLLECTION_RELANCES, ecrites, AUTEUR);
  const bilan: BilanRelances = {
    creees: plan.nouvelles.length,
    envoyees: 0,
    aValider: 0,
    sansObjet: plan.modifiees.filter((r) => r.statut === 'sans_objet').length,
  };
  for (const r of plan.nouvelles) {
    const f = factures.find((x) => x.id === r.factureId)!;
    if (reglages.mode === 'automatique' && (await envoyer(base, fiche, r, f, reglages.jours, 'automatique')).ok) bilan.envoyees += 1;
    else bilan.aValider += 1;
  }
  return bilan;
}

/** Envoi validé par un gérant de l'espace. */
export async function envoyerRelance(fiche: FicheEspace | undefined, espace: string, id: string, par: string): Promise<Envoi> {
  const base = baseAcces(espace);
  const [r] = await base.lire<RelancePaiement>(COLLECTION_RELANCES, [id]);
  if (!r) return { ok: false, erreur: 'Relance introuvable.' };
  const [[f], reglages] = await Promise.all([base.lire<Facture>('factures', [r.factureId]), lireReglagesRelances(base)]);
  return envoyer(base, fiche, r, f, reglages.jours, par);
}

/** Annulation par un gérant (une relance à valider seulement). */
export async function annulerRelance(espace: string, id: string, par: string): Promise<Envoi> {
  const base = baseAcces(espace);
  const [r] = await base.lire<RelancePaiement>(COLLECTION_RELANCES, [id]);
  if (!r) return { ok: false, erreur: 'Relance introuvable.' };
  if (r.statut !== 'proposee') return { ok: false, relance: r, erreur: 'Seule une relance à valider peut être annulée.' };
  const annulee: RelancePaiement = { ...r, statut: 'annulee', annuleeLe: new Date().toISOString(), annuleePar: par };
  await base.ecrire(COLLECTION_RELANCES, [annulee], AUTEUR);
  return { ok: true, relance: annulee };
}

/**
 * Relances de chaque espace actif (base d'avant les espaces : Label Maison
 * seul), pendant le passage quotidien. Un espace en échec n'arrête pas les
 * autres ni la synchronisation : rien n'est jamais levé.
 */
export async function relancesDuJour(): Promise<Record<string, BilanRelances | string>> {
  const res: Record<string, BilanRelances | string> = {};
  let espaces: FicheEspace[] = [];
  try {
    espaces = await espacesActifs();
  } catch (e) {
    console.error('[relances] espaces illisibles', e instanceof Error ? e.message : e);
    return res;
  }
  for (const fiche of espaces) {
    try {
      res[fiche.code] = await passageRelances(fiche);
    } catch (e) {
      res[fiche.code] = e instanceof Error ? e.message : String(e);
      console.error('[relances]', fiche.code, res[fiche.code]);
    }
  }
  return res;
}
