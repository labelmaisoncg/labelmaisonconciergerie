/**
 * Synchronisation de l'ERP avec la base Supabase de Label Maison.
 *
 * Modèle : une ligne de erp.enregistrements par élément (collection + id),
 * contenu complet en JSON. Le store garde son fonctionnement synchrone : il
 * applique chaque action localement (optimiste), fait tourner le moteur
 * d'automatisations, puis confie ici la différence avant / après.
 *
 * - Lecture : chargerTout() lit toute la table (pages de 1 000 lignes).
 * - Écriture : sauvegarderDifferences() compare avant / après par id et met
 *   en file les créations, modifications (upsert par collection + id) et
 *   suppressions. La file est vidée par lots ; en cas d'échec, nouvel essai
 *   automatique (1 s, 2 s, 4 s... jusqu'à 1 min) et reprise dès le retour du
 *   réseau. Elle est recopiée dans localStorage : une modification faite hors
 *   ligne survit à la fermeture de l'onglet.
 * - Temps réel : les modifications des autres membres arrivent en direct
 *   (Supabase Realtime) ; l'écho de nos propres écritures est ignoré, et une
 *   modification locale encore en attente l'emporte sur la version distante.
 * - Automatisations : interrupteurs et constats dans erp.etat_automatisations,
 *   chaque champ écrit séparément pour ne jamais écraser celui de l'autre.
 */
import { CLE_FILE_ATTENTE, SUPABASE_URL } from './config';
import { COLLECTIONS_SYNCHRONISEES, donneesVides, trierJournal } from './collections';
import { genreErreur, messageErreur, type ClientErp, type ErreurBase, type GenreErreur } from './supabase';
import type { ErpDonnees, NomCollection } from './types';

/* ------------------------------------------------------------------ types */

type Element = { id: string } & Record<string, unknown>;

export type Operation =
  | { type: 'ecrire'; collection: NomCollection; id: string; donnees: Element }
  | { type: 'supprimer'; collection: NomCollection; id: string };

/** Changement reçu d'un autre membre (donnees null : suppression). */
export interface ChangementDistant {
  collection: NomCollection;
  id: string;
  donnees: Element | null;
}

export type ChampAuto = 'actives' | 'evenements';
export type EtatAutoStocke = { actives: Record<string, boolean>; evenements: unknown[] };

export interface EtatSynchro {
  /** a_jour : tout est enregistré ; envoi : écriture en cours ; erreur : nouvel essai programmé. */
  statut: 'a_jour' | 'envoi' | 'erreur';
  /** Modifications locales pas encore confirmées par la base. */
  enAttente: number;
  /** Faux quand l'appareil n'a plus de réseau. */
  enLigne: boolean;
  /** Réception des modifications des autres membres. */
  tempsReel: 'inactif' | 'connecte' | 'deconnecte';
  genre?: GenreErreur;
  message?: string;
  /** Instant (ms) du prochain essai automatique. */
  prochainEssai?: number;
}

/** Erreur de lecture, avec son statut HTTP pour distinguer « base non installée ». */
export class ErreurSynchro extends Error {
  constructor(
    readonly erreur: ErreurBase,
    readonly status?: number,
  ) {
    super(erreur?.message ?? 'Erreur de la base');
  }
  get genre(): GenreErreur {
    return genreErreur(this.erreur, this.status);
  }
}

interface StockageSimple {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

export interface OptionsSynchro {
  client: ClientErp;
  /** Localstorage (ou substitut en test). null : file en mémoire seulement. */
  stockage?: StockageSimple | null;
  /** Identifiant de cet onglet (écho des écritures). */
  idOnglet?: string;
  enLigne?: () => boolean;
  surEtat?: (e: EtatSynchro) => void;
  surDistant?: (changements: ChangementDistant[]) => void;
  surEtatAutoDistant?: (etat: Partial<EtatAutoStocke>) => void;
  /** Reconnexion après une coupure : relire la base pour ne rien manquer. */
  surResynchro?: () => void;
  /** Regroupement des changements distants (ms). */
  delaiRegroupement?: number;
  /** Surveillance du réseau et battement de la file (désactivés en test). */
  ecouterNavigateur?: boolean;
}

/* ------------------------------------------------------------- constantes */

const TABLE = 'enregistrements';
const TABLE_AUTO = 'etat_automatisations';
const TAILLE_PAGE = 1000;
const LOT_ECRITURE = 200;
const LOT_SUPPRESSION = 100;
const DELAI_MAX = 60_000;
/** Un onglet silencieux depuis plus longtemps est considéré fermé : sa file est reprise. */
const ONGLET_ABANDONNE_MS = 30_000;

const cle = (collection: string, id: string) => `${collection}\u0000${id}`;
const estCollection = (c: unknown): c is NomCollection =>
  typeof c === 'string' && (COLLECTIONS_SYNCHRONISEES as string[]).includes(c);

function paquets<T>(liste: T[], taille: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) res.push(liste.slice(i, i + taille));
  return res;
}

