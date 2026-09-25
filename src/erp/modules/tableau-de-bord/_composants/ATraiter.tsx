import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  MessageSquareWarning,
  Receipt,
  Rocket,
  Shirt,
  Target,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, Drawer, EmptyState, TON_LAVIS, cn } from '../../../ui';
import type { ElementATraiter, TypeATraiter } from './aTraiter';

const ICONES: Record<TypeATraiter, LucideIcon> = {
  incident_grave: AlertTriangle,
  mission_attribuer: UserPlus,
  document: FileWarning,
  message: MessageSquareWarning,
  mission_valider: ClipboardCheck,
  incident: AlertTriangle,
  linge: Shirt,
  facture: Receipt,
  paiement: Banknote,
  lancement: Rocket,
  commercial: Target,
};

const PRIORITES = { 1: 'Aujourd’hui', 2: 'Cette semaine', 3: 'Quand vous pouvez' } as const;

function Ligne({ e }: { e: ElementATraiter }) {
  const [ouvert, setOuvert] = useState(false);
  const Icone = ICONES[e.type];
  const apercu = e.details.slice(0, ouvert ? e.details.length : 1);
  const reste = e.details.length - 1;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span aria-hidden className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4', TON_LAVIS[e.ton])}>
        <Icone />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link to={e.to} className="text-[13.5px] font-semibold text-(--lm-encre) hover:text-(--lm-or) hover:underline">
            {e.titre}
          </Link>
          <span className="text-[11.5px] text-(--lm-encre-3)">{PRIORITES[e.priorite]}</span>
        </div>
        <ul className="mt-0.5 space-y-0.5 text-[12.5px] text-(--lm-encre-2)">
          {apercu.map((t, i) => (
            <li key={i} className="truncate" title={t}>
              {t}
            </li>
          ))}
        </ul>
        {reste > 0 && (
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-medium text-(--lm-or) hover:underline"
          >
            {ouvert ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
            {ouvert ? 'Voir moins' : `Voir ${reste} de plus`}
          </button>
        )}
      </div>
      <Link
        to={e.to}
        aria-label={`Ouvrir : ${e.titre}`}
        className="mt-1 hidden shrink-0 rounded-md px-2 py-1 text-[12.5px] font-medium text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis) hover:text-(--lm-encre) sm:inline-flex"
      >
        Ouvrir
      </Link>
    </li>
  );
}

/** « À faire » : les 5 sujets les plus pressants, le reste dans un panneau. */
export function ATraiter({ elements, titre = 'À faire', max = 5 }: { elements: ElementATraiter[]; titre?: string; max?: number }) {
  const [tout, setTout] = useState(false);
  const aujourdhui = elements.filter((e) => e.priorite === 1).length;
  const liste = (els: ElementATraiter[]) => (
    <ul className="divide-y divide-(--lm-bord)">
      {els.map((e) => (
        <Ligne key={e.id} e={e} />
      ))}
    </ul>
  );
  return (
    <Card flush className="h-full">
      <CardHeader
        className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3"
        titre={titre}
        description={
          elements.length
            ? aujourdhui
              ? `${elements.length} sujet${elements.length > 1 ? 's' : ''}, dont ${aujourdhui} pour aujourd’hui.`
              : `${elements.length} sujet${elements.length > 1 ? 's' : ''}, rien d’urgent.`
            : undefined
        }
        actions={
          elements.length > max && (
            <button type="button" onClick={() => setTout(true)} className="text-[12.5px] font-medium text-(--lm-or) hover:underline">
              Tout voir ({elements.length})
            </button>
          )
        }
      />
      {elements.length ? (
        <>
          {liste(elements.slice(0, max))}
          {elements.length > max && (
            <button
              type="button"
              onClick={() => setTout(true)}
              className="w-full border-t border-(--lm-bord) px-4 py-2.5 text-left text-[13px] font-medium text-(--lm-or) hover:bg-(--lm-surface-2)"
            >
              Voir les {elements.length - max} autres sujets
            </button>
          )}
        </>
      ) : (
        <EmptyState className="m-4" icone={<CheckCircle2 />} titre="Tout est à jour" description="Rien ne vous attend. Profitez-en !" />
      )}
      <Drawer ouvert={tout} onFermer={() => setTout(false)} titre="Tout ce qui vous attend" sousTitre="Du plus pressé au moins pressé.">
        <div className="-mx-4 -my-4 sm:-mx-5">{liste(elements)}</div>
      </Drawer>
    </Card>
  );
}
