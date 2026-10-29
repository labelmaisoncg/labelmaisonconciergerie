import { useState } from 'react';
import { ChevronDown, ChevronRight, Phone } from 'lucide-react';
import { LIBELLE_SOURCE_CRM, LIBELLE_STATUT_CRM, STATUTS_CLOS, STATUTS_CRM } from '../../../data/crm';
import { espaceOuvert } from '../../../data/espaces';
import { AUJOURDHUI, jourMois } from '../../../data/format';
import { optionsSuiviCrm } from '../../../data/marque-espace';
import { useErp } from '../../../data/store';
import type { ContactCrm, StatutContactCrm, SuiviCrm } from '../../../data/types';
import { cn } from '../../../ui';
import { PASTILLE, POINT } from './statuts';

export interface GrilleProps {
  contacts: ContactCrm[];
  onOuvrir: (id: string) => void;
  onModifier: (c: ContactCrm) => void;
  lectureSeule: boolean;
}

/**
 * Colonnes, largeurs fixes (table-fixed) : la grille défile, jamais la page.
 * Ce qui sert à décider (étape, téléphone, relance, suivi) vient en premier.
 */
const COLONNES = [
  { cle: 'num', titre: '', classe: 'hidden w-10 sm:table-cell' },
  { cle: 'nom', titre: 'Nom', classe: 'w-36 sm:w-52' },
  { cle: 'statut', titre: 'Étape', classe: 'w-36' },
  { cle: 'tel', titre: 'Téléphone', classe: 'w-40' },
  { cle: 'relance', titre: 'Relance', classe: 'w-44' },
  { cle: 'resp', titre: 'Suivi par', classe: 'w-28' },
  { cle: 'ville', titre: 'Ville', classe: 'w-36' },
  { cle: 'bien', titre: 'Bien', classe: 'w-32' },
  { cle: 'notes', titre: 'Notes', classe: 'w-64' },
  { cle: 'source', titre: 'Source', classe: 'w-32' },
  { cle: 'recu', titre: 'Reçu le', classe: 'w-24' },
];

const CELLULE = 'border-b border-r border-(--lm-bord) px-3 py-1.5 align-middle';
const CHAMP = 'h-8 rounded-md bg-transparent text-[13px] focus:ring-2 focus:ring-(--lm-encre) focus:outline-none';

/** Pastille d'étape, modifiable sur place : sélecteur natif posé dessus (clavier, lecteurs d'écran), focus visible. */
export function PastilleStatut({ contact, onModifier, lectureSeule }: { contact: ContactCrm; onModifier: (c: ContactCrm) => void; lectureSeule: boolean }) {
  const pastille = (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium whitespace-nowrap', PASTILLE[contact.statut])}>
      {LIBELLE_STATUT_CRM[contact.statut]}
      {!lectureSeule && <ChevronDown className="size-3 opacity-70" aria-hidden />}
    </span>
  );
  if (lectureSeule) return pastille;
  return (
    <span className="relative inline-flex h-8 items-center rounded-full focus-within:ring-2 focus-within:ring-(--lm-encre)">
      {pastille}
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
    </span>
  );
}

/** Relance prévue avant aujourd'hui sur un contact encore en cours. */
export function relanceEnRetard(c: ContactCrm): boolean {
  return !!c.relanceLe && c.relanceLe < AUJOURDHUI && !STATUTS_CLOS.includes(c.statut);
}

/**
 * Date de relance, courte (« 20 oct. », « · en retard » en rouge) : elle tient
 * dans sa colonne quel que soit le navigateur. Un clic ouvre le calendrier ;
 * « — » tant qu'il n'y en a pas.
 */
function CelluleRelance({ c, onModifier, lectureSeule }: { c: ContactCrm; onModifier: (c: ContactCrm) => void; lectureSeule: boolean }) {
  const [edition, setEdition] = useState(false);
  const retard = relanceEnRetard(c);
  if (!edition) {
    const texte = c.relanceLe ? (
      <span className={cn('lm-chiffres truncate', retard ? 'font-medium text-(--lm-danger)' : 'text-(--lm-encre)')}>
        {jourMois(c.relanceLe)}
        {retard && ' · en retard'}
      </span>
    ) : (
      <span className="text-(--lm-encre-3)">—</span>
    );
    if (lectureSeule) return <span className="flex h-8 items-center">{texte}</span>;
    return (
      <button
        type="button"
        onClick={() => setEdition(true)}
        aria-label={c.relanceLe ? `Relance de ${c.nom} : ${jourMois(c.relanceLe)}${retard ? ', en retard' : ''}. Modifier` : `Prévoir une relance pour ${c.nom}`}
        className="flex h-8 w-full min-w-0 items-center rounded-md px-1 text-left hover:bg-(--lm-neutre-lavis) focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none"
      >
        {texte}
      </button>
    );
  }
  return (
    <input
      type="date"
      autoFocus
      aria-label={`Relance de ${c.nom}`}
      value={c.relanceLe ?? ''}
      onFocus={(e) => {
        // Le calendrier s'ouvre directement (navigateurs qui le permettent).
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* ouverture au clic sinon */
        }
      }}
      onBlur={() => setEdition(false)}
      onChange={(e) => onModifier({ ...c, relanceLe: e.target.value || undefined })}
      className={cn(CHAMP, 'lm-chiffres w-full min-w-0 px-1 text-(--lm-encre)')}
    />
  );
}

