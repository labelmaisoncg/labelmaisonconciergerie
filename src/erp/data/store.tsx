/**
 * État de l'ERP : ErpProvider + useErp().
 *
 * Deux modes (voir config.ts) :
 * - « reel » (production) : connexion Supabase (e-mail + mot de passe), données
 *   lues dans la base de Label Maison, chaque action enregistrée aussitôt
 *   (synchro.ts), modifications des autres membres reçues en direct.
 * - « demo » (développement local, VITE_ERP_DEMO=1) : jeu de démonstration en
 *   mémoire, recopié dans localStorage (clé lm-erp-demo-v1).
 *
 * Dans les deux cas les mutations gardent la même API, synchrone : l'action
 * est appliquée localement, le moteur d'automatisations repasse, le journal
 * est tenu, puis la différence est enregistrée. Les règles métier (SPEC §2)
 * sont appliquées ici, pas dans les écrans.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ETAPES_PIPELINE } from './constantes';
import { AUJOURDHUI, MAINTENANT, dateParis, horodatageMaintenant } from './format';
import {
  CLE_AUTOMATISATIONS,
  REGLES,
  executerAutomatisations,
  type EvenementAuto,
  type ResultatMoteur,
} from '../automatisations';
import { COLLECTIONS, completer, trierJournal } from './collections';
import { MODE, MODE_DEMO } from './config';
import { logementActivable, missionValidable, prestataireConforme } from './selectors';
import {
  enregistrerMembre,
  genreErreur,
  lireMembres,
  messageErreur,
  obtenirClient,
  retirerMembre,
  RETOUR_LIEN,
  seDeconnecter as deconnexionSupabase,
} from './supabase';
import { appliquerOperations, ErreurSynchro, Synchro, type ChangementDistant, type EtatAutoStocke, type EtatSynchro } from './synchro';
import { EcranPorte, type PhasePorte } from '../layout/Connexion';
import type {
  CleChecklistLancement,
  DateISO,
  ElementDe,
  ErpDonnees,
  EtapeProspect,
  Id,
  Incident,
  MouvementLinge,
  NomCollection,
  StatutMission,
  Utilisateur,
} from './types';

export { COLLECTIONS };
export const CLE_STOCKAGE = 'lm-erp-demo-v1';

export type Resultat = { ok: true } | { ok: false; erreur: string };

export type NouvelIncident = Omit<Incident, 'id' | 'statut' | 'preuves' | 'refacturable'> &
  Partial<Pick<Incident, 'statut' | 'preuves' | 'refacturable'>>;

export interface ErpContexte extends ErpDonnees {
  /** 'reel' : base Supabase de Label Maison ; 'demo' : jeu local (développement uniquement). */
  mode: 'demo' | 'reel';
  /** Vrai seulement en démo locale (bandeau « Données de démonstration »). */
  demo: boolean;
  /** Toutes les collections, pratique pour les sélecteurs. */
  donnees: ErpDonnees;
  /** Membre connecté (nom et rôle tirés de erp.membres). */
  utilisateur: Utilisateur;
  /** Rôle « lecture » : rien n'est enregistré. */
  lectureSeule: boolean;
  /** État de l'enregistrement dans la base (null en démo). */
  synchro: EtatSynchro | null;
  /** Relance tout de suite les écritures en attente. */
  relancerEnregistrement: () => void;
  /** Message à afficher (échec d'une opération hors données, ex. gestion des membres). */
  avertissement: string | null;
  fermerAvertissement: () => void;
  seDeconnecter: () => void;

  upsert: <C extends NomCollection>(collection: C, element: ElementDe<C>) => void;
  remove: (collection: NomCollection, id: Id) => void;
  /** Modifie un élément à partir de sa version la plus récente (après une attente : envoi de photo...). */
  mettreAJour: <C extends NomCollection>(collection: C, id: Id, patch: (e: ElementDe<C>) => ElementDe<C>) => Resultat;

  changerStatutMission: (id: Id, statut: StatutMission) => Resultat;
  validerMission: (id: Id) => Resultat;
  /** Refus d'une mission : commentaire obligatoire, la mission ne sera pas payée. */
  refuserMission: (id: Id, commentaire: string) => Resultat;
  attribuerMission: (id: Id, prestataireId: Id) => Resultat;
  avancerProspect: (id: Id, etape?: EtapeProspect) => Resultat;
  cocherChecklistLancement: (logementId: Id, cle: CleChecklistLancement, fait?: boolean, preuve?: string) => Resultat;
  activerLogement: (id: Id) => Resultat;
  ajouterMouvementLinge: (mouvement: Omit<MouvementLinge, 'id'>) => MouvementLinge;
  creerIncident: (incident: NouvelIncident) => Incident;
  resoudreIncident: (id: Id, options?: { coutCentimes?: number; date?: DateISO }) => Resultat;
  /** La somme refacturable d'un incident résolu a été récupérée. */
  marquerIncidentRecupere: (id: Id, date?: DateISO) => Resultat;
  marquerFacturePayee: (id: Id, date?: DateISO) => Resultat;

  /** Démo uniquement : recharge le jeu de démonstration. Sans effet en production. */
  reinitialiserDemo: () => void;

  /* Automatisations : le moteur tourne au chargement et après chaque action. */
  evenementsAuto: EvenementAuto[];
  reglesActives: Record<string, boolean>;
  estRegleActive: (cle: string) => boolean;
  basculerRegle: (cle: string, actif: boolean) => void;
  /** Relance le moteur tout de suite et renvoie ce qu'il a fait. */
  lancerAutomatisations: () => ResultatMoteur;
  ajouterEvenementsAuto: (evenements: EvenementAuto[]) => void;
  viderJournalAuto: () => void;
}

