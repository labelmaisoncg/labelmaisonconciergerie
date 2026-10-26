import { useState } from 'react';
import { ChevronDown, ChevronRight, Phone } from 'lucide-react';
import { STATUTS_CLOS, STATUTS_CRM } from '../../../data/crm';
import { jourMois } from '../../../data/format';
import type { ContactCrm, StatutContactCrm } from '../../../data/types';
import { cn } from '../../../ui';
import { PastilleStatut, relanceEnRetard, type GrilleProps } from './Grille';
import { POINT } from './statuts';

/**
 * Le CRM sur téléphone : une carte par étape, une ligne par contact (nom,
 * étape modifiable, ville, relance) et le bouton d'appel à portée de pouce.
 * Même regroupement et même ordre que la grille de l'ordinateur.
 */
export function ListeMobile({ contacts, onOuvrir, onModifier, lectureSeule }: GrilleProps) {
  const [replies, setReplies] = useState<Set<StatutContactCrm>>(() => new Set(STATUTS_CLOS));
  const basculer = (s: StatutContactCrm) =>
    setReplies((r) => {
      const n = new Set(r);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  const groupes = STATUTS_CRM.map((s) => ({
    ...s,
    lignes: contacts
      .filter((c) => c.statut === s.cle)
      .sort((a, b) => (a.relanceLe ?? '9999').localeCompare(b.relanceLe ?? '9999') || b.creeLe.localeCompare(a.creeLe)),
  })).filter((g) => g.lignes.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {groupes.map((g) => {
        const replie = replies.has(g.cle);
        return (
          <section key={g.cle} className="overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre)">
            <h2>
              <button
                type="button"
                onClick={() => basculer(g.cle)}
                aria-expanded={!replie}
                className="flex h-11 w-full items-center gap-2 px-3.5 text-left text-[14px] font-semibold text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset"
              >
                <span className={cn('size-2 rounded-full', POINT[g.cle])} aria-hidden />
                <span className="flex-1">{g.libelle}</span>
                <span className="lm-chiffres text-[12.5px] font-medium text-(--lm-encre-2)">{g.lignes.length}</span>
                {replie ? <ChevronRight className="size-4 text-(--lm-encre-2)" aria-hidden /> : <ChevronDown className="size-4 text-(--lm-encre-2)" aria-hidden />}
              </button>
            </h2>
            {!replie && (
              <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
                {g.lignes.map((c) => (
                  <Contact key={c.id} c={c} onOuvrir={onOuvrir} onModifier={onModifier} lectureSeule={lectureSeule} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Contact({ c, onOuvrir, onModifier, lectureSeule }: { c: ContactCrm } & Omit<GrilleProps, 'contacts'>) {
  const retard = relanceEnRetard(c);
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOuvrir(c.id)}
          className="block max-w-full truncate rounded-md text-left text-[14.5px] font-medium text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
        >
          {c.nom}
        </button>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[12.5px] text-(--lm-encre-2)">
          <PastilleStatut contact={c} onModifier={onModifier} lectureSeule={lectureSeule} />
          {c.ville && <span className="truncate">{c.ville}</span>}
          {c.relanceLe && (
            <span className={cn('lm-chiffres whitespace-nowrap', retard && 'font-medium text-(--lm-danger)')}>
              Relance {jourMois(c.relanceLe)}
              {retard && ' · en retard'}
            </span>
          )}
        </div>
      </div>
      {c.telephone && (
        <a
          href={`tel:${c.telephone.replace(/[^\d+]/g, '')}`}
          aria-label={`Appeler ${c.nom} au ${c.telephone}`}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-(--lm-or-lavis) text-(--lm-or-texte) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
        >
          <Phone className="size-[18px]" aria-hidden />
        </a>
      )}
    </li>
  );
}
