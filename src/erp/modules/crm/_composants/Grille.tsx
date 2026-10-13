import { useState } from 'react';
import { ChevronDown, ChevronRight, Phone } from 'lucide-react';
import { LIBELLE_SOURCE_CRM, LIBELLE_STATUT_CRM, STATUTS_CLOS, STATUTS_CRM } from '../../../data/crm';
import { AUJOURDHUI, jourMois } from '../../../data/format';
import type { ContactCrm, Responsable, StatutContactCrm } from '../../../data/types';
import { cn } from '../../../ui';
import { PASTILLE, POINT } from './statuts';

export interface GrilleProps {
  contacts: ContactCrm[];
  onOuvrir: (id: string) => void;
  onModifier: (c: ContactCrm) => void;
  lectureSeule: boolean;
}

const RESPONSABLES: { valeur: '' | Responsable; libelle: string }[] = [
  { valeur: '', libelle: '—' },
  { valeur: 'abdel', libelle: 'Abdel' },
  { valeur: 'kamel', libelle: 'Kamel' },
];

/** En-têtes de colonnes (largeurs fixes : la grille défile, jamais la page). */
const COLONNES = [
  { cle: 'num', titre: '', classe: 'w-10' },
  { cle: 'nom', titre: 'Nom', classe: 'w-52' },
  { cle: 'statut', titre: 'Étape', classe: 'w-36' },
  { cle: 'tel', titre: 'Téléphone', classe: 'w-40' },
  { cle: 'relance', titre: 'Relance', classe: 'w-40' },
  { cle: 'ville', titre: 'Ville', classe: 'w-36' },
  { cle: 'bien', titre: 'Bien', classe: 'w-32' },
  { cle: 'source', titre: 'Source', classe: 'w-32' },
  { cle: 'recu', titre: 'Reçu le', classe: 'w-24' },
  { cle: 'resp', titre: 'Suivi par', classe: 'w-28' },
  { cle: 'notes', titre: 'Notes', classe: 'w-64' },
];

const CELLULE = 'border-b border-r border-(--lm-bord) px-3 py-2 align-middle';

