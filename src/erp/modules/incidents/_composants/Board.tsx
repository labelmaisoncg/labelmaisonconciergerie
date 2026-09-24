import { Camera } from 'lucide-react';
import { dateCourte, euros } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { Incident, StatutIncident } from '../../../data/types';
import { Badge, StatusBadge, TON_PLEIN, cn, tonStatut } from '../../../ui';

const COLONNES: StatutIncident[] = ['ouvert', 'en_cours', 'resolu'];
const POIDS = { haute: 0, moyenne: 1, faible: 2 } as const;

/** Tableau par statut ; les résolus sont limités aux plus récents. */
export function Board({ incidents, onOuvrir }: { incidents: Incident[]; onOuvrir: (i: Incident) => void }) {
  const { logements } = useErp();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLONNES.map((statut) => {
        const liste = incidents
          .filter((i) => i.statut === statut)
          .sort((a, b) => (statut === 'resolu' ? b.date.localeCompare(a.date) : POIDS[a.gravite] - POIDS[b.gravite] || a.date.localeCompare(b.date)));
        const visibles = statut === 'resolu' ? liste.slice(0, 8) : liste;
        return (
          <section key={statut} aria-label={LIBELLES.statutIncident[statut]} className="rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-2">
            <header className="mb-2 flex items-center justify-between px-1">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <span aria-hidden className={cn('size-2 rounded-full', TON_PLEIN[tonStatut('statutIncident', statut)])} />
                {LIBELLES.statutIncident[statut]}
              </p>
              <span className="lm-chiffres text-[12px] text-(--lm-encre-3)">{liste.length}</span>
            </header>
            <div className="flex flex-col gap-1.5">
              {visibles.length === 0 && <p className="px-1 py-3 text-[12.5px] text-(--lm-encre-3)">Aucun incident</p>}
              {visibles.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onOuvrir(i)}
                  className="rounded-lg border border-(--lm-bord) bg-(--lm-surface) p-3 text-left text-[12.5px] transition-colors hover:border-(--lm-or-anneau) focus-visible:ring-2 focus-visible:ring-(--lm-or) focus-visible:outline-none"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge type="gravite" valeur={i.gravite} />
                    <Badge>{LIBELLES.categorieIncident[i.categorie]}</Badge>
                  </div>
                  <p className="font-semibold text-(--lm-encre)">{logements.find((l) => l.id === i.logementId)?.nom}</p>
                  <p className="mt-0.5 line-clamp-2 text-(--lm-encre-2)">{i.description}</p>
                  <p className="lm-chiffres mt-1.5 flex flex-wrap items-center gap-x-3 text-[12px] text-(--lm-encre-3)">
                    <span>{dateCourte(i.date)}</span>
                    {i.responsable && <span>{i.responsable}</span>}
                    {i.coutCentimes !== undefined && <span>{euros(i.coutCentimes)}</span>}
                    <span className="inline-flex items-center gap-0.5">
                      <Camera className="size-3" aria-hidden /> {i.preuves.length}
                      <span className="sr-only">preuves</span>
                    </span>
                  </p>
                </button>
              ))}
              {liste.length > visibles.length && (
                <p className="px-1 py-1 text-[12px] text-(--lm-encre-3)">Et {liste.length - visibles.length} autres, voir la liste.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
