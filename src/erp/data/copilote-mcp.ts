/**
 * Outils « copilote » du connecteur Claude (MCP), cahier A15 : ce que Claude
 * peut faire de plus que lire et tenir le CRM.
 *
 * - reponse_proposer : range une réponse au voyageur dans la conversation ;
 *   l'équipe la relit et l'envoie depuis la Messagerie (confirmation). Rien
 *   n'est envoyé par le connecteur. Argent, données personnelles, codes
 *   d'accès : refusée, l'équipe écrit elle-même.
 * - menage_creer : un ménage au planning interne de l'ERP, jamais transmis
 *   à un prestataire ni à une plateforme de ménage.
 * - facture_preparer : le brouillon de la facture mensuelle d'un
 *   propriétaire, s'il n'existe pas ; jamais validé, numéroté, envoyé ni
 *   encaissé ici (le gérant le fait dans l'ERP).
 * - prix_conseils : les prix conseillés, en LECTURE SEULE. « Ajuster un
 *   prix » reste un conseil : aucun prix n'est écrit, nulle part.
 *
 * Chaque écriture passe par contexteTrace (copilote.ts) : tracée avant
 * d'être faite, annulable par le gérant (Paramètres → Actions de l'IA).
 * Imports en « .js » : ce module tourne côté serveur.
 */
import { attendEquipe, filVise, idValide, logementVise, prenomInitiale } from './cm-mcp.js';
import { checklistMenageVierge } from './constantes.js';
import { ID_LABEL_MAISON } from './espaces.js';
import { calculerFactureMois, factureFigee, idFactureMensuelle, moisAFacturerAutomatiquement, preparerBrouillon } from './factures-mensuelles.js';
import { identiteConciergerie } from './identite-conciergerie.js';
import { MOTIF_EMAIL, MOTIF_LIEN, MOTIF_EMAIL_DEGUISE, MOTIF_TELEPHONE, masquerCoordonnees } from './masquage.js';
import { date, ECRITURE, ErreurOutil, LECTURE, texte, type Args, type ContexteMcp, type DepotCopilote, type Outil } from './mcp-commun.js';
import { consigneCachee, contientCodeAcces, langueProbable, masquerCodes, messagesSansReponse, offreSupplement, reponseAEcarter } from './messagerie-ia.js';
import { conseillerPrix, eurosRonds, lireElementsPrix, plusJours, texteNuits } from './prix-conseils.js';
import { logementsDe, moisDe, moisValide } from './proprietaire.js';
import { eurosTexte, moisTexte } from './copilote.js';
import type { BrouillonAgent, Facture, FilMessages, Logement, Mission, Proprietaire } from './types';

const ERP = 'https://www.labelmaisoncg.fr/erp';
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PAR_CLAUDE = 'Claude';
const SIGNE_ANNULATION = 'Le gérant peut l’annuler dans l’ERP (Paramètres → Actions de l’IA).';

/** Le copilote de l'espace, ou une erreur lisible. */
function copiloteDe(ctx: ContexteMcp): DepotCopilote {
  if (!ctx.copilote) throw new ErreurOutil('Indisponible pour le moment : réessayez dans un instant.');
  return ctx.copilote;
}

const heure = (v: unknown, nom: string): string | undefined => {
  const h = texte(v, nom, 5);
  if (!h) return undefined;
  if (!HEURE.test(h)) throw new ErreurOutil(`« ${nom} » doit être une heure HH:MM (ex. 11:00).`);
  return h;
};

const ecartJours = (de: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** Note interne : sans coordonnées ni codes (codes et wifi du logement compris). */
function noteSure(t: string, l: Logement): string {
  let s = masquerCodes(masquerCoordonnees(t)).replace(/\[code communiqué[^\]]*\]/g, '[code masqué]');
  for (const c of [l.fiche?.wifiCode, l.fiche?.wifiNom].map((x) => String(x ?? '').trim()).filter((x) => x.length >= 4)) s = s.split(c).join('••••');
  return s.trim();
}

function vueMission(m: Mission, l: Pick<Logement, 'nom'>) {
  return {
    id: m.id,
    logement: l.nom,
    jour: m.date,
    de: m.heureDebut,
    a: m.heureFinMax,
    statut: 'À attribuer (interne à l’ERP)',
    ...(m.reservationId ? { reservation_id: m.reservationId } : {}),
  };
}

