import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Home, Search, User } from 'lucide-react';
import { useErp } from '../data/store';
import { dateCourte } from '../data/format';
import { cn } from '../ui';

interface Resultat {
  id: string;
  groupe: 'Logements' | 'Propriétaires' | 'Réservations';
  titre: string;
  detail: string;
  to: string;
}

/** Sans accents ni casse, pour une recherche tolérante. */
const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ICONES = { Logements: Home, Propriétaires: User, Réservations: CalendarDays };

/** Recherche globale : logements, propriétaires, réservations → fiche. */
export function GlobalSearch({ className }: { className?: string }) {
  const { logements, proprietaires, reservations } = useErp();
  const naviguer = useNavigate();
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listeId = useId();

  const resultats = useMemo<Resultat[]>(() => {
    const n = normaliser(q.trim());
    if (n.length < 2) return [];
    const trouve = (...champs: string[]) => champs.some((c) => normaliser(c).includes(n));
    const nomLogement = (id: string) => logements.find((l) => l.id === id)?.nom ?? '';
    return [
      ...logements
        .filter((l) => trouve(l.nom, l.ville, l.adresse))
        .slice(0, 5)
        .map((l): Resultat => ({ id: l.id, groupe: 'Logements', titre: l.nom, detail: `${l.ville} · ${l.type}`, to: `/erp/logements/${l.id}` })),
      ...proprietaires
        .filter((p) => trouve(p.nom, p.contact.email))
        .slice(0, 5)
        .map((p): Resultat => ({ id: p.id, groupe: 'Propriétaires', titre: p.nom, detail: p.contact.email, to: `/erp/proprietaires/${p.id}` })),
      ...reservations
        .filter((r) => trouve(r.voyageur.nom, r.id, r.channexBookingId ?? ''))
        .sort((a, b) => b.arrivee.localeCompare(a.arrivee))
        .slice(0, 5)
        .map((r): Resultat => ({
          id: r.id,
          groupe: 'Réservations',
          titre: r.voyageur.nom,
          detail: `${nomLogement(r.logementId)} · ${dateCourte(r.arrivee)}`,
          to: `/erp/reservations/${r.id}`,
        })),
    ];
  }, [q, logements, proprietaires, reservations]);

  useEffect(() => setActif(0), [q]);

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, []);

  const aller = (r: Resultat) => {
    naviguer(r.to);
    setQ('');
    setOuvert(false);
  };

  const clavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, resultats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && resultats[actif]) {
      e.preventDefault();
      aller(resultats[actif]);
    } else if (e.key === 'Escape') {
      setOuvert(false);
    }
  };

  const visible = ouvert && q.trim().length >= 2;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--lm-encre-3)" />
      <input
        type="search"
        role="combobox"
        aria-label="Rechercher un logement, un propriétaire ou une réservation"
        aria-expanded={visible}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={visible && resultats[actif] ? `${listeId}-${actif}` : undefined}
        placeholder="Rechercher"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onKeyDown={clavier}
        className="h-9 w-full rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) pr-3 pl-8 text-[13.5px] text-(--lm-encre) placeholder:text-(--lm-encre-3) focus:border-(--lm-or) focus:bg-(--lm-surface) focus:ring-4 focus:ring-(--lm-or-lavis) focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {visible && (
        <div className="lm-apparition absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre-haute) sm:min-w-[380px]">
          {resultats.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-(--lm-encre-3)">Aucun résultat pour « {q.trim()} ».</p>
          ) : (
            <ul id={listeId} role="listbox" aria-label="Résultats" className="lm-defilement max-h-[60vh] overflow-y-auto py-1">
              {resultats.map((r, i) => {
                const Icone = ICONES[r.groupe];
                const premier = i === 0 || resultats[i - 1].groupe !== r.groupe;
                return (
                  <li key={`${r.groupe}-${r.id}`} role="presentation">
                    {premier && (
                      <p role="presentation" className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-(--lm-encre-3) uppercase">
                        {r.groupe}
                      </p>
                    )}
                    <div
                      id={`${listeId}-${i}`}
                      role="option"
                      aria-selected={i === actif}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => aller(r)}
                      onMouseEnter={() => setActif(i)}
                      className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2', i === actif && 'bg-(--lm-or-lavis)')}
                    >
                      <Icone className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">{r.titre}</span>
                        <span className="block truncate text-[12px] text-(--lm-encre-3)">{r.detail}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