/* ------------------------------------------------------- automatisations */

interface EtatAuto {
  actives: Record<string, boolean>;
  evenements: EvenementAuto[];
}

const MAX_EVENEMENTS = 500;

function clesActives(actives: Record<string, boolean>): string[] {
  return REGLES.filter((r) => actives[r.cle] ?? r.actifParDefaut).map((r) => r.cle);
}

/** Nouveaux événements en tête, dédoublonnés par id (un constat connu ne s'empile pas). */
function fusionner(existants: EvenementAuto[], nouveaux: EvenementAuto[]): EvenementAuto[] {
  const connus = new Set(existants.map((e) => e.id));
  const inedits = nouveaux.filter((e) => e && typeof e.id === 'string' && !connus.has(e.id));
  return inedits.length ? [...inedits, ...existants].slice(0, MAX_EVENEMENTS) : existants;
}

// Une règle qui échoue sur des données inattendues ne doit jamais bloquer
// l'ERP : on garde les données telles quelles et on le signale en console.
// En démo, l'heure est figée (ids de constats stables) ; en production, c'est
// l'instant réel.
const automatiser = (d: ErpDonnees, actives: Record<string, boolean>): ResultatMoteur => {
  try {
    return executerAutomatisations(d, {
      date: AUJOURDHUI,
      maintenant: MODE_DEMO ? MAINTENANT : horodatageMaintenant(),
      reglesActives: clesActives(actives),
    });
  } catch (erreur) {
    console.error('[erp] automatisations interrompues', erreur);
    return { donnees: d, evenements: [], changements: [], passes: 0 };
  }
};

const Contexte = createContext<ErpContexte | null>(null);

/* ------------------------------------------------------------------ outils */

