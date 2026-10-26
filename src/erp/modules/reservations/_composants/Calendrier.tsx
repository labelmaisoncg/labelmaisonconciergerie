/**
 * Planning multi-logements, à la manière d'Airbnb : une ligne par logement
 * (photo et nom collés à gauche), une colonne par jour (en-tête collé en
 * haut). Un séjour va du milieu du jour d'arrivée au milieu du jour de
 * départ : départ et arrivée partagent la même case. Les nuits libres
 * affichent leur prix lu sur les plateformes, les nuits fermées sans
 * réservation sont hachurées. Lecture seule : rien ne part vers Airbnb ou
 * Booking depuis ce planning.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, ButtonLink, Card, EmptyState, IconButton, Segmente, cn } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, ajouterJours, ecartJours, euros, moisAnnee, pluriel } from '../../../data/format';
import type { CanalReservation, DateISO, Logement, Reservation } from '../../../data/types';
import { VisuelLogement } from '../../logements/_composants/Visuel';
import { CANAUX, TEINTE_CANAL, etatSejour, nuitsDuSejour, nuitsVoyageurs, plageDates, recu } from './outils';

type Plage = 'semaines' | 'mois';
const PLAGES: { valeur: Plage; libelle: string }[] = [
  { valeur: 'semaines', libelle: '2 semaines' },
  { valeur: 'mois', libelle: 'Mois' },
];
/** Largeur minimale d'un jour : en dessous, la grille défile dans la carte. */
const LARGEUR_MIN: Record<Plage, number> = { semaines: 44, mois: 24 };
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS_INITIALE = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** Les jours de recul affichés avant aujourd'hui en vue « 2 semaines » (départs récents). */
const RECUL = 2;
const HACHURE = 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--lm-neutre-lavis)_5px_10px)]';

interface Props {
  logements: Logement[];
  reservations: Reservation[];
  onOuvrir: (r: Reservation) => void;
}

const jourSemaine = (date: DateISO) => new Date(`${date}T12:00:00`).getDay();
const estWeekEnd = (date: DateISO) => [0, 6].includes(jourSemaine(date));
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function estMobile(): boolean {
  try {
    return window.matchMedia('(max-width: 639px)').matches;
  } catch {
    return false;
  }
}

/** « Septembre 2026 », « Septembre – octobre 2026 ». */
function titrePeriode(debut: DateISO, fin: DateISO): string {
  const a = moisAnnee(debut);
  const b = moisAnnee(fin);
  if (a === b) return majuscule(a);
  return majuscule(debut.slice(0, 4) === fin.slice(0, 4) ? `${a.split(' ')[0]} – ${b}` : `${a} – ${b}`);
}

interface Bulle {
  r: Reservation;
  x: number;
  y: number;
  dessous: boolean;
}

