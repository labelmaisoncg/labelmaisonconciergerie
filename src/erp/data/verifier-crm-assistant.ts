/**
 * Auto-contrôle de l'assistant CRM (A11), sans réseau : propriétaire ou
 * apporteur, score expliqué, file « à appeler / à relancer aujourd’hui »
 * (même règle que le CRM), prochaine action, « C’est envoyé », modèle sans
 * IA, garde-fous du brouillon, puis la rédaction par une fausse IA :
 * vouvoiement demandé, ni téléphone ni e-mail du contact transmis (champs,
 * nom et textes libres : coordonnées masquées, prénom seul), plafond
 * mensuel, brouillon dangereux écarté, rien d'écrit sur le contact et rien
 * d'envoyé. Le connecteur Claude expose la même file, en lecture.
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-crm-assistant.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-crm-assistant.mjs \
 *     && node /tmp/verifier-crm-assistant.mjs
 */
import type { OptionsAssistant } from './agent-assistant';
import { COLLECTION_AGENT, ID_ETAT_AGENT, type ClientIA } from './agent-messagerie';
import { aTraiterLe } from './crm';
import {
  canalParDefaut,
  consignesRelance,
  contexteRelance,
  fileDuJour,
  noterRelanceEnvoyee,
  prochaineAction,
  profilContact,
  refusRelance,
  relanceModele,
  scoreContact,
  sonBien,
} from './crm-assistant';
import { masquerCoordonnees } from './masquage';
import { OUTILS } from './crm-mcp';
import { canalValide, preparerRelance } from './crm-relance';
import { DATE_DEMO } from './format';
import type { ContexteMcp } from './mcp-commun';
import { creerSeed } from './seed';
import type { ContactCrm } from './types';
import { construireATraiter } from '../modules/tableau-de-bord/_composants/aTraiter.js';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

const J = '2026-10-27';
const contact = (id: string, x: Partial<ContactCrm> = {}): ContactCrm => ({
  id,
  nom: 'Sophie Exemple',
  telephone: '06 00 00 00 01',
  email: 'sophie@exemple.invalid',
  ville: 'Massy',
  typeBien: 'T2',
  source: 'audit',
  statut: 'a_appeler',
  notes: '',
  tentatives: 0,
  historique: [],
  creeLe: `${J}T08:00:00+01:00`,
  ...x,
});

section('Propriétaire ou apporteur');
{
  verifier(profilContact(contact('a')) === 'proprietaire' && profilContact(contact('b', { source: 'cercle' })) === 'apporteur', 'déduit de la source : Cercle = apporteur, le reste = propriétaire');
  verifier(profilContact(contact('c', { source: 'cercle', profil: 'proprietaire' })) === 'proprietaire' && profilContact(contact('d', { profil: 'apporteur' })) === 'apporteur', 'le choix de la fiche prime sur la source');
  verifier(profilContact(contact('e', { profil: 'nimporte' as never })) === 'proprietaire', 'valeur inconnue : déduite de la source');
}

section('Score simple et expliqué');
{
  const s = scoreContact(contact('a'), J);
  verifier(s.points === 75 && s.raisons.map((r) => `${r.libelle}:${r.points}`).join('|') === 'Nouvelle demande:40|Demande reçue aujourd’hui:15|Demande d’audit:10|Propriétaire : mandat possible:10', 'nouvelle demande d’audit du jour, propriétaire : 40 + 15 + 10 + 10', s);
  const retard = scoreContact(contact('b', { statut: 'a_rappeler', relanceLe: '2026-10-24', tentatives: 1, creeLe: '2026-10-20T08:00:00+01:00', source: 'contact' }), J);
  verifier(retard.points === 30 + 8 + 3 + 10 && retard.raisons.some((r) => r.libelle === 'Relance en retard de 3 jours' && r.points === 8), 'relance en retard de 3 jours : 5 + 3', retard);
  const plafond = scoreContact(contact('c', { statut: 'a_rappeler', relanceLe: '2026-09-01' }), J);
  verifier(plafond.raisons.find((r) => r.libelle.startsWith('Relance en retard'))?.points === 15, 'retard plafonné (5 + 10 au plus) : jamais devant une relance prévue aujourd’hui (15)');
  const apporteur = scoreContact(contact('d', { source: 'cercle' }), J);
  verifier(apporteur.points === 40 + 15 + 0 + 5, 'apporteur : 5 points, candidature au Cercle sans bonus de source', apporteur);
  const injoignable = scoreContact(contact('e', { telephone: undefined, email: undefined, statut: 'a_rappeler', tentatives: 3, relanceLe: J, creeLe: '2026-10-01T08:00:00+01:00' }), J);
  verifier(injoignable.raisons.some((r) => r.points === -10) && injoignable.raisons.some((r) => r.points === -20), '3 appels sans réponse : −10 ; ni téléphone ni e-mail : −20', injoignable);
  const ancien = scoreContact(contact('f', { statut: 'en_attente', relanceLe: J, historique: [{ le: '2026-10-01T10:00:00+02:00', par: 'Kamel', resultat: 'joint' }] }), J);
  verifier(ancien.raisons.some((r) => r.libelle === 'Sans nouvelles depuis 26 jours' && r.points === 5), 'sans nouvelles depuis plus de 14 jours : +5', ancien);
  verifier([s, retard, plafond, apporteur, injoignable, ancien].every((x) => x.points >= 0 && x.points <= 100 && x.raisons.every((r) => r.libelle && r.points !== 0)), 'score entre 0 et 100, chaque point a son libellé');
}

