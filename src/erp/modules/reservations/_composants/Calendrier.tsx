/**
 * Planning multi-logements (vue Gantt) : une ligne par logement, une colonne
 * par jour. Les séjours vont du milieu du jour d'arrivée au milieu du jour de
 * départ, comme dans un PMS : départ et arrivée partagent la même case.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, IconButton, cn } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, ajouterJours, dateCourte, ecartJours, pluriel } from '../../../data/format';
import type { Logement, Reservation } from '../../../data/types';
import { CANAUX, COULEUR_CANAL } from './outils';

const ZOOMS = [14, 30, 60] as const;
type Zoom = (typeof ZOOMS)[number];
const LARGEUR: Record<Zoom, number> = { 14: 64, 30: 38, 60: 22 };
const JOURS_SEMAINE = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

interface Props {
  logements: Logement[];
  reservations: Reservation[];
  onOuvrir: (r: Reservation) => void;
}

function jourSemaine(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function Calendrier({ logements, reservations, onOuvrir }: Props) {
  const [debut, setDebut] = useState(ajouterJours(AUJOURDHUI, -3));
  const [zoom, setZoom] = useState<Zoom>(30);
  const [annulees, setAnnulees] = useState(false);
  const w = LARGEUR[zoom];
  const fin = ajouterJours(debut, zoom);
  const jours = useMemo(() => Array.from({ length: zoom }, (_, i) => ajouterJours(debut, i)), [debut, zoom]);
  const largeurGrille = zoom * w;

  const parLogement = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.depart <= debut || r.arrivee >= fin) continue;
      if (r.statut === 'annulee' && !annulees) continue;
      m.set(r.logementId, [...(m.get(r.logementId) ?? []), r]);
    }
    return m;
  }, [reservations, debut, fin, annulees]);

  const indexAujourdhui = ecartJours(debut, AUJOURDHUI);

  return (
    <Card flush className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--lm-bord) px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <IconButton label="Période précédente" size="sm" onClick={() => setDebut(ajouterJours(debut, -Math.round(zoom / 2)))}>
            <ChevronLeft />
          </IconButton>
          <Button size="sm" onClick={() => setDebut(ajouterJours(AUJOURDHUI, -3))}>
            Aujourd’hui
          </Button>
          <IconButton label="Période suivante" size="sm" onClick={() => setDebut(ajouterJours(debut, Math.round(zoom / 2)))}>
            <ChevronRight />
          </IconButton>
        </div>
        <p className="lm-chiffres text-[13px] text-(--lm-encre-2)">
          {dateCourte(debut)} au {dateCourte(ajouterJours(fin, -1))}
        </p>
        <div role="group" aria-label="Zoom" className="flex rounded-lg border border-(--lm-bord-fort) p-0.5 sm:ml-auto">
          {ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
              className={cn(
                'lm-chiffres h-7 rounded-md px-2.5 text-[12.5px] font-medium',
                zoom === z ? 'bg-(--lm-or-lavis) text-(--lm-brun)' : 'text-(--lm-encre-2) hover:text-(--lm-encre)',
              )}
            >
              {z} j
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[13px] text-(--lm-encre-2)">
          <input type="checkbox" checked={annulees} onChange={(e) => setAnnulees(e.target.checked)} className="accent-(--lm-or)" />
          Afficher les annulées
        </label>
      </div>

      <div className="lm-defilement overflow-x-auto">
        <div className="relative [--col:132px] sm:[--col:210px]" style={{ width: `calc(var(--col) + ${largeurGrille}px)` }}>
          {/* En-tête des jours */}
          <div className="sticky top-0 z-20 flex border-b border-(--lm-bord) bg-(--lm-surface-2)">
            <div className="sticky left-0 z-30 flex w-(--col) shrink-0 items-end border-r border-(--lm-bord) bg-(--lm-surface-2) px-3 py-1.5 text-[12px] font-medium text-(--lm-encre-2)">
              Logement
            </div>
            {jours.map((j) => {
              const js = jourSemaine(j);
              const auj = j === AUJOURDHUI;
              return (
                <div
                  key={j}
                  style={{ width: w }}
                  className={cn(
                    'lm-chiffres shrink-0 border-r border-(--lm-bord) py-1 text-center leading-tight',
                    (js === 0 || js === 6) && 'bg-(--lm-neutre-lavis)',
                    auj && 'bg-(--lm-or-lavis) font-semibold text-(--lm-brun)',
                  )}
                  title={dateCourte(j)}
                >
                  <span className="block text-[10.5px] text-(--lm-encre-3)">{zoom === 60 ? '' : JOURS_SEMAINE[js]}</span>
                  <span className={cn('block text-[12px]', j.endsWith('-01') && 'font-semibold text-(--lm-or)')}>{Number(j.slice(8))}</span>
                </div>
              );
            })}
          </div>

          {/* Lignes */}
          {logements.map((l) => (
            <div key={l.id} className="flex border-b border-(--lm-bord) last:border-b-0">
              <div className="sticky left-0 z-10 flex w-(--col) shrink-0 flex-col justify-center border-r border-(--lm-bord) bg-(--lm-surface) px-3 py-1.5">
                <span className="truncate text-[13px] font-medium text-(--lm-encre)">{l.nom}</span>
                <span className="truncate text-[11.5px] text-(--lm-encre-3)">
                  {l.statut === 'lancement' ? 'En lancement' : `${l.ville} · ${l.type}`}
                </span>
              </div>
              <div className="relative h-12 shrink-0" style={{ width: largeurGrille }}>
                <div aria-hidden className="absolute inset-0 flex">
                  {jours.map((j) => {
                    const js = jourSemaine(j);
                    return (
                      <div
                        key={j}
                        style={{ width: w }}
                        className={cn(
                          'h-full shrink-0 border-r border-(--lm-bord)',
                          (js === 0 || js === 6) && 'bg-(--lm-surface-2)',
                          l.statut === 'lancement' && 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(20,17,14,0.04)_6px_12px)]',
                        )}
                      />
                    );
                  })}
                </div>
                {indexAujourdhui >= 0 && indexAujourdhui < zoom && (
                  <div aria-hidden className="absolute inset-y-0 bg-(--lm-or-lavis)" style={{ left: indexAujourdhui * w, width: w }} />
                )}
                {(parLogement.get(l.id) ?? []).map((r) => (
                  <Barre key={r.id} r={r} debut={debut} zoom={zoom} w={w} onOuvrir={onOuvrir} />
                ))}
              </div>
            </div>
          ))}
          {indexAujourdhui >= 0 && indexAujourdhui < zoom && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-(--lm-or)"
              style={{ left: `calc(var(--col) + ${indexAujourdhui * w + w / 2}px)` }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-(--lm-bord) px-3 py-2.5 text-[12.5px] text-(--lm-encre-2) sm:px-4">
        <span className="font-medium text-(--lm-encre)">Légende</span>
        {CANAUX.filter((c) => c !== 'autre').map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-5 rounded-sm border-l-[3px]" style={{ background: COULEUR_CANAL[c].fond, borderColor: COULEUR_CANAL[c].bord }} />
            {LIBELLES.canal[c]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-5 rounded-sm border border-dashed border-(--lm-danger) bg-(--lm-danger-lavis)" />
          Annulée
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-px bg-(--lm-or)" />
          Aujourd’hui
        </span>
      </div>
    </Card>
  );
}

function Barre({ r, debut, zoom, w, onOuvrir }: { r: Reservation; debut: string; zoom: number; w: number; onOuvrir: (r: Reservation) => void }) {
  const couleur = COULEUR_CANAL[r.canal];
  const annulee = r.statut === 'annulee';
  // Milieu du jour d'arrivée → milieu du jour de départ, borné à la fenêtre.
  const x0 = Math.max(0, (ecartJours(debut, r.arrivee) + 0.5) * w);
  const x1 = Math.min(zoom * w, (ecartJours(debut, r.depart) + 0.5) * w);
  const coupeGauche = r.arrivee < debut;
  const coupeDroite = ecartJours(debut, r.depart) + 0.5 > zoom;
  const largeur = Math.max(6, x1 - x0 - 2);
  const libelle = `${r.voyageur.nom}, ${LIBELLES.canal[r.canal]}, du ${dateCourte(r.arrivee)} au ${dateCourte(r.depart)} (${pluriel(r.nuits, 'nuit')}), ${LIBELLES.statutReservation[r.statut]}`;
  return (
    <button
      type="button"
      onClick={() => onOuvrir(r)}
      title={libelle}
      aria-label={libelle}
      className={cn(
        'absolute top-2 bottom-2 z-[6] flex items-center overflow-hidden px-1.5 text-left text-[12px] font-medium whitespace-nowrap shadow-sm transition-[filter] hover:brightness-95 focus-visible:z-10',
        coupeGauche ? 'rounded-l-none' : 'rounded-l-md',
        coupeDroite ? 'rounded-r-none' : 'rounded-r-md',
        annulee && 'border border-dashed border-(--lm-danger) line-through opacity-70',
      )}
      style={{
        left: x0 + 1,
        width: largeur,
        background: annulee ? 'var(--lm-danger-lavis)' : couleur.fond,
        color: annulee ? 'var(--lm-danger)' : couleur.texte,
        borderLeft: annulee || coupeGauche ? undefined : `3px solid ${couleur.bord}`,
      }}
    >
      {largeur > 34 && <span className="truncate">{r.voyageur.nom.split(' ')[0]}{largeur > 90 ? ` · ${r.nuits} n.` : ''}</span>}
    </button>
  );
}
