/**
 * Mots de la carte des logements : une phrase simple par logement (ce qui se
 * passe aujourd'hui), la ligne du ménage et la légende. Partagés par les
 * trois espaces (gérant, propriétaire, opérations), vérifiés par
 * data/verifier-carte.ts.
 */
import { jourMois } from '../data/format';
import { LIBELLES_ETAT, lendemain, type ComptesCarte, type EtatCarte, type PointCarte } from '../data/carte';
import type { DateISO } from '../data/types';

/** « 11:00 » → « 11 h », « 09:30 » → « 9 h 30 ». */
export const heureLisible = (h: string | undefined) => (h && /^\d{1,2}:\d{2}$/.test(h) ? h.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ') : '');

/** Mot de l'état, au singulier ou au pluriel. */
export const motEtat = (e: EtatCarte, n = 1) => (n > 1 ? LIBELLES_ETAT[e].plusieurs : LIBELLES_ETAT[e].un);

/** Mot de l'état en tête de phrase (pastille, carte) : « Réservé », « Libre », « Ménage ». */
export const titreEtat = (e: EtatCarte) => {
  const m = LIBELLES_ETAT[e].un;
  return m.charAt(0).toLocaleUpperCase('fr') + m.slice(1);
};

const quandArrivee = (d: DateISO, aujourdhui: DateISO) => (d === lendemain(aujourdhui) ? 'demain' : `le ${jourMois(d)}`);

/** Ce soir : qui dort là (ou personne). */
function ceSoir(p: PointCarte, aujourdhui: DateISO): string {
  const s = p.sejour;
  if (!s) return p.prochaineArrivee ? `libre ce soir, prochaine arrivée ${quandArrivee(p.prochaineArrivee, aujourdhui)}` : 'libre ce soir';
  const qui = s.voyageur ?? 'un voyageur';
  if (s.arrivee === aujourdhui) return `${qui} arrive aujourd’hui, jusqu’au ${jourMois(s.depart)}`;
  return s.depart === lendemain(aujourdhui) ? `${qui} est là, départ demain` : `${qui} est là jusqu’au ${jourMois(s.depart)}`;
}

const majuscule = (t: string) => t.charAt(0).toLocaleUpperCase('fr') + t.slice(1);

/**
 * Ce qui se passe aujourd'hui, en une phrase : le ménage s'il n'est pas fini
 * (ou vient de l'être), puis qui dort là ce soir.
 * « Ménage en cours, Marie D. arrive aujourd'hui, jusqu'au 27 sept. »
 */
export function phraseDuJour(p: PointCarte, aujourdhui: DateISO): string {
  const m = p.menage;
  let menage = '';
  if (m?.statut === 'en_cours') menage = 'Ménage en cours';
  else if (m?.statut === 'a_faire' && p.etat === 'menage') menage = p.depart ? 'Ménage à faire après le départ' : 'Ménage à faire';
  else if (m?.statut === 'fait' && p.depart) menage = 'Ménage fait';
  const soir = ceSoir(p, aujourdhui);
  const phrase = menage ? `${menage}, ${soir}` : majuscule(soir);
  // « jusqu'au 27 sept. » : pas de second point.
  return phrase.endsWith('.') ? phrase : `${phrase}.`;
}

/**
 * Ligne du ménage dans la fiche, seulement ce que la phrase du jour ne dit
 * pas : « Ménage prévu à 11 h par Éclat Services. », « Ménage en cours. »
 * (milieu de séjour) ; vide quand elle n'apprend rien de plus.
 */
export function ligneMenage(p: Pick<PointCarte, 'etat' | 'menage' | 'depart'>): string {
  const m = p.menage;
  if (!m) return '';
  // Le statut est déjà dans la phrase du jour (ménage pas fini, ou fait après le départ).
  const dejaDit = p.etat === 'menage' || (m.statut === 'fait' && !!p.depart);
  const h = m.statut === 'a_faire' ? heureLisible(m.heure) : '';
  const par = m.par ? ` par ${m.par}` : '';
  if (dejaDit) return h || par ? `Ménage${h ? ` prévu à ${h}` : ''}${par}.` : '';
  const debut = m.statut === 'en_cours' ? 'Ménage en cours' : m.statut === 'fait' ? 'Ménage fait' : h ? `Ménage prévu à ${h}` : 'Ménage à faire';
  return `${debut}${par}.`;
}

/** Légende en une phrase, pour les lecteurs d'écran : « 4 réservés, 2 libres, 1 ménage, 1 problème. » */
export function phraseLegende(c: ComptesCarte): string {
  const parts = (['reserve', 'libre', 'menage'] as const).filter((e) => c[e] > 0).map((e) => `${c[e]} ${motEtat(e, c[e])}`);
  if (c.probleme) parts.push(`${c.probleme} ${c.probleme > 1 ? 'problèmes' : 'problème'}`);
  return parts.length ? `${parts.join(', ')}.` : '';
}

/** Libellé d'un repère pour les lecteurs d'écran : « Cosy F2 : ménage, problème signalé ». */
export function libelleRepere(p: Pick<PointCarte, 'nom' | 'etat' | 'problemes' | 'position'>): string {
  const plus = [motEtat(p.etat), p.problemes.length ? 'problème signalé' : '', p.position?.precision === 'commune' ? 'position approximative' : ''].filter(Boolean);
  return `${p.nom} : ${plus.join(', ')}`;
}
