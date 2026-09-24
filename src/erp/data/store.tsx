/**
 * État de l'ERP : ErpProvider + useErp().
 *
 * Mode démo (par défaut) : état en mémoire initialisé depuis le seed, recopié
 * dans localStorage (clé lm-erp-demo-v1) pour que la maquette reste
 * manipulable d'une visite à l'autre. Chaque mutation laisse une trace au
 * journal. Les règles métier (SPEC §2) sont appliquées ici, pas dans les écrans.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ETAPES_PIPELINE } from './constantes';
import { AUJOURDHUI, MAINTENANT, horodatageMaintenant } from './format';
import {
  CLE_AUTOMATISATIONS,
  REGLES,
  executerAutomatisations,
  type EvenementAuto,
  type ResultatMoteur,
} from '../automatisations';
import { creerSeed } from './seed';
import { logementActivable, missionValidable, prestataireConforme } from './selectors';
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

export const CLE_STOCKAGE = 'lm-erp-demo-v1';
const CLE_UTILISATEUR = 'lm-erp-demo-v1:utilisateur';

export type Resultat = { ok: true } | { ok: false; erreur: string };

export type NouvelIncident = Omit<Incident, 'id' | 'statut' | 'preuves' | 'refacturable'> &
  Partial<Pick<Incident, 'statut' | 'preuves' | 'refacturable'>>;

export interface ErpContexte extends ErpDonnees {
  /** 'supabase' dès que VITE_SUPABASE_URL est défini. */
  mode: 'demo' | 'supabase';
  /** Vrai tant que les données sont locales (bandeau « Données de démonstration »). */
  demo: boolean;
  /** Toutes les collections, pratique pour les sélecteurs. */
  donnees: ErpDonnees;
  utilisateur: Utilisateur;
  changerUtilisateur: (id: Id) => void;

  upsert: <C extends NomCollection>(collection: C, element: ElementDe<C>) => void;
  remove: (collection: NomCollection, id: Id) => void;

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