function vueFacture(f: Facture) {
  return {
    mois: moisTexte(f.mensuelle?.mois ?? ''),
    statut: factureFigee(f) ? `Validée, n° ${f.numero}` : f.statut === 'annulee' ? 'Écartée (ne pas facturer ce mois)' : 'Brouillon, sans numéro',
    montant_ht: eurosTexte(f.montantHtCentimes ?? 0),
    ...(f.tvaPct ? { tva: `${f.tvaPct} %` } : {}),
    // Libellés et montants seulement : le détail des séjours nomme les voyageurs.
    lignes: (f.lignes ?? []).map((l) => ({ libelle: l.libelle, montant: eurosTexte(Math.round((l.quantite ?? 1) * (l.puCentimes ?? 0))) })),
  };
}

function proprietaireVise(a: Args, proprietaires: Proprietaire[]): Proprietaire {
  const liste = () => proprietaires.slice(0, 10).map((p) => `${p.nom} (id ${p.id})`).join(' ; ');
  if (a.proprietaire_id !== undefined && a.proprietaire_id !== null && a.proprietaire_id !== '') {
    const id = idValide(a.proprietaire_id, 'proprietaire_id', 'voir « recherche »');
    const p = proprietaires.find((x) => x.id === id);
    if (!p) throw new ErreurOutil(`Aucun propriétaire avec l’id « ${id} ». Propriétaires : ${liste() || 'aucun'}.`);
    return p;
  }
  const q = (texte(a.recherche, 'recherche', 120) ?? '').toLowerCase();
  if (!q) throw new ErreurOutil(`Indiquez « proprietaire_id » ou « recherche » (nom). Propriétaires : ${liste() || 'aucun'}.`);
  const trouves = proprietaires.filter((p) => p.nom.toLowerCase().includes(q));
  if (trouves.length === 1) return trouves[0];
  if (!trouves.length) throw new ErreurOutil(`Aucun propriétaire ne correspond à « ${q} ». Propriétaires : ${liste() || 'aucun'}.`);
  throw new ErreurOutil(`${trouves.length} propriétaires correspondent : ${trouves.slice(0, 8).map((p) => `${p.nom} (id ${p.id})`).join(' ; ')}. Précisez l’id.`);
}

const proprietesLogement = {
  logement_id: { type: 'string', description: 'Identifiant du logement (donné par logements_lister).' },
  recherche: { type: 'string', description: 'Ou une partie du nom ou de la ville, si un seul logement correspond.' },
};