/** Pastille d'étape, modifiable sur place (sélecteur natif posé dessus, accessible au clavier). */
export function PastilleStatut({
  contact,
  onModifier,
  lectureSeule,
}: {
  contact: ContactCrm;
  onModifier: (c: ContactCrm) => void;
  lectureSeule: boolean;
}) {
  return (
    <span className="relative inline-flex">
      <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium whitespace-nowrap', PASTILLE[contact.statut])}>
        {LIBELLE_STATUT_CRM[contact.statut]}
        {!lectureSeule && <ChevronDown className="size-3 opacity-70" aria-hidden />}
      </span>
      {!lectureSeule && (
        <select
          aria-label={`Étape de ${contact.nom}`}
          value={contact.statut}
          onChange={(e) => onModifier({ ...contact, statut: e.target.value as StatutContactCrm })}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {STATUTS_CRM.map((s) => (
            <option key={s.cle} value={s.cle}>
              {s.libelle}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

/** Relance prévue avant aujourd'hui sur un contact encore en cours. */
export function relanceEnRetard(c: ContactCrm): boolean {
  return !!c.relanceLe && c.relanceLe < AUJOURDHUI && !STATUTS_CLOS.includes(c.statut);
}

function Ligne({ c, n, onOuvrir, onModifier, lectureSeule }: { c: ContactCrm; n: number } & Omit<GrilleProps, 'contacts'>) {
  const retard = relanceEnRetard(c);
  const derniere = c.notes || c.motifAttente || c.message || '';
  return (
    <tr className="group bg-(--lm-surface) hover:bg-(--lm-surface-2)">
      <td className={cn(CELLULE, 'lm-chiffres text-center text-[12px] text-(--lm-encre-3)')}>{n}</td>
      <td className={cn(CELLULE, 'sticky left-0 z-[1] bg-inherit')}>
        <button
          type="button"
          onClick={() => onOuvrir(c.id)}
          className="block max-w-full truncate text-left font-medium text-(--lm-encre) hover:text-(--lm-or-texte) hover:underline"
        >
          {c.nom}
        </button>
      </td>
      <td className={CELLULE}>
        <PastilleStatut contact={c} onModifier={onModifier} lectureSeule={lectureSeule} />
      </td>
      <td className={CELLULE}>
        {c.telephone ? (
          <a href={`tel:${c.telephone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 whitespace-nowrap text-(--lm-encre) hover:text-(--lm-or-texte)">
            <Phone className="size-3.5 text-(--lm-or-texte)" aria-hidden />
            <span className="lm-chiffres">{c.telephone}</span>
          </a>
        ) : (
          <span className="text-(--lm-encre-3)">—</span>
        )}
      </td>
      <td className={CELLULE}>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label={`Relance de ${c.nom}`}
            value={c.relanceLe ?? ''}
            disabled={lectureSeule}
            onChange={(e) => onModifier({ ...c, relanceLe: e.target.value || undefined })}
            className={cn(
              'lm-chiffres w-[8.5rem] rounded-md bg-transparent px-1 py-0.5 text-[13px] focus:ring-2 focus:ring-(--lm-or-anneau) focus:outline-none',
              retard ? 'font-medium text-(--lm-danger)' : c.relanceLe ? 'text-(--lm-encre)' : 'text-(--lm-encre-3)',
            )}
          />
          {retard && <span className="text-[11.5px] font-medium whitespace-nowrap text-(--lm-danger)">en retard</span>}
        </div>
      </td>
      <td className={cn(CELLULE, 'max-w-40 truncate')}>{c.ville || <span className="text-(--lm-encre-3)">—</span>}</td>
      <td className={cn(CELLULE, 'max-w-32 truncate')}>{c.typeBien || <span className="text-(--lm-encre-3)">—</span>}</td>
      <td className={cn(CELLULE, 'whitespace-nowrap text-(--lm-encre-2)')}>{LIBELLE_SOURCE_CRM[c.source]}</td>
      <td className={cn(CELLULE, 'lm-chiffres whitespace-nowrap text-(--lm-encre-2)')}>{jourMois(c.creeLe.slice(0, 10))}</td>
      <td className={CELLULE}>
        <select
          aria-label={`Suivi de ${c.nom}`}
          value={c.responsable ?? ''}
          disabled={lectureSeule}
          onChange={(e) => onModifier({ ...c, responsable: (e.target.value || undefined) as Responsable | undefined })}
          className="w-full cursor-pointer rounded-md bg-transparent py-0.5 text-[13px] text-(--lm-encre) focus:ring-2 focus:ring-(--lm-or-anneau) focus:outline-none"
        >
          {RESPONSABLES.map((r) => (
            <option key={r.valeur} value={r.valeur}>
              {r.libelle}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(CELLULE, 'max-w-64 truncate text-(--lm-encre-2)')} title={derniere}>
        {derniere || <span className="text-(--lm-encre-3)">—</span>}
      </td>
    </tr>
  );
}

/**
 * Grille façon Airtable : une ligne par contact, regroupée par étape (en-tête
 * de groupe coloré, repliable). Étapes closes repliées au départ.
 */
export function Grille({ contacts, onOuvrir, onModifier, lectureSeule }: GrilleProps) {
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
      // Relances les plus urgentes d'abord, puis les demandes les plus récentes.
      .sort((a, b) => (a.relanceLe ?? '9999').localeCompare(b.relanceLe ?? '9999') || b.creeLe.localeCompare(a.creeLe)),
  })).filter((g) => g.lignes.length > 0);

  let n = 0;
  return (
    <div className="lm-defilement overflow-x-auto rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre)">
      <table className="w-full min-w-[1120px] border-collapse text-[13.5px]">
        <caption className="sr-only">Contacts du CRM, regroupés par étape</caption>
        <thead className="sticky top-0 z-[2] bg-(--lm-surface-2)">
          <tr>
            {COLONNES.map((col) => (
              <th
                key={col.cle}
                scope="col"
                className={cn(
                  'border-b border-r border-(--lm-bord-fort) px-3 py-2 text-left text-[12px] font-semibold text-(--lm-encre-2)',
                  col.classe,
                  col.cle === 'nom' && 'sticky left-0 z-[3] bg-(--lm-surface-2)',
                )}
              >
                {col.titre || <span className="sr-only">Numéro</span>}
              </th>
            ))}
          </tr>
        </thead>
        {groupes.map((g) => {
          const replie = replies.has(g.cle);
          return (
            <tbody key={g.cle}>
              <tr>
                <th colSpan={COLONNES.length} scope="rowgroup" className="border-b border-(--lm-bord) bg-(--lm-fond) p-0 text-left">
                  <button
                    type="button"
                    onClick={() => basculer(g.cle)}
                    aria-expanded={!replie}
                    className="sticky left-0 flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-(--lm-encre) hover:text-(--lm-or-texte)"
                  >
                    {replie ? <ChevronRight className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                    <span className={cn('size-2 rounded-full', POINT[g.cle])} aria-hidden />
                    {g.libelle}
                    <span className="lm-chiffres rounded-full bg-(--lm-neutre-lavis) px-2 text-[12px] font-medium text-(--lm-encre-2)">{g.lignes.length}</span>
                  </button>
                </th>
              </tr>
              {!replie &&
                g.lignes.map((c) => {
                  n += 1;
                  return <Ligne key={c.id} c={c} n={n} onOuvrir={onOuvrir} onModifier={onModifier} lectureSeule={lectureSeule} />;
                })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