/** Identifiant unique, préfixé par le type d'entité. */
export function nouvelId(prefixe: string): Id {
  return `${prefixe}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const echec = (erreur: string): Resultat => ({ ok: false, erreur });
const OK: Resultat = { ok: true };

/* ------------------------------------------------------------- persistance */

/** Ce que le cœur du store délègue au mode (démo locale ou base réelle). */
interface Persistance {
  /** Enregistre la différence entre deux états (après moteur). */
  donnees: (avant: ErpDonnees, apres: ErpDonnees, auteur: string) => void;
  /** Enregistre un champ de l'état des automatisations. */
  auto: (champ: 'actives' | 'evenements', etat: EtatAuto) => void;
  /** Création ou modification d'un membre (production : table erp.membres). */
  membre?: (u: Utilisateur) => Promise<string | null>;
  /** Retrait d'un membre. */
  retirerMembre?: (id: Id) => Promise<string | null>;
}

/* ------------------------------------------------------------ cœur (commun) */

interface PropsCoeur {
  mode: 'demo' | 'reel';
  initial: ErpDonnees;
  autoInitial: EtatAuto;
  utilisateur: Utilisateur;
  lectureSeule: boolean;
  persistance: Persistance;
  /** Production : synchronisation active (changements distants, relance). */
  synchro?: Synchro | null;
  etatSynchro: EtatSynchro | null;
  seDeconnecter: () => void;
  /** Démo : jeu de données de remplacement pour « Réinitialiser ». */
  jeuDemo?: () => ErpDonnees;
  children: ReactNode;
}

function CoeurErp({
  mode,
  initial,
  autoInitial,
  utilisateur,
  lectureSeule,
  persistance,
  synchro,
  etatSynchro,
  seDeconnecter,
  jeuDemo,
  children,
}: PropsCoeur) {
  // Premier passage du moteur sur les données chargées (il rattrape le retard
  // du jour : ménages à créer, factures du mois...). Son résultat est
  // enregistré juste après le montage.
  const [depart] = useState(() => {
    const r = automatiser(initial, autoInitial.actives);
    return { avant: initial, donnees: r.donnees, auto: { ...autoInitial, evenements: fusionner(autoInitial.evenements, r.evenements) } };
  });
  const [donnees, setDonnees] = useState<ErpDonnees>(depart.donnees);
  const [etatAuto, setEtatAuto] = useState<EtatAuto>(depart.auto);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const autoRef = useRef(etatAuto);
  autoRef.current = etatAuto;
  const ref = useRef(donnees);
  ref.current = donnees;
  const persistanceRef = useRef(persistance);
  persistanceRef.current = persistance;
  const utilisateurRef = useRef(utilisateur);
  utilisateurRef.current = utilisateur;

  // Enregistre le rattrapage du moteur au chargement (une seule fois).
  const departEnregistre = useRef(false);
  useEffect(() => {
    if (departEnregistre.current) return;
    departEnregistre.current = true;
    persistanceRef.current.donnees(depart.avant, depart.donnees, 'Automatisation');
  }, [depart]);

  /* ---------------------------------------- état des automatisations */

  // Dernières valeurs connues de la base : on n'écrit que ce qui a changé.
  const autoConnu = useRef({ actives: JSON.stringify(autoInitial.actives), evenements: JSON.stringify(autoInitial.evenements) });
  useEffect(() => {
    const s = JSON.stringify(etatAuto.actives);
    if (s === autoConnu.current.actives) return;
    autoConnu.current.actives = s;
    persistanceRef.current.auto('actives', etatAuto);
  }, [etatAuto]);
  useEffect(() => {
    // Les constats changent souvent par petites touches : regroupés sur 1,5 s.
    const minuterie = setTimeout(() => {
      const s = JSON.stringify(etatAuto.evenements);
      if (s === autoConnu.current.evenements) return;
      autoConnu.current.evenements = s;
      persistanceRef.current.auto('evenements', etatAuto);
    }, 1500);
    return () => clearTimeout(minuterie);
  }, [etatAuto]);

  const ajouterEvenementsAuto = useCallback((nouveaux: EvenementAuto[]) => {
    if (!nouveaux.length) return;
    setEtatAuto((e) => {
      const evenements = fusionner(e.evenements, nouveaux);
      return evenements === e.evenements ? e : { ...e, evenements };
    });
  }, []);

  /* ------------------------------------------------- changements distants */

  useEffect(() => {
    if (!synchro) return;
    let relectureEnCours = false;
    let derniereRelecture = 0;
    synchro.brancher({
      surDistant: (changements: ChangementDistant[]) => {
        const suivant = appliquerOperations(ref.current, changements);
        if (suivant === ref.current) return;
        ref.current = suivant;
        setDonnees(suivant);
      },
      surEtatAutoDistant: (patch: Partial<EtatAutoStocke>) => {
        setEtatAuto((e) => {
          let suivant = e;
          if (patch.actives && typeof patch.actives === 'object') {
            autoConnu.current.actives = JSON.stringify(patch.actives);
            suivant = { ...suivant, actives: patch.actives };
          }
          if (Array.isArray(patch.evenements)) {
            const evenements = fusionner(suivant.evenements, patch.evenements as EvenementAuto[]);
            if (evenements === suivant.evenements) autoConnu.current.evenements = JSON.stringify(evenements);
            suivant = { ...suivant, evenements };
          }
          autoRef.current = suivant;
          return suivant;
        });
      },
      // Après une coupure (réseau, veille) : relecture complète, les
      // modifications locales en attente restent appliquées par-dessus.
      surResynchro: () => {
        if (relectureEnCours || Date.now() - derniereRelecture < 5000) return;
        relectureEnCours = true;
        derniereRelecture = Date.now();
        const repere = synchro.repere();
        synchro
          .chargerTout()
          .then((lu) => {
            // Ce qui s'est passé pendant la lecture est rejoué par-dessus l'instantané.
            const suivant = synchro.appliquerFile({ ...lu, utilisateurs: ref.current.utilisateurs }, repere);
            ref.current = suivant;
            setDonnees(suivant);
          })
          .catch((e) => console.warn('[erp] relecture impossible', e))
          .finally(() => {
            relectureEnCours = false;
          });
      },
    });
    synchro.activerDistant();

    // Onglet resté longtemps en arrière-plan (veille, autre application) : on relit au retour.
    let cacheLe = 0;
    const visibilite = () => {
      if (document.visibilityState === 'hidden') cacheLe = Date.now();
      else if (cacheLe && Date.now() - cacheLe > 2 * 60_000) {
        cacheLe = 0;
        void synchro.envoyer();
        synchro.demanderResynchro();
      }
    };
    document.addEventListener('visibilitychange', visibilite);
    return () => document.removeEventListener('visibilitychange', visibilite);
  }, [synchro]);

  /** Fait passer le moteur sur des données, les pose dans l'état, enregistre la différence. */
  const poser = useCallback(
    (d: ErpDonnees, avant: ErpDonnees, auteur: string): ResultatMoteur => {
      const r = automatiser(d, autoRef.current.actives);
      ref.current = r.donnees;
      setDonnees(r.donnees);
      ajouterEvenementsAuto(r.evenements);
      persistanceRef.current.donnees(avant, r.donnees, auteur);
      return r;
    },
    [ajouterEvenementsAuto],
  );

  /** Applique une transformation et journalise l'action. */
  const appliquer = useCallback(
    (transformer: (d: ErpDonnees) => ErpDonnees, action: string, entite: string, entiteId: Id, details = '') => {
      const avant = ref.current;
      const suivant = transformer(avant);
      const auteur = utilisateurRef.current.nom;
      const trace = {
        id: nouvelId('jrn'),
        horodatage: horodatageMaintenant(),
        auteur,
        action,
        entite,
        entiteId,
        details,
      };
      poser({ ...suivant, journal: [trace, ...suivant.journal] }, avant, auteur);
    },
    [poser],
  );

  /** Remplace un élément d'une collection par son id. */
  const modifier = useCallback(
    <C extends NomCollection>(d: ErpDonnees, collection: C, id: Id, patch: (e: ElementDe<C>) => ElementDe<C>): ErpDonnees => ({
      ...d,
      [collection]: (d[collection] as ElementDe<C>[]).map((e) => (e.id === id ? patch(e) : e)),
    }),
    [],
  );

  const trouver = useCallback(
    <C extends NomCollection>(collection: C, id: Id): ElementDe<C> | undefined =>
      (ref.current[collection] as ElementDe<C>[]).find((e) => e.id === id),
    [],
  );

  const signaler = useCallback((message: string | null) => {
    if (message) setAvertissement(message);
  }, []);

  const actions = useMemo(() => {
    const upsert = <C extends NomCollection>(collection: C, element: ElementDe<C>) => {
      const existe = !!trouver(collection, element.id);
      appliquer(
        (d) => ({
          ...d,
          [collection]: existe
            ? (d[collection] as ElementDe<C>[]).map((e) => (e.id === element.id ? element : e))
            : [...(d[collection] as ElementDe<C>[]), element],
        }),
        existe ? 'Modification' : 'Création',
        collection,
        element.id,
      );
      // L'équipe vit dans erp.membres (production) : on y reporte le changement.
      if (collection === 'utilisateurs' && persistanceRef.current.membre) {
        void persistanceRef.current.membre(element as Utilisateur).then(signaler);
      }
    };

    const remove = (collection: NomCollection, id: Id) => {
      appliquer(
        (d) => ({ ...d, [collection]: (d[collection] as { id: Id }[]).filter((e) => e.id !== id) }),
        'Suppression',
        collection,
        id,
      );
      if (collection === 'utilisateurs' && persistanceRef.current.retirerMembre) {
        void persistanceRef.current.retirerMembre(id).then(signaler);
      }
    };

    const mettreAJour = <C extends NomCollection>(collection: C, id: Id, patch: (e: ElementDe<C>) => ElementDe<C>): Resultat => {
      const actuel = trouver(collection, id);
      if (!actuel) return echec('Élément introuvable (supprimé entre-temps ?).');
      upsert(collection, patch(actuel));
      return OK;
    };

    const validerMission = (id: Id): Resultat => {
      const m = trouver('missions', id);
      if (!m) return echec('Mission introuvable.');
      const verdict = missionValidable(m);
      if (!verdict.ok) return echec(`Validation impossible. ${verdict.raisons.join(' ')}`);
      appliquer((d) => modifier(d, 'missions', id, (x) => ({ ...x, statut: 'validee' })), 'Mission validée', 'mission', id,
        `${m.photos.length} photos, checklist complète.`);
      return OK;
    };

    const refuserMission = (id: Id, commentaire: string): Resultat => {
      const m = trouver('missions', id);
      if (!m) return echec('Mission introuvable.');
      const texte = commentaire.trim();
      if (!texte) return echec('Le motif du refus est obligatoire.');
      if (m.statut === 'validee') return echec('Une mission validée ne peut plus être refusée.');
      if (m.statut === 'annulee') return echec('Mission annulée.');
      appliquer((d) => modifier(d, 'missions', id, (x) => ({ ...x, statut: 'refusee', commentaire: texte })), 'Mission refusée', 'mission', id, texte);
      return OK;
    };

    const changerStatutMission = (id: Id, statut: StatutMission): Resultat => {
      if (statut === 'validee') return validerMission(id);
      const m = trouver('missions', id);
      if (!m) return echec('Mission introuvable.');
      if (statut === 'attribuee' && !m.prestataireId) return echec('Attribuez d’abord un prestataire.');
      appliquer((d) => modifier(d, 'missions', id, (x) => ({ ...x, statut })), 'Statut de mission modifié', 'mission', id, statut);
      return OK;
    };

    const attribuerMission = (id: Id, prestataireId: Id): Resultat => {
      const m = trouver('missions', id);
      const p = trouver('prestataires', prestataireId);
      if (!m) return echec('Mission introuvable.');
      if (!p) return echec('Prestataire introuvable.');
      const verdict = prestataireConforme(p);
      if (!verdict.ok) return echec(`${p.nom} ne peut pas recevoir de mission. ${verdict.raisons.join(' ')}`);
      appliquer(
        (d) =>
          modifier(d, 'missions', id, (x) => ({
            ...x,
            prestataireId,
            statut: x.statut === 'a_attribuer' ? 'attribuee' : x.statut,
          })),
        'Mission attribuée',
        'mission',
        id,
        p.nom,
      );
      return OK;
    };

    const avancerProspect = (id: Id, etape?: EtapeProspect): Resultat => {
      const p = trouver('prospects', id);
      if (!p) return echec('Prospect introuvable.');
      let cible = etape;
      if (!cible) {
        const i = ETAPES_PIPELINE.indexOf(p.etape);
        if (i === -1 || i === ETAPES_PIPELINE.length - 1) return echec('Ce prospect est déjà au bout du pipeline.');
        cible = ETAPES_PIPELINE[i + 1];
      }
      const finale = cible;
      appliquer((d) => modifier(d, 'prospects', id, (x) => ({ ...x, etape: finale })), 'Prospect avancé', 'prospect', id,
        `${p.nom} : ${p.etape} vers ${finale}.`);
      return OK;
    };

    const cocherChecklistLancement = (logementId: Id, cle: CleChecklistLancement, fait = true, preuve?: string): Resultat => {
      const l = trouver('logements', logementId);
      if (!l) return echec('Logement introuvable.');
      const element = l.checklistLancement.find((c) => c.cle === cle);
      if (!element) return echec('Point de checklist inconnu.');
      appliquer(
        (d) =>
          modifier(d, 'logements', logementId, (x) => ({
            ...x,
            checklistLancement: x.checklistLancement.map((c) =>
              c.cle === cle ? { ...c, fait, preuve: preuve ?? c.preuve } : c,
            ),
          })),
        fait ? 'Checklist cochée' : 'Checklist décochée',
        'logement',
        logementId,
        element.libelle,
      );
      return OK;
    };

    const activerLogement = (id: Id): Resultat => {
      const l = trouver('logements', id);
      if (!l) return echec('Logement introuvable.');
      const verdict = logementActivable(l, ref.current.mandats);
      if (!verdict.ok) return echec(`Activation impossible. ${verdict.raisons.join(' ')}`);
      appliquer((d) => modifier(d, 'logements', id, (x) => ({ ...x, statut: 'actif' })), 'Logement activé', 'logement', id, l.nom);
      return OK;
    };

    const ajouterMouvementLinge = (mouvement: Omit<MouvementLinge, 'id'>): MouvementLinge => {
      const complet = { ...mouvement, id: nouvelId('lin') };
      const total = mouvement.articles.reduce((s, a) => s + a.quantite, 0);
      appliquer((d) => ({ ...d, mouvementsLinge: [...d.mouvementsLinge, complet] }), 'Mouvement de linge', 'linge', complet.id,
        `${mouvement.type}, ${total} article${total > 1 ? 's' : ''}.`);
      return complet;
    };

    const creerIncident = (incident: NouvelIncident): Incident => {
      const complet: Incident = { statut: 'ouvert', preuves: [], refacturable: 'aucun', ...incident, id: nouvelId('inc') };
      appliquer((d) => ({ ...d, incidents: [complet, ...d.incidents] }), 'Incident créé', 'incident', complet.id, complet.description);
      return complet;
    };

    const resoudreIncident = (id: Id, options: { coutCentimes?: number; date?: DateISO } = {}): Resultat => {
      const i = trouver('incidents', id);
      if (!i) return echec('Incident introuvable.');
      if (i.statut === 'resolu') return echec('Incident déjà résolu.');
      appliquer(
        (d) =>
          modifier(d, 'incidents', id, (x) => ({
            ...x,
            statut: 'resolu',
            resoluLe: options.date ?? AUJOURDHUI,
            coutCentimes: options.coutCentimes ?? x.coutCentimes,
          })),
        'Incident résolu',
        'incident',
        id,
      );
      return OK;
    };

    const marquerIncidentRecupere = (id: Id, date: DateISO = AUJOURDHUI): Resultat => {
      const i = trouver('incidents', id);
      if (!i) return echec('Incident introuvable.');
      if (i.statut !== 'resolu') return echec('Résolvez d’abord l’incident.');
      if (i.refacturable === 'aucun') return echec('Cet incident n’est pas refacturable.');
      if (i.recupereLe) return echec('Somme déjà récupérée.');
      appliquer((d) => modifier(d, 'incidents', id, (x) => ({ ...x, recupereLe: date })), 'Refacturation récupérée', 'incident', id,
        i.refacturable);
      return OK;
    };

    const marquerFacturePayee = (id: Id, date: DateISO = AUJOURDHUI): Resultat => {
      const f = trouver('factures', id);
      if (!f) return echec('Facture introuvable.');
      if (f.statut === 'payee') return echec('Facture déjà payée.');
      if (f.statut === 'annulee' || f.statut === 'brouillon') return echec('Seule une facture émise peut être marquée payée.');
      appliquer((d) => modifier(d, 'factures', id, (x) => ({ ...x, statut: 'payee', payeeLe: date })), 'Facture payée', 'facture', id, f.numero);
      return OK;
    };

    const reinitialiserDemo = () => {
      if (!jeuDemo) return;
      setEtatAuto((e) => ({ ...e, evenements: [] }));
      poser(completer(jeuDemo()), ref.current, utilisateurRef.current.nom);
    };

    return {
      upsert,
      remove,
      mettreAJour,
      changerStatutMission,
      validerMission,
      refuserMission,
      attribuerMission,
      avancerProspect,
      cocherChecklistLancement,
      activerLogement,
      ajouterMouvementLinge,
      creerIncident,
      resoudreIncident,
      marquerIncidentRecupere,
      marquerFacturePayee,
      reinitialiserDemo,
    };
  }, [appliquer, modifier, trouver, poser, jeuDemo, signaler]);

  const automatisations = useMemo(
    () => ({
      estRegleActive: (cle: string) =>
        etatAuto.actives[cle] ?? REGLES.find((r) => r.cle === cle)?.actifParDefaut ?? false,
      basculerRegle: (cle: string, actif: boolean) => {
        const actives = { ...autoRef.current.actives, [cle]: actif };
        autoRef.current = { ...autoRef.current, actives };
        setEtatAuto((e) => ({ ...e, actives }));
        // Une règle rallumée rattrape aussitôt ce qu'elle aurait dû faire.
        if (actif) poser(ref.current, ref.current, 'Automatisation');
      },
      lancerAutomatisations: () => poser(ref.current, ref.current, 'Automatisation'),
      viderJournalAuto: () => setEtatAuto((e) => ({ ...e, evenements: [] })),
    }),
    [etatAuto.actives, poser],
  );

  const relancerEnregistrement = useCallback(() => {
    void synchro?.envoyer();
  }, [synchro]);
  const fermerAvertissement = useCallback(() => setAvertissement(null), []);

  const valeur = useMemo<ErpContexte>(
    () => ({
      ...donnees,
      donnees,
      mode,
      demo: mode === 'demo',
      utilisateur,
      lectureSeule,
      synchro: etatSynchro,
      relancerEnregistrement,
      avertissement,
      fermerAvertissement,
      seDeconnecter,
      ...actions,
      evenementsAuto: etatAuto.evenements,
      reglesActives: etatAuto.actives,
      ajouterEvenementsAuto,
      ...automatisations,
    }),
    [donnees, mode, utilisateur, lectureSeule, etatSynchro, relancerEnregistrement, avertissement, fermerAvertissement, seDeconnecter,
      actions, etatAuto, ajouterEvenementsAuto, automatisations],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/* -------------------------------------------------------------------- démo */

function lireAutoLocal(): EtatAuto {
  try {
    const brut = window.localStorage.getItem(CLE_AUTOMATISATIONS);
    if (brut) {
      const e = JSON.parse(brut) as Partial<EtatAuto>;
      if (e && typeof e.actives === 'object' && Array.isArray(e.evenements)) return e as EtatAuto;
    }
  } catch {
    /* stockage indisponible : état par défaut */
  }
  return { actives: {}, evenements: [] };
}

type ModuleSeed = typeof import('./seed');

function chargerDemo(seed: ModuleSeed): ErpDonnees {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (brut) {
      const d = JSON.parse(brut) as Partial<ErpDonnees>;
      if (d && typeof d === 'object' && Array.isArray(d.logements)) return completer(d);
    }
  } catch {
    /* stockage indisponible ou corrompu : on repart du seed */
  }
  return completer(seed.creerSeed());
}

const UTILISATEUR_DEMO: Utilisateur = { id: 'usr-demo', nom: 'Démo', email: 'demo@exemple.fr', role: 'gerant' };

/** Démo locale : le jeu de démonstration est chargé à part (jamais téléchargé en production). */
function FournisseurDemo({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<ModuleSeed | null>(null);
  useEffect(() => {
    let actif = true;
    void import('./seed').then((m) => actif && setSeed(m));
    return () => {
      actif = false;
    };
  }, []);
  if (!seed) return <EcranPorte phase={{ nom: 'chargement' }} onReessayer={() => undefined} onMotDePasseChange={() => undefined} onDeconnecter={() => undefined} />;
  return <CoeurDemo seed={seed}>{children}</CoeurDemo>;
}

function CoeurDemo({ seed, children }: { seed: ModuleSeed; children: ReactNode }) {
  const [depart] = useState(() => ({ donnees: chargerDemo(seed), auto: lireAutoLocal() }));
  const persistance = useMemo<Persistance>(
    () => ({
      donnees: (_avant, apres) => {
        try {
          window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(apres));
        } catch {
          /* quota dépassé ou navigation privée : la démo reste en mémoire */
        }
      },
      auto: (_champ, etat) => {
        try {
          window.localStorage.setItem(CLE_AUTOMATISATIONS, JSON.stringify(etat));
        } catch {
          /* navigation privée : l'état reste en mémoire */
        }
      },
    }),
    [],
  );
  const utilisateur = depart.donnees.utilisateurs.find((u) => u.role === 'gerant') ?? depart.donnees.utilisateurs[0] ?? UTILISATEUR_DEMO;
  const jeuDemo = useCallback(() => seed.creerSeed(), [seed]);
  return (
    <CoeurErp
      mode="demo"
      initial={depart.donnees}
      autoInitial={depart.auto}
      utilisateur={utilisateur}
      lectureSeule={false}
      persistance={persistance}
      etatSynchro={null}
      seDeconnecter={() => window.location.assign('/erp/deconnexion')}
      jeuDemo={jeuDemo}
    >
      {children}
    </CoeurErp>
  );
}

/* -------------------------------------------------------------------- réel */

interface Session {
  donnees: ErpDonnees;
  auto: EtatAuto;
  utilisateur: Utilisateur;
  synchro: Synchro;
}

function FournisseurReel({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<PhasePorte>(() =>
    RETOUR_LIEN.recuperation ? { nom: 'nouveau_mot_de_passe' } : { nom: 'demarrage' },
  );
  const [session, setSession] = useState<Session | null>(null);
  const [etatSynchro, setEtatSynchro] = useState<EtatSynchro | null>(null);
  const enRecuperation = useRef(RETOUR_LIEN.recuperation);
  const emailCharge = useRef<string | null>(null);
  const synchroRef = useRef<Synchro | null>(null);
  const essai = useRef(0);

  const arreterSynchro = useCallback(() => {
    synchroRef.current?.arreter();
    synchroRef.current = null;
    emailCharge.current = null;
    setSession(null);
    setEtatSynchro(null);
  }, []);

  /** Session ouverte : vérifie l'accès, lit la base, démarre la synchronisation. */
  const demarrer = useCallback(
    async (email: string) => {
      const cle = email.toLowerCase();
      if (emailCharge.current === cle) return;
      emailCharge.current = cle;
      const numero = ++essai.current;
      const encore = () => numero === essai.current;
      setPhase({ nom: 'chargement' });
      try {
        const membres = await lireMembres();
        if (!encore()) return;
        if (!membres.ok) {
          emailCharge.current = null;
          const genre = genreErreur(membres.erreur, membres.status);
          if (genre === 'base_absente') return setPhase({ nom: 'base_absente' });
          if (genre === 'session') {
            await deconnexionSupabase();
            return setPhase({ nom: 'connexion', message: 'Votre session a expiré. Reconnectez-vous.' });
          }
          return setPhase({ nom: 'erreur', genre, message: messageErreur(membres.erreur, membres.status) });
        }
        const moi = membres.membres.find((m) => m.email === cle);
        if (!moi || moi.role === 'prestataire') {
          emailCharge.current = null;
          return setPhase({ nom: 'non_autorise', email });
        }
        const synchro = new Synchro({ client: obtenirClient(), surEtat: setEtatSynchro });
        synchro.demarrerTempsReel();
        const [lu, auto] = await Promise.all([synchro.chargerTout(), synchro.lireEtatAuto()]);
        if (!encore()) return synchro.arreter();
        synchroRef.current?.arreter();
        synchroRef.current = synchro;
        const donnees = synchro.appliquerFile({ ...lu, utilisateurs: membres.membres });
        setEtatSynchro(synchro.lireEtat());
        setSession({
          donnees,
          auto: {
            actives: auto?.actives && typeof auto.actives === 'object' ? auto.actives : {},
            evenements: Array.isArray(auto?.evenements) ? (auto!.evenements as EvenementAuto[]) : [],
          },
          utilisateur: moi,
          synchro,
        });
        setPhase({ nom: 'pret' });
        if (synchro.enAttente) void synchro.envoyer();
      } catch (e) {
        if (!encore()) return;
        emailCharge.current = null;
        const genre = e instanceof ErreurSynchro ? e.genre : genreErreur(e);
        if (genre === 'base_absente') return setPhase({ nom: 'base_absente' });
        const erreur = e instanceof ErreurSynchro ? e.erreur : e;
        const status = e instanceof ErreurSynchro ? e.status : undefined;
        setPhase({ nom: 'erreur', genre, message: messageErreur(erreur, status) });
      }
    },
    [],
  );

  useEffect(() => {
    const client = obtenirClient();
    let actif = true;
    const { data } = client.auth.onAuthStateChange((evenement, s) => {
      // Jamais d'appel Supabase directement dans ce rappel (verrou interne) : on diffère.
      setTimeout(() => {
        if (!actif) return;
        if (evenement === 'PASSWORD_RECOVERY') {
          enRecuperation.current = true;
          setPhase({ nom: 'nouveau_mot_de_passe' });
          return;
        }
        if (evenement === 'SIGNED_OUT' || !s?.user) {
          arreterSynchro();
          if (enRecuperation.current && evenement === 'INITIAL_SESSION') {
            // Lien de récupération refusé par Supabase (expiré ou déjà utilisé).
            enRecuperation.current = false;
            setPhase({ nom: 'connexion', message: 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ».' });
            return;
          }
          if (!enRecuperation.current) setPhase((p) => (p.nom === 'connexion' ? p : { nom: 'connexion', message: RETOUR_LIEN.erreur }));
          return;
        }
        if (enRecuperation.current) return;
        if (evenement === 'INITIAL_SESSION' || evenement === 'SIGNED_IN' || evenement === 'USER_UPDATED') {
          void demarrer(s.user.email ?? '');
        }
      }, 0);
    });
    return () => {
      actif = false;
      data.subscription.unsubscribe();
      essai.current += 1;
      synchroRef.current?.arreter();
      synchroRef.current = null;
      emailCharge.current = null;
    };
  }, [demarrer, arreterSynchro]);

  // Changement de jour (onglet resté ouvert la nuit) : on recharge pour
  // repartir de la bonne date, une fois tout enregistré.
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (dateParis() !== AUJOURDHUI && !(synchroRef.current?.enAttente ?? 0)) window.location.reload();
    }, 60_000);
    return () => clearInterval(minuterie);
  }, []);

  // Fermeture de l'onglet avec des modifications non confirmées : avertir.
  useEffect(() => {
    const avantFermeture = (e: BeforeUnloadEvent) => {
      if (!synchroRef.current?.enAttente) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avantFermeture);
    return () => window.removeEventListener('beforeunload', avantFermeture);
  }, []);

  const seDeconnecter = useCallback(() => {
    void (async () => {
      setPhase({ nom: 'demarrage' });
      arreterSynchro();
      await deconnexionSupabase();
      setPhase({ nom: 'connexion' });
    })();
  }, [arreterSynchro]);

  const reessayer = useCallback(() => {
    void obtenirClient()
      .auth.getSession()
      .then(({ data }) => {
        const email = data.session?.user?.email;
        emailCharge.current = null;
        if (email) void demarrer(email);
        else setPhase({ nom: 'connexion' });
      });
  }, [demarrer]);

  const apresNouveauMotDePasse = useCallback(() => {
    enRecuperation.current = false;
    reessayer();
  }, [reessayer]);

  const persistance = useMemo<Persistance | null>(() => {
    if (!session) return null;
    const lecture = session.utilisateur.role === 'lecture';
    return {
      donnees: (avant, apres, auteur) => {
        if (lecture) return;
        void session.synchro.sauvegarderDifferences(avant, apres, auteur);
      },
      auto: (champ, etat) => {
        if (lecture) return;
        void session.synchro.enregistrerEtatAuto(champ, etat[champ]);
      },
      membre: async (u) => {
        const erreur = await enregistrerMembre(u);
        return erreur ? `Membre non enregistré : ${messageErreur(erreur)}` : null;
      },
      retirerMembre: async (id) => {
        const erreur = await retirerMembre(id);
        return erreur ? `Membre non retiré : ${messageErreur(erreur)}` : null;
      },
    };
  }, [session]);

  if (phase.nom !== 'pret' || !session || !persistance) {
    return <EcranPorte phase={phase} onReessayer={reessayer} onMotDePasseChange={apresNouveauMotDePasse} onDeconnecter={seDeconnecter} />;
  }

  return (
    <CoeurErp
      key={session.utilisateur.email}
      mode="reel"
      initial={session.donnees}
      autoInitial={session.auto}
      utilisateur={session.utilisateur}
      lectureSeule={session.utilisateur.role === 'lecture'}
      persistance={persistance}
      synchro={session.synchro}
      etatSynchro={etatSynchro}
      seDeconnecter={seDeconnecter}
    >
      {children}
    </CoeurErp>
  );
}

/* --------------------------------------------------------------- provider */

export function ErpProvider({ children }: { children: ReactNode }) {
  return MODE === 'demo' ? <FournisseurDemo>{children}</FournisseurDemo> : <FournisseurReel>{children}</FournisseurReel>;
}

export function useErp(): ErpContexte {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error('useErp() doit être utilisé sous <ErpProvider>.');
  return ctx;
}

/** Tri du journal exposé pour les écrans qui fusionnent plusieurs sources. */
export { trierJournal };
