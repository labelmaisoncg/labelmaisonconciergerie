import { useRef, useState, type KeyboardEvent } from 'react';
import { euros, pluriel, pourcentage } from '../data/format';
import type { MoisPerformance } from '../data/types-proprietaire';
import { cn } from '../ui';
import { titreMois } from './commun';

const COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const INITIALES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const numeroMois = (m: string) => Number(m.slice(5, 7)) - 1;

/** Pas « rond » de l'axe (1, 2, 2,5 ou 5 × 10ⁿ euros) pour trois intervalles. */
function graduation(maxCentimes: number): number[] {
  const max = Math.max(1, maxCentimes / 100);
  const brut = max / 3;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = ([1, 2, 2.5, 5, 10].find((k) => k * p >= brut) ?? 10) * p;
  return [0, 1, 2, 3].map((i) => Math.round(i * pas * 100));
}

/** « 1,2 k€ », « 800 € » : axe compact. */
function eurosCompact(centimes: number): string {
  const e = centimes / 100;
  if (e >= 1000) return `${(e / 1000).toLocaleString('fr-FR', { maximumFractionDigits: e >= 10_000 ? 0 : 1 })} k€`;
  return `${Math.round(e).toLocaleString('fr-FR')} €`;
}

/**
 * Revenu net par mois : une seule série (or), barres de 24 px au plus,
 * arrondies en haut, posées sur la ligne de base ; quadrillage en filets.
 * Survol ou focus clavier (flèches) : le mois, sa valeur, ses nuits. Le
 * dernier mois porte sa valeur ; le tableau qui suit donne tout le reste.
 */
export function BarresMensuelles({ mois, titre }: { mois: MoisPerformance[]; titre: string }) {
  const [actif, setActif] = useState<number | null>(null);
  const [focus, setFocus] = useState(mois.length - 1);
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);
  const ticks = graduation(Math.max(0, ...mois.map((m) => m.net)));
  const haut = ticks[ticks.length - 1] || 1;
  const dernier = mois.map((m) => m.suivi).lastIndexOf(true);
  const n = mois.length;

  const deplacer = (e: KeyboardEvent, i: number) => {
    const cible = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (cible < 0 || cible >= n) return;
    e.preventDefault();
    setFocus(cible);
    boutons.current[cible]?.focus();
  };

  const m = actif !== null ? mois[actif] : null;
  const position = actif === null ? undefined : actif < 2 ? { left: 0 } : actif > n - 3 ? { right: 0 } : { left: `${((actif + 0.5) / n) * 100}%`, transform: 'translateX(-50%)' };

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{titre}</figcaption>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2">
        {/* Axe vertical : graduations rondes, compactes. */}
        <div className="relative h-40 sm:h-48" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="lm-chiffres absolute right-0 translate-y-1/2 text-[11px] text-(--lm-encre-3)" style={{ bottom: `${(t / haut) * 100}%` }}>
              {eurosCompact(t)}
            </span>
          ))}
        </div>

        <div className="relative h-40 sm:h-48">
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 h-px bg-(--lm-bord)" style={{ bottom: `${(t / haut) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex" role="group" aria-label={titre} onPointerLeave={() => setActif(null)}>
            {mois.map((x, i) => {
              const h = x.suivi ? Math.max(0, x.net / haut) * 100 : 0;
              const libelle = x.suivi
                ? `${titreMois(x.mois)} : ${euros(x.net, true)} pour vous, ${pluriel(x.nuits, 'nuit')}, ${pourcentage(x.occupation)} d’occupation`
                : `${titreMois(x.mois)} : pas encore de données`;
              return (
                <button
                  key={x.mois}
                  ref={(b) => {
                    boutons.current[i] = b;
                  }}
                  type="button"
                  tabIndex={i === focus ? 0 : -1}
                  aria-label={libelle}
                  onPointerEnter={() => setActif(i)}
                  onFocus={() => {
                    setActif(i);
                    setFocus(i);
                  }}
                  onBlur={() => setActif(null)}
                  onKeyDown={(e) => deplacer(e, i)}
                  className="group relative h-full min-w-0 flex-1 focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus-visible:ring-inset"
                >
                  {x.suivi && x.net > 0 && (
                    <span
                      className={cn(
                        'absolute bottom-0 left-1/2 w-[min(24px,62%)] -translate-x-1/2 rounded-t-[4px] transition-colors',
                        actif === i ? 'bg-(--lm-or-texte)' : 'bg-(--lm-or)',
                      )}
                      style={{ height: `${h}%` }}
                      aria-hidden
                    />
                  )}
                  {i === dernier && x.net > 0 && actif === null && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 pb-1 text-[11px] font-semibold whitespace-nowrap text-(--lm-encre)"
                      style={{ bottom: `${h}%` }}
                      aria-hidden
                    >
                      {eurosCompact(x.net)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {m && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-3 py-2 text-[12.5px] whitespace-nowrap shadow-(--lm-ombre-haute)"
              style={position}
              aria-hidden
            >
              {m.suivi ? (
                <>
                  <p className="text-[14px] font-semibold text-(--lm-encre)">{euros(m.net, true)}</p>
                  <p className="text-(--lm-encre-2)">
                    {titreMois(m.mois)} · {pluriel(m.nuits, 'nuit')} · {pourcentage(m.occupation)}
                  </p>
                </>
              ) : (
                <p className="text-(--lm-encre-2)">{titreMois(m.mois)} : pas encore de données</p>
              )}
            </div>
          )}
        </div>

        {/* Axe horizontal : initiale sur téléphone, mois abrégé au-delà. */}
        <span aria-hidden />
        <div className="mt-1.5 flex" aria-hidden>
          {mois.map((x) => (
            <span key={x.mois} className={cn('min-w-0 flex-1 text-center text-[11px]', x.suivi ? 'text-(--lm-encre-2)' : 'text-(--lm-encre-3)')}>
              <span className="sm:hidden">{INITIALES[numeroMois(x.mois)]}</span>
              <span className="hidden sm:inline">{COURTS[numeroMois(x.mois)]}</span>
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
