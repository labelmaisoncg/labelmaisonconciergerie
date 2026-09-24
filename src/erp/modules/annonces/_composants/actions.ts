/**
 * Actions du module Annonces, bâties sur `upsert` du store (chaque changement
 * est journalisé). Les règles métier sont vérifiées ici et renvoyées en clair.
 */
import { useMemo } from 'react';
import { controlerVersion, proposerVersion } from '../../../annonces/generer';
import { AUJOURDHUI } from '../../../data/format';
import { useErp } from '../../../data/store';
import type { Id, VersionAnnonce } from '../../../data/types';
import { MOIS_COURANT, peutValider, prochainId } from './logique';

export type Issue = { ok: true; message?: string } | { ok: false; erreur: string };

const non = (erreur: string): Issue => ({ ok: false, erreur });

export function useActionsAnnonce() {
  const d = useErp();
  const { upsert, utilisateur, donnees } = d;

  return useMemo(() => {
    const trouver = (id: Id) => donnees.versionsAnnonce.find((v) => v.id === id);
    const droits = (): Issue | undefined =>
      peutValider(utilisateur.role) ? undefined : non('Seuls Abdel ou Kamel (gérant, opérations) valident et publient les annonces.');

    const valider = (id: Id, texte?: Pick<VersionAnnonce, 'titre' | 'accroche' | 'description'>): Issue => {
      const refus = droits();
      if (refus) return refus;
      const v = trouver(id);
      if (!v) return non('Version introuvable.');
      if (v.statut !== 'proposee') return non('Seule une proposition en attente peut être validée.');
      const cible = texte ? { ...v, ...texte } : v;
      const erreurs = controlerVersion(cible);
      if (erreurs.length) return non(`Validation impossible. ${erreurs.join(' ')}`);
      const modifiee = !!texte && (texte.titre !== v.titre || texte.accroche !== v.accroche || texte.description !== v.description);
      upsert('versionsAnnonce', {
        ...cible,
        statut: 'validee',
        valideePar: utilisateur.nom,
        valideeLe: AUJOURDHUI,
        raisons: modifiee ? [...v.raisons, `Texte retouché par ${utilisateur.nom} avant validation.`] : v.raisons,
      });
      return { ok: true, message: 'Version validée. Il reste à la publier.' };
    };

    const publier = (id: Id): Issue => {
      const refus = droits();
      if (refus) return refus;
      const v = trouver(id);
      if (!v) return non('Version introuvable.');
      if (v.statut !== 'validee') return non('Publication impossible : la version doit d’abord être validée par un humain.');
      upsert('versionsAnnonce', { ...v, statut: 'publiee', publieeLe: AUJOURDHUI });
      return { ok: true, message: 'Version publiée. L’effet sur les réservations sera mesuré sur 30 jours.' };
    };

    const rejeter = (id: Id, motif: string): Issue => {
      const refus = droits();
      if (refus) return refus;
      const v = trouver(id);
      if (!v) return non('Version introuvable.');
      if (v.statut === 'publiee' || v.statut === 'rejetee') return non('Cette version ne peut plus être rejetée.');
      const texte = motif.trim();
      if (texte.length < 5) return non('Le motif du rejet est obligatoire : il sert à améliorer les prochaines propositions.');
      upsert('versionsAnnonce', { ...v, statut: 'rejetee', motifRejet: texte, valideePar: utilisateur.nom, valideeLe: AUJOURDHUI });
      return { ok: true, message: 'Proposition rejetée.' };
    };

    const generer = (logementId: Id): Issue => {
      const l = donnees.logements.find((x) => x.id === logementId);
      if (!l) return non('Logement introuvable.');
      if (l.statut !== 'actif') return non('Seuls les logements actifs ont une annonce à rafraîchir.');
      const v = proposerVersion(donnees, logementId, MOIS_COURANT, AUJOURDHUI);
      const enAttente = donnees.versionsAnnonce.find(
        (x) => x.logementId === logementId && x.statut === 'proposee' && x.description === v.description && x.titre === v.titre,
      );
      if (enAttente) return non('Une proposition identique attend déjà une validation : rien de nouveau dans les données depuis.');
      upsert('versionsAnnonce', { ...v, id: prochainId(donnees.versionsAnnonce, logementId, MOIS_COURANT) });
      return { ok: true, message: `Nouvelle proposition pour ${l.nom}, à valider.` };
    };

    return { valider, publier, rejeter, generer, autorise: peutValider(utilisateur.role) };
  }, [upsert, utilisateur, donnees]);
}