function lireAuto(): EtatAuto {
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

function clesActives(actives: Record<string, boolean>): string[] {
  return REGLES.filter((r) => actives[r.cle] ?? r.actifParDefaut).map((r) => r.cle);
}

/** Nouveaux événements en tête, dédoublonnés par id (un constat connu ne s'empile pas). */
function fusionner(existants: EvenementAuto[], nouveaux: EvenementAuto[]): EvenementAuto[] {
  const connus = new Set(existants.map((e) => e.id));
  const inedits = nouveaux.filter((e) => !connus.has(e.id));
  return inedits.length ? [...inedits, ...existants].slice(0, MAX_EVENEMENTS) : existants;
}

// La maquette vit à une heure figée : les constats gardent des ids stables
// d'un passage à l'autre, donc le journal ne se remplit pas de doublons.
const automatiser = (d: ErpDonnees, actives: Record<string, boolean>) =>
  executerAutomatisations(d, { date: AUJOURDHUI, maintenant: MAINTENANT, reglesActives: clesActives(actives) });

const Contexte = createContext<ErpContexte | null>(null);

/* ------------------------------------------------------------------ outils */

/** Identifiant local unique, préfixé par le type d'entité. */
export function nouvelId(prefixe: string): Id {
  return `${prefixe}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const COLLECTIONS: NomCollection[] = [
  'proprietaires', 'mandats', 'logements', 'reservations', 'filsMessages', 'missions', 'prestataires',
  'mouvementsLinge', 'incidents', 'factures', 'paiementsPrestataires', 'charges', 'prospects',
  'utilisateurs', 'journal', 'recommandations',
];

/**
 * Collections ajoutées après la première version : une sauvegarde locale plus
 * ancienne ne les contient pas, on les initialise vides au lieu de tout jeter.
 */
const COLLECTIONS_AJOUTEES: NomCollection[] = ['recommandations'];

function charger(): ErpDonnees {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (brut) {
      const d = JSON.parse(brut) as Partial<ErpDonnees>;
      const migre = { ...d } as Record<string, unknown>;
      for (const c of COLLECTIONS_AJOUTEES) if (!Array.isArray(migre[c])) migre[c] = [];
      if (COLLECTIONS.every((c) => Array.isArray(migre[c]))) return migre as unknown as ErpDonnees;
    }
  } catch {
    /* stockage indisponible ou corrompu : on repart du seed */
  }
  return creerSeed();
}

function enregistrer(d: ErpDonnees) {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(d));
  } catch {
    /* quota dépassé ou navigation privée : la démo reste en mémoire */
  }
}

function lireUtilisateur(): Id {
  try {
    return window.localStorage.getItem(CLE_UTILISATEUR) || 'usr-abdel';
  } catch {
    return 'usr-abdel';
  }
}

const echec = (erreur: string): Resultat => ({ ok: false, erreur });
const OK: Resultat = { ok: true };

/* ---------------------------------------------------------------- provider */

export function ErpProvider({ children }: { children: ReactNode }) {
  const [depart] = useState(() => {
    const auto = lireAuto();
    const r = automatiser(charger(), auto.actives);
    return { donnees: r.donnees, auto: { ...auto, evenements: fusionner(auto.evenements, r.evenements) } };
  });
  const [donnees, setDonnees] = useState<ErpDonnees>(depart.donnees);
  const [etatAuto, setEtatAuto] = useState<EtatAuto>(depart.auto);
  const autoRef = useRef(etatAuto);
  autoRef.current = etatAuto;
  const [utilisateurId, setUtilisateurId] = useState<Id>(lireUtilisateur);
  const ref = useRef(donnees);
  ref.current = donnees;

  // TODO(supabase) : quand VITE_SUPABASE_URL est défini, charger et écrire via
  // l'API REST de Supabase (schéma erp, migration 20260924000000). En attendant,
  // on reste sur les données de démonstration locales.
  const mode: ErpContexte['mode'] = import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'demo';

  useEffect(() => enregistrer(donnees), [donnees]);
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_AUTOMATISATIONS, JSON.stringify(etatAuto));
    } catch {
      /* navigation privée : l'état reste en mémoire */
    }
  }, [etatAuto]);

  const ajouterEvenementsAuto = useCallback((nouveaux: EvenementAuto[]) => {
    if (!nouveaux.length) return;
    setEtatAuto((e) => {
      const evenements = fusionner(e.evenements, nouveaux);
      return evenements === e.evenements ? e : { ...e, evenements };
    });
  }, []);

  /** Fait passer le moteur sur des données, les pose dans l'état, garde ses constats. */
  const poser = useCallback(
    (d: ErpDonnees): ResultatMoteur => {
      const r = automatiser(d, autoRef.current.actives);
      ref.current = r.donnees;
      setDonnees(r.donnees);
      ajouterEvenementsAuto(r.evenements);
      return r;
    },
    [ajouterEvenementsAuto],
  );

  const utilisateur =
    donnees.utilisateurs.find((u) => u.id === utilisateurId) ?? donnees.utilisateurs[0];
  const auteurRef = useRef(utilisateur.nom);
  auteurRef.current = utilisateur.nom;

  /** Applique une transformation et journalise l'action. */
  const appliquer = useCallback(
    (transformer: (d: ErpDonnees) => ErpDonnees, action: string, entite: string, entiteId: Id, details = '') => {
      const suivant = transformer(ref.current);
      const trace = {
        id: nouvelId('jrn'),
        horodatage: horodatageMaintenant(),
        auteur: auteurRef.current,
        action,
        entite,
        entiteId,
        details,
      };
      poser({ ...suivant, journal: [trace, ...suivant.journal] });
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
    };

    const remove = (collection: NomCollection, id: Id) => {
      appliquer(
        (d) => ({ ...d, [collection]: (d[collection] as { id: Id }[]).filter((e) => e.id !== id) }),
        'Suppression',
        collection,
        id,
      );
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
      setEtatAuto((e) => ({ ...e, evenements: [] }));
      poser(creerSeed());
    };

    return {
      upsert,
      remove,
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
  }, [appliquer, modifier, trouver, poser]);

  const automatisations = useMemo(
    () => ({
      estRegleActive: (cle: string) =>
        etatAuto.actives[cle] ?? REGLES.find((r) => r.cle === cle)?.actifParDefaut ?? false,
      basculerRegle: (cle: string, actif: boolean) => {
        const actives = { ...autoRef.current.actives, [cle]: actif };
        autoRef.current = { ...autoRef.current, actives };
        setEtatAuto((e) => ({ ...e, actives }));
        // Une règle rallumée rattrape aussitôt ce qu'elle aurait dû faire.
        if (actif) poser(ref.current);
      },
      lancerAutomatisations: () => poser(ref.current),
      viderJournalAuto: () => setEtatAuto((e) => ({ ...e, evenements: [] })),
    }),
    [etatAuto.actives, poser],
  );

  const changerUtilisateur = useCallback((id: Id) => {
    setUtilisateurId(id);
    try {
      window.localStorage.setItem(CLE_UTILISATEUR, id);
    } catch {
      /* sans effet hors démo */
    }
  }, []);

  const valeur = useMemo<ErpContexte>(
    () => ({
      ...donnees,
      donnees,
      mode,
      demo: true,
      utilisateur,
      changerUtilisateur,
      ...actions,
      evenementsAuto: etatAuto.evenements,
      reglesActives: etatAuto.actives,
      ajouterEvenementsAuto,
      ...automatisations,
    }),
    [donnees, mode, utilisateur, changerUtilisateur, actions, etatAuto, ajouterEvenementsAuto, automatisations],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useErp(): ErpContexte {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error('useErp() doit être utilisé sous <ErpProvider>.');
  return ctx;
}
