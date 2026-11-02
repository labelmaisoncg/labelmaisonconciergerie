import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOIS_ARRIERE_MAX, MOIS_AVANT_MAX, MOIS_PAR_PAS, ecartMois, moisEntre, moisPrecedent, moisSuivant, plagesManquantes } from './calendrier-mois';

/** Charge les mois de `de` à `a` (inclus) dans le cache du parent ; dit seulement si ça a marché. */
export type ChargeurMois = (de: string, a: string) => Promise<{ ok: true } | { ok: false; erreur: string }>;

export interface OptionsMoisDefilants<T> {
  /** Mois affiché en premier (le mois en cours). */
  moisInitial: string;
  /** Mois déjà connus (cache du parent, mis à jour par `charger`). */
  connus: Readonly<Record<string, T | undefined>>;
  charger: ChargeurMois;
  /** Mois ajoutés à chaque pas (3). */
  pas?: number;
  /** Mois d'arrière et d'avant au plus, à partir du mois initial (12 et 12). */
  arriereMax?: number;
  avantMax?: number;
}

export interface MoisDefilants {
  /** Les mois de la fenêtre, dans l'ordre. */
  mois: string[];
  peutArriere: boolean;
  peutAvant: boolean;
  chargementArriere: boolean;
  chargementAvant: boolean;
  /** Dernier échec de chargement ; `reessayer` le lève. */
  erreur?: string;
  voirArriere: () => void;
  voirAvant: () => void;
  reessayer: () => void;
}

/**
 * Fenêtre de mois qui s'élargit en défilant : 3 mois d'abord, 3 de plus vers
 * l'avant quand on approche du bas, 3 vers l'arrière sur demande, jusqu'à 12
 * de chaque côté. Les mois manquants dans `connus` sont demandés au chargeur
 * par plages contiguës, une fois chacune ; un échec n'est pas redemandé
 * tout seul (`reessayer`).
 */
export function useMoisDefilants<T>({ moisInitial, connus, charger, pas = MOIS_PAR_PAS, arriereMax = MOIS_ARRIERE_MAX, avantMax = MOIS_AVANT_MAX }: OptionsMoisDefilants<T>): MoisDefilants {
  const [arriere, setArriere] = useState(0);
  const [avant, setAvant] = useState(Math.min(avantMax, pas - 1));
  const [enCours, setEnCours] = useState<string[]>([]);
  const [echecs, setEchecs] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string>();
  // Plages déjà demandées (en cours ou en échec) : jamais deux fois la même.
  const demandees = useRef(new Set<string>());
  const chargeur = useRef(charger);
  chargeur.current = charger;

  const mois = useMemo(() => {
    let de = moisInitial;
    for (let i = 0; i < arriere; i++) de = moisPrecedent(de);
    let a = moisInitial;
    for (let i = 0; i < avant; i++) a = moisSuivant(a);
    return moisEntre(de, a);
  }, [moisInitial, arriere, avant]);

  useEffect(() => {
    const plages = plagesManquantes(mois, (m) => connus[m] !== undefined || echecs.includes(m));
    for (const [de, a] of plages) {
      const cle = `${de}..${a}`;
      if (demandees.current.has(cle)) continue;
      demandees.current.add(cle);
      setEnCours((x) => [...x, cle]);
      void chargeur.current(de, a).then((r) => {
        setEnCours((x) => x.filter((y) => y !== cle));
        demandees.current.delete(cle);
        if (!r.ok) {
          setEchecs((x) => [...x, ...moisEntre(de, a)]);
          setErreur(r.erreur);
        }
      });
    }
  }, [mois, connus, echecs]);

  const voirArriere = useCallback(() => setArriere((x) => Math.min(arriereMax, x + pas)), [arriereMax, pas]);
  const voirAvant = useCallback(() => setAvant((x) => Math.min(avantMax, x + pas)), [avantMax, pas]);
  const reessayer = useCallback(() => {
    setEchecs([]);
    setErreur(undefined);
  }, []);

  const chargementArriere = enCours.some((c) => ecartMois(c.slice(0, 7), moisInitial) > 0);
  const chargementAvant = enCours.some((c) => ecartMois(c.slice(0, 7), moisInitial) <= 0);
  return { mois, peutArriere: arriere < arriereMax, peutAvant: avant < avantMax, chargementArriere, chargementAvant, erreur, voirArriere, voirAvant, reessayer };
}