export const OUTILS_COPILOTE: Outil[] = [
  {
    name: 'reponse_proposer',
    title: 'Proposer une réponse (l’équipe l’envoie)',
    description:
      "Range votre réponse au voyageur dans la conversation de l'ERP : elle y apparaît déjà écrite (« Proposée par Claude ») et l'équipe la relit puis l'envoie elle-même depuis la Messagerie. Ce connecteur n'envoie RIEN au voyageur ni à la plateforme. Écrivez dans la langue du voyageur (texte_fr : la version française pour l'équipe), sans signature. Refusée si elle parle d'argent (paiement, remboursement, prix, supplément), de données personnelles, ou contient un code d'accès ou le wifi : l'équipe traite elle-même ces réponses. Une seule proposition par message du voyageur ; une nouvelle remplace la précédente de Claude. L'agent de la messagerie ne répond pas à ce message tant qu'elle attend.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Identifiant de la conversation (donné par conversations_a_repondre).' },
        texte: { type: 'string', description: 'La réponse, dans la langue du voyageur (2 000 caractères au plus).' },
        texte_fr: { type: 'string', description: 'Sa version française pour l’équipe, si le voyageur écrit dans une autre langue.' },
      },
      required: ['id', 'texte'],
      additionalProperties: false,
    },
    annotations: ECRITURE,
    executer: async (a, ctx) => {
      const f = await filVise(a, ctx);
      const lien = `${ERP}/messagerie/${encodeURIComponent(f.id)}`;
      const reponse = texte(a.texte, 'texte', 2000);
      if (!reponse) throw new ErreurOutil('« texte » est obligatoire : la réponse proposée au voyageur.');
      const fr = texte(a.texte_fr, 'texte_fr', 2000) || undefined;
      if (!attendEquipe(f)) throw new ErreurOutil('Cette conversation n’attend pas de réponse de l’équipe : rien n’a été proposé.');
      const attente = messagesSansReponse(f);
      const dernier = attente[attente.length - 1];
      if (!dernier) throw new ErreurOutil('Aucun message du voyageur sans réponse : rien n’a été proposé.');
      const b = f.agent?.brouillon;
      if (b && !b.valideePar && b.proposePar !== 'claude' && attente.some((m) => m.id === b.messageId)) {
        throw new ErreurOutil(`Votre agent a déjà préparé une réponse à valider pour ce message : l’équipe la relit dans la Messagerie (${lien}). Rien n’a été proposé.`);
      }
      const tout = `${reponse}\n${fr ?? ''}`;
      if (reponseAEcarter(tout)) {
        throw new ErreurOutil('Cette réponse parle d’argent (paiement, remboursement, prix, supplément) ou de données personnelles : l’équipe l’écrit elle-même. Rien n’a été proposé.');
      }
      if (consigneCachee(tout)) throw new ErreurOutil('Cette réponse contient des consignes adressées à une machine : rien n’a été proposé.');
      const logement = (await ctx.cm.logements()).find((l) => l.id === f.logementId);
      // Mêmes garde-fous que l'agent : un lien, une adresse ou un numéro (hors plateforme), ou un supplément accordé, l'équipe les écrit.
      const coord = [MOTIF_LIEN, MOTIF_EMAIL, MOTIF_EMAIL_DEGUISE, MOTIF_TELEPHONE].some((m) => new RegExp(m.source, m.flags.replace('g', '')).test(tout));
      if (coord) throw new ErreurOutil('Pas de lien, d’e-mail ni de numéro de téléphone dans une réponse proposée : l’équipe les donne elle-même. Rien n’a été proposé.');
      if (offreSupplement(tout, logement?.fiche)) {
        throw new ErreurOutil('Cette réponse accorde un supplément (arrivée plus tôt, départ plus tard, ménage, navette) : l’équipe le propose avec le prix réglé. Rien n’a été proposé.');
      }
      if (contientCodeAcces(tout, logement)) {
        throw new ErreurOutil('Pas de code d’accès ni de wifi dans une réponse proposée : l’équipe les envoie depuis l’ERP au bon moment. Rien n’a été proposé.');
      }
      const langue = langueProbable(reponse);
      const brouillon: BrouillonAgent = {
        messageId: dernier.id,
        texte: reponse,
        ...(fr && langue !== 'fr' ? { texteFr: fr } : {}),
        ...(langue ? { langue } : {}),
        motif: 'Proposée par Claude : relisez, puis envoyez.',
        le: ctx.maintenant(),
        proposePar: 'claude',
      };
      // Le message est « pris » : l'agent n'y répond pas en même temps que l'équipe envoie cette réponse.
      const suivant: FilMessages = {
        ...f,
        traitePar: 'en_attente',
        agent: { ...(f.agent ?? {}), dernierMessageTraite: dernier.id, decision: 'a_valider', brouillon },
      };
      await ctx.cm.enregistrerFil(suivant);
      return {
        propose: true,
        envoyee: false,
        voyageur: prenomInitiale(f.voyageur),
        a_faire: 'L’équipe relit cette réponse et l’envoie elle-même depuis la Messagerie de l’ERP : rien n’est parti.',
        annulation: SIGNE_ANNULATION,
        lien_erp: lien,
      };
    },
  },
  {
    name: 'menage_creer',
    title: 'Prévoir un ménage (interne)',
    description:
      "Ajoute un ménage au planning interne de l'ERP pour un logement et un jour (« à attribuer », sans prestataire) : l'ERP en tient compte pour le planning (arrivée plus tôt, départ plus tard). Interne : rien n'est envoyé à un prestataire ni à une plateforme de ménage. Un ménage déjà prévu ce jour-là n'est pas doublé. Horaires par défaut : heure de départ et heure d'arrivée du logement.",
    inputSchema: {
      type: 'object',
      properties: {
        ...proprietesLogement,
        date: { type: 'string', description: 'Jour du ménage, AAAA-MM-JJ (aujourd’hui ou après, un an au plus).' },
        debut: { type: 'string', description: 'Début au plus tôt, HH:MM (par défaut : heure de départ du logement, sinon 11:00).' },
        fin: { type: 'string', description: 'Fin au plus tard, HH:MM (par défaut : heure d’arrivée du logement, sinon 16:00).' },
        reservation_id: { type: 'string', description: 'Séjour concerné (facultatif, id de reservations_periode).' },
        note: { type: 'string', description: 'Note pour l’équipe (facultatif, 500 caractères au plus).' },
      },
      required: ['date'],
      additionalProperties: false,
    },
    annotations: ECRITURE,
    executer: async (a, ctx) => {
      const cp = copiloteDe(ctx);
      const j = ctx.aujourdhui();
      const l = await logementVise({ id: a.logement_id, recherche: a.recherche }, ctx);
      if (l.statut === 'sorti') throw new ErreurOutil(`« ${l.nom} » n’est plus géré : pas de ménage à prévoir.`);
      const jour = date(a.date, 'date');
      if (!jour) throw new ErreurOutil('« date » est obligatoire (AAAA-MM-JJ).');
      if (jour < j) throw new ErreurOutil('Le ménage se prévoit aujourd’hui ou après.');
      if (ecartJours(j, jour) > 365) throw new ErreurOutil('Un an à l’avance au plus.');
      const debut = heure(a.debut, 'debut') ?? (HEURE.test(l.fiche?.heureDepart ?? '') ? l.fiche.heureDepart : '11:00');
      const fin = heure(a.fin, 'fin') ?? (HEURE.test(l.fiche?.heureArrivee ?? '') ? l.fiche.heureArrivee : '16:00');
      if (fin <= debut) throw new ErreurOutil('« fin » doit venir après « debut ».');
      let reservationId: string | undefined;
      if (a.reservation_id !== undefined && a.reservation_id !== null && a.reservation_id !== '') {
        reservationId = idValide(a.reservation_id, 'reservation_id', 'voir reservations_periode');
        const r = (await ctx.cm.reservations()).find((x) => x.id === reservationId);
        if (!r || r.logementId !== l.id) throw new ErreurOutil(`Aucun séjour « ${reservationId} » dans « ${l.nom} ». Utilisez reservations_periode.`);
      }
      const note = texte(a.note, 'note', 500);
      const missions = await cp.missions();
      const deja = missions.find((m) => m.logementId === l.id && m.type === 'menage' && m.date === jour && m.statut !== 'annulee' && m.statut !== 'refusee');
      if (deja) return { cree: false, raison: 'Un ménage est déjà prévu ce jour-là dans ce logement : rien n’a été créé.', menage: vueMission(deja, l) };
      const m: Mission = {
        id: `mis-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        type: 'menage',
        logementId: l.id,
        ...(reservationId ? { reservationId } : {}),
        date: jour,
        heureDebut: debut,
        heureFinMax: fin,
        statut: 'a_attribuer',
        checklist: checklistMenageVierge(),
        photos: [],
        tarifCentimes: 0,
        controleQualite: false,
        commentaire: note ? `${noteSure(note, l)} (prévu par Claude)` : 'Prévu par Claude.',
        interne: true,
      };
      await cp.enregistrerMission(m, l.nom);
      return {
        cree: true,
        menage: vueMission(m, l),
        important: 'Interne à l’ERP : aucun prestataire ni aucune plateforme de ménage n’est prévenu.',
        annulation: SIGNE_ANNULATION,
      };
    },
  },
  {
    name: 'facture_preparer',
    title: 'Préparer une facture (brouillon)',
    description:
      "Prépare le brouillon de la facture mensuelle d'un propriétaire (commission de gestion et ménages d'un mois terminé, mêmes calculs que son bilan) s'il n'en a pas encore pour ce mois. Un brouillon seulement : sans numéro, rien n'est envoyé ni encaissé. Le gérant le relit, le valide (le numéro est alors attribué) puis le partage depuis l'ERP. Une facture déjà préparée, écartée ou validée n'est jamais remplacée.",
    inputSchema: {
      type: 'object',
      properties: {
        proprietaire_id: { type: 'string', description: 'Identifiant du propriétaire.' },
        recherche: { type: 'string', description: 'Ou une partie de son nom, si un seul propriétaire correspond.' },
        mois: { type: 'string', description: 'Mois terminé, AAAA-MM (par défaut : le mois dernier).' },
      },
      additionalProperties: false,
    },
    annotations: ECRITURE,
    executer: async (a, ctx) => {
      const cp = copiloteDe(ctx);
      const j = ctx.aujourdhui();
      const { proprietaires, mandats, factures, reglages } = await cp.facturation();
      const p = proprietaireVise(a, proprietaires);
      const mois = texte(a.mois, 'mois', 7) || moisAFacturerAutomatiquement(j);
      if (!moisValide(mois)) throw new ErreurOutil('« mois » doit être au format AAAA-MM.');
      if (mois >= moisDe(j)) throw new ErreurOutil('Un mois terminé seulement : la facture du mois en cours se prépare à partir du 1er du mois suivant.');
      const existante = factures.find((f) => f.id === idFactureMensuelle(p.id, mois));
      if (existante) {
        const raison = factureFigee(existante)
          ? 'Déjà validée : elle ne change plus.'
          : existante.statut === 'annulee'
            ? 'Ce mois a été écarté par le gérant (« Ne pas facturer ce mois ») : rien n’a été préparé.'
            : 'Brouillon déjà préparé : le gérant le relit dans l’ERP.';
        return { prepare: false, raison, facture: vueFacture(existante) };
      }
      const [logements, reservations] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const espace = { id: ctx.espace?.id ?? ID_LABEL_MAISON, nom: ctx.espace?.nom ?? 'Label Maison' };
      const donnees = { logements, reservations, mandats };
      const b = preparerBrouillon({ donnees, proprietaireId: p.id, mois, identite: identiteConciergerie({ reglages }, espace), aujourdhui: j, maintenant: ctx.maintenant(), par: PAR_CLAUDE });
      const sansTaux = calculerFactureMois(donnees, p.id, mois).sansTaux;
      if (!b || !b.lignes.length || b.montantHtCentimes <= 0) {
        return {
          prepare: false,
          raison: `Rien à facturer à ${p.nom} pour ${moisTexte(mois)}${sansTaux.length ? ` (pas de taux de commission dans le mandat de : ${sansTaux.join(', ')})` : ''}.`,
        };
      }
      const logementId = logementsDe(logements, p.id)[0]?.id;
      const ajoutee = await cp.ajouterFacture(b, p.nom, logementId);
      if (!ajoutee) return { prepare: false, raison: 'Une facture de ce mois vient d’être préparée entre-temps : rien n’a été remplacé.' };
      return {
        prepare: true,
        proprietaire: p.nom,
        facture: vueFacture(b),
        ...(sansTaux.length ? { attention: `Pas de taux de commission dans le mandat de : ${sansTaux.join(', ')} (rien de facturé pour ces logements).` } : {}),
        a_faire: 'Le gérant relit le brouillon, le valide (le numéro est attribué à ce moment-là) et le partage depuis l’ERP. Rien n’est envoyé ni encaissé.',
        annulation: `${SIGNE_ANNULATION} Tant qu’elle n’est pas validée.`,
        ...(logementId ? { lien_erp: `${ERP}/logements/${encodeURIComponent(logementId)}` } : {}),
      };
    },
  },
  {
    name: 'prix_conseils',
    title: 'Prix conseillés (lecture seule)',
    description:
      "Les prix conseillés des prochaines semaines (nuits, prix actuel, prix conseillé, écart, raison), pour un logement ou tout le parc. CONSEIL SEULEMENT : ni Claude ni l'ERP ne changent un prix, nulle part. Pour « ajuster un prix », l'équipe le change elle-même sur Airbnb ou Booking, puis touche « C'est fait » dans l'ERP.",
    inputSchema: { type: 'object', properties: proprietesLogement, additionalProperties: false },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const cp = copiloteDe(ctx);
      const j = ctx.aujourdhui();
      const important = 'Conseil seulement : aucun prix n’est changé par Claude ni par l’ERP. L’équipe change le prix sur Airbnb ou Booking, puis touche « C’est fait » dans l’ERP.';
      const l = a.logement_id || a.recherche ? await logementVise({ id: a.logement_id, recherche: a.recherche }, ctx) : undefined;
      const [logements, reservations, elements] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations(), cp.prix()]);
      const { reglages, decisions } = lireElementsPrix(elements);
      if (!reglages.actif) return { total: 0, conseils: [], raison: 'Les prix conseillés sont désactivés pour cet espace (réglage du gérant dans l’ERP).', important };
      const plages = conseillerPrix({ logements, reservations, reglages, decisions, aujourdhui: j, maintenant: ctx.maintenant(), ...(l ? { logementId: l.id } : {}) });
      return {
        total: plages.length,
        conseils: plages.slice(0, 20).map((p) => ({
          logement: p.nom,
          logement_id: p.logementId,
          nuits: texteNuits(p.debut, p.fin),
          du: p.debut,
          au: plusJours(p.fin, -1),
          prix_actuel: eurosRonds(p.prixActuel),
          prix_conseille: eurosRonds(p.prixConseille),
          ecart: `${p.variationPct > 0 ? '+' : ''}${p.variationPct} %`,
          raison: p.raison,
          confiance: Math.round(p.confiance * 100) / 100,
        })),
        important,
        lien_erp: l ? `${ERP}/logements/${encodeURIComponent(l.id)}` : ERP,
      };
    },
  },
];
