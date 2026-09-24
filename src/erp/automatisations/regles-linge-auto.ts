/**
 * Linge : envoi groupé quotidien en blanchisserie et suivi des retours
 * (SPEC §2.6). Même lecture de la position du linge que le module Linge
 * (modules/linge/_composants/calculs.ts) : « sale » = sorti sale non encore
 * envoyé, « en blanchisserie » = envoyé non encore revenu propre.
 */
import { ajouterJours, ecartJours, jourMois, pluriel } from '../data/format';
import { prestataireConforme } from '../data/selectors';
import type { ErpDonnees, Id, LigneArticle, MouvementLinge, Prestataire } from '../data/types';
import { collecteur } from './outils';
import { couvre } from './regles-operations';
import type { Regle } from './types';

/** Au-delà de ce délai sans retour propre, une alerte est levée (incident à 5 jours : suivi-linge). */
export const DELAI_RETOUR_JOURS = 3;

/** Identifiant déterministe de l'envoi automatique d'un logement pour un jour donné. */
export const idEnvoiAuto = (logementId: Id, date: string) => `auto-lin-envoi-${logementId}-${date}`;

function somme(mouvements: MouvementLinge[], type: MouvementLinge['type']): Map<string, number> {
  const total = new Map<string, number>();
  for (const m of mouvements) {
    if (m.type !== type) continue;
    for (const a of m.articles) total.set(a.article, (total.get(a.article) ?? 0) + a.quantite);
  }
  return total;
}

/** Blanchisseries conformes qui couvrent le logement, la mieux notée d'abord. */
function blanchisserie(d: ErpDonnees, logementId: Id, date: string): Prestataire | undefined {
  const l = d.logements.find((x) => x.id === logementId);
  if (!l) return undefined;
  return d.prestataires
    .filter((p) => p.type === 'linge' && p.statut === 'actif' && prestataireConforme(p, date).ok && couvre(p, l))
    .sort((a, b) => (b.noteMoyenne ?? 0) - (a.noteMoyenne ?? 0) || a.nom.localeCompare(b.nom))[0];
}

export const envoiBlanchisserie: Regle = {
  cle: 'envoi-blanchisserie',
  nom: 'Envoi groupé en blanchisserie',
  description:
    `Chaque jour, tout le linge sorti sale et pas encore envoyé part en un seul envoi par logement vers la blanchisserie active et conforme qui couvre le logement. Quand du linge est en blanchisserie depuis plus de ${DELAI_RETOUR_JOURS} jours sans retour propre, alors une alerte « Retour propre attendu » est levée.`,
  spec: '§2.6',
  domaine: 'operations',
  declencheur: 'quotidien',
  actifParDefaut: true,
  executer(d, ctx) {
    const c = collecteur(this.cle, ctx);
    const parLogement = new Map<Id, MouvementLinge[]>();
    for (const m of d.mouvementsLinge) parLogement.set(m.logementId, [...(parLogement.get(m.logementId) ?? []), m]);

    for (const [logementId, mouvements] of parLogement) {
      const l = d.logements.find((x) => x.id === logementId);
      const nom = l?.nom ?? 'un logement';

      /* 1. Envoi groupé du linge sale (sorti jusqu'à aujourd'hui, pas encore envoyé). */
      const sorties = somme(mouvements.filter((m) => m.date <= ctx.date), 'sortie_sale');
      const envoyes = somme(mouvements, 'envoi_blanchisserie');
      const sale: LigneArticle[] = [...sorties]
        .map(([article, q]) => ({ article, quantite: q - (envoyes.get(article) ?? 0) }))
        .filter((a) => a.quantite > 0);
      if (sale.length && l && l.statut !== 'sorti') {
        const id = idEnvoiAuto(logementId, ctx.date);
        const existant = mouvements.find((m) => m.id === id);
        const p = existant?.prestataireId
          ? d.prestataires.find((x) => x.id === existant.prestataireId)
          : blanchisserie(d, logementId, ctx.date);
        if (!p) {
          c.evenement('alerte', `sans-blanchisserie:${logementId}:${ctx.date}`,
            `Linge sale de ${nom} non envoyé : aucune blanchisserie active et conforme ne couvre ce logement.`, 'logement', logementId);
        } else {
          // Même envoi du jour complété si du linge sale arrive après le premier passage.
          const cumul = new Map((existant?.articles ?? []).map((a) => [a.article, a.quantite]));
          for (const a of sale) cumul.set(a.article, (cumul.get(a.article) ?? 0) + a.quantite);
          const articles = [...cumul].map(([article, quantite]) => ({ article, quantite }));
          const total = articles.reduce((s, a) => s + a.quantite, 0);
          const envoi: MouvementLinge = {
            id, logementId, date: ctx.date, type: 'envoi_blanchisserie', articles, prestataireId: p.id,
            note: 'Envoi groupé automatique du linge sale.',
          };
          if (existant) c.modifier('mouvementsLinge', envoi, `Envoi complété : ${pluriel(total, 'article')}.`);
          else c.creer('mouvementsLinge', envoi, `Envoi à ${p.nom} : ${pluriel(total, 'article')}.`);
          c.evenement('action', `${id}:${total}`, `Linge sale de ${nom} envoyé à ${p.nom} : ${pluriel(total, 'article')}.`, 'linge', id);
        }
      }

      /* 2. Retour propre attendu : envoi le plus ancien pas encore couvert par les retours (premier envoyé, premier revenu). */
      const retours = somme(mouvements, 'retour_propre');
      const envois = mouvements.filter((m) => m.type === 'envoi_blanchisserie').sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      const cumulEnvoye = new Map<string, number>();
      let plusAncien: MouvementLinge | undefined;
      for (const e of envois) {
        for (const a of e.articles) {
          const cumul = (cumulEnvoye.get(a.article) ?? 0) + a.quantite;
          cumulEnvoye.set(a.article, cumul);
          if (!plusAncien && cumul > (retours.get(a.article) ?? 0)) plusAncien = e;
        }
      }
      if (!plusAncien || plusAncien.date > ajouterJours(ctx.date, -DELAI_RETOUR_JOURS - 1)) continue;
      const enCours = [...cumulEnvoye].reduce((s, [article, q]) => s + Math.max(0, q - (retours.get(article) ?? 0)), 0);
      const jours = ecartJours(plusAncien.date, ctx.date);
      c.evenement('alerte', `retour:${plusAncien.id}`,
        `Retour propre attendu pour ${nom} : ${pluriel(enCours, 'article')} en blanchisserie, envoi du ${jourMois(plusAncien.date)} (${jours} j).`,
        'linge', plusAncien.id);
    }
    return c.res;
  },
};