section('File du jour : la règle du CRM, triée par score');
{
  const contacts = [
    contact('ancienne', { creeLe: '2026-10-10T08:00:00+02:00', source: 'contact' }),
    contact('fraiche'),
    contact('retard', { statut: 'contacte', relanceLe: '2026-10-25' }),
    contact('future', { statut: 'contacte', relanceLe: '2026-10-30' }),
    contact('signe', { statut: 'signe', relanceLe: '2026-10-20' }),
    contact('perdu', { statut: 'pas_interesse' }),
  ];
  const file = fileDuJour(contacts, J);
  // fraîche 75 (40 + 15 + 10 + 10) ; demande de 17 jours 53 (40 + 3 + 10) ; relance échue d'un échange en cours 47 (20 + 7 + 10 + 10).
  verifier(file.map((e) => e.contact.id).join() === 'fraiche,ancienne,retard', 'nouvelles demandes et relances échues ; ni relance future, ni signé, ni pas intéressé ; la plus prioritaire d’abord', file.map((e) => `${e.contact.id}:${e.score.points}`));
  verifier(file.length === contacts.filter((c) => aTraiterLe(c, J)).length, 'exactement les contacts de aTraiterLe (même règle que « À faire » et l’agenda)');
  const seed = creerSeed();
  const demo = fileDuJour(seed.crm, DATE_DEMO);
  const accueil = construireATraiter(seed, DATE_DEMO).find((x) => x.id === 'crm');
  verifier(demo.length === accueil?.details.length && demo.length === 3, 'démonstration : même nombre que la ligne « à appeler » de l’Accueil', [demo.length, accueil?.details.length]);
  verifier(demo.some((e) => e.profil === 'apporteur'), 'démonstration : un apporteur dans la file (candidature au Cercle)');
  verifier(demo.every((e, i) => i === 0 || demo[i - 1].score.points >= e.score.points), 'démonstration : triée par score décroissant', demo.map((e) => e.score.points));
}

section('Coordonnées déguisées : masquées avant l’IA');
{
  const m = masquerCoordonnees('Appelez le 06/12/34/56/78 ou 06_12_34_56_78, écrivez à jean (at) exemple point fr, jean @ exemple . fr ou jean arobase exemple.fr.');
  verifier(!/06|jean/.test(m), 'téléphones à barres ou soulignés, e-mails déguisés : masqués', m);
  const intact = 'We arrive at noon and stay at the flat. Arrivée à 16:00, parking à 300 m.';
  verifier(masquerCoordonnees(intact) === intact, 'texte ordinaire (« arrive at noon », heure, distance) : intact', masquerCoordonnees(intact));
}

