import { useState } from 'react';
import { ETAPES_PIPELINE } from '../../../data/constantes';
import { euros } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { prospectsParEtape } from '../../../data/selectors';
import type { EtapeProspect, Prospect } from '../../../data/types';
import { TON_PLEIN, cn, tonStatut } from '../../../ui';
import { CarteProspect, type ActionsProspect } from './CarteProspect';

/** Tableau par étape ; glisser-déposer une carte la change d'étape. */
export function Kanban({
  prospects,
  actions,
  deplacer,
  avecPerdus,
}: {
  prospects: Prospect[];
  actions: ActionsProspect;
  deplacer: (id: string, etape: EtapeProspect) => void;
  avecPerdus: boolean;
}) {
  const parEtape = prospectsParEtape(prospects);
  const etapes: EtapeProspect[] = avecPerdus ? [...ETAPES_PIPELINE, 'perdu'] : [...ETAPES_PIPELINE];
  const [survol, setSurvol] = useState<EtapeProspect | null>(null);

  return (
    <div className="lm-defilement -mx-1 flex flex-col gap-3 px-1 pb-2 lg:flex-row lg:overflow-x-auto">
      {etapes.map((e) => {
        const liste = [...parEtape[e]].sort((a, b) => (a.prochaineActionLe ?? '9').localeCompare(b.prochaineActionLe ?? '9'));
        const total = liste.reduce((s, p) => s + p.revenuEstimeAnnuelCentimes, 0);
        return (
          <section
            key={e}
            aria-label={`${LIBELLES.etapeProspect[e]} : ${liste.length} prospects`}
            onDragOver={(ev) => {
              ev.preventDefault();
              setSurvol(e);
            }}
            onDragLeave={() => setSurvol((s) => (s === e ? null : s))}
            onDrop={(ev) => {
              ev.preventDefault();
              setSurvol(null);
              const id = ev.dataTransfer.getData('text/plain');
              if (id) deplacer(id, e);
            }}
            className={cn(
              'flex min-w-0 flex-col rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-2 lg:w-[17rem] lg:shrink-0',
              survol === e && 'border-(--lm-or) bg-(--lm-or-lavis)',
            )}
          >
            <header className="mb-2 flex items-center justify-between gap-2 px-1.5 pt-1">
              <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-(--lm-encre)">
                <span aria-hidden className={cn('size-2 rounded-full', TON_PLEIN[tonStatut('etapeProspect', e)])} />
                {LIBELLES.etapeProspect[e]}
                <span className="lm-chiffres rounded-full bg-(--lm-neutre-lavis) px-1.5 text-[11.5px] font-medium text-(--lm-encre-2)">{liste.length}</span>
              </h3>
              <span className="lm-chiffres text-[12px] text-(--lm-encre-2)">{euros(total, true)}</span>
            </header>
            <div className="flex flex-col gap-2">
              {liste.map((p) => (
                <CarteProspect key={p.id} p={p} actions={actions} />
              ))}
              {!liste.length && (
                <p className="rounded-lg border border-dashed border-(--lm-bord-fort) px-3 py-5 text-center text-[12px] text-(--lm-encre-3)">
                  Déposez un prospect ici
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
