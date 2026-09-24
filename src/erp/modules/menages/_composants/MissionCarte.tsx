import { Link } from 'react-router-dom';
import { Camera, Clock } from 'lucide-react';
import { LIBELLES } from '../../../data/libelles';
import type { Logement, Mission, Prestataire } from '../../../data/types';
import { StatusBadge, TON_PLEIN, cn, tonStatut } from '../../../ui';

interface Props {
  mission: Mission;
  logement?: Logement;
  prestataire?: Prestataire;
}

/** Carte compacte d'une mission (planning de la semaine). */
export function MissionCarte({ mission: m, logement, prestataire }: Props) {
  const avant = m.photos.filter((p) => p.moment === 'avant').length;
  const apres = m.photos.filter((p) => p.moment === 'apres').length;
  return (
    <Link
      to={`/erp/menages/${m.id}`}
      className="group relative block overflow-hidden rounded-lg border border-(--lm-bord) bg-(--lm-surface) p-2.5 pl-3.5 text-[12.5px] transition-colors hover:border-(--lm-or-anneau) focus-visible:ring-2 focus-visible:ring-(--lm-or) focus-visible:outline-none"
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', TON_PLEIN[tonStatut('statutMission', m.statut)])} />
      <p className="truncate font-semibold text-(--lm-encre)">{logement?.nom ?? 'Logement inconnu'}</p>
      <p className="lm-chiffres mt-0.5 flex items-center gap-1 text-(--lm-encre-2)">
        <Clock className="size-3.5 shrink-0" aria-hidden />
        {m.heureDebut} <span aria-hidden>→</span>
        <span className="sr-only">prêt avant</span> {m.heureFinMax}
      </p>
      <p className={cn('mt-0.5 truncate', prestataire ? 'text-(--lm-encre-2)' : 'font-medium text-(--lm-alerte)')}>
        {prestataire?.nom ?? 'Sans prestataire'}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge type="statutMission" valeur={m.statut} />
        {m.type !== 'menage' && <span className="text-[11.5px] text-(--lm-encre-3)">{LIBELLES.typeMission[m.type]}</span>}
        {(avant > 0 || apres > 0) && (
          <span className="lm-chiffres inline-flex items-center gap-0.5 text-[11.5px] text-(--lm-encre-3)" title="Photos avant / après">
            <Camera className="size-3" aria-hidden />
            {avant}/{apres}
          </span>
        )}
      </div>
    </Link>
  );
}
