import { useMemo } from 'react';
import type { VersionAnnonce } from '../../../data/types';
import { dateCourte } from '../../../data/format';
import { cn } from '../../../ui';
import { diffMots, type Morceau } from './logique';

function Texte({ morceaux }: { morceaux: Morceau[] }) {
  return (
    <p className="text-[13.5px] leading-relaxed text-(--lm-encre-2)">
      {morceaux.map((m, i) => (
        <span key={i}>
          <span
            className={cn(
              m.type === 'ajout' && 'rounded-sm bg-(--lm-succes-lavis) text-(--lm-encre)',
              m.type === 'retrait' && 'text-(--lm-encre-3) line-through decoration-(--lm-danger)/60',
            )}
          >
            {m.texte}
          </span>{' '}
        </span>
      ))}
    </p>
  );
}

function Colonne({ etiquette, titre, accroche, morceaux, meta, ton }: {
  etiquette: string;
  titre: string;
  accroche?: string;
  morceaux: Morceau[];
  meta?: string;
  ton: 'actuel' | 'propose';
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border p-3.5',
        ton === 'propose' ? 'border-(--lm-or-anneau) bg-(--lm-surface)' : 'border-(--lm-bord) bg-(--lm-surface-2)',
      )}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-[11.5px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">{etiquette}</p>
        {meta && <p className="text-[12px] text-(--lm-encre-3)">{meta}</p>}
      </div>
      <p className="text-[14.5px] font-semibold text-(--lm-encre)">{titre}</p>
      {accroche && <p className="mt-0.5 mb-2 text-[13px] font-medium text-(--lm-brun)">{accroche}</p>}
      <Texte morceaux={morceaux} />
    </div>
  );
}

/** Version en ligne et proposition côte à côte : mots ajoutés surlignés, retirés barrés. */
export function Comparaison({ actuelle, proposition }: { actuelle?: VersionAnnonce; proposition: VersionAnnonce }) {
  const diff = useMemo(
    () => diffMots(actuelle?.description ?? '', proposition.description),
    [actuelle?.description, proposition.description],
  );
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {actuelle ? (
        <Colonne
          etiquette="En ligne"
          titre={actuelle.titre}
          accroche={actuelle.accroche}
          morceaux={diff.avant}
          meta={actuelle.publieeLe ? `Publiée le ${dateCourte(actuelle.publieeLe)}` : undefined}
          ton="actuel"
        />
      ) : (
        <div className="grid place-items-center rounded-lg border border-dashed border-(--lm-bord-fort) p-4 text-[13px] text-(--lm-encre-3)">
          Aucune version publiée dans l’ERP pour ce logement.
        </div>
      )}
      <Colonne
        etiquette="Proposition"
        titre={proposition.titre}
        accroche={proposition.accroche}
        morceaux={diff.apres}
        meta={`${proposition.titre.length} / 50 car. · ${proposition.description.length} car.`}
        ton="propose"
      />
    </div>
  );
}
