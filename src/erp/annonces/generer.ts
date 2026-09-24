/**
 * Générateur de la proposition mensuelle d'annonce (SPEC §11).
 *
 * Pur et déterministe : mêmes données, même mois, même date, même texte.
 * Aucune date système, aucun appel réseau.
 *
 * En production, ce générateur est remplacé par l'agent Claude (agent-ia),
 * appelé avec exactement les mêmes entrées (fiche logement, saison du mois
 * visé, repères locaux, avis récents, améliorations réalisées) et la même
 * règle : « n'invente rien ». Un point faible cité par les voyageurs n'est
 * mis en avant que si l'amélioration correspondante est réalisée ; sinon il
 * devient une raison « à corriger » visible par l'humain qui valide.
 */
import { THEMES_PLAINTE, plaintesParTheme, type ThemePlainte } from '../analyse/defauts';
import { ajouterJours, nombre } from '../data/format';
import { LIBELLES } from '../data/libelles';
import type { DateISO, ErpDonnees, Id, Logement, RecommandationProprietaire, VersionAnnonce } from '../data/types';
import { ANCRAGES, LIBELLES_SAISON, SAISONS, saisonDuMois } from './ancrages';

export type DonneesAnnonce = Pick<ErpDonnees, 'logements' | 'reservations' | 'recommandations'>;

export const LONGUEUR_TITRE_MAX = 50;
export const LONGUEUR_DESCRIPTION = { min: 600, max: 1000 } as const;

/** Id déterministe de la proposition d'un mois (révision 1). */
export const idVersion = (logementId: Id, mois: string, revision = 1) =>
  revision <= 1 ? `ann-${logementId}-${mois}` : `ann-${logementId}-${mois}-r${revision}`;

/** Amélioration qui, une fois réalisée, lève un point faible, et la phrase qu'on peut alors écrire. */
const CORRECTIFS: Record<ThemePlainte, { code: string; phrase: string }> = {
  literie: { code: 'literie', phrase: 'Literie neuve : matelas et oreillers remplacés.' },
  bruit: { code: 'isolation_rideaux', phrase: 'Rideaux occultants dans la chambre pour des nuits au calme.' },
  chauffage: { code: 'chauffage', phrase: 'Chauffage révisé et thermostat réglable.' },
  wifi: { code: 'equipements', phrase: 'Connexion internet revue pour le télétravail.' },
  equipement: { code: 'equipements', phrase: 'Équipement complété à la suite des retours des voyageurs.' },
  checkin: { code: 'serrure_connectee', phrase: 'Arrivée autonome à toute heure grâce à la serrure connectée.' },
  proprete: { code: 'controle_menage', phrase: 'Ménage contrôlé et photographié à chaque départ.' },
};

const aEquipement = (l: Logement, motif: RegExp) => l.fiche.equipements.some((e) => motif.test(e));

const LITS: Record<Logement['lits'][number]['type'], [string, string]> = {
  simple: ['lit simple', 'lits simples'],
  double: ['lit double', 'lits doubles'],
  canape: ['canapé-lit', 'canapés-lits'],
};

function couchages(l: Logement): string {
  const morceaux = l.lits.map((lit) => `${lit.nombre} ${LITS[lit.type][lit.nombre > 1 ? 1 : 0]}`);
  return morceaux.length > 1 ? `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}` : morceaux[0] ?? '';
}

function nature(l: Logement): string {
  if (l.type === 'studio') return `Studio de ${l.surfaceM2} m²`;
  if (l.type === 'maison') return `Maison de ${l.surfaceM2} m² avec ${l.chambres} chambres`;
  return `${LIBELLES.typeLogement[l.type]} de ${l.surfaceM2} m² avec ${l.chambres} chambre${l.chambres > 1 ? 's' : ''}`;
}

/** Avis des 12 derniers mois jusqu'à `date` : plaintes par thème, note moyenne. */
function avisRecents(d: DonneesAnnonce, l: Logement, date: DateISO) {
  const debut = ajouterJours(date, -365);
  const avis = d.reservations.filter(
    (r) => r.logementId === l.id && r.noteVoyageur !== undefined && r.depart <= date && r.depart >= debut && r.statut !== 'annulee',
  );
  const notes = avis.map((r) => r.noteVoyageur as number);
  const moyenne = notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : undefined;
  return { plaintes: plaintesParTheme(avis), nb: notes.length, moyenne };
}

