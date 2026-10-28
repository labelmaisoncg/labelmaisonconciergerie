/**
 * Placer des logements sur la carte (gérant, dans l'ERP) : géocodage de
 * l'adresse (data/geocodage.ts), puis la position est posée sur le
 * logement, seulement si son adresse n'a pas changé entre-temps.
 */
import { texteAdresse } from '../data/carte';
import { PAUSE_ENTRE_LOGEMENTS_MS, geocoderLogement, pause, type ResultatGeocodage } from '../data/geocodage';
import type { ErpContexte } from '../data/store';
import type { Logement } from '../data/types';

type MettreAJour = ErpContexte['mettreAJour'];

/** Un logement : sa position (exacte ou approximative), ou la raison de l'échec. */
export async function placerLogement(l: Pick<Logement, 'id' | 'adresse' | 'codePostal' | 'ville'>, mettreAJour: MettreAJour): Promise<ResultatGeocodage> {
  const r = await geocoderLogement(l);
  if (r.ok) mettreAJour('logements', l.id, (x) => (texteAdresse(x) === r.position.adresse ? { ...x, position: r.position } : x));
  return r;
}

export interface BilanPlacement {
  exacts: number;
  approximatifs: number;
  introuvables: number;
  /** Le service n'a pas répondu (réseau) pour au moins un logement. */
  reseau: boolean;
}

/** Plusieurs logements, l'un après l'autre (jamais en rafale), avec l'avancement. */
export async function placerLogements(
  logements: readonly Pick<Logement, 'id' | 'adresse' | 'codePostal' | 'ville'>[],
  mettreAJour: MettreAJour,
  surAvancement?: (fait: number) => void,
): Promise<BilanPlacement> {
  const bilan: BilanPlacement = { exacts: 0, approximatifs: 0, introuvables: 0, reseau: false };
  for (let k = 0; k < logements.length; k++) {
    if (k > 0) await pause(PAUSE_ENTRE_LOGEMENTS_MS);
    const r = await placerLogement(logements[k], mettreAJour);
    if (r.ok) bilan[r.position.precision === 'adresse' ? 'exacts' : 'approximatifs']++;
    else {
      bilan.introuvables++;
      if (r.raison === 'reseau') bilan.reseau = true;
    }
    surAvancement?.(k + 1);
  }
  return bilan;
}

/** Ce que dit l'écran après un placement : « 3 placés, 1 au centre de sa commune, 1 introuvable. » */
export function phraseBilan(b: BilanPlacement): string {
  const parts = [
    b.exacts ? `${b.exacts} placé${b.exacts > 1 ? 's' : ''}` : '',
    b.approximatifs ? `${b.approximatifs} au centre de ${b.approximatifs > 1 ? 'leur commune' : 'sa commune'}` : '',
    b.introuvables ? `${b.introuvables} introuvable${b.introuvables > 1 ? 's' : ''}` : '',
  ].filter(Boolean);
  const fin = b.introuvables ? (b.reseau ? ' : le service ne répond pas, réessayez plus tard.' : ' : vérifiez l’adresse dans la fiche du logement.') : '.';
  return `${parts.join(', ')}${fin}`.replace(/^./, (c) => c.toLocaleUpperCase('fr'));
}
