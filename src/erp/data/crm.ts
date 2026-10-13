/**
 * CRM d'appels : règles partagées par l'écran (src/erp/modules/crm) et par
 * le serveur (/api/contact, qui crée une ligne « À appeler » à chaque
 * formulaire envoyé depuis le site). Aucune dépendance au navigateur.
 */
import type { ContactCrm, Horodatage, ResultatAppel, SourceContactCrm, StatutContactCrm } from './types';

/** Étapes, dans l'ordre où un contact avance. */
export const STATUTS_CRM: { cle: StatutContactCrm; libelle: string; aide: string }[] = [
  { cle: 'a_appeler', libelle: 'À appeler', aide: 'Nouvelle demande : premier appel à passer.' },
  { cle: 'a_rappeler', libelle: 'À rappeler', aide: 'Pas joint, ou rappel demandé.' },
  { cle: 'contacte', libelle: 'Contacté', aide: 'Premier échange fait.' },
  { cle: 'en_attente', libelle: 'En attente', aide: 'Travaux, achat en cours, décision à prendre…' },
  { cle: 'rendez_vous', libelle: 'Rendez-vous', aide: 'Visite ou rendez-vous fixé.' },
  { cle: 'signe', libelle: 'Signé', aide: 'Devenu client.' },
  { cle: 'pas_interesse', libelle: 'Pas intéressé', aide: 'Ne donne pas suite.' },
];

export const LIBELLE_STATUT_CRM = Object.fromEntries(STATUTS_CRM.map((s) => [s.cle, s.libelle])) as Record<StatutContactCrm, string>;

/** Étapes closes : un nouveau formulaire de la même personne crée une nouvelle ligne. */
export const STATUTS_CLOS: StatutContactCrm[] = ['signe', 'pas_interesse'];

export const LIBELLE_SOURCE_CRM: Record<SourceContactCrm, string> = {
  audit: 'Site · audit',
  accueil: 'Site · accueil',
  contact: 'Site · contact',
  cercle: 'Site · Cercle',
  manuel: 'Ajout manuel',
};

export const LIBELLE_RESULTAT: Record<ResultatAppel, string> = {
  joint: 'Appel : joint',
  pas_de_reponse: 'Appel : pas de réponse',
  messagerie: 'Appel : message laissé',
  note: 'Note',
  formulaire: 'Demande reçue via le site',
};

/** Chiffres seuls, indicatif français ramené à 0 (« +33 6 12… » = « 06 12… »). */
export function telephoneNormalise(t: string | undefined): string {
  const chiffres = String(t ?? '').replace(/\D/g, '');
  if (chiffres.startsWith('33') && chiffres.length === 11) return `0${chiffres.slice(2)}`;
  if (chiffres.startsWith('0033') && chiffres.length === 13) return `0${chiffres.slice(4)}`;
  return chiffres;
}

/** Contact déjà en cours (même e-mail ou même téléphone, étape non close). */
export function trouverDoublon(contacts: ContactCrm[], c: Pick<ContactCrm, 'email' | 'telephone'>): ContactCrm | undefined {
  const email = (c.email ?? '').trim().toLowerCase();
  const tel = telephoneNormalise(c.telephone);
  return contacts.find(
    (x) =>
      !STATUTS_CLOS.includes(x.statut) &&
      ((email && (x.email ?? '').trim().toLowerCase() === email) || (tel.length >= 9 && telephoneNormalise(x.telephone) === tel)),
  );
}

/** Champs reçus d'un formulaire du site (voir api/contact.ts). */
export interface DemandeSite {
  type?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  tel?: string;
  telephone?: string;
  ville?: string;
  typeBien?: string;
  adresse?: string;
  chambres?: string;
  message?: string;
  page?: string;
  profil?: string;
}

/** E-mail sans caractère capable de détourner un lien mailto: (?, &, %, virgule…). */
export const EMAIL_SUR = /^[^\s@?&%,;:<>"()\\/]+@[^\s@?&%,;:<>"'()\\/]+\.[a-z]{2,}$/i;

const coupe = (v: unknown, max: number): string | undefined => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : undefined;
};

/** Source d'après le champ « type » des formulaires. */
export function sourceDemande(type: unknown): SourceContactCrm {
  if (type === 'audit') return 'audit';
  if (type === 'lead') return 'accueil';
  if (type === 'cercle') return 'cercle';
  return 'contact';
}

