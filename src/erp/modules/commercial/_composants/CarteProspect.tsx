import { ArrowRight, CalendarClock, FileSignature, MapPin, RotateCcw, X } from 'lucide-react';
import { AUJOURDHUI, euros, jourMois } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import type { Prospect } from '../../../data/types';
import { Avatar, Badge, Button, IconButton, cn } from '../../../ui';

export interface ActionsProspect {
  ouvrir: (p: Prospect) => void;
  suivante: (p: Prospect) => void;
  perdu: (p: Prospect) => void;
  relancer: (p: Prospect) => void;
  lancer: (p: Prospect) => void;
}

export const NOM_RESPONSABLE = { abdel: 'Abdel', kamel: 'Kamel' } as const;

export function ProchaineAction({ p, compact }: { p: Prospect; compact?: boolean }) {
  if (!p.prochaineAction && !p.prochaineActionLe) return <span className="text-(--lm-encre-3)">Aucune action prévue</span>;
  const retard = !!p.prochaineActionLe && p.prochaineActionLe < AUJOURDHUI && p.etape !== 'signe' && p.etape !== 'perdu';
  const jour = p.prochaineActionLe === AUJOURDHUI;
  return (
    <span className={cn(compact ? 'flex w-full min-w-0 items-start gap-1 overflow-hidden' : 'inline-flex min-w-0 items-start gap-1', retard ? 'text-(--lm-danger)' : jour ? 'text-(--lm-alerte)' : 'text-(--lm-encre-2)')}>
      <CalendarClock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className={cn('min-w-0', compact && 'truncate')}>
        {p.prochaineAction ?? 'Action'}
        {p.prochaineActionLe && (
          <span className="lm-chiffres font-medium">
            {' '}· {retard ? 'en retard, ' : jour ? 'aujourd’hui, ' : ''}
            {jourMois(p.prochaineActionLe)}
          </span>
        )}
      </span>
    </span>
  );
}

export function CarteProspect({ p, actions }: { p: Prospect; actions: ActionsProspect }) {
  const fini = p.etape === 'signe' || p.etape === 'perdu';
  return (
    <article
      draggable={!fini}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'rounded-lg border border-(--lm-bord) bg-(--lm-surface) p-3 shadow-(--lm-ombre) transition-colors hover:border-(--lm-or-anneau)',
        !fini && 'cursor-grab active:cursor-grabbing',
        p.etape === 'perdu' && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => actions.ouvrir(p)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[13.5px] font-semibold text-(--lm-encre) hover:text-(--lm-or)">{p.nom}</span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-(--lm-encre-2)">
            <MapPin aria-hidden className="size-3 shrink-0" />
            {p.ville} · {p.typeBien}
          </span>
        </button>
        <Avatar nom={NOM_RESPONSABLE[p.responsable]} taille="sm" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="lm-chiffres text-[13px] font-semibold text-(--lm-encre)">
          {euros(p.revenuEstimeAnnuelCentimes, true)}
          <span className="font-normal text-(--lm-encre-3)"> / an</span>
        </span>
        <Badge tone="neutre">{LIBELLES.sourceProspect[p.source]}</Badge>
      </div>
      {!fini && (
        <p className="mt-2 text-[12px]">
          <ProchaineAction p={p} compact />
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-(--lm-bord) pt-2.5">
        {p.etape === 'negociation' && (
          <Button size="sm" variant="primary" icone={<FileSignature />} onClick={() => actions.lancer(p)} className="flex-1">
            Signé : lancer
          </Button>
        )}
        {!fini && p.etape !== 'negociation' && (
          <Button size="sm" variant="secondary" iconeFin={<ArrowRight />} onClick={() => actions.suivante(p)} className="flex-1">
            Étape suivante
          </Button>
        )}
        {!fini && (
          <IconButton size="sm" label={`Marquer ${p.nom} comme perdu`} onClick={() => actions.perdu(p)}>
            <X />
          </IconButton>
        )}
        {p.etape === 'perdu' && (
          <Button size="sm" variant="ghost" icone={<RotateCcw />} onClick={() => actions.relancer(p)}>
            Relancer
          </Button>
        )}
        {p.etape === 'signe' && <span className="text-[12px] text-(--lm-succes)">Mandat signé</span>}
      </div>
    </article>
  );
}
