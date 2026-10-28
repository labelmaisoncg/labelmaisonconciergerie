/**
 * Actions de l'IA de démonstration (copilote) : quelques actions de Claude
 * et de l'agent, tirées du jeu de démo lui-même (mêmes contacts, mêmes
 * conversations) pour que « Annuler » y marche comme en vrai. Ce qui était
 * là avant l'action est reconstitué ; l'élément du jeu est l'« après ».
 */
import { actionAgentMessagerie, actionClaude } from './copilote';
import { ID_LABEL_MAISON } from './espaces';
import { AUJOURDHUI, ajouterJours } from './format';
import { checklistMenageVierge } from './constantes';
import type { ContactCrm, ErpDonnees, FilMessages, Mission } from './types';
import type { ActionAgent } from './types-copilote';

const h = (jours: number, heure: string) => `${ajouterJours(AUJOURDHUI, jours)}T${heure}:00+02:00`;
const CLAUDE = { genre: 'oauth' as const, client: 'claude-demo' };

export function creerActionsAgentDemo(d: Pick<ErpDonnees, 'crm' | 'filsMessages' | 'logements'>): ActionAgent[] {
  const res: ActionAgent[] = [];
  const logement = (f: FilMessages) => d.logements.find((l) => l.id === f.logementId);

  // Votre agent : réponse préparée, à valider (« À envoyer » dans la Messagerie).
  const aValider = d.filsMessages.find((f) => f.agent?.decision === 'a_valider' && f.agent.brouillon);
  if (aValider?.agent?.brouillon) {
    const { agent: _a, analyse: _x, ...avant } = aValider;
    res.push(
      actionAgentMessagerie({
        id: 'act-demo-agent-valider',
        sort: 'a_valider',
        avant: avant as FilMessages,
        apres: aValider,
        le: aValider.agent.brouillon.le,
        espace: ID_LABEL_MAISON,
        motif: aValider.agent.brouillon.motif,
        logement: logement(aValider),
      }),
    );
  }

  // Votre agent : réponse envoyée seule (niveau d'autonomie du gérant).
  const repondu = d.filsMessages.find((f) => f.traitePar === 'agent' && f.statut === 'clos' && f.messages.some((m) => m.auteur === 'agent'));
  const reponse = repondu?.messages.find((m) => m.auteur === 'agent');
  if (repondu && reponse) {
    res.push(
      actionAgentMessagerie({
        id: 'act-demo-agent-envoi',
        sort: 'envoyee',
        avant: { ...repondu, messages: repondu.messages.filter((m) => m.envoyeLe < reponse.envoyeLe) },
        apres: repondu,
        le: reponse.envoyeLe,
        espace: ID_LABEL_MAISON,
        texte: reponse.texte,
        logement: logement(repondu),
      }),
    );
  }

  // Votre agent : conversation transmise (remboursement demandé), avec un message d'attente.
  const transmis = d.filsMessages.find((f) => f.statut === 'escalade' && f.messages.some((m) => /rembourse/i.test(m.texte)));
  const attente = transmis?.messages.find((m) => m.auteur === 'agent');
  if (transmis && attente) {
    res.push(
      actionAgentMessagerie({
        id: 'act-demo-agent-transmis',
        sort: 'transmise',
        avant: { ...transmis, statut: 'ouvert', traitePar: 'agent' },
        apres: transmis,
        le: attente.envoyeLe,
        espace: ID_LABEL_MAISON,
        motif: 'question d’argent : le voyageur demande un remboursement partiel (salle de bain trouvée sale).',
        texte: attente.texte,
        logement: logement(transmis),
      }),
    );
  }

  // Claude : relance prévue sur une fiche du CRM.
  const leroy = d.crm.find((c) => c.id === 'crm-demo-04');
  if (leroy?.relanceLe) {
    const { relanceLe: _r, ...avant } = leroy;
    res.push(actionClaude({ id: 'act-demo-claude-relance', outil: 'crm_modifier', collection: 'crm', avant, apres: leroy, cible: leroy.nom, le: h(-1, '18:20'), espace: ID_LABEL_MAISON, client: CLAUDE }));
  }

  // Claude : contact passé « En attente » (travaux), relance dans un mois.
  const haddad = d.crm.find((c) => c.id === 'crm-demo-05');
  if (haddad) {
    const { motifAttente: _m, relanceLe: _r, ...reste } = haddad;
    const avant: ContactCrm = { ...reste, statut: 'contacte' };
    res.push(actionClaude({ id: 'act-demo-claude-attente', outil: 'crm_modifier', collection: 'crm', avant, apres: haddad, cible: haddad.nom, le: h(-2, '17:05'), espace: ID_LABEL_MAISON, client: CLAUDE }));
  }

  // Claude : « Pas besoin de répondre » sur un merci du voyageur.
  const merci = d.filsMessages.find((f) => f.statut === 'clos' && f.traitePar === 'humain' && f.messages[f.messages.length - 1]?.auteur === 'voyageur');
  if (merci) {
    const avant: FilMessages = { ...merci, statut: 'ouvert', traitePar: 'en_attente' };
    res.push(
      actionClaude({
        id: 'act-demo-claude-terminee',
        outil: 'conversation_pas_besoin_de_repondre',
        collection: 'filsMessages',
        avant,
        apres: merci,
        cible: merci.voyageur,
        le: h(-1, '12:40'),
        espace: ID_LABEL_MAISON,
        client: CLAUDE,
      }),
    );
  }

  // Claude : un ménage prévu, puis annulé par le gérant (il n'est plus au planning).
  const l = d.logements.find((x) => x.statut === 'actif');
  if (l) {
    const mission: Mission = {
      id: 'mis-demo-claude',
      type: 'menage',
      logementId: l.id,
      date: ajouterJours(AUJOURDHUI, 3),
      heureDebut: '11:00',
      heureFinMax: '16:00',
      statut: 'a_attribuer',
      checklist: checklistMenageVierge(),
      photos: [],
      tarifCentimes: 0,
      controleQualite: false,
      commentaire: 'Prévu par Claude.',
      interne: true,
    };
    const a = actionClaude({ id: 'act-demo-claude-menage', outil: 'menage_creer', collection: 'missions', apres: mission, cible: l.nom, le: h(-1, '09:15'), espace: ID_LABEL_MAISON, client: CLAUDE });
    res.push({ ...a, etat: 'annulee', annulation: { le: h(0, '08:10'), par: 'Abdel' } });
  }

  return res.sort((x, y) => y.le.localeCompare(x.le));
}