export function Calendrier({ logements, reservations, onOuvrir }: Props) {
  const [plage, setPlage] = useState<Plage>(() => (estMobile() ? 'semaines' : 'mois'));
  // Les deux vues démarrent la veille d'aujourd'hui : le planning montre surtout ce qui vient.
  const [debut, setDebut] = useState<DateISO>(() => ajouterJours(AUJOURDHUI, -RECUL));
  const [annulees, setAnnulees] = useState(false);
  const [bulle, setBulle] = useState<Bulle | null>(null);
  const [largeurDispo, setLargeurDispo] = useState(0);
  const defilement = useRef<HTMLDivElement>(null);

  const debutVue = debut;
  const finVue = ajouterJours(debutVue, plage === 'mois' ? 30 : 14);
  const n = ecartJours(debutVue, finVue);
  const jours = useMemo(() => Array.from({ length: n }, (_, i) => ajouterJours(debutVue, i)), [debutVue, n]);
  const col = largeurDispo >= 600 ? 196 : 112;
  const w = Math.max(LARGEUR_MIN[plage], Math.floor((largeurDispo - col) / n) || 0);
  const largeurGrille = n * w;
  const indexAujourdhui = ecartJours(debutVue, AUJOURDHUI);
  const aujourdhuiVisible = indexAujourdhui >= 0 && indexAujourdhui < n;

  // Largeur de la carte : les jours la remplissent, sans descendre sous la largeur minimale.
  useLayoutEffect(() => {
    const el = defilement.current;
    if (!el) return;
    setLargeurDispo(el.clientWidth);
    const obs = new ResizeObserver(() => setLargeurDispo(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Quand la grille déborde, aujourd'hui reste en vue (la veille en premier).
  useLayoutEffect(() => {
    const el = defilement.current;
    if (el) el.scrollLeft = aujourdhuiVisible ? Math.max(0, (indexAujourdhui - 1) * w) : 0;
  }, [debutVue, plage, w, aujourdhuiVisible, indexAujourdhui]);

  // L'infobulle suit la barre : elle disparaît dès que la page défile.
  useEffect(() => {
    if (!bulle) return;
    const fermer = () => setBulle(null);
    window.addEventListener('scroll', fermer, true);
    return () => window.removeEventListener('scroll', fermer, true);
  }, [bulle]);

  const lignes = useMemo(
    () =>
      logements.map((l) => {
        const siennes = reservations.filter((r) => r.logementId === l.id && r.depart > debutVue && r.arrivee < finVue);
        const occupees = new Set<DateISO>();
        const departs = new Set<DateISO>();
        for (const r of siennes) {
          if (r.statut === 'annulee') continue;
          for (const nuit of nuitsDuSejour(r.arrivee, r.depart)) occupees.add(nuit);
          departs.add(r.depart);
        }
        const tarifs = new Map((l.tarifs?.jours ?? []).map((j) => [j.date, j]));
        const enPreparation = l.statut === 'lancement';
        const cases = jours.map((j) => {
          const t = enPreparation ? undefined : tarifs.get(j);
          const avenir = j >= AUJOURDHUI;
          return {
            date: j,
            // Prix d'une nuit libre, lu sur les plateformes (affichage seulement).
            prix: avenir && t?.libre && t.prixCentimes > 0 && !occupees.has(j) ? t.prixCentimes : undefined,
            ferme: avenir && (enPreparation || (!!t && !t.libre && !occupees.has(j))),
            apresDepart: departs.has(j),
          };
        });
        return { l, sejours: siennes.filter((r) => annulees || r.statut !== 'annulee'), cases };
      }),
    [logements, reservations, debutVue, finVue, annulees, jours],
  );

  const nbAnnulees = lignes.reduce((s, x) => s + reservations.filter((r) => r.logementId === x.l.id && r.statut === 'annulee' && r.depart > debutVue && r.arrivee < finVue).length, 0);
  const canauxVus = CANAUX.filter((c) => lignes.some((x) => x.sejours.some((r) => r.canal === c && r.statut !== 'annulee')));
  // Jour de départ : la barre couvre la moitié gauche, le prix va dans la moitié droite s'il y tient.
  // Sous 30 px par jour, les prix se colleraient : ils ne s'affichent pas.
  const prixVisible = (c: { prix?: number; apresDepart: boolean }) => c.prix !== undefined && w >= 30 && (!c.apresDepart || w >= 52);
  const prixVus = lignes.some((x) => x.cases.some(prixVisible));
  const fermesVus = lignes.some((x) => x.cases.some((c) => c.ferme));

  const pas = plage === 'mois' ? 28 : 7;
  const precedent = () => setDebut(ajouterJours(debut, -pas));
  const suivant = () => setDebut(ajouterJours(debut, pas));
  const revenir = () => setDebut(ajouterJours(AUJOURDHUI, -RECUL));
  const changerPlage = (p: Plage) => {
    if (p === plage) return;
    setPlage(p);
  };

  const montrer = (r: Reservation, el: HTMLElement, x?: number) => {
    const rect = el.getBoundingClientRect();
    const demi = 136;
    const cx = Math.min(Math.max(x ?? rect.left + rect.width / 2, demi + 8), window.innerWidth - demi - 8);
    const dessous = rect.top < 150;
    setBulle({ r, x: cx, y: dessous ? rect.bottom + 8 : rect.top - 8, dessous });
  };

  if (!logements.length) {
    return (
      <Card>
        <EmptyState
          icone={<CalendarDays />}
          titre="Aucun logement à afficher."
          description="Le planning montre les logements actifs et ceux en préparation."
          action={<ButtonLink to="/erp/logements">Voir les logements</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <Card flush className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--lm-bord) px-3 py-2.5 sm:px-4">
        <h2 className="min-w-0 flex-1 basis-40 text-[15px] font-semibold text-(--lm-encre)" aria-live="polite">
          {titrePeriode(debutVue, ajouterJours(finVue, -1))}
        </h2>
        <div className="flex items-center gap-1">
          <IconButton label={plage === 'mois' ? 'Mois précédent' : 'Semaine précédente'} size="sm" onClick={precedent}>
            <ChevronLeft />
          </IconButton>
          <Button size="sm" onClick={revenir}>
            Aujourd’hui
          </Button>
          <IconButton label={plage === 'mois' ? 'Mois suivant' : 'Semaine suivante'} size="sm" onClick={suivant}>
            <ChevronRight />
          </IconButton>
        </div>
        <Segmente label="Durée affichée" options={PLAGES} valeur={plage} onChange={changerPlage} />
      </div>

      <div
        ref={defilement}
        onScroll={() => bulle && setBulle(null)}
        className="lm-defilement max-h-[calc(100dvh-14rem)] min-h-40 overflow-auto"
      >
        <div className="relative" style={{ width: col + largeurGrille }}>
          {/* En-tête des jours, collé en haut de la carte */}
          <div className="sticky top-0 z-20 flex border-b border-(--lm-bord) bg-(--lm-surface)">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-end border-r border-(--lm-bord) bg-(--lm-surface) px-3 pb-2 text-[12px] font-medium text-(--lm-encre-3)"
              style={{ width: col }}
            >
              {pluriel(logements.length, 'logement')}
            </div>
            {jours.map((j) => {
              const js = jourSemaine(j);
              const auj = j === AUJOURDHUI;
              const premier = j.endsWith('-01');
              return (
                <div
                  key={j}
                  style={{ width: w }}
                  className={cn('lm-chiffres flex h-12 shrink-0 flex-col items-center justify-center gap-0.5 leading-none', estWeekEnd(j) && 'bg-(--lm-surface-2)')}
                >
                  <span className={cn('text-[10.5px]', premier ? 'font-semibold text-(--lm-or-texte)' : 'text-(--lm-encre-3)')}>
                    {premier ? MOIS_COURTS[Number(j.slice(5, 7)) - 1] : w >= 40 ? JOURS_COURTS[js] : JOURS_INITIALE[js]}
                  </span>
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-[12.5px]',
                      auj ? 'bg-(--lm-or-texte) font-semibold text-(--lm-surface)' : 'font-medium text-(--lm-encre)',
                    )}
                    aria-label={auj ? 'Aujourd’hui' : undefined}
                  >
                    {Number(j.slice(8))}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Une ligne par logement */}
          {lignes.map(({ l, sejours, cases }) => (
            <div key={l.id} className="flex border-b border-(--lm-bord) last:border-b-0">
              <Link
                to={`/erp/logements/${l.id}`}
                className="group sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-r border-(--lm-bord) bg-(--lm-surface) px-3 hover:bg-(--lm-surface-2)"
                style={{ width: col }}
                title={l.nom}
              >
                <VisuelLogement logement={l} taille="sm" className={cn('shrink-0 rounded-lg', col > 150 ? 'size-9' : 'size-7')} />
                <span className="min-w-0">
                  <span className={cn('block font-medium text-(--lm-encre) group-hover:text-(--lm-or-texte)', col > 150 ? 'truncate text-[13px]' : 'line-clamp-2 text-[12px] leading-tight')}>
                    {l.nom}
                  </span>
                  {col > 150 && (
                    <span className="block truncate text-[11.5px] text-(--lm-encre-3)">{l.statut === 'lancement' ? 'En préparation' : l.ville}</span>
                  )}
                </span>
              </Link>
              <div className="relative h-14 shrink-0" style={{ width: largeurGrille }}>
                <div aria-hidden className="absolute inset-0 flex">
                  {cases.map((c) => (
                    <div key={c.date} style={{ width: w }} className={cn('relative h-full shrink-0', estWeekEnd(c.date) && 'bg-(--lm-surface-2)')}>
                      {c.ferme && <span className={cn('absolute inset-y-0', HACHURE, c.apresDepart ? 'right-0 left-1/2' : 'inset-x-0')} />}
                      {prixVisible(c) && c.prix !== undefined && (
                        <span
                          className={cn(
                            'lm-chiffres absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10.5px] whitespace-nowrap text-(--lm-encre-3)',
                            c.apresDepart ? 'left-3/4' : 'left-1/2',
                          )}
                        >
                          {w >= 44 ? euros(c.prix, true) : Math.round(c.prix / 100)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {aujourdhuiVisible && (
                  <span aria-hidden className="absolute inset-y-0 z-[3] w-px bg-(--lm-or)" style={{ left: indexAujourdhui * w + w / 2 }} />
                )}
                {sejours.map((r) => (
                  <Barre
                    key={r.id}
                    r={r}
                    debut={debutVue}
                    n={n}
                    w={w}
                    onOuvrir={(x) => {
                      setBulle(null);
                      onOuvrir(x);
                    }}
                    onMontrer={montrer}
                    onCacher={() => setBulle(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-(--lm-bord) px-3 py-2.5 text-[12.5px] text-(--lm-encre-2) sm:px-4">
        {canauxVus.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: TEINTE_CANAL[c].plein }} />
            {LIBELLES.canal[c]}
          </span>
        ))}
        {prixVus && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="lm-chiffres text-[11px] text-(--lm-encre-3)">{w >= 44 ? '85 €' : '85'}</span>
            Prix d’une nuit libre{w >= 44 ? '' : ', en euros'}
          </span>
        )}
        {fermesVus && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('h-3 w-5 rounded-sm border border-(--lm-bord)', HACHURE)} />
            Indisponible
          </span>
        )}
        {nbAnnulees > 0 && (
          <button
            type="button"
            aria-pressed={annulees}
            onClick={() => setAnnulees((a) => !a)}
            className="-my-1 ml-auto inline-flex h-8 items-center rounded-md px-2 font-medium text-(--lm-or-texte) hover:bg-(--lm-or-lavis)"
          >
            {annulees ? 'Masquer les annulations' : `Voir les annulations (${nbAnnulees})`}
          </button>
        )}
      </div>

      {bulle && <Infobulle {...bulle} />}
    </Card>
  );
}

function Barre({
  r,
  debut,
  n,
  w,
  onOuvrir,
  onMontrer,
  onCacher,
}: {
  r: Reservation;
  debut: DateISO;
  n: number;
  w: number;
  onOuvrir: (r: Reservation) => void;
  onMontrer: (r: Reservation, el: HTMLElement, x?: number) => void;
  onCacher: () => void;
}) {
  const t = TEINTE_CANAL[r.canal];
  const annulee = r.statut === 'annulee';
  const passee = r.depart < AUJOURDHUI;
  // Milieu du jour d'arrivée → milieu du jour de départ, borné à la fenêtre.
  const a = ecartJours(debut, r.arrivee) + 0.5;
  const b = ecartJours(debut, r.depart) + 0.5;
  const coupeGauche = a < 0;
  const coupeDroite = b > n;
  const x0 = Math.max(0, a) * w + (coupeGauche ? 0 : 2);
  const x1 = Math.min(n, b) * w - (coupeDroite ? 0 : 2);
  const largeur = Math.max(8, x1 - x0);
  const style = annulee
    ? { color: 'var(--lm-encre-3)' }
    : passee
      ? { background: t.lavis, color: t.encre }
      : { background: t.plein, color: t.texte };
  const libelle = `${r.voyageur.nom}, ${LIBELLES.canal[r.canal]}, ${plageDates(r.arrivee, r.depart)}, ${pluriel(r.nuits, 'nuit')}, ${etatSejour(r)}`;
  return (
    <button
      type="button"
      aria-label={libelle}
      onClick={() => onOuvrir(r)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onMontrer(r, e.currentTarget, e.clientX)}
      onPointerLeave={onCacher}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && onMontrer(r, e.currentTarget)}
      onBlur={onCacher}
      className={cn(
        'absolute inset-y-3 z-[4] flex items-center gap-1.5 overflow-hidden px-2 text-left text-[12px] font-medium whitespace-nowrap transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus-visible:ring-offset-1 focus:outline-none',
        coupeGauche && coupeDroite ? 'rounded-none' : coupeGauche ? 'rounded-r-lg' : coupeDroite ? 'rounded-l-lg' : 'rounded-lg',
        annulee && 'border border-dashed border-(--lm-bord-fort) bg-(--lm-surface) line-through',
      )}
      style={{ left: x0, width: largeur, ...style }}
    >
      {largeur >= 96 && !annulee && (
        <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[9px] leading-none font-bold opacity-80">
          {t.lettre}
        </span>
      )}
      {largeur >= 36 && (
        <span className="truncate">
          {r.voyageur.nom.split(' ')[0]}
          {largeur >= 132 ? ` · ${pluriel(r.nuits, 'nuit')}` : ''}
        </span>
      )}
    </button>
  );
}

/** Infobulle d'un séjour, au survol (souris) ou au clavier ; au toucher, le tap ouvre directement le séjour. */
function Infobulle({ r, x, y, dessous }: Bulle) {
  const canal: CanalReservation = r.canal;
  return (
    <div
      aria-hidden
      className={cn(
        'lm-apparition pointer-events-none fixed z-50 w-[272px] -translate-x-1/2 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-3 text-[12.5px] shadow-(--lm-ombre-haute)',
        !dessous && '-translate-y-full',
      )}
      style={{ left: x, top: y }}
    >
      <p className="truncate text-[14px] font-semibold text-(--lm-encre)">{r.voyageur.nom}</p>
      <p className="lm-chiffres mt-0.5 text-(--lm-encre-2)">
        {plageDates(r.arrivee, r.depart)} · {nuitsVoyageurs(r)}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-(--lm-encre-2)">
        <span aria-hidden className="size-2 rounded-full" style={{ background: TEINTE_CANAL[canal].plein }} />
        {LIBELLES.canal[canal]} · {etatSejour(r)}
      </p>
      {r.statut !== 'annulee' && (
        <p className="lm-chiffres mt-2 flex items-baseline justify-between border-t border-(--lm-bord) pt-2">
          <span className="text-(--lm-encre-2)">Vous recevez</span>
          <span className="text-[13.5px] font-semibold text-(--lm-encre)">{euros(recu(r))}</span>
        </p>
      )}
    </div>
  );
}