/* -------------------------------------------------------------- calculs purs */

/**
 * Opérations à envoyer pour passer de `avant` à `apres` : éléments nouveaux ou
 * modifiés (comparaison JSON) et éléments disparus. Rapide : une collection
 * inchangée (même tableau) ou un élément inchangé (même objet) est sauté.
 */
export function differences(avant: ErpDonnees, apres: ErpDonnees): Operation[] {
  const ops: Operation[] = [];
  for (const c of COLLECTIONS_SYNCHRONISEES) {
    const a = ((avant as unknown as Record<string, Element[]>)[c] ?? []) as Element[];
    const b = ((apres as unknown as Record<string, Element[]>)[c] ?? []) as Element[];
    if (a === b) continue;
    const anciens = new Map<string, Element>();
    for (const e of a) if (e && typeof e.id === 'string') anciens.set(e.id, e);
    const presents = new Set<string>();
    for (const e of b) {
      if (!e || typeof e.id !== 'string' || !e.id) continue;
      presents.add(e.id);
      const ancien = anciens.get(e.id);
      if (ancien === e) continue;
      if (ancien && JSON.stringify(ancien) === JSON.stringify(e)) continue;
      ops.push({ type: 'ecrire', collection: c, id: e.id, donnees: e });
    }
    for (const id of anciens.keys()) if (!presents.has(id)) ops.push({ type: 'supprimer', collection: c, id });
  }
  return ops;
}

/** Applique des opérations (file locale ou changements distants) à un jeu de données. */
export function appliquerOperations(d: ErpDonnees, ops: (Operation | ChangementDistant)[]): ErpDonnees {
  if (!ops.length) return d;
  const parCollection = new Map<NomCollection, (Operation | ChangementDistant)[]>();
  for (const op of ops) parCollection.set(op.collection, [...(parCollection.get(op.collection) ?? []), op]);
  const suivant = { ...d } as unknown as Record<string, Element[]>;
  let touche = false;
  for (const [c, liste] of parCollection) {
    const elements = (suivant[c] ?? []).slice();
    const index = new Map(elements.map((e, i) => [e.id, i]));
    let modifie = false;
    const aRetirer = new Set<string>();
    for (const op of liste) {
      const donnees = 'type' in op ? (op.type === 'ecrire' ? op.donnees : null) : op.donnees;
      const i = index.get(op.id);
      if (donnees) {
        if (i === undefined) {
          index.set(op.id, elements.length);
          elements.push(donnees);
          aRetirer.delete(op.id);
          modifie = true;
        } else if (elements[i] !== donnees && JSON.stringify(elements[i]) !== JSON.stringify(donnees)) {
          elements[i] = donnees;
          aRetirer.delete(op.id);
          modifie = true;
        } else aRetirer.delete(op.id);
      } else if (i !== undefined) {
        aRetirer.add(op.id);
      }
    }
    let resultat = elements;
    if (aRetirer.size) {
      resultat = elements.filter((e) => !aRetirer.has(e.id));
      modifie = true;
    }
    if (modifie) {
      suivant[c] = c === 'journal' ? trierJournal(resultat) : resultat;
      touche = true;
    }
  }
  // Rien de nouveau (écho, doublon) : même objet, aucun rendu inutile.
  return touche ? (suivant as unknown as ErpDonnees) : d;
}

/** Lignes de la base → jeu de données complet (collections absentes : vides). */
export function construireDonnees(lignes: { collection: string; id: string; donnees: unknown }[]): ErpDonnees {
  const d = donneesVides() as unknown as Record<string, Element[]>;
  for (const l of lignes) {
    if (!estCollection(l.collection) || !l.id) continue;
    const brut = l.donnees;
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
      console.warn('[erp] ligne ignorée (contenu illisible)', l.collection, l.id);
      continue;
    }
    const e = brut as Element;
    d[l.collection].push(e.id === l.id ? e : { ...e, id: l.id });
  }
  d.journal = trierJournal(d.journal);
  return d as unknown as ErpDonnees;
}

