import { CalendarClock, CalendarDays, FileBadge, Home, MessageSquare, Sparkles, Ticket, type LucideIcon } from 'lucide-react';
import type { Declencheur, Regle } from '../../../automatisations';
import { Badge, cn } from '../../../ui';

const DECLENCHEURS: Record<Declencheur, { libelle: string; icone: LucideIcon }> = {
  reservation: { libelle: 'À chaque réservation', icone: Ticket },
  mission: { libelle: 'À chaque mission', icone: Sparkles },
  quotidien: { libelle: 'Chaque jour', icone: CalendarClock },
  mensuel: { libelle: 'Chaque fin de mois', icone: CalendarDays },
  document: { libelle: 'Documents', icone: FileBadge },
  message: { libelle: 'À chaque message', icone: MessageSquare },
  logement: { libelle: 'Logements', icone: Home },
};

export interface CarteRegleProps {
  regle: Regle;
  active: boolean;
  declenchements: number;
  onBasculer: (actif: boolean) => void;
}

/** Une règle : description en langage clair, déclencheur, interrupteur, compteur 30 j. */
export function CarteRegle({ regle, active, declenchements, onBasculer }: CarteRegleProps) {
  const d = DECLENCHEURS[regle.declencheur];
  const Icone = d.icone;
  const idTitre = `regle-${regle.cle}`;
  return (
    <article
      aria-labelledby={idTitre}
      className={cn(
        'flex h-full flex-col rounded-xl border bg-(--lm-surface) p-4 shadow-(--lm-ombre) transition-colors',
        active ? 'border-(--lm-bord)' : 'border-dashed border-(--lm-bord-fort) bg-(--lm-surface-2)',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={idTitre} className={cn('text-[14.5px] font-semibold', active ? 'text-(--lm-encre)' : 'text-(--lm-encre-2)')}>
          {regle.nom}
        </h3>
        <Interrupteur actif={active} onChange={onBasculer} label={`${active ? 'Désactiver' : 'Activer'} : ${regle.nom}`} />
      </div>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-(--lm-encre-2)">{regle.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
        <Badge icone={<Icone />}>{d.libelle}</Badge>
        {regle.spec && <Badge tone="or">SPEC {regle.spec}</Badge>}
        <span className="lm-chiffres ml-auto text-(--lm-encre-3)">
          {active ? `déclenchée ${declenchements} fois (30 j)` : 'en pause'}
        </span>
      </div>
    </article>
  );
}

function Interrupteur({ actif, onChange, label }: { actif: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label}
      onClick={() => onChange(!actif)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        actif ? 'bg-(--lm-or)' : 'bg-(--lm-bord-fort)',
      )}
    >
      <span
        aria-hidden
        className={cn('inline-block size-5 rounded-full bg-white shadow-sm transition-transform', actif ? 'translate-x-5.5' : 'translate-x-0.5')}
      />
    </button>
  );
}
