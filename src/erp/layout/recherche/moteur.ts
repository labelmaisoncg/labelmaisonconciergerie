/**
 * Moteur de la recherche globale (palette Ctrl/Cmd + K).
 *
 * - Un index est construit une fois par version des données (useMemo) : pour
 *   chaque élément, un texte « botte de foin » déjà normalisé (sans accents ni
 *   casse) qui contient aussi les éléments liés (ville du logement, nom du
 *   propriétaire...) et plusieurs écritures des dates, montants et numéros.
 * - La requête est découpée en mots : tous doivent être trouvés (« dupont
 *   evry » trouve le propriétaire Dupont qui a un logement à Évry).
 * - Classement : titre identique > titre qui commence par > mot du titre qui
 *   commence par > ailleurs ; puis, pour les réservations et missions, les
 *   dates les plus proches d'aujourd'hui d'abord.
 *
 * Pur (aucun React) : testable et rapide sur des milliers d'éléments.
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LIBELLES } from '../../data/libelles';
import { AUJOURDHUI, dateCourte, ecartJours, euros } from '../../data/format';
import { montantTtc } from '../../data/selectors';
import type { ErpDonnees, Logement } from '../../data/types';

export type TypeResultat =
  | 'logement'
  | 'proprietaire'
  | 'reservation'
  | 'conversation'
  | 'mission'
  | 'prestataire'
  | 'incident'
  | 'facture'
  | 'mandat'
  | 'prospect'
  | 'journal';

export interface ElementIndex {
  type: TypeResultat;
  id: string;
  titre: string;
  detail: string;
  to: string;
  /** Titre normalisé. */
  titreN: string;
  /** Tout le texte cherchable, normalisé, mots séparés par une espace. */
  texte: string;
  /** Écart absolu en jours avec aujourd'hui (réservations, missions...). */
  proximite?: number;
}

export interface GroupeType {
  type: TypeResultat;
  libelle: string;
  /** Page de liste qui sait lire `?q=` (sinon « Voir tout » déplie dans la palette). */
  liste?: (q: string) => string;
}

export const GROUPES_RECHERCHE: GroupeType[] = [
  { type: 'reservation', libelle: 'Réservations', liste: (q) => `/erp/reservations?vue=liste&q=${encodeURIComponent(q)}` },
  { type: 'logement', libelle: 'Logements' },
  { type: 'proprietaire', libelle: 'Propriétaires', liste: (q) => `/erp/proprietaires?q=${encodeURIComponent(q)}` },
  { type: 'conversation', libelle: 'Conversations', liste: (q) => `/erp/messagerie?q=${encodeURIComponent(q)}` },
  { type: 'mission', libelle: 'Ménages', liste: (q) => `/erp/menages?vue=toutes&q=${encodeURIComponent(q)}` },
  { type: 'incident', libelle: 'Incidents', liste: (q) => `/erp/incidents?q=${encodeURIComponent(q)}` },
  { type: 'prestataire', libelle: 'Prestataires', liste: (q) => `/erp/prestataires?q=${encodeURIComponent(q)}` },
  { type: 'facture', libelle: 'Factures', liste: (q) => `/erp/finance/factures?q=${encodeURIComponent(q)}` },
  { type: 'mandat', libelle: 'Contrats de gestion', liste: (q) => `/erp/mandats?q=${encodeURIComponent(q)}` },
  { type: 'prospect', libelle: 'Prospects', liste: (q) => `/erp/commercial?q=${encodeURIComponent(q)}` },
  { type: 'journal', libelle: 'Historique' },
];

/* ------------------------------------------------------------ normalisation */

/** Un caractère normalisé par caractère d'origine : les positions se correspondent (surlignage). */
export function normaliserAligne(s: string): string {
  let r = '';
  for (const c of s) {
    const n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // Garder une longueur identique (les caractères hors BMP comptent pour 2).
    const cible = c.length;
    r += (n || ' ').slice(0, cible).padEnd(cible, ' ');
  }
  return r;
}