/* ------------------------------------------------------------------ classe */

interface EntreeFile {
  op: Operation;
  version: number;
  auteur: string;
}

interface SlotStocke {
  projet: string;
  vu: number;
  operations: { op: Operation; auteur: string }[];
  auto?: Partial<EtatAutoStocke>;
}

export class Synchro {
  readonly idOnglet: string;
  private readonly client: ClientErp;
  private readonly stockage: StockageSimple | null;
  private readonly opts: OptionsSynchro;
  private file = new Map<string, EntreeFile>();
  /** Changements récents (locaux et distants), numérotés : rejoués après une relecture complète. */
  private recents: { seq: number; le: number; ch: Operation | ChangementDistant }[] = [];
  private fileAuto = new Map<ChampAuto, { valeur: unknown; version: number }>();
  private version = 0;
  private envoiEnCours: Promise<boolean> | null = null;
  private relancer = false;
  private tentatives = 0;
  private minuterie: ReturnType<typeof setTimeout> | null = null;
  private battement: ReturnType<typeof setInterval> | null = null;
  private tampon: ChangementDistant[] = [];
  private minuterieTampon: ReturnType<typeof setTimeout> | null = null;
  /** Changements distants retenus tant que le chargement initial n'est pas posé. */
  private distantActif = false;
  private canal: { unsubscribe: () => unknown } | null = null;
  private dejaAbonne = false;
  private arrete = false;
  private etat: EtatSynchro;
  private readonly nettoyages: (() => void)[] = [];

  constructor(opts: OptionsSynchro) {
    this.opts = opts;
    this.client = opts.client;
    this.stockage = opts.stockage === undefined ? stockageNavigateur() : opts.stockage;
    this.idOnglet = opts.idOnglet ?? `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.etat = { statut: 'a_jour', enAttente: 0, enLigne: this.enLigne(), tempsReel: 'inactif' };
    this.reprendreFilesAbandonnees();
    if (opts.ecouterNavigateur !== false && typeof window !== 'undefined') {
      const enLigne = () => {
        this.majEtat({ enLigne: true });
        void this.envoyer();
        this.opts.surResynchro?.();
      };
      const horsLigne = () => this.majEtat({ enLigne: false });
      window.addEventListener('online', enLigne);
      window.addEventListener('offline', horsLigne);
      this.nettoyages.push(() => {
        window.removeEventListener('online', enLigne);
        window.removeEventListener('offline', horsLigne);
      });
      // Signe de vie : la file de cet onglet ne sera pas reprise par un autre.
      this.battement = setInterval(() => this.file.size + this.fileAuto.size && this.persister(), 10_000);
    }
  }

  /* ---------------------------------------------------------------- état */

  get enAttente(): number {
    return this.file.size + this.fileAuto.size;
  }

  lireEtat(): EtatSynchro {
    return this.etat;
  }

  private enLigne(): boolean {
    if (this.opts.enLigne) return this.opts.enLigne();
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  private majEtat(patch: Partial<EtatSynchro>) {
    const suivant = { ...this.etat, ...patch, enAttente: this.enAttente };
    if (suivant.statut !== 'erreur') {
      suivant.genre = undefined;
      suivant.message = undefined;
      suivant.prochainEssai = undefined;
    }
    const change = (Object.keys(suivant) as (keyof EtatSynchro)[]).some((k) => suivant[k] !== this.etat[k]);
    this.etat = suivant;
    if (change) this.opts.surEtat?.(suivant);
  }

  private majParPour(auteur: string): string {
    return `${auteur || 'ERP'}#${this.idOnglet}`;
  }

  private estEcho(majPar: unknown): boolean {
    return typeof majPar === 'string' && majPar.slice(majPar.lastIndexOf('#') + 1) === this.idOnglet;
  }

  /* ------------------------------------------------------------- lecture */

