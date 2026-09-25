/**
 * Points de conformité par logement (SPEC §2.2 et §2.10), calculés depuis le
 * référentiel : jamais saisis à la main.
 */
import { mandatDuLogement, nuitsAnnee } from '../../../data/selectors';
import { LIBELLES } from '../../../data/libelles';
import type { ErpDonnees, Logement } from '../../../data/types';

export type StatutConformite = 'ok' | 'a_faire' | 'risque' | 'na';

export const LIBELLE_STATUT: Record<StatutConformite, string> = { ok: 'En règle', a_faire: 'À faire', risque: 'À régler vite', na: 'Pas concerné' };
export const TON_STATUT = { ok: 'succes', a_faire: 'alerte', risque: 'danger', na: 'neutre' } as const;

export interface PointConformite {
  cle: 'mandat' | 'enregistrement' | 'dpe' | 'nuits' | 'assurance' | 'acces';
  titre: string;
  statut: StatutConformite;
  constat: string;
  action?: string;
}

const fait = (l: Logement, cle: Logement['checklistLancement'][number]['cle']) => l.checklistLancement.find((c) => c.cle === cle)?.fait ?? false;

export function pointsLogement(l: Logement, d: Pick<ErpDonnees, 'mandats' | 'reservations'>): PointConformite[] {
  const enService = l.statut === 'actif' || l.statut === 'pause';
  const points: PointConformite[] = [];

  const mandat = mandatDuLogement(d.mandats, l.id);
  points.push(
    mandat?.statut === 'signe'
      ? { cle: 'mandat', titre: 'Mandat écrit', statut: 'ok', constat: `Mandat ${mandat.reference} signé.` }
      : {
          cle: 'mandat',
          titre: 'Mandat écrit',
          statut: enService ? 'risque' : 'a_faire',
          constat: mandat ? `Mandat ${mandat.reference} : ${LIBELLES.statutMandat[mandat.statut].toLowerCase()}.` : 'Aucun mandat.',
          action: 'Faire signer le mandat de gestion avant toute mise en location.',
        },
  );

  points.push(
    l.numeroEnregistrement
      ? { cle: 'enregistrement', titre: 'N° d’enregistrement', statut: 'ok', constat: l.numeroEnregistrement }
      : {
          cle: 'enregistrement',
          titre: 'N° d’enregistrement',
          statut: enService ? 'risque' : 'a_faire',
          constat: 'Numéro absent.',
          action: 'Déclarer le meublé de tourisme en mairie (téléservice) et reporter le numéro sur chaque annonce.',
        },
  );

  if (!l.dpe) points.push({ cle: 'dpe', titre: 'DPE', statut: 'a_faire', constat: 'DPE non fourni.', action: 'Demander le DPE au propriétaire (diagnostiqueur certifié si absent).' });
  else if (l.dpe === 'F' || l.dpe === 'G')
    points.push({
      cle: 'dpe',
      titre: 'DPE',
      statut: 'risque',
      constat: `Classe ${l.dpe}.`,
      action: 'Logement énergivore : informer le propriétaire par écrit et vérifier le calendrier réglementaire applicable aux meublés de tourisme.',
    });
  else points.push({ cle: 'dpe', titre: 'DPE', statut: 'ok', constat: `Classe ${l.dpe}.` });

  if (!l.residencePrincipale) points.push({ cle: 'nuits', titre: 'Plafond 120 nuits', statut: 'na', constat: 'Résidence secondaire ou dédiée.' });
  else {
    const n = nuitsAnnee(d.reservations, l.id);
    const constat = `${n.nuits} / ${n.plafond} nuits cette année.`;
    if (n.restant <= 0)
      points.push({ cle: 'nuits', titre: 'Plafond 120 nuits', statut: 'risque', constat, action: 'Plafond atteint : fermer le calendrier jusqu’au 31 décembre sur tous les canaux.' });
    else if (n.restant <= 20)
      points.push({ cle: 'nuits', titre: 'Plafond 120 nuits', statut: 'a_faire', constat, action: `Plus que ${n.restant} nuits : limiter les disponibilités et prévenir le propriétaire.` });
    else points.push({ cle: 'nuits', titre: 'Plafond 120 nuits', statut: 'ok', constat: `${constat} Reste ${n.restant}.` });
  }

  points.push(
    fait(l, 'assurance_proprietaire')
      ? { cle: 'assurance', titre: 'Assurance propriétaire', statut: 'ok', constat: 'Attestation reçue.' }
      : { cle: 'assurance', titre: 'Assurance propriétaire', statut: enService ? 'risque' : 'a_faire', constat: 'Attestation manquante.', action: 'Obtenir l’attestation couvrant la location meublée de courte durée.' },
  );

  const accesOk = fait(l, 'acces_securise') && l.serrure !== 'cles';
  points.push(
    accesOk
      ? { cle: 'acces', titre: 'Accès sécurisé', statut: 'ok', constat: `${LIBELLES.serrure[l.serrure]}, code par séjour.` }
      : {
          cle: 'acces',
          titre: 'Accès sécurisé',
          statut: 'a_faire',
          constat: `${LIBELLES.serrure[l.serrure]}${fait(l, 'acces_securise') ? '' : ', point de checklist non validé'}.`,
          action: 'Installer une serrure connectée ou une boîte à clés avec code changé à chaque séjour.',
        },
  );
  return points;
}

/** Statut global : le pire des points. */
export function statutGlobal(points: PointConformite[]): StatutConformite {
  if (points.some((p) => p.statut === 'risque')) return 'risque';
  if (points.some((p) => p.statut === 'a_faire')) return 'a_faire';
  return 'ok';
}