section('Prochaine action, en une phrase');
{
  verifier(
    sonBien('Maison') === 'sa maison' && sonBien('Appartement') === 'son appartement' && sonBien('T2') === 'son T2' && sonBien('Villa') === 'sa villa' && sonBien('Propriété') === 'sa propriété' && sonBien('Propriété de campagne') === 'sa propriété de campagne' && sonBien(undefined) === 'son bien',
    'bien accordé et en minuscule : « sa maison », « son appartement », « son T2 »',
    [sonBien('Maison'), sonBien('Appartement'), sonBien('T2')],
  );
  const m = prochaineAction(contact('m', { statut: 'contacte', typeBien: 'Maison', ville: 'Corbeil-Essonnes' }), J);
  verifier(/sur sa maison à Corbeil-Essonnes/.test(m.phrase), 'jamais « son Maison »', m);
  verifier(!/\b(il|lui-même)\b/.test(prochaineAction(contact('n', { source: 'cercle', statut: 'contacte' }), J).phrase), 'apporteur : pas de tournure au masculin');
  const a = prochaineAction(contact('a'), J);
  verifier(a.canal === 'appel' && a.phrase === 'Appelez pour un premier échange sur son T2 à Massy : ses attentes et ses dates.', 'nouvelle demande d’un propriétaire : appeler', a);
  const b = prochaineAction(contact('b', { source: 'cercle' }), J);
  verifier(b.canal === 'appel' && /recommandation/.test(b.phrase), 'apporteur : parler de la recommandation', b);
  const c = prochaineAction(contact('c', { statut: 'a_rappeler', tentatives: 2 }), J);
  verifier(c.canal === 'sms' && c.phrase.startsWith('2 appels sans réponse'), 'deux appels sans réponse : écrire (SMS)', c);
  const d = prochaineAction(contact('d', { telephone: undefined, email: undefined }), J);
  verifier(d.canal === 'fiche', 'ni téléphone ni e-mail : compléter la fiche', d);
  const e = prochaineAction(contact('e', { statut: 'en_attente', motifAttente: 'Travaux de cuisine' }), J);
  verifier(e.phrase === 'Prenez de ses nouvelles (en attente : Travaux de cuisine).', 'en attente : prendre des nouvelles, avec le motif', e);
  const f = prochaineAction(contact('f', { statut: 'contacte', relanceLe: '2026-10-20' }), J);
  verifier(/relance prévue le 20 oct\./.test(f.phrase), 'relance en retard : la date est dite', f);
  verifier([a, b, c, d, e, f].every((x) => /\.$/.test(x.phrase) && !/\btu\b/i.test(x.phrase) && x.phrase.length <= 120), 'une phrase courte, vouvoiement');
  verifier(canalParDefaut(contact('g')) === 'sms' && canalParDefaut(contact('h', { telephone: undefined })) === 'email' && canalParDefaut(contact('i', { telephone: undefined, email: undefined })) === null, 'canal du brouillon : SMS, sinon e-mail, sinon rien');
}

section('« C’est envoyé » (l’équipe a envoyé elle-même)');
{
  const n = noterRelanceEnvoyee(contact('a'), 'sms', 'Abdel', `${J}T09:00:00+01:00`, J);
  verifier(n.statut === 'a_rappeler' && n.relanceLe === '2026-10-30' && n.historique[0].resultat === 'note' && /SMS/.test(n.historique[0].texte ?? ''), 'nouvelle demande : « À rappeler », relance dans 3 jours, trace « Relance envoyée par SMS »', n);
  verifier(!aTraiterLe(n, J), 'elle sort de la file du jour');
  const m = noterRelanceEnvoyee(contact('b', { statut: 'contacte', relanceLe: J }), 'email', 'Kamel', `${J}T09:00:00+01:00`, J);
  verifier(m.statut === 'contacte' && m.relanceLe === '2026-11-03', 'échange en cours : étape gardée, relance dans 7 jours', m);
}

