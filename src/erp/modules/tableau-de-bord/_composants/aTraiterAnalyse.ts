/**
 * « À faire » : prix à revoir (une seule ligne groupée, « Prix à revoir
 * (N) ») et anomalies (double réservation, départ sans personne en charge,
 * réservation à vérifier, prix inhabituel, plateformes pas à jour,
 * occupation à vérifier). Ajouté à construireATraiter (aTraiter.ts).
 */
import { ACTION_JOURNAL_REPULL } from '../../../data/repull';
import { detecterAnomalies, type Anomalie, type TypeAnomalie } from '../../../data/anomalies';
import { MAINTENANT } from '../../../data/format';
import { sansChargeLe } from '../../../data/operations';
import { ecartJours } from '../../../data/prix-conseils';
import type { DateISO, ErpDonnees } from '../../../data/types';
import { conseilsDuJour } from '../../logements/_composants/prix';
import type { ElementATraiter, TypeATraiter } from './aTraiter';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Présentation de chaque type d'anomalie dans « À faire ». */
const LIGNES: Record<TypeAnomalie, { type: TypeATraiter; plusieurs: (n: number) => string; gerant: boolean }> = {
  chevauchement: { type: 'double', plusieurs: (n) => `${n} risques de double réservation`, gerant: false },
  sans_charge: { type: 'charge', plusieurs: (n) => `${n} départs sans personne en charge`, gerant: true },
  reservation_suspecte: { type: 'suspecte', plusieurs: (n) => `${n} réservations à vérifier`, gerant: false },
  prix_anormal: { type: 'prix_anormal', plusieurs: (n) => `${n} logements à un prix inhabituel`, gerant: true },
  synchro_ancienne: { type: 'synchro', plusieurs: () => 'Airbnb et Booking pas mis à jour', gerant: false },
  integrite: { type: 'integrite', plusieurs: () => 'Occupation à vérifier', gerant: true },
};

/** Dernière mise à jour des plateformes, si elle a réussi (un échec a déjà sa ligne dans « À faire »). */
function derniereSynchroReussie(d: ErpDonnees): string | undefined {
  const derniere = d.journal.filter((j) => j.action === ACTION_JOURNAL_REPULL).sort((a, b) => b.horodatage.localeCompare(a.horodatage))[0];
  return derniere && !/erreur/i.test(derniere.details) ? derniere.horodatage : undefined;
}

export function elementsPrixEtAnomalies(d: ErpDonnees, aujourdhui: DateISO, { gerant }: { gerant: boolean }): ElementATraiter[] {
  const liste: ElementATraiter[] = [];

  // Prix à revoir : le gérant seul (c'est lui qui change les prix sur les plateformes).
  if (gerant) {
    const conseils = conseilsDuJour(d);
    if (conseils.length) {
      const parLogement = new Map<string, typeof conseils>();
      for (const c of conseils) parLogement.set(c.logementId, [...(parLogement.get(c.logementId) ?? []), c]);
      const lien = (id: string) => `/erp/logements/${encodeURIComponent(id)}#prix`;
      const lignes = [...parLogement.values()].map((cs) => {
        const nuits = (t: string) => cs.filter((c) => c.type === t).reduce((s, c) => s + c.nuits, 0);
        const morceaux = [
          nuits('baisse') && `baisser ${pluriel(nuits('baisse'), 'nuit')}`,
          nuits('hausse') && `monter ${pluriel(nuits('hausse'), 'nuit')}`,
          cs.some((c) => c.type === 'trou') && `combler ${pluriel(cs.filter((c) => c.type === 'trou').length, 'trou')}`,
        ].filter(Boolean);
        return { id: cs[0].logementId, texte: `${cs[0].nom} : ${morceaux.join(', ')}` };
      });
      liste.push({
        id: 'prix',
        type: 'prix',
        // Une nuit à changer d'ici après-demain : aujourd'hui.
        priorite: conseils.some((c) => ecartJours(aujourdhui, c.debut) <= 2) ? 1 : 2,
        ton: 'or',
        titre: `Prix à revoir (${conseils.length})`,
        details: lignes.map((x) => x.texte),
        liens: lignes.map((x) => lien(x.id)),
        to: lien(lignes[0].id),
      });
    }
  }

  const anomalies = detecterAnomalies({
    logements: d.logements,
    reservations: d.reservations,
    equipe: d.equipe,
    affectations: d.affectations,
    absences: d.absences ?? [],
    aujourdhui,
    maintenant: MAINTENANT,
    derniereSynchro: derniereSynchroReussie(d),
  });
  // Logements déjà sans personne en charge aujourd'hui : la ligne « sans personne en charge » existe déjà.
  const sansChargeAujourdhui = new Set(gerant && d.equipe && d.affectations ? sansChargeLe({ ...d, absences: d.absences ?? [] }, aujourdhui).map((x) => x.logementId) : []);
  const parType = new Map<TypeAnomalie, Anomalie[]>();
  for (const a of anomalies) {
    if (a.type === 'sans_charge' && a.logementId && sansChargeAujourdhui.has(a.logementId)) continue;
    if (LIGNES[a.type].gerant && !gerant) continue;
    parType.set(a.type, [...(parType.get(a.type) ?? []), a]);
  }
  const nom = (id?: string) => d.logements.find((x) => x.id === id)?.nom;
  for (const [type, as] of parType) {
    const l = LIGNES[type];
    // Plusieurs : chaque détail dit de quel logement il s'agit (le titre ne le dit plus).
    const details = as.map((a) => (as.length > 1 && nom(a.logementId) && type !== 'prix_anormal' ? `${nom(a.logementId)} : ${a.detail}` : a.detail));
    liste.push({
      id: `anomalie-${type}`,
      type: l.type,
      priorite: as.some((a) => a.grave) || type === 'synchro_ancienne' ? 1 : 2,
      // Le rouge pour la seule double réservation (un vrai problème) ; le reste est à vérifier.
      ton: type === 'chevauchement' ? 'danger' : 'alerte',
      titre: as.length > 1 ? l.plusieurs(as.length) : as[0].titre,
      details: type === 'prix_anormal' && as.length > 1 ? as.map((a) => `${nom(a.logementId) ?? 'Logement'} : ${a.detail}`) : details,
      ...(as.length > 1 ? { liens: as.map((a) => a.lien) } : {}),
      to: as[0].lien,
    });
  }
  return liste;
}
