/**
 * État local de la page : règles actives + journal des automatisations,
 * persisté sous 'lm-erp-auto-v1'. L'intégrateur remplacera ce hook par les
 * champs équivalents du store (même format, voir automatisations/moteur.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { CLE_AUTOMATISATIONS, REGLES, type EvenementAuto } from '../../../automatisations';

export interface EtatAuto {
  actives: Record<string, boolean>;
  evenements: EvenementAuto[];
}

const MAX_EVENEMENTS = 500;

function lire(): EtatAuto {
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

export function useEtatAuto() {
  const [etat, setEtat] = useState<EtatAuto>(lire);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_AUTOMATISATIONS, JSON.stringify(etat));
    } catch {
      /* navigation privée : l'état reste en mémoire */
    }
  }, [etat]);

  const estActive = useCallback(
    (cle: string) => etat.actives[cle] ?? REGLES.find((r) => r.cle === cle)?.actifParDefaut ?? false,
    [etat.actives],
  );

  const basculer = useCallback((cle: string, actif: boolean) => {
    setEtat((e) => ({ ...e, actives: { ...e.actives, [cle]: actif } }));
  }, []);

  /** Ajoute des événements en tête, dédoublonnés par id (un constat déjà connu n'est pas répété). */
  const ajouterEvenements = useCallback((nouveaux: EvenementAuto[]) => {
    setEtat((e) => {
      const connus = new Set(e.evenements.map((x) => x.id));
      const inedits = nouveaux.filter((x) => !connus.has(x.id));
      if (!inedits.length) return e;
      return { ...e, evenements: [...inedits, ...e.evenements].slice(0, MAX_EVENEMENTS) };
    });
  }, []);

  const viderJournal = useCallback(() => setEtat((e) => ({ ...e, evenements: [] })), []);

  const clesActives = REGLES.filter((r) => estActive(r.cle)).map((r) => r.cle);

  return { etat, estActive, basculer, ajouterEvenements, viderJournal, clesActives };
}