/** Normalisation de recherche : sans accents, minuscules, espaces simples. */
export function normaliser(s: string): string {
  return normaliserAligne(s).replace(/[’'`]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Mots de la requête (le signe € et « eur » ne servent pas à trouver). */
export function motsRequete(q: string): string[] {
  return normaliser(q)
    .split(' ')
    .map((m) => m.replace(/^[(«"]+|[)»",;:!?]+$/g, ''))
    .filter((m) => m && m !== '€' && m !== 'eur' && m !== 'euros' && m !== '-');
}

/* ---------------------------------------------------- écritures multiples */

const chiffres = (s: string) => s.replace(/\D/g, '');

/** Numéro de téléphone : tel quel, chiffres seuls, format national. */
function variantesTelephone(t?: string): string {
  if (!t) return '';
  const c = chiffres(t);
  const national = c.startsWith('33') ? `0${c.slice(2)}` : c;
  return `${t} ${c} ${national}`;
}

/** Date ISO : 12/10, 12/10/2026, 12 octobre 2026, octobre, 2026-10-12. */
function variantesDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const j = iso.slice(0, 10);
  const [a, m, d] = j.split('-');
  try {
    const long = format(parseISO(j), 'EEEE d MMMM yyyy', { locale: fr });
    return `${j} ${d}/${m} ${d}/${m}/${a} ${Number(d)}/${Number(m)} ${long}`;
  } catch {
    return j;
  }
}

/** Montant en centimes : 150, 150,50, 150.50, 1500 (sans espace de milliers). */
function variantesMontant(centimes?: number): string {
  if (centimes === undefined || !Number.isFinite(centimes)) return '';
  const e = Math.floor(Math.abs(centimes) / 100);
  const c = String(Math.abs(centimes) % 100).padStart(2, '0');
  return `${e} ${e},${c} ${e}.${c}`;
}

function haystack(...morceaux: (string | number | undefined | null | false)[]): string {
  return normaliser(morceaux.filter((x) => x !== undefined && x !== null && x !== false).join(' '));
}

/** Page de l'élément concerné par une ligne d'historique (sinon la page Sauvegarde). */
function lienJournal(entite: string, id: string): string {
  const e = (entite ?? '').toLowerCase().replace(/s$/, '');
  const i = encodeURIComponent(id ?? '');
  switch (e) {
    case 'logement':
      return `/erp/logements/${i}`;
    case 'reservation':
      return `/erp/reservations/${i}`;
    case 'mission':
      return `/erp/menages/${i}`;
    case 'incident':
      return `/erp/incidents?id=${i}`;
    case 'proprietaire':
      return `/erp/proprietaires/${i}`;
    case 'prestataire':
      return `/erp/prestataires/${i}`;
    case 'mandat':
      return `/erp/mandats?mandat=${i}`;
    case 'filsmessage':
      return `/erp/messagerie/${i}`;
    case 'facture':
      return '/erp/finance/factures';
    case 'prospect':
      return '/erp/commercial';
    default:
      return '/erp/parametres/donnees';
  }
}

const proximite = (iso?: string) => (iso ? Math.abs(ecartJours(AUJOURDHUI, iso.slice(0, 10))) : undefined);

/* ------------------------------------------------------------------ index */

export function construireIndex(d: ErpDonnees): ElementIndex[] {
  const logements = new Map<string, Logement>(d.logements.map((l) => [l.id, l]));
  const proprios = new Map(d.proprietaires.map((p) => [p.id, p]));
  const prestas = new Map(d.prestataires.map((p) => [p.id, p]));
  const nomLog = (id?: string) => (id ? (logements.get(id)?.nom ?? '') : '');
  const lieuLog = (id?: string) => {
    const l = id ? logements.get(id) : undefined;
    return l ? `${l.nom} ${l.ville} ${l.codePostal} ${l.adresse}` : '';
  };
  const logementsDe = new Map<string, Logement[]>();
  for (const l of d.logements) logementsDe.set(l.proprietaireId, [...(logementsDe.get(l.proprietaireId) ?? []), l]);

  const idx: ElementIndex[] = [];
  const pousser = (e: Omit<ElementIndex, 'titreN'>) => idx.push({ ...e, titreN: normaliser(e.titre) });

  for (const l of d.logements) {
    const p = proprios.get(l.proprietaireId);
    pousser({
      type: 'logement',
      id: l.id,
      titre: l.nom,
      detail: `${l.ville} · ${LIBELLES.statutLogement[l.statut] ?? l.statut}${p ? ` · ${p.nom}` : ''}`,
      to: `/erp/logements/${l.id}`,
      texte: haystack(l.nom, l.adresse, l.ville, l.codePostal, l.type, l.numeroEnregistrement, p?.nom, l.repull?.id, l.repull?.code),
    });
  }

  for (const p of d.proprietaires) {
    const biens = logementsDe.get(p.id) ?? [];
    pousser({
      type: 'proprietaire',
      id: p.id,
      titre: p.nom,
      detail: [p.contact.email, p.contact.telephone, biens.length ? `${biens.length} logement${biens.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '),
      to: `/erp/proprietaires/${p.id}`,
      texte: haystack(
        p.nom,
        LIBELLES.typeProprietaire?.[p.type],
        p.contact.email,
        variantesTelephone(p.contact.telephone),
        p.adresse,
        p.notes,
        ...biens.map((l) => `${l.nom} ${l.ville} ${l.codePostal}`),
      ),
    });
  }

  for (const r of d.reservations) {
    pousser({
      type: 'reservation',
      id: r.id,
      titre: r.voyageur.nom,
      detail: `${nomLog(r.logementId)} · ${dateCourte(r.arrivee)} → ${dateCourte(r.depart)} · ${LIBELLES.canal[r.canal] ?? r.canal}${r.statut === 'annulee' ? ' · annulée' : ''}`,
      to: `/erp/reservations/${r.id}`,
      texte: haystack(
        r.voyageur.nom,
        r.voyageur.pays,
        r.id,
        r.repull?.code,
        r.repull?.id,
        r.channexBookingId,
        LIBELLES.canal[r.canal],
        lieuLog(r.logementId),
        variantesDate(r.arrivee),
        variantesDate(r.depart),
        variantesMontant(r.montantBrutCentimes),
        LIBELLES.statutReservation?.[r.statut],
      ),
      proximite: proximite(r.arrivee),
    });
  }

  for (const f of d.filsMessages) {
    const derniers = f.messages.slice(-6).map((m) => m.texte).join(' ');
    const dernier = f.messages[f.messages.length - 1];
    pousser({
      type: 'conversation',
      id: f.id,
      titre: f.voyageur,
      detail: `${nomLog(f.logementId)} · ${dernier ? dernier.texte.slice(0, 80) : 'aucun message'}`,
      to: `/erp/messagerie/${f.id}`,
      texte: haystack(f.voyageur, lieuLog(f.logementId), LIBELLES.canal[f.canal], derniers, f.repull?.id),
      proximite: proximite(f.dernierMessageLe),
    });
  }

  for (const m of d.missions) {
    const p = m.prestataireId ? prestas.get(m.prestataireId) : undefined;
    pousser({
      type: 'mission',
      id: m.id,
      titre: `${LIBELLES.typeMission?.[m.type] ?? 'Mission'} · ${nomLog(m.logementId)}`,
      detail: `${dateCourte(m.date)} à ${m.heureDebut} · ${p?.nom ?? 'personne n’est encore prévu'}`,
      to: `/erp/menages/${m.id}`,
      texte: haystack(LIBELLES.typeMission?.[m.type], 'ménage', lieuLog(m.logementId), variantesDate(m.date), m.heureDebut, p?.nom, m.commentaire),
      proximite: proximite(m.date),
    });
  }

  for (const p of d.prestataires) {
    pousser({
      type: 'prestataire',
      id: p.id,
      titre: p.nom,
      detail: [LIBELLES.typePrestataire?.[p.type], p.telephone, p.zone.join(', ')].filter(Boolean).join(' · '),
      to: `/erp/prestataires/${p.id}`,
      texte: haystack(p.nom, p.raisonSociale, p.siret, p.siret && chiffres(p.siret), p.email, variantesTelephone(p.telephone), p.zone.join(' '), LIBELLES.typePrestataire?.[p.type]),
    });
  }

  for (const i of d.incidents) {
    pousser({
      type: 'incident',
      id: i.id,
      titre: i.description.length > 70 ? `${i.description.slice(0, 70)}…` : i.description,
      detail: `${nomLog(i.logementId)} · ${dateCourte(i.date)} · ${LIBELLES.statutIncident?.[i.statut] ?? i.statut}`,
      to: `/erp/incidents?id=${i.id}`,
      texte: haystack(i.description, lieuLog(i.logementId), variantesDate(i.date), i.responsable, variantesMontant(i.coutCentimes), LIBELLES.categorieIncident?.[i.categorie]),
      proximite: proximite(i.date),
    });
  }

  for (const f of d.factures) {
    const p = f.proprietaireId ? proprios.get(f.proprietaireId) : undefined;
    const ttc = montantTtc(f);
    pousser({
      type: 'facture',
      id: f.id,
      titre: `Facture ${f.numero}`,
      detail: `${euros(ttc)} · ${p?.nom ?? 'sans propriétaire'} · échéance ${dateCourte(f.echeance)}`,
      to: `/erp/finance/factures?q=${encodeURIComponent(f.numero)}`,
      texte: haystack(f.numero, p?.nom, variantesMontant(ttc), variantesMontant(f.montantHtCentimes), variantesDate(f.dateEmission), variantesDate(f.echeance), f.lignes.map((x) => x.libelle).join(' ')),
      proximite: proximite(f.dateEmission),
    });
  }

  for (const m of d.mandats) {
    const p = proprios.get(m.proprietaireId);
    pousser({
      type: 'mandat',
      id: m.id,
      titre: `Contrat ${m.reference}`,
      detail: `${p?.nom ?? 'Propriétaire'} · ${nomLog(m.logementId)} · ${LIBELLES.statutMandat?.[m.statut] ?? m.statut}`,
      to: `/erp/mandats?mandat=${m.id}`,
      texte: haystack('mandat contrat', m.reference, p?.nom, lieuLog(m.logementId), variantesDate(m.dateDebut), variantesDate(m.signeLe), `${m.commissionPct} %`),
    });
  }

  for (const p of d.prospects) {
    pousser({
      type: 'prospect',
      id: p.id,
      titre: p.nom,
      detail: `${p.ville} · ${p.typeBien}${p.prochaineAction ? ` · ${p.prochaineAction}` : ''}`,
      to: `/erp/commercial?q=${encodeURIComponent(p.nom)}`,
      texte: haystack(p.nom, p.ville, p.typeBien, p.prochaineAction, p.notes, LIBELLES.etapeProspect?.[p.etape]),
    });
  }

  // Historique : les 400 dernières lignes suffisent (le reste est dans l'export).
  for (const j of d.journal.slice(0, 400)) {
    pousser({
      type: 'journal',
      id: j.id,
      titre: j.action,
      detail: `${j.auteur} · ${dateCourte(j.horodatage)}${j.details ? ` · ${j.details}` : ''}`,
      to: lienJournal(j.entite, j.entiteId),
      texte: haystack(j.action, j.auteur, j.details, j.entite, variantesDate(j.horodatage)),
      proximite: proximite(j.horodatage),
    });
  }

  return idx;
}

/* ---------------------------------------------------------------- scoring */

function score(e: ElementIndex, mots: string[], requete: string): number {
  let s = 0;
  if (e.titreN === requete) s += 1000;
  else if (e.titreN.startsWith(requete)) s += 400;
  for (const m of mots) {
    const posTexte = e.texte.indexOf(m);
    if (posTexte < 0) return -1;
    const posTitre = e.titreN.indexOf(m);
    if (posTitre === 0) s += 60;
    else if (posTitre > 0 && e.titreN[posTitre - 1] === ' ') s += 40;
    else if (posTitre > 0) s += 20;
    else if (posTexte === 0 || e.texte[posTexte - 1] === ' ') s += 8;
    else s += 2;
  }
  return s;
}

export interface GroupeResultats {
  groupe: GroupeType;
  total: number;
  elements: ElementIndex[];
}

/** Résultats par type, classés ; `parGroupe` éléments gardés par type (tous si Infinity). */
export function rechercher(index: ElementIndex[], q: string, parGroupe = 5): GroupeResultats[] {
  const mots = motsRequete(q);
  if (!mots.length || mots.join('').length < 2) return [];
  const requete = mots.join(' ');
  const parType = new Map<TypeResultat, { e: ElementIndex; s: number }[]>();
  for (const e of index) {
    const s = score(e, mots, requete);
    if (s < 0) continue;
    const liste = parType.get(e.type) ?? [];
    liste.push({ e, s });
    parType.set(e.type, liste);
  }
  const groupes: (GroupeResultats & { meilleur: number })[] = [];
  for (const g of GROUPES_RECHERCHE) {
    const liste = parType.get(g.type);
    if (!liste?.length) continue;
    liste.sort((a, b) => b.s - a.s || (a.e.proximite ?? 1e9) - (b.e.proximite ?? 1e9) || a.e.titre.localeCompare(b.e.titre, 'fr'));
    groupes.push({ groupe: g, total: liste.length, elements: liste.slice(0, parGroupe).map((x) => x.e), meilleur: liste[0].s });
  }
  // Le groupe qui contient la meilleure correspondance passe devant, l'ordre par défaut départage.
  return groupes
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.meilleur - a.g.meilleur || a.i - b.i)
    .map(({ g: { meilleur: _m, ...reste } }) => reste);
}

/* ------------------------------------------------------------ surlignage */

/** Découpe `texte` en morceaux surlignés ou non selon les mots de la requête. */
export function decouper(texte: string, mots: string[]): { t: string; fort: boolean }[] {
  if (!mots.length || !texte) return [{ t: texte, fort: false }];
  const n = normaliserAligne(texte);
  const marques = new Array<boolean>(texte.length).fill(false);
  for (const m of mots) {
    if (m.length < 1) continue;
    let p = n.indexOf(m);
    while (p >= 0) {
      for (let k = p; k < p + m.length && k < marques.length; k++) marques[k] = true;
      p = n.indexOf(m, p + m.length);
    }
  }
  const morceaux: { t: string; fort: boolean }[] = [];
  for (let i = 0; i < texte.length; i++) {
    const dernier = morceaux[morceaux.length - 1];
    if (dernier && dernier.fort === marques[i]) dernier.t += texte[i];
    else morceaux.push({ t: texte[i], fort: marques[i] });
  }
  return morceaux;
}

/* -------------------------------------------------- correspondance souple */

/** Pour les pages et actions : chaque mot est un début de mot, ou les lettres se suivent dans l'ordre. */
export function correspondSouple(cible: string, q: string): number {
  const mots = motsRequete(q);
  if (!mots.length) return 0;
  const n = normaliser(cible);
  let s = 0;
  for (const m of mots) {
    if (n.startsWith(m)) s += 30;
    else if (n.includes(` ${m}`)) s += 20;
    else if (n.includes(m)) s += 10;
    else {
      // Sous-séquence (« msgr » → « messagerie »).
      let i = 0;
      for (const c of n) if (c === m[i]) i++;
      if (i < m.length || m.length < 3) return -1;
      s += 3;
    }
  }
  return s;
}