function Ligne({ c, n, onOuvrir, onModifier, lectureSeule }: { c: ContactCrm; n: number } & Omit<GrilleProps, 'contacts'>) {
  const { utilisateurs } = useErp();
  const derniere = c.notes || c.motifAttente || c.message || '';
  // Label Maison : Abdel et Kamel ; un autre espace : ses membres.
  const suivis = [{ valeur: '', libelle: '—' }, ...optionsSuiviCrm(espaceOuvert(), utilisateurs, c.responsable, true)];
  return (
    <tr className="group bg-(--lm-surface) hover:bg-(--lm-surface-2)">
      <td className={cn(CELLULE, 'lm-chiffres hidden text-center text-[12px] text-(--lm-encre-3) sm:table-cell')}>{n}</td>
      <td className={cn(CELLULE, 'sticky left-0 z-[1] bg-inherit')}>
        <button
          type="button"
          onClick={() => onOuvrir(c.id)}
          className="-my-1.5 block max-w-full truncate rounded-md py-1.5 text-left font-medium text-(--lm-encre) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none"
        >
          {c.nom}
        </button>
      </td>
      <td className={CELLULE}>
        <PastilleStatut contact={c} onModifier={onModifier} lectureSeule={lectureSeule} />
      </td>
      <td className={CELLULE}>
        {c.telephone ? (
          <a
            href={`tel:${c.telephone.replace(/[^\d+]/g, '')}`}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap text-(--lm-encre) hover:underline"
          >
            <Phone className="size-3.5 text-(--lm-encre)" aria-hidden />
            <span className="lm-chiffres">{c.telephone}</span>
          </a>
        ) : (
          <span className="text-(--lm-encre-3)">—</span>
        )}
      </td>
      <td className={CELLULE}>
        <CelluleRelance c={c} onModifier={onModifier} lectureSeule={lectureSeule} />
      </td>
      <td className={CELLULE}>
        <select
          aria-label={`Suivi de ${c.nom}`}
          value={c.responsable ?? ''}
          disabled={lectureSeule}
          onChange={(e) => onModifier({ ...c, responsable: (e.target.value || undefined) as SuiviCrm | undefined })}
          className={cn(CHAMP, 'w-full cursor-pointer text-(--lm-encre)')}
        >
          {suivis.map((r) => (
            <option key={r.valeur} value={r.valeur}>
              {r.libelle}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(CELLULE, 'truncate')}>{c.ville || <span className="text-(--lm-encre-3)">—</span>}</td>
      <td className={cn(CELLULE, 'truncate')}>{c.typeBien || <span className="text-(--lm-encre-3)">—</span>}</td>
      <td className={cn(CELLULE, 'truncate text-(--lm-encre-2)')} title={derniere}>
        {derniere || <span className="text-(--lm-encre-3)">—</span>}
      </td>
      <td className={cn(CELLULE, 'truncate text-(--lm-encre-2)')}>{LIBELLE_SOURCE_CRM[c.source]}</td>
      <td className={cn(CELLULE, 'lm-chiffres whitespace-nowrap text-(--lm-encre-2)')}>{jourMois(c.creeLe.slice(0, 10))}</td>
    </tr>
  );
}

/**
 * Grille façon Airtable : une ligne par contact, regroupée par étape (en-tête
 * de groupe coloré avec son nombre, repliable). Étapes closes repliées au départ.
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
      {/* border-separate : le filet de la colonne Nom (collée) la suit au défilement. */}
      <table className="w-full min-w-[1472px] table-fixed border-separate border-spacing-0 text-[13.5px] sm:min-w-[1576px]">
        <caption className="sr-only">Contacts du CRM, regroupés par étape</caption>
        <thead className="bg-(--lm-surface-2)">
          <tr>
            {COLONNES.map((col) => (
              <th
                key={col.cle}
                scope="col"
                className={cn(
                  'border-b border-r border-(--lm-bord-fort) px-3 py-2 text-left text-[12px] font-semibold whitespace-nowrap text-(--lm-encre-2)',
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
                    className="sticky left-0 flex h-9 items-center gap-2 px-3 text-[13px] font-semibold text-(--lm-encre) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none focus-visible:ring-inset"
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