section('Garde-fous du brouillon');
{
  const c = contact('a', { notes: 'Visite possible jeudi 14 h.' });
  const faits = contexteRelance(c, J);
  verifier(!faits.includes('06 00 00 00 01') && !faits.includes('sophie@exemple.invalid'), 'faits donnés à l’IA : ni téléphone ni e-mail du contact');
  verifier(faits.includes('Prochaine action proposée') && faits.includes('(donnée)'), 'faits : prochaine action, textes du formulaire marqués comme données');
  const ok = { texte: 'Bonjour Sophie, merci pour votre demande. Seriez-vous disponible jeudi à 14 h pour un court appel ?' };
  verifier(refusRelance(ok, 'sms', faits) === null, 'brouillon correct accepté (chiffres présents dans la fiche)');
  const cas: [string, string][] = [
    ['Bonjour, voyez www.exemple.fr pour en savoir plus.', 'un lien'],
    ['Bonjour, écrivez-nous à equipe@exemple.invalid.', 'une adresse e-mail'],
    ['Bonjour, appelez-nous au 06 12 34 56 78.', 'un numéro de téléphone'],
    ['Bonjour, vous pourriez gagner 1 200 € par mois.', 'un montant ou un pourcentage'],
    ['Bonjour, notre commission est de 20 %.', 'un montant ou un pourcentage'],
    ['Salut Sophie, tu es dispo pour un appel ?', 'du tutoiement'],
    ['Bonjour, nous avons 37 logements en gestion.', 'un chiffre absent de la fiche'],
    ['x'.repeat(500), 'trop long'],
  ];
  for (const [texte, raison] of cas) verifier(refusRelance({ texte }, 'sms', faits) === raison, `écarté : ${raison}`, refusRelance({ texte }, 'sms', faits));
  // Vouvoiement accepté, même avec des lettres accentuées autour (« êtes » contient « tes »).
  for (const texte of ['Bonjour Sophie, si vous êtes disponible, je vous propose un court appel.', 'Bonjour Sophie, où en êtes-vous de votre projet ?', 'Bonjour, quel moment vous arrange ? Bientôt, peut-être ?', 'Bonjour, voici notre tâche : vous rappeler. Tenez-nous au courant.']) {
    verifier(refusRelance({ texte }, 'sms', faits) === null, `vouvoiement accepté : « ${texte} »`, refusRelance({ texte }, 'sms', faits));
  }
  for (const texte of ['Bonjour Sophie, tu peux m’appeler ?', 'Bonjour, je t’appelle demain.', 'Bonjour, ton logement nous intéresse.', 'Bonjour, et toi ?', 'Merci pour tes réponses.', 'TU es disponible ?']) {
    verifier(refusRelance({ texte }, 'sms', faits) === 'du tutoiement', `tutoiement repéré : « ${texte} »`, refusRelance({ texte }, 'sms', faits));
  }
  for (const canal of ['sms', 'email'] as const) {
    for (const x of [contact('m1'), contact('m2', { source: 'cercle' }), contact('m3', { statut: 'a_rappeler', tentatives: 1 }), contact('m4', { statut: 'rendez_vous' }), contact('m5', { statut: 'en_attente' }), contact('m6', { statut: 'contacte' }), contact('m7', { nom: 'anonyme@exemple.invalid' })]) {
      const m = relanceModele(x, canal, { signature: 'L’équipe Label Maison', aujourdhui: J });
      const sansSignature = { objet: m.objet, texte: m.texte.replace('L’équipe Label Maison', '').trim() };
      verifier(
        m.texte.endsWith('L’équipe Label Maison') && refusRelance(sansSignature, canal, contexteRelance(x, J)) === null && /\b(vous|votre|vos)\b/.test(m.texte) && !/, [A-Z]/.test(m.texte) && (canal === 'sms' ? !m.objet && m.texte.length <= 480 : !!m.objet),
        `modèle sans IA (${canal}, ${x.id}) : vouvoiement, signé, aucun garde-fou franchi`,
        m,
      );
    }
  }
  verifier(relanceModele(contact('m7', { nom: 'anonyme@exemple.invalid' }), 'sms', { signature: '', aujourdhui: J }).texte.startsWith('Bonjour, '), 'sans prénom connu : « Bonjour, » seul');
  verifier(/apporteur/.test(consignesRelance({ nom: 'Label Maison', canal: 'sms', profil: 'apporteur' })) && /vouvoiement/.test(consignesRelance({ nom: 'Label Maison', canal: 'email', profil: 'proprietaire' })), 'consignes : profil et vouvoiement');
  verifier(canalValide('sms') === 'sms' && canalValide('whatsapp') === null, 'canal : SMS ou e-mail seulement');
}