  /** Lit tous les enregistrements et construit le jeu de données (collections vides si aucune ligne). */
  async chargerTout(): Promise<ErpDonnees> {
    const lignes: { collection: string; id: string; donnees: unknown }[] = [];
    for (let debut = 0; ; debut += TAILLE_PAGE) {
      const { data, error, status } = await this.client
        .from(TABLE)
        .select('collection,id,donnees')
        .order('collection')
        .order('id')
        .range(debut, debut + TAILLE_PAGE - 1);
      if (error) throw new ErreurSynchro(error, status);
      const page = (data ?? []) as { collection: string; id: string; donnees: unknown }[];
      lignes.push(...page);
      if (page.length < TAILLE_PAGE) break;
    }
    return construireDonnees(lignes);
  }

  /** Interrupteurs et constats des automatisations (null : jamais enregistrés). */
  async lireEtatAuto(): Promise<Partial<EtatAutoStocke> | null> {
    const { data, error, status } = await this.client.from(TABLE_AUTO).select('actives,evenements').eq('id', 'global').maybeSingle();
    if (error) throw new ErreurSynchro(error, status);
    const lu = (data ?? null) as Partial<EtatAutoStocke> | null;
    // Une valeur locale pas encore envoyée l'emporte.
    if (!this.fileAuto.size) return lu;
    const res: Partial<EtatAutoStocke> = { ...(lu ?? {}) };
    for (const [champ, { valeur }] of this.fileAuto) (res as Record<string, unknown>)[champ] = valeur;
    return res;
  }

  /** Repère à prendre AVANT une relecture complète (voir appliquerFile). */
  repere(): number {
    return this.version;
  }

  private noter(seq: number, ch: Operation | ChangementDistant) {
    const maintenant = Date.now();
    this.recents.push({ seq, le: maintenant, ch });
    // Dix minutes suffisent à couvrir une relecture ; 2 000 entrées au plus.
    const limite = maintenant - 10 * 60_000;
    let debut = 0;
    while (debut < this.recents.length && (this.recents[debut].le < limite || this.recents.length - debut > 2000)) debut += 1;
    if (debut) this.recents = this.recents.slice(debut);
  }

  /**
   * Données fraîchement lues + modifications locales pas encore confirmées.
   * Avec `depuis` (repère pris avant la lecture) : rejoue aussi tout ce qui
   * s'est passé pendant la lecture (écritures confirmées entre-temps,
   * changements reçus des autres), que l'instantané lu peut ne pas contenir.
   */
  appliquerFile(d: ErpDonnees, depuis?: number): ErpDonnees {
    const parSeq = new Map<number, Operation | ChangementDistant>();
    for (const e of this.file.values()) parSeq.set(e.version, e.op);
    if (depuis !== undefined) for (const r of this.recents) if (r.seq > depuis) parSeq.set(r.seq, r.ch);
    const ops = [...parSeq.entries()].sort((a, b) => a[0] - b[0]).map(([, ch]) => ch);
    return appliquerOperations(d, ops);
  }

  /* ------------------------------------------------------------ écriture */

  /**
   * Met en file la différence entre deux états et lance l'envoi. La promesse
   * dit si ce premier envoi a réussi ; en cas d'échec, les essais continuent
   * en arrière-plan (état visible par surEtat) et rien n'est perdu.
   */
  sauvegarderDifferences(avant: ErpDonnees, apres: ErpDonnees, auteur: string): Promise<boolean> {
    const ops = differences(avant, apres);
    if (!ops.length) return Promise.resolve(true);
    for (const op of ops) {
      const version = ++this.version;
      this.file.set(cle(op.collection, op.id), { op, version, auteur });
      this.noter(version, op);
    }
    this.persister();
    this.majEtat({});
    return this.envoyer();
  }

  /** Enregistre un champ de l'état des automatisations (écrit seul, sans toucher l'autre). */
  enregistrerEtatAuto(champ: ChampAuto, valeur: unknown): Promise<boolean> {
    this.fileAuto.set(champ, { valeur, version: ++this.version });
    this.persister();
    this.majEtat({});
    return this.envoyer();
  }

  /** Vide la file maintenant (un seul envoi à la fois ; un appel pendant l'envoi relance un tour). */
  envoyer(): Promise<boolean> {
    if (this.arrete) return Promise.resolve(false);
    if (this.envoiEnCours) {
      this.relancer = true;
      return this.envoiEnCours;
    }
    this.envoiEnCours = this.boucleEnvoi().finally(() => {
      this.envoiEnCours = null;
    });
    return this.envoiEnCours;
  }