function recoRealisee(recos: RecommandationProprietaire[], l: Logement, code: string, date: DateISO) {
  return recos.find((r) => r.logementId === l.id && r.code === code && r.statut === 'realisee' && (r.realiseeLe ?? r.creeLe) <= date);
}

/** Premier titre candidat qui tient dans la limite. */
function titreCourt(candidats: string[]): string {
  return candidats.find((t) => t.length <= LONGUEUR_TITRE_MAX) ?? candidats[candidats.length - 1].slice(0, LONGUEUR_TITRE_MAX).trim();
}

export function proposerVersion(d: DonneesAnnonce, logementId: Id, mois: string, date: DateISO): VersionAnnonce {
  const l = d.logements.find((x) => x.id === logementId);
  if (!l) throw new Error(`Logement introuvable : ${logementId}`);
  const saison = saisonDuMois(mois);
  const s = SAISONS[saison];
  const ancrage = ANCRAGES[l.ville];
  const rang = Number(mois.slice(5, 7));
  const raisons: string[] = [`Saison : ${LIBELLES_SAISON[saison].toLowerCase()}, ${s.theme.charAt(0).toLowerCase()}${s.theme.slice(1)}.`];
  const avis = avisRecents(d, l, date);
  const leves = new Set<ThemePlainte>();

  const exterieur = l.fiche.equipements.find((e) => /jardin|terrasse/i.test(e));
  const parkingPrive = !/pas de parking|payant|public|rue/i.test(l.fiche.parking);
  const autonome = l.serrure === 'connectee';

  /* ------------------------------------------------ points forts et points faibles */
  const correctifs: string[] = [];
  for (const theme of Object.keys(THEMES_PLAINTE) as ThemePlainte[]) {
    const n = avis.plaintes[theme];
    if (!n) continue;
    const c = CORRECTIFS[theme];
    const libelle = THEMES_PLAINTE[theme].libelle;
    const leve = theme === 'checkin' ? autonome : !!recoRealisee(d.recommandations, l, c.code, date);
    if (leve) {
      leves.add(theme);
      correctifs.push(c.phrase);
      raisons.push(`Avis : ${libelle} cité ${n} fois, amélioration réalisée, on la met en avant.`);
    } else {
      raisons.push(`Point faible à corriger avant de le mettre en avant : ${libelle} (${n} avis).`);
    }
  }

  // Un atout contredit par un avis non corrigé n'est pas mis en avant.
  const fibre = aEquipement(l, /wifi|fibre/i) && (!avis.plaintes.wifi || leves.has('wifi'));
  const calme = !avis.plaintes.bruit || leves.has('bruit');

  /* ------------------------------------------------------------------ titre */
  const atout = exterieur
    ? (/jardin/i.test(exterieur) ? 'jardin' : 'terrasse')
    : fibre ? 'fibre' : parkingPrive ? 'parking' : calme ? 'calme' : 'bien situé';
  const court = ancrage?.court ?? l.ville;
  const typeCourt = l.type === 'maison' ? 'Maison' : l.type === 'studio' ? 'Studio' : LIBELLES.typeLogement[l.type];
  const motSaison = saison === 'automne' ? 'télétravail' : saison === 'hiver' ? 'cocooning' : saison === 'ete' ? 'été' : 'week-end';
  const titre = titreCourt([
    `${typeCourt} ${l.capacite} pers., ${atout}, ${motSaison}, ${court} ${ancrage?.titre ?? ''}`.trim(),
    `${typeCourt} ${l.capacite} pers., ${atout}, ${court} ${ancrage?.titre ?? ''}`.trim(),
    `${typeCourt} ${l.capacite} pers., ${atout}, ${court}`,
  ]);

  /* ---------------------------------------------------------------- accroche */
  const fetes = saison === 'hiver' && rang === 12;
  const baseAccroche = saison === 'hiver' && !fetes ? 'Cet hiver : séjours pro et week-ends cocooning' : s.accroche;
  const accroche = saison === 'automne' && !fibre
    ? `Cet automne : séjours pro et week-ends${calme ? ' au calme' : ''}, à ${court}`
    : `${baseAccroche}, à ${court}`;
  const phraseSaison =
    (saison === 'hiver' && !fetes) || (saison === 'automne' && !fibre)
      ? `En ${saison}, le logement convient aux séjours professionnels en semaine comme aux week-ends cocooning.`
      : s.phrase;

  /* ------------------------------------------------------------- description */
  const reperes = ancrage?.reperes ?? [];
  const deuxReperes = reperes.length ? [reperes[rang % reperes.length], reperes[(rang + 1) % reperes.length]] : [];
  const equipements = l.fiche.equipements
    .filter((e) => !/télévision|fer à repasser/i.test(e))
    .map((e) => `${e.charAt(0).toLowerCase()}${e.slice(1)}`);

  const blocs: { texte: string; optionnel: boolean }[] = [
    { texte: `${accroche}.`, optionnel: false },
    { texte: `${nature(l)}, jusqu’à ${l.capacite} voyageurs : ${couchages(l)}.`, optionnel: false },
    { texte: `Sur place : ${equipements.join(', ')}.`, optionnel: false },
    { texte: phraseSaison + (saison === 'automne' && fibre ? ' La fibre permet les visioconférences.' : ''), optionnel: false },
    ...(ancrage?.public[saison] ? [{ texte: ancrage.public[saison] as string, optionnel: false }] : []),
    ...(deuxReperes.length ? [{ texte: `À proximité : ${deuxReperes.join(', ainsi que ')}.`, optionnel: false }] : []),
    ...correctifs.map((texte) => ({ texte, optionnel: false })),
    {
      texte: autonome
        ? correctifs.includes(CORRECTIFS.checkin.phrase) ? '' : 'Arrivée autonome avec un code personnel, valable pour votre séjour.'
        : `Arrivée à partir de ${l.fiche.heureArrivee.replace(':', ' h ')} par boîte à clés, instructions envoyées avant votre arrivée.`.replace(' h 00', ' h'),
      optionnel: true,
    },
    { texte: `Stationnement : ${l.fiche.parking.charAt(0).toLowerCase()}${l.fiche.parking.slice(1)}.`, optionnel: true },
    ...(avis.moyenne !== undefined && avis.nb >= 5 && avis.moyenne >= 4.7
      ? [{ texte: `Noté ${nombre(avis.moyenne, 1)} sur 5 par nos ${avis.nb} derniers voyageurs.`, optionnel: true }]
      : []),
    { texte: 'Linge de lit et serviettes fournis, ménage professionnel entre chaque séjour.', optionnel: true },
    { texte: `${l.fiche.regles}`, optionnel: true },
  ];

  const obligatoires = blocs.filter((b) => !b.optionnel).map((b) => b.texte);
  let description = obligatoires.join(' ');
  for (const b of blocs.filter((x) => x.optionnel && x.texte)) {
    const essai = `${description} ${b.texte}`;
    if (essai.length <= LONGUEUR_DESCRIPTION.max) description = essai;
  }
  if (description.length > LONGUEUR_DESCRIPTION.max) description = `${description.slice(0, LONGUEUR_DESCRIPTION.max - 1).replace(/\s+\S*$/, '')}.`;

  if (deuxReperes.length) raisons.push(`Repères locaux : ${deuxReperes.join(', ')}.`);
  if (avis.moyenne !== undefined && avis.nb >= 5 && avis.moyenne >= 4.7) raisons.push(`Note ${nombre(avis.moyenne, 1)} / 5 sur ${avis.nb} avis, citée comme preuve.`);

  return {
    id: idVersion(l.id, mois),
    logementId: l.id,
    mois,
    statut: 'proposee',
    titre,
    description: description.replace(/\s+/g, ' ').replace(/\.\./g, '.').trim(),
    accroche,
    raisons,
    source: 'agent',
    creeLe: date,
  };
}

/** Contrôles de forme avant validation (titre, longueur, tiret long). */
export function controlerVersion(v: Pick<VersionAnnonce, 'titre' | 'description' | 'accroche'>): string[] {
  const erreurs: string[] = [];
  if (!v.titre.trim()) erreurs.push('Le titre est obligatoire.');
  if (v.titre.length > LONGUEUR_TITRE_MAX) erreurs.push(`Titre trop long (${v.titre.length} caractères, ${LONGUEUR_TITRE_MAX} au plus).`);
  if (v.description.length < LONGUEUR_DESCRIPTION.min) erreurs.push(`Description trop courte (${v.description.length} caractères, ${LONGUEUR_DESCRIPTION.min} au moins).`);
  if (v.description.length > LONGUEUR_DESCRIPTION.max) erreurs.push(`Description trop longue (${v.description.length} caractères, ${LONGUEUR_DESCRIPTION.max} au plus).`);
  if (/—/.test(`${v.titre}${v.description}${v.accroche}`)) erreurs.push('Pas de tiret long dans l’annonce.');
  return erreurs;
}
