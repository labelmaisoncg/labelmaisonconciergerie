/**
 * Règle de pilotage : rafraîchissement mensuel des annonces (SPEC §11).
 *
 * Idempotente : une seule version par logement et par mois (id
 * `ann-<logement>-<mois>`), quel que soit son statut. Une version rejetée
 * compte : on ne repropose pas le même mois.
 */
import { idVersion, proposerVersion } from '../annonces/generer';
import { ajouterJours } from '../data/format';
import { logementsActifs } from '../data/selectors';
import { collecteur } from './outils';
import type { Regle } from './types';

/** Délai au-delà duquel une proposition non traitée lève une alerte. */
export const DELAI_VALIDATION_JOURS = 7;

export const rafraichissementAnnonces: Regle = {
  cle: 'rafraichissement-annonces',
  nom: 'Rafraîchissement mensuel des annonces',
  description:
    'Chaque mois, pour chaque logement actif sans version du mois, l’agent propose une nouvelle description (saison, repères locaux, avis corrigés) à valider par Abdel ou Kamel. Une proposition en attente depuis plus de 7 jours lève une alerte.',
  spec: '§11',
  domaine: 'pilotage',
  declencheur: 'mensuel',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const mois = ctx.date.slice(0, 7);
    const versions = d.versionsAnnonce ?? [];
    const traites = new Set(versions.filter((v) => v.mois === mois).map((v) => v.logementId));
    const ids = new Set(versions.map((v) => v.id));

    for (const l of logementsActifs(d.logements)) {
      const id = idVersion(l.id, mois);
      if (traites.has(l.id) || ids.has(id)) continue;
      const v = proposerVersion(d, l.id, mois, ctx.date);
      c.creer('versionsAnnonce', v, `Version ${mois} de l’annonce ${l.nom} proposée.`);
      c.evenement('action', `${mois}:${l.id}:proposee`, `Nouvelle version d’annonce proposée pour ${l.nom}, à valider.`, 'versionAnnonce', id);
    }

    const limite = ajouterJours(ctx.date, -DELAI_VALIDATION_JOURS);
    for (const v of versions) {
      if (v.statut !== 'proposee' || v.creeLe >= limite) continue;
      const l = d.logements.find((x) => x.id === v.logementId);
      c.evenement(
        'alerte',
        `${v.id}:attente`,
        `Annonce en attente de validation : ${l?.nom ?? v.logementId}, proposée le ${v.creeLe.split('-').reverse().join('/')}.`,
        'versionAnnonce',
        v.id,
      );
    }
    return c.res;
  },
};
