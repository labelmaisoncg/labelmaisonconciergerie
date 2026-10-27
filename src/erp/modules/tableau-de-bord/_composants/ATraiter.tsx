import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BotMessageSquare, CalendarX2, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Flag, Gauge, MessageSquareWarning, PhoneCall, RefreshCw, ShieldAlert, Siren, Star, Tag, TriangleAlert, UserX, type LucideIcon } from 'lucide-react';
import { Card, CardHeader, Drawer, EmptyState, TON_LAVIS, cn } from '../../../ui';
import type { ElementATraiter, TypeATraiter } from './aTraiter';

const ICONES: Record<TypeATraiter, LucideIcon> = {
  message: MessageSquareWarning,
  synchro: RefreshCw,
  avis: Star,
  agent: BotMessageSquare,
  crm: PhoneCall,
  urgence: Siren,
  incident: CircleAlert,
  signalement: Flag,
  charge: UserX,
  prix: Tag,
  double: CalendarX2,
  suspecte: ShieldAlert,
  prix_anormal: TriangleAlert,
  integrite: Gauge,
};

const PRIORITES = { 1: 'Aujourd’hui', 2: 'Cette semaine' } as const;

/** `complet` : panneau « Tout voir » (priorité et détails dépliables) ; sinon une ligne principale et une ligne secondaire. */
function Ligne({ e, complet }: { e: ElementATraiter; complet?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const Icone = ICONES[e.type];
  const apercu = e.details.slice(0, ouvert ? e.details.length : 1);
  const reste = complet ? e.details.length - 1 : 0;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span aria-hidden className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4', TON_LAVIS[e.ton])}>
        <Icone />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link to={e.to} className="inline-flex min-h-8 items-center text-[13.5px] font-semibold text-(--lm-encre) hover:text-(--lm-or-texte) hover:underline">
            {e.titre}
          </Link>
          {complet && <span className="text-[11.5px] text-(--lm-encre-3)">{PRIORITES[e.priorite]}</span>}
        </div>
        <ul className="mt-0.5 space-y-0.5 text-[12.5px] text-(--lm-encre-2)">
          {apercu.map((t, i) => (
            // Dans la carte, des détails en texte simple (le titre mène déjà au premier) ;
            // dans « Tout voir », une ligne touchable par détail, avec un chevron.
            <li key={i} className={complet && e.liens?.[i] ? undefined : 'truncate'} title={t}>
              {complet && e.liens?.[i] ? (
                <Link to={e.liens[i]} className="flex min-h-8 items-center justify-between gap-2 rounded-md hover:text-(--lm-or-texte)">
                  <span className="truncate">{t}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-hidden />
                </Link>
              ) : (
                t
              )}
            </li>
          ))}
        </ul>
        {reste > 0 && (
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="mt-1 inline-flex min-h-8 items-center gap-0.5 text-[12px] font-medium text-(--lm-or-texte) hover:underline"
          >
            {ouvert ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
            {ouvert ? 'Voir moins' : `Voir ${reste} de plus`}
          </button>
        )}
      </div>
    </li>
  );
}

/** « À faire » : les 5 sujets les plus pressants, le reste dans un panneau. */
export function ATraiter({ elements, titre = 'À faire', max = 5 }: { elements: ElementATraiter[]; titre?: string; max?: number }) {
  const [tout, setTout] = useState(false);
  const liste = (els: ElementATraiter[], complet?: boolean) => (
    <ul className="divide-y divide-(--lm-bord)">
      {els.map((e) => (
        <Ligne key={e.id} e={e} complet={complet} />
      ))}
    </ul>
  );
  return (
    <Card flush className="h-full">
      <CardHeader
        className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3"
        titre={titre}
        actions={
          elements.length > max && (
            <button type="button" onClick={() => setTout(true)} className="inline-flex min-h-8 items-center text-[12.5px] font-medium text-(--lm-or-texte) hover:underline">
              Tout voir ({elements.length})
            </button>
          )
        }
      />
      {elements.length ? (
        liste(elements.slice(0, max))
      ) : (
        <EmptyState className="m-4" icone={<CheckCircle2 />} titre="Tout est à jour." />
      )}
      <Drawer ouvert={tout} onFermer={() => setTout(false)} titre="Tout ce qui vous attend">
        <div className="-mx-4 -my-4 sm:-mx-5">{liste(elements, true)}</div>
      </Drawer>
    </Card>
  );
}