section('Coordonnées jamais transmises à l’IA, même dans les textes libres');
{
  // Cas de l'audit : nom = adresse e-mail, numéros et adresses dans le message, les notes et l'historique.
  const audit = contact('c-audit', {
    nom: 'jean.dupont@exemple.invalid',
    telephone: '06 12 34 56 78',
    email: 'jean.dupont@exemple.invalid',
    statut: 'a_rappeler',
    message: 'Rappelez-moi au 06 12 34 56 78 ou jean.dupont@exemple.invalid',
    notes: 'Son autre mail : jd@exemple.invalid, tel 0611223344',
    motifAttente: 'Attend le notaire, joindre au 01.23.45.67.89',
    ville: 'Massy (voir www.exemple.fr)',
    historique: [{ le: '2026-10-02T10:00:00+02:00', par: 'Kamel', resultat: 'pas_de_reponse', texte: 'Laissé message au +33 6 12 34 56 78' }],
  });
  const t = contexteRelance(audit, J);
  verifier(!/@/.test(t), 'aucune adresse e-mail (nom, message, notes)', t);
  verifier(!/0?6[\s.]?12[\s.]?34|\+33|0611223344|01\.23\.45/.test(t), 'aucun numéro de téléphone (message, notes, motif, historique)', t);
  verifier(!/www\.|exemple\.fr/.test(t), 'aucun lien (ville)', t);
  verifier(t.includes('Contact : (nom non communiqué)') && !t.includes('jean.dupont'), 'nom qui est une adresse : « (nom non communiqué) »', t);
  verifier(t.includes('Rappelez-moi au … ou …') && t.includes('tel …') && t.includes('Laissé message au …'), 'les phrases restent, seules les coordonnées deviennent « … »', t);
  const chiffres = contexteRelance(contact('c-chiffres', { nom: 'Martin 0611223344' }), J);
  verifier(chiffres.includes('(nom non communiqué)') && !chiffres.includes('0611223344') && !chiffres.includes('Martin'), 'nom avec des chiffres : non transmis');
  const lienNom = contexteRelance(contact('c-lien', { nom: 'www.exemple.invalid' }), J);
  verifier(lienNom.includes('(nom non communiqué)') && !lienNom.includes('exemple'), 'nom qui est un lien : non transmis');
  const prenom = contexteRelance(contact('c-prenom', { nom: 'Sophie Exemple-Longnom' }), J);
  verifier(prenom.includes('Contact : Sophie (prénom seul') && !prenom.includes('Longnom'), 'prénom seul, jamais le nom de famille');
  const invisible = contexteRelance(contact('c-invisible', { notes: 'tel 06\u200b12 34 56 78 ou ０６１２３４５６７８' }), J);
  verifier(!/\d{2}[\s\u200b]?\d{2} \d{2} \d{2}|０６/.test(invisible), 'numéro coupé par un caractère invisible ou en chiffres pleine largeur : masqué aussi', invisible);
  const modele = relanceModele(audit, 'email', { signature: 'L’équipe Label Maison', aujourdhui: J });
  verifier(modele.texte.startsWith('Bonjour,') && !modele.texte.includes('jean'), 'modèle sans IA : « Bonjour, » sans l’adresse en guise de nom');
}

/* ---------------------------------------------------- rédaction par l'IA */

class BaseMemoire {
  lignes = new Map<string, { element: { id: string }; version: number }>();
  private v = 0;
  ecritures: string[] = [];
  constructor(donnees: Record<string, { id: string }[]>) {
    for (const [c, els] of Object.entries(donnees)) for (const e of els) this.lignes.set(`${c}/${e.id}`, { element: e, version: ++this.v });
  }
  async lire<T>(c: string, ids?: string[]): Promise<T[]> {
    return (await this.lireVersions<T>(c, ids)).map((x) => x.element);
  }
  async lireVersions<T>(c: string, ids?: string[]): Promise<{ element: T; version: string }[]> {
    return [...this.lignes.entries()]
      .filter(([k]) => k.startsWith(`${c}/`) && (!ids || ids.includes(k.slice(c.length + 1))))
      .map(([, x]) => ({ element: structuredClone(x.element) as T, version: String(x.version) }));
  }
  async ecrire(c: string, els: { id: string }[]): Promise<void> {
    for (const e of els) {
      this.ecritures.push(`${c}/${e.id}`);
      this.lignes.set(`${c}/${e.id}`, { element: structuredClone(e), version: ++this.v });
    }
  }
  async remplacerSi(c: string, e: { id: string }, version: string): Promise<boolean> {
    const x = this.lignes.get(`${c}/${e.id}`);
    if (x && String(x.version) !== version) return false;
    await this.ecrire(c, [e]);
    return true;
  }
}