  private async boucleEnvoi(): Promise<boolean> {
    if (this.minuterie) {
      clearTimeout(this.minuterie);
      this.minuterie = null;
    }
    let tours = 0;
    do {
      this.relancer = false;
      if (!this.enAttente) break;
      if (!this.enLigne()) {
        // Reprise immédiate à l'événement « online », et par sécurité à intervalle.
        this.planifierEssai({ message: 'Hors ligne' }, 0);
        return false;
      }
      this.majEtat({ statut: 'envoi', enLigne: true });
      const echec = await this.envoyerLot();
      if (echec) {
        this.planifierEssai(echec.erreur, echec.status);
        return false;
      }
      this.tentatives = 0;
      tours += 1;
    } while ((this.relancer || this.enAttente) && tours < 50);
    this.majEtat({ statut: this.enAttente ? 'envoi' : 'a_jour' });
    // Encore du travail après 50 tours : nouveau cycle, une fois celui-ci terminé.
    if (this.enAttente) setTimeout(() => void this.envoyer(), 0);
    return true;
  }

  private async envoyerLot(): Promise<{ erreur: ErreurBase; status?: number } | null> {
    try {
      const instantane = [...this.file.values()];
      const ecritures = instantane.filter((e) => e.op.type === 'ecrire');
      for (const lot of paquets(ecritures, LOT_ECRITURE)) {
        const lignes = lot.map((e) => ({
          collection: e.op.collection,
          id: e.op.id,
          donnees: (e.op as Extract<Operation, { type: 'ecrire' }>).donnees,
          maj_par: this.majParPour(e.auteur),
        }));
        const { error, status } = await this.client.from(TABLE).upsert(lignes, { onConflict: 'collection,id' });
        if (error) return { erreur: error, status };
        this.retirer(lot);
      }
      const suppressions = instantane.filter((e) => e.op.type === 'supprimer');
      const parCollection = new Map<string, EntreeFile[]>();
      for (const e of suppressions) parCollection.set(e.op.collection, [...(parCollection.get(e.op.collection) ?? []), e]);
      for (const [collection, entrees] of parCollection) {
        for (const lot of paquets(entrees, LOT_SUPPRESSION)) {
          const { error, status } = await this.client
            .from(TABLE)
            .delete()
            .eq('collection', collection)
            .in(
              'id',
              lot.map((e) => e.op.id),
            );
          if (error) return { erreur: error, status };
          this.retirer(lot);
        }
      }
      if (this.fileAuto.size) {
        const envoyes = [...this.fileAuto.entries()];
        const ligne: Record<string, unknown> = { id: 'global' };
        for (const [champ, { valeur }] of envoyes) ligne[champ] = valeur;
        const { error, status } = await this.client.from(TABLE_AUTO).upsert(ligne, { onConflict: 'id' });
        if (error) return { erreur: error, status };
        for (const [champ, { version }] of envoyes) if (this.fileAuto.get(champ)?.version === version) this.fileAuto.delete(champ);
        this.persister();
      }
      return null;
    } catch (e) {
      return { erreur: { message: (e as Error)?.message ?? String(e) }, status: 0 };
    }
  }

  /** Retire de la file les entrées envoyées, sauf si elles ont été modifiées entre-temps. */
  private retirer(lot: EntreeFile[]) {
    for (const e of lot) {
      const k = cle(e.op.collection, e.op.id);
      if (this.file.get(k)?.version === e.version) this.file.delete(k);
    }
    this.persister();
    this.majEtat({});
  }

