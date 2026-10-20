/**
 * Agenda des relances du CRM au format iCalendar (RFC 5545), pour un
 * abonnement dans Calendrier (iPhone, Mac), Google Agenda ou Outlook.
 *
 * Mêmes règles que le CRM (aTraiterLe) :
 * - aujourd'hui : chaque nouvelle demande « À appeler » et chaque relance
 *   échue (marquée « en retard ») ;
 * - à sa date : chaque relance prévue ;
 * - jamais : « Signé » et « Pas intéressé ».
 * Un seul événement par contact (UID stable) : la date suit la relance.
 *
 * Module pur : partagé par l'API (/api/crm-agenda/<clé>) et les tests.
 */
import { aTraiterLe, LIBELLE_STATUT_CRM, STATUTS_CLOS } from './crm.js';
import type { ContactCrm, Responsable, StatutContactCrm } from './types.js';

export const ERP_CRM = 'https://www.labelmaisoncg.fr/erp/crm';

/**
 * Relances de toute l'équipe, ou d'une personne : ses contacts et ceux que
 * personne ne suit encore (une nouvelle demande arrive sans « Suivi par »).
 */
export type FiltreAgenda = 'tous' | Responsable;

const VERBE: Record<StatutContactCrm, string> = {
  a_appeler: 'Appeler',
  a_rappeler: 'Rappeler',
  contacte: 'Relancer',
  en_attente: 'Relancer',
  rendez_vous: 'Rendez-vous :',
  signe: 'Relancer',
  pas_interesse: 'Relancer',
};

/** Texte iCalendar : antislash, point-virgule, virgule et retours à la ligne échappés. */
export function echapperTexte(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Lignes de 75 octets au plus, suite précédée d'une espace (RFC 5545 §3.1), sans couper un caractère. */
export function plier(ligne: string): string {
  const octets = (s: string) => new TextEncoder().encode(s).length;
  if (octets(ligne) <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = '';
  let limite = 75;
  for (const car of ligne) {
    if (octets(courant + car) > limite) {
      morceaux.push(courant);
      courant = '';
      limite = 74; // la ligne suivante commence par une espace
    }
    courant += car;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

const jourIcs = (iso: string) => iso.slice(0, 10).replace(/-/g, '');

function lendemain(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Horodatage UTC « 20261020T080000Z » (une date invalide donne `repli`). */
function horodatageUtc(iso: string | undefined, repli: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  const d = new Date(Number.isFinite(t) ? t : Date.parse(repli));
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const dateFr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

export interface EvenementRelance {
  contact: ContactCrm;
  /** Jour de l'événement (AAAA-MM-JJ). */
  jour: string;
  enRetard: boolean;
}

/** Événements de l'agenda, du plus proche au plus lointain. */
export function evenementsRelance(contacts: ContactCrm[], aujourdhui: string, filtre: FiltreAgenda = 'tous'): EvenementRelance[] {
  const r: EvenementRelance[] = [];
  for (const c of contacts) {
    if (!c?.id || STATUTS_CLOS.includes(c.statut)) continue;
    if (filtre !== 'tous' && c.responsable && c.responsable !== filtre) continue;
    if (aTraiterLe(c, aujourdhui)) {
      // À faire aujourd'hui : nouvelle demande, ou relance échue (en retard si avant aujourd'hui).
      const reference = c.relanceLe ?? c.creeLe?.slice(0, 10) ?? aujourdhui;
      r.push({ contact: c, jour: aujourdhui, enRetard: reference < aujourdhui });
    } else if (c.relanceLe && /^\d{4}-\d{2}-\d{2}$/.test(c.relanceLe)) {
      r.push({ contact: c, jour: c.relanceLe, enRetard: false });
    }
  }
  return r.sort((a, b) => a.jour.localeCompare(b.jour) || a.contact.nom.localeCompare(b.contact.nom));
}

function description(e: EvenementRelance): string {
  const c = e.contact;
  const lignes = [
    `Étape : ${LIBELLE_STATUT_CRM[c.statut]}`,
    e.enRetard && (c.relanceLe ? `En retard : relance prévue le ${dateFr(c.relanceLe)}` : `Demande reçue le ${dateFr(c.creeLe)}`),
    c.telephone && `Téléphone : ${c.telephone}`,
    c.email && `E-mail : ${c.email}`,
    [c.typeBien, c.ville].filter(Boolean).join(' · '),
    c.motifAttente && `En attente de : ${c.motifAttente}`,
    c.tentatives > 0 && `${c.tentatives} appel${c.tentatives > 1 ? 's' : ''} sans réponse`,
    c.notes && `Notes : ${c.notes.slice(0, 600)}`,
    `Fiche : ${ERP_CRM}?contact=${encodeURIComponent(c.id)}`,
  ];
  return lignes.filter(Boolean).join('\n');
}

const SUIVI: Record<Responsable, string> = { abdel: 'Abdel', kamel: 'Kamel' };

/** Le calendrier complet, prêt à servir en text/calendar. */
export function calendrierRelances(
  contacts: ContactCrm[],
  o: { aujourdhui: string; maintenant: string; filtre?: FiltreAgenda },
): string {
  const filtre = o.filtre ?? 'tous';
  const nom = filtre === 'tous' ? 'Relances CRM · Label Maison' : `Relances CRM · ${SUIVI[filtre]}`;
  const stamp = horodatageUtc(o.maintenant, o.maintenant);
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Label Maison Conciergerie//CRM//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapperTexte(nom)}`,
    'X-WR-CALDESC:Appels et relances du CRM de l’ERP Label Maison.',
    'X-WR-TIMEZONE:Europe/Paris',
    'X-APPLE-CALENDAR-COLOR:#7C561D',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];
  for (const e of evenementsRelance(contacts, o.aujourdhui, filtre)) {
    const c = e.contact;
    const titre = `${VERBE[c.statut]} ${c.nom}${e.enRetard ? ' (en retard)' : ''}`;
    lignes.push(
      'BEGIN:VEVENT',
      `UID:crm-${c.id.replace(/[^\w.-]/g, '')}@labelmaisoncg.fr`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${horodatageUtc(c.majLe ?? c.creeLe, o.maintenant)}`,
      `DTSTART;VALUE=DATE:${jourIcs(e.jour)}`,
      `DTEND;VALUE=DATE:${jourIcs(lendemain(e.jour))}`,
      `SUMMARY:${echapperTexte(titre)}`,
      `DESCRIPTION:${echapperTexte(description(e))}`,
      `URL:${ERP_CRM}?contact=${encodeURIComponent(c.id)}`,
      `CATEGORIES:${echapperTexte(LIBELLE_STATUT_CRM[c.statut])}`,
      'TRANSP:TRANSPARENT',
      // Rappel à 9 h le jour même (heure locale de l'appareil).
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${echapperTexte(titre)}`,
      'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lignes.push('END:VCALENDAR');
  return `${lignes.map(plier).join('\r\n')}\r\n`;
}
