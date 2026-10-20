/**
 * Vérification de l'agenda des relances (src/erp/data/agenda-crm.ts) : règles
 * du CRM, format iCalendar (RFC 5545), échappement et pliage des lignes.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-agenda.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-agenda.cjs \
 *     && node /tmp/verifier-agenda.cjs
 */
import { calendrierRelances, echapperTexte, evenementsRelance, plier } from './agenda-crm';
import type { ContactCrm } from './types';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

const base = { notes: '', tentatives: 0, historique: [], source: 'audit' as const, creeLe: '2026-10-18T10:00:00+02:00' };
const C: ContactCrm[] = [
  { ...base, id: 'c-nouveau', nom: 'Nouvelle Demande', statut: 'a_appeler', telephone: '06 00 00 00 01', creeLe: '2026-10-20T08:00:00+02:00' },
  { ...base, id: 'c-ancien', nom: 'Demande Oubliée', statut: 'a_appeler' },
  { ...base, id: 'c-retard', nom: 'Karim, Benali; fils', statut: 'a_rappeler', relanceLe: '2026-10-15', tentatives: 2, responsable: 'kamel' },
  { ...base, id: 'c-futur', nom: 'Julie Moreau', statut: 'en_attente', relanceLe: '2026-11-03', motifAttente: 'Travaux\nde cuisine', responsable: 'abdel' },
  { ...base, id: 'c-rdv', nom: 'Pierre Dubois', statut: 'rendez_vous', relanceLe: '2026-10-22', responsable: 'abdel' },
  { ...base, id: 'c-sans', nom: 'Sans Relance', statut: 'contacte' },
  { ...base, id: 'c-signe', nom: 'Client Signé', statut: 'signe', relanceLe: '2026-10-25' },
  { ...base, id: 'c-non', nom: 'Pas Intéressé', statut: 'pas_interesse', relanceLe: '2026-10-25' },
];
const J = '2026-10-20';
const ics = calendrierRelances(C, { aujourdhui: J, maintenant: '2026-10-20T09:30:00+02:00' });

function main() {
  // Règles du CRM
  const ev = evenementsRelance(C, J);
  const ids = ev.map((e) => e.contact.id);
  verifier(!ids.includes('c-signe') && !ids.includes('c-non'), 'signés et pas intéressés exclus');
  verifier(!ids.includes('c-sans'), 'contact sans relance ni demande : pas d’événement');
  verifier(ev.find((e) => e.contact.id === 'c-nouveau')?.jour === J && !ev.find((e) => e.contact.id === 'c-nouveau')!.enRetard, 'nouvelle demande du jour : aujourd’hui');
  verifier(ev.find((e) => e.contact.id === 'c-ancien')?.enRetard === true, 'demande non rappelée depuis des jours : en retard');
  const retard = ev.find((e) => e.contact.id === 'c-retard');
  verifier(retard?.jour === J && retard.enRetard, 'relance échue : ramenée à aujourd’hui, en retard');
  verifier(ev.find((e) => e.contact.id === 'c-futur')?.jour === '2026-11-03', 'relance future : à sa date');
  verifier(ids.join() === 'c-ancien,c-retard,c-nouveau,c-rdv,c-futur', `ordre chronologique (${ids.join()})`);
  verifier(evenementsRelance(C, J, 'abdel').map((e) => e.contact.id).join() === 'c-ancien,c-nouveau,c-rdv,c-futur', 'filtre « Abdel » : ses contacts et ceux sans suivi');
  verifier(evenementsRelance(C, J, 'kamel').map((e) => e.contact.id).join() === 'c-ancien,c-retard,c-nouveau', 'filtre « Kamel » : ses contacts et ceux sans suivi');

  // Format iCalendar
  verifier(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'), 'enveloppe VCALENDAR, fins de ligne CRLF');
  verifier(!/[^\r]\n/.test(ics), 'aucun saut de ligne sans CR');
  verifier((ics.match(/BEGIN:VEVENT/g) ?? []).length === 5 && (ics.match(/END:VEVENT/g) ?? []).length === 5, '5 événements');
  verifier(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'lignes de 75 octets au plus');
  verifier(/UID:crm-c-retard@labelmaisoncg\.fr/.test(ics), 'UID stable par contact');
  verifier(/DTSTART;VALUE=DATE:20261103\r\nDTEND;VALUE=DATE:20261104/.test(ics), 'journée entière (DTEND exclusif)');
  verifier(/DTSTART;VALUE=DATE:20261101/.test(calendrierRelances([{ ...C[3], relanceLe: '2026-10-31' }], { aujourdhui: J, maintenant: J })) === false && /DTEND;VALUE=DATE:20261101/.test(calendrierRelances([{ ...C[3], relanceLe: '2026-10-31' }], { aujourdhui: J, maintenant: J })), 'fin de mois : lendemain correct');
  verifier(/SUMMARY:Rappeler Karim\\, Benali\\; fils \(en retard\)/.test(ics), 'titre : verbe, nom échappé, retard');
  verifier(/SUMMARY:Rendez-vous : Pierre Dubois/.test(ics) && /SUMMARY:Appeler Nouvelle Demande/.test(ics), 'titres selon l’étape');
  const deplie = ics.replace(/\r\n /g, '');
  verifier(/En attente de : Travaux\\nde cuisine/.test(deplie), 'retour à la ligne échappé dans la description');
  verifier(/Téléphone : 06 00 00 00 01/.test(deplie) && /URL:https:\/\/www\.labelmaisoncg\.fr\/erp\/crm\?contact=c-nouveau/.test(deplie), 'téléphone et lien vers la fiche');
  verifier(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:PT9H\r\nEND:VALARM/.test(deplie), 'rappel à 9 h');
  verifier(/DTSTAMP:20261020T073000Z/.test(ics), 'DTSTAMP en UTC');
  verifier(/X-WR-CALNAME:Relances CRM · Abdel/.test(calendrierRelances(C, { aujourdhui: J, maintenant: J, filtre: 'abdel' })), 'nom du calendrier filtré');

  // Outils
  verifier(echapperTexte('a,b;c\\d\ne') === 'a\\,b\\;c\\\\d\\ne', 'échappement RFC 5545');
  const long = `DESCRIPTION:${'é'.repeat(60)}`;
  const plie = plier(long);
  verifier(plie.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75) && plie.replace(/\r\n /g, '') === long, 'pliage sans couper un caractère accentué');
  verifier(calendrierRelances([], { aujourdhui: J, maintenant: J }).includes('BEGIN:VCALENDAR') && !calendrierRelances([], { aujourdhui: J, maintenant: J }).includes('VEVENT'), 'CRM vide : calendrier valide, sans événement');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main();