  private planifierEssai(erreur: ErreurBase, status?: number) {
    this.tentatives += 1;
    const delai = Math.min(DELAI_MAX, 1000 * 2 ** Math.min(this.tentatives - 1, 6));
    const enLigne = this.enLigne();
    console.warn('[erp] enregistrement échoué, nouvel essai dans', delai, 'ms', erreur);
    this.majEtat({
      statut: 'erreur',
      enLigne,
      genre: genreErreur(erreur, status),
      message: enLigne ? messageErreur(erreur, status) : 'Hors ligne : les modifications partiront au retour du réseau.',
      prochainEssai: Date.now() + delai,
    });
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => {
      this.minuterie = null;
      void this.envoyer();
    }, delai);
  }

  /* ----------------------------------------------------- file persistante */

  private lireSlots(): Record<string, SlotStocke> {
    if (!this.stockage) return {};
    try {
      const brut = this.stockage.getItem(CLE_FILE_ATTENTE);
      const lu = brut ? (JSON.parse(brut) as Record<string, SlotStocke>) : {};
      return lu && typeof lu === 'object' && !Array.isArray(lu) ? lu : {};
    } catch {
      return {};
    }
  }

  private ecrireSlots(slots: Record<string, SlotStocke>) {
    if (!this.stockage) return;
    try {
      this.stockage.setItem(CLE_FILE_ATTENTE, JSON.stringify(slots));
    } catch {
      /* quota dépassé ou navigation privée : la file reste en mémoire */
    }
  }

  /** Recopie la file de cet onglet (ou l'efface quand elle est vide). */
  private persister() {
    if (!this.stockage) return;
    const slots = this.lireSlots();
    if (this.enAttente) {
      const auto: Partial<EtatAutoStocke> = {};
      for (const [champ, { valeur }] of this.fileAuto) (auto as Record<string, unknown>)[champ] = valeur;
      slots[this.idOnglet] = {
        projet: SUPABASE_URL,
        vu: this.arrete ? 0 : Date.now(),
        operations: [...this.file.values()].map((e) => ({ op: e.op, auteur: e.auteur })),
        auto: this.fileAuto.size ? auto : undefined,
      };
    } else delete slots[this.idOnglet];
    this.ecrireSlots(slots);
  }

  /** Reprend les écritures laissées par un onglet fermé avant d'avoir pu les envoyer. */
  private reprendreFilesAbandonnees() {
    const slots = this.lireSlots();
    const limite = Date.now() - ONGLET_ABANDONNE_MS;
    const repris = Object.entries(slots)
      .filter(([id, s]) => id !== this.idOnglet && s && s.projet === SUPABASE_URL && (s.vu ?? 0) < limite)
      .sort(([, a], [, b]) => (a.vu ?? 0) - (b.vu ?? 0));
    if (!repris.length) return;
    for (const [id, s] of repris) {
      for (const { op, auteur } of s.operations ?? []) {
        if (!op || !estCollection(op.collection) || typeof op.id !== 'string') continue;
        this.file.set(cle(op.collection, op.id), { op, version: ++this.version, auteur: auteur ?? '' });
      }
      for (const champ of ['actives', 'evenements'] as ChampAuto[]) {
        const valeur = s.auto?.[champ];
        if (valeur !== undefined) this.fileAuto.set(champ, { valeur, version: ++this.version });
      }
      delete slots[id];
    }
    this.ecrireSlots(slots);
    this.persister();
  }

  /* ----------------------------------------------------------- temps réel */

  /**
   * S'abonne aux modifications des autres membres. Les changements reçus sont
   * retenus jusqu'à activerDistant() (appelé une fois le chargement posé).
   */
  demarrerTempsReel() {
    if (this.canal || this.arrete) return;
    try {
      const canal = this.client
        .channel(`erp-donnees-${this.idOnglet}`)
        .on('postgres_changes', { event: '*', schema: 'erp', table: TABLE }, (p) => this.recevoir(p as unknown as ChangementBrut))
        .on('postgres_changes', { event: '*', schema: 'erp', table: TABLE_AUTO }, (p) => this.recevoir(p as unknown as ChangementBrut))
        .subscribe((statut) => {
          if (statut === 'SUBSCRIBED') {
            const reprise = this.dejaAbonne;
            this.dejaAbonne = true;
            this.majEtat({ tempsReel: 'connecte' });
            if (reprise) this.opts.surResynchro?.();
          } else if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT' || statut === 'CLOSED') {
            if (!this.arrete) this.majEtat({ tempsReel: 'deconnecte' });
          }
        });
      this.canal = canal;
    } catch (e) {
      console.warn('[erp] temps réel indisponible', e);
      this.majEtat({ tempsReel: 'deconnecte' });
    }
  }

  /** Branche les rappels du store (changements distants, relecture). */
  brancher(rappels: Pick<OptionsSynchro, 'surDistant' | 'surEtatAutoDistant' | 'surResynchro'>) {
    Object.assign(this.opts, rappels);
    this.programmerLivraison();
  }

  /** Demande une relecture complète de la base (retour de veille, réseau revenu). */
  demanderResynchro() {
    if (!this.arrete) this.opts.surResynchro?.();
  }

  /** Commence à livrer les changements distants (ceux reçus pendant le chargement compris). */
  activerDistant() {
    this.distantActif = true;
    this.programmerLivraison();
  }

  /** Traite un changement reçu de Supabase Realtime (public pour les tests). */
  recevoir(p: ChangementBrut) {
    if (this.arrete || !p) return;
    if (p.table === TABLE_AUTO) {
      const n = (p.new ?? {}) as Partial<EtatAutoStocke>;
      const patch: Partial<EtatAutoStocke> = {};
      if (n.actives && !this.fileAuto.has('actives')) patch.actives = n.actives;
      if (Array.isArray(n.evenements) && !this.fileAuto.has('evenements')) patch.evenements = n.evenements;
      if (Object.keys(patch).length) this.opts.surEtatAutoDistant?.(patch);
      return;
    }
    const suppression = p.eventType === 'DELETE';
    const ligne = (suppression ? p.old : p.new) as Partial<LigneBrute> | undefined;
    if (!ligne || !estCollection(ligne.collection) || typeof ligne.id !== 'string') return;
    if (!suppression && this.estEcho(ligne.maj_par)) return;
    // Une modification locale en attente l'emporte : elle sera écrite par-dessus.
    if (this.file.has(cle(ligne.collection, ligne.id))) return;
    if (suppression) {
      this.pousser({ collection: ligne.collection, id: ligne.id, donnees: null });
      return;
    }
    const donnees = ligne.donnees;
    if (donnees && typeof donnees === 'object' && !Array.isArray(donnees)) {
      const e = donnees as Element;
      this.pousser({ collection: ligne.collection, id: ligne.id, donnees: e.id === ligne.id ? e : { ...e, id: ligne.id } });
      return;
    }
    // Contenu trop gros pour le temps réel (tronqué) : on relit la ligne.
    void this.relireLigne(ligne.collection, ligne.id);
  }

  private async relireLigne(collection: NomCollection, id: string) {
    const { data, error } = await this.client.from(TABLE).select('collection,id,donnees,maj_par').eq('collection', collection).eq('id', id).maybeSingle();
    if (error || this.file.has(cle(collection, id))) return;
    const ligne = data as LigneBrute | null;
    if (!ligne) return this.pousser({ collection, id, donnees: null });
    if (this.estEcho(ligne.maj_par)) return;
    const e = ligne.donnees as Element;
    if (e && typeof e === 'object') this.pousser({ collection, id, donnees: e.id === id ? e : { ...e, id } });
  }

  private pousser(ch: ChangementDistant) {
    this.tampon.push(ch);
    this.programmerLivraison();
  }

  private programmerLivraison() {
    if (!this.distantActif || !this.tampon.length || this.minuterieTampon) return;
    this.minuterieTampon = setTimeout(() => {
      this.minuterieTampon = null;
      // Dernier filtre : une modification locale arrivée entre-temps l'emporte.
      const lot = this.tampon.filter((c) => !this.file.has(cle(c.collection, c.id)));
      this.tampon = [];
      for (const c of lot) this.noter(++this.version, c);
      if (lot.length && !this.arrete) this.opts.surDistant?.(lot);
    }, this.opts.delaiRegroupement ?? 40);
  }

  /** Arrête tout (déconnexion) ; la file persistée reste pour la prochaine session. */
  arreter() {
    if (this.arrete) return;
    this.arrete = true;
    // File non vide : marquée reprenable tout de suite par la prochaine session.
    if (this.enAttente && this.stockage) {
      const slots = this.lireSlots();
      if (slots[this.idOnglet]) {
        slots[this.idOnglet].vu = 0;
        this.ecrireSlots(slots);
      }
    }
    if (this.minuterie) clearTimeout(this.minuterie);
    if (this.minuterieTampon) clearTimeout(this.minuterieTampon);
    if (this.battement) clearInterval(this.battement);
    for (const n of this.nettoyages.splice(0)) n();
    if (this.canal) {
      try {
        void this.client.removeChannel(this.canal as never);
      } catch {
        /* déjà fermé */
      }
      this.canal = null;
    }
  }
}

interface LigneBrute {
  collection: string;
  id: string;
  donnees: unknown;
  maj_par?: string | null;
}

/** Charge utile de Supabase Realtime (postgres_changes). */
export interface ChangementBrut {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

function stockageNavigateur(): StockageSimple | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