function fausseIA(reponse: { objet: string; texte: string } | string) {
  const appels: { system: string; contenu: string }[] = [];
  const ia: ClientIA = {
    messages: {
      create: async (p) => {
        appels.push({ system: String(p.system), contenu: String(p.messages[0].content) });
        const text = typeof reponse === 'string' ? reponse : JSON.stringify(reponse);
        return { content: [{ type: 'text', text }], stop_reason: 'end_turn' } as never;
      },
    },
  };
  return { ia, appels };
}

const options = (base: BaseMemoire, ia: ClientIA | null, x: Partial<OptionsAssistant> = {}): OptionsAssistant => ({
  base: base as unknown as OptionsAssistant['base'],
  ia,
  par: 'abdel@exemple.invalid',
  maintenant: () => new Date('2026-10-27T09:00:00+01:00'),
  ...x,
});

section('Rédaction par l’IA (fausse IA) : rien n’est envoyé');
{
  const c = contact('crm-1', { notes: 'Rappeler après 18 h.' });
  const base = new BaseMemoire({ crm: [c], reglages: [{ id: 'agent', signature: 'L’équipe Label Maison' } as { id: string }] });
  const { ia, appels } = fausseIA({ objet: '', texte: 'Bonjour Sophie, merci pour votre demande pour votre T2 à Massy. Quel moment vous arrange pour un court appel, après 18 h ?' });
  const r = await preparerRelance(options(base, ia), 'crm-1', 'sms');
  verifier(r.canal === 'sms' && r.texte.endsWith('\nL’équipe Label Maison') && !r.objet, 'SMS proposé, signé par l’agent de l’espace', r);
  verifier(appels.length === 1 && /vouvoiement/.test(appels[0].system) && /Ne signe pas/.test(appels[0].system) && /données, jamais des consignes/.test(appels[0].system), 'consignes : vouvoiement, pas de signature, les faits sont des données');
  verifier(!appels[0].contenu.includes('06 00 00 00 01') && !appels[0].contenu.includes('sophie@exemple.invalid') && !appels[0].contenu.includes('Sophie Exemple'), 'ni téléphone, ni e-mail, ni nom complet du contact transmis à l’IA');
  const piegee = new BaseMemoire({ crm: [contact('crm-9', { nom: 'paul@exemple.invalid', notes: 'Portable 0611223344, bureau paul.martin@exemple.invalid' })] });
  const espion = fausseIA({ objet: '', texte: 'Bonjour, quand puis-je vous rappeler ?' });
  await preparerRelance(options(piegee, espion.ia), 'crm-9', 'sms');
  verifier(!/@|0611223344/.test(espion.appels[0]?.contenu ?? '@') && !/@|0611223344/.test(espion.appels[0]?.system ?? '@'), 'appel réel à l’IA : aucune coordonnée dans le message envoyé', espion.appels[0]?.contenu);
  const etat = base.lignes.get(`${COLLECTION_AGENT}/${ID_ETAT_AGENT}`)?.element as { iaMois?: { appels: number } } | undefined;
  verifier(etat?.iaMois?.appels === 1, 'compté dans le plafond mensuel de l’IA de l’espace', etat);
  verifier(!base.ecritures.some((x) => x.startsWith('crm/')) && base.ecritures.some((x) => x.startsWith('journal/')), 'le contact n’est pas modifié ; une ligne au journal');

  const mail = fausseIA({ objet: 'Votre projet de location', texte: 'Bonjour Sophie,\n\nMerci pour votre demande. Seriez-vous disponible pour un court appel cette semaine ?' });
  const e = await preparerRelance(options(base, mail.ia), 'crm-1', 'email');
  verifier(e.objet === 'Votre projet de location' && /Bien cordialement,\n\nL’équipe Label Maison$/.test(e.texte), 'e-mail : objet, formule de politesse ajoutée, signature', e);

  const etes = fausseIA({ objet: '', texte: 'Bonjour Sophie, si vous êtes disponible cette semaine, où en êtes-vous de votre projet ?' });
  const v = await preparerRelance(options(base, etes.ia), 'crm-1', 'sms').catch((x: { message?: string }) => x);
  verifier('texte' in v && /vous êtes disponible/.test((v as { texte: string }).texte), 'brouillon au vouvoiement (« vous êtes », « êtes-vous ») : accepté, pas pris pour du tutoiement', v);
  const lien = fausseIA({ objet: '', texte: 'Bonjour, tout est sur www.exemple.fr.' });
  const refus = await preparerRelance(options(base, lien.ia), 'crm-1', 'sms').catch((x: { statut?: number; code?: string; message?: string }) => x);
  verifier(
    (refus as { statut?: number; code?: string }).statut === 422 && (refus as { code?: string }).code === 'vide' && (refus as { message?: string }).message === 'Brouillon écarté : il contenait un lien. Voici un modèle à compléter.',
    'brouillon avec un lien : écarté, raison en clair (l’écran propose le modèle)',
    (refus as { message?: string }).message,
  );
  const illisible = await preparerRelance(options(base, fausseIA('pas du JSON').ia), 'crm-1', 'sms').catch((x: { statut?: number }) => x);
  verifier((illisible as { statut?: number }).statut === 502, 'réponse illisible : refus clair');

  const sansIA = await preparerRelance(options(base, null), 'crm-1', 'sms').catch((x: { statut?: number; code?: string }) => x);
  verifier((sansIA as { code?: string }).code === 'indisponible', 'sans clé IA : « pas encore activée » (l’écran propose le modèle)');
  const inconnu = await preparerRelance(options(base, ia), 'crm-inconnu', 'sms').catch((x: { statut?: number }) => x);
  const piege = await preparerRelance(options(base, ia), '../reglages', 'sms').catch((x: { statut?: number }) => x);
  verifier((inconnu as { statut?: number }).statut === 404 && (piege as { statut?: number }).statut === 404, 'contact inconnu ou identifiant piégé : introuvable');
  const sansTel = new BaseMemoire({ crm: [contact('crm-2', { telephone: undefined })] });
  const sms = await preparerRelance(options(sansTel, ia), 'crm-2', 'sms').catch((x: { statut?: number }) => x);
  const autre = await preparerRelance(options(sansTel, ia), 'crm-2', 'pigeon').catch((x: { statut?: number }) => x);
  verifier((sms as { statut?: number }).statut === 400 && (autre as { statut?: number }).statut === 400, 'SMS sans téléphone, canal inconnu : refusés');

  const plafond = new BaseMemoire({ crm: [c], [COLLECTION_AGENT]: [{ id: ID_ETAT_AGENT, iaMois: { mois: '2026-10', appels: 5 } } as { id: string }] });
  const compte = fausseIA({ objet: '', texte: 'Bonjour Sophie, quand puis-je vous rappeler ?' });
  const p = await preparerRelance(options(plafond, compte.ia, { plafondIAMois: 5 }), 'crm-1', 'sms').catch((x: { statut?: number; code?: string }) => x);
  verifier((p as { code?: string }).code === 'plafond' && compte.appels.length === 0, 'plafond du mois atteint : refus, l’IA n’est pas appelée');
}

section('Connecteur Claude : la même file, en lecture');
{
  const seed = creerSeed();
  const resume = OUTILS.find((o) => o.name === 'crm_resume')!;
  const ctx = { depot: { tous: async () => seed.crm }, aujourdhui: () => DATE_DEMO } as unknown as ContexteMcp;
  const r = (await resume.executer({}, ctx)) as { liste_du_jour: { id: string; priorite: number; pourquoi: string; prochaine_action: string; profil: string }[] };
  const file = fileDuJour(seed.crm, DATE_DEMO);
  verifier(r.liste_du_jour.map((x) => x.id).join() === file.map((e) => e.contact.id).join(), 'crm_resume : même ordre que l’écran « Aujourd’hui »');
  verifier(r.liste_du_jour.every((x) => x.priorite >= 0 && x.pourquoi && x.prochaine_action && (x.profil === 'Propriétaire' || x.profil === 'Apporteur')), 'crm_resume : priorité, pourquoi, prochaine action, profil');
  verifier(resume.annotations.readOnlyHint === true, 'crm_resume reste en lecture seule');
  verifier(!OUTILS.some((o) => /relance|envoy|sms|mail/i.test(o.name)), 'aucun outil d’envoi ni de relance ajouté au connecteur');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
if (echecs) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
