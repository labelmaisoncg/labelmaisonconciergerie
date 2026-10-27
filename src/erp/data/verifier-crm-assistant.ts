/**
 * Auto-contrôle de l'assistant CRM (A11), sans réseau : propriétaire ou
 * apporteur, score expliqué, file « à appeler / à relancer aujourd’hui »
 * (même règle que le CRM), prochaine action, « C’est envoyé », modèle sans
 * IA, garde-fous du brouillon, puis la rédaction par une fausse IA :
 * vouvoiement demandé, ni téléphone ni e-mail du contact transmis, plafond
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
} from './crm-assistant';
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
  verifier(retard.points === 30 + 18 + 3 + 10 && retard.raisons.some((r) => r.libelle === 'Relance en retard de 3 jours' && r.points === 18), 'relance en retard de 3 jours : 15 + 3', retard);
  const plafond = scoreContact(contact('c', { statut: 'a_rappeler', relanceLe: '2026-09-01' }), J);
  verifier(plafond.raisons.find((r) => r.libelle.startsWith('Relance en retard'))?.points === 25, 'retard plafonné (15 + 10 au plus)');
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
  // fraîche 75 (40 + 15 + 10 + 10) ; relance échue d'un échange en cours 57 (20 + 17 + 10 + 10) ; demande de 17 jours 53 (40 + 3 + 10).
  verifier(file.map((e) => e.contact.id).join() === 'fraiche,retard,ancienne', 'nouvelles demandes et relances échues ; ni relance future, ni signé, ni pas intéressé ; la plus prioritaire d’abord', file.map((e) => `${e.contact.id}:${e.score.points}`));
  verifier(file.length === contacts.filter((c) => aTraiterLe(c, J)).length, 'exactement les contacts de aTraiterLe (même règle que « À faire » et l’agenda)');
  const seed = creerSeed();
  const demo = fileDuJour(seed.crm, DATE_DEMO);
  const accueil = construireATraiter(seed, DATE_DEMO).find((x) => x.id === 'crm');
  verifier(demo.length === accueil?.details.length && demo.length === 3, 'démonstration : même nombre que la ligne « à appeler » de l’Accueil', [demo.length, accueil?.details.length]);
  verifier(demo.some((e) => e.profil === 'apporteur'), 'démonstration : un apporteur dans la file (candidature au Cercle)');
  verifier(demo.every((e, i) => i === 0 || demo[i - 1].score.points >= e.score.points), 'démonstration : triée par score décroissant', demo.map((e) => e.score.points));
}

section('Prochaine action, en une phrase');
{
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
  verifier(!appels[0].contenu.includes('06 00 00 00 01') && !appels[0].contenu.includes('sophie@exemple.invalid'), 'ni téléphone ni e-mail du contact transmis à l’IA');
  const etat = base.lignes.get(`${COLLECTION_AGENT}/${ID_ETAT_AGENT}`)?.element as { iaMois?: { appels: number } } | undefined;
  verifier(etat?.iaMois?.appels === 1, 'compté dans le plafond mensuel de l’IA de l’espace', etat);
  verifier(!base.ecritures.some((x) => x.startsWith('crm/')) && base.ecritures.some((x) => x.startsWith('journal/')), 'le contact n’est pas modifié ; une ligne au journal');

  const mail = fausseIA({ objet: 'Votre projet de location', texte: 'Bonjour Sophie,\n\nMerci pour votre demande. Seriez-vous disponible pour un court appel cette semaine ?' });
  const e = await preparerRelance(options(base, mail.ia), 'crm-1', 'email');
  verifier(e.objet === 'Votre projet de location' && /Bien cordialement,\n\nL’équipe Label Maison$/.test(e.texte), 'e-mail : objet, formule de politesse ajoutée, signature', e);

  const lien = fausseIA({ objet: '', texte: 'Bonjour, tout est sur www.exemple.fr.' });
  const refus = await preparerRelance(options(base, lien.ia), 'crm-1', 'sms').catch((x: { statut?: number; code?: string; message?: string }) => x);
  verifier((refus as { statut?: number; code?: string }).statut === 422 && (refus as { code?: string }).code === 'vide', 'brouillon avec un lien : écarté (l’écran propose le modèle)', refus);
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