/** Nouvelle ligne « À appeler » à partir d'une demande du site. */
export function contactDepuisDemande(d: DemandeSite, id: string, maintenant: Horodatage): ContactCrm {
  const source = sourceDemande(d.type);
  const message = [
    d.chambres && `Chambres : ${coupe(d.chambres, 40)}`,
    d.profil && `Profil : ${coupe(d.profil, 120)}`,
    coupe(d.message, 2000),
  ]
    .filter(Boolean)
    .join('\n');
  return {
    id,
    nom: coupe(d.nom, 120) ?? coupe(d.prenom, 120) ?? coupe(d.email, 120) ?? 'Sans nom',
    ...(coupe(d.tel ?? d.telephone, 40) ? { telephone: coupe(d.tel ?? d.telephone, 40) } : {}),
    ...(coupe(d.email, 160) && EMAIL_SUR.test(coupe(d.email, 160)!) ? { email: coupe(d.email, 160)!.toLowerCase() } : {}),
    ...(coupe(d.ville, 120) ? { ville: coupe(d.ville, 120) } : {}),
    ...(coupe(d.typeBien, 120) ? { typeBien: coupe(d.typeBien, 120) } : {}),
    ...(coupe(d.adresse, 240) ? { adresse: coupe(d.adresse, 240) } : {}),
    ...(message ? { message } : {}),
    ...(coupe(d.page, 300) ? { page: coupe(d.page, 300) } : {}),
    source,
    statut: 'a_appeler',
    notes: '',
    tentatives: 0,
    historique: [{ le: maintenant, par: 'Site web', resultat: 'formulaire', ...(message ? { texte: message.slice(0, 500) } : {}) }],
    creeLe: maintenant,
    majLe: maintenant,
  };
}

/**
 * La même personne renvoie un formulaire alors qu'elle est déjà suivie : pas
 * de doublon. L'étape et le message déjà saisis ne bougent pas (un formulaire
 * public ne doit pas pouvoir réécrire une fiche) : la nouvelle demande
 * s'ajoute à l'historique et la fiche passe dans les appels du jour (relance
 * ramenée à aujourd'hui). Seuls les champs vides sont complétés.
 */
export function fusionnerDemande(existant: ContactCrm, nouveau: ContactCrm, maintenant: Horodatage): ContactCrm {
  const jour = maintenant.slice(0, 10);
  const relanceAvancee = !!existant.relanceLe && existant.relanceLe > jour;
  const trace = nouveau.historique[0];
  const historiqueNouveau = relanceAvancee && trace
    ? [{ ...trace, texte: [trace.texte, `Relance prévue le ${existant.relanceLe} avancée à aujourd’hui.`].filter(Boolean).join('\n') }]
    : nouveau.historique;
  return {
    ...existant,
    telephone: existant.telephone || nouveau.telephone,
    email: existant.email || nouveau.email,
    ville: existant.ville || nouveau.ville,
    typeBien: existant.typeBien || nouveau.typeBien,
    adresse: existant.adresse || nouveau.adresse,
    message: existant.message || nouveau.message,
    page: existant.page || nouveau.page,
    relanceLe: existant.relanceLe && existant.relanceLe < jour ? existant.relanceLe : jour,
    historique: [...historiqueNouveau, ...(existant.historique ?? [])].slice(0, 100),
    majLe: maintenant,
  };
}

/** Identifiant d'une nouvelle ligne (horodaté, sans collision entre deux envois). */
export function idContactCrm(maintenant = Date.now(), alea = Math.random()): string {
  return `crm-${maintenant.toString(36)}-${Math.floor(alea * 1e8).toString(36)}`;
}

/** Ajoute une trace d'appel et fait avancer l'étape en conséquence. */
export function noterAppel(c: ContactCrm, resultat: ResultatAppel, par: string, maintenant: Horodatage, texte?: string): ContactCrm {
  const trace = { le: maintenant, par, resultat, ...(texte?.trim() ? { texte: texte.trim().slice(0, 1000) } : {}) };
  const sansReponse = resultat === 'pas_de_reponse' || resultat === 'messagerie';
  const statut: StatutContactCrm =
    resultat === 'joint' && (c.statut === 'a_appeler' || c.statut === 'a_rappeler')
      ? 'contacte'
      : sansReponse && c.statut === 'a_appeler'
        ? 'a_rappeler'
        : c.statut;
  return {
    ...c,
    statut,
    tentatives: sansReponse ? (c.tentatives ?? 0) + 1 : c.tentatives ?? 0,
    historique: [trace, ...(c.historique ?? [])].slice(0, 100),
    majLe: maintenant,
  };
}

/** À traiter le jour `aujourdhui` : nouvelles demandes et relances arrivées à échéance. */
export function aTraiterLe(c: ContactCrm, aujourdhui: string): boolean {
  if (c.statut === 'a_appeler') return true;
  return !!c.relanceLe && c.relanceLe <= aujourdhui && !STATUTS_CLOS.includes(c.statut);
}
